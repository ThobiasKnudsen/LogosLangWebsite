// Browser-safe roadmap model: the station type, the fixed metro-line scaffolding,
// and the GitHub-issues -> stations parser. NO node imports — kept pure so it is
// unit-testable without a network and, like releases.ts, safe to bundle. The
// build-time network fetch + snapshot persistence live in fetch-roadmap.ts.
//
// The roadmap is generated from LogosLang GitHub issues so the issue tracker is the
// single source of truth. An issue becomes a station when it carries the `roadmap`
// label; everything else about the station is read off its labels, milestone, and
// state (see the convention notes on each helper below).

// The eight metro lines are fixed presentation scaffolding, not issue data: a stray
// label can never spawn a new line. Issues map into a line via an `area:<key>`
// label.
export type LineKey =
  | "graph"
  | "parse"
  | "exec"
  | "compile"
  | "memory"
  | "proofs"
  | "interop"
  | "tooling";

// Which band a station sits in: `v1` = the "toward v1" zone above the interchange;
// `later` = below it. Derived from the issue's milestone.
export type Zone = "v1" | "later";

// The chip a station shows, derived from issue state + band.
export type ChipStatus = "done" | "prog" | "plan";

export interface Station {
  number: number; // issue number — stable id and default sort key
  title: string;
  body: string; // the short blurb (already stripped + truncated)
  line: LineKey;
  zone: Zone;
  status: ChipStatus;
  url: string; // the issue's html_url
  order: number; // resolved sort key within a line
  dueOn: string | null; // the milestone's due date (ISO) or null
}

// Render order of the lines and their display names. Adding a line means adding a
// key here, a `--line-<key>` token, and a `.line[data-line='<key>']` CSS rule.
export const LINE_ORDER: LineKey[] = [
  "graph",
  "parse",
  "exec",
  "compile",
  "memory",
  "proofs",
  "interop",
  "tooling",
];
export const LINE_LABELS: Record<LineKey, string> = {
  graph: "The Logic Graph",
  parse: "Parsing & identity",
  exec: "Execution",
  compile: "Compilation & optimization",
  memory: "Memory & concurrency",
  proofs: "Types & proofs",
  interop: "Interop & errors",
  tooling: "Tooling",
};

const ROADMAP_LABEL = "roadmap";
const AREA_PREFIX = "area:";
const ORDER_PREFIX = "order:";
// An explicit one-line blurb override placed anywhere in the issue body.
const BLURB_MARKER = /<!--\s*roadmap:\s*([\s\S]*?)\s*-->/i;
const BLURB_MAX = 220;

const LINE_SET = new Set<string>(LINE_ORDER);

/** Defensive: GitHub labels arrive as `{name}` objects (or occasionally strings). */
function labelNames(raw: any): string[] {
  if (!Array.isArray(raw?.labels)) return [];
  return raw.labels
    .map((l: any) => (typeof l === "string" ? l : typeof l?.name === "string" ? l.name : ""))
    .filter((n: string) => n.length > 0);
}

/** First `area:<key>` whose key is a known line, in LINE_ORDER precedence. */
function lineFromLabels(names: string[]): LineKey | null {
  const areas = new Set(
    names
      .filter((n) => n.startsWith(AREA_PREFIX))
      .map((n) => n.slice(AREA_PREFIX.length).trim()),
  );
  for (const key of LINE_ORDER) if (areas.has(key)) return key;
  return null;
}

/** Milestone titled exactly `v1` (case-insensitive) is the toward-v1 band. */
function zoneFromMilestone(milestone: any): Zone {
  const title = typeof milestone?.title === "string" ? milestone.title.trim().toLowerCase() : "";
  return title === "v1" ? "v1" : "later";
}

function statusFor(state: unknown, zone: Zone): ChipStatus {
  if (state === "closed") return "done";
  return zone === "v1" ? "prog" : "plan";
}

/** Optional `order:NN` label overrides the default (issue-number) sort key. */
function orderFromLabels(names: string[], fallback: number): number {
  for (const n of names) {
    if (n.startsWith(ORDER_PREFIX)) {
      const v = Number.parseInt(n.slice(ORDER_PREFIX.length).trim(), 10);
      if (Number.isFinite(v)) return v;
    }
  }
  return fallback;
}

/** Collapse markdown/HTML to a plain one-liner and truncate. */
function plainText(s: string, max = BLURB_MAX): string {
  const text = s
    .replace(/<!--[\s\S]*?-->/g, " ") // drop HTML comments (incl. the marker)
    .replace(/<[^>]+>/g, " ") // drop tags
    .replace(/```[\s\S]*?```/g, " ") // drop fenced code
    .replace(/[`*_#>]/g, "") // drop common md punctuation
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1") // links -> link text
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
 * Shape the raw GitHub Issues API JSON into roadmap stations. Pure — unit-tested
 * without network. Skips pull requests, non-`roadmap` issues, and issues missing a
 * valid `area:<key>` label (with a warning). Sorted by line, then milestone due
 * date (nulls last), then resolved order, then issue number.
 */
export function roadmapFromApi(apiIssues: unknown): Station[] {
  if (!Array.isArray(apiIssues)) return [];
  const stations: Station[] = [];

  for (const r of apiIssues as any[]) {
    if (!r || typeof r !== "object") continue;
    if (r.pull_request) continue; // the issues endpoint also returns PRs
    if (typeof r.number !== "number") continue;

    const names = labelNames(r);
    if (!names.includes(ROADMAP_LABEL)) continue;

    const line = lineFromLabels(names);
    if (!line) {
      console.warn(
        `roadmap: issue #${r.number} ${JSON.stringify(r.title ?? "")} has no area:<key> label; skipping.`,
      );
      continue;
    }

    const zone = zoneFromMilestone(r.milestone);
    stations.push({
      number: r.number,
      title: typeof r.title === "string" ? r.title : `#${r.number}`,
      body: blurbFromBody(r.body),
      line,
      zone,
      status: statusFor(r.state, zone),
      url: typeof r.html_url === "string" ? r.html_url : "",
      order: orderFromLabels(names, r.number),
      dueOn:
        typeof r.milestone?.due_on === "string" ? r.milestone.due_on : null,
    });
  }

  const lineIndex = (k: LineKey) => LINE_ORDER.indexOf(k);
  stations.sort((a, b) => {
    if (a.line !== b.line) return lineIndex(a.line) - lineIndex(b.line);
    const ad = a.dueOn ?? "9999-12-31";
    const bd = b.dueOn ?? "9999-12-31";
    if (ad !== bd) return ad < bd ? -1 : 1;
    if (a.order !== b.order) return a.order - b.order;
    return a.number - b.number;
  });
  return stations;
}

/** The v1 milestone's due date (ISO), if any v1-band station carries one. */
export function v1DueOn(stations: Station[]): string | null {
  for (const s of stations) if (s.zone === "v1" && s.dueOn) return s.dueOn;
  return null;
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
        typeof s.line === "string" &&
        LINE_SET.has(s.line) &&
        (s.zone === "v1" || s.zone === "later") &&
        (s.status === "done" || s.status === "prog" || s.status === "plan"),
    )
  );
}
