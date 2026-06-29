// Docs versioning model (plain TS, no dependencies).
//
// Files are named `vX.Y.Z_name.md`, where the prefix is the version at which that
// file's content last changed. A "section" is one logical page, identified by its
// folder path plus `name` (version stripped); it owns the set of snapshot files
// that share that identity. The agreed rules:
//
//   1. The selectable global versions are derived from the file prefixes (the
//      sorted union of every vX.Y.Z that appears on any file).
//   2. At a global version G, a section shows its "effective" snapshot: the latest
//      snapshot whose version is <= G. (Usually < G.)
//   3. Left/right browse the section's FULL history; whenever the viewed snapshot
//      is not the effective one, the UI shows an orange warning naming the version
//      that *would* be correct at G.
//   4. A section is hidden at any G earlier than its first snapshot (it did not
//      exist yet).
//   5. Links are version-less (they name a section); they resolve to that
//      section's effective snapshot at the current G.

export interface SemVer {
	major: number;
	minor: number;
	patch: number;
}

export interface Snapshot {
	/** Parsed version of this snapshot. */
	version: SemVer;
	/** Canonical "X.Y.Z" string. */
	versionStr: string;
	/** Source file path relative to the docs root, e.g. "reference/v0.4.0_operators.md". */
	file: string;
}

export interface Section {
	/** Version-less identity: folder path + name, e.g. "reference/operators". */
	id: string;
	/** Containing folder relative to the docs root, e.g. "reference" ("" at root). */
	dir: string;
	/** Display name with the version prefix stripped, e.g. "operators". */
	name: string;
	/** Snapshots sorted ascending by version. */
	snapshots: Snapshot[];
}

const FILENAME_RE = /^v(\d+)\.(\d+)\.(\d+)_(.+)\.md$/;

/** Parse a `vX.Y.Z_name.md` filename. Returns null if it does not match. */
export function parseFilename(filename: string): { version: SemVer; name: string } | null {
	const m = FILENAME_RE.exec(filename);
	if (!m) return null;
	return {
		version: { major: Number(m[1]), minor: Number(m[2]), patch: Number(m[3]) },
		name: m[4]!,
	};
}

export function versionToString(v: SemVer): string {
	return `${v.major}.${v.minor}.${v.patch}`;
}

/** Parse an "X.Y.Z" string back into a SemVer (used to rehydrate the manifest). */
export function parseVersionString(s: string): SemVer {
	const m = /^(\d+)\.(\d+)\.(\d+)$/.exec(s);
	if (!m) throw new Error(`invalid version string: ${s}`);
	return { major: Number(m[1]), minor: Number(m[2]), patch: Number(m[3]) };
}

/** Standard semver-ish ordering over X.Y.Z. */
export function compareVersions(a: SemVer, b: SemVer): number {
	return a.major - b.major || a.minor - b.minor || a.patch - b.patch;
}

/** Join a directory and name into a section id (no leading slash). */
function joinId(dir: string, name: string): string {
	return dir ? `${dir}/${name}` : name;
}

/**
 * Group a flat list of docs file paths (relative to the docs root, using "/")
 * into sections, each with its snapshots sorted ascending. Files that do not
 * match the `vX.Y.Z_name.md` pattern are ignored.
 */
export function buildSections(files: string[]): Section[] {
	const byId = new Map<string, Section>();

	for (const file of files) {
		const slash = file.lastIndexOf('/');
		const dir = slash === -1 ? '' : file.slice(0, slash);
		const base = slash === -1 ? file : file.slice(slash + 1);
		const parsed = parseFilename(base);
		if (!parsed) continue;

		const id = joinId(dir, parsed.name);
		let section = byId.get(id);
		if (!section) {
			section = { id, dir, name: parsed.name, snapshots: [] };
			byId.set(id, section);
		}
		section.snapshots.push({
			version: parsed.version,
			versionStr: versionToString(parsed.version),
			file,
		});
	}

	const sections = [...byId.values()];
	for (const section of sections) {
		section.snapshots.sort((a, b) => compareVersions(a.version, b.version));
	}
	sections.sort((a, b) => a.id.localeCompare(b.id));
	return sections;
}

/**
 * The sorted (ascending) list of distinct global versions, derived from every
 * snapshot prefix across all sections. The newest is the current docs version.
 */
export function globalVersions(sections: Section[]): SemVer[] {
	const seen = new Map<string, SemVer>();
	for (const section of sections) {
		for (const snap of section.snapshots) {
			seen.set(snap.versionStr, snap.version);
		}
	}
	return [...seen.values()].sort(compareVersions);
}

/** The newest global version (the default selection), or null if there are none. */
export function latestVersion(sections: Section[]): SemVer | null {
	const all = globalVersions(sections);
	return all.length ? all[all.length - 1]! : null;
}

/**
 * The effective snapshot for a section at global version G: the latest snapshot
 * whose version is <= G. Returns null when the section did not exist yet at G
 * (its first snapshot is newer than G), in which case the section is hidden.
 */
export function effectiveSnapshot(section: Section, global: SemVer): Snapshot | null {
	let best: Snapshot | null = null;
	for (const snap of section.snapshots) {
		if (compareVersions(snap.version, global) <= 0) best = snap;
		else break; // snapshots are ascending; nothing further can qualify
	}
	return best;
}

/** Sections visible at global version G (those with an effective snapshot). */
export function visibleSections(sections: Section[], global: SemVer): Section[] {
	return sections.filter((s) => effectiveSnapshot(s, global) !== null);
}

export interface ViewState {
	/** The snapshot currently being viewed. */
	current: Snapshot;
	/** Previous (older) snapshot in this section, if any. */
	prev: Snapshot | null;
	/** Next (newer) snapshot in this section, if any. */
	next: Snapshot | null;
	/** The snapshot that is correct at the current global version (may be null pre-existence). */
	effective: Snapshot | null;
	/** True when `current` is not the effective snapshot, so a warning should show. */
	offEffective: boolean;
}

/**
 * Resolve the view for a section at global version G, viewing a specific snapshot
 * version. If `viewedVersion` is omitted (or not found), defaults to the effective
 * snapshot. Returns null only when the section has no snapshots at all.
 */
export function resolveView(
	section: Section,
	global: SemVer,
	viewedVersion?: SemVer
): ViewState | null {
	if (section.snapshots.length === 0) return null;

	const effective = effectiveSnapshot(section, global);
	let index = -1;
	if (viewedVersion) {
		index = section.snapshots.findIndex(
			(s) => compareVersions(s.version, viewedVersion) === 0
		);
	}
	if (index === -1) {
		index = effective
			? section.snapshots.findIndex((s) => s === effective)
			: 0; // pre-existence: fall back to the earliest snapshot
	}

	const current = section.snapshots[index]!;
	return {
		current,
		prev: index > 0 ? section.snapshots[index - 1]! : null,
		next: index < section.snapshots.length - 1 ? section.snapshots[index + 1]! : null,
		effective,
		offEffective: !effective || current !== effective,
	};
}
