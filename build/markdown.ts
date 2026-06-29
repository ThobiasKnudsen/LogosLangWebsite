// Markdown -> HTML for docs, with Shiki code highlighting (dual light/dark theme)
// and version-less link resolution. Typographer is OFF on purpose: we never want
// markdown turning "--" into an en/em dash.
import MarkdownIt from 'markdown-it';
import Shiki from '@shikijs/markdown-it';

export interface RenderEnv {
	/** Directory of the current section, relative to the docs root ("" at root). */
	currentDir: string;
	/** Set of all known section ids, for resolving internal links. */
	sectionIds: Set<string>;
}

let mdPromise: Promise<MarkdownIt> | null = null;

async function getMd(): Promise<MarkdownIt> {
	const md = MarkdownIt({ html: true, linkify: true, typographer: false });
	md.use(
		await Shiki({
			themes: { light: 'github-light', dark: 'github-dark' },
			defaultColor: false, // emit CSS variables so we can switch on [data-theme]
			// `logos` has no grammar yet; render it (and any unknown fence) as plain
			// text. 'text' is a valid special language at runtime but outside Shiki's
			// BundledLanguage type, so the options are cast.
			fallbackLanguage: 'text' as never,
		})
	);

	// Resolve internal links: a relative href that names a known section becomes a
	// real docs URL (/docs/<sectionId>/); everything else is left untouched.
	const defaultLinkOpen =
		md.renderer.rules.link_open ??
		((tokens, idx, options, env, self) => self.renderToken(tokens, idx, options));
	md.renderer.rules.link_open = (tokens, idx, options, env, self) => {
		const token = tokens[idx]!;
		const hrefIdx = token.attrIndex('href');
		if (hrefIdx >= 0) {
			const attr = token.attrs![hrefIdx]!;
			const resolved = resolveDocLink(attr[1], env as RenderEnv);
			if (resolved) attr[1] = resolved;
		}
		return defaultLinkOpen(tokens, idx, options, env, self);
	};

	return md;
}

/** Resolve a version-less internal link to a `/docs/<sectionId>/` URL, or null. */
function resolveDocLink(href: string, env: RenderEnv): string | null {
	if (!href || /^(?:[a-z]+:|#|\/\/)/i.test(href) || href.startsWith('/')) return null;

	// Drop a trailing slash, a `.md` extension, and any in-page anchor.
	let path = href.replace(/#.*$/, '').replace(/\/$/, '').replace(/\.md$/i, '');
	if (!path) return null;

	const baseSegments = env.currentDir ? env.currentDir.split('/') : [];
	const segments = [...baseSegments];
	for (const part of path.split('/')) {
		if (part === '' || part === '.') continue;
		if (part === '..') segments.pop();
		else segments.push(part);
	}
	const id = segments.join('/');
	return env.sectionIds.has(id) ? `/docs/${id}/` : null;
}

export interface ParsedDoc {
	title: string | null;
	body: string;
}

/** Pull an optional `--- title: ... ---` frontmatter block off the top. */
export function parseFrontmatter(source: string): ParsedDoc {
	if (!source.startsWith('---')) return { title: null, body: source };
	const end = source.indexOf('\n---', 3);
	if (end === -1) return { title: null, body: source };
	const block = source.slice(3, end);
	const rest = source.slice(end + 4).replace(/^\r?\n/, '');
	let title: string | null = null;
	for (const line of block.split('\n')) {
		const m = /^\s*title:\s*(.+?)\s*$/.exec(line);
		if (m) title = m[1]!.replace(/^['"]|['"]$/g, '');
	}
	return { title, body: rest };
}

/** Render one markdown document to HTML, resolving its internal links. */
export async function renderMarkdown(
	source: string,
	currentDir: string,
	sectionIds: Set<string>
): Promise<{ title: string | null; html: string }> {
	const md = await (mdPromise ??= getMd());
	const { title, body } = parseFrontmatter(source);
	const env: RenderEnv = { currentDir, sectionIds };
	const html = md.render(body, env);
	return { title, html };
}
