// Dev server: build once, serve dist/, watch sources, rebuild, and live-reload.
import http from 'node:http';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import chokidar from 'chokidar';
import { build, ROOT, localDocsDir } from './build.ts';

const DIST = path.join(ROOT, 'dist');
const PORT = 4321;

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

const server = http.createServer(async (req, res) => {
	const url = req.url ?? '/';

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
	// content-hashed (fonts/[name]-[hash].woff2), so they're safe to cache hard —
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

let building = false;
let queued = false;
async function rebuild(): Promise<void> {
	if (building) {
		queued = true;
		return;
	}
	building = true;
	try {
		await build();
		notifyReload();
		console.log('rebuilt');
	} catch (err) {
		console.error('build failed:', err);
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
		{ cwd: ROOT, ignoreInitial: true },
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
