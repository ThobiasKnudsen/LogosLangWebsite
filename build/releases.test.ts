// Run with: npm run test:releases
import assert from 'node:assert/strict';
import {
	parseAssetName,
	parseWasmAssetName,
	releasesFromApi,
	releasesWithWasm,
	assetsForOs,
	installCommand,
	compareTags,
	type Release,
} from './releases.ts';

let passed = 0;
function test(name: string, fn: () => void) {
	fn();
	passed++;
	console.log(`  ok  ${name}`);
}

test('parseAssetName accepts the convention and rejects others', () => {
	assert.deepEqual(parseAssetName('logos-v0.0.3-linux-x86_64.tar.gz'), {
		version: 'v0.0.3',
		os: 'linux',
		arch: 'x86_64',
		ext: 'tar.gz',
	});
	assert.deepEqual(parseAssetName('logos-v1.2.0-windows-x86_64.zip'), {
		version: 'v1.2.0',
		os: 'windows',
		arch: 'x86_64',
		ext: 'zip',
	});
	assert.equal(parseAssetName('logos-v0.0.3-linux-x86_64.txt'), null); // unknown extension
	assert.equal(parseAssetName('checksums.txt'), null);
	assert.equal(parseAssetName('logos-0.0.3-linux-x86_64.tar.gz'), null); // missing leading v
	assert.equal(parseAssetName('logos-v0.0.3-bsd-x86_64.tar.gz'), null); // unknown os
});

// Minimal slice of the real GitHub Releases API payload.
const api = [
	{
		tag_name: 'v0.0.2',
		name: 'Logos 0.0.2',
		published_at: '2026-05-01T00:00:00Z',
		prerelease: false,
		draft: false,
		assets: [
			{ name: 'logos-v0.0.2-linux-x86_64.tar.gz', browser_download_url: 'https://x/lx', size: 10 },
			{ name: 'checksums.txt', browser_download_url: 'https://x/c', size: 1 },
		],
	},
	{
		tag_name: 'v0.0.3',
		name: '',
		published_at: '2026-06-01T00:00:00Z',
		prerelease: false,
		draft: false,
		assets: [
			{ name: 'logos-v0.0.3-windows-x86_64.zip', browser_download_url: 'https://x/wx', size: 30 },
			{ name: 'logos-v0.0.3-macos-aarch64.tar.gz', browser_download_url: 'https://x/ma', size: 20 },
			{ name: 'logos-v0.0.3-macos-x86_64.tar.gz', browser_download_url: 'https://x/mx', size: 21 },
			{ name: 'logos-v0.0.3-wasm.wasm', browser_download_url: 'https://x/wasm', size: 99 },
		],
	},
	{ tag_name: 'v0.0.9', draft: true, assets: [] }, // drafts dropped
	{ tag_name: 'not-a-tag', assets: [] }, // non-semver dropped
];

const releases = releasesFromApi(api);

test('releasesFromApi sorts newest-first and drops drafts/non-tags', () => {
	assert.deepEqual(releases.map((r) => r.version), ['v0.0.3', 'v0.0.2']);
});

test('releasesFromApi keeps only convention assets, names empty release by tag', () => {
	const latest = releases[0]!;
	assert.equal(latest.name, 'v0.0.3'); // empty API name -> tag
	assert.deepEqual(latest.assets.map((a) => a.name), [
		'logos-v0.0.3-macos-x86_64.tar.gz',
		'logos-v0.0.3-macos-aarch64.tar.gz',
		'logos-v0.0.3-windows-x86_64.zip',
	]);
	const v2 = releases[1]!;
	assert.deepEqual(v2.assets.map((a) => a.name), ['logos-v0.0.2-linux-x86_64.tar.gz']); // checksums.txt dropped
});

test('parseWasmAssetName accepts the wasm convention only', () => {
	assert.deepEqual(parseWasmAssetName('logos-v0.0.3-wasm.wasm'), { version: 'v0.0.3' });
	assert.equal(parseWasmAssetName('logos-v0.0.3-linux-x86_64.tar.gz'), null);
	assert.equal(parseWasmAssetName('logos-v0.0.3-wasm.js'), null);
});

test('wasm asset is captured separately and excluded from the OS list', () => {
	const latest = releases[0]!; // v0.0.3
	assert.equal(latest.wasm?.url, 'https://x/wasm');
	assert.ok(!latest.assets.some((a) => a.name.endsWith('.wasm'))); // not in the download picker
	assert.equal(releases[1]!.wasm, null); // v0.0.2 ships no wasm
	assert.deepEqual(releasesWithWasm(releases).map((r) => r.version), ['v0.0.3']);
});

test('assetsForOs filters within a release', () => {
	const latest = releases[0]!;
	assert.deepEqual(assetsForOs(latest, 'macos').map((a) => a.arch), ['x86_64', 'aarch64']);
	assert.deepEqual(assetsForOs(latest, 'linux'), []);
});

test('installCommand differs for windows vs posix', () => {
	const win = releases[0]!.assets.find((a) => a.os === 'windows')!;
	const mac = releases[0]!.assets.find((a) => a.os === 'macos')!;
	assert.ok(installCommand(win).startsWith('irm '));
	assert.ok(installCommand(win).includes('Expand-Archive'));
	assert.ok(installCommand(mac).startsWith('curl -fsSL '));
	assert.ok(installCommand(mac).includes('tar -xzf'));
});

test('compareTags orders semver with leading v', () => {
	assert.ok(compareTags('v0.0.2', 'v0.0.3') < 0);
	assert.ok(compareTags('v0.1.0', 'v0.0.9') > 0);
	assert.equal(compareTags('v1.2.3', 'v1.2.3'), 0);
});

test('empty / malformed input yields no releases', () => {
	assert.deepEqual(releasesFromApi(null), []);
	assert.deepEqual(releasesFromApi({}), []);
	assert.deepEqual(releasesFromApi([{ tag_name: 'v0.0.1', assets: [] } as unknown]).length, 1);
});

console.log(`\n${passed} tests passed.`);
const _used: Release[] = releases;
void _used;
