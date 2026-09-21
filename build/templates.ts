// Static HTML templates shared by every page: the menu dock, the page margins, the
// footer, and the full-document shell.
import { wisdomMarginsHtml } from './wisdom.ts';

const GITHUB = 'https://github.com/ThobiasKnudsen/LogosLang';

// Absolute production origin, used for canonical URLs, Open Graph / Twitter tags,
// the sitemap, and llms.txt. Overridable for local or preview builds via
// `SITE_URL=...`, but it must be an absolute https origin in production: pointing
// canonicals at localhost would tell crawlers the real page lives there.
export const SITE_URL = (process.env.SITE_URL || 'https://logoslang.dev').replace(/\/$/, '');
// Social preview card (1200x630). Served from /public. Leave '' to omit og:image.
export const OG_IMAGE = '/og.png';
const SITE_NAME = 'Logos';
const DEFAULT_DESC = 'Logos: the maximally meta programming language. Program, types, proofs, grammar and compiler are one graph that code can read and redefine, with every change checked.';

// Hashed asset URLs, set by the build after bundling (build/build.ts) so a fresh
// deploy never serves stale CSS/JS from a cached fixed filename. Defaults are the
// unhashed names so anything calling page() without a build still resolves.
let ASSET_CSS = '/assets/theme.css';
let ASSET_JS = '/assets/main.js';
export function setAssetUrls(cssHref: string, jsHref: string): void {
	ASSET_CSS = cssHref;
	ASSET_JS = jsHref;
}

// Analytics is first-party and cookieless: the client beacon (initAnalytics in
// client/main.ts) posts to the /api/collect Pages Function. Nothing is injected into the
// shell and no third-party script loads, so there is no build-time analytics config.

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

// Playground is deliberately absent until a release ships a runnable WASM build:
// the page still builds and stays reachable by URL, but the nav does not advertise
// an empty room. Re-add { key: 'playground', label: 'Playground', href:
// '/playground/' } when real in-browser execution lands.
const NAV = [
	{ key: 'vision', label: 'Vision', href: '/vision/' },
	{ key: 'roadmap', label: 'Roadmap', href: '/roadmap/' },
	{ key: 'examples', label: 'Examples', href: '/examples/' },
	{ key: 'docs', label: 'Docs', href: '/docs/' },
	{ key: 'about', label: 'About', href: '/about/' },
];

const MENU_SVG = `<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><g stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="4" y1="7" x2="20" y2="7"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="17" x2="20" y2="17"/></g></svg>`;

// The GitHub mark (octocat), shared by the dock button, the dropdown row, and the
// footer link. Fills with currentColor so each spot's text colour applies.
const GITHUB_SVG = `<svg viewBox="0 0 16 16" width="18" height="18" aria-hidden="true" fill="currentColor"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0 0 16 8c0-4.42-3.58-8-8-8Z"/></svg>`;

// Social marks for the footer, filled with currentColor so the link colour applies.
const LINKEDIN_SVG = `<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="currentColor"><path d="M20.45 20.45h-3.56v-5.57c0-1.33-.03-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.35V9h3.42v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28zM5.34 7.43a2.07 2.07 0 1 1 0-4.13 2.07 2.07 0 0 1 0 4.13zM7.12 20.45H3.56V9h3.56v11.45zM22.22 0H1.77C.79 0 0 .77 0 1.73v20.54C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.73V1.73C24 .77 23.2 0 22.22 0z"/></svg>`;
const X_SVG = `<svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24h-6.657l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>`;
const MAIL_SVG = `<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="currentColor"><path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4-8 5-8-5V6l8 5 8-5v2z"/></svg>`;

function dockHtml(active: string): string {
	const links = NAV.map(
		(n) =>
			`<a class="nav-link${n.key === active ? ' active' : ''}" href="${n.href}"${
				n.key === active ? ' aria-current="page"' : ''
			}>${n.label}</a>`
	).join('');

	// The same links appear inline on wide screens (.nav) and inside the collapsed
	// dropdown (.nav-menu) on narrow ones, where the hamburger button toggles them.
	// The dock's styled button is Download, with the GitHub mark as its own small
	// link just left of it (Thobias, 22 September 2026; the button was GitHub while
	// no public builds existed, from 26 August until then). At phone widths the
	// styled button hides and the dropdown's Download row takes over; the mark
	// stays (see theme.css). The dock floats inside the page column, between the
	// two margin lines.
	return `<header class="dock">
  <div class="dock__row">
    <a class="wordmark" href="/" aria-label="Logos home">Λόγος</a>
    <nav class="nav" aria-label="Primary">${links}</nav>
    <div class="dock-right">
      <div class="nav-burger">
        <button class="nav-toggle" type="button" aria-label="Menu" aria-expanded="false" aria-controls="nav-menu">${MENU_SVG}</button>
        <nav class="nav-menu" id="nav-menu" aria-label="Primary" hidden>${links}<a class="nav-link nav-menu__download" href="/download/">Download</a></nav>
      </div>
      <a class="dock-github" href="${GITHUB}" target="_blank" rel="noopener noreferrer" aria-label="Logos on GitHub" title="GitHub">${GITHUB_SVG}</a>
      <a class="logos-btn logos-btn--download dock-download" href="/download/">Download</a>
    </div>
  </div>
</header>`;
}

// The two outer margins beside the page column, each drawn by one hairline the
// full height of the page, on every page with a menu bar, hidden on narrow windows
// (theme.css). They hold the quotes, stacked down each side (build/wisdom.ts).
function marginsHtml(): string {
	return wisdomMarginsHtml();
}

function footerHtml(): string {
	return `<footer class="site-footer">
  <div class="footer-social">
    <a href="https://github.com/ThobiasKnudsen" target="_blank" rel="noopener noreferrer" aria-label="GitHub">${GITHUB_SVG}</a>
    <a href="https://no.linkedin.com/in/thobias-melfjord-knudsen-510084320" target="_blank" rel="noopener noreferrer" aria-label="LinkedIn">${LINKEDIN_SVG}</a>
    <a href="https://x.com/thobknu" target="_blank" rel="noopener noreferrer" aria-label="X">${X_SVG}</a>
    <a href="mailto:thobknu@gmail.com" aria-label="Email">${MAIL_SVG}</a>
  </div>
  <nav class="footer-links" aria-label="Legal">
    <a class="footer-link" href="/privacy/">Privacy &amp; Cookies</a>
  </nav>
</footer>`;
}

// The site is dark only, for now (Thobias, 22 September 2026): <html> carries
// data-theme="dark" and there is no toggle. Until then a light default with a
// theme cookie and a pre-paint script chose between the two; the light tokens are
// still in theme.css for when the choice comes back.
export const THEME = 'dark';

export interface PageOptions {
	title: string;
	description?: string;
	/** Active nav key, or '' for the home page. */
	active: string;
	/** Extra class on <body>. */
	bodyClass?: string;
	/** Inner HTML placed between the header and the footer. */
	main: string;
	/** Header style: the menu bar plus the page margins (default) or none (docs own
	 *  their logo and their own full-width layout). */
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
	const chrome = opts.header === 'none' ? '' : `${dockHtml(opts.active)}\n${marginsHtml()}`;

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
<html lang="en" data-theme="${THEME}">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(title)}</title>
<meta name="description" content="${escapeHtml(desc)}" />
<link rel="icon" href="/favicon.svg" />${canonical}${social}
<link rel="stylesheet" href="${ASSET_CSS}" />${jsonLd}
</head>
<body class="${opts.bodyClass ?? ''}">
${chrome}
<main class="page-main">
${opts.main}
</main>
${opts.footer === false ? '' : footerHtml()}
<script type="module" src="${ASSET_JS}"></script>
</body>
</html>`;
}
