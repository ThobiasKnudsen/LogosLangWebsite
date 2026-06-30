// Run with: npm run test:new-doc
import assert from 'node:assert/strict';
import { pickDefaultVersion, bumpPatch } from './new-doc.ts';
import { parseVersionString, versionToString } from './version.ts';

let passed = 0;
function test(name: string, fn: () => void) {
	fn();
	passed++;
	console.log(`  ok  ${name}`);
}

const v = parseVersionString;
const s = (x: { major: number; minor: number; patch: number }) => versionToString(x);

test('bumpPatch increments only the patch', () => {
	assert.equal(s(bumpPatch(v('0.4.2'))), '0.4.3');
	assert.equal(s(bumpPatch(v('1.0.0'))), '1.0.1');
});

test('fresh repo (no release, no files) -> 0.0.1', () => {
	assert.equal(s(pickDefaultVersion(null, [])), '0.0.1');
});

test('no release yet but files exist -> highest file version', () => {
	assert.equal(s(pickDefaultVersion(null, [v('0.0.1'), v('0.0.3'), v('0.0.2')])), '0.0.3');
});

test('released, work started -> the in-progress version (newest past R)', () => {
	// R=0.0.2; files include frozen 0.0.1/0.0.2 and in-progress 0.0.3
	assert.equal(s(pickDefaultVersion(v('0.0.2'), [v('0.0.1'), v('0.0.2'), v('0.0.3')])), '0.0.3');
});

test('released, no work started yet -> one patch above R', () => {
	// every file is <= R, so there is no in-progress line
	assert.equal(s(pickDefaultVersion(v('0.4.0'), [v('0.1.0'), v('0.4.0')])), '0.4.1');
});

test('ignores frozen files when choosing the in-progress version', () => {
	// 0.0.9 is frozen (<= R=0.1.0); the in-progress 0.1.1 wins, not 0.0.9
	assert.equal(s(pickDefaultVersion(v('0.1.0'), [v('0.0.9'), v('0.1.1')])), '0.1.1');
});

console.log(`\n${passed} tests passed.`);
