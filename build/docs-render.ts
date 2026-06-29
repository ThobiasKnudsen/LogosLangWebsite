// Server-side rendering of a single docs page: the file tree, the per-section
// version nav, and the article. Uses the same version model as the client, so the
// static pages and the client hydration cannot disagree.
import {
	type Section,
	type SemVer,
	versionToString,
	visibleSections,
	effectiveSnapshot,
	resolveView,
} from './version.ts';
import { escapeHtml } from './templates.ts';

const CHEV_LEFT = `<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="10 3 5 8 10 13"/></svg>`;
const CHEV_RIGHT = `<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="6 3 11 8 6 13"/></svg>`;
const CHEV_DOWN = `<svg class="tree-chev" viewBox="0 0 16 16" width="11" height="11" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="4 6 8 10 12 6"/></svg>`;

function prettify(seg: string): string {
	return seg.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

interface TreeNode {
	label: string;
	children: Map<string, TreeNode>;
	section?: Section;
}

export interface DocsRenderInput {
	/** All sections in the docs. */
	sections: Section[];
	/** Global version context this page represents. */
	global: SemVer;
	/** True when `global` is the newest version (links go to canonical URLs). */
	isLatestGlobal: boolean;
	/** Section being viewed. */
	currentId: string;
	/** Snapshot version shown in the article. */
	viewedVersion: SemVer;
	/** Resolve a snapshot's display title. */
	titleOf: (id: string, ver: string) => string;
	/** Resolve a snapshot's rendered HTML. */
	htmlOf: (id: string, ver: string) => string;
	/** Every global version, ascending, as "X.Y.Z" strings. */
	versions: string[];
}

/** URL of a section at a global version: canonical when latest, else the permalink. */
function linkFor(section: Section, input: DocsRenderInput): string {
	if (input.isLatestGlobal) return `/docs/${section.id}/`;
	const eff = effectiveSnapshot(section, input.global);
	return eff ? `/docs/${section.id}/v${eff.versionStr}/` : `/docs/${section.id}/`;
}

function buildTree(sections: Section[], global: SemVer): TreeNode {
	const root: TreeNode = { label: '', children: new Map() };
	for (const section of visibleSections(sections, global)) {
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
		const leaf = parts[parts.length - 1]!;
		node.children.set(leaf, { label: section.name, children: new Map(), section });
	}
	return root;
}

function renderNode(node: TreeNode, input: DocsRenderInput, nested: boolean): string {
	const entries = [...node.children.values()].sort((a, b) => {
		const af = a.section ? 1 : 0;
		const bf = b.section ? 1 : 0;
		if (af !== bf) return af - bf; // folders first
		return a.label.localeCompare(b.label);
	});
	const items = entries
		.map((child) => {
			if (child.section) {
				const eff = effectiveSnapshot(child.section, input.global);
				const label = eff ? input.titleOf(child.section.id, eff.versionStr) : child.label;
				const ver = eff ? `<span class="tree-ver">v${eff.versionStr}</span>` : '';
				const active = child.section.id === input.currentId ? ' active' : '';
				return `<li><a class="tree-link${active}" href="${linkFor(child.section, input)}">${escapeHtml(label)}${ver}</a></li>`;
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
	const section = input.sections.find((s) => s.id === input.currentId);
	if (!section) throw new Error(`unknown section: ${input.currentId}`);
	const view = resolveView(section, input.global, input.viewedVersion);
	if (!view) throw new Error(`section has no snapshots: ${input.currentId}`);

	const cur = view.current;
	const gStr = versionToString(input.global);
	const article = input.htmlOf(section.id, cur.versionStr);
	const tree = renderNode(buildTree(input.sections, input.global), input, false);

	const prev = view.prev
		? `<a class="docs-snapnav__btn" href="/docs/${section.id}/v${view.prev.versionStr}/" aria-label="Older version">${CHEV_LEFT}</a>`
		: `<span class="docs-snapnav__btn" aria-disabled="true">${CHEV_LEFT}</span>`;
	const next = view.next
		? `<a class="docs-snapnav__btn" href="/docs/${section.id}/v${view.next.versionStr}/" aria-label="Newer version">${CHEV_RIGHT}</a>`
		: `<span class="docs-snapnav__btn" aria-disabled="true">${CHEV_RIGHT}</span>`;

	// The warning is always emitted (hidden when on-version) so the client can
	// retoggle it when a different global version is selected.
	const off = view.offEffective && view.effective;
	const correctHref = view.effective ? `/docs/${section.id}/v${view.effective.versionStr}/` : '';
	const correctText = view.effective ? `At ${gStr}, this page is v${view.effective.versionStr}.` : '';
	const offClass = off ? ' off' : '';
	const correct = `<a class="docs-correct" id="docs-correct" href="${correctHref}"${off ? '' : ' hidden'}>${correctText}</a>`;

	return `<div class="docs" id="docs-app" data-section="${section.id}" data-version="${cur.versionStr}" data-global="${gStr}">
  <aside class="docs-sidebar">
    <a class="docs-logo" href="/" aria-label="Logos home">Λόγος</a>
    <div class="docs-controls">
      <div class="docs-version">
        <label class="docs-version__label" for="docs-global-version">Version</label>
        ${versionSelect(input.versions, gStr)}
      </div>
    </div>
    <nav class="docs-tree" id="docs-tree" aria-label="Documentation">${tree}</nav>
  </aside>
  <div class="docs-resizer" id="docs-resizer" role="separator" aria-orientation="vertical" aria-label="Resize sidebar"></div>
  <div class="docs-main">
    <div class="docs-topbar" id="docs-snapnav">
      <div class="docs-snapnav__group${offClass}" id="docs-snapnav-group">
        ${prev}
        <span class="docs-snapnav__ver" id="docs-snapver">v${cur.versionStr}</span>
        ${next}
      </div>
      ${correct}
    </div>
    <article class="docs-content markdown" id="docs-content">${article}</article>
  </div>
</div>`;
}
