// Run with: npm run test:docs-model
import assert from 'node:assert/strict';
import {
	buildSections,
	globalVersions,
	latestVersion,
	effectiveSnapshot,
	visibleSections,
	resolveView,
	parseFilename,
	versionToString,
} from './version.ts';

let passed = 0;
function test(name: string, fn: () => void) {
	fn();
	passed++;
	console.log(`  ok  ${name}`);
}

// The scenario from the design discussion.
const files = [
	'reference/v0.1.0_operators.md',
	'reference/v0.4.0_operators.md',
	'guides/v0.2.0_rewriting.md',
	'getting-started/v1.0.0_introduction.md', // a section that only appears at 1.0.0
];

const sections = buildSections(files);

test('parseFilename strips version prefix', () => {
	assert.deepEqual(parseFilename('v0.4.0_operators.md'), {
		version: { major: 0, minor: 4, patch: 0 },
		name: 'operators',
	});
	assert.equal(parseFilename('operators.md'), null);
	assert.equal(parseFilename('v1.2_operators.md'), null);
});

test('buildSections groups snapshots by version-less id', () => {
	const operators = sections.find((s) => s.id === 'reference/operators')!;
	assert.equal(operators.name, 'operators');
	assert.equal(operators.dir, 'reference');
	assert.deepEqual(operators.snapshots.map((s) => s.versionStr), ['0.1.0', '0.4.0']);
});

test('globalVersions is the sorted union of all prefixes', () => {
	assert.deepEqual(globalVersions(sections).map(versionToString), [
		'0.1.0',
		'0.2.0',
		'0.4.0',
		'1.0.0',
	]);
	assert.equal(versionToString(latestVersion(sections)!), '1.0.0');
});

test('effective = latest snapshot <= G (usually < G)', () => {
	const operators = sections.find((s) => s.id === 'reference/operators')!;
	assert.equal(effectiveSnapshot(operators, { major: 1, minor: 0, patch: 0 })!.versionStr, '0.4.0');
	assert.equal(effectiveSnapshot(operators, { major: 0, minor: 3, patch: 0 })!.versionStr, '0.1.0');
});

test('section hidden before its first snapshot', () => {
	const intro = sections.find((s) => s.id === 'getting-started/introduction')!;
	// At 0.2.0 the intro does not exist yet.
	assert.equal(effectiveSnapshot(intro, { major: 0, minor: 2, patch: 0 }), null);
	const visibleAt020 = visibleSections(sections, { major: 0, minor: 2, patch: 0 }).map((s) => s.id);
	assert.ok(!visibleAt020.includes('getting-started/introduction'));
	assert.ok(visibleAt020.includes('reference/operators'));
});

test('resolveView: on effective snapshot, no warning', () => {
	const operators = sections.find((s) => s.id === 'reference/operators')!;
	const view = resolveView(operators, { major: 1, minor: 0, patch: 0 })!;
	assert.equal(view.current.versionStr, '0.4.0');
	assert.equal(view.offEffective, false);
	assert.equal(view.prev!.versionStr, '0.1.0');
	assert.equal(view.next, null);
});

test('resolveView: browsing off the effective snapshot warns', () => {
	const operators = sections.find((s) => s.id === 'reference/operators')!;
	// At G=1.0.0 the effective is 0.4.0; viewing the older 0.1.0 must warn.
	const view = resolveView(operators, { major: 1, minor: 0, patch: 0 }, { major: 0, minor: 1, patch: 0 })!;
	assert.equal(view.current.versionStr, '0.1.0');
	assert.equal(view.offEffective, true);
	assert.equal(view.effective!.versionStr, '0.4.0'); // the "correct version" to report
});

test('resolveView: full history reachable, including newer-than-G', () => {
	const operators = sections.find((s) => s.id === 'reference/operators')!;
	// At G=0.1.0 the effective is 0.1.0, but 0.4.0 is still reachable via next (with warning).
	const view = resolveView(operators, { major: 0, minor: 1, patch: 0 })!;
	assert.equal(view.current.versionStr, '0.1.0');
	assert.equal(view.next!.versionStr, '0.4.0');
	const newer = resolveView(operators, { major: 0, minor: 1, patch: 0 }, { major: 0, minor: 4, patch: 0 })!;
	assert.equal(newer.offEffective, true);
	assert.equal(newer.effective!.versionStr, '0.1.0');
});

console.log(`\n${passed} tests passed.`);
