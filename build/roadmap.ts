// Browser-safe roadmap model: stations come from LogosLang GitHub issues, and the
// roadmap is the *dependency graph* between them (an issue's "blocked by" links).
// NO node imports — pure, unit-tested, no network. The build-time fetch (issues +
// per-issue blocked_by edges) and snapshot persistence live in fetch-roadmap.ts.
//
// An issue becomes a station when it has the `roadmap` label. Its blockers (other
// roadmap issues that block it) define the edges; from those we derive each
// station's tier (build order) and status. There are no categories.

export type ChipStatus = "done" | "ready" | "blocked";

export interface Station {
  number: number; // issue number — stable id and node key
  title: string;
  blurb: string; // short blurb (stripped + truncated)
  url: string; // the issue's html_url
  state: "open" | "closed";
  blockedBy: number[]; // roadmap issue numbers this depends on (edges, filtered to the node set)
  status: ChipStatus; // derived: done (closed) / blocked (open blocker) / ready
  tier: number; // derived: longest dependency depth (0 = no blockers)
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

/**
 * Shape raw GitHub issues (each carrying a `blockedBy: number[]` attached by the
 * fetch layer) into roadmap stations with derived status and dependency tier.
 * Pure — unit-tested without network. Skips PRs and non-`roadmap` issues; edges to
 * issues outside the roadmap set are dropped (we only draw what we render).
 */
export function roadmapFromApi(apiIssues: unknown): Station[] {
  if (!Array.isArray(apiIssues)) return [];

  // First pass: collect the node set (roadmap issues) with raw blockers + state.
  type Pre = { st: Station; rawBlockers: number[] };
  const pre: Pre[] = [];
  for (const r of apiIssues as any[]) {
    if (!r || typeof r !== "object") continue;
    if (r.pull_request) continue; // the issues endpoint also returns PRs
    if (typeof r.number !== "number") continue;
    if (!labelNames(r).includes(ROADMAP_LABEL)) continue;
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
      },
      rawBlockers: rawBlockedBy(r),
    });
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
  return stations;
}

/** Group stations into tiers (index = tier), each inner array sorted by number. */
export function tiersOf(stations: Station[]): Station[][] {
  const max = stations.reduce((m, s) => Math.max(m, s.tier), -1);
  const tiers: Station[][] = Array.from({ length: max + 1 }, () => []);
  for (const s of stations) tiers[s.tier]!.push(s);
  for (const t of tiers) t.sort((a, b) => a.number - b.number);
  return tiers;
}

/** True iff `value` is a structurally-valid Station array (for snapshot loads). */
export function isStationArray(value: unknown): value is Station[] {
  return (
    Array.isArray(value) &&
    value.every(
      (s: any) =>
        s &&
        typeof s.number === "number" &&
        typeof s.title === "string" &&
        Array.isArray(s.blockedBy) &&
        (s.status === "done" || s.status === "ready" || s.status === "blocked") &&
        typeof s.tier === "number",
    )
  );
}
