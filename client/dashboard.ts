// Analytics dashboard (client bundle for /admin/, loaded only by build/build.ts's
// adminShell). Self-contained: it fetches JSON from /admin/stats (functions/admin/stats.ts)
// and renders three tabs, Map / Log / Users, plus a drill-down panel for one visit or one
// visitor. The route is guarded by Cloudflare Access, so this code assumes an authorized
// caller. Styling reuses the site's theme tokens (styles/theme.css) for light/dark parity.

// ── Response shapes (mirrors functions/admin/stats.ts and the dev stub) ────────
interface Totals {
	pageviews: number;
	visits: number;
	visitors: number;
}
interface Dot {
	session: string;
	visitor: string;
	start: number;
	lat: number;
	lon: number;
	city: string | null;
	region: string | null;
	country: string | null;
	pages: number;
}
interface MapResp {
	totals: Totals;
	dots: Dot[];
	empty?: boolean;
}
interface LogRow {
	ts: number;
	visitor: string;
	session: string;
	type: string;
	name: string | null;
	path: string;
	city: string | null;
	country: string | null;
	device: string | null;
	ref: string | null;
}
interface LogResp {
	rows: LogRow[];
	empty?: boolean;
}
interface UserRow {
	visitor: string;
	visits: number;
	pageviews: number;
	firstSeen: number;
	lastSeen: number;
	countries: string[];
}
interface UsersResp {
	users: UserRow[];
	empty?: boolean;
}
interface AccessRow {
	ts: number;
	outcome: string;
	path: string | null;
	ip: string | null;
	country: string | null;
	region: string | null;
	city: string | null;
	asorg: string | null;
	device: string | null;
	browser: string | null;
	os: string | null;
}
interface AccessResp {
	access: AccessRow[];
	empty?: boolean;
}
interface TimelineEvent {
	ts: number;
	type: string;
	name: string | null;
	value: string | null;
	path: string;
	title: string | null;
	dur: number | null;
	city?: string | null;
	country?: string | null;
	device?: string | null;
}
interface SessionResp {
	session: string;
	visitor: string;
	events: TimelineEvent[];
}
interface VisitorSession {
	session: string;
	start: number;
	end: number;
	city: string | null;
	region: string | null;
	country: string | null;
	device: string | null;
	browser: string | null;
	os: string | null;
	ref: string | null;
	events: TimelineEvent[];
}
interface VisitorResp {
	visitor: string;
	sessions: VisitorSession[];
}

type View = 'map' | 'log' | 'users' | 'access';

// ── Small helpers ──────────────────────────────────────────────────────────────
const ESC: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' };
function esc(s: unknown): string {
	return String(s ?? '').replace(/[&<>"]/g, (c) => ESC[c] ?? c);
}
function fmtTime(ts: number): string {
	return new Date(ts).toLocaleString(undefined, {
		month: 'short',
		day: 'numeric',
		hour: '2-digit',
		minute: '2-digit',
	});
}
function fmtDur(ms: number | null): string {
	if (!ms || ms < 1000) return '<1s';
	const s = Math.round(ms / 1000);
	if (s < 60) return `${s}s`;
	const m = Math.floor(s / 60);
	const rem = s % 60;
	return rem ? `${m}m ${rem}s` : `${m}m`;
}
function shortId(id: string): string {
	return id.length > 8 ? id.slice(0, 8) : id;
}
function place(city: string | null, country: string | null): string {
	const parts = [city, country].filter((x): x is string => !!x);
	return parts.length ? parts.join(', ') : 'Unknown';
}
function num(n: number): string {
	return Number(n || 0).toLocaleString();
}

const app = document.getElementById('admin-app') as HTMLElement | null;
const worldUrl = app?.dataset.world || '/admin/world.geo.json';

const state: { view: View; rangeMs: number } = { view: 'map', rangeMs: 7 * 86400000 };
const RANGES: { label: string; ms: number }[] = [
	{ label: '24h', ms: 86400000 },
	{ label: '7d', ms: 7 * 86400000 },
	{ label: '30d', ms: 30 * 86400000 },
];
const TABS: { key: View; label: string }[] = [
	{ key: 'map', label: 'Map' },
	{ key: 'log', label: 'Log' },
	{ key: 'users', label: 'Users' },
	{ key: 'access', label: 'Access' },
];

function currentRange(): { from: number; to: number } {
	const to = Date.now();
	return { from: to - state.rangeMs, to };
}

async function fetchStats<T>(params: Record<string, string | number>): Promise<T> {
	const u = new URL('/admin/stats', location.origin);
	const { from, to } = currentRange();
	u.searchParams.set('from', String(from));
	u.searchParams.set('to', String(to));
	for (const [k, v] of Object.entries(params)) u.searchParams.set(k, String(v));
	const r = await fetch(u.toString(), { credentials: 'include' });
	if (!r.ok) throw new Error(`stats ${r.status}`);
	return (await r.json()) as T;
}

// ── Styles (injected; uses theme tokens so it tracks light/dark) ───────────────
function injectStyles(): void {
	const css = `
	body.admin { margin: 0; background: var(--bg); color: var(--text); font-family: var(--sans); }
	#admin-app { max-width: 1100px; margin: 0 auto; padding: 1.5rem 1.25rem 4rem; }
	.adm-top { display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap; margin-bottom: 1.25rem; }
	.adm-title { font-family: var(--serif); font-size: 1.35rem; color: var(--heading); font-weight: 600; }
	.adm-spacer { flex: 1 1 auto; }
	.adm-range, .adm-tabs { display: inline-flex; gap: 0.25rem; background: var(--surface); border: 1px solid var(--hairline); border-radius: 999px; padding: 0.2rem; }
	.adm-chip { border: 0; background: transparent; color: var(--muted); font: inherit; font-size: 0.85rem; padding: 0.3rem 0.8rem; border-radius: 999px; cursor: pointer; }
	.adm-chip:hover { color: var(--text); }
	.adm-chip.is-active { background: var(--accent); color: #fff; }
	.adm-tiles { display: flex; gap: 0.75rem; flex-wrap: wrap; margin-bottom: 1rem; }
	.adm-tile { flex: 1 1 8rem; background: var(--surface); border: 1px solid var(--hairline); border-radius: 0.8rem; padding: 0.9rem 1rem; }
	.adm-tile b { display: block; font-size: 1.6rem; color: var(--heading); font-weight: 600; line-height: 1.1; }
	.adm-tile span { font-size: 0.8rem; color: var(--muted); }
	.adm-mapwrap { background: var(--surface); border: 1px solid var(--hairline); border-radius: 0.8rem; padding: 0.5rem; overflow: hidden; }
	.adm-map { display: block; width: 100%; cursor: crosshair; }
	.adm-hint { margin-top: 0.6rem; font-size: 0.8rem; color: var(--muted); }
	.adm-tablewrap { overflow-x: auto; border: 1px solid var(--hairline); border-radius: 0.8rem; }
	table.adm-table { border-collapse: collapse; width: 100%; font-size: 0.85rem; }
	.adm-table th { text-align: left; color: var(--muted); font-weight: 500; padding: 0.6rem 0.8rem; border-bottom: 1px solid var(--hairline); white-space: nowrap; }
	.adm-table td { padding: 0.55rem 0.8rem; border-bottom: 1px solid var(--hairline); white-space: nowrap; }
	.adm-table tr:last-child td { border-bottom: 0; }
	.adm-table tbody tr { cursor: pointer; }
	.adm-table tbody tr:hover { background: var(--surface); }
	.adm-path { font-family: var(--mono); font-size: 0.82em; }
	.adm-dim { color: var(--muted); }
	.adm-idbtn { border: 0; background: transparent; color: var(--accent); font: inherit; font-family: var(--mono); font-size: 0.82em; cursor: pointer; padding: 0; }
	.adm-tag { display: inline-block; font-size: 0.72rem; color: var(--muted); border: 1px solid var(--hairline); border-radius: 999px; padding: 0.05rem 0.5rem; }
	.adm-empty, .adm-loading { padding: 2.5rem 1rem; text-align: center; color: var(--muted); }
	.adm-panel { position: fixed; top: 0; right: 0; height: 100%; width: min(440px, 100%); background: var(--bg); border-left: 1px solid var(--hairline); box-shadow: -12px 0 40px rgba(0,0,0,0.14); padding: 1.25rem; overflow-y: auto; z-index: 20; }
	.adm-panel[hidden] { display: none; }
	.adm-panel__head { display: flex; align-items: baseline; gap: 0.6rem; margin-bottom: 1rem; }
	.adm-panel__title { font-family: var(--serif); font-size: 1.1rem; color: var(--heading); font-weight: 600; }
	.adm-panel__close { margin-left: auto; border: 0; background: transparent; color: var(--muted); font-size: 1.4rem; line-height: 1; cursor: pointer; }
	.adm-meta { font-size: 0.8rem; color: var(--muted); margin: 0.15rem 0 0.9rem; }
	.adm-sess { border: 1px solid var(--hairline); border-radius: 0.7rem; padding: 0.75rem 0.85rem; margin-bottom: 0.85rem; }
	.adm-sess__head { font-size: 0.82rem; color: var(--muted); margin-bottom: 0.5rem; }
	.adm-tl { list-style: none; margin: 0; padding: 0; }
	.adm-tl li { position: relative; padding: 0.3rem 0 0.3rem 1rem; font-size: 0.85rem; border-left: 2px solid var(--hairline); }
	.adm-tl li::before { content: ""; position: absolute; left: -5px; top: 0.6rem; width: 8px; height: 8px; border-radius: 50%; background: var(--accent); }
	.adm-tl time { display: block; font-size: 0.72rem; color: var(--muted); }
	.adm-tag--ok { color: var(--ok-text, #2b6b34); border-color: var(--ok-text, #2b6b34); }
	.adm-tag--bad { color: var(--line-exec, #c0392b); border-color: var(--line-exec, #c0392b); }
	tr.is-denied td { background: rgba(192, 57, 43, 0.07); }
	`;
	const el = document.createElement('style');
	el.textContent = css;
	document.head.appendChild(el);
}

// ── World map (self-contained canvas, equirectangular) ─────────────────────────
let world: [number, number][][] | null = null;
let mapDots: Dot[] = [];
let dotScreen: { x: number; y: number; d: Dot }[] = [];
let mapResizeObs: ResizeObserver | null = null;

async function ensureWorld(): Promise<void> {
	if (world) return;
	try {
		const r = await fetch(worldUrl);
		const data = (await r.json()) as { polygons: [number, number][][] };
		world = Array.isArray(data.polygons) ? data.polygons : [];
	} catch {
		world = [];
	}
}

function drawMap(canvas: HTMLCanvasElement): void {
	const ctx = canvas.getContext('2d');
	if (!ctx) return;
	const rect = canvas.getBoundingClientRect();
	const dpr = window.devicePixelRatio || 1;
	const W = Math.max(320, Math.floor(rect.width));
	const H = Math.floor(W / 2);
	canvas.width = W * dpr;
	canvas.height = H * dpr;
	canvas.style.height = `${H}px`;
	ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
	ctx.clearRect(0, 0, W, H);

	const cs = getComputedStyle(document.body);
	const tok = (name: string, fallback: string): string => cs.getPropertyValue(name).trim() || fallback;
	const land = tok('--hairline', '#e7e1d6');
	const border = tok('--muted', '#6f6a60');
	const accent = tok('--accent', '#4f46e5');
	const bg = tok('--bg', '#ffffff');

	const px = (lon: number): number => ((lon + 180) / 360) * W;
	const py = (lat: number): number => ((90 - lat) / 180) * H;

	if (world && world.length) {
		ctx.beginPath();
		for (const ring of world) {
			const first = ring[0];
			if (!first) continue;
			ctx.moveTo(px(first[0]), py(first[1]));
			for (let i = 1; i < ring.length; i++) {
				const p = ring[i];
				if (p) ctx.lineTo(px(p[0]), py(p[1]));
			}
			ctx.closePath();
		}
		ctx.fillStyle = land;
		ctx.globalAlpha = 0.5;
		ctx.fill('evenodd');
		ctx.globalAlpha = 0.5;
		ctx.lineWidth = 0.5;
		ctx.strokeStyle = border;
		ctx.stroke();
		ctx.globalAlpha = 1;
	}

	dotScreen = [];
	for (const d of mapDots) {
		if (typeof d.lat !== 'number' || typeof d.lon !== 'number') continue;
		dotScreen.push({ x: px(d.lon), y: py(d.lat), d });
	}
	ctx.globalAlpha = 0.18;
	ctx.fillStyle = accent;
	for (const s of dotScreen) {
		ctx.beginPath();
		ctx.arc(s.x, s.y, 6, 0, Math.PI * 2);
		ctx.fill();
	}
	ctx.globalAlpha = 1;
	for (const s of dotScreen) {
		ctx.beginPath();
		ctx.arc(s.x, s.y, 3.2, 0, Math.PI * 2);
		ctx.fillStyle = accent;
		ctx.fill();
		ctx.lineWidth = 1;
		ctx.strokeStyle = bg;
		ctx.stroke();
	}
}

function hitDot(canvas: HTMLCanvasElement, ev: MouseEvent): Dot | null {
	const rect = canvas.getBoundingClientRect();
	const x = ev.clientX - rect.left;
	const y = ev.clientY - rect.top;
	let best: Dot | null = null;
	let bestDist = 12 * 12;
	for (const s of dotScreen) {
		const dx = s.x - x;
		const dy = s.y - y;
		const dist = dx * dx + dy * dy;
		if (dist < bestDist) {
			bestDist = dist;
			best = s.d;
		}
	}
	return best;
}

// ── Views ──────────────────────────────────────────────────────────────────────
function tile(label: string, value: number): string {
	return `<div class="adm-tile"><b>${num(value)}</b><span>${esc(label)}</span></div>`;
}
function emptyMsg(): string {
	return `<div class="adm-empty">No analytics yet. Once the site is deployed with the D1 database bound as <code>DB</code>, visits will show up here.</div>`;
}

async function renderMap(view: HTMLElement): Promise<void> {
	const data = await fetchStats<MapResp>({ view: 'map' });
	if (data.empty) {
		view.innerHTML = emptyMsg();
		return;
	}
	const t = data.totals ?? { pageviews: 0, visits: 0, visitors: 0 };
	view.innerHTML = `
		<div class="adm-tiles">${tile('Pageviews', t.pageviews)}${tile('Visits', t.visits)}${tile('Visitors', t.visitors)}</div>
		<div class="adm-mapwrap"><canvas class="adm-map" id="adm-canvas"></canvas></div>
		<p class="adm-hint">${num(data.dots.length)} located visit(s) in range. Click a dot to open the visit.</p>`;
	mapDots = data.dots;
	await ensureWorld();
	const canvas = document.getElementById('adm-canvas') as HTMLCanvasElement | null;
	if (!canvas) return;
	const redraw = (): void => drawMap(canvas);
	redraw();
	if (mapResizeObs) mapResizeObs.disconnect();
	mapResizeObs = new ResizeObserver(() => redraw());
	if (canvas.parentElement) mapResizeObs.observe(canvas.parentElement);
	canvas.addEventListener('click', (e) => {
		const d = hitDot(canvas, e);
		if (d) void openSession(d.session);
	});
}

async function renderLog(view: HTMLElement): Promise<void> {
	const data = await fetchStats<LogResp>({ view: 'log', limit: 200 });
	if (data.empty) {
		view.innerHTML = emptyMsg();
		return;
	}
	if (!data.rows.length) {
		view.innerHTML = `<div class="adm-empty">No activity in this range.</div>`;
		return;
	}
	const rows = data.rows
		.map((r) => {
			const what = r.type === 'pageview' ? 'view' : esc(r.name ?? 'event');
			return `<tr data-session="${esc(r.session)}">
				<td>${esc(fmtTime(r.ts))}</td>
				<td><button class="adm-idbtn" data-visitor="${esc(r.visitor)}">${esc(shortId(r.visitor))}</button></td>
				<td><span class="adm-path">${esc(r.path)}</span></td>
				<td><span class="adm-tag">${what}</span></td>
				<td>${esc(place(r.city, r.country))}</td>
				<td>${esc(r.device ?? '')}</td>
				<td class="adm-dim">${esc(r.ref ?? 'direct')}</td>
			</tr>`;
		})
		.join('');
	view.innerHTML = `<div class="adm-tablewrap"><table class="adm-table">
		<thead><tr><th>Time</th><th>Visitor</th><th>Page</th><th>Event</th><th>Location</th><th>Device</th><th>Referrer</th></tr></thead>
		<tbody>${rows}</tbody></table></div>`;
	const tbody = view.querySelector('tbody');
	tbody?.addEventListener('click', (e) => {
		const target = e.target as HTMLElement;
		const vbtn = target.closest<HTMLElement>('.adm-idbtn');
		if (vbtn && vbtn.dataset.visitor) {
			void openVisitor(vbtn.dataset.visitor);
			return;
		}
		const tr = target.closest<HTMLElement>('tr[data-session]');
		if (tr && tr.dataset.session) void openSession(tr.dataset.session);
	});
}

async function renderUsers(view: HTMLElement): Promise<void> {
	const data = await fetchStats<UsersResp>({ view: 'users', limit: 200 });
	if (data.empty) {
		view.innerHTML = emptyMsg();
		return;
	}
	if (!data.users.length) {
		view.innerHTML = `<div class="adm-empty">No visitors in this range.</div>`;
		return;
	}
	const rows = data.users
		.map(
			(u) => `<tr data-visitor="${esc(u.visitor)}">
			<td><span class="adm-path">${esc(shortId(u.visitor))}</span></td>
			<td>${num(u.visits)}</td>
			<td>${num(u.pageviews)}</td>
			<td>${esc(u.countries.join(', ') || 'Unknown')}</td>
			<td>${esc(fmtTime(u.firstSeen))}</td>
			<td>${esc(fmtTime(u.lastSeen))}</td>
		</tr>`,
		)
		.join('');
	view.innerHTML = `<div class="adm-tablewrap"><table class="adm-table">
		<thead><tr><th>Visitor</th><th>Visits</th><th>Pageviews</th><th>Countries</th><th>First seen</th><th>Last seen</th></tr></thead>
		<tbody>${rows}</tbody></table></div>`;
	const tbody = view.querySelector('tbody');
	tbody?.addEventListener('click', (e) => {
		const tr = (e.target as HTMLElement).closest<HTMLElement>('tr[data-visitor]');
		if (tr && tr.dataset.visitor) void openVisitor(tr.dataset.visitor);
	});
}

async function renderAccess(view: HTMLElement): Promise<void> {
	const data = await fetchStats<AccessResp>({ view: 'access', limit: 200 });
	if (data.empty) {
		view.innerHTML = emptyMsg();
		return;
	}
	if (!data.access.length) {
		view.innerHTML = `<div class="adm-empty">No dashboard access recorded in this range.</div>`;
		return;
	}
	const rows = data.access
		.map((r) => {
			const denied = r.outcome === 'denied';
			const dev = [r.device, r.browser, r.os].filter((x): x is string => !!x).join(' / ');
			return `<tr class="${denied ? 'is-denied' : ''}">
				<td>${esc(fmtTime(r.ts))}</td>
				<td><span class="adm-tag ${denied ? 'adm-tag--bad' : 'adm-tag--ok'}">${esc(r.outcome)}</span></td>
				<td><span class="adm-path">${esc(r.ip ?? '')}</span></td>
				<td>${esc(place(r.city, r.country))}</td>
				<td class="adm-dim">${esc(r.asorg ?? '')}</td>
				<td>${esc(dev)}</td>
				<td class="adm-dim"><span class="adm-path">${esc(r.path ?? '')}</span></td>
			</tr>`;
		})
		.join('');
	view.innerHTML = `<p class="adm-hint">Every successful sign-in to this dashboard and every wrong-password attempt on <code>/admin/</code>. Requests with no password are not logged.</p>
		<div class="adm-tablewrap"><table class="adm-table">
		<thead><tr><th>Time</th><th>Outcome</th><th>IP</th><th>Location</th><th>Network</th><th>Device</th><th>Path</th></tr></thead>
		<tbody>${rows}</tbody></table></div>`;
}

// ── Drill-down panel ─────────────────────────────────────────────────────────
function labelFor(ev: TimelineEvent): string {
	if (ev.type === 'pageview') {
		const t = ev.title ? ` <span class="adm-dim">${esc(ev.title)}</span>` : '';
		return `Viewed <span class="adm-path">${esc(ev.path)}</span>${t}`;
	}
	switch (ev.name) {
		case 'dwell':
			return `Spent ${esc(fmtDur(ev.dur))} on <span class="adm-path">${esc(ev.path)}</span>`;
		case 'scroll':
			return `Scrolled ${esc(ev.value)}% of <span class="adm-path">${esc(ev.path)}</span>`;
		case 'download':
			return `Downloaded <b>${esc(ev.value)}</b>`;
		case 'outbound':
			return `Left to <b>${esc(ev.value)}</b>`;
		case 'version':
			return `Selected version <b>${esc(ev.value)}</b>`;
		case 'notify':
			return `Submitted the notify form`;
		case 'playground':
			return `Ran the playground`;
		default:
			return esc(ev.name ?? 'event');
	}
}
function timeline(events: TimelineEvent[]): string {
	return `<ul class="adm-tl">${events
		.map((ev) => `<li><time>${esc(fmtTime(ev.ts))}</time>${labelFor(ev)}</li>`)
		.join('')}</ul>`;
}

function panel(): HTMLElement {
	let p = document.getElementById('adm-panel');
	if (!p) {
		p = document.createElement('aside');
		p.id = 'adm-panel';
		p.className = 'adm-panel';
		p.hidden = true;
		document.body.appendChild(p);
	}
	return p;
}
function closePanel(): void {
	panel().hidden = true;
}
function openPanel(title: string, meta: string, inner: string): void {
	const p = panel();
	p.innerHTML = `<div class="adm-panel__head"><div><div class="adm-panel__title">${esc(title)}</div><div class="adm-meta">${meta}</div></div><button class="adm-panel__close" aria-label="Close">&times;</button></div>${inner}`;
	p.hidden = false;
	p.querySelector('.adm-panel__close')?.addEventListener('click', closePanel);
	p.querySelectorAll<HTMLElement>('.adm-idbtn[data-visitor]').forEach((b) =>
		b.addEventListener('click', () => {
			if (b.dataset.visitor) void openVisitor(b.dataset.visitor);
		}),
	);
}

async function openSession(sid: string): Promise<void> {
	openPanel('Visit', 'Loading…', '');
	try {
		const data = await fetchStats<SessionResp>({ session: sid });
		const first = data.events[0];
		const meta = `Session <span class="adm-path">${esc(shortId(sid))}</span> &middot; visitor <button class="adm-idbtn" data-visitor="${esc(data.visitor)}">${esc(shortId(data.visitor))}</button>${first ? ` &middot; ${esc(place(first.city ?? null, first.country ?? null))}` : ''}`;
		openPanel('Visit', meta, timeline(data.events));
	} catch (e) {
		openPanel('Visit', esc((e as Error).message), '');
	}
}

async function openVisitor(vid: string): Promise<void> {
	openPanel('Visitor', 'Loading…', '');
	try {
		const data = await fetchStats<VisitorResp>({ visitor: vid });
		const meta = `${data.sessions.length} visit(s) &middot; id <span class="adm-path">${esc(shortId(vid))}</span>`;
		const body = data.sessions.length
			? data.sessions
					.map((s) => {
						const head = `${esc(fmtTime(s.start))} &middot; ${esc(place(s.city, s.country))} &middot; ${esc(s.device ?? '')} ${esc(s.browser ?? '')} &middot; ${esc(s.ref ?? 'direct')}`;
						return `<div class="adm-sess"><div class="adm-sess__head">${head}</div>${timeline(s.events)}</div>`;
					})
					.join('')
			: `<p class="adm-meta">No recorded events.</p>`;
		openPanel('Visitor', meta, body);
	} catch (e) {
		openPanel('Visitor', esc((e as Error).message), '');
	}
}

// ── Shell + wiring ─────────────────────────────────────────────────────────────
function chip(active: boolean, label: string, data: string): string {
	return `<button class="adm-chip${active ? ' is-active' : ''}" ${data}>${esc(label)}</button>`;
}

function renderChrome(): void {
	const range = document.getElementById('adm-range');
	const tabs = document.getElementById('adm-tabs');
	if (range) {
		range.innerHTML = RANGES.map((r) => chip(state.rangeMs === r.ms, r.label, `data-ms="${r.ms}"`)).join('');
	}
	if (tabs) {
		tabs.innerHTML = TABS.map((t) => chip(state.view === t.key, t.label, `data-view="${t.key}"`)).join('');
	}
}

async function render(): Promise<void> {
	renderChrome();
	const view = document.getElementById('adm-view');
	if (!view) return;
	view.innerHTML = `<div class="adm-loading">Loading…</div>`;
	try {
		if (state.view === 'map') await renderMap(view);
		else if (state.view === 'log') await renderLog(view);
		else if (state.view === 'users') await renderUsers(view);
		else await renderAccess(view);
	} catch (e) {
		view.innerHTML = `<div class="adm-empty">Could not load analytics: ${esc((e as Error).message)}.</div>`;
	}
}

function init(): void {
	if (!app) return;
	injectStyles();
	app.innerHTML = `
		<div class="adm-top">
			<div class="adm-title">Λόγος &middot; Analytics</div>
			<div class="adm-spacer"></div>
			<div class="adm-range" id="adm-range"></div>
			<div class="adm-tabs" id="adm-tabs"></div>
		</div>
		<div id="adm-view" class="adm-view"></div>`;

	document.getElementById('adm-range')?.addEventListener('click', (e) => {
		const b = (e.target as HTMLElement).closest<HTMLElement>('[data-ms]');
		if (!b) return;
		state.rangeMs = Number(b.dataset.ms);
		void render();
	});
	document.getElementById('adm-tabs')?.addEventListener('click', (e) => {
		const b = (e.target as HTMLElement).closest<HTMLElement>('[data-view]');
		if (!b || !b.dataset.view) return;
		state.view = b.dataset.view as View;
		void render();
	});
	document.addEventListener('keydown', (e) => {
		if (e.key === 'Escape') closePanel();
	});

	void render();
}

init();
