// Client runtime: the theme toggle (every page) and docs hydration (docs pages).
//
// The docs are fully server-rendered to real URLs at the latest version; this
// script is progressive enhancement. With JS off, every page and the per-section
// version arrows still work. With JS on, internal navigation swaps content via
// fetch + pushState, and the "Version" selector pins the whole site to a chosen
// global version (re-skinning the tree and re-deriving the off-version warning).

import {
	OS_ORDER,
	OS_LABELS,
	ARCH_LABELS,
	assetsForOs,
	installCommand,
	type Release,
	type Os,
	type Asset,
} from '../build/releases.ts';

initThemeToggle();
initNavMenu();
initHeroRotator();
initScrollbars();
initConsent();
if (document.getElementById('docs-app')) initDocs();
if (document.getElementById('dl-grid')) initDownload();
if (document.getElementById('pg-run')) initPlayground();

// ── Nav dropdown (hamburger) ──────────────────────────────────────────────────
// On narrow screens the inline nav is hidden and this button reveals the same
// links in a dropdown. Closes on outside click, Escape, or picking a link.
function initNavMenu(): void {
	const toggle = document.querySelector<HTMLButtonElement>('.nav-toggle');
	const menu = document.getElementById('nav-menu');
	if (!toggle || !menu) return;

	const setOpen = (open: boolean): void => {
		menu.hidden = !open;
		toggle.setAttribute('aria-expanded', String(open));
	};

	toggle.addEventListener('click', (e) => {
		e.stopPropagation();
		setOpen(menu.hidden);
	});
	document.addEventListener('click', (e) => {
		if (menu.hidden) return;
		const t = e.target as Node;
		if (!menu.contains(t) && !toggle.contains(t)) setOpen(false);
	});
	document.addEventListener('keydown', (e) => {
		if (e.key === 'Escape' && !menu.hidden) setOpen(false);
	});
	menu.addEventListener('click', (e) => {
		if ((e.target as Element)?.closest('a')) setOpen(false);
	});
}

// ── Hero headline rotator ─────────────────────────────────────────────────────
// Cycles the tail of "Logos is ___" through its phrases: the current phrase
// slides up and out while the next rises into place. The box reserves the widest
// phrase's width in CSS, so it never changes size and the brand stays put (no
// re-centering jitter). Pure progressive enhancement — with JS off (or reduced
// motion) the first phrase stays shown. Pauses while the pointer is over the
// rotator so a reader can hold a phrase.
function initHeroRotator(): void {
	const rotator = document.querySelector<HTMLElement>('[data-rotator]');
	if (!rotator) return;
	const items = [...rotator.querySelectorAll<HTMLElement>('.hero__rot-item')];
	if (items.length < 2) return;

	const INTERVAL = 4500;
	let i = 0;

	if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;

	function advance(): void {
		const cur = items[i]!;
		const nextIdx = (i + 1) % items.length;
		const next = items[nextIdx]!;
		// Snap the incoming phrase below the band with no transition, so it rises
		// up into view rather than sweeping down through it.
		next.classList.add('is-instant');
		next.classList.remove('is-prev', 'is-current');
		void next.offsetWidth; // commit the reset before re-enabling transitions
		next.classList.remove('is-instant');
		cur.classList.remove('is-current');
		cur.classList.add('is-prev');
		next.classList.add('is-current');
		i = nextIdx;
		sizeTo(i, false); // glide the headline to re-center on the new phrase's width
	}

	let timer = window.setInterval(advance, INTERVAL);
	rotator.addEventListener('pointerenter', () => clearInterval(timer));
	rotator.addEventListener('pointerleave', () => {
		timer = window.setInterval(advance, INTERVAL);
	});
}

// ── Auto-hiding scrollbar ─────────────────────────────────────────────────────
// Reveal the (otherwise transparent) scrollbar thumb only while something is
// actively scrolling — the whole-page scroll (<html>) and the docs panes alike.
function initScrollbars(): void {
	const timers = new WeakMap<Element, number>();
	document.addEventListener(
		'scroll',
		(e) => {
			const node = e.target;
			const el =
				node === document || node === document.documentElement || node === document.body
					? document.documentElement
					: node instanceof HTMLElement
						? node
						: null;
			if (!el) return;
			el.classList.add('is-scrolling');
			const prev = timers.get(el);
			if (prev) clearTimeout(prev);
			timers.set(
				el,
				window.setTimeout(() => el.classList.remove('is-scrolling'), 700)
			);
		},
		true
	);
}

// ── Theme toggle ────────────────────────────────────────────────────────────
function initThemeToggle(): void {
	const input = document.querySelector<HTMLInputElement>('.theme-switch__input');
	if (!input) return;
	const readCookie = (name: string): string | null => {
		const m = document.cookie.match('(?:^|; )' + name + '=([^;]*)');
		return m ? decodeURIComponent(m[1]!) : null;
	};
	const current = readCookie('theme') === 'dark' ? 'dark' : 'light';
	document.documentElement.dataset.theme = current;
	input.checked = current === 'dark';
	input.addEventListener('change', () => {
		const theme = input.checked ? 'dark' : 'light';
		document.documentElement.dataset.theme = theme;
		document.cookie = `theme=${theme}; path=/; max-age=31536000; samesite=lax`;
	});
}

// ── Download page ─────────────────────────────────────────────────────────────
// Re-render the OS/arch grid when the version changes, highlight the visitor's own
// OS, and wire the copy buttons. The release data is baked into a JSON island at
// build time (build/pages.ts); with JS off the latest version's grid already works.
function detectOs(): Os {
	const ua = navigator.userAgent;
	if (/Mac|iPhone|iPad|iPod/i.test(ua)) return 'macos';
	if (/Win/i.test(ua)) return 'windows';
	return 'linux';
}

function formatDate(iso: string): string {
	const d = new Date(iso);
	if (Number.isNaN(d.getTime())) return '';
	return new Intl.DateTimeFormat('en', { year: 'numeric', month: 'short', day: 'numeric' }).format(d);
}

function dlRowHtml(asset: Asset): string {
	return `<div class="dl-row" data-arch="${asset.arch}">
      <div class="dl-row__head"><span class="dl-row__arch">${escapeHtml(ARCH_LABELS[asset.arch])}</span><a class="logos-btn logos-btn--download dl-row__dl" href="${escapeHtml(asset.url)}" download>Download .${escapeHtml(asset.ext)}</a></div>
      <div class="dl-cmd"><pre class="dl-cmd__pre"><code>${escapeHtml(installCommand(asset))}</code></pre><button class="dl-copy" type="button" data-copy aria-label="Copy command">Copy</button></div>
    </div>`;
}

function dlCardHtml(release: Release, os: Os): string {
	const assets = assetsForOs(release, os);
	const body = assets.length
		? assets.map(dlRowHtml).join('')
		: `<p class="dl-card__none">No ${escapeHtml(OS_LABELS[os])} build for ${escapeHtml(release.version)}.</p>`;
	return `<article class="dl-card" data-os="${os}"><h3 class="dl-card__os">${escapeHtml(OS_LABELS[os])}</h3>${body}</article>`;
}

function initDownload(): void {
	const grid = document.getElementById('dl-grid');
	const select = document.getElementById('dl-version') as HTMLSelectElement | null;
	const meta = document.getElementById('dl-meta');
	const dataEl = document.getElementById('logos-releases');
	if (!grid || !dataEl) return;

	let releases: Release[];
	try {
		releases = JSON.parse(dataEl.textContent || '[]') as Release[];
	} catch {
		return; // server-rendered latest grid stays in place
	}
	if (!releases.length) return;

	const detected = detectOs();

	function render(version: string): void {
		const release = releases.find((r) => r.version === version) ?? releases[0]!;
		grid!.innerHTML = OS_ORDER.map((os) => dlCardHtml(release, os)).join('');
		grid!.querySelector(`.dl-card[data-os="${detected}"]`)?.classList.add('is-recommended');
		if (meta) meta.textContent = release.publishedAt ? `released ${formatDate(release.publishedAt)}` : `version ${release.version}`;
	}

	render(select?.value || releases[0]!.version);
	select?.addEventListener('change', () => render(select.value));

	grid.addEventListener('click', (e) => {
		const btn = (e.target as Element)?.closest?.('[data-copy]') as HTMLButtonElement | null;
		if (!btn) return;
		const code = btn.parentElement?.querySelector('code')?.textContent ?? '';
		if (!code || !navigator.clipboard) return;
		void navigator.clipboard.writeText(code).then(() => {
			const prev = btn.textContent;
			btn.textContent = 'Copied';
			btn.classList.add('is-copied');
			window.setTimeout(() => {
				btn.textContent = prev;
				btn.classList.remove('is-copied');
			}, 1200);
		});
	});
}

// ── Cookie consent + analytics ────────────────────────────────────────────────
// Analytics (Microsoft Clarity + Google Analytics 4) is cookie-based, so nothing
// loads until the visitor accepts. The choice is stored in a strictly-necessary
// `consent` cookie; "Cookie settings" in the footer reopens the banner to change it.
// If the build didn't bake in any ids (window.__ANALYTICS__ absent), this is a no-op.
interface AnalyticsConfig {
	ga4: string;
	clarity: string;
}

function loadGa4(id: string): void {
	const w = window as unknown as { dataLayer?: unknown[]; gtag?: (...a: unknown[]) => void };
	const s = document.createElement('script');
	s.async = true;
	s.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`;
	document.head.appendChild(s);
	w.dataLayer = w.dataLayer || [];
	function gtag(...args: unknown[]) {
		// Each gtag() call is pushed as one array-like entry, as GA expects.
		w.dataLayer!.push(args);
	}
	w.gtag = gtag;
	gtag('js', new Date());
	gtag('config', id);
}

function loadClarity(id: string): void {
	const w = window as unknown as { clarity?: { (...a: unknown[]): void; q?: unknown[] } };
	w.clarity =
		w.clarity ||
		function (...args: unknown[]) {
			(w.clarity!.q = w.clarity!.q || []).push(args);
		};
	const t = document.createElement('script');
	t.async = true;
	t.src = 'https://www.clarity.ms/tag/' + encodeURIComponent(id);
	const first = document.getElementsByTagName('script')[0];
	first?.parentNode?.insertBefore(t, first);
}

function initConsent(): void {
	const cfg = (window as unknown as { __ANALYTICS__?: AnalyticsConfig }).__ANALYTICS__;
	if (!cfg) return; // analytics not configured in this build
	const banner = document.getElementById('consent-banner');

	const readConsent = (): string | null => {
		const m = document.cookie.match('(?:^|; )consent=([^;]*)');
		return m ? decodeURIComponent(m[1]!) : null;
	};
	const setConsent = (v: string): void => {
		// ~180 days; strictly necessary (remembers the choice), so no consent needed.
		document.cookie = `consent=${v}; path=/; max-age=15552000; samesite=lax`;
	};
	const show = (): void => {
		if (banner) banner.hidden = false;
	};
	const hide = (): void => {
		if (banner) banner.hidden = true;
	};

	let loaded = false;
	const loadAnalytics = (): void => {
		if (loaded) return;
		loaded = true;
		if (cfg.ga4) loadGa4(cfg.ga4);
		if (cfg.clarity) loadClarity(cfg.clarity);
	};

	const consent = readConsent();
	if (consent === 'granted') loadAnalytics();
	else if (consent !== 'denied') show(); // no stored choice -> ask

	document.getElementById('consent-accept')?.addEventListener('click', () => {
		setConsent('granted');
		hide();
		loadAnalytics();
	});
	document.getElementById('consent-reject')?.addEventListener('click', () => {
		setConsent('denied');
		hide();
	});
	// Footer "Cookie settings" reopens the banner (delegated, present on most pages).
	document.addEventListener('click', (e) => {
		if ((e.target as Element | null)?.id === 'consent-manage') {
			e.preventDefault();
			show();
		}
	});
}

// ── Playground ────────────────────────────────────────────────────────────────
// The version picker and editor are live; running is stubbed until Logos ships a
// real WebAssembly runtime. Each version <option> carries its wasm asset URL in
// data-wasm, so the future harness only has to: fetch that URL, instantiate it in
// a Web Worker (with a timeout/terminate kill-switch for runaway code), feed it the
// editor source, and write the result to #pg-output.
function initPlayground(): void {
	const runBtn = document.getElementById('pg-run');
	const select = document.getElementById('pg-version') as HTMLSelectElement | null;
	const output = document.getElementById('pg-output');
	const meta = document.getElementById('pg-meta');
	if (!runBtn || !output) return;

	const selectedVersion = (): string => select?.value || '';
	const updateMeta = (): void => {
		if (meta) meta.textContent = selectedVersion() ? `runtime ${selectedVersion()} · placeholder` : '';
	};
	updateMeta();
	select?.addEventListener('change', updateMeta);

	runBtn.addEventListener('click', () => {
		const v = selectedVersion() || 'this version';
		// TODO: load select.selectedOptions[0].dataset.wasm in a Worker and evaluate
		// the #pg-editor source against it. Stubbed until Logos targets WebAssembly.
		output.textContent =
			`The Logos runtime for ${v} is a placeholder build — in-browser execution isn't available yet.\n` +
			`Your code will run here once Logos compiles to WebAssembly.`;
	});
}

// ── Docs hydration ───────────────────────────────────────────────────────────
interface Snapshot {
	version: string;
	title: string;
}
interface ManifestSection {
	id: string;
	dir: string;
	name: string;
	snapshots: Snapshot[];
}
interface Manifest {
	versions: string[];
	latest: string | null;
	sections: ManifestSection[];
}

const CHEV_DOWN = `<svg class="tree-chev" viewBox="0 0 16 16" width="11" height="11" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="4 6 8 10 12 6"/></svg>`;

/** Compare two "X.Y.Z" version strings. */
function cmpVer(a: string, b: string): number {
	const pa = a.split('.').map(Number);
	const pb = b.split('.').map(Number);
	return pa[0]! - pb[0]! || pa[1]! - pb[1]! || pa[2]! - pb[2]!;
}

function escapeHtml(s: string): string {
	return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function prettify(seg: string): string {
	return seg.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

interface TreeNode {
	label: string;
	children: Map<string, TreeNode>;
	section?: ManifestSection;
}

function initDocs(): void {
	const app = document.getElementById('docs-app')!;

	let manifest: Manifest | null = null;
	const byId = new Map<string, ManifestSection>();
	let globalVersion = '';

	/** The effective snapshot for a section at global version `g`, or null. */
	function effectiveAt(section: ManifestSection, g: string): Snapshot | null {
		let eff: Snapshot | null = null;
		for (const sn of section.snapshots) {
			if (cmpVer(sn.version, g) <= 0) eff = sn;
			else break;
		}
		return eff;
	}

	/** URL of a section at `g`: its canonical URL when latest, else the permalink. */
	function urlForSectionAt(id: string, g: string): string | null {
		const section = byId.get(id);
		if (!section || !manifest) return null;
		const eff = effectiveAt(section, g);
		if (!eff) return null;
		return g === manifest.latest ? `/docs/${id}/` : `/docs/${id}/v${eff.version}/`;
	}

	// ── Tree rendering (mirrors build/docs-render.ts) ──────────────────────────
	function buildTree(g: string): TreeNode {
		const root: TreeNode = { label: '', children: new Map() };
		for (const section of manifest!.sections) {
			if (!effectiveAt(section, g)) continue; // hidden before it existed
			const parts = section.id.split('/');
			let node = root;
			for (let i = 0; i < parts.length - 1; i++) {
				const key = parts[i]!;
				let child = node.children.get(key);
				if (!child) {
					child = { label: prettify(key), children: new Map() };
					node.children.set(key, child);
				}
				node = child;
			}
			node.children.set(parts[parts.length - 1]!, { label: section.name, children: new Map(), section });
		}
		return root;
	}

	function renderNode(node: TreeNode, g: string, activeId: string, nested: boolean): string {
		const entries = [...node.children.values()].sort((a, b) => {
			const af = a.section ? 1 : 0;
			const bf = b.section ? 1 : 0;
			if (af !== bf) return af - bf;
			return a.label.localeCompare(b.label);
		});
		const items = entries
			.map((child) => {
				if (child.section) {
					const eff = effectiveAt(child.section, g)!;
					const url = g === manifest!.latest ? `/docs/${child.section.id}/` : `/docs/${child.section.id}/v${eff.version}/`;
					const active = child.section.id === activeId ? ' active' : '';
					return `<li><a class="tree-link${active}" href="${url}">${escapeHtml(eff.title)}<span class="tree-ver">v${eff.version}</span></a></li>`;
				}
				return `<li><details open><summary class="tree-folder">${CHEV_DOWN}<span class="tree-folder__label">${escapeHtml(child.label)}</span></summary>${renderNode(child, g, activeId, true)}</details></li>`;
			})
			.join('');
		return `<ul class="tree${nested ? ' tree--nested' : ''}">${items}</ul>`;
	}

	// Re-skin the dropdown, tree, and off-version warning to `globalVersion`. When
	// it equals latest the server-rendered markup is already correct (no-op).
	function applyGlobalContext(): void {
		const sel = document.getElementById('docs-global-version') as HTMLSelectElement | null;
		if (sel) sel.value = globalVersion;
		if (!manifest || globalVersion === manifest.latest) return;

		const id = app.dataset.section ?? '';
		const tree = document.getElementById('docs-tree');
		if (tree) tree.innerHTML = renderNode(buildTree(globalVersion), globalVersion, id, false);

		const section = byId.get(id);
		const correct = document.getElementById('docs-correct') as HTMLAnchorElement | null;
		const group = document.getElementById('docs-snapnav-group');
		if (!section || !correct || !group) return;

		const eff = effectiveAt(section, globalVersion);
		const viewed = app.dataset.version ?? '';
		const off = !!eff && eff.version !== viewed;
		group.classList.toggle('off', off);
		if (off && eff) {
			correct.hidden = false;
			correct.href = `/docs/${id}/v${eff.version}/`;
			correct.textContent = `At ${globalVersion}, this page is v${eff.version}.`;
		} else {
			correct.hidden = true;
		}
	}

	// Swap the docs-app block for the one at `url`, then reapply the global context.
	// Switching versions of the SAME section keeps the scroll position so the reader
	// can see exactly what changed; moving to another section resets to the top.
	async function navigate(url: string, push: boolean): Promise<boolean> {
		let html: string;
		try {
			const res = await fetch(url);
			if (!res.ok) return false;
			html = await res.text();
		} catch {
			return false;
		}
		const doc = new DOMParser().parseFromString(html, 'text/html');
		const next = doc.getElementById('docs-app');
		if (!next) return false;

		const prevSection = app.dataset.section;
		const savedScroll = app.querySelector('.docs-main')?.scrollTop ?? 0;
		const sameSection = next.dataset.section === prevSection;

		app.innerHTML = next.innerHTML;
		app.dataset.section = next.dataset.section;
		app.dataset.version = next.dataset.version;
		app.dataset.global = next.dataset.global;

		const title = doc.querySelector('title')?.textContent;
		if (title) document.title = title;
		if (push) history.pushState(null, '', url);

		applyGlobalContext();
		const main = app.querySelector('.docs-main');
		if (main) main.scrollTop = sameSection ? savedScroll : 0;
		return true;
	}

	// Intercept internal docs links (delegated, so swapped content stays wired).
	document.addEventListener('click', (e) => {
		if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
		const anchor = (e.target as Element)?.closest?.('a');
		if (!anchor) return;
		const href = anchor.getAttribute('href');
		if (!href || !href.startsWith('/docs/') || anchor.target === '_blank') return;
		e.preventDefault();
		void navigate(href, true).then((ok) => {
			if (!ok) location.href = href;
		});
	});

	// Version selector: pin the whole site to the chosen version and jump the
	// current section to its effective snapshot there.
	document.addEventListener('change', (e) => {
		const sel = e.target as HTMLSelectElement;
		if (sel.id !== 'docs-global-version') return;
		globalVersion = sel.value;
		try {
			localStorage.setItem('docsVersion', globalVersion);
		} catch {
			/* ignore */
		}
		const id = app.dataset.section ?? '';
		let url = urlForSectionAt(id, globalVersion);
		if (!url && manifest) {
			const first = manifest.sections.find((s) => effectiveAt(s, globalVersion));
			url = first ? urlForSectionAt(first.id, globalVersion) : '/docs/';
		}
		void navigate(url || '/docs/', true).then((ok) => {
			if (!ok) location.href = url || '/docs/';
		});
	});

	window.addEventListener('popstate', () => {
		void navigate(location.pathname, false);
	});

	// Draggable divider: resize the sidebar and remember the width.
	const SIDEBAR_MIN = 12 * 16;
	const SIDEBAR_MAX = 30 * 16;
	try {
		const storedW = localStorage.getItem('docsSidebarW');
		if (storedW) app.style.setProperty('--sidebar-w', storedW);
	} catch {
		/* ignore */
	}
	let resizing = false;
	document.addEventListener('pointerdown', (e) => {
		const target = e.target as HTMLElement | null;
		if (!target?.classList?.contains('docs-resizer')) return;
		resizing = true;
		target.classList.add('is-dragging');
		target.setPointerCapture?.(e.pointerId);
		document.body.style.userSelect = 'none';
	});
	document.addEventListener('pointermove', (e) => {
		if (!resizing) return;
		const width = Math.max(SIDEBAR_MIN, Math.min(SIDEBAR_MAX, e.clientX - app.getBoundingClientRect().left));
		app.style.setProperty('--sidebar-w', `${width}px`);
	});
	document.addEventListener('pointerup', () => {
		if (!resizing) return;
		resizing = false;
		document.querySelector('.docs-resizer')?.classList.remove('is-dragging');
		document.body.style.userSelect = '';
		try {
			localStorage.setItem('docsSidebarW', app.style.getPropertyValue('--sidebar-w'));
		} catch {
			/* ignore */
		}
	});

	// Load the manifest, then apply any stored version preference.
	void fetch('/manifest.json')
		.then((r) => r.json() as Promise<Manifest>)
		.then((m) => {
			manifest = m;
			for (const s of m.sections) byId.set(s.id, s);
			let stored: string | null = null;
			try {
				stored = localStorage.getItem('docsVersion');
			} catch {
				/* ignore */
			}
			globalVersion = stored && m.versions.includes(stored) ? stored : m.latest ?? '';
			applyGlobalContext();
		})
		.catch(() => {
			/* navigation still works via full page loads */
		});
}
