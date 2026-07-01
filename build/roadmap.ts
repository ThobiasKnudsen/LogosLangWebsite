// Browser-safe roadmap model: stations come from LogosLang GitHub issues, and the
// roadmap is the *dependency graph* between them (an issue's "blocked by" links).
// NO node imports, pure, unit-tested, no network. The build-time fetch (issues +
// per-issue blocked_by edges) and snapshot persistence live in fetch-roadmap.ts.
//
// An issue becomes a station when it has the `roadmap` label. Its blockers (other
// roadmap issues that block it) define the edges; from those we derive each
// station's tier (build order) and status. There are no categories.

export type ChipStatus = "done" | "ready" | "blocked";

// A GitHub label shown on an issue node. `color` is GitHub's 6-hex string (no `#`).
export interface Label {
  name: string;
  color: string;
}

export interface Station {
  number: number; // issue number, stable id and node key
  title: string;
  blurb: string; // short blurb (stripped + truncated)
  url: string; // the issue's html_url
  state: "open" | "closed";
  blockedBy: number[]; // roadmap issue numbers this depends on (edges, filtered to the node set)
  status: ChipStatus; // derived: done (closed) / blocked (open blocker) / ready
  tier: number; // derived: longest dependency depth (0 = no blockers)
  milestone: number; // GitHub milestone number this issue belongs to (required, see RoadmapError)
  labels: Label[]; // the issue's labels for display, excluding the `roadmap` marker
}

// A GitHub milestone: a "finish line" on the roadmap. Its issues render above its
// line; every later milestone renders below. Ordered by `number` (creation order).
export interface Milestone {
  number: number; // GitHub milestone number, stable id and band order key
  title: string;
  dueOn: string | null; // ISO date string, or null when no due date is set
  state: "open" | "closed";
  url: string; // the milestone's html_url
}

// The full roadmap: milestones (ordered) plus their issues. This is the snapshot
// shape written to content/roadmap.snapshot.json and consumed by the renderer.
export interface Roadmap {
  milestones: Milestone[]; // sorted ascending by number
  stations: Station[]; // sorted by tier then number
}

// One milestone with the issues assigned to it (its band), for rendering/tests.
export interface Band {
  milestone: Milestone;
  stations: Station[]; // sorted by tier then number
}

// Thrown when a `roadmap`-labelled issue has no milestone. This is a hard data
// error (every roadmap issue must be scheduled), so the fetch layer lets it fail
// the build rather than silently falling back to the snapshot.
export class RoadmapError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RoadmapError";
  }
}

export const STATUS_LABELS: Record<ChipStatus, string> = {
  done: "Done",
  ready: "Ready",
  blocked: "Blocked",
};

const ROADMAP_LABEL = "roadmap";
const BLURB_MARKER = /<!--\s*roadmap:\s*([\s\S]*?)\s*-->/i;
const BLURB_MAX = 500;

/** Defensive: GitHub labels arrive as `{name}` objects (or occasionally strings). */
function labelNames(raw: any): string[] {
  if (!Array.isArray(raw?.labels)) return [];
  return raw.labels
    .map((l: any) => (typeof l === "string" ? l : typeof l?.name === "string" ? l.name : ""))
    .filter((n: string) => n.length > 0);
}

/** The issue's labels as `{name,color}` for display, dropping the `roadmap` marker. */
function displayLabels(raw: any): Label[] {
  if (!Array.isArray(raw?.labels)) return [];
  const out: Label[] = [];
  for (const l of raw.labels) {
    const name = typeof l === "string" ? l : typeof l?.name === "string" ? l.name : "";
    if (!name || name === ROADMAP_LABEL) continue;
    const color = typeof l === "object" && typeof l?.color === "string" ? l.color : "";
    out.push({ name, color });
  }
  return out;
}

/** Numbers in a raw issue's attached `blockedBy` (set by the fetch layer). */
function rawBlockedBy(raw: any): number[] {
  if (!Array.isArray(raw?.blockedBy)) return [];
  const out: number[] = [];
  for (const b of raw.blockedBy) {
    const n = typeof b === "number" ? b : typeof b?.number === "number" ? b.number : NaN;
    if (Number.isInteger(n)) out.push(n);
  }
  return out;
}

/** Collapse markdown/HTML to a plain one-liner and truncate. */
function plainText(s: string, max = BLURB_MAX): string {
  const text = s
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/[`*_#>]/g, "")
    .replace(/\r/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}

/** Blurb = the `<!-- roadmap: … -->` marker if present, else the first paragraph. */
function blurbFromBody(body: unknown): string {
  if (typeof body !== "string" || body.trim() === "") return "";
  const marked = body.match(BLURB_MARKER);
  if (marked && marked[1]!.trim()) return plainText(marked[1]!);
  const firstPara = body
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .find((p) => p.length > 0);
  return firstPara ? plainText(firstPara) : "";
}

/** Shape a raw GitHub milestone object into our Milestone, or null if unusable. */
function milestoneFrom(raw: any): Milestone | null {
  if (!raw || typeof raw !== "object" || typeof raw.number !== "number") return null;
  return {
    number: raw.number,
    title: typeof raw.title === "string" ? raw.title : `Milestone ${raw.number}`,
    dueOn: typeof raw.due_on === "string" ? raw.due_on : null,
    state: raw.state === "closed" ? "closed" : "open",
    url: typeof raw.html_url === "string" ? raw.html_url : "",
  };
}

/**
 * Shape raw GitHub issues (each carrying a `blockedBy: number[]` attached by the
 * fetch layer) plus the repo's milestones into a Roadmap: milestones (ordered) and
 * stations with derived status/tier and their milestone. Pure, unit-tested without
 * network. Skips PRs and non-`roadmap` issues; edges to issues outside the roadmap
 * set are dropped (we only draw what we render).
 *
 * Every roadmap issue MUST have a milestone: a labelled issue without one throws a
 * RoadmapError so the build fails rather than shipping an unscheduled issue. The
 * milestone set is the repo's `/milestones` list, merged with any milestone embedded
 * on an issue, so even milestones with no issues yet get their own line.
 */
export function roadmapFromApi(apiIssues: unknown, apiMilestones: unknown): Roadmap {
  // Milestone set: the repo's milestone list (includes empty ones), merged below
  // with any milestone embedded on an issue so a station's band always exists.
  const milestones = new Map<number, Milestone>();
  if (Array.isArray(apiMilestones)) {
    for (const raw of apiMilestones) {
      const m = milestoneFrom(raw);
      if (m && !milestones.has(m.number)) milestones.set(m.number, m);
    }
  }
  const sortedMilestones = (): Milestone[] =>
    [...milestones.values()].sort((a, b) => a.number - b.number);

  if (!Array.isArray(apiIssues)) return { milestones: sortedMilestones(), stations: [] };

  // First pass: collect the node set (roadmap issues) with raw blockers + state.
  type Pre = { st: Station; rawBlockers: number[] };
  const pre: Pre[] = [];
  const missing: number[] = []; // roadmap issues with no milestone -> hard error
  for (const r of apiIssues as any[]) {
    if (!r || typeof r !== "object") continue;
    if (r.pull_request) continue; // the issues endpoint also returns PRs
    if (typeof r.number !== "number") continue;
    if (!labelNames(r).includes(ROADMAP_LABEL)) continue;
    const ms = milestoneFrom(r.milestone);
    if (!ms) {
      missing.push(r.number);
      continue;
    }
    if (!milestones.has(ms.number)) milestones.set(ms.number, ms);
    pre.push({
      st: {
        number: r.number,
        title: typeof r.title === "string" ? r.title : `#${r.number}`,
        blurb: blurbFromBody(r.body),
        url: typeof r.html_url === "string" ? r.html_url : "",
        state: r.state === "closed" ? "closed" : "open",
        blockedBy: [],
        status: "ready",
        tier: 0,
        milestone: ms.number,
        labels: displayLabels(r),
      },
      rawBlockers: rawBlockedBy(r),
    });
  }

  if (missing.length > 0) {
    const list = missing.sort((a, b) => a - b).map((n) => `#${n}`).join(", ");
    throw new RoadmapError(
      `roadmap issue(s) ${list} have the \`roadmap\` label but no milestone. ` +
        `Every roadmap issue must be assigned a GitHub milestone.`,
    );
  }

  const byNum = new Map<number, Station>(pre.map((p) => [p.st.number, p.st]));
  // Keep only edges between nodes we actually render.
  for (const p of pre) {
    p.st.blockedBy = p.rawBlockers.filter((b) => byNum.has(b) && b !== p.st.number);
  }

  // Status: closed -> done; open with any open blocker -> blocked; else ready.
  for (const p of pre) {
    const s = p.st;
    if (s.state === "closed") s.status = "done";
    else s.status = s.blockedBy.some((b) => byNum.get(b)!.state === "open") ? "blocked" : "ready";
  }

  // Tier: longest path over blockers (cycle-guarded longest-path / depth).
  const memo = new Map<number, number>();
  const visiting = new Set<number>();
  const depth = (n: number): number => {
    if (memo.has(n)) return memo.get(n)!;
    if (visiting.has(n)) return 0; // break cycles (shouldn't occur for real deps)
    visiting.add(n);
    const blockers = byNum.get(n)!.blockedBy;
    const d = blockers.length ? 1 + Math.max(...blockers.map(depth)) : 0;
    visiting.delete(n);
    memo.set(n, d);
    return d;
  };
  for (const p of pre) p.st.tier = depth(p.st.number);

  const stations = pre.map((p) => p.st);
  stations.sort((a, b) => (a.tier !== b.tier ? a.tier - b.tier : a.number - b.number));
  return { milestones: sortedMilestones(), stations };
}

/**
 * Group a roadmap into bands, one per milestone, in milestone-number order, each
 * with its issues (sorted by tier then number). Milestones with no issues are kept
 * (they still get a line). Stations render above their milestone's line, so a band
 * is the issues shown just above that finish line and below all earlier ones.
 */
export function bandsOf(roadmap: Roadmap): Band[] {
  const byMilestone = new Map<number, Station[]>();
  for (const s of roadmap.stations) {
    const list = byMilestone.get(s.milestone);
    if (list) list.push(s);
    else byMilestone.set(s.milestone, [s]);
  }
  return roadmap.milestones.map((milestone) => ({
    milestone,
    stations: (byMilestone.get(milestone.number) ?? [])
      .slice()
      .sort((a, b) => (a.tier !== b.tier ? a.tier - b.tier : a.number - b.number)),
  }));
}

/** True iff `value` is a structurally-valid Roadmap (for snapshot loads). */
export function isRoadmap(value: unknown): value is Roadmap {
  const v = value as any;
  const okMilestone = (m: any) =>
    m &&
    typeof m.number === "number" &&
    typeof m.title === "string" &&
    (m.state === "open" || m.state === "closed") &&
    (m.dueOn === null || typeof m.dueOn === "string");
  const okStation = (s: any) =>
    s &&
    typeof s.number === "number" &&
    typeof s.title === "string" &&
    Array.isArray(s.blockedBy) &&
    (s.status === "done" || s.status === "ready" || s.status === "blocked") &&
    typeof s.tier === "number" &&
    typeof s.milestone === "number" &&
    // labels is display-only; a legacy snapshot may omit it (normalised to [] on load).
    (s.labels === undefined ||
      (Array.isArray(s.labels) &&
        s.labels.every((l: any) => l && typeof l.name === "string" && typeof l.color === "string")));
  return (
    !!v &&
    typeof v === "object" &&
    Array.isArray(v.milestones) &&
    v.milestones.every(okMilestone) &&
    Array.isArray(v.stations) &&
    v.stations.every(okStation)
  );
}
