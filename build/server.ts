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
