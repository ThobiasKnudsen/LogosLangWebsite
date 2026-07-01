// Run with: npm run test:docs-model
import assert from 'node:assert/strict';
import {
	parseVersionDir,
	versionToString,
	globalVersionStrings,
	latestTree,
	findPage,
	firstPage,
	adjacentVersions,
	type VersionTree,
} from './version.ts';

let passed = 0;
function test(name: string, fn: () => void) {
	fn();
	passed++;
	console.log(`  ok  ${name}`);
}

// A page ("reference/operators") that exists in 0.1.0 and 0.3.0 but not 0.2.0, so the
// adjacency helper has a gap to skip; plus pages that appear only in one version.
const trees: VersionTree[] = [
	{
		version: { major: 0, minor: 1, patch: 0 },
		versionStr: '0.1.0',
		pages: [
			{ path: 'reference/operators', title: 'Operators (0.1.0)' },
			{ path: 'guides/rewriting', title: 'Rewriting' },
		],
	},
	{
		version: { major: 0, minor: 2, patch: 0 },
		versionStr: '0.2.0',
		pages: [{ path: 'guides/rewriting', title: 'Rewriting' }],
	},
	{
		version: { major: 0, minor: 3, patch: 0 },
		versionStr: '0.3.0',
		pages: [
			{ path: 'reference/operators', title: 'Operators (0.3.0)' },
			{ path: 'getting-started/introduction', title: 'Introduction' },
		],
	},
];

test('parseVersionDir accepts vX.Y.Z, rejects everything else', () => {
	assert.deepEqual(parseVersionDir('v0.3.0'), { major: 0, minor: 3, patch: 0 });
	assert.equal(parseVersionDir('0.3.0'), null); // missing v
	assert.equal(parseVersionDir('v1.2'), null); // not three parts
	assert.equal(parseVersionDir('v1.2.3-rc1'), null);
	assert.equal(parseVersionDir('reference'), null);
});

test('globalVersionStrings is the sorted list of version folders', () => {
	assert.deepEqual(globalVersionStrings(trees), ['0.1.0', '0.2.0', '0.3.0']);
});

test('latestTree is the newest version', () => {
	assert.equal(versionToString(latestTree(trees)!.version), '0.3.0');
	assert.equal(latestTree([]), null);
});

test('findPage resolves a path within one version, undefined when absent', () => {
	const v030 = trees[2]!;
	assert.equal(findPage(v030, 'reference/operators')!.title, 'Operators (0.3.0)');
	assert.equal(findPage(v030, 'guides/rewriting'), undefined); // dropped in 0.3.0
});

test('firstPage is the landing page of a version', () => {
	assert.equal(firstPage(trees[0]!)!.path, 'reference/operators');
	assert.equal(firstPage({ version: { major: 9, minor: 0, patch: 0 }, versionStr: '9.0.0', pages: [] }), undefined);
});

test('adjacentVersions walks a path across versions, skipping gaps', () => {
	// operators exists in 0.1.0 and 0.3.0 but not 0.2.0, so from 0.1.0 next skips to 0.3.0.
	assert.deepEqual(adjacentVersions(trees, '0.1.0', 'reference/operators'), {
		prev: null,
		next: '0.3.0',
	});
	assert.deepEqual(adjacentVersions(trees, '0.3.0', 'reference/operators'), {
		prev: '0.1.0',
		next: null,
	});
	// A page that exists only in the newest version has no neighbours.
	assert.deepEqual(adjacentVersions(trees, '0.3.0', 'getting-started/introduction'), {
		prev: null,
		next: null,
	});
});

console.log(`\n${passed} tests passed.`);
