// Run with: npm run test:roadmap
// Unit tests for the GitHub-issues -> milestone-banded dependency-graph roadmap
// model. Pure, no network.
import assert from "node:assert/strict";
import {
  roadmapFromApi,
  bandsOf,
  isRoadmap,
  RoadmapError,
  STATUS_LABELS,
  type Roadmap,
} from "./roadmap.ts";

let passed = 0;
function test(name: string, fn: () => void) {
  fn();
  passed++;
  console.log(`  ok  ${name}`);
}

// The repo's milestones (as the /milestones endpoint returns them). #3 is empty,
// with no issues assigned, so it exercises the "milestone with no issues" band.
const milestonesApi = [
  { number: 2, title: "after v1", state: "open", due_on: null, html_url: "m2" },
  { number: 1, title: "v1", state: "open", due_on: "2026-08-12T00:00:00Z", html_url: "m1" },
  { number: 3, title: "someday", state: "open", due_on: null, html_url: "m3" },
];

// Fixture: raw issues with `blockedBy` attached (as fetch-roadmap.ts does) and a
// `milestone` object (as the issues endpoint embeds). #5/#6/#7 are in milestone 2.
const api = [
  { number: 1, title: "Node model", state: "open", html_url: "u1", body: "<!-- roadmap: The dyad cell. -->\nlong notes", labels: [{ name: "roadmap", color: "5319e7" }, { name: "lexer", color: "1d76db" }, { name: "core", color: "ededed" }], milestone: { number: 1, title: "v1", state: "open" }, blockedBy: [] },
  { number: 2, title: "Parser", state: "open", html_url: "u2", body: "A one-pass parser.\n\nmore", labels: ["roadmap"], milestone: { number: 1, title: "v1", state: "open" }, blockedBy: [1] },
  { number: 3, title: "Interpreter", state: "open", html_url: "u3", body: "Tree-walk.", labels: [{ name: "roadmap" }], milestone: { number: 1, title: "v1", state: "open" }, blockedBy: [1, 2] },
  { number: 4, title: "Dyad cell", state: "closed", html_url: "u4", body: "Done.", labels: [{ name: "roadmap" }], milestone: { number: 1, title: "v1", state: "open" }, blockedBy: [] },
  { number: 5, title: "Rewrite engine", state: "open", html_url: "u5", body: "egg.", labels: [{ name: "roadmap" }], milestone: { number: 2, title: "after v1", state: "open" }, blockedBy: [3] },
  { number: 6, title: "Uses a finished thing", state: "open", html_url: "u6", body: "x", labels: [{ name: "roadmap" }], milestone: { number: 2, title: "after v1", state: "open" }, blockedBy: [4] },
  { number: 7, title: "External blocker only", state: "open", html_url: "u7", body: "x", labels: [{ name: "roadmap" }], milestone: { number: 2, title: "after v1", state: "open" }, blockedBy: [99] },
  { number: 8, title: "A PR", state: "open", html_url: "u8", body: "x", labels: [{ name: "roadmap" }], pull_request: { url: "…" }, blockedBy: [] },
  { number: 9, title: "Not on roadmap", state: "open", html_url: "u9", body: "x", labels: [{ name: "bug" }], blockedBy: [] },
  { number: 10, title: "Self loop", state: "open", html_url: "u10", body: "x", labels: [{ name: "roadmap" }], milestone: { number: 1, title: "v1", state: "open" }, blockedBy: [10] },
  { number: 11, title: "Cycle a", state: "open", html_url: "u11", body: "x", labels: [{ name: "roadmap" }], milestone: { number: 1, title: "v1", state: "open" }, blockedBy: [12] },
  { number: 12, title: "Cycle b", state: "open", html_url: "u12", body: "x", labels: [{ name: "roadmap" }], milestone: { number: 1, title: "v1", state: "open" }, blockedBy: [11] },
];

const roadmap = roadmapFromApi(api, milestonesApi);
const stations = roadmap.stations;
const byNum = new Map(stations.map((s) => [s.number, s]));

test("keeps only roadmap-labelled, non-PR issues", () => {
  assert.deepEqual(
    stations.map((s) => s.number).sort((a, b) => a - b),
    [1, 2, 3, 4, 5, 6, 7, 10, 11, 12], // 8 (PR) and 9 (no roadmap) dropped
  );
});

test("each station carries its milestone number", () => {
  assert.equal(byNum.get(1)!.milestone, 1);
  assert.equal(byNum.get(5)!.milestone, 2);
});

test("labels: keeps every label except `roadmap`, with its colour", () => {
  assert.deepEqual(byNum.get(1)!.labels, [
    { name: "lexer", color: "1d76db" },
    { name: "core", color: "ededed" },
  ]);
  assert.deepEqual(byNum.get(2)!.labels, []); // only had `roadmap` (string form)
  assert.deepEqual(byNum.get(5)!.labels, []); // object form, `roadmap` only
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

test("tier = longest dependency depth, across milestone boundaries", () => {
  assert.equal(byNum.get(1)!.tier, 0);
  assert.equal(byNum.get(2)!.tier, 1);
  assert.equal(byNum.get(3)!.tier, 2); // max(dep(1)=0, dep(2)=1) + 1
  assert.equal(byNum.get(5)!.tier, 3); // 1->2->3->5, even though #5 is a later milestone
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

test("milestones are collected and sorted ascending by number", () => {
  assert.deepEqual(roadmap.milestones.map((m) => m.number), [1, 2, 3]);
  const v1 = roadmap.milestones.find((m) => m.number === 1)!;
  assert.equal(v1.title, "v1");
  assert.equal(v1.dueOn, "2026-08-12T00:00:00Z");
});

test("bandsOf groups by milestone (order = milestone number), sorted within a band", () => {
  const bands = bandsOf(roadmap);
  assert.deepEqual(bands.map((b) => b.milestone.number), [1, 2, 3]);
  // Band 1 holds the v1 issues, ordered by tier then number.
  assert.deepEqual(bands[0]!.stations.map((s) => s.number), [1, 4, 10, 2, 12, 3, 11]);
  assert.deepEqual(bands[1]!.stations.map((s) => s.number), [7, 6, 5]);
  assert.deepEqual(bands[2]!.stations, []); // #3 milestone has no issues yet
});

test("a roadmap issue with no milestone throws RoadmapError (fail the build)", () => {
  const bad = [
    { number: 1, title: "Scheduled", state: "open", html_url: "u1", body: "x", labels: [{ name: "roadmap" }], milestone: { number: 1, title: "v1", state: "open" }, blockedBy: [] },
    { number: 2, title: "Unscheduled", state: "open", html_url: "u2", body: "x", labels: [{ name: "roadmap" }], milestone: null, blockedBy: [] },
  ];
  assert.throws(() => roadmapFromApi(bad, milestonesApi), (err: unknown) => {
    assert.ok(err instanceof RoadmapError);
    assert.match((err as Error).message, /#2/);
    return true;
  });
});

test("embedded milestone with no /milestones entry still becomes a band", () => {
  const issues = [
    { number: 1, title: "Only place milestone 7 appears", state: "open", html_url: "u1", body: "x", labels: [{ name: "roadmap" }], milestone: { number: 7, title: "surprise", state: "open", due_on: null, html_url: "m7" }, blockedBy: [] },
  ];
  const r = roadmapFromApi(issues, []); // empty /milestones list
  assert.deepEqual(r.milestones.map((m) => m.number), [7]);
  assert.equal(bandsOf(r)[0]!.stations.map((s) => s.number).join(","), "1");
});

test("non-array and empty inputs are safe", () => {
  assert.deepEqual(roadmapFromApi(null, null), { milestones: [], stations: [] });
  assert.deepEqual(roadmapFromApi(undefined, undefined), { milestones: [], stations: [] });
  assert.deepEqual(roadmapFromApi("nope", "nope"), { milestones: [], stations: [] });
  assert.deepEqual(roadmapFromApi([], []), { milestones: [], stations: [] });
});

test("isRoadmap validates snapshot shape", () => {
  assert.ok(isRoadmap(roadmap));
  assert.ok(isRoadmap({ milestones: [], stations: [] }));
  assert.ok(!isRoadmap([])); // old array-only snapshot is no longer valid
  assert.ok(!isRoadmap({ milestones: [{ number: 1 }], stations: [] })); // milestone missing fields
  assert.ok(!isRoadmap({ stations: [] })); // no milestones key
  assert.ok(!isRoadmap("nope"));
});

const _used: Roadmap = roadmap;
void _used;
void STATUS_LABELS;

console.log(`\n${passed} tests passed.`);
