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
import { depmapHtml, DEFAULT_ASPECT } from '../build/roadmap-render.ts';
import type { Roadmap } from '../build/roadmap.ts';

initThemeToggle();
initNavMenu();
initHeroRotator();
initWisdom();
initScrollbars();
initConsent();
initNotify();
initCompare();
if (document.getElementById('docs-app')) initDocs();
if (document.getElementById('dl-grid')) initDownload();
if (document.getElementById('pg-run')) initPlayground();
if (document.getElementById('logos-roadmap')) initRoadmap();

// ── Roadmap: fit the dependency map's cards to the window ────────────────────
// The build bakes the map at DEFAULT_ASPECT (a typical landscape window), which is
// what a JS-off visitor keeps. With JS on, re-run the same layout (shared module
// build/roadmap-render.ts, data from the #logos-roadmap JSON island) so each card
// targets the visitor's real width:height ratio: roughly 16:9 on a desktop, tall
// cards on a portrait phone. Re-renders on resize/rotation, debounced, and only
// when the ratio actually moved enough to change the layout visibly.
function initRoadmap(): void {
	const island = document.getElementById('logos-roadmap');
	if (!island || !document.querySelector('.depmap-scroll')) return;
	let roadmap: Roadmap;
	try {
		roadmap = JSON.parse(island.textContent || '') as Roadmap;
	} catch {
		return; // baked static map stays in place
	}

	const windowAspect = (): number =>
		Math.min(2.6, Math.max(0.4, window.innerWidth / window.innerHeight));

	let rendered = DEFAULT_ASPECT; // what the server baked
	const render = (): void => {
		const aspect = windowAspect();
		if (Math.abs(aspect - rendered) < 0.05) return;
		const scroll = document.querySelector<HTMLElement>('.depmap-scroll');
		const html = depmapHtml(roadmap, aspect);
		if (!scroll || !html) return;
		scroll.outerHTML = html; // depmapHtml includes the .depmap-scroll wrapper
		rendered = aspect;
		// When the map is wider than the window (phones), start centered on the
		// graph's spine rather than on its left edge.
		const next = document.querySelector<HTMLElement>('.depmap-scroll');
		if (next) next.scrollLeft = (next.scrollWidth - next.clientWidth) / 2;
	};

	render();
	let timer = 0;
	window.addEventListener('resize', () => {
		clearTimeout(timer);
		timer = window.setTimeout(render, 150);
	});
}

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
// re-centering jitter). Pure progressive enhancement: with JS off (or reduced
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
		// The box holds the widest phrase's width in CSS (inline-grid), so it stays put
		// as phrases rotate; no per-phrase resizing is needed here.
	}

	let timer = window.setInterval(advance, INTERVAL);
	rotator.addEventListener('pointerenter', () => clearInterval(timer));
	rotator.addEventListener('pointerleave', () => {
		timer = window.setInterval(advance, INTERVAL);
	});
}

// ── Wisdom frieze: shared auto-drift + manual scroll ──────────────────────────
// The frieze holds each quote exactly once, as a row of .wisdom__unit blocks. A rAF
// loop nudges scrollLeft to give a slow ambient drift; because it's the same
// scrollLeft the visitor moves when they swipe or scroll, auto and manual share one
// mechanism. The endless loop comes from rotating whole units instead of duplicating
// them: when the first unit has fully scrolled out of view it moves to the end of
// the track (and the reverse when scrolling back past the start), with scrollLeft
// compensated by the unit's width so the visible content never jumps. Drift pauses
// while the pointer is over the frieze or it holds focus, so a passage can be read
// and selected. Pure progressive enhancement; with reduced motion there is no drift
// and the frieze is a plain scroll strip that still rotates at its ends.
function initWisdom(): void {
	const frieze = document.querySelector<HTMLElement>('.wisdom__scroll');
	const track = frieze?.querySelector<HTMLElement>('.wisdom__track');
	if (!frieze || !track) return;

	// Rotate units across the ends so the strip loops without any quote existing
	// twice. Read widths live each time: fonts loading can change them after init.
	const rotate = (): void => {
		if (track.scrollWidth <= frieze.clientWidth) return; // nothing overflows
		let first = track.firstElementChild as HTMLElement | null;
		// STRICTLY greater: after a backward rotation scrollLeft lands exactly on the
		// new first unit's width, and `>=` would rotate that unit straight back,
		// ping-ponging DOM moves on every scroll event when parked at the left edge.
		while (first && first.offsetWidth > 0 && frieze.scrollLeft > first.offsetWidth) {
			const w = first.offsetWidth;
			track.appendChild(first); // now the last unit
			frieze.scrollLeft -= w;
			first = track.firstElementChild as HTMLElement | null;
		}
		let last = track.lastElementChild as HTMLElement | null;
		while (last && last.offsetWidth > 0 && frieze.scrollLeft <= 0) {
			const w = last.offsetWidth;
			track.prepend(last); // now the first unit
			frieze.scrollLeft += w;
			last = track.lastElementChild as HTMLElement | null;
		}
	};
	// A hand scroll/swipe needs the rotation too, so it also loops endlessly.
	frieze.addEventListener('scroll', rotate, { passive: true });
	// Rotate once up front: from the pristine scrollLeft=0 state no scroll event can
	// fire (the position cannot go below 0), so without this the strip would dead-end
	// leftward until something first scrolled it right.
	rotate();

	if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;

	const SPEED = 24; // px/second of ambient drift

	let paused = false;
	frieze.addEventListener('pointerenter', () => {
		paused = true;
	});
	frieze.addEventListener('pointerleave', () => {
		paused = false;
	});
	frieze.addEventListener('focusin', () => {
		paused = true;
	});
	frieze.addEventListener('focusout', () => {
		paused = false;
	});

	let last = 0;
	const step = (t: number): void => {
		if (last && !paused) {
			frieze.scrollLeft += (SPEED * (t - last)) / 1000;
			rotate();
		}
		last = t;
		requestAnimationFrame(step);
	};
	requestAnimationFrame(step);
}

// ── Comparison matrix: scroll hints + floating header ─────────────────────────
// Two enhancements for a table bigger than most viewports. (1) Edge fade + chevron
// overlays (.compare__shadows::before/::after) show in which direction more
// language columns exist; both disappear on screens wide enough to show the whole
// table. (2) A fixed clone of the header row parks just below the menu dock while
// the page scroll position is inside the table, so the language columns stay
// identifiable through all 22 rows. The clone follows horizontal scrolling by
// mirroring scrollLeft onto its own overflow:hidden clip box, which also keeps the
// capability corner pinned via the same sticky rule as the real header. All of it
// re-checks on scroll, resize, and font load (which changes column widths).
function initCompare(): void {
	const wrap = document.querySelector<HTMLElement>('[data-compare]');
	const scroll = wrap?.querySelector<HTMLElement>('.compare__scroll');
	const table = scroll?.querySelector<HTMLTableElement>('.compare__table');
	const thead = table?.querySelector('thead');
	if (!wrap || !scroll || !table || !thead) return;

	const updateHints = (): void => {
		const max = scroll.scrollWidth - scroll.clientWidth;
		wrap.classList.toggle('show-left', scroll.scrollLeft > 4);
		wrap.classList.toggle('show-right', scroll.scrollLeft < max - 4);
	};

	const float = document.createElement('div');
	float.className = 'compare__float';
	float.setAttribute('aria-hidden', 'true');
	float.hidden = true;
	const clip = document.createElement('div');
	clip.className = 'compare__float-clip';
	const floatTable = document.createElement('table');
	floatTable.className = 'compare__table';
	clip.appendChild(floatTable);
	float.appendChild(clip);
	document.body.appendChild(float);

	// Lock the cloned header's column widths to the real ones (a thead-only table
	// would otherwise compute its own layout), then match the full table width.
	const rebuild = (): void => {
		floatTable.innerHTML = '';
		const clone = thead.cloneNode(true) as HTMLElement;
		floatTable.appendChild(clone);
		const src = [...thead.querySelectorAll<HTMLElement>('th')];
		const dst = [...clone.querySelectorAll<HTMLElement>('th')];
		dst.forEach((th, i) => {
			const w = src[i]?.getBoundingClientRect().width ?? 0;
			th.style.width = `${w}px`;
			th.style.minWidth = `${w}px`;
			th.style.maxWidth = `${w}px`;
		});
		floatTable.style.width = `${table.getBoundingClientRect().width}px`;
	};

	// Show the clone while the real header is scrolled under the dock but table
	// rows are still on screen; align it with the scroll container's box.
	const place = (): void => {
		const dock = document.querySelector('.dock');
		const top = (dock ? dock.getBoundingClientRect().bottom : 0) + 6;
		const rect = scroll.getBoundingClientRect();
		const headH = thead.getBoundingClientRect().height;
		const show = rect.top < top && rect.bottom > top + headH;
		float.hidden = !show;
		if (!show) return;
		float.style.top = `${top}px`;
		float.style.left = `${rect.left + 1}px`;
		float.style.width = `${rect.width - 2}px`;
		clip.scrollLeft = scroll.scrollLeft;
	};

	scroll.addEventListener(
		'scroll',
		() => {
			updateHints();
			clip.scrollLeft = scroll.scrollLeft;
		},
		{ passive: true },
	);
	window.addEventListener('scroll', place, { passive: true });
	window.addEventListener('resize', () => {
		rebuild();
		updateHints();
		place();
	});
	void document.fonts?.ready.then(() => {
		rebuild();
		updateHints();
		place();
	});
	rebuild();
	updateHints();
	place();
}

// ── Get-notified form ─────────────────────────────────────────────────────────
// Progressive enhancement over the plain notify form (build/pages.ts): submit via
// fetch, show the outcome inline, and disable the button while in flight. With JS
// off the form posts normally and the Pages Function answers with a small HTML
// page, so the flow works either way.
function initNotify(): void {
	for (const form of document.querySelectorAll<HTMLFormElement>('form[data-notify]')) {
		const status = form.querySelector<HTMLElement>('.notify__status');
		const submit = form.querySelector<HTMLButtonElement>('.notify__submit');
		// The status <p> is always in the DOM (an empty live region, its margin gated
		// by :empty in CSS): text set into a display:none live region would not be
		// announced by screen readers, so it is never `hidden`.
		const show = (kind: 'ok' | 'error', text: string): void => {
			if (!status) return;
			status.textContent = text;
			status.classList.toggle('is-ok', kind === 'ok');
			status.classList.toggle('is-error', kind === 'error');
		};
		form.addEventListener('submit', (e) => {
			e.preventDefault();
			const body = new URLSearchParams(
				new FormData(form) as unknown as Record<string, string>,
			);
			if (submit) submit.disabled = true;
			fetch(form.action, { method: 'POST', body, headers: { Accept: 'application/json' } })
				.then(async (res) => {
					const data = (await res.json().catch(() => null)) as {
						ok?: boolean;
						error?: string;
					} | null;
					if (res.ok && data?.ok) {
						form.reset();
						show('ok', "You're on the list. Emails for the most important builds only.");
					} else if (res.status === 503) {
						show('error', 'Signup is not wired up yet; watch releases on GitHub instead.');
					} else if (data?.error === 'invalid-email') {
						show('error', 'That does not look like an email address.');
					} else {
						show('error', 'Something went wrong; try again in a moment.');
					}
				})
				.catch(() => show('error', 'Network error; try again in a moment.'))
				.finally(() => {
					if (submit) submit.disabled = false;
				});
		});
	}
}

// ── Auto-hiding scrollbar ─────────────────────────────────────────────────────
// Reveal the (otherwise transparent) scrollbar thumb only while something is
// actively scrolling: the whole-page scroll (<html>) and the docs panes alike.
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
			`The Logos runtime for ${v} is a placeholder build, so in-browser execution isn't available yet.\n` +
			`Your code will run here once Logos compiles to WebAssembly.`;
	});
}

// ── Docs hydration ───────────────────────────────────────────────────────────
interface DocPageC {
	path: string;
	title: string;
}
interface Manifest {
	versions: string[];
	latest: string | null;
	trees: Record<string, DocPageC[]>;
}

function escapeHtml(s: string): string {
	return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function initDocs(): void {
	const app = document.getElementById('docs-app')!;

	let manifest: Manifest | null = null;

	const pagesOf = (v: string): DocPageC[] => manifest?.trees[v] ?? [];
	const hasPage = (v: string, path: string): boolean => pagesOf(v).some((p) => p.path === path);
	const hrefFor = (v: string, path: string): string =>
		manifest && v === manifest.latest ? `/docs/${path}/` : `/docs/v${v}/${path}/`;

	// URL of `path` in version `v`, falling back to that version's landing page when
	// the version does not contain the page (it was added/removed/moved there).
	function urlInVersion(path: string, v: string): string {
		if (hasPage(v, path)) return hrefFor(v, path);
		const first = pagesOf(v)[0];
		return first ? hrefFor(v, first.path) : '/docs/';
	}

	// Swap the docs-app block for the one at `url`. Each version's page is fully
	// server-rendered (tree, arrows, dropdown), so we just replace the block. Staying
	// on the same page path (e.g. switching versions) keeps the scroll position so the
	// reader sees exactly what changed; moving to another page resets to the top.
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

		const samePath = next.dataset.path === app.dataset.path;
		const savedScroll = app.querySelector('.docs-main')?.scrollTop ?? 0;

		app.innerHTML = next.innerHTML;
		app.dataset.path = next.dataset.path;
		app.dataset.version = next.dataset.version;

		const title = doc.querySelector('title')?.textContent;
		if (title) document.title = title;
		if (push) history.pushState(null, '', url);

		const main = app.querySelector('.docs-main');
		if (main) main.scrollTop = samePath ? savedScroll : 0;
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

	// Version selector: jump to the same page in the chosen version (or its landing).
	document.addEventListener('change', (e) => {
		const sel = e.target as HTMLSelectElement;
		if (sel.id !== 'docs-global-version') return;
		const url = urlInVersion(app.dataset.path ?? '', sel.value);
		void navigate(url, true).then((ok) => {
			if (!ok) location.href = url;
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

	// Load the manifest so the version dropdown can resolve cross-version URLs.
	void fetch('/manifest.json')
		.then((r) => r.json() as Promise<Manifest>)
		.then((m) => {
			manifest = m;
		})
		.catch(() => {
			/* navigation still works via full page loads */
		});
}
