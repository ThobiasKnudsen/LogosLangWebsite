// Browser-safe rendering of the roadmap dependency map, shared by the build and the
// client. The build (build/pages.ts) renders the static page at DEFAULT_ASPECT so it
// works with JS off; the client (client/main.ts) re-renders the same layout with the
// visitor's real window width:height ratio and keeps it in step with resizes. NO
// node imports (same rule as roadmap.ts).
//
// The roadmap is LogosLang's `roadmap`-labelled GitHub issues grouped into
// MILESTONE BANDS (build/roadmap.ts + fetch-roadmap.ts). The issue tracker is the
// single source of truth. Each milestone is a horizontal "finish line": its issues
// render in the band directly above the line, and every later milestone (and its
// issues) renders below it. The "blocked by" links are drawn as arrows from a
// blocker down to what it unblocks; dependencies that cross a milestone boundary
// are drawn in the same style. Status is derived from the graph (Done / Ready /
// Blocked); every roadmap issue must have a milestone. Layout is hand-rolled in
// bandedMap: tiered rows centered on a shared spine, long edges routed down a
// side channel.

import { bandsOf, type Band, type Roadmap, type Station } from "./roadmap.ts";

// The card aspect the build bakes into the static page: a typical landscape window.
// The client re-renders with the actual window ratio (portrait phones ~1:2).
export const DEFAULT_ASPECT = 16 / 9;

/** Local copy of templates.ts's escapeHtml: templates.ts reads process.env at module
 *  level, so importing it here would break the client bundle. */
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Node sizing for the dependency map. Nodes are HTML cards; the layout places them
// and routes edges around them. Each card aims at an `aspect`:1 (wide:tall) shape,
// the window's own proportions: since taller text needs a wider card to keep that
// ratio, we solve width = aspect * height (height falls as width grows) per card,
// then clamp. Cards with more text end up both wider and taller, but keep the same
// proportion; the reserved height hugs the text with no dead space below (so a short
// card that bottoms out at the minimum width stays flatter than the target), and the
// tags sit on the top row next to `#N`. CSS caps the width to `calc(100vw - 3rem)`
// so a card is never wider than the window (phones).
const PADDING_X = 24; // .depnode left + right padding (0.75rem * 2)
const BLURB_PX_PER_CHAR = 6.7; // average char advance for the blurb font (tight fit)
const TITLE_PX_PER_CHAR = 7.6; // ... and for the larger title font
const NODE_MIN_W = 220;
const NODE_MAX_W = 560;

/** Wrapped row count for `text` in a card of `width`, from the font's char advance. */
function estLines(text: string, width: number, pxPerChar: number): number {
  if (!text) return 0;
  const cpl = Math.max(1, (width - PADDING_X) / pxPerChar);
  return Math.max(1, Math.ceil(text.length / cpl));
}

const LABEL_ROW_H = 22; // height of one wrapped row of label chips
const NUM_W = 34; // width of the leading "#NN" that shares the top row with the tags
// Rows the tags add BELOW the top row. The top row already holds `#N` and the first
// row of tags, so a normal short tag list adds no height at all.
function estLabelExtraRows(
  labels: { name: string }[] = [],
  width: number,
): number {
  if (!labels || labels.length === 0) return 0;
  let avail = width - PADDING_X - NUM_W; // first row shares space with `#N`
  let cur = 0;
  let rows = 1;
  for (const l of labels) {
    const chipW = l.name.length * 6.5 + 20; // chars + chip padding + gap
    if (cur > 0 && cur + chipW > avail) {
      rows++;
      cur = chipW;
      avail = width - PADDING_X; // wrapped rows use the full width
    } else {
      cur += chipW;
    }
  }
  return rows - 1;
}

/** Reserved card height for a given width: padding + top row (#N + first tag row) +
 *  any wrapped tag rows + title + (gap + blurb). Hugs the text, no dead space. */
function heightForWidth(s: Station, width: number): number {
  const titleLines = estLines(s.title, width, TITLE_PX_PER_CHAR);
  const blurbLines = estLines(s.blurb, width, BLURB_PX_PER_CHAR);
  const extraRows = estLabelExtraRows(s.labels, width);
  return (
    18 +
    22 +
    extraRows * LABEL_ROW_H +
    titleLines * 19 +
    (blurbLines ? 6 + blurbLines * 18 : 0) +
    4
  );
}

/**
 * Width and height for a card, aiming at `aspect`:1 (wide:tall). height(width) is
 * non-increasing (wider wraps to fewer rows), so f(w) = w - aspect*height(w) rises
 * monotonically and has one root: the width at which the ratio is hit. Binary-search
 * it, clamp to [MIN, MAX], then set the width to exactly aspect*height so the box
 * reads at the target ratio (short cards that bottom out at MIN stay a bit flatter).
 */
function nodeDims(s: Station, aspect: number): { w: number; h: number } {
  const f = (w: number) => w - aspect * heightForWidth(s, w);
  let w: number;
  if (f(NODE_MIN_W) >= 0) w = NODE_MIN_W;
  else if (f(NODE_MAX_W) <= 0) w = NODE_MAX_W;
  else {
    let lo = NODE_MIN_W;
    let hi = NODE_MAX_W;
    for (let i = 0; i < 40; i++) {
      const mid = (lo + hi) / 2;
      if (f(mid) < 0) lo = mid;
      else hi = mid;
    }
    w = (lo + hi) / 2;
  }
  const h = heightForWidth(s, w);
  return { w: Math.min(NODE_MAX_W, Math.max(NODE_MIN_W, aspect * h)), h };
}

/** Readable text colour (near-black or white) over a GitHub label's 6-hex colour. */
function labelTextColor(hex: string): string {
  if (!/^[0-9a-fA-F]{6}$/.test(hex)) return "var(--heading)";
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  // Perceptual luminance; light labels get dark text, dark labels get white.
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.6 ? "#1b1b1b" : "#ffffff";
}

/** A card's label chips, coloured like GitHub. They sit inline on the top row next to
 *  `#N`; returns the chip spans (no wrapper), or "" when there are none. */
function labelChipsHtml(
  labels: { name: string; color: string }[] = [],
): string {
  if (!labels || labels.length === 0) return "";
  return labels
    .map((l) => {
      const valid = /^[0-9a-fA-F]{6}$/.test(l.color);
      const bg = valid ? `#${l.color}` : "var(--code-bg)";
      const fg = valid ? labelTextColor(l.color) : "var(--heading)";
      return `<span class="deplabel" style="background:${bg};color:${fg}">${escapeHtml(l.name)}</span>`;
    })
    .join("");
}

// Padding around the whole graph on the canvas.
const CANVAS_PAD = 8;

/** SVG path through `pts` with every bend rounded by up to `r` px (quadratic
 *  corners, trimmed to half of the shorter adjacent segment). Degenerate
 *  (near-duplicate) vertices are skipped so callers can emit them freely. */
function roundedPath(pts: { x: number; y: number }[], r: number): string {
  const f = (n: number) => n.toFixed(1);
  const clean = pts.filter(
    (p, i) => i === 0 || Math.hypot(p.x - pts[i - 1]!.x, p.y - pts[i - 1]!.y) > 0.5,
  );
  let d = `M${f(clean[0]!.x)},${f(clean[0]!.y)}`;
  for (let i = 1; i < clean.length - 1; i++) {
    const a = clean[i - 1]!;
    const p = clean[i]!;
    const b = clean[i + 1]!;
    const la = Math.hypot(p.x - a.x, p.y - a.y);
    const lb = Math.hypot(b.x - p.x, b.y - p.y);
    const t = Math.min(r, la / 2, lb / 2);
    const p1 = { x: p.x - ((p.x - a.x) / la) * t, y: p.y - ((p.y - a.y) / la) * t };
    const p2 = { x: p.x + ((b.x - p.x) / lb) * t, y: p.y + ((b.y - p.y) / lb) * t };
    d += ` L${f(p1.x)},${f(p1.y)} Q${f(p.x)},${f(p.y)} ${f(p2.x)},${f(p2.y)}`;
  }
  const last = clean[clean.length - 1]!;
  d += ` L${f(last.x)},${f(last.y)}`;
  return d;
}

/** A milestone's due date as a compact label, or "" when there is no due date. */
function formatDue(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const when = d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
  return `Due ${when}`;
}

/** The milestone "finish line": a full-width rule with a label pill on the left
 *  (`stack` puts the pill above the rule instead, for narrow windows). */
function milestoneLineHtml(
  band: Band,
  centerY: number,
  width: number,
  height: number,
  stack: boolean,
): string {
  const m = band.milestone;
  const total = band.stations.length;
  const done = band.stations.filter((s) => s.status === "done").length;
  const meta = [
    formatDue(m.dueOn),
    total ? `${done}/${total} done` : "no issues yet",
  ]
    .filter(Boolean)
    .join(" · ");
  const inner =
    `<span class="msline__flag">Milestone</span>` +
    `<span class="msline__title">${escapeHtml(m.title)}</span>` +
    (meta ? `<span class="msline__meta">${escapeHtml(meta)}</span>` : "");
  const label = m.url
    ? `<a class="msline__label" href="${escapeHtml(m.url)}" target="_blank" rel="noopener noreferrer">${inner}</a>`
    : `<span class="msline__label">${inner}</span>`;
  const cls =
    (m.state === "closed" ? " msline--closed" : "") + (stack ? " msline--stack" : "");
  const top = (centerY - height / 2).toFixed(1);
  return `<div class="msline${cls}" style="left:0;top:${top}px;width:${width}px;height:${height}px">${label}<span class="msline__line"></span></div>`;
}

/** Rough pixel width of a milestone label pill, used to size the left gutter so no
 *  node (and thus no cross-band edge) is placed behind a label. Over-estimates
 *  rather than under, so labels always clear the graph. */
function estLabelWidth(band: Band): number {
  const m = band.milestone;
  const total = band.stations.length;
  const done = band.stations.filter((s) => s.status === "done").length;
  const meta = [
    formatDue(m.dueOn),
    total ? `${done}/${total} done` : "no issues yet",
  ]
    .filter(Boolean)
    .join(" · ");
  // "MILESTONE" flag (~62) + title (serif ~1rem) + meta (0.75rem) + padding/gaps (~54).
  return 62 + m.title.length * 8.5 + meta.length * 5.6 + 54;
}

/**
 * Lay out the whole roadmap by hand. The graph is a tiered DAG, so rows do the work:
 * within each milestone band, one row per tier (build order), and after a band's
 * rows its milestone line. Every row is centered on a shared vertical spine, which
 * keeps a chain of single issues perfectly straight (no sideways drift) and makes
 * the canvas exactly as wide as the widest row.
 *
 * Edges leave a card's bottom and enter the target's top (spread across the card
 * so several arrows never stack on one point), and follow METRO-MAP rules: every
 * segment is vertical, horizontal, or at exactly 45 degrees, with small rounded
 * bends. An edge to the next row runs straight down when it can, takes one 45
 * segment when the sideways offset fits the gap, and inserts a horizontal run
 * between two 45 bends when it does not. An edge that spans further is routed down
 * a CHANNEL: it drops into the gap under its source row, runs sideways just past
 * the rows it has to descend past, drops down that lane, and comes back in above
 * its target, with 45-degree bevels at every turn. A lane clears the widest row it
 * actually passes (not the widest row of the whole graph), so channel edges hug
 * the graph without ever crossing a card. The whole canvas is shifted right by a LEFT GUTTER wide
 * enough for the widest milestone label pill, which stays flush-left so cards never
 * sit behind a label.
 */
function bandedMap(bands: Band[], stations: Station[], aspect: number): string {
  // On a portrait window the left gutter would push the whole graph off-screen, so
  // STACK the milestone label above its rule (taller line row, no gutter) instead.
  const stack = aspect < 1;
  const LINE_H = stack ? 64 : 30; // reserved vertical space for a milestone line
  const LABEL_MARGIN = 28; // clear space between the label column and the graph
  const NODESEP = 24; // horizontal gap between cards in a row
  const ROWGAP = 44; // vertical gap between consecutive card rows
  const LINEGAP = 28; // vertical gap between a milestone line and the row beside it
  const LANE_W = 16; // horizontal spacing between channel lanes
  const CHANNEL_PAD = 20; // gap between a lane and the widest row it passes
  const STUB = 8; // minimum straight stub where an edge leaves/enters a card
  const BEVEL = 10; // size of the 45-degree cut replacing a square channel corner
  const BEND = 6; // rounding radius applied to every bend
  const LABEL_GUTTER = stack
    ? 0
    : Math.min(340, Math.round(Math.max(...bands.map(estLabelWidth)) + LABEL_MARGIN));

  const dims = new Map<number, { w: number; h: number }>();
  for (const s of stations) dims.set(s.number, nodeDims(s, aspect));
  const byNum = new Map(stations.map((s) => [s.number, s]));

  // Rows: per band, its stations grouped by tier (ascending), then the band's line.
  type RowSpec = { kind: "nodes"; stations: Station[] } | { kind: "line"; band: Band };
  const rowsSpec: RowSpec[] = [];
  for (const band of bands) {
    const tiers = new Map<number, Station[]>();
    for (const s of band.stations) {
      const list = tiers.get(s.tier);
      if (list) list.push(s);
      else tiers.set(s.tier, [s]);
    }
    for (const t of [...tiers.keys()].sort((a, b) => a - b))
      rowsSpec.push({ kind: "nodes", stations: tiers.get(t)! });
    rowsSpec.push({ kind: "line", band });
  }
  const nodeRows = rowsSpec.filter((r): r is Extract<RowSpec, { kind: "nodes" }> => r.kind === "nodes");

  // Order within each row by the mean position of a station's neighbours in nearby
  // rows (barycenter sweeps, forward over blockers then backward over dependents),
  // so edges run as straight down as the row memberships allow. Ties keep issue
  // number order, which also makes the layout deterministic.
  const pos = new Map<number, number>();
  for (const r of nodeRows) r.stations.forEach((s, i) => pos.set(s.number, i));
  const childrenOf = new Map<number, number[]>();
  for (const s of stations)
    for (const b of s.blockedBy) {
      const list = childrenOf.get(b);
      if (list) list.push(s.number);
      else childrenOf.set(b, [s.number]);
    }
  for (let sweep = 0; sweep < 4; sweep++) {
    const forward = sweep % 2 === 0;
    for (const r of forward ? nodeRows : [...nodeRows].reverse()) {
      const key = (s: Station): number => {
        const nbrs = forward ? s.blockedBy : (childrenOf.get(s.number) ?? []);
        const ps = nbrs.map((n) => pos.get(n)).filter((v): v is number => v !== undefined);
        return ps.length ? ps.reduce((a, b) => a + b, 0) / ps.length : pos.get(s.number)!;
      };
      r.stations.sort((a, b) => key(a) - key(b) || a.number - b.number);
      r.stations.forEach((s, i) => pos.set(s.number, i));
    }
  }

  // Stack the rows on a y axis and center each on x = 0 (the spine).
  const center = new Map<number, { x: number; y: number }>();
  const rowOf = new Map<number, number>(); // station -> index into rowGeo
  const rowGeo: { top: number; bottom: number; left: number; right: number }[] = [];
  const lines: { band: Band; y: number }[] = [];
  let y = 0;
  let halfW = 0; // half the widest row: the graph's horizontal extent from the spine
  let prev: "nodes" | "line" | null = null;
  for (const row of rowsSpec) {
    if (row.kind === "nodes") {
      if (prev !== null) y += prev === "nodes" ? ROWGAP : LINEGAP;
      const totalW =
        row.stations.reduce((a, s) => a + dims.get(s.number)!.w, 0) +
        NODESEP * (row.stations.length - 1);
      const rowH = Math.max(...row.stations.map((s) => dims.get(s.number)!.h));
      halfW = Math.max(halfW, totalW / 2);
      let x = -totalW / 2;
      for (const s of row.stations) {
        const d = dims.get(s.number)!;
        center.set(s.number, { x: x + d.w / 2, y: y + rowH / 2 });
        rowOf.set(s.number, rowGeo.length);
        x += d.w + NODESEP;
      }
      rowGeo.push({ top: y, bottom: y + rowH, left: -totalW / 2, right: totalW / 2 });
      y += rowH;
      prev = "nodes";
    } else {
      if (prev !== null) y += LINEGAP;
      lines.push({ band: row.band, y: y + LINE_H / 2 });
      y += LINE_H;
      prev = "line";
    }
  }
  const totalH = y;

  // Edges. Adjacent rows (or closer, the degenerate same-row/upward case that real
  // dependency data does not produce) get a direct bezier; anything longer goes to a
  // channel lane on the side nearer the midpoint of its endpoints.
  interface Edge {
    from: Station;
    to: Station;
    laneX?: number; // set only on channel edges
    ex?: number; // exit x on the source's bottom edge
    ix?: number; // entry x on the target's top edge
    runY?: number; // corridor track of a direct edge's horizontal run
    outY?: number; // ... of a channel's run below its source row
    inY?: number; // ... of a channel's run above its target row
  }
  const edges: Edge[] = [];
  for (const s of stations)
    for (const b of s.blockedBy) {
      const from = byNum.get(b);
      if (from) edges.push({ from, to: s });
    }
  const isChannel = (e: Edge) => rowOf.get(e.to.number)! - rowOf.get(e.from.number)! > 1;
  for (const side of [-1, 1]) {
    const group = edges
      .filter(
        (e) =>
          isChannel(e) &&
          (center.get(e.from.number)!.x + center.get(e.to.number)!.x <= 0 ? -1 : 1) === side,
      )
      // Shorter spans on inner lanes, so nested channels do not cross each other.
      .sort(
        (a, b) =>
          rowOf.get(a.to.number)! - rowOf.get(a.from.number)! -
          (rowOf.get(b.to.number)! - rowOf.get(b.from.number)!),
      );
    let minAbs = 0; // keeps this side's lanes at least LANE_W apart
    group.forEach((e) => {
      // The lane only has to clear the rows the edge descends past (those strictly
      // between its source row and its target row), not the whole graph.
      let clear = 0;
      for (let r = rowOf.get(e.from.number)! + 1; r < rowOf.get(e.to.number)!; r++)
        clear = Math.max(clear, side === -1 ? -rowGeo[r]!.left : rowGeo[r]!.right);
      const abs = Math.max(clear + CHANNEL_PAD, minAbs);
      minAbs = abs + LANE_W;
      e.laneX = side * abs;
    });
  }

  // Spread the endpoints on each card: several edges leaving (or entering) one card
  // get distinct x positions across its bottom (or top) edge, ordered by where the
  // edge is headed so the fan never crosses itself right at the card.
  const spreadEndpoints = (
    grouped: Map<number, Edge[]>,
    headedX: (e: Edge) => number,
    assign: (e: Edge, x: number) => void,
  ): void => {
    for (const [num, list] of grouped) {
      const c = center.get(num)!;
      const w = dims.get(num)!.w;
      list.sort((a, b) => headedX(a) - headedX(b));
      const k = list.length;
      const step = k > 1 ? Math.min(44, (w * 0.7) / (k - 1)) : 0;
      list.forEach((e, i) => assign(e, c.x + (i - (k - 1) / 2) * step));
    }
  };
  const groupBy = (keyOf: (e: Edge) => number): Map<number, Edge[]> => {
    const m = new Map<number, Edge[]>();
    for (const e of edges) {
      const list = m.get(keyOf(e));
      if (list) list.push(e);
      else m.set(keyOf(e), [e]);
    }
    return m;
  };
  spreadEndpoints(
    groupBy((e) => e.from.number),
    (e) => e.laneX ?? center.get(e.to.number)!.x,
    (e, x) => {
      e.ex = x;
    },
  );
  spreadEndpoints(
    groupBy((e) => e.to.number),
    (e) => e.laneX ?? center.get(e.from.number)!.x,
    (e, x) => {
      e.ix = x;
    },
  );

  // Corridor tracks: every horizontal run (a direct edge's sideways run, a
  // channel's run below its source row or above its target row) lives in the
  // corridor between two node rows. Runs sharing a corridor zone get distinct,
  // evenly spaced y tracks, so two lines may cross but never lie on top of each
  // other. A milestone line splits its corridor into an upper zone (runs leaving
  // the row above) and a lower zone (runs entering the row below).
  const sbOf = (e: Edge) => center.get(e.from.number)!.y + dims.get(e.from.number)!.h / 2;
  const ttOf = (e: Edge) => center.get(e.to.number)!.y - dims.get(e.to.number)!.h / 2;
  const needsRun = (e: Edge): boolean => {
    if (e.laneX !== undefined) return false;
    const G = ttOf(e) - sbOf(e);
    const adx = Math.abs(e.ix! - e.ex!);
    return G >= 24 && adx >= 1 && adx > G - 2 * STUB;
  };
  interface RunSlot {
    e: Edge;
    which: "direct" | "out" | "in";
    cx: number; // run midpoint, orders neighbours onto neighbouring tracks
  }
  const zones = new Map<string, { top: number; bottom: number; runs: RunSlot[] }>();
  // The zone for a run below node row `r` ("out"/"direct") or above it ("in").
  const zoneFor = (r: number, side: "below" | "above") => {
    const region = side === "below" ? r : r - 1;
    let top = rowGeo[region]!.bottom;
    let bottom = rowGeo[region + 1]!.top;
    let key = `r${region}`;
    const between = lines.filter((l) => l.y > top && l.y < bottom);
    if (between.length > 0) {
      if (side === "below") {
        bottom = Math.min(...between.map((l) => l.y - LINE_H / 2));
        key += "u";
      } else {
        top = Math.max(...between.map((l) => l.y + LINE_H / 2));
        key += "l";
      }
    }
    let z = zones.get(key);
    if (!z) {
      z = { top, bottom, runs: [] };
      zones.set(key, z);
    }
    return z;
  };
  for (const e of edges) {
    if (e.laneX !== undefined) {
      zoneFor(rowOf.get(e.from.number)!, "below").runs.push({
        e,
        which: "out",
        cx: (e.ex! + e.laneX) / 2,
      });
      zoneFor(rowOf.get(e.to.number)!, "above").runs.push({
        e,
        which: "in",
        cx: (e.laneX + e.ix!) / 2,
      });
    } else if (needsRun(e)) {
      zoneFor(rowOf.get(e.from.number)!, "below").runs.push({
        e,
        which: "direct",
        cx: (e.ex! + e.ix!) / 2,
      });
    }
  }
  for (const z of zones.values()) {
    z.runs.sort((a, b) => a.cx - b.cx || a.e.to.number - b.e.to.number);
    const PAD = 10; // clearance a track keeps from the rows bounding its zone
    const step = z.runs.length > 1 ? Math.min(7, (z.bottom - z.top - 2 * PAD) / (z.runs.length - 1)) : 0;
    z.runs.forEach((r, i) => {
      const y = z.top + PAD + i * step;
      if (r.which === "direct") r.e.runY = y;
      else if (r.which === "out") r.e.outY = y;
      else r.e.inY = y;
    });
  }

  const minX = Math.min(-halfW, ...edges.map((e) => e.laneX ?? Infinity)) - 1;
  const maxX = Math.max(halfW, ...edges.map((e) => e.laneX ?? -Infinity)) + 1;
  const offX = CANVAS_PAD + LABEL_GUTTER - minX;
  const offY = CANVAS_PAD;
  const W = Math.max(Math.ceil(maxX - minX + CANVAS_PAD * 2 + LABEL_GUTTER), 320);
  const H = Math.ceil(totalH + CANVAS_PAD * 2);
  const fx = (x: number) => (x + offX).toFixed(1);
  const fy = (v: number) => (v + offY).toFixed(1);

  const edgesHtml = edges
    .map((e) => {
      const cf = center.get(e.from.number)!;
      const ct = center.get(e.to.number)!;
      const sb = cf.y + dims.get(e.from.number)!.h / 2; // source bottom
      const tt = ct.y - dims.get(e.to.number)!.h / 2; // target top
      const ex = e.ex!;
      const ix = e.ix!;
      let pts: { x: number; y: number }[];
      if (e.laneX === undefined) {
        const G = tt - sb; // vertical room between the cards
        const adx = Math.abs(ix - ex);
        const dir = Math.sign(ix - ex);
        if (G < 24 || adx < 1) {
          // Straight down (or the degenerate upward case real data never produces).
          pts = [
            { x: ex, y: sb },
            { x: ix, y: tt },
          ];
        } else if (adx <= G - 2 * STUB) {
          // The offset fits one centered 45-degree segment: stub, diagonal, stub.
          const y1 = sb + (G - adx) / 2;
          pts = [
            { x: ex, y: sb },
            { x: ex, y: y1 },
            { x: ix, y: y1 + adx },
            { x: ix, y: tt },
          ];
        } else {
          // Too wide for one diagonal: horizontal run between two 45-degree bends,
          // on the corridor track this run was allocated (unique per corridor zone).
          const yr = e.runY!;
          const b = Math.max(2, Math.min(16, yr - sb, tt - yr, adx / 2)); // bend rise
          pts = [
            { x: ex, y: sb },
            { x: ex, y: yr - b },
            { x: ex + dir * b, y: yr },
            { x: ix - dir * b, y: yr },
            { x: ix, y: yr + b },
            { x: ix, y: tt },
          ];
        }
      } else {
        // Channel route: down, 45 bevel into the run below the source row, out past
        // the rows it must clear, down the lane, and back in above the target row.
        // Both runs sit on allocated corridor tracks. Only 0/45/90-degree segments.
        const lane = e.laneX;
        const runOut = e.outY!;
        const runIn = e.inY!;
        const d1 = lane > ex ? 1 : -1; // horizontal direction out to the lane
        const d2 = ix > lane ? 1 : -1; // ... and back in to the target
        pts = [
          { x: ex, y: sb },
          { x: ex, y: runOut - BEVEL },
          { x: ex + d1 * BEVEL, y: runOut },
          { x: lane - d1 * BEVEL, y: runOut },
          { x: lane, y: runOut + BEVEL },
          { x: lane, y: runIn - BEVEL },
          { x: lane + d2 * BEVEL, y: runIn },
          { x: ix - d2 * BEVEL, y: runIn },
          { x: ix, y: runIn + BEVEL },
          { x: ix, y: tt },
        ];
      }
      const d = roundedPath(
        pts.map((p) => ({ x: p.x + offX, y: p.y + offY })),
        BEND,
      );
      return `<path class="depedge" d="${d}" marker-end="url(#dep-arrow)" />`;
    })
    .join("");

  const nodesHtml = stations
    .map((s) => {
      const c = center.get(s.number)!;
      const { w, h } = dims.get(s.number)!;
      const left = fx(c.x - w / 2);
      const top = fy(c.y - h / 2);
      const href = s.url
        ? ` href="${escapeHtml(s.url)}" target="_blank" rel="noopener noreferrer"`
        : "";
      const desc = s.blurb
        ? `<p class="depnode__desc">${escapeHtml(s.blurb)}</p>`
        : "";
      const labels = labelChipsHtml(s.labels);
      return `<a class="depnode depnode--${s.status}"${href} style="left:${left}px;top:${top}px;width:${w}px;height:${h}px"><div class="depnode__top"><span class="depnode__num">#${s.number}</span>${labels}</div><h3 class="depnode__title">${escapeHtml(s.title)}</h3>${desc}</a>`;
    })
    .join("");

  const linesHtml = lines
    .map((l) => milestoneLineHtml(l.band, l.y + offY, W, LINE_H, stack))
    .join("");

  return `<div class="depmap-scroll"><div class="depmap" style="width:${W}px;height:${H}px" role="img" aria-label="Roadmap milestones and dependency graph"><svg class="depmap__edges" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" aria-hidden="true"><defs><marker id="dep-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto"><path d="M0,0 L8,4 L0,8 z" /></marker></defs>${edgesHtml}</svg>${linesHtml}${nodesHtml}</div></div>`;
}

/** The full dependency map (scroll wrapper included) at a card aspect of
 *  `aspect`:1, or "" when there are no milestones yet. */
export function depmapHtml(roadmap: Roadmap, aspect: number): string {
  const bands = bandsOf(roadmap);
  if (bands.length === 0) return "";
  return bandedMap(bands, roadmap.stations, aspect);
}
