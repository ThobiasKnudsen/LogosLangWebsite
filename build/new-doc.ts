// Scaffolds a new docs snapshot file with the correct version prefix, so authors
// don't have to hand-name `vX.Y.Z_name.md` and risk tripping the CI guard.
//
//   npm run new-doc -- <dir/name> [version]
//
// Examples:
//   npm run new-doc -- reference/operators            # picks the in-progress version
//   npm run new-doc -- guides/internals/logic-graph   # nested folders are fine
//   npm run new-doc -- getting-started/intro 0.1.0    # pin the version explicitly
//
// The default version is the one new docs *should* carry: the current in-progress
// line (the newest prefix already in content/docs that is past the last release), or
// one patch above the last release if work hasn't started, or 0.0.1 for a fresh repo.
// You can always rename the file afterwards (e.g. for a minor/major bump); CI checks
// the name is valid and, at release time, that every in-progress doc matches the
// version being released.

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
	parseFilename,
	parseVersionString,
	versionToString,
	compareVersions,
	type SemVer,
} from './version.ts';

export function bumpPatch(v: SemVer): SemVer {
	return { major: v.major, minor: v.minor, patch: v.patch + 1 };
}

/**
 * The version a brand-new doc should default to: the current in-progress line (the
 * newest prefix already past the last release R), else one patch above R, else 0.0.1.
 * Pure — unit-tested in new-doc.test.ts.
 */
export function pickDefaultVersion(R: SemVer | null, fileVersions: SemVer[]): SemVer {
	let inProgress: SemVer | null = null;
	for (const v of fileVersions) {
		if (R && compareVersions(v, R) <= 0) continue; // frozen line, ignore
		if (!inProgress || compareVersions(v, inProgress) > 0) inProgress = v;
	}
	if (inProgress) return inProgress;
	if (R) return bumpPatch(R);
	return { major: 0, minor: 0, patch: 1 };
}

function prettify(name: string): string {
	return name.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

// ── CLI ───────────────────────────────────────────────────────────────────────

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DOCS_DIR = path.join(ROOT, 'content/docs');

function latestReleaseTag(): SemVer | null {
	let raw: string;
	try {
		raw = execFileSync('git', ['tag', '--list', 'v*.*.*'], { cwd: ROOT, encoding: 'utf8' });
	} catch {
		return null;
	}
	let best: SemVer | null = null;
	for (const line of raw.split('\n')) {
		const tag = line.trim();
		if (!/^v\d+\.\d+\.\d+$/.test(tag)) continue;
		const v = parseVersionString(tag.slice(1));
		if (!best || compareVersions(v, best) > 0) best = v;
	}
	return best;
}

function docVersions(dir: string): SemVer[] {
	const out: SemVer[] = [];
	let entries: fs.Dirent[];
	try {
		entries = fs.readdirSync(dir, { withFileTypes: true });
	} catch {
		return out;
	}
	for (const entry of entries) {
		const full = path.join(dir, entry.name);
		if (entry.isDirectory()) out.push(...docVersions(full));
		else if (entry.isFile() && entry.name.endsWith('.md')) {
			const parsed = parseFilename(entry.name);
			if (parsed) out.push(parsed.version);
		}
	}
	return out;
}

function fail(message: string): never {
	console.error(`✗ ${message}`);
	process.exit(1);
}

function main(): void {
	const [rawTarget, rawVersion] = process.argv.slice(2);
	if (!rawTarget) {
		console.error('usage: npm run new-doc -- <dir/name> [version]');
		process.exit(2);
	}

	// Split "<dir>/<name>", tolerate a trailing .md or a stray version prefix.
	const cleaned = rawTarget.replace(/\.md$/, '');
	const slash = cleaned.lastIndexOf('/');
	const dir = slash === -1 ? '' : cleaned.slice(0, slash);
	const name = (slash === -1 ? cleaned : cleaned.slice(slash + 1)).trim();
	if (!name) fail(`could not read a doc name from "${rawTarget}" (expected <dir/name>).`);
	if (/^v\d+\.\d+\.\d+_/.test(name)) {
		fail(`give the name without a version prefix; the version is added for you (got "${name}").`);
	}

	const R = latestReleaseTag();

	let version: SemVer;
	let defaulted = false;
	if (rawVersion) {
		if (!/^v?\d+\.\d+\.\d+$/.test(rawVersion)) fail(`"${rawVersion}" is not a version (expected X.Y.Z).`);
		version = parseVersionString(rawVersion.replace(/^v/, ''));
		if (R && compareVersions(version, R) <= 0) {
			fail(`v${versionToString(version)} is already released (<= v${versionToString(R)}); new docs must target a newer version.`);
		}
	} else {
		version = pickDefaultVersion(R, docVersions(DOCS_DIR));
		defaulted = true;
	}

	const ver = versionToString(version);
	const fileName = `v${ver}_${name}.md`;
	const relPath = path.join('content/docs', dir, fileName);
	const absPath = path.join(ROOT, relPath);

	// Sanity: the name we built must round-trip through the model's parser.
	if (!parseFilename(fileName)) fail(`"${fileName}" is not a valid snapshot filename.`);
	if (fs.existsSync(absPath)) fail(`${relPath} already exists; refusing to overwrite.`);

	const title = prettify(name);
	const body = `---\ntitle: ${title}\n---\n\n# ${title}\n\n`;
	fs.mkdirSync(path.dirname(absPath), { recursive: true });
	fs.writeFileSync(absPath, body);

	console.log(`✓ created ${relPath}`);
	console.log(`  version v${ver}${R ? ` (last released v${versionToString(R)})` : ' (no releases tagged yet)'}`);
	if (defaulted) {
		console.log(`  ↳ defaulted to the in-progress version. For a minor/major bump, rename the prefix`);
		console.log(`    or re-run with an explicit version, e.g. \`npm run new-doc -- ${rawTarget} 0.${version.minor + 1}.0\`.`);
	}
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
	main();
}
