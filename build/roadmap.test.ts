// Run with: npm run test:roadmap
// Unit tests for the GitHub-issues -> dependency-graph roadmap model. Pure, no network.
import assert from "node:assert/strict";
import {
  roadmapFromApi,
  tiersOf,
  isStationArray,
  STATUS_LABELS,
  type Station,
} from "./roadmap.ts";

let passed = 0;
function test(name: string, fn: () => void) {
  fn();
  passed++;
  console.log(`  ok  ${name}`);
}

// Fixture: raw issues with `blockedBy` already attached (numbers), as fetch-roadmap.ts does.
const api = [
  { number: 1, title: "Node model", state: "open", html_url: "u1", body: "<!-- roadmap: The dyad cell. -->\nlong notes", labels: [{ name: "roadmap" }], blockedBy: [] },
  { number: 2, title: "Parser", state: "open", html_url: "u2", body: "A one-pass parser.\n\nmore", labels: ["roadmap"], blockedBy: [1] },
  { number: 3, title: "Interpreter", state: "open", html_url: "u3", body: "Tree-walk.", labels: [{ name: "roadmap" }], blockedBy: [1, 2] },
  { number: 4, title: "Dyad cell", state: "closed", html_url: "u4", body: "Done.", labels: [{ name: "roadmap" }], blockedBy: [] },
  { number: 5, title: "Rewrite engine", state: "open", html_url: "u5", body: "egg.", labels: [{ name: "roadmap" }], blockedBy: [3] },
  { number: 6, title: "Uses a finished thing", state: "open", html_url: "u6", body: "x", labels: [{ name: "roadmap" }], blockedBy: [4] },
  { number: 7, title: "External blocker only", state: "open", html_url: "u7", body: "x", labels: [{ name: "roadmap" }], blockedBy: [99] },
  { number: 8, title: "A PR", state: "open", html_url: "u8", body: "x", labels: [{ name: "roadmap" }], pull_request: { url: "…" }, blockedBy: [] },
  { number: 9, title: "Not on roadmap", state: "open", html_url: "u9", body: "x", labels: [{ name: "bug" }], blockedBy: [] },
  { number: 10, title: "Self loop", state: "open", html_url: "u10", body: "x", labels: [{ name: "roadmap" }], blockedBy: [10] },
  { number: 11, title: "Cycle a", state: "open", html_url: "u11", body: "x", labels: [{ name: "roadmap" }], blockedBy: [12] },
  { number: 12, title: "Cycle b", state: "open", html_url: "u12", body: "x", labels: [{ name: "roadmap" }], blockedBy: [11] },
];

const stations = roadmapFromApi(api);
const byNum = new Map(stations.map((s) => [s.number, s]));

test("keeps only roadmap-labelled, non-PR issues", () => {
  assert.deepEqual(
    stations.map((s) => s.number).sort((a, b) => a - b),
    [1, 2, 3, 4, 5, 6, 7, 10, 11, 12], // 8 (PR) and 9 (no roadmap) dropped
  );
});

test("edges are filtered to the node set; external + self edges dropped", () => {
  assert.deepEqual(byNum.get(2)!.blockedBy, [1]);
  assert.deepEqual(byNum.get(3)!.blockedBy, [1, 2]);
  assert.deepEqual(byNum.get(7)!.blockedBy, []); // #99 not a roadmap node
  assert.deepEqual(byNum.get(10)!.blockedBy, []); // self-edge removed
});

test("status: closed -> done; open w/ open blocker -> blocked; else ready", () => {
  assert.equal(byNum.get(4)!.status, "done"); // closed
  assert.equal(byNum.get(2)!.status, "blocked"); // blocked by open #1
  assert.equal(byNum.get(1)!.status, "ready"); // no blockers
  assert.equal(byNum.get(6)!.status, "ready"); // its only blocker (#4) is closed
  assert.equal(byNum.get(7)!.status, "ready"); // external blocker dropped
});

test("tier = longest dependency depth", () => {
  assert.equal(byNum.get(1)!.tier, 0);
  assert.equal(byNum.get(2)!.tier, 1);
  assert.equal(byNum.get(3)!.tier, 2); // max(dep(1)=0, dep(2)=1) + 1
  assert.equal(byNum.get(5)!.tier, 3); // 1->2->3->5
  assert.equal(byNum.get(6)!.tier, 1); // depends on #4 (tier 0)
});

test("blurb: marker overrides body, else first paragraph", () => {
  assert.equal(byNum.get(1)!.blurb, "The dyad cell.");
  assert.equal(byNum.get(2)!.blurb, "A one-pass parser.");
});

test("dependency cycles are broken (finite tiers, no hang)", () => {
  assert.ok(Number.isInteger(byNum.get(11)!.tier));
  assert.ok(Number.isInteger(byNum.get(12)!.tier));
});

test("tiersOf groups by tier, sorted by number within a tier", () => {
  const tiers = tiersOf(stations);
  assert.deepEqual(tiers[0]!.map((s) => s.number), [1, 4, 7, 10]); // all tier-0 nodes
  assert.equal(tiers[1]!.includes(byNum.get(2)!), true);
});

test("non-array and empty inputs are safe", () => {
  assert.deepEqual(roadmapFromApi(null), []);
  assert.deepEqual(roadmapFromApi(undefined), []);
  assert.deepEqual(roadmapFromApi("nope"), []);
  assert.deepEqual(roadmapFromApi([]), []);
});

test("isStationArray validates snapshot shape", () => {
  assert.ok(isStationArray(stations));
  assert.ok(!isStationArray([{ number: 1 }]));
  assert.ok(!isStationArray("nope"));
  assert.ok(isStationArray([]));
});

const _used: Station[] = stations;
void _used;
void STATUS_LABELS;

console.log(`\n${passed} tests passed.`);
