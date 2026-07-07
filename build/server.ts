// Dev server: build once, serve dist/, watch sources, rebuild, and live-reload.
import http from 'node:http';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import chokidar from 'chokidar';
import { build, ROOT, localDocsDir } from './build.ts';

const DIST = path.join(ROOT, 'dist');
const PORT = Number(process.env.PORT) || 4321;

const MIME: Record<string, string> = {
	'.html': 'text/html; charset=utf-8',
	'.js': 'text/javascript; charset=utf-8',
	'.css': 'text/css; charset=utf-8',
	'.json': 'application/json; charset=utf-8',
	'.svg': 'image/svg+xml',
	'.woff2': 'font/woff2',
	'.woff': 'font/woff',
	'.txt': 'text/plain; charset=utf-8',
	'.png': 'image/png',
};

const RELOAD_SNIPPET = `<script>new EventSource('/__reload').onmessage=()=>location.reload();</script>`;
const clients = new Set<http.ServerResponse>();

async function resolveFile(urlPath: string): Promise<string | null> {
	let rel = decodeURIComponent(urlPath.split('?')[0]!).replace(/^\/+/, '');
	if (rel === '' || rel.endsWith('/')) rel += 'index.html';
	const candidates = [rel];
	if (!path.extname(rel)) candidates.push(path.join(rel, 'index.html'));
	for (const c of candidates) {
		const full = path.join(DIST, c);
		if (!full.startsWith(DIST)) continue; // no traversal
		try {
			const stat = await fs.stat(full);
			if (stat.isFile()) return full;
		} catch {
			/* keep trying */
		}
	}
	return null;
}

// ── Dev-only analytics fixture ────────────────────────────────────────────────
// A small deterministic dataset so the /admin/ dashboard renders locally without
// wrangler/D1. The real data comes from D1 via functions/admin/api/stats.ts; the response
// shapes returned here match what that function will return.
interface StubPage {
	path: string;
	title: string;
	dwell: number; // seconds on the page
	scroll: number; // deepest scroll bucket, percent
}
interface StubSession {
	visitor: string;
	session: string;
	city: string;
	region: string;
	country: string;
	lat: number;
	lon: number;
	device: string;
	browser: string;
	os: string;
	ref: string | null;
	agoMin: number; // how long ago the visit started
	bot?: boolean; // ran the beacon (pageviews) but never a dwell -> treated as a bot
	pages: StubPage[];
}

const STUB_SESSIONS: StubSession[] = [
	{
		visitor: 'v-anders', session: 's-anders-1', city: 'Trondheim', region: 'Trøndelag',
		country: 'NO', lat: 63.43, lon: 10.39, device: 'Desktop', browser: 'Firefox', os: 'Linux',
		ref: 'news.ycombinator.com', agoMin: 12,
		pages: [
			{ path: '/', title: 'Λόγος', dwell: 34, scroll: 75 },
			{ path: '/vision/', title: 'Vision', dwell: 88, scroll: 100 },
			{ path: '/download/', title: 'Download', dwell: 20, scroll: 50 },
		],
	},
	{
		visitor: 'v-mira', session: 's-mira-1', city: 'Berlin', region: 'Berlin', country: 'DE',
		lat: 52.52, lon: 13.4, device: 'Mobile', browser: 'Safari', os: 'iOS', ref: null, agoMin: 40,
		pages: [
			{ path: '/', title: 'Λόγος', dwell: 15, scroll: 50 },
			{ path: '/roadmap/', title: 'Roadmap', dwell: 61, scroll: 75 },
		],
	},
	{
		visitor: 'v-kenji', session: 's-kenji-1', city: 'Tokyo', region: 'Tokyo', country: 'JP',
		lat: 35.68, lon: 139.69, device: 'Desktop', browser: 'Chrome', os: 'macOS',
		ref: 'github.com', agoMin: 95,
		pages: [
			{ path: '/docs/', title: 'Docs', dwell: 120, scroll: 100 },
			{ path: '/playground/', title: 'Playground', dwell: 44, scroll: 50 },
		],
	},
	{
		visitor: 'v-anders', session: 's-anders-2', city: 'Oslo', region: 'Oslo', country: 'NO',
		lat: 59.91, lon: 10.75, device: 'Mobile', browser: 'Chrome', os: 'Android', ref: null,
		agoMin: 1500,
		pages: [{ path: '/download/', title: 'Download', dwell: 30, scroll: 100 }],
	},
	{
		visitor: 'v-sara', session: 's-sara-1', city: 'San Francisco', region: 'California',
		country: 'US', lat: 37.77, lon: -122.42, device: 'Desktop', browser: 'Chrome', os: 'Windows',
		ref: 'reddit.com', agoMin: 300,
		pages: [
			{ path: '/', title: 'Λόγος', dwell: 22, scroll: 25 },
			{ path: '/about/', title: 'About', dwell: 50, scroll: 100 },
			{ path: '/vision/', title: 'Vision', dwell: 70, scroll: 75 },
		],
	},
	// A JS-running research crawler (browser UA, so the requests bot flag misses it): it fires
	// the opening pageview on each page but is torn down without a pagehide, so no dwell is ever
	// sent. Zero dwell across the whole visit -> the dashboard treats it as a bot.
	{
		visitor: 'v-grok', session: 's-grok-1', city: 'Ashburn', region: 'Virginia',
		country: 'US', lat: 39.04, lon: -77.49, device: 'Desktop', browser: 'Chrome', os: 'Linux',
		ref: null, agoMin: 18, bot: true,
		pages: [
			{ path: '/', title: 'Λόγος', dwell: 0, scroll: 0 },
			{ path: '/vision/', title: 'Vision', dwell: 0, scroll: 0 },
			{ path: '/roadmap/', title: 'Roadmap', dwell: 0, scroll: 0 },
			{ path: '/download/', title: 'Download', dwell: 0, scroll: 0 },
		],
	},
];

interface StubEvent {
	ts: number;
	visitor: string;
	session: string;
	type: string;
	name: string | null;
	value: string | null;
	path: string;
	title: string;
	dur: number | null;
	city: string;
	region: string;
	country: string;
	device: string;
	browser: string;
	os: string;
	ref: string | null;
	asorg: string;
}

/** Expand the fixture sessions into a flat, time-stamped event stream. */
function stubEvents(now: number): StubEvent[] {
	const NET: Record<string, string> = { NO: 'Telenor', DE: 'Vodafone', JP: 'NTT', US: 'Comcast' };
	const out: StubEvent[] = [];
	for (const s of STUB_SESSIONS) {
		let t = now - s.agoMin * 60000;
		for (const p of s.pages) {
			const base = {
				visitor: s.visitor, session: s.session, city: s.city, region: s.region,
				country: s.country, device: s.device, browser: s.browser, os: s.os, ref: s.ref,
				asorg: NET[s.country] ?? 'Unknown',
			};
			out.push({ ...base, ts: t, type: 'pageview', name: null, value: null, path: p.path, title: p.title, dur: null });
			// Bots never fire a pagehide, so they emit no dwell event -> zero time tracked.
			if (!s.bot) {
				out.push({ ...base, ts: t + p.dwell * 1000, type: 'event', name: 'dwell', value: null, path: p.path, title: p.title, dur: p.dwell * 1000 });
			}
			t += (p.dwell + 5) * 1000;
		}
	}
	return out;
}

// Bot / crawler traffic (server-side `requests` in production). Only visible with the
// Bots filter on, so local dev exercises the bot dots, the merged Log, and the toggles.
interface StubBot {
	bot_name: string;
	path: string;
	city: string;
	region: string;
	country: string;
	lat: number;
	lon: number;
	asorg: string;
	device: string;
	agoMin: number;
	status: number;
}
const STUB_BOTS: StubBot[] = [
	{ bot_name: 'ClaudeBot', path: '/', city: 'Ashburn', region: 'Virginia', country: 'US', lat: 39.04, lon: -77.49, asorg: 'Amazon', device: 'Desktop', agoMin: 5, status: 200 },
	{ bot_name: 'Claude-User', path: '/', city: 'London', region: 'England', country: 'GB', lat: 51.51, lon: -0.13, asorg: 'Cloudflare', device: 'Desktop', agoMin: 8, status: 200 },
	{ bot_name: 'GPTBot', path: '/vision/', city: 'Des Moines', region: 'Iowa', country: 'US', lat: 41.6, lon: -93.6, asorg: 'Microsoft', device: 'Desktop', agoMin: 22, status: 200 },
	{ bot_name: 'Googlebot', path: '/download/', city: 'Mountain View', region: 'California', country: 'US', lat: 37.42, lon: -122.08, asorg: 'Google', device: 'Desktop', agoMin: 48, status: 200 },
	{ bot_name: 'PerplexityBot', path: '/about/', city: 'San Francisco', region: 'California', country: 'US', lat: 37.77, lon: -122.42, asorg: 'Cloudflare', device: 'Desktop', agoMin: 70, status: 200 },
	{ bot_name: 'bingbot', path: '/nope/', city: 'Dublin', region: 'Leinster', country: 'IE', lat: 53.35, lon: -6.26, asorg: 'Microsoft', device: 'Desktop', agoMin: 130, status: 404 },
];

function stubBotDots(): unknown[] {
	const by = new Map<string, { lat: number; lon: number; city: string; region: string; country: string; asorg: string; bot_name: string; hits: number }>();
	for (const b of STUB_BOTS) {
		const k = `${b.lat},${b.lon}`;
		const cur = by.get(k);
		if (cur) cur.hits++;
		else by.set(k, { lat: b.lat, lon: b.lon, city: b.city, region: b.region, country: b.country, asorg: b.asorg, bot_name: b.bot_name, hits: 1 });
	}
	return [...by.values()];
}

/** Serve the fixture in the same shapes as functions/admin/api/stats.ts, keyed by ?view / ?session / ?visitor. */
function sampleStats(url: string): unknown {
	const q = new URLSearchParams(url.split('?')[1] ?? '');
	const now = Date.now();
	const events = stubEvents(now);
	const wantHumans = q.get('humans') !== '0';
	const wantBots = q.get('bots') === '1';

	const sessionId = q.get('session');
	if (sessionId) {
		const evs = events.filter((e) => e.session === sessionId).sort((a, b) => a.ts - b.ts);
		return {
			session: sessionId,
			visitor: evs[0]?.visitor ?? '',
			events: evs.map((e) => ({ ts: e.ts, type: e.type, name: e.name, value: e.value, path: e.path, title: e.title, dur: e.dur, city: e.city, country: e.country, device: e.device })),
		};
	}

	const visitorId = q.get('visitor');
	if (visitorId) {
		const own = STUB_SESSIONS.filter((s) => s.visitor === visitorId);
		return {
			visitor: visitorId,
			sessions: own.map((s) => {
				const evs = events.filter((e) => e.session === s.session).sort((a, b) => a.ts - b.ts);
				return {
					session: s.session,
					start: evs[0]?.ts ?? 0,
					end: evs[evs.length - 1]?.ts ?? 0,
					city: s.city, region: s.region, country: s.country,
					device: s.device, browser: s.browser, os: s.os, ref: s.ref,
					events: evs.map((e) => ({ ts: e.ts, type: e.type, name: e.name, value: e.value, path: e.path, title: e.title, dur: e.dur })),
				};
			}),
		};
	}

	const view = q.get('view') ?? 'map';

	if (view === 'log') {
		// All-requests Log: humans are non-bot server hits, bots are detected crawlers.
		const rows: { ts: number; [k: string]: unknown }[] = [];
		if (wantHumans) {
			// One request per human pageview (the server sees the hit; no visitor id here).
			for (const e of events.filter((e) => e.type === 'pageview')) {
				rows.push({ kind: 'human', ts: e.ts, path: e.path, status: 200, bot: 0, bot_name: null, browser: e.browser, os: e.os, device: e.device, city: e.city, country: e.country, asorg: e.asorg, ref: e.ref });
			}
			// A no-JS hit the beacon would never see, now visible in the all-requests Log.
			rows.push({ kind: 'human', ts: now - 15 * 60000, path: '/', status: 200, bot: 0, bot_name: null, browser: 'Other', os: 'Other', device: 'Desktop', city: 'Warsaw', country: 'PL', asorg: 'Orange', ref: null });
		}
		if (wantBots) {
			for (const b of STUB_BOTS) {
				rows.push({ kind: 'bot', ts: now - b.agoMin * 60000, path: b.path, status: b.status, bot: 1, bot_name: b.bot_name, browser: 'Other', os: 'Other', device: b.device, city: b.city, country: b.country, asorg: b.asorg, ref: null });
			}
		}
		// Server-side-style column filters (mirror functions/admin/api/stats.ts).
		const LOG_FILTERS: Record<string, (r: Record<string, unknown>) => string> = {
			client: (r) => (r.bot ? String(r.bot_name ?? 'bot') : 'human'),
			page: (r) => String(r.path ?? ''),
			status: (r) => String(r.status ?? ''),
			country: (r) => String(r.country ?? ''),
			city: (r) => String(r.city ?? ''),
			network: (r) => String(r.asorg ?? ''),
			device: (r) => String(r.device ?? ''),
			browser: (r) => String(r.browser ?? ''),
			os: (r) => String(r.os ?? ''),
			referrer: (r) => String(r.ref ?? 'direct'),
		};
		let filtered = rows;
		for (const [key, get] of Object.entries(LOG_FILTERS)) {
			const v = (q.get(`f_${key}`) ?? '').trim().toLowerCase();
			if (v) filtered = filtered.filter((r) => get(r).toLowerCase().includes(v));
		}
		filtered.sort((a, b) => b.ts - a.ts);
		return { rows: filtered.slice(0, 500) };
	}

	if (view === 'users') {
		if (!wantHumans && !wantBots) return { users: [] };
		// A visitor is human once they've ever emitted a dwell; zero-dwell visitors are bots.
		const humanVisitors = new Set(events.filter((e) => e.name === 'dwell').map((e) => e.visitor));
		const byVisitor = new Map<string, StubEvent[]>();
		for (const e of events) {
			const arr = byVisitor.get(e.visitor) ?? [];
			arr.push(e);
			byVisitor.set(e.visitor, arr);
		}
		let users = [...byVisitor.entries()].map(([visitor, evs]) => {
			const sorted = evs.slice().sort((a, b) => a.ts - b.ts);
			const last = sorted[sorted.length - 1]!;
			return {
				visitor,
				bot: humanVisitors.has(visitor) ? 0 : 1,
				visits: new Set(evs.map((e) => e.session)).size,
				pageviews: evs.filter((e) => e.type === 'pageview').length,
				firstSeen: sorted[0]!.ts,
				lastSeen: last.ts,
				locations: [...new Set(evs.map((e) => `${e.city}|${e.country}`))],
				lastCity: last.city,
				lastDevice: last.device,
			};
		});
		if (!wantHumans) users = users.filter((u) => u.bot);
		if (!wantBots) users = users.filter((u) => !u.bot);
		users.sort((a, b) => b.lastSeen - a.lastSeen);
		return { users };
	}

	if (view === 'access') {
		const now = Date.now();
		return {
			access: [
				{ ts: now - 3 * 60000, outcome: 'granted', path: '/admin/', ip: '84.209.12.34', country: 'NO', region: 'Trøndelag', city: 'Trondheim', asorg: 'Telenor', device: 'Desktop', browser: 'Firefox', os: 'Linux' },
				{ ts: now - 95 * 60000, outcome: 'denied', path: '/admin/api/stats', ip: '45.140.17.9', country: 'RU', region: 'Moscow', city: 'Moscow', asorg: 'Chang Way Technologies', device: 'Desktop', browser: 'Other', os: 'Linux' },
				{ ts: now - 240 * 60000, outcome: 'denied', path: '/admin/', ip: '103.21.60.2', country: 'IN', region: 'Karnataka', city: 'Bengaluru', asorg: 'Censys Scanner', device: 'Desktop', browser: 'Other', os: 'Other' },
				{ ts: now - 1500 * 60000, outcome: 'granted', path: '/admin/', ip: '84.209.44.7', country: 'NO', region: 'Oslo', city: 'Oslo', asorg: 'Telenor', device: 'Mobile', browser: 'Chrome', os: 'Android' },
			],
		};
	}

	// map (default): human dots from dwell-having sessions, bot dots aggregated by location.
	const humanVisitors = new Set(events.filter((e) => e.name === 'dwell').map((e) => e.visitor));
	const humanSessions = STUB_SESSIONS.filter((s) => humanVisitors.has(s.visitor));
	const dots = wantHumans
		? humanSessions.map((s) => {
				const evs = events.filter((e) => e.session === s.session);
				return {
					session: s.session, visitor: s.visitor, lat: s.lat, lon: s.lon, city: s.city,
					region: s.region, country: s.country,
					pages: evs.filter((e) => e.type === 'pageview').length,
					start: Math.min(...evs.map((e) => e.ts)),
				};
			})
		: [];
	// Zero-dwell (bot) sessions fold into the Bots bucket, matching functions/admin/api/stats.ts.
	const botSessions = STUB_SESSIONS.filter((s) => !humanVisitors.has(s.visitor));
	const botEventPvs = events.filter((e) => e.type === 'pageview' && !humanVisitors.has(e.visitor));
	const botDots = wantBots
		? [
				...stubBotDots(),
				...botSessions.map((s) => ({
					lat: s.lat, lon: s.lon, city: s.city, region: s.region, country: s.country,
					asorg: null, bot_name: null,
					hits: events.filter((e) => e.session === s.session && e.type === 'pageview').length,
				})),
			]
		: [];
	return {
		totals: {
			pageviews: wantHumans ? events.filter((e) => e.type === 'pageview' && humanVisitors.has(e.visitor)).length : 0,
			visits: wantHumans ? humanSessions.length : 0,
			visitors: wantHumans ? new Set(humanSessions.map((s) => s.visitor)).size : 0,
			botHits: wantBots ? STUB_BOTS.length + botEventPvs.length : 0,
		},
		dots,
		botDots,
	};
}

const server = http.createServer(async (req, res) => {
	const url = req.url ?? '/';

	// Dev-only stand-in for the Cloudflare Pages Function at functions/api/subscribe.ts
	// (Pages Functions don't run under this plain static server). Reads the form, logs
	// the email to the console, and answers like the real function's happy path so the
	// notify forms can be exercised locally.
	if (url.split('?')[0] === '/api/subscribe' && req.method === 'POST') {
		let body = '';
		req.on('data', (chunk) => (body += chunk));
		req.on('end', () => {
			const email = new URLSearchParams(body).get('email') ?? '(none)';
			console.log(`subscribe stub: ${email}`);
			res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
			res.end(JSON.stringify({ ok: true }));
		});
		return;
	}

	// Dev-only analytics ingest stub: accept the beacon, log it, and 204 like the real
	// Cloudflare Function (functions/api/collect.ts), which doesn't run under this server.
	if (url.split('?')[0] === '/api/collect' && req.method === 'POST') {
		let body = '';
		req.on('data', (chunk) => (body += chunk));
		req.on('end', () => {
			try {
				const e = JSON.parse(body || '{}');
				console.log(`collect stub: ${e.type ?? '?'} ${e.path ?? ''} ${e.name ? `(${e.name})` : ''}`.trim());
			} catch {
				/* ignore an unparseable beacon */
			}
			res.writeHead(204).end();
		});
		return;
	}

	// Dev-only dashboard data stub: serve the deterministic fixture so /admin/ renders
	// locally without wrangler/D1 (functions/admin/api/stats.ts is the real query layer).
	if (url.split('?')[0] === '/admin/api/stats' && req.method === 'GET') {
		res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
		res.end(JSON.stringify(sampleStats(url)));
		return;
	}

	// Dev-only subscribers stub (functions/admin/api/subscribers.ts reads the real KV).
	if (url.split('?')[0] === '/admin/api/subscribers' && req.method === 'GET') {
		res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
		res.end(
			JSON.stringify({
				configured: true,
				count: 3,
				subscribers: [
					{ email: 'ada@example.com', subscribedAt: '2026-07-05T10:12:00.000Z', source: 'home' },
					{ email: 'linus@example.org', subscribedAt: '2026-07-04T22:03:00.000Z', source: 'download' },
					{ email: 'grace@example.net', subscribedAt: '2026-07-01T08:30:00.000Z', source: 'home' },
				],
			}),
		);
		return;
	}

	if (url.startsWith('/__reload')) {
		res.writeHead(200, {
			'Content-Type': 'text/event-stream',
			'Cache-Control': 'no-cache',
			Connection: 'keep-alive',
		});
		res.write('\n');
		clients.add(res);
		req.on('close', () => clients.delete(res));
		return;
	}

	const file = await resolveFile(url);
	if (!file) {
		res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
		res.end('<h1>404</h1>');
		return;
	}

	// HTML/CSS/JS are never cached in dev so rebuilds are always fresh. Fonts are
	// content-hashed (fonts/[name]-[hash].woff2), so they're safe to cache hard;
	// without this they re-download on every navigation and the text visibly
	// re-flows (FOUT) each time you change page.
	const ext = path.extname(file);
	const isFont = ext === '.woff2' || ext === '.woff';
	const cache = { 'Cache-Control': isFont ? 'public, max-age=31536000, immutable' : 'no-store' };

	if (ext === '.html') {
		let html = await fs.readFile(file, 'utf8');
		html = html.replace('</body>', `${RELOAD_SNIPPET}</body>`);
		res.writeHead(200, { 'Content-Type': MIME['.html']!, ...cache });
		res.end(html);
		return;
	}
	res.writeHead(200, { 'Content-Type': MIME[ext] ?? 'application/octet-stream', ...cache });
	res.end(await fs.readFile(file));
});

function notifyReload(): void {
	for (const res of clients) res.write('data: reload\n\n');
}

// Watcher rebuilds run in a FRESH SUBPROCESS, for two load-bearing reasons:
// 1. Freshness: this process imported build/*.ts once at startup, so an in-process
//    rebuild would render pages from stale modules; a subprocess re-reads them, so
//    template/page edits apply without restarting the server.
// 2. Responsiveness: the build blocks on synchronous work (gh/git execFileSync)
//    and network fetches; in-process that froze THIS event loop, and the site
//    stopped responding mid-rebuild. In a subprocess the server keeps serving.
function runBuild(): Promise<boolean> {
	return new Promise((resolve) => {
		const child = spawn(
			process.execPath,
			['--import=tsx', path.join(ROOT, 'build/build.ts')],
			{ cwd: ROOT, stdio: 'inherit' },
		);
		child.on('exit', (code) => resolve(code === 0));
		child.on('error', (err) => {
			console.error('build failed to start:', err);
			resolve(false);
		});
	});
}

let building = false;
let queued = false;
async function rebuild(): Promise<void> {
	if (building) {
		queued = true;
		return;
	}
	building = true;
	try {
		if (await runBuild()) {
			notifyReload();
			console.log('rebuilt');
		} else {
			console.error('build failed (see output above)');
		}
	} finally {
		building = false;
		if (queued) {
			queued = false;
			void rebuild();
		}
	}
}

async function main(): Promise<void> {
	await build();
	server.listen(PORT, () => console.log(`dev server: http://localhost:${PORT}/`));

	// Watch the docs too: when LogosLang is checked out next to this repo, editing a
	// doc there live-reloads the site. (Absolute path, since docs live outside ROOT.)
	const docsDir = localDocsDir();
	const watcher = chokidar.watch(
		['content', 'styles', 'client', 'build', 'public', ...(docsDir ? [docsDir] : [])],
		{
			cwd: ROOT,
			ignoreInitial: true,
			// The build itself writes content/roadmap.snapshot.json after a successful
			// roadmap fetch. Watching it would make every rebuild schedule the next one
			// (an endless rebuild loop), and the build that wrote it has already rendered
			// that data, so there is never a reason to rebuild on its change.
			ignored: (p) => path.basename(p) === 'roadmap.snapshot.json',
		},
	);
	let timer: NodeJS.Timeout | null = null;
	watcher.on('all', () => {
		if (timer) clearTimeout(timer);
		timer = setTimeout(() => void rebuild(), 120);
	});
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
