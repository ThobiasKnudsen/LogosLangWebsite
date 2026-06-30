// CI guard for the docs versioning model (plain TS, runs under tsx).
//
// Two responsibilities, matching the agreed CI/CD design:
//
//   validate            (run on every pull request)
//     - Every file under content/docs carries a valid `vX.Y.Z_name.md` prefix.
//     - FREEZE: no snapshot whose version is <= R (the latest released version,
//       i.e. the newest `vX.Y.Z` tag on this repo) is added, modified, or deleted.
//     - FORWARD-ONLY: any changed snapshot must have a version > R, so writes only
//       ever land on the not-yet-released line.
//
//   release <version>   (run when LogosLang dispatches a `logoslang-release`)
//     - Every in-progress snapshot (version > R) must be named exactly <version>,
//       so the release that is about to be frozen is internally consistent. The
//       workflow then tags this repo `v<version>`, which advances R and freezes them.
//
// The pure functions below take plain arrays and are unit-tested in ci-check.test.ts;
// the CLI wrapper at the bottom gathers state from git/fs and calls them.

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

export type ChangeStatus = 'A' | 'M' | 'D';

export interface DiffEntry {
	status: ChangeStatus;
	/** Path relative to the docs root, using "/", e.g. "reference/v0.4.0_operators.md". */
	docsPath: string;
}

export interface Problem {
	/** Docs-root-relative path the problem concerns. */
	file: string;
	message: string;
}

/** Does a docs-root-relative filename carry a valid version prefix? */
function fileVersion(docsPath: string): SemVer | null {
	const base = docsPath.slice(docsPath.lastIndexOf('/') + 1);
	const parsed = parseFilename(base);
	return parsed ? parsed.version : null;
}

/**
 * Every doc must carry a valid `vX.Y.Z_name.md` prefix; unversioned files are
 * silently dropped by the site model, so we fail loudly instead.
 */
export function checkPrefixes(docsFiles: string[]): Problem[] {
	const problems: Problem[] = [];
	for (const file of docsFiles) {
		if (!fileVersion(file)) {
			problems.push({
				file,
				message: 'missing or invalid version prefix (expected vX.Y.Z_name.md)',
			});
		}
	}
	return problems;
}

/**
 * Freeze + forward-only guard over the diff between the latest release (R) and HEAD.
 * When R is null nothing has been released yet, so every snapshot is in-progress and
 * the guard is vacuous.
 */
export function checkDiff(entries: DiffEntry[], R: SemVer | null): Problem[] {
	const problems: Problem[] = [];
	if (!R) return problems;
	const rStr = versionToString(R);

	for (const entry of entries) {
		const version = fileVersion(entry.docsPath);
		if (!version) continue; // unversioned files are reported by checkPrefixes
		const frozen = compareVersions(version, R) <= 0;
		if (!frozen) continue; // in-progress line: edits are allowed

		const vStr = versionToString(version);
		if (entry.status === 'D') {
			problems.push({ file: entry.docsPath, message: `deletes frozen doc (v${vStr} <= released v${rStr})` });
		} else if (entry.status === 'M') {
			problems.push({ file: entry.docsPath, message: `modifies frozen doc (v${vStr} <= released v${rStr}); copy it to a newer version instead` });
		} else {
			problems.push({ file: entry.docsPath, message: `adds a doc to already-released version v${vStr} (<= released v${rStr})` });
		}
	}
	return problems;
}

/**
 * At release time every in-progress snapshot (version > R) must be named exactly the
 * version being released, so the frozen set is consistent.
 */
export function checkRelease(docsFiles: string[], R: SemVer | null, target: SemVer): Problem[] {
	const problems: Problem[] = [];
	const targetStr = versionToString(target);
	if (R && compareVersions(target, R) <= 0) {
		problems.push({ file: '(release)', message: `release v${targetStr} is not newer than the last released v${versionToString(R)}` });
	}

	for (const file of docsFiles) {
		const version = fileVersion(file);
		if (!version) continue; // reported by checkPrefixes
		const inProgress = !R || compareVersions(version, R) > 0;
		if (inProgress && compareVersions(version, target) !== 0) {
			problems.push({
				file,
				message: `in-progress doc is v${versionToString(version)} but the release target is v${targetStr}; rename it to match the version being released`,
			});
		}
	}
	return problems;
}

// ---------------------------------------------------------------------------
// CLI wrapper: gather state from git/fs, then delegate to the pure checks above.
// ---------------------------------------------------------------------------

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DOCS_DIR = path.join(ROOT, 'content/docs');
const DOCS_PREFIX = 'content/docs/';

function git(args: string[]): string {
	return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim();
}

/** All `.md` files under content/docs at HEAD, as docs-root-relative "/" paths. */
function walkDocs(dir: string): string[] {
	const out: string[] = [];
	let entries: fs.Dirent[];
	try {
		entries = fs.readdirSync(dir, { withFileTypes: true });
	} catch {
		return out;
	}
	for (const entry of entries) {
		const full = path.join(dir, entry.name);
		if (entry.isDirectory()) out.push(...walkDocs(full));
		else if (entry.isFile() && entry.name.endsWith('.md')) {
			out.push(path.relative(DOCS_DIR, full).split(path.sep).join('/'));
		}
	}
	return out;
}

/** The newest `vX.Y.Z` tag on this repo, or null if none exist. */
function latestReleaseTag(): SemVer | null {
	let raw: string;
	try {
		raw = git(['tag', '--list', 'v*.*.*']);
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

/** Parse `git diff --name-status` output, keeping only content/docs entries. */
function docsDiff(fromRef: string): DiffEntry[] {
	const raw = git(['diff', '--no-renames', '--name-status', fromRef, 'HEAD', '--', 'content/docs']);
	const entries: DiffEntry[] = [];
	if (!raw) return entries;
	for (const line of raw.split('\n')) {
		const [status, file] = line.split('\t');
		if (!status || !file || !file.startsWith(DOCS_PREFIX)) continue;
		const s = status[0];
		if (s !== 'A' && s !== 'M' && s !== 'D') continue;
		entries.push({ status: s, docsPath: file.slice(DOCS_PREFIX.length) });
	}
	return entries;
}

function report(problems: Problem[], heading: string): boolean {
	if (problems.length === 0) {
		console.log(`✓ ${heading}: no problems.`);
		return true;
	}
	console.error(`✗ ${heading}: ${problems.length} problem(s):`);
	for (const p of problems) console.error(`  - ${p.file}: ${p.message}`);
	return false;
}

function runValidate(): boolean {
	const docsFiles = walkDocs(DOCS_DIR);
	const R = latestReleaseTag();
	const problems = [...checkPrefixes(docsFiles)];

	if (R) {
		const entries = docsDiff(`v${versionToString(R)}`);
		problems.push(...checkDiff(entries, R));
		console.log(`(latest released version R = v${versionToString(R)})`);
	} else {
		console.log('(no release tags yet — nothing is frozen)');
	}
	return report(problems, 'docs validate');
}

function runRelease(versionArg: string): boolean {
	let target: SemVer;
	try {
		target = parseVersionString(versionArg.replace(/^v/, ''));
	} catch {
		console.error(`✗ release: invalid version "${versionArg}" (expected vX.Y.Z)`);
		return false;
	}
	const docsFiles = walkDocs(DOCS_DIR);
	const R = latestReleaseTag();
	const problems = [...checkPrefixes(docsFiles), ...checkRelease(docsFiles, R, target)];
	console.log(`(releasing v${versionToString(target)}; previous released R = ${R ? 'v' + versionToString(R) : 'none'})`);
	return report(problems, `docs release v${versionToString(target)}`);
}

function main(): void {
	const [mode, arg] = process.argv.slice(2);
	let ok: boolean;
	if (mode === 'validate') ok = runValidate();
	else if (mode === 'release') {
		if (!arg) {
			console.error('usage: tsx build/ci-check.ts release <version>');
			process.exit(2);
		}
		ok = runRelease(arg);
	} else {
		console.error('usage: tsx build/ci-check.ts <validate|release [version]>');
		process.exit(2);
		return;
	}
	process.exit(ok ? 0 : 1);
}

// Only run the CLI when invoked directly, so the test file can import the pure checks.
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
	main();
}
