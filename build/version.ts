// Docs versioning model (plain TS, no dependencies).
//
// Each version is a complete, self-contained tree on disk under `docs/vX.Y.Z/`. To
// cut a new version you copy the previous version's folder and edit/add/remove/
// restructure freely within it. The rules:
//
//   1. The selectable global versions are the `vX.Y.Z` folder names under docs/.
//   2. Viewing version G shows exactly the pages in `docs/vG/` (no cross-version
//      "effective snapshot" logic: a version's folder is already complete).
//   3. A page is identified across versions by its relative path (e.g.
//      "reference/operators"). The same path in another version is "the same page";
//      if a version lacks that path, the page simply does not exist there.
//   4. Links are version-less (they name a path); they resolve within the version
//      being viewed.

export interface SemVer {
	major: number;
	minor: number;
	patch: number;
}

/** One documentation page within a single version's tree. */
export interface DocPage {
	/** Path relative to the version folder, using "/", e.g. "reference/operators". */
	path: string;
	/** Display title (frontmatter title, else derived from the path). */
	title: string;
}

/** One version's complete page tree. */
export interface VersionTree {
	version: SemVer;
	/** Canonical "X.Y.Z" string. */
	versionStr: string;
	/** Pages in this version, sorted ascending by path. */
	pages: DocPage[];
}

const VERSION_DIR_RE = /^v(\d+)\.(\d+)\.(\d+)$/;

/** Parse a `vX.Y.Z` version-folder name. Returns null if it does not match. */
export function parseVersionDir(name: string): SemVer | null {
	const m = VERSION_DIR_RE.exec(name);
	if (!m) return null;
	return { major: Number(m[1]), minor: Number(m[2]), patch: Number(m[3]) };
}

export function versionToString(v: SemVer): string {
	return `${v.major}.${v.minor}.${v.patch}`;
}

/** Parse an "X.Y.Z" string into a SemVer (used to rehydrate the manifest). */
export function parseVersionString(s: string): SemVer {
	const m = /^(\d+)\.(\d+)\.(\d+)$/.exec(s);
	if (!m) throw new Error(`invalid version string: ${s}`);
	return { major: Number(m[1]), minor: Number(m[2]), patch: Number(m[3]) };
}

/** Standard semver-ish ordering over X.Y.Z. */
export function compareVersions(a: SemVer, b: SemVer): number {
	return a.major - b.major || a.minor - b.minor || a.patch - b.patch;
}

/** The trees sorted ascending by version (a copy; input is not mutated). */
export function sortVersions(trees: VersionTree[]): VersionTree[] {
	return [...trees].sort((a, b) => compareVersions(a.version, b.version));
}

/** All version strings, ascending. The newest is the current docs version. */
export function globalVersionStrings(trees: VersionTree[]): string[] {
	return sortVersions(trees).map((t) => t.versionStr);
}

/** The newest version's tree (the default selection), or null if there are none. */
export function latestTree(trees: VersionTree[]): VersionTree | null {
	const sorted = sortVersions(trees);
	return sorted.length ? sorted[sorted.length - 1]! : null;
}

/** The page at `path` in a version, or undefined if that version lacks it. */
export function findPage(tree: VersionTree, path: string): DocPage | undefined {
	return tree.pages.find((p) => p.path === path);
}

/** A version's landing page (its first page by sort order), or undefined if empty. */
export function firstPage(tree: VersionTree): DocPage | undefined {
	return tree.pages[0];
}

/**
 * For the per-page version arrows: the nearest older and nearest newer version that
 * also contain `path`. Returns version strings (or null when none in that direction).
 */
export function adjacentVersions(
	trees: VersionTree[],
	currentVersionStr: string,
	path: string
): { prev: string | null; next: string | null } {
	const sorted = sortVersions(trees);
	const idx = sorted.findIndex((t) => t.versionStr === currentVersionStr);
	let prev: string | null = null;
	let next: string | null = null;
	if (idx === -1) return { prev, next };
	for (let i = idx - 1; i >= 0; i--) {
		if (findPage(sorted[i]!, path)) {
			prev = sorted[i]!.versionStr;
			break;
		}
	}
	for (let i = idx + 1; i < sorted.length; i++) {
		if (findPage(sorted[i]!, path)) {
			next = sorted[i]!.versionStr;
			break;
		}
	}
	return { prev, next };
}
