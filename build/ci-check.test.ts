// Run with: npm run test:ci-check
import assert from 'node:assert/strict';
import { checkPrefixes, checkDiff, checkRelease, type DiffEntry } from './ci-check.ts';
import { parseVersionString } from './version.ts';

let passed = 0;
function test(name: string, fn: () => void) {
	fn();
	passed++;
	console.log(`  ok  ${name}`);
}

const v = parseVersionString;

test('checkPrefixes flags unversioned docs only', () => {
	const problems = checkPrefixes([
		'reference/v0.1.0_operators.md',
		'guides/notes.md', // no prefix
		'getting-started/v1.0.0_introduction.md',
	]);
	assert.equal(problems.length, 1);
	assert.equal(problems[0]!.file, 'guides/notes.md');
});

test('checkDiff is vacuous before the first release (R = null)', () => {
	const entries: DiffEntry[] = [
		{ status: 'M', docsPath: 'reference/v0.1.0_operators.md' },
		{ status: 'D', docsPath: 'guides/v0.1.0_rewriting.md' },
	];
	assert.deepEqual(checkDiff(entries, null), []);
});

test('checkDiff freezes snapshots with version <= R', () => {
	const R = v('0.2.0');
	const entries: DiffEntry[] = [
		{ status: 'M', docsPath: 'reference/v0.1.0_operators.md' }, // frozen -> error
		{ status: 'D', docsPath: 'reference/v0.2.0_operators.md' }, // frozen -> error
		{ status: 'A', docsPath: 'reference/v0.2.0_extras.md' }, // back-dated add -> error
		{ status: 'M', docsPath: 'reference/v0.3.0_operators.md' }, // in-progress -> ok
		{ status: 'A', docsPath: 'guides/v0.3.0_new.md' }, // in-progress -> ok
	];
	const problems = checkDiff(entries, R);
	assert.equal(problems.length, 3);
	const files = problems.map((p) => p.file).sort();
	assert.deepEqual(files, [
		'reference/v0.1.0_operators.md',
		'reference/v0.2.0_extras.md',
		'reference/v0.2.0_operators.md',
	]);
});

test('checkDiff ignores unversioned changed files (left to checkPrefixes)', () => {
	const problems = checkDiff([{ status: 'M', docsPath: 'guides/notes.md' }], v('0.2.0'));
	assert.deepEqual(problems, []);
});

test('checkRelease requires in-progress docs to match the target', () => {
	const R = v('0.2.0');
	const target = v('0.3.0');
	const files = [
		'reference/v0.1.0_operators.md', // frozen -> ignored
		'reference/v0.2.0_operators.md', // frozen -> ignored
		'reference/v0.3.0_operators.md', // matches target -> ok
		'guides/v0.4.0_future.md', // in-progress but wrong version -> error
	];
	const problems = checkRelease(files, R, target);
	assert.equal(problems.length, 1);
	assert.equal(problems[0]!.file, 'guides/v0.4.0_future.md');
});

test('checkRelease rejects a target that is not newer than R', () => {
	const problems = checkRelease(['reference/v0.2.0_operators.md'], v('0.2.0'), v('0.2.0'));
	assert.ok(problems.some((p) => p.file === '(release)'));
});

test('checkRelease before first release treats everything as in-progress', () => {
	const problems = checkRelease(
		['reference/v0.1.0_operators.md', 'guides/v0.1.0_rewriting.md'],
		null,
		v('0.1.0')
	);
	assert.deepEqual(problems, []);
});

console.log(`\n${passed} tests passed.`);
