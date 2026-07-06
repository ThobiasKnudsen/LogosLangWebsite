// Analytics dashboard (client bundle for /admin/, loaded only by build/build.ts's
// adminShell). Self-contained: it fetches JSON from /admin/stats (functions/admin/stats.ts)
// and renders three tabs, Map / Log / Users, plus a drill-down panel for one visit or one
// visitor. The route is guarded by HTTP Basic Auth (functions/admin/_middleware.ts), so
// this code assumes an authorized caller. Styling reuses the site's theme tokens
// (styles/theme.css) for light/dark parity.

// ── Response shapes (mirrors functions/admin/stats.ts and the dev stub) ────────
interface Totals {
	pageviews: number;
	visits: number;
	visitors: number;
	botHits?: number;
}
// One aggregated location for bot traffic (server-side `requests`, grouped by lat/lon).
interface BotDot {
	lat: number;
	lon: number;
	city: string | null;
	region: string | null;
	country: string | null;
	asorg: string | null;
	bot_name: string | null;
	hits: number;
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
	botDots?: BotDot[];
	empty?: boolean;
}
// A Log row is either a human event (from `events`) or a bot request (from `requests`),
// discriminated by `kind`. Human-only fields are optional so both shapes share one type.
interface LogRow {
	kind?: 'human' | 'bot';
	ts: number;
	visitor?: string | null;
	session?: string | null;
	type?: string | null;
	name?: string | null;
	path: string;
	city: string | null;
	country: string | null;
	asorg: string | null;
	device: string | null;
	ref: string | null;
	bot_name?: string | null;
	status?: number | null;
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
interface Subscriber {
	email: string;
	subscribedAt: string | null;
	source: string | null;
}
interface SubscribersResp {
	configured: boolean;
	count?: number;
	subscribers: Subscriber[];
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

type View = 'map' | 'log' | 'users' | 'access' | 'subscribers';

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

const DAY = 86_400_000;
// Global filter shared by every view: an explicit [from, to] window (ms since epoch) plus
// which audiences to include. Humans come from the `events` JS beacon, bots from
// server-side `requests`; toggling either hides that source everywhere it appears.
const state: {
	view: View;
	from: number;
	to: number;
	humans: boolean;
	bots: boolean;
	preset: string | null;
} = {
	view: 'map',
	from: Date.now() - 7 * DAY,
	to: Date.now(),
	humans: true,
	bots: true,
	preset: '7',
};
// Quick presets set the window relative to "now" at click time; `all` uses a wide floor.
const PRESETS: { key: string; label: string; ms: number }[] = [
	{ key: '1', label: '24h', ms: DAY },
	{ key: '7', label: '7d', ms: 7 * DAY },
	{ key: '30', label: '30d', ms: 30 * DAY },
	{ key: 'all', label: 'All', ms: 3650 * DAY },
];
const TABS: { key: View; label: string }[] = [
	{ key: 'map', label: 'Map' },
	{ key: 'log', label: 'Log' },
	{ key: 'users', label: 'Users' },
	{ key: 'access', label: 'Access' },
	{ key: 'subscribers', label: 'Subscribers' },
];

async function fetchStats<T>(params: Record<string, string | number>): Promise<T> {
	const u = new URL('/admin/stats', location.origin);
	u.searchParams.set('from', String(Math.round(state.from)));
	u.searchParams.set('to', String(Math.round(state.to)));
	u.searchParams.set('humans', state.humans ? '1' : '0');
	u.searchParams.set('bots', state.bots ? '1' : '0');
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
	.adm-mapwrap { position: relative; background: var(--surface); border: 1px solid var(--hairline); border-radius: 0.8rem; padding: 0.5rem; overflow: hidden; }
	.adm-map { display: block; width: 100%; cursor: grab; touch-action: none; }
	.adm-map:active { cursor: grabbing; }
	.adm-zoom { position: absolute; top: 0.8rem; right: 0.8rem; display: flex; flex-direction: column; gap: 0.25rem; }
	.adm-zoom button { width: 1.9rem; height: 1.9rem; border: 1px solid var(--hairline); background: var(--bg); color: var(--text); border-radius: 0.4rem; font-size: 1rem; line-height: 1; cursor: pointer; display: flex; align-items: center; justify-content: center; }
	.adm-zoom button:hover { border-color: var(--accent); color: var(--accent); }
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
	.adm-subs-actions { display: flex; align-items: center; gap: 0.6rem; margin-bottom: 0.9rem; flex-wrap: wrap; }
	.adm-subcount { font-size: 0.85rem; color: var(--muted); margin-right: auto; }
	.adm-subs-actions button { border: 1px solid var(--hairline); background: var(--surface); }
	.adm-subs-actions button.is-active { background: var(--accent); color: #fff; border-color: var(--accent); }
	.adm-filter { position: relative; display: inline-flex; align-items: center; gap: 0.5rem; }
	.adm-summary { font-size: 0.8rem; color: var(--muted); white-space: nowrap; }
	.adm-filter-panel { position: absolute; top: calc(100% + 0.4rem); left: 0; z-index: 30; width: min(24rem, 92vw); background: var(--bg); border: 1px solid var(--hairline); border-radius: 0.7rem; box-shadow: 0 12px 34px rgba(0,0,0,0.16); padding: 0.85rem; display: flex; flex-direction: column; gap: 0.7rem; }
	.adm-filter-panel[hidden] { display: none; }
	.adm-fp-row { display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; }
	.adm-fp-label { font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.04em; color: var(--muted); width: 3.2rem; }
	.adm-presets { display: inline-flex; gap: 0.25rem; }
	.adm-fp-field { display: flex; flex-direction: column; gap: 0.2rem; font-size: 0.72rem; color: var(--muted); flex: 1 1 9rem; }
	.adm-fp-field input { font: inherit; font-size: 0.82rem; color: var(--text); background: var(--surface); border: 1px solid var(--hairline); border-radius: 0.4rem; padding: 0.3rem 0.4rem; }
	.adm-switch { display: inline-flex; align-items: center; gap: 0.3rem; font-size: 0.85rem; color: var(--text); cursor: pointer; }
	.adm-switch input { accent-color: var(--accent); }
	.adm-legend { display: flex; gap: 1rem; margin-top: 0.5rem; }
	.adm-leg { display: inline-flex; align-items: center; gap: 0.35rem; font-size: 0.78rem; color: var(--muted); }
	.adm-leg__dot { width: 10px; height: 10px; border-radius: 50%; display: inline-block; }
	.adm-leg__dot--human { background: var(--accent); }
	.adm-leg__dot--bot { background: #c85c39; }
	.adm-tag--bot { color: #c85c39; border-color: #c85c39; }
	.adm-row--bot { cursor: default; }
	.adm-row--bot td { background: rgba(200, 92, 57, 0.06); }
	`;
	const el = document.createElement('style');
	el.textContent = css;
	document.head.appendChild(el);
}

// ── World map (self-contained canvas, equirectangular) ─────────────────────────
let world: [number, number][][] | null = null;
let mapDots: Dot[] = [];
let mapBotDots: BotDot[] = [];
let dotScreen: { x: number; y: number; d: Dot }[] = [];
let mapResizeObs: ResizeObserver | null = null;
const mapView = { zoom: 1, tx: 0, ty: 0 };
const BOT_COLOR = '#c85c39'; // terracotta, distinct from the indigo accent used for humans

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

	// Clamp the pan/zoom to the current canvas size (zoom 1 = the whole world, fit to width).
	mapView.zoom = Math.min(40, Math.max(1, mapView.zoom));
	mapView.tx = Math.min(0, Math.max(W * (1 - mapView.zoom), mapView.tx));
	mapView.ty = Math.min(0, Math.max(H * (1 - mapView.zoom), mapView.ty));
	const { zoom, tx, ty } = mapView;

	const cs = getComputedStyle(document.body);
	const tok = (name: string, fallback: string): string => cs.getPropertyValue(name).trim() || fallback;
	const land = tok('--hairline', '#e7e1d6');
	const border = tok('--muted', '#6f6a60');
	const accent = tok('--accent', '#4f46e5');
	const bg = tok('--bg', '#ffffff');

	// Equirectangular world -> screen, with pan/zoom folded into the coordinates by hand so
	// dot sizes and line widths stay constant instead of scaling with the zoom.
	const px = (lon: number): number => ((lon + 180) / 360) * W * zoom + tx;
	const py = (lat: number): number => ((90 - lat) / 180) * H * zoom + ty;

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

	// Bot traffic: terracotta dots drawn under the human layer, not interactive (there is
	// no per-visitor session to open). Radius grows with hit count so hotspots read.
	ctx.fillStyle = BOT_COLOR;
	for (const b of mapBotDots) {
		if (typeof b.lat !== 'number' || typeof b.lon !== 'number') continue;
		const bx = px(b.lon);
		const by = py(b.lat);
		const r = Math.min(9, 3 + Math.log2(1 + (b.hits || 1)));
		ctx.globalAlpha = 0.16;
		ctx.beginPath();
		ctx.arc(bx, by, r + 3, 0, Math.PI * 2);
		ctx.fill();
		ctx.globalAlpha = 0.9;
		ctx.beginPath();
		ctx.arc(bx, by, r, 0, Math.PI * 2);
		ctx.fill();
	}
	ctx.globalAlpha = 1;

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
	const humanDots = data.dots ?? [];
	const botDots = data.botDots ?? [];
	const humanTiles = state.humans
		? `${tile('Pageviews', t.pageviews)}${tile('Visits', t.visits)}${tile('Visitors', t.visitors)}`
		: '';
	const botTile = state.bots ? tile('Bot hits', t.botHits ?? 0) : '';
	const legend = `<div class="adm-legend">${
		state.humans ? `<span class="adm-leg"><i class="adm-leg__dot adm-leg__dot--human"></i>Humans</span>` : ''
	}${state.bots ? `<span class="adm-leg"><i class="adm-leg__dot adm-leg__dot--bot"></i>Bots</span>` : ''}</div>`;
	view.innerHTML = `
		<div class="adm-tiles">${humanTiles}${botTile}</div>
		<div class="adm-mapwrap">
			<canvas class="adm-map" id="adm-canvas"></canvas>
			<div class="adm-zoom">
				<button type="button" data-z="in" aria-label="Zoom in">+</button>
				<button type="button" data-z="out" aria-label="Zoom out">&minus;</button>
				<button type="button" data-z="reset" aria-label="Reset view">&#8634;</button>
			</div>
		</div>
		${legend}
		<p class="adm-hint">${num(humanDots.length)} human &middot; ${num(botDots.length)} bot location(s) in range. Scroll or use the buttons to zoom, drag to pan, click a human dot to open the visit.</p>`;
	mapDots = humanDots;
	mapBotDots = botDots;
	mapView.zoom = 1;
	mapView.tx = 0;
	mapView.ty = 0;
	await ensureWorld();
	const canvas = document.getElementById('adm-canvas') as HTMLCanvasElement | null;
	if (!canvas) return;
	const redraw = (): void => drawMap(canvas);
	redraw();
	if (mapResizeObs) mapResizeObs.disconnect();
	mapResizeObs = new ResizeObserver(() => redraw());
	if (canvas.parentElement) mapResizeObs.observe(canvas.parentElement);

	// Zoom toward a canvas point, keeping that point fixed under the cursor.
	const zoomAt = (cx: number, cy: number, factor: number): void => {
		const next = Math.min(40, Math.max(1, mapView.zoom * factor));
		mapView.tx = cx - ((cx - mapView.tx) / mapView.zoom) * next;
		mapView.ty = cy - ((cy - mapView.ty) / mapView.zoom) * next;
		mapView.zoom = next;
		redraw();
	};

	canvas.addEventListener(
		'wheel',
		(e) => {
			e.preventDefault();
			const rect = canvas.getBoundingClientRect();
			zoomAt(e.clientX - rect.left, e.clientY - rect.top, e.deltaY < 0 ? 1.2 : 1 / 1.2);
		},
		{ passive: false },
	);

	// Drag to pan; a press that barely moves is treated as a click on a dot.
	let down: { x: number; y: number; tx: number; ty: number } | null = null;
	let moved = false;
	canvas.addEventListener('pointerdown', (e) => {
		down = { x: e.clientX, y: e.clientY, tx: mapView.tx, ty: mapView.ty };
		moved = false;
		canvas.setPointerCapture(e.pointerId);
	});
	canvas.addEventListener('pointermove', (e) => {
		if (!down) return;
		const dx = e.clientX - down.x;
		const dy = e.clientY - down.y;
		if (Math.abs(dx) + Math.abs(dy) > 4) moved = true;
		mapView.tx = down.tx + dx;
		mapView.ty = down.ty + dy;
		redraw();
	});
	canvas.addEventListener('pointerup', (e) => {
		if (down && !moved) {
			const d = hitDot(canvas, e);
			if (d) void openSession(d.session);
		}
		down = null;
	});
	canvas.addEventListener('pointercancel', () => {
		down = null;
	});

	view.querySelector('.adm-zoom')?.addEventListener('click', (e) => {
		const b = (e.target as HTMLElement).closest<HTMLElement>('[data-z]');
		if (!b) return;
		const cx = canvas.clientWidth / 2;
		const cy = canvas.clientHeight / 2;
		if (b.dataset.z === 'in') zoomAt(cx, cy, 1.5);
		else if (b.dataset.z === 'out') zoomAt(cx, cy, 1 / 1.5);
		else {
			mapView.zoom = 1;
			mapView.tx = 0;
			mapView.ty = 0;
			redraw();
		}
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
			if (r.kind === 'bot') {
				const status = r.status ? ` ${r.status}` : '';
				return `<tr class="adm-row--bot">
					<td>${esc(fmtTime(r.ts))}</td>
					<td><span class="adm-tag adm-tag--bot">${esc(r.bot_name ?? 'bot')}</span></td>
					<td><span class="adm-path">${esc(r.path)}</span></td>
					<td><span class="adm-tag">bot${esc(status)}</span></td>
					<td>${esc(place(r.city, r.country))}</td>
					<td class="adm-dim">${esc(r.asorg ?? '')}</td>
					<td>${esc(r.device ?? '')}</td>
					<td class="adm-dim">${esc(r.ref ?? 'direct')}</td>
				</tr>`;
			}
			const what = r.type === 'pageview' ? 'view' : esc(r.name ?? 'event');
			return `<tr data-session="${esc(r.session ?? '')}">
				<td>${esc(fmtTime(r.ts))}</td>
				<td><button class="adm-idbtn" data-visitor="${esc(r.visitor ?? '')}">${esc(shortId(r.visitor ?? ''))}</button></td>
				<td><span class="adm-path">${esc(r.path)}</span></td>
				<td><span class="adm-tag">${what}</span></td>
				<td>${esc(place(r.city, r.country))}</td>
				<td class="adm-dim">${esc(r.asorg ?? '')}</td>
				<td>${esc(r.device ?? '')}</td>
				<td class="adm-dim">${esc(r.ref ?? 'direct')}</td>
			</tr>`;
		})
		.join('');
	view.innerHTML = `<div class="adm-tablewrap"><table class="adm-table">
		<thead><tr><th>Time</th><th>Visitor</th><th>Page</th><th>Event</th><th>Location</th><th>Network</th><th>Device</th><th>Referrer</th></tr></thead>
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
	if (!state.humans) {
		view.innerHTML = `<div class="adm-empty">Users are human visitors, identified by the JS beacon. Enable <b>Humans</b> in Filters to see them. Bots have no per-visitor identity, so they never appear here.</div>`;
		return;
	}
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

function csvCell(s: string): string {
	return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

async function renderSubscribers(view: HTMLElement): Promise<void> {
	const r = await fetch('/admin/subscribers', { credentials: 'include' });
	if (!r.ok) throw new Error(`subscribers ${r.status}`);
	const data = (await r.json()) as SubscribersResp;
	if (!data.configured) {
		view.innerHTML = `<div class="adm-empty">The <code>SUBSCRIBERS</code> KV namespace is not bound yet, so no signups are being stored. Bind it on the Pages project (Settings &rarr; Bindings) to start collecting.</div>`;
		return;
	}
	if (!data.subscribers.length) {
		view.innerHTML = `<div class="adm-empty">No release-notification signups yet.</div>`;
		return;
	}
	const rows = data.subscribers
		.map(
			(s) => `<tr>
			<td><span class="adm-path">${esc(s.email)}</span></td>
			<td>${esc(s.subscribedAt ? fmtTime(Date.parse(s.subscribedAt)) : '')}</td>
			<td class="adm-dim">${esc(s.source ?? '')}</td>
		</tr>`,
		)
		.join('');
	view.innerHTML = `
		<div class="adm-subs-actions">
			<span class="adm-subcount">${num(data.subscribers.length)} subscriber(s)</span>
			<button class="adm-chip is-active" id="subs-copy" type="button">Copy all emails</button>
			<button class="adm-chip" id="subs-csv" type="button">Download CSV</button>
		</div>
		<div class="adm-tablewrap"><table class="adm-table">
		<thead><tr><th>Email</th><th>Signed up</th><th>Source</th></tr></thead>
		<tbody>${rows}</tbody></table></div>`;

	const emails = data.subscribers.map((s) => s.email);
	document.getElementById('subs-copy')?.addEventListener('click', (e) => {
		const b = e.currentTarget as HTMLElement;
		void navigator.clipboard.writeText(emails.join(', ')).then(() => {
			const prev = b.textContent;
			b.textContent = 'Copied';
			setTimeout(() => {
				b.textContent = prev;
			}, 1200);
		});
	});
	document.getElementById('subs-csv')?.addEventListener('click', () => {
		const csv =
			'email,subscribed_at,source\n' +
			data.subscribers
				.map((s) => `${csvCell(s.email)},${csvCell(s.subscribedAt ?? '')},${csvCell(s.source ?? '')}`)
				.join('\n');
		const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
		const a = document.createElement('a');
		a.href = url;
		a.download = 'logos-subscribers.csv';
		a.click();
		URL.revokeObjectURL(url);
	});
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

// ── Global filter (time window + audiences), shared by every view ──────────────
/** epoch ms -> a value a <input type="datetime-local"> accepts (local time, no seconds). */
function toLocalInput(ms: number): string {
	const d = new Date(ms);
	const pad = (n: number): string => String(n).padStart(2, '0');
	return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function rangeLabel(): string {
	const p = state.preset ? PRESETS.find((x) => x.key === state.preset) : null;
	if (p) return p.label === 'All' ? 'All time' : `Last ${p.label}`;
	return `${fmtTime(state.from)} to ${fmtTime(state.to)}`;
}
function filterSummary(): string {
	const who = [state.humans ? 'Humans' : null, state.bots ? 'Bots' : null].filter(Boolean).join(' + ') || 'Nobody';
	return `${esc(rangeLabel())} &middot; ${esc(who)}`;
}
function applyPreset(key: string): void {
	const p = PRESETS.find((x) => x.key === key);
	if (!p) return;
	state.to = Date.now();
	state.from = state.to - p.ms;
	state.preset = key;
}
/** Push the current filter state into the (persistent) filter panel controls + summary. */
function syncFilterUI(): void {
	const summary = document.getElementById('adm-summary');
	if (summary) summary.innerHTML = filterSummary();
	const presets = document.getElementById('adm-presets');
	if (presets) {
		presets.innerHTML = PRESETS.map((p) => chip(state.preset === p.key, p.label, `data-preset="${p.key}"`)).join('');
	}
	const from = document.getElementById('adm-from') as HTMLInputElement | null;
	const to = document.getElementById('adm-to') as HTMLInputElement | null;
	if (from) from.value = toLocalInput(state.from);
	if (to) to.value = toLocalInput(state.to);
	const humans = document.getElementById('adm-humans') as HTMLInputElement | null;
	const bots = document.getElementById('adm-bots') as HTMLInputElement | null;
	if (humans) humans.checked = state.humans;
	if (bots) bots.checked = state.bots;
}

function renderChrome(): void {
	const tabs = document.getElementById('adm-tabs');
	if (tabs) {
		tabs.innerHTML = TABS.map((t) => chip(state.view === t.key, t.label, `data-view="${t.key}"`)).join('');
	}
	syncFilterUI();
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
		else if (state.view === 'access') await renderAccess(view);
		else await renderSubscribers(view);
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
			<div class="adm-filter">
				<button class="adm-chip" id="adm-filter-btn" type="button" aria-expanded="false">&#9776; Filters</button>
				<span class="adm-summary" id="adm-summary"></span>
				<div class="adm-filter-panel" id="adm-filter-panel" hidden>
					<div class="adm-fp-row"><span class="adm-fp-label">Range</span><div class="adm-presets" id="adm-presets"></div></div>
					<div class="adm-fp-row">
						<label class="adm-fp-field">From<input type="datetime-local" id="adm-from" /></label>
						<label class="adm-fp-field">To<input type="datetime-local" id="adm-to" /></label>
					</div>
					<div class="adm-fp-row"><span class="adm-fp-label">Show</span>
						<label class="adm-switch"><input type="checkbox" id="adm-humans" /> Humans</label>
						<label class="adm-switch"><input type="checkbox" id="adm-bots" /> Bots</label>
					</div>
				</div>
			</div>
			<div class="adm-tabs" id="adm-tabs"></div>
		</div>
		<div id="adm-view" class="adm-view"></div>`;

	const fpanel = document.getElementById('adm-filter-panel');
	const fbtn = document.getElementById('adm-filter-btn');
	const setOpen = (open: boolean): void => {
		if (fpanel) fpanel.hidden = !open;
		fbtn?.setAttribute('aria-expanded', open ? 'true' : 'false');
		fbtn?.classList.toggle('is-active', open);
	};
	fbtn?.addEventListener('click', (e) => {
		e.stopPropagation();
		setOpen(fpanel?.hidden ?? false);
	});
	// A click anywhere outside the open panel closes it.
	document.addEventListener('click', (e) => {
		if (!fpanel || fpanel.hidden) return;
		const t = e.target as Node;
		if (fpanel.contains(t) || fbtn?.contains(t)) return;
		setOpen(false);
	});

	document.getElementById('adm-presets')?.addEventListener('click', (e) => {
		const b = (e.target as HTMLElement).closest<HTMLElement>('[data-preset]');
		if (!b || !b.dataset.preset) return;
		applyPreset(b.dataset.preset);
		void render();
	});
	const onTime = (): void => {
		const from = document.getElementById('adm-from') as HTMLInputElement | null;
		const to = document.getElementById('adm-to') as HTMLInputElement | null;
		const f = from?.value ? new Date(from.value).getTime() : NaN;
		const t = to?.value ? new Date(to.value).getTime() : NaN;
		if (Number.isFinite(f)) state.from = f;
		if (Number.isFinite(t)) state.to = t;
		if (state.from > state.to) [state.from, state.to] = [state.to, state.from];
		state.preset = null;
		void render();
	};
	document.getElementById('adm-from')?.addEventListener('change', onTime);
	document.getElementById('adm-to')?.addEventListener('change', onTime);
	document.getElementById('adm-humans')?.addEventListener('change', (e) => {
		state.humans = (e.target as HTMLInputElement).checked;
		void render();
	});
	document.getElementById('adm-bots')?.addEventListener('change', (e) => {
		state.bots = (e.target as HTMLInputElement).checked;
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
