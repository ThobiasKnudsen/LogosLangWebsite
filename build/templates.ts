// Static HTML templates shared by every page: the floating menu dock, the footer,
// the pre-paint theme script, and the full-document shell.

const GITHUB = 'https://github.com/ThobiasKnudsen/LogosLang';
const DOWNLOAD = '/download/';

// Absolute production origin, used for canonical URLs, Open Graph / Twitter tags,
// the sitemap, and llms.txt. Overridable for local or preview builds via
// `SITE_URL=...`, but it must be an absolute https origin in production: pointing
// canonicals at localhost would tell crawlers the real page lives there.
export const SITE_URL = (process.env.SITE_URL || 'https://logoslang.dev').replace(/\/$/, '');
// Social preview card (1200x630). Served from /public. Leave '' to omit og:image.
export const OG_IMAGE = '/og.png';
const SITE_NAME = 'Logos';
const DEFAULT_DESC = 'Logos: a self-hosting systems language built on radical unification.';

// Analytics IDs, injected at build time (set them in the Cloudflare Pages env).
// Both empty -> analytics is fully off: no consent banner, no scripts, no cookies.
// Set GA4_ID (G-XXXXXXXXXX) and/or CLARITY_ID (the Clarity project id) to enable.
const GA4_ID = process.env.GA4_ID || '';
const CLARITY_ID = process.env.CLARITY_ID || '';
const ANALYTICS_ENABLED = !!(GA4_ID || CLARITY_ID);
// Exposes the ids to the client so it can load them *after* consent. The scripts
// themselves are NOT here — nothing tracking loads until the visitor accepts.
const ANALYTICS_CONFIG = ANALYTICS_ENABLED
	? `\n<script>window.__ANALYTICS__=${JSON.stringify({ ga4: GA4_ID, clarity: CLARITY_ID }).replace(/</g, '\\u003c')};</script>`
	: '';

/** Join the production origin with an absolute site path (e.g. "/vision/"). */
export function absUrl(p: string): string {
	return `${SITE_URL}${p.startsWith('/') ? p : `/${p}`}`;
}

export function escapeHtml(s: string): string {
	return s
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;');
}

const NAV = [
	{ key: 'vision', label: 'Vision', href: '/vision/' },
	{ key: 'roadmap', label: 'Roadmap', href: '/roadmap/' },
	{ key: 'examples', label: 'Examples', href: '/examples/' },
	{ key: 'playground', label: 'Playground', href: '/playground/' },
	{ key: 'docs', label: 'Docs', href: '/docs/' },
];

const SUN_SVG = `<svg class="theme-switch__icon sun" viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><circle cx="12" cy="12" r="4.2" fill="currentColor"/><g stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><line x1="12" y1="1.5" x2="12" y2="4"/><line x1="12" y1="20" x2="12" y2="22.5"/><line x1="1.5" y1="12" x2="4" y2="12"/><line x1="20" y1="12" x2="22.5" y2="12"/><line x1="4.2" y1="4.2" x2="6" y2="6"/><line x1="18" y1="18" x2="19.8" y2="19.8"/><line x1="19.8" y1="4.2" x2="18" y2="6"/><line x1="6" y1="18" x2="4.2" y2="19.8"/></g></svg>`;
const MOON_SVG = `<svg class="theme-switch__icon moon" viewBox="0 0 24 24" width="13" height="13" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" fill="currentColor"/></svg>`;

// The theme toggle lives in the fixed top-right corner on every page, independent
// of the dock.
function themeToggleHtml(): string {
	return `<label class="theme-switch" title="Toggle dark mode">
  <span class="sr-only">Toggle dark mode</span>
  <input type="checkbox" class="theme-switch__input" />
  <span class="theme-switch__track">
    <span class="theme-switch__thumb"></span>
    ${SUN_SVG}${MOON_SVG}
  </span>
</label>`;
}

function dockHtml(active: string): string {
	const links = NAV.map(
		(n) =>
			`<a class="nav-link${n.key === active ? ' active' : ''}" href="${n.href}"${
				n.key === active ? ' aria-current="page"' : ''
			}>${n.label}</a>`
	).join('');

	return `<header class="dock">
  <a class="wordmark" href="/" aria-label="Logos home">Λόγος</a>
  <nav class="nav" aria-label="Primary">${links}</nav>
  <div class="dock-right">
    <a class="logos-btn logos-btn--download" href="${DOWNLOAD}">Download</a>
  </div>
</header>`;
}

function footerHtml(): string {
	const cookieLink = ANALYTICS_ENABLED
		? `<button type="button" class="footer-link" id="consent-manage">Cookie settings</button>`
		: '';
	return `<footer class="site-footer">
  <a class="gh-link" href="${GITHUB}" target="_blank" rel="noopener noreferrer" aria-label="Logos on GitHub">
    <svg viewBox="0 0 16 16" width="18" height="18" aria-hidden="true" fill="currentColor"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0 0 16 8c0-4.42-3.58-8-8-8Z"/></svg>
    <span>GitHub</span>
  </a>
  <nav class="footer-links" aria-label="Legal">
    <a class="footer-link" href="/privacy/">Privacy &amp; Cookies</a>${cookieLink}
  </nav>
</footer>`;
}

// The consent banner: hidden until the client decides (no stored choice -> show).
// Accept loads Clarity + GA4; Reject loads nothing. Rendered on every page so the
// choice is offered everywhere, including docs pages that omit the footer.
function consentBannerHtml(): string {
	return `<div class="consent" id="consent-banner" role="dialog" aria-label="Cookie consent" aria-live="polite" hidden>
  <p class="consent__text">We'd like to use cookies for analytics (Microsoft Clarity and Google Analytics) to see how the site is used. Nothing loads unless you accept. See our <a href="/privacy/">Privacy &amp; Cookies</a>.</p>
  <div class="consent__actions">
    <button type="button" class="logos-btn logos-btn--ghost" id="consent-reject">Reject</button>
    <button type="button" class="logos-btn logos-btn--download" id="consent-accept">Accept</button>
  </div>
</div>`;
}

// Inlined in <head> so the theme is applied before first paint (no flash). Default
// is always light; the choice is read from the `theme` cookie.
const THEME_INIT = `<script>(function(){try{var m=document.cookie.match('(?:^|; )theme=([^;]*)');document.documentElement.dataset.theme=(m&&decodeURIComponent(m[1])==='dark')?'dark':'light';}catch(e){document.documentElement.dataset.theme='light';}})();</script>`;

export interface PageOptions {
	title: string;
	description?: string;
	/** Active nav key, or '' for the home page. */
	active: string;
	/** Extra class on <body>. */
	bodyClass?: string;
	/** Inner HTML placed between the header and the footer. */
	main: string;
	/** Header style: the full floating dock (default) or none (docs own their logo). */
	header?: 'dock' | 'none';
	/** Whether to render the shared footer. */
	footer?: boolean;
	/** Absolute site path of this page (e.g. "/vision/"); used for canonical + og:url. */
	path?: string;
	/** Override the canonical path when it differs from `path` (e.g. docs permalinks). */
	canonical?: string;
	/** A schema.org object (or array) emitted as JSON-LD for machine extraction. */
	jsonLd?: object | object[];
}

export function page(opts: PageOptions): string {
	const desc = opts.description ?? DEFAULT_DESC;
	const title = opts.title === 'Λόγος' ? 'Λόγος' : `${opts.title} | Λόγος`;
	const header = opts.header === 'none' ? '' : dockHtml(opts.active);

	// Canonical / og:url: prefer an explicit canonical path, else this page's own
	// path. Emitted as an absolute URL so crawlers and social cards resolve it.
	const canonPath = opts.canonical ?? opts.path;
	const canonUrl = canonPath ? absUrl(canonPath) : null;
	const canonical = canonUrl ? `\n<link rel="canonical" href="${escapeHtml(canonUrl)}" />` : '';

	const ogImage = OG_IMAGE ? absUrl(OG_IMAGE) : null;
	const social =
		`\n<meta property="og:type" content="website" />` +
		`\n<meta property="og:site_name" content="${escapeHtml(SITE_NAME)}" />` +
		`\n<meta property="og:title" content="${escapeHtml(title)}" />` +
		`\n<meta property="og:description" content="${escapeHtml(desc)}" />` +
		(canonUrl ? `\n<meta property="og:url" content="${escapeHtml(canonUrl)}" />` : '') +
		(ogImage ? `\n<meta property="og:image" content="${escapeHtml(ogImage)}" />` : '') +
		`\n<meta name="twitter:card" content="${ogImage ? 'summary_large_image' : 'summary'}" />` +
		`\n<meta name="twitter:title" content="${escapeHtml(title)}" />` +
		`\n<meta name="twitter:description" content="${escapeHtml(desc)}" />` +
		(ogImage ? `\n<meta name="twitter:image" content="${escapeHtml(ogImage)}" />` : '');

	const jsonLd = opts.jsonLd
		? `\n<script type="application/ld+json">${JSON.stringify(opts.jsonLd).replace(/</g, '\\u003c')}</script>`
		: '';

	return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(title)}</title>
<meta name="description" content="${escapeHtml(desc)}" />
<link rel="icon" href="/favicon.svg" />${canonical}${social}
<link rel="stylesheet" href="/assets/theme.css" />${jsonLd}
${THEME_INIT}${ANALYTICS_CONFIG}
</head>
<body class="${opts.bodyClass ?? ''}">
${themeToggleHtml()}
${header}
<main class="page-main">
${opts.main}
</main>
${opts.footer === false ? '' : footerHtml()}
${ANALYTICS_ENABLED ? consentBannerHtml() : ''}
<script type="module" src="/assets/main.js"></script>
</body>
</html>`;
}
