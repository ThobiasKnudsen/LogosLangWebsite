// Server-side rendering of a single docs page: the file tree, the per-page version
// nav, and the article. Uses the same version model as the client, so the static
// pages and the client hydration cannot disagree. Each version is a complete tree,
// so there is no "effective snapshot" logic: we render the selected version directly.
import { type VersionTree, sortVersions, adjacentVersions } from './version.ts';
import { escapeHtml } from './templates.ts';

const CHEV_LEFT = `<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="10 3 5 8 10 13"/></svg>`;
const CHEV_RIGHT = `<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="6 3 11 8 6 13"/></svg>`;
const CHEV_DOWN = `<svg class="tree-chev" viewBox="0 0 16 16" width="11" height="11" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="4 6 8 10 12 6"/></svg>`;

function prettify(seg: string): string {
	return seg.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

interface Leaf {
	path: string;
	title: string;
}
interface TreeNode {
	label: string;
	children: Map<string, TreeNode>;
	leaf?: Leaf;
}

export interface DocsRenderInput {
	/** All versions, for the per-page version arrows. */
	trees: VersionTree[];
	/** The version this page belongs to, e.g. "0.0.2". */
	versionStr: string;
	/** Whether `versionStr` is the newest version (links go to canonical URLs). */
	isLatest: boolean;
	/** Page path within the version, e.g. "reference/operators". */
	currentPath: string;
	/** Rendered article HTML. */
	html: string;
	/** Every version, ascending, as "X.Y.Z" strings (for the picker). */
	versions: string[];
	/** The newest version string, to build canonical hrefs for the arrows. */
	latestStr: string | null;
}

/** A page's URL at a given version: canonical for the latest, else versioned. */
function pageHref(versionStr: string, pagePath: string, latestStr: string | null): string {
	return versionStr === latestStr ? `/docs/${pagePath}/` : `/docs/v${versionStr}/${pagePath}/`;
}

function buildTree(tree: VersionTree): TreeNode {
	const root: TreeNode = { label: '', children: new Map() };
	for (const pg of tree.pages) {
		const parts = pg.path.split('/');
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
		const leafKey = parts[parts.length - 1]!;
		node.children.set(leafKey, {
			label: pg.title,
			children: new Map(),
			leaf: { path: pg.path, title: pg.title },
		});
	}
	return root;
}

function renderNode(node: TreeNode, input: DocsRenderInput, nested: boolean): string {
	const entries = [...node.children.values()].sort((a, b) => {
		const af = a.leaf ? 1 : 0;
		const bf = b.leaf ? 1 : 0;
		if (af !== bf) return af - bf; // folders first
		return a.label.localeCompare(b.label);
	});
	const items = entries
		.map((child) => {
			if (child.leaf) {
				const href = pageHref(input.versionStr, child.leaf.path, input.latestStr);
				const active = child.leaf.path === input.currentPath ? ' active' : '';
				return `<li><a class="tree-link${active}" href="${href}">${escapeHtml(child.leaf.title)}</a></li>`;
			}
			return `<li><details open><summary class="tree-folder">${CHEV_DOWN}<span class="tree-folder__label">${escapeHtml(child.label)}</span></summary>${renderNode(child, input, true)}</details></li>`;
		})
		.join('');
	return `<ul class="tree${nested ? ' tree--nested' : ''}">${items}</ul>`;
}

function versionSelect(versions: string[], selected: string): string {
	const opts = versions
		.slice()
		.reverse()
		.map((v) => `<option value="${v}"${v === selected ? ' selected' : ''}>${v}</option>`)
		.join('');
	return `<select id="docs-global-version" class="docs-version__select">${opts}</select>`;
}

/** Render the inner `<main>` markup of one docs page (the `#docs-app` block). */
export function renderDocsMain(input: DocsRenderInput): string {
	const sorted = sortVersions(input.trees);
	const tree = sorted.find((t) => t.versionStr === input.versionStr);
	if (!tree) throw new Error(`unknown version: ${input.versionStr}`);

	const treeHtml = renderNode(buildTree(tree), input, false);
	const { prev, next } = adjacentVersions(sorted, input.versionStr, input.currentPath);

	// Arrows walk the SAME page across versions that contain it (older = prev).
	const prevBtn = prev
		? `<a class="docs-snapnav__btn" href="${pageHref(prev, input.currentPath, input.latestStr)}" aria-label="Older version">${CHEV_LEFT}</a>`
		: `<span class="docs-snapnav__btn" aria-disabled="true">${CHEV_LEFT}</span>`;
	const nextBtn = next
		? `<a class="docs-snapnav__btn" href="${pageHref(next, input.currentPath, input.latestStr)}" aria-label="Newer version">${CHEV_RIGHT}</a>`
		: `<span class="docs-snapnav__btn" aria-disabled="true">${CHEV_RIGHT}</span>`;

	return `<div class="docs" id="docs-app" data-path="${escapeHtml(input.currentPath)}" data-version="${input.versionStr}">
  <aside class="docs-sidebar">
    <a class="docs-logo" href="/" aria-label="Logos home">Λόγος</a>
    <div class="docs-controls">
      <div class="docs-version">
        <label class="docs-version__label" for="docs-global-version">Version</label>
        ${versionSelect(input.versions, input.versionStr)}
      </div>
    </div>
    <nav class="docs-tree" id="docs-tree" aria-label="Documentation">${treeHtml}</nav>
  </aside>
  <div class="docs-resizer" id="docs-resizer" role="separator" aria-orientation="vertical" aria-label="Resize sidebar"></div>
  <div class="docs-main">
    <div class="docs-topbar" id="docs-snapnav">
      <div class="docs-snapnav__group" id="docs-snapnav-group">
        ${prevBtn}
        <span class="docs-snapnav__ver" id="docs-snapver">v${input.versionStr}</span>
        ${nextBtn}
      </div>
    </div>
    <article class="docs-content markdown" id="docs-content">${input.html}</article>
  </div>
</div>`;
}
