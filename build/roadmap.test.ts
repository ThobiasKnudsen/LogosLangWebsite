// Run with: npm run test:roadmap
// Unit tests for the GitHub-issues -> roadmap-stations model. Pure, no network.
import assert from "node:assert/strict";
import {
  roadmapFromApi,
  v1DueOn,
  isStationArray,
  LINE_ORDER,
  type Station,
} from "./roadmap.ts";

let passed = 0;
function test(name: string, fn: () => void) {
  fn();
  passed++;
  console.log(`  ok  ${name}`);
}

// A minimal GitHub Issues API fixture exercising every parse path.
const api = [
  {
    number: 1,
    title: "One structure for everything",
    state: "open",
    html_url: "https://github.com/ThobiasKnudsen/LogosLang/issues/1",
    body: "The Logic Graph: one structure holding programs, types, and the compiler's own logic.\n\nMore detail below.",
    labels: [{ name: "roadmap" }, { name: "area:graph" }],
    milestone: { title: "v1", due_on: "2026-09-01T00:00:00Z" },
  },
  {
    number: 2,
    title: "Dependent types and a proof kernel",
    state: "open",
    html_url: "u2",
    body: "<!-- roadmap: Propositions as types, proofs as programs, checked by a small kernel. -->\nLong design notes that should NOT be the blurb.",
    labels: [{ name: "roadmap" }, { name: "area:proofs" }],
    milestone: { title: "after v1", due_on: null },
  },
  {
    number: 3,
    title: "Shipped lexer",
    state: "closed",
    html_url: "u3",
    body: "Done already.",
    labels: ["roadmap", "area:parse"], // string labels also allowed
    milestone: { title: "v1", due_on: "2026-08-01T00:00:00Z" },
  },
  {
    number: 4,
    title: "No area label",
    state: "open",
    html_url: "u4",
    body: "Has roadmap but no area:* label, should be skipped.",
    labels: [{ name: "roadmap" }],
    milestone: null,
  },
  {
    number: 5,
    title: "Not on the roadmap",
    state: "open",
    html_url: "u5",
    body: "An ordinary bug.",
    labels: [{ name: "bug" }],
    milestone: null,
  },
  {
    number: 6,
    title: "A pull request, not an issue",
    state: "open",
    html_url: "u6",
    body: "Should be skipped — it's a PR.",
    labels: [{ name: "roadmap" }, { name: "area:graph" }],
    pull_request: { url: "…" },
    milestone: { title: "v1", due_on: null },
  },
  {
    number: 7,
    title: "Ordered first via order label",
    state: "open",
    html_url: "u7",
    body: "Carries order:1 so it sorts before issue #1 in the graph line… but different due dates win first.",
    labels: [{ name: "roadmap" }, { name: "area:graph" }, { name: "order:1" }],
    milestone: { title: "v1", due_on: "2026-09-01T00:00:00Z" },
  },
];

const stations = roadmapFromApi(api);

test("keeps only roadmap-labelled, area-labelled, non-PR issues", () => {
  const numbers = stations.map((s) => s.number).sort((a, b) => a - b);
  assert.deepEqual(numbers, [1, 2, 3, 7]); // 4 (no area), 5 (no roadmap), 6 (PR) dropped
});

test("maps area:<key> to the line", () => {
  assert.equal(stations.find((s) => s.number === 1)!.line, "graph");
  assert.equal(stations.find((s) => s.number === 2)!.line, "proofs");
  assert.equal(stations.find((s) => s.number === 3)!.line, "parse");
});

test("milestone v1 -> zone v1, anything else/none -> later", () => {
  assert.equal(stations.find((s) => s.number === 1)!.zone, "v1");
  assert.equal(stations.find((s) => s.number === 2)!.zone, "later");
});

test("status: closed -> done; open v1 -> prog; open later -> plan", () => {
  assert.equal(stations.find((s) => s.number === 3)!.status, "done");
  assert.equal(stations.find((s) => s.number === 1)!.status, "prog");
  assert.equal(stations.find((s) => s.number === 2)!.status, "plan");
});

test("blurb: marker overrides body, else first paragraph; markdown stripped", () => {
  assert.equal(
    stations.find((s) => s.number === 2)!.body,
    "Propositions as types, proofs as programs, checked by a small kernel.",
  );
  assert.equal(
    stations.find((s) => s.number === 1)!.body,
    "The Logic Graph: one structure holding programs, types, and the compiler's own logic.",
  );
});

test("order:NN overrides the issue-number sort key", () => {
  assert.equal(stations.find((s) => s.number === 7)!.order, 1);
  assert.equal(stations.find((s) => s.number === 1)!.order, 1); // falls back to its number
});

test("sort: by line, then due date (nulls last), then order, then number", () => {
  // graph line: #1 and #7 share due 2026-09-01 and order 1; tie broken by number -> 1 before 7.
  const graph = stations.filter((s) => s.line === "graph").map((s) => s.number);
  assert.deepEqual(graph, [1, 7]);
});

test("v1DueOn returns the first v1-band station's due date in sorted order", () => {
  // graph (line 0) sorts before parse (line 1), so #1's 2026-09-01 wins over #3's 2026-08-01.
  assert.equal(v1DueOn(stations), "2026-09-01T00:00:00Z");
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

// Touch the imported type + constant so the unused-import check stays quiet.
const _used: Station[] = stations;
void _used;
void LINE_ORDER;

console.log(`\n${passed} tests passed.`);
