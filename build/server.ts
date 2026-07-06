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
// wrangler/D1. The real data comes from D1 via functions/admin/stats.ts; the response
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
			out.push({ ...base, ts: t + p.dwell * 1000, type: 'event', name: 'dwell', value: null, path: p.path, title: p.title, dur: p.dwell * 1000 });
			t += (p.dwell + 5) * 1000;
		}
	}
	return out;
}

/** Serve the fixture in the same shapes as functions/admin/stats.ts, keyed by ?view / ?session / ?visitor. */
function sampleStats(url: string): unknown {
	const q = new URLSearchParams(url.split('?')[1] ?? '');
	const events = stubEvents(Date.now());

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
		return {
			rows: events
				.slice()
				.sort((a, b) => b.ts - a.ts)
				.slice(0, 200)
				.map((e) => ({ ts: e.ts, visitor: e.visitor, session: e.session, type: e.type, name: e.name, path: e.path, city: e.city, country: e.country, asorg: e.asorg, device: e.device, ref: e.ref })),
		};
	}

	if (view === 'users') {
		const byVisitor = new Map<string, StubEvent[]>();
		for (const e of events) {
			const arr = byVisitor.get(e.visitor) ?? [];
			arr.push(e);
			byVisitor.set(e.visitor, arr);
		}
		const users = [...byVisitor.entries()].map(([visitor, evs]) => {
			const sorted = evs.slice().sort((a, b) => a.ts - b.ts);
			const last = sorted[sorted.length - 1]!;
			return {
				visitor,
				visits: new Set(evs.map((e) => e.session)).size,
				pageviews: evs.filter((e) => e.type === 'pageview').length,
				firstSeen: sorted[0]!.ts,
				lastSeen: last.ts,
				countries: [...new Set(evs.map((e) => e.country))],
				lastCity: last.city,
				lastDevice: last.device,
			};
		});
		users.sort((a, b) => b.lastSeen - a.lastSeen);
		return { users };
	}

	if (view === 'access') {
		const now = Date.now();
		return {
			access: [
				{ ts: now - 3 * 60000, outcome: 'granted', path: '/admin/', ip: '84.209.12.34', country: 'NO', region: 'Trøndelag', city: 'Trondheim', asorg: 'Telenor', device: 'Desktop', browser: 'Firefox', os: 'Linux' },
				{ ts: now - 95 * 60000, outcome: 'denied', path: '/admin/stats', ip: '45.140.17.9', country: 'RU', region: 'Moscow', city: 'Moscow', asorg: 'Chang Way Technologies', device: 'Desktop', browser: 'Other', os: 'Linux' },
				{ ts: now - 240 * 60000, outcome: 'denied', path: '/admin/', ip: '103.21.60.2', country: 'IN', region: 'Karnataka', city: 'Bengaluru', asorg: 'Censys Scanner', device: 'Desktop', browser: 'Other', os: 'Other' },
				{ ts: now - 1500 * 60000, outcome: 'granted', path: '/admin/', ip: '84.209.44.7', country: 'NO', region: 'Oslo', city: 'Oslo', asorg: 'Telenor', device: 'Mobile', browser: 'Chrome', os: 'Android' },
			],
		};
	}

	// map (default): one dot per session, plus range totals.
	const dots = STUB_SESSIONS.map((s) => {
		const evs = events.filter((e) => e.session === s.session);
		return {
			session: s.session, visitor: s.visitor, lat: s.lat, lon: s.lon, city: s.city,
			region: s.region, country: s.country,
			pages: evs.filter((e) => e.type === 'pageview').length,
			start: Math.min(...evs.map((e) => e.ts)),
		};
	});
	return {
		totals: {
			pageviews: events.filter((e) => e.type === 'pageview').length,
			visits: STUB_SESSIONS.length,
			visitors: new Set(STUB_SESSIONS.map((s) => s.visitor)).size,
		},
		dots,
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
	// locally without wrangler/D1 (functions/admin/stats.ts is the real query layer).
	if (url.split('?')[0] === '/admin/stats' && req.method === 'GET') {
		res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
		res.end(JSON.stringify(sampleStats(url)));
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
