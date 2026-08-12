// Inner HTML for the marketing pages. Kept faithful to the established design:
// a hero leading with the machine-written-code thesis (its actions are the vision
// and roadmap; the get-notified form lives at the bottom of the page until real
// builds exist), a target-syntax code card, a scrolling frieze of Greek reflections
// on the Logos, and the honest comparison matrix beneath it.
import { escapeHtml } from "./templates.ts";
import {
  OS_ORDER,
  OS_LABELS,
  ARCH_LABELS,
  assetsForOs,
  installCommand,
  releasesWithWasm,
  type Release,
  type Os,
  type Asset,
} from "./releases.ts";
import { type Roadmap } from "./roadmap.ts";
import { depmapHtml, DEFAULT_ASPECT } from "./roadmap-render.ts";

const GITHUB = "https://github.com/ThobiasKnudsen/LogosLang";

// Reflections on the Logos across the ages, scrolled as a slow frieze beneath the
// hero. The wording is kept verbatim (EB Garamond, selectable); the attribution under
// each is in English. Greek antiquity and the Latin (Vulgate John, Anselm, Aquinas)
// meet on the one Word, Λόγος / Verbum, through which all things are made and known.
// Attributions name only the person (and "John 1:1" / "Hebrews 4:12" alone, so the
// frieze reads as antiquity rather than as a denominational statement). Full sources
// for the record:
// John 1:1 (Vulgate); Heraclitus, Fragment 1 (DK B1); Gorgias, Encomium of Helen 8;
// Anselm, Monologion 30; Aristotle, Politics 1253a; Cicero, De Officiis 1.50;
// Heraclitus, Fragment 45 (DK B45); Plato, Sophist 263e; Seneca, Epistles 115.2;
// Isocrates, Nicocles 7; Thomas Aquinas, Summa Theologiae I.34.3; Philo of
// Alexandria; Heraclitus, Fragment 115 (DK B115); Disticha Catonis 1.10 (second
// hemistich); Hebrews 4:12; the "verba volant" line is a traditional Latin proverb
// with no single ancient source.
// Each quote carries explicit "\n" line breaks (honored by `white-space: pre-line` in
// the CSS) so it reads as a short stanza. Wording is untouched except the Aristotle
// line, which drops its trailing ellipsis (the internal "…" stays, marking a real
// elision between two clauses in the Politics).
// NOTE: the "Stoic tradition" line's exact source is uncertain; swap in a precise
// citation when you have one.
// Ordered so Greek and Latin mix: with 10 Greek and 7 Latin, the Latin quotes sit at
// positions 0/3/5/8/10/13/15, so no two Latin run back to back and Greek never runs
// more than two in a row, including across the frieze's loop wrap
// (last -> first is Greek -> Latin).
const WISDOM: { text: string; author: string }[] = [
  {
    text: "In principio erat Verbum,\net Verbum erat apud Deum,\net Deus erat Verbum.",
    author: "John 1:1",
  },
  {
    text: "τοῦ δὲ λόγου τοῦδ’ ἐόντος αἰεὶ\nἀξύνετοι γίνονται ἄνθρωποι\nκαὶ πρόσθεν ἢ ἀκούσασι\nκαὶ ἀκούσαντες τὸ πρῶτον.",
    author: "Heraclitus",
  },
  {
    text: "λόγος δυνάστης μέγας ἐστίν,\nὃς σμικροτάτῳ σώματι καὶ ἀφανεστάτῳ\nθειότατα ἔργα ἀποτελεῖ.",
    author: "Gorgias",
  },
  {
    text: "Non igitur constat pluribus verbis,\nsed est unum Verbum\nper quod facta sunt omnia.",
    author: "Anselm",
  },
  {
    text: "λόγον δὲ μόνον ἄνθρωπος ἔχει τῶν ζῴων…\nὁ δὲ λόγος ἐπὶ τῷ δηλοῦν ἐστι\nτὸ συμφέρον καὶ τὸ βλαβερόν,\nὥστε καὶ τὸ δίκαιον καὶ τὸ ἄδικον",
    author: "Aristotle",
  },
  {
    text: "Eius autem vinculum est\nratio et oratio.",
    author: "Cicero",
  },
  {
    text: "ψυχῆς πείρατα ἰὼν οὐκ ἂν ἐξεύροιο,\nπᾶσαν ἐπιπορευόμενος ὁδόν·\nοὕτω βαθὺν λόγον ἔχει.",
    author: "Heraclitus",
  },
  {
    text: "διάνοια μὲν καὶ λόγος ταὐτόν·\nπλὴν ὁ μὲν ἐντὸς τῆς ψυχῆς\nπρὸς αὑτὴν διάλογος ἄνευ φωνῆς γιγνόμενος.",
    author: "Plato",
  },
  {
    text: "Oratio vultus animi est.",
    author: "Seneca",
  },
  {
    text: "λόγος ἀληθὴς καὶ νόμιμος καὶ δίκαιος\nψυχῆς ἀγαθῆς καὶ πιστῆς\nεἴδωλόν ἐστι.",
    author: "Isocrates",
  },
  {
    text: "Deus uno actu et se et omnia intelligit,\nunicum Verbum eius est expressivum\nnon solum Patris, sed etiam creaturarum.",
    author: "Thomas Aquinas",
  },
  {
    text: "ὁ δὲ τοῦ θεοῦ λόγος ἐστὶν\nὁ δεσμός τῶν πάντων,\nσυνέχων τὰ μέρη καὶ σφίγγων.",
    author: "Philo of Alexandria",
  },
  {
    text: "ψυχῆς ἐστι λόγος\nἑαυτὸν αὔξων.",
    author: "Heraclitus",
  },
  {
    text: "Sermo datur cunctis,\nanimi sapientia paucis.",
    author: "Disticha Catonis",
  },
  {
    text: "ζῶν γὰρ ὁ λόγος τοῦ θεοῦ καὶ ἐνεργὴς\nκαὶ τομώτερος ὑπὲρ\nπᾶσαν μάχαιραν δίστομον.",
    author: "Hebrews 4:12",
  },
  {
    text: "Verba volant,\nscripta manent.",
    author: "Latin proverb",
  },
  {
    text: "ὁ δὲ θεὸς οὐδὲν ἄλλο ἐστὶν\nἢ νοῦς καὶ λόγος.",
    author: "Stoic tradition",
  },
];

/** 'grc' for the Greek stanzas, 'la' for the Latin ones, detected from the script so
 *  the quote list stays plain data. The lang attribute lets screen readers switch
 *  voice instead of reading ancient Greek with English pronunciation (WCAG 3.1.2). */
function quoteLang(text: string): "grc" | "la" {
  return /[Ͱ-Ͽἀ-῿]/.test(text) ? "grc" : "la";
}

/** The quote units of the frieze: each quote appears exactly once, as a stanza plus
 *  its trailing manuscript ornament. The endless loop is achieved in the client by
 *  rotating whole units from one end of the track to the other as they scroll out of
 *  view (see initWisdom), never by rendering the sequence twice. */
function wisdomUnits(): string {
  return WISDOM.map(
    (q) =>
      `<div class="wisdom__unit"><figure class="wisdom__quote"><blockquote class="wisdom__greek" lang="${quoteLang(
        q.text,
      )}">${escapeHtml(
        q.text,
      )}</blockquote><figcaption class="wisdom__author">- ${escapeHtml(
        q.author,
      )}</figcaption></figure><span class="wisdom__sep" aria-hidden="true">❦</span></div>`,
  ).join("");
}

// ── Get-notified form ─────────────────────────────────────────────────────────
// The intent-capture form shown on the home hero and the (empty) download page.
// Posts to the subscribe Pages Function (functions/api/subscribe.ts); client/main.ts
// (initNotify) upgrades it to an inline fetch with a status line, and with JS off
// the function answers with a small HTML page instead, so the form never dead-ends.
// The `website` field is a honeypot: visually hidden and ignored by people, and any
// value in it makes the function silently drop the submission.
function notifyFormHtml(source: string): string {
  return `<form class="notify" method="post" action="/api/subscribe" data-notify>
      <input type="hidden" name="source" value="${source}" />
      <p class="notify__hp" aria-hidden="true"><label>Leave this field empty <input type="text" name="website" tabindex="-1" autocomplete="off" /></label></p>
      <div class="notify__row">
        <input class="notify__email" type="email" name="email" required maxlength="254" placeholder="you@example.com" autocomplete="email" aria-label="Email address" />
        <button class="logos-btn logos-btn--download notify__submit" type="submit">Get notified</button>
      </div>
      <p class="notify__status" role="status" aria-live="polite"></p>
    </form>`;
}

// ── Homepage code sample ──────────────────────────────────────────────────────
// Honest target syntax tracking DESIGN.md (the design's vocabulary wins where the
// seed's sketch lags it: the cell is the `synolon` with `logos`/`hyle` slots, the
// former `type`/`struct` are merged into the one identity `logos`, and pointer
// logos are prefix `@T`). It shows the headline (everyday code and the language's
// own definition living in one graph) rather than a CAS demo. The declare/reassign
// lines follow reference/operators verbatim; the fn signature and `error «…»` body
// follow language_sketch.logos (where `+` is a stub, given a real body here to show
// operators are ordinary identities defined in the language itself); and `?` (the
// typed unknown) is DESIGN.md substrate vocabulary. The card labels it all as
// target syntax so it never overclaims.
const HOME_SAMPLE = `# Declare with \`:=\`, reassign with \`=\`. \`mut\` marks a mutable value.
count := mut i32 0
count = count + 1

# Systems code: borrowed references, checked errors, no GC.
advance := fn (tokens : &mut array synolon, idx : u64) -> void! (
    if idx+1 >= tokens.size
        error «not enough tokens after idx»
)

# The language is written in itself. A node (a synolon) is two slots,
# logos and hyle, and even \`+\` is an ordinary identity: a node carrying
# a precedence and the code for how it reads its operands. There is no
# separate macro language, so new syntax is just more declarations in
# the same graph.
synolon := logos (logos := @synolon ?, hyle := @void ?)
+ := logos (
    shared precedence    := f64 6.0
    shared associativity := u8 left_to_right
    shared constructor   := fn (tokens : &mut array synolon, idx : u64) -> void! ( ? )
)`;

const LOGOS_KEYWORDS = new Set([
  "fn",
  "mut",
  "immut",
  "shared",
  "if",
  "else",
  "for",
  "while",
  "and",
  "or",
  "xor",
  "not",
  "where",
  "eval",
  "self",
  "error",
  "undefined",
]);
// `@synolon` / `@void` tokenize as the `@` operator plus a bare identifier, so the
// pointer-logos names appear here without their prefix.
const LOGOS_TYPES =
  /^(?:[iu](?:8|16|32|64)|f32|f64|string|bool|void!?|synolon|logos|exec)$/;

/** Minimal Logos highlighter for the fixed homepage sample: comments, «strings»,
 *  numbers, keywords, primitive types, and operators become spans; everything else
 *  (including whitespace) is escaped verbatim. Not a general lexer; just enough for
 *  marketing snippets this file controls. */
function highlightLogos(source: string): string {
  const TOKEN =
    /«[^»]*»|\d+(?:\.\d+)?|[A-Za-z_][A-Za-z0-9_@]*!?|:=|->|==|!=|<=|>=|[:=+\-*/%^<>.&@()[\],?!]/g;
  const renderCode = (code: string): string => {
    let out = "";
    let idx = 0;
    for (const m of code.matchAll(TOKEN)) {
      out += escapeHtml(code.slice(idx, m.index));
      const t = m[0];
      if (t.startsWith("«"))
        out += `<span class="tok-str">${escapeHtml(t)}</span>`;
      else if (/^\d/.test(t)) out += `<span class="tok-num">${t}</span>`;
      else if (/^[A-Za-z_]/.test(t))
        out += LOGOS_KEYWORDS.has(t)
          ? `<span class="tok-kw">${t}</span>`
          : LOGOS_TYPES.test(t)
            ? `<span class="tok-type">${t}</span>`
            : escapeHtml(t);
      else out += `<span class="tok-op">${escapeHtml(t)}</span>`;
      idx = m.index + t.length;
    }
    return out + escapeHtml(code.slice(idx));
  };
  return source
    .split("\n")
    .map((line) => {
      const hash = line.indexOf("#");
      if (hash < 0) return renderCode(line);
      return (
        renderCode(line.slice(0, hash)) +
        `<span class="tok-comment">${escapeHtml(line.slice(hash))}</span>`
      );
    })
    .join("\n");
}

// ── "The program is the structure" figure ────────────────────────────────────
// The homepage payoff: the smallest program, `a = a + 1`, drawn as the actual Logic
// Graph it becomes. The shape follows the `a = a + 1` expansion in LogosLang's
// language_sketch.logos (V1PLAN's canonical smoke test), spelled in DESIGN.md's
// vocabulary (synolon/logos/hyle; the sketch's older dyad/type/value spelling is
// superseded). Two node kinds: a SYNOLON node has a `logos` slot and a `hyle` slot;
// a RECORD node (what a `hyle:@void` points at) is the operand record whose fields
// the logos defines, here `lhs` and `rhs`. Every `->` in the source is one edge
// that leaves a single FIELD (a port on the node's right edge, at that field's
// row) and points at a whole NODE. So `a = a + 1` unfolds left to right as
// synolon -> record -> synolon -> record -> synolon, bottoming out at the identity
// nodes `=`, `+`, `rational_number`, the variable `a`, and the literal `1`. Laid
// out as a planar left-to-right tree (leaf rows in reading order, columns by
// depth), rendered as inline SVG with no client JS. The viewBox width is computed
// from the laid-out columns, so wider field text never clips.
const SG_VY = 8; // viewBox top (leaves room for the kind labels above the top nodes)
const SG_VH = 314; // viewBox height

const GNODE_H = 42; // a synolon/record node: two field rows
const GLEAF_H = 26; // an un-expanded identity / literal node
const GROW_Y = [16, 32]; // y of each field row's port, within a node

// Monospace advance widths (~0.6em) for the three font sizes used in the graph, with
// a little margin so text never touches a node edge. Node widths are derived from
// these (structW / leafW), so a field like `value:void@` always fits its box.
const FIELD_CW = 7.9; // .dyad-field, 13px (the field name)
const SLOT_CW = 6.0; // .dyad-slot, 10px (the `:logos` suffix)
const HEAD_CW = 9.7; // .dyad-head, 16px (a leaf identity name)
const PAD_L = 10; // text inset from a node's left edge
const PAD_R = 13; // gap between the text and the right-edge port

const fieldW = (nm: string, ty: string) =>
  nm.length * FIELD_CW + (ty.length + 1) * SLOT_CW;
const structW = (rows: [string, string][]) =>
  Math.ceil(PAD_L + Math.max(...rows.map((r) => fieldW(r[0], r[1]))) + PAD_R);
const leafW = (label: string) =>
  Math.max(30, Math.ceil(label.length * HEAD_CW + 2 * PAD_L + 4));

interface GNode {
  x: number;
  y: number;
  w: number;
  h: number;
  kind: "synolon" | "record" | "leaf";
  /** For a structural node: two [name, logos] fields, e.g. ["logos", "@synolon"]. */
  rows?: [string, string][];
  label?: string;
  /** Kind label drawn above the node. Leaves are synolons too, so they carry one. */
  tag?: string;
}

/** A node: a leaf identity/literal (dashed, just its name) or a two-field synolon /
 *  record box. Each field prints its name and its `:logos` (@synolon / @void), and
 *  carries a port on the right edge, exactly where that field's edge leaves. Every
 *  node shows its kind above it (a leaf's `tag`, a structural node's own kind). */
function gNode(n: GNode): string {
  const kindLabel = (tag: string) =>
    `<text class="dyad-kind" x="${n.x + n.w / 2}" y="${n.y - 5}" text-anchor="middle">${escapeHtml(tag)}</text>`;
  if (n.kind === "leaf") {
    const tag = n.tag ? kindLabel(n.tag) : "";
    return `<g class="dyad-node">${tag}<rect class="dyad-box dyad-box--ref" x="${n.x}" y="${n.y}" width="${n.w}" height="${n.h}" rx="6" /><text class="dyad-head" x="${n.x + n.w / 2}" y="${n.y + n.h / 2 + 5}" text-anchor="middle">${escapeHtml(n.label ?? "")}</text></g>`;
  }
  let s = `<rect class="dyad-box dyad-box--${n.kind}" x="${n.x}" y="${n.y}" width="${n.w}" height="${n.h}" rx="6" />`;
  s += kindLabel(n.kind);
  n.rows!.forEach(([name, ty], i) => {
    const py = n.y + GROW_Y[i]!;
    s += `<text class="dyad-field" x="${n.x + PAD_L}" y="${py + 4}">${escapeHtml(name)}<tspan class="dyad-slot" dx="1">:${escapeHtml(ty)}</tspan></text>`;
    s += `<circle class="dyad-port" cx="${n.x + n.w}" cy="${py}" r="2.5" />`;
  });
  return `<g class="dyad-node">${s}</g>`;
}

/** The right-edge port of a structural node's field `f`, and a node's left-side
 *  entry (where an incoming arrow lands on the whole node). */
function gPort(n: GNode, f: number): [number, number] {
  return [n.x + n.w, n.y + GROW_Y[f]!];
}
function gEntry(n: GNode, dy = 0): [number, number] {
  return [n.x, n.y + n.h / 2 + dy];
}
function gPathEl(pts: [number, number][]): string {
  const d = pts.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x} ${y}`).join(" ");
  return `<path class="dyad-edge" d="${d}" marker-end="url(#dyad-arrow)" />`;
}
/** A short edge from field `f` of `src` to the left side of `dst` (target up- or
 *  down-right): out along a per-field lane, then in. `dy` nudges the landing point. */
function gEdge(src: GNode, f: number, dst: GNode, dy = 0): string {
  const [sx, sy] = gPort(src, f);
  const [tx, ty] = gEntry(dst, dy);
  const mx = sx + (tx - sx) * (0.42 + f * 0.16);
  return gPathEl([
    [sx, sy],
    [mx, sy],
    [mx, ty],
    [tx, ty],
  ]);
}

// The ten nodes of `a = a + 1`, laid out left to right. Every node is a synolon, so
// the leaf identities (`=`, `+`, `a`, `rational_number`) are tagged "synolon" too;
// the literal `1` is the raw matter a hyle bottoms out at, so it is tagged "hyle".
// Column x-positions are derived from each column's widest node, so widening a node
// (for its field text) never overlaps a neighbour. `a` is one shared node two edges
// point at: `+`'s lhs reaches it up-right (short), and `=`'s lhs reaches it along a
// lane over the top of the chain (long).
function structureGraphSvg(): string {
  const synRows: [string, string][] = [
    ["logos", "@synolon"],
    ["hyle", "@void"],
  ];
  const recRows: [string, string][] = [
    ["lhs", "@synolon"],
    ["rhs", "@synolon"],
  ];

  interface Spec {
    id: string;
    col: number;
    y: number;
    kind: "synolon" | "record" | "leaf";
    label?: string;
    tag?: string;
  }
  const specs: Spec[] = [
    { id: "D1", col: 0, y: 52, kind: "synolon" },
    { id: "EQ", col: 1, y: 26, kind: "leaf", label: "=", tag: "synolon" },
    { id: "G1", col: 1, y: 102, kind: "record" },
    { id: "D2", col: 2, y: 154, kind: "synolon" },
    { id: "PLUS", col: 3, y: 128, kind: "leaf", label: "+", tag: "synolon" },
    { id: "G2", col: 3, y: 206, kind: "record" },
    { id: "A", col: 4, y: 162, kind: "leaf", label: "a", tag: "synolon" },
    { id: "D3", col: 4, y: 258, kind: "synolon" },
    {
      id: "RAT",
      col: 5,
      y: 240,
      kind: "leaf",
      label: "rational_number",
      tag: "synolon",
    },
    { id: "ONE", col: 5, y: 290, kind: "leaf", label: "1", tag: "hyle" },
  ];
  const wOf = (s: Spec): number =>
    s.kind === "leaf"
      ? leafW(s.label!)
      : structW(s.kind === "synolon" ? synRows : recRows);

  // Column x from each column's widest node, so nodes never overlap once auto-sized.
  const NCOL = 6;
  const GAP = 30;
  const colW = Array.from({ length: NCOL }, (_, c) =>
    Math.max(...specs.filter((s) => s.col === c).map(wOf)),
  );
  const colX: number[] = [];
  for (let c = 0, x = 16; c < NCOL; c++) {
    colX[c] = x;
    x += colW[c]! + GAP;
  }

  const N: Record<string, GNode> = {};
  for (const s of specs) {
    N[s.id] =
      s.kind === "leaf"
        ? {
            x: colX[s.col]!,
            y: s.y,
            w: wOf(s),
            h: GLEAF_H,
            kind: "leaf",
            label: s.label,
            tag: s.tag,
          }
        : {
            x: colX[s.col]!,
            y: s.y,
            w: wOf(s),
            h: GNODE_H,
            kind: s.kind,
            rows: s.kind === "synolon" ? synRows : recRows,
          };
  }
  const nodes = specs.map((s) => gNode(N[s.id]!)).join("");
  // Natural width of the laid-out graph: the last column's right edge plus the same
  // margin the first column starts at. Used for the viewBox and the width attribute.
  const width = Math.ceil(colX[NCOL - 1]! + colW[NCOL - 1]! + 16);

  // `=`.lhs -> a routed over the top: right stub, up to a lane above the chain,
  // across, then down into a's left side, landing just above +.lhs's landing. The
  // lane sits above the "synolon" kind label over the `+` leaf (at ~y116), so raise it.
  const LANE_Y = 102;
  const [glx, gly] = gPort(N.G1!, 0);
  const [aex, aey] = gEntry(N.A!, -5);
  const eqLhsToA = gPathEl([
    [glx, gly],
    [glx + 14, gly],
    [glx + 14, LANE_Y],
    [aex - 14, LANE_Y],
    [aex - 14, aey],
    [aex, aey],
  ]);

  const edges = [
    gEdge(N.D1!, 0, N.EQ!), // =synolon.logos -> =
    gEdge(N.D1!, 1, N.G1!), // =synolon.hyle  -> record
    eqLhsToA, // =record.lhs -> a (shared, over the top)
    gEdge(N.G1!, 1, N.D2!), // =record.rhs -> +synolon
    gEdge(N.D2!, 0, N.PLUS!), // +synolon.logos -> +
    gEdge(N.D2!, 1, N.G2!), // +synolon.hyle  -> record
    gEdge(N.G2!, 0, N.A!, 5), // +record.lhs -> a (shared)
    gEdge(N.G2!, 1, N.D3!), // +record.rhs -> rational_number synolon
    gEdge(N.D3!, 0, N.RAT!), // rat synolon.logos -> rational_number
    gEdge(N.D3!, 1, N.ONE!), // rat synolon.hyle  -> 1
  ].join("");
  // The inline max-width keeps CSS from stretching the graph past its natural size
  // while letting narrow viewports scroll it at a readable scale (see .dyad-graph).
  return `<svg class="dyad-graph" viewBox="0 ${SG_VY} ${width} ${SG_VH}" width="${width}" height="${SG_VH}" style="max-width:${width}px" role="img" aria-label="The program a = a + 1 as a Logic Graph: a synolon whose logos slot points at = and whose hyle slot points at an operand record; that record's lhs points at the one variable a, and its rhs unfolds into a + synolon and then a rational_number synolon whose hyle is the literal 1. Both lhs fields point at the same a.">
  <defs><marker id="dyad-arrow" viewBox="0 0 8 8" refX="6.5" refY="4" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0 L8 4 L0 8 z" /></marker></defs>
  ${edges}
  ${nodes}
</svg>`;
}

function structureHtml(): string {
  return `<section class="unify" aria-label="A program is the structure that runs it">
  <h2 class="unify__title">The program is the structure</h2>
  <p class="unify__lead">Radical unification is not a metaphor. The smallest program, <code>a = a + 1</code>, is not text a compiler reads once and throws away. It <em>is</em> a graph, the Logic Graph (LG), named because it should be able to hold any logic imaginable. And because it is a graph, the same structure can reflect on itself, interpret itself, or compile and run itself.</p>
  <figure class="unify__figure">
    <pre class="unify__source"><code>${highlightLogos("a = a + 1")}</code></pre>
    <span class="unify__becomes"><span class="unify__becomes-arrow" aria-hidden="true">↓</span> becomes</span>
    <div class="unify__graph">${structureGraphSvg()}</div>
    <figcaption class="unify__caption">Read it left to right: every arrow leaves one <em>field</em> of a node (the <code>:@synolon</code> or <code>:@void</code> next to it is what that field points at) and points at another whole node. A <strong>synolon</strong> is a node of exactly two slots: a <code>logos</code>, which says what the node is, and a <code>hyle</code>, the matter the logos gives meaning to. Here each <code>hyle</code> points at an operand <strong>record</strong> whose fields (<code>lhs</code>, <code>rhs</code>) are defined by the logos. So <code>a = a + 1</code> unfolds into synolons and operand records, bottoming out at the identities <code>=</code>, <code>+</code>, <code>rational_number</code>, the variable <code>a</code>, and the literal <code>1</code>. Both <code>lhs</code> fields point at the one <code>a</code>, so it is genuinely a graph, not a tree. Because your program already is this structure, the same operations that run it can read it, rewrite it, optimize it, and prove it, so the optimizer, the computer-algebra system, the proof checker, and metaprogramming are one thing over one structure rather than four tools bolted on from outside.</figcaption>
  </figure>
</section>`;
}

function codePeekHtml(): string {
  return `<section class="code-peek" aria-label="What Logos looks like">
  <h2 class="code-peek__title">What Logos looks like</h2>
  <p class="code-peek__lead">Target syntax, taken straight from the language design and the <a href="/docs/">docs</a>: everyday systems code and the language's own definition live in the same structure. The compiler that runs it is still being built; the <a href="/roadmap/">roadmap</a> tracks what actually works today.</p>
  <figure class="code-card">
    <figcaption class="code-card__bar"><span class="code-card__name">target-syntax.logos</span><span class="code-card__badge">target syntax, not yet runnable</span></figcaption>
    <pre class="code-card__pre"><code>${highlightLogos(HOME_SAMPLE)}</code></pre>
  </figure>
</section>`;
}

// ── Comparison matrix ─────────────────────────────────────────────────────────
// Logos next to the languages a PL-literate visitor reaches for first. The Logos
// column describes the design Logos is built toward (the lead paragraph carries the
// not-done-yet disclaimer once, rather than per cell), and the table keeps the rows
// where OTHER languages beat Logos (content-addressed code, ecosystem, tooling,
// being usable at all). Verdicts for the other columns were researched and
// adversarially fact-checked per language (July 2026); the numbered footnotes carry
// the nuance a one-glyph cell cannot.

type CompareVerdict = "yes" | "partial" | "no";
interface CompareCell {
  v: CompareVerdict;
  /** 1-based index into COMPARE_NOTES. */
  note?: number;
}
interface CompareRow {
  label: string;
  sub: string;
  /** One cell per language, in COMPARE_LANGS order. */
  cells: CompareCell[];
}

const COMPARE_LANGS = [
  "Logos",
  "C/C++",
  "Rust",
  "Zig",
  "Lean 4",
  "Unison",
  "Racket",
  "Smalltalk",
  "Julia",
  "Python",
  "TS/JS",
  "Mojo",
];

// Cells are in COMPARE_LANGS order: Logos, C/C++, Rust, Zig, Lean 4, Unison,
// Racket, Smalltalk, Julia, Python, TS/JS, Mojo.
const COMPARE_ROWS: CompareRow[] = [
  {
    label: "Memory safety without a GC",
    sub: "ownership and borrow checking, zero runtime cost",
    cells: [
      { v: "yes" },
      { v: "no", note: 16 },
      { v: "yes" },
      { v: "no", note: 9 },
      { v: "no" },
      { v: "no" },
      { v: "no" },
      { v: "no" },
      { v: "no" },
      { v: "no" },
      { v: "no" },
      { v: "partial", note: 13 },
    ],
  },
  {
    label: "Compiles to native machine code",
    sub: "AOT or JIT, systems-grade performance",
    cells: [
      { v: "yes" },
      { v: "yes" },
      { v: "yes" },
      { v: "yes" },
      { v: "yes", note: 1 },
      { v: "partial" },
      { v: "partial" },
      { v: "partial" },
      { v: "yes" },
      { v: "partial", note: 18 },
      { v: "partial" },
      { v: "yes" },
    ],
  },
  {
    label: "The speed ceiling of C and Rust",
    sub: "no GC or boxing tax, zero-cost abstractions",
    cells: [
      { v: "yes" },
      { v: "yes" },
      { v: "yes" },
      { v: "yes" },
      { v: "no", note: 1 },
      { v: "no" },
      { v: "no" },
      { v: "no" },
      { v: "partial", note: 21 },
      { v: "no" },
      { v: "no" },
      { v: "yes" },
    ],
  },
  {
    label: "Targets GPUs and custom hardware",
    sub: "kernels written in the language itself, not shader strings",
    cells: [
      { v: "yes" },
      { v: "yes" },
      { v: "partial", note: 11 },
      { v: "partial" },
      { v: "no" },
      { v: "no" },
      { v: "no" },
      { v: "no" },
      { v: "yes" },
      { v: "partial", note: 19 },
      { v: "no" },
      { v: "yes" },
    ],
  },
  {
    label: "Runs in the browser",
    sub: "compiles to WebAssembly or runs in a web page",
    cells: [
      { v: "partial", note: 32 },
      { v: "partial", note: 32 },
      { v: "partial", note: 32 },
      { v: "partial", note: 32 },
      { v: "no" },
      { v: "no" },
      { v: "no" },
      { v: "partial", note: 27 },
      { v: "no" },
      { v: "partial", note: 28 },
      { v: "yes" },
      { v: "no" },
    ],
  },
  {
    label: "Multithreaded parallelism",
    sub: "use every core with shared memory",
    cells: [
      { v: "yes" },
      { v: "yes" },
      { v: "yes" },
      { v: "yes" },
      { v: "partial" },
      { v: "partial" },
      { v: "partial" },
      { v: "no" },
      { v: "yes" },
      { v: "partial", note: 20 },
      { v: "partial" },
      { v: "yes" },
    ],
  },
  {
    label: "Async concurrency",
    sub: "async/await or lightweight tasks for IO-bound work",
    cells: [
      { v: "yes" },
      { v: "partial", note: 25 },
      { v: "yes" },
      { v: "partial", note: 26 },
      { v: "partial" },
      { v: "yes" },
      { v: "yes" },
      { v: "partial" },
      { v: "yes" },
      { v: "yes" },
      { v: "yes" },
      { v: "partial" },
    ],
  },
  {
    label: "Formal proofs in the language",
    sub: "dependent types / theorem proving built in",
    cells: [
      { v: "yes" },
      { v: "no" },
      { v: "no" },
      { v: "no" },
      { v: "yes" },
      { v: "no" },
      { v: "no" },
      { v: "no" },
      { v: "no" },
      { v: "no" },
      { v: "no" },
      { v: "no" },
    ],
  },
  {
    label: "Gradual verification",
    sub: "prove one part, leave the rest ordinary code",
    cells: [
      { v: "yes" },
      { v: "no" },
      { v: "no" },
      { v: "no" },
      { v: "yes" },
      { v: "no" },
      { v: "no" },
      { v: "no" },
      { v: "no" },
      { v: "no" },
      { v: "no" },
      { v: "no" },
    ],
  },
  {
    label: "Effects tracked in types",
    sub: "purity, IO, async as capabilities the compiler checks",
    cells: [
      { v: "yes" },
      { v: "no" },
      { v: "partial" },
      { v: "no" },
      { v: "yes" },
      { v: "yes" },
      { v: "no" },
      { v: "no" },
      { v: "no" },
      { v: "no" },
      { v: "no" },
      { v: "partial" },
    ],
  },
  {
    label: "Code as data",
    sub: "programs are a structure the language can read",
    cells: [
      { v: "yes" },
      { v: "no" },
      { v: "partial", note: 2 },
      { v: "no" },
      { v: "yes" },
      { v: "partial" },
      { v: "yes" },
      { v: "yes" },
      { v: "yes" },
      { v: "yes" },
      { v: "partial" },
      { v: "no" },
    ],
  },
  {
    label: "Semantic reflection",
    sub: "the readable structure carries types and checked facts",
    cells: [
      { v: "yes" },
      { v: "partial", note: 17 },
      { v: "no" },
      { v: "partial" },
      { v: "yes" },
      { v: "no" },
      { v: "partial" },
      { v: "partial", note: 3 },
      { v: "partial" },
      { v: "partial" },
      { v: "partial", note: 29 },
      { v: "no" },
    ],
  },
  {
    label: "Compile-time code execution",
    sub: "run ordinary code at compile time, results baked in",
    cells: [
      { v: "yes" },
      { v: "partial" },
      { v: "partial" },
      { v: "yes" },
      { v: "yes" },
      { v: "no" },
      { v: "yes" },
      { v: "partial", note: 15 },
      { v: "yes" },
      { v: "no" },
      { v: "no" },
      { v: "yes" },
    ],
  },
  {
    label: "Compiler extensible as a library",
    sub: "new syntax and optimizations as ordinary libraries",
    cells: [
      { v: "yes" },
      { v: "no" },
      { v: "partial", note: 2 },
      { v: "no" },
      { v: "yes" },
      { v: "no" },
      { v: "yes", note: 4 },
      { v: "yes" },
      { v: "partial" },
      { v: "no" },
      { v: "partial" },
      { v: "no" },
    ],
  },
  {
    label: "Hosts other languages as libraries",
    sub: "embed an HDL or shader language without a new compiler",
    cells: [
      { v: "yes" },
      { v: "no" },
      { v: "partial" },
      { v: "partial" },
      { v: "yes", note: 14 },
      { v: "no" },
      { v: "yes", note: 4 },
      { v: "no" },
      { v: "partial" },
      { v: "no" },
      { v: "partial" },
      { v: "no" },
    ],
  },
  {
    label: "Hygienic syntax extension",
    sub: "syntax extensions can't capture names by accident",
    cells: [
      { v: "yes", note: 22 },
      { v: "no" },
      { v: "partial" },
      { v: "no" },
      { v: "yes" },
      { v: "no" },
      { v: "yes" },
      { v: "no" },
      { v: "yes" },
      { v: "no" },
      { v: "no" },
      { v: "no" },
    ],
  },
  {
    label: "First-class rewrite engine",
    sub: "equality saturation shared by compiler and user code",
    cells: [
      { v: "yes" },
      { v: "no" },
      { v: "no" },
      { v: "no" },
      { v: "partial", note: 5 },
      { v: "no" },
      { v: "partial", note: 8 },
      { v: "partial", note: 8 },
      { v: "no", note: 12 },
      { v: "no" },
      { v: "no" },
      { v: "no" },
    ],
  },
  {
    label: "Live system",
    sub: "redefine parts of a running program",
    cells: [
      { v: "yes" },
      { v: "no" },
      { v: "no" },
      { v: "no" },
      { v: "no" },
      { v: "partial" },
      { v: "partial" },
      { v: "yes" },
      { v: "yes" },
      { v: "partial" },
      { v: "partial" },
      { v: "no" },
    ],
  },
  {
    label: "Image persistence",
    sub: "save the whole running system, resume it later",
    cells: [
      { v: "partial", note: 23 },
      { v: "no" },
      { v: "no" },
      { v: "no" },
      { v: "no" },
      { v: "no" },
      { v: "no" },
      { v: "yes" },
      { v: "partial", note: 24 },
      { v: "no" },
      { v: "no" },
      { v: "no" },
    ],
  },
  {
    label: "Content-addressed code",
    sub: "definitions identified by hash of their content",
    cells: [
      { v: "partial", note: 6 },
      { v: "no" },
      { v: "no" },
      { v: "no" },
      { v: "no" },
      { v: "yes" },
      { v: "no" },
      { v: "no" },
      { v: "no" },
      { v: "no" },
      { v: "no" },
      { v: "no" },
    ],
  },
  {
    label: "Usable today",
    sub: "a stable compiler you can build real software on now",
    cells: [
      { v: "no" },
      { v: "yes" },
      { v: "yes" },
      { v: "partial", note: 10 },
      { v: "yes" },
      { v: "yes", note: 7 },
      { v: "yes" },
      { v: "yes" },
      { v: "yes" },
      { v: "yes" },
      { v: "yes" },
      { v: "partial", note: 13 },
    ],
  },
  {
    label: "Backward-compatibility promise",
    sub: "code from years ago still builds and runs today",
    cells: [
      { v: "partial", note: 30 },
      { v: "yes" },
      { v: "yes" },
      { v: "no", note: 10 },
      { v: "partial" },
      { v: "partial" },
      { v: "yes" },
      { v: "partial" },
      { v: "yes" },
      { v: "partial" },
      { v: "yes" },
      { v: "no" },
    ],
  },
  {
    label: "Package ecosystem",
    sub: "packages, users, production track record",
    cells: [
      { v: "partial", note: 31 },
      { v: "yes" },
      { v: "yes" },
      { v: "partial" },
      { v: "partial" },
      { v: "partial", note: 7 },
      { v: "partial" },
      { v: "partial" },
      { v: "yes" },
      { v: "yes" },
      { v: "yes" },
      { v: "no" },
    ],
  },
];

const COMPARE_NOTES: string[] = [
  "Lean 4 compiles through C, but its runtime uses reference counting: fast, yet not a no-GC systems language.",
  "Rust proc macros transform token streams before type checking; the compiler's passes are not extensible.",
  "Smalltalk reflects everything at runtime, but nothing is statically typed or proved.",
  "Racket's #lang makes whole languages ordinary libraries; the optimizer itself is not user-extensible.",
  "Lean's simp and @[csimp] rule sets are first-class directed rewriting; there is no e-graph equality saturation.",
  "Logos source files stay canonical, but hash identity can be enforced as an opt-in wrapper discipline: persisted artifacts already key by content, never by address.",
  "Most of Unison's public production mileage is Unison Cloud, built by the language's own company.",
  "Racket's macro expander and Smalltalk's Refactoring-Browser rewriter are user-drivable tree rewriting; neither is equality saturation, and neither serves as the compiler's optimizer.",
  "Zig has no GC, but its safety comes from runtime checks in safe builds, not compile-time proof.",
  "Zig is pre-1.0 by design; Bun, TigerBeetle, and Ghostty ship on it in production anyway.",
  "Rust reaches GPUs through rust-gpu (SPIR-V) and the tier-2 nvptx64 target; every path is still experimental.",
  "Metatheory.jl gives Julia real e-graph rewriting as a library, but the compiler itself never uses it.",
  "Mojo's 1.0 beta shipped in May 2026 with ownership checking working today; full default memory safety is deferred to Mojo 2.x.",
  "Alloy embeds real C syntax inside Lean files through Lean's extensible grammar.",
  "Smalltalk has no separate compile phase; evaluating code and saving the image plays the comptime role.",
  "C and C++ have no GC, but nothing enforces memory safety either; this row asks for both.",
  "C++26 adds compile-time reflection of types (P2996), not reflection of program structure.",
  "CPython 3.13+ ships an experimental JIT and PyPy is mature; neither approaches systems-grade performance.",
  "Triton and JAX compile Python-syntax kernels for GPUs, as restricted subsets of the language.",
  "Free-threaded CPython became officially supported in Python 3.14, as a separate build; the default build keeps the GIL.",
  "Type-stable Julia kernels reach C speed; the GC and dynamic fallback keep whole programs below the ceiling.",
  "Logos constructors emit resolved handles rather than names, so there is no name for a macro to capture.",
  "The Logic Graph and boundary-materialized task state admit a save/resume library in Logos; source files stay the canonical form.",
  "PackageCompiler sysimages snapshot a loaded Julia session, not live tasks.",
  "C++20 has coroutines but no standard async runtime; std::execution only arrives with C++26.",
  "Zig dropped its old async/await in the compiler rewrite; a new std.Io async design is landing across 0.x releases.",
  "SqueakJS runs real Smalltalk images in the browser on a JavaScript virtual machine.",
  "Pyodide runs CPython on WebAssembly; C-extension packages need prebuilt WASM wheels.",
  "The TypeScript compiler API exposes the type checker to tooling; all types are erased at runtime.",
  "Logos releases are designed immutable from day one (docs and builds freeze per version); the track record starts at the first release.",
  "No Logos packages exist yet; the standard library is deliberately built before release to seed a coherent ecosystem.",
  "WebAssembly runs in every browser, but only JavaScript runs alone: wasm still needs JS glue to load, and all DOM and I/O access goes through JS.",
];

const VERDICT_GLYPH: Record<CompareVerdict, string> = {
  yes: "✓",
  partial: "~",
  no: "✗",
};
const VERDICT_TEXT: Record<CompareVerdict, string> = {
  yes: "yes",
  partial: "partial",
  no: "no",
};

function compareHtml(): string {
  const head = COMPARE_LANGS.map(
    (lang, i) =>
      `<th scope="col" class="compare__lang${i === 0 ? " compare__lang--logos" : ""}">${lang}</th>`,
  ).join("");
  const rows = COMPARE_ROWS.map((row) => {
    const cells = row.cells
      .map((cell, i) => {
        const sup = cell.note
          ? `<sup class="compare__ref"><a href="#compare-note-${cell.note}" aria-label="Note ${cell.note}">${cell.note}</a></sup>`
          : "";
        return `<td class="compare__cell is-${cell.v}${i === 0 ? " compare__cell--logos" : ""}"><span aria-hidden="true">${VERDICT_GLYPH[cell.v]}</span><span class="sr-only">${VERDICT_TEXT[cell.v]}</span>${sup}</td>`;
      })
      .join("");
    return `<tr><th scope="row" class="compare__cap">${row.label}<span class="compare__sub">${row.sub}</span></th>${cells}</tr>`;
  }).join("");
  const notes = COMPARE_NOTES.map(
    (note, i) => `<li id="compare-note-${i + 1}">${note}</li>`,
  ).join("");
  return `<section class="compare" aria-label="How Logos compares to other languages">
  <h2 class="compare__title">Next to its neighbors</h2>
  <p class="compare__lead">The first question a language-literate visitor asks is "why not C++, Rust, Zig, Lean, Julia, Python, TypeScript, or a Lisp?". Here is the honest answer. <strong>Logos is not done yet</strong>: its column is the design it is being built toward, not software you can run today, while every other column is what ships now. But read across the rows: nearly every capability in the Logos column is already a yes somewhere else here, so the hard part is not inventing any one of them, it is uniting them in one structure. Some rows are things other languages do well that Logos does not attempt at all.</p>
  <ul class="compare__legend"><li class="is-yes"><span aria-hidden="true">✓</span> has it</li><li class="is-partial"><span aria-hidden="true">~</span> partial</li><li class="is-no"><span aria-hidden="true">✗</span> no</li></ul>
  <div class="compare__shadows" data-compare>
    <div class="compare__scroll">
      <table class="compare__table">
        <thead><tr><th scope="col" class="compare__cap">Capability</th>${head}</tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  </div>
  <ol class="compare__notes">${notes}</ol>
</section>`;
}

// A short "large but tractable" section between the code card and the matrix: it
// names the working precedent each part has, the small self-hosting seed the whole
// thing bootstraps from, and points at the roadmap and vision. It frames the matrix
// below as the capability-by-capability evidence.
function buildableHtml(): string {
  return `<section class="buildable" aria-label="Why Logos can be built">
  <h2 class="buildable__title">Built from proven parts</h2>
  <div class="buildable__body">
    <p>Logos is large, and honest about being large. But none of its parts is without precedent: self-hosting (Lean 4), a layered intermediate representation (MLIR), equality saturation in production (egg and Cranelift), borrow checking without a garbage collector (Rust), a live and malleable system (Smalltalk), machine-checked proofs (Lean). The novel work is uniting them in one structure, not inventing any one of them.</p>
    <p>The path is a small Rust seed, kept small enough to audit by hand. Everything above it is written in Logos, until the language compiles itself: a tiny trusted core, and then the language builds the rest. The <a href="/roadmap/">roadmap</a> breaks the work into parts and shows what already runs, and the <a href="/vision/">vision</a> shows how each hard part is solved.</p>
  </div>
</section>`;
}

// The "why now" section: Logos as the substrate for machine-written code. The hero
// above states the thesis; this section carries the full argument, that a
// reflective, rewritable structure carrying its own proofs flips from luxury to
// requirement once models write most code, and that this is the half Smalltalk
// (malleable, unproven) and Lean (proven, not a systems substrate) each miss.
// Kept honest: it is the direction, not a shipping feature.
function aiSubstrateHtml(): string {
  return `<section class="substrate" aria-label="A substrate for machine-written code">
  <h2 class="substrate__title">Why one structure, and why now</h2>
  <p class="substrate__lead">When people wrote all the code, a structure that carries its own types and proofs and can rewrite itself was a luxury. When models write most of it, that same structure becomes the requirement.</p>
  <div class="substrate__body">
    <p>An AI that edits <em>text</em> pushes a guess through a fragile toolchain and hopes it holds. An AI that edits a <strong>Logic Graph</strong> rewrites a structure that already carries its scopes, types, borrow states, and proofs, and gets machine-checked feedback that the change is correct and safe before it ever runs. The same reader-writer rule that governs memory also governs self-modifying code, so a program can improve its own code, iteratively, without being allowed to break it.</p>
    <p>This is the gap between the two systems Logos learns from. Smalltalk gave a live system that can inspect and rewrite itself, but nothing that could prove a change was right. Lean gives machine-checked proof, but it is a prover built for mathematicians, garbage-collected and functional, not a systems substrate a program rewrites and runs at native speed. Neither has both halves. Logos reaches for both in one structure: rewrite it as freely as Smalltalk, check it as strictly as Lean, run it as fast as Rust.</p>
    <p>That combination is what code written by machines will need, and it is the direction Logos is built toward. It does not run yet; the <a href="/roadmap/">roadmap</a> tracks what does.</p>
  </div>
</section>`;
}

// The signup section at the bottom of the homepage: intent capture placed where a
// convinced reader lands, after the argument, never as the first thing seen.
function notifySectionHtml(): string {
  return `<section class="signup" aria-label="Get notified about the first builds">
  <h2 class="signup__title">Hear about the first build</h2>
  <p class="signup__lead">No public builds exist yet. Leave your email and you will get a message when the most important builds ship. No spam, ever; removal any time (see <a href="/privacy/">Privacy</a>).</p>
  ${notifyFormHtml("home-bottom")}
</section>`;
}

export function homePage(): string {
  return `<section class="hero">
  <div class="hero__copy">
    <h1 class="hero__headline">
      <span class="hero__brand" aria-hidden="true">Λόγος</span>
      <span class="hero__lead" aria-hidden="true">Built for machines to write, and to prove</span>
      <span class="hero__rot-line" aria-hidden="true"><span class="hero__rot-one">One language for everything,</span> <span class="hero__rot-prefix">instead of a different one for</span> <span class="hero__rotator" data-rotator><span class="hero__rot-item is-current">systems</span><span class="hero__rot-item">speed</span><span class="hero__rot-item">the GPU</span><span class="hero__rot-item">async</span><span class="hero__rot-item">proofs</span><span class="hero__rot-item">true metaprogramming</span><span class="hero__rot-item">new languages</span><span class="hero__rot-item">dedicated hardware</span><span class="hero__rot-item">JIT</span><span class="hero__rot-item">special use cases</span><span class="hero__rot-item">the compiler itself</span></span></span>
      <span class="sr-only">Logos: a language built for machines to write, and to prove. One language for everything: systems code, speed, GPUs, async, proofs, metaprogramming, new languages, dedicated hardware, and its own compiler, instead of a different one for every job.</span>
    </h1>
    <p class="hero__sub">An AI that edits text pushes a guess through a fragile toolchain and hopes. Logos code is a live structure that carries its own types, borrow states, and proofs, so every change gets machine-checked feedback before it ever runs.</p>
    <div class="hero__actions">
      <a class="logos-btn logos-btn--ghost" href="/vision/">Read the vision</a>
      <a class="logos-btn logos-btn--ghost" href="/roadmap/">See the roadmap</a>
    </div>
  </div>
</section>
<section class="wisdom" aria-label="On the Logos, voices across the ages">
  <div class="wisdom__scroll"><div class="wisdom__track">${wisdomUnits()}</div></div>
</section>
${codePeekHtml()}
${structureHtml()}
${aiSubstrateHtml()}
${buildableHtml()}
${compareHtml()}
${notifySectionHtml()}`;
}

export function visionPage(): string {
  return `<article class="vision">
  <p class="vision__lead">Logos is built on a single commitment: <strong>radical unification</strong>. Every piece of logic the system contains, your programs, their types, their proofs, the compilation rules, the optimization passes, the compiler itself, the documentation, and the language's own parsing rules, lives in one data structure: the <strong>Logic Graph</strong>. There is no separation between "the language" and "what is written in it."</p>

  <p>The bet is that the boundaries we take for granted (language versus compiler, code versus specification, program versus proof, source versus tooling) are accidents of how systems were historically built, not necessities. Collapse them and what is left is simpler at its core, more expressive in what it can state, and more honest about what it is.</p>

  <h2>One structure, all the way down</h2>
  <p>The Logic Graph is the primary representation. It holds the program with every piece of semantic information attached (resolved scopes, inferred types, borrow states, propagated capabilities), the rules that governed its parsing, the standard library, and the compiler's own logic. Navigation is uniform: the same operations you run on your own code traverse any subgraph, including the compiler's.</p>

  <h2>A tiny seed that self-hosts</h2>
  <p>A small Rust bootstrap seed starts the system. Everything beyond, the full type system, the borrow checker, the rewriting engine, the optimization passes, the standard library, is written in Logos and processed by the seed until the system compiles itself. The seed stays small enough to audit by hand, and eventually to verify.</p>

  <h2>Interpret by default, compile on demand</h2>
  <p>Logic Graph code is interpreted by default. Freeze a region and it can be JIT-compiled with Cranelift, staying fully reflectable through the Logic Graph it was compiled from. Because interpreting and compiling produce the same result, the choice is only ever about whether the speedup is worth the cost of compiling, never about what the code means.</p>

  <h2>Memory safety without a garbage collector</h2>
  <p>Logos is a serious systems language. Memory is managed by a borrow checker with lexical lifetimes, explicit ownership, and moves, with no garbage collector and no runtime cost. One rule covers every case: among references that are live at the same time and overlap, there may be many readers or a single writer, never both. That same reader-writer rule is also what governs visibility, borrowing, and reflection, so they are one mechanism rather than three separate features.</p>

  <h2>One rewriting engine</h2>
  <p>Compiler optimization, computer algebra, and your own transformations are one operation: take a fragment, apply rewrite rules, and extract the form that minimizes a cost function, using equality saturation over an e-graph. The same engine serves the compiler's <code>x + 0 → x</code> and the mathematician's <code>sin²(θ) + cos²(θ) → 1</code>.</p>

  <h2>Pay only for what you verify</h2>
  <p>A systems programmer gets the base type system and a borrow checker. Beyond that the strata are opt-in: refinement types and pre/post-conditions, then termination measures, then full dependent types and proof terms checked by a small trusted kernel. Parts of a program can be verified while the rest stays lower.</p>

  <h2>Concurrency the compiler checks</h2>
  <p>Two shapes cover the common cases. <code>parallel for</code> distributes work over disjoint indices, a pattern the borrow checker recognizes and proves race-free; stackless <code>async</code> tasks handle I/O-bound concurrency on executor pools you control, pausing only at an explicit <code>.await</code> so suspension is always visible in the source. Reading shared graph structure across threads is an ordinary shared borrow, so the standard library and every definition can be read by many threads at once, while writes are exclusive and concurrent mutation of the same node is a compile-time error.</p>

  <h2>The compiler is a library</h2>
  <p>Above the seed, the borrow checker, type checker, rewriting engine, optimization passes, and the lowerings from Logic Graph to native code are themselves Logos programs and themselves subgraphs. Adding an optimization is library work; targeting a new platform is implementing the backend interface and contributing rules. The grammar lives in the graph too, so a new operator, constructor, or macro is ordinary library work rather than a change to the language itself.</p>

  <h2>The tooling is Logos too</h2>
  <p>Because so much is already in the Logic Graph, the tooling is thinner and richer than its equivalents elsewhere. A Logos-written language server brings highlighting, errors, autocomplete, go-to-definition, and refactoring to any LSP editor; the documentation generator works from the same graph that holds types, signatures, examples, capabilities, and proofs; and a structural editor that operates directly on Logic Graphs is the long-term goal. The Smalltalk vision of a fully malleable system, applied to a modern systems language.</p>
</article>`;
}

// ── About page ────────────────────────────────────────────────────────────────
// Who is building Logos, still in Thobias's own first-person voice, but framed
// around the question and the language rather than the builder: the reader's real
// question is "can this person build something this large?", so the achievements
// read as evidence for that, not as a trophy case. The photo ships as
// /public/thobias.jpg (a web-sized copy of resources/images/ThobiasKnudsen.png).
export function aboutPage(): string {
  return `<article class="about">
  <h1 class="about__title">Who is building Logos</h1>
  <p class="about__lead">Logos began with a question that would not let go: given a set of data points, why is there no way to find a mathematical formula, over any number of variables, that fits them?</p>
  <figure class="about__portrait">
    <img src="/thobias.jpg" alt="Thobias Melfjord Knudsen" width="640" height="743" loading="lazy" />
    <figcaption>Thobias Melfjord Knudsen</figcaption>
  </figure>
  <p>My name is Thobias Melfjord Knudsen. I am a systems programmer studying informatics, and that question caught me in my first year of high school. Python came first, in 2020; by 2022 a math application built to chase the question was underway, with C++ learned along the way. A working version took about six months.</p>
  <p>The chase explained why no such tool exists. Through any finite set of points endlessly many curves can be drawn, so there is no single formula waiting to be found. The most a tool can do is decide in advance what shape of formula it will accept, then search for one of that shape that fits the points, and even then it may find nothing, or infinitely many. What the problem really needs is a language where formulas are as easy to build and reshape as numbers, and where the language can look at and rewrite its own expressions: functions that write other functions, shaped by whatever they are given. Lisp came closest, treating code as data, but it still falls short of what the problem demands.</p>
  <p>The decisive turn was seeing that this generalizes to almost everything logical. A memory system for AI agents, built later, hit the same wall from a completely separate direction: there too, the real limit was the language. If English could be made programmable, and Logos is built to host exactly that, a memory system as good as our own memory, or better, comes within reach. Two separate roads ended in the same place.</p>
  <blockquote class="about__pull-quote"><p>The bottleneck was never the mathematics. It was the language.</p></blockquote>
  <h2 class="about__subhead">The evidence it can be built</h2>
  <p>A project this size stands or falls on whether its builder finishes hard things, so here is the record. <a href="https://github.com/ThobiasKnudsen/LogosMath" target="_blank" rel="noopener noreferrer">LogosMath</a> is where it began: a working math application with its own small language, built to go further than symbolic tools like Wolfram Alpha and Matlab. <a href="https://github.com/ThobiasKnudsen/Memra" target="_blank" rel="noopener noreferrer">Memra</a> is the agent memory system from the second road; in my benchmarks it came close to the best available. Military service produced a high-resolution offline <a href="https://github.com/ThobiasKnudsen/Map" target="_blank" rel="noopener noreferrer">map</a> in C++, and a recent <a href="https://github.com/ThobiasKnudsen/verztable" target="_blank" rel="noopener noreferrer">Zig hash table</a> runs almost as fast as the fastest published.</p>
  <p>At NTNU, in the Algorithms and Data Structures course (one of the university's hardest, around 900 students), my solutions were the fastest in most of the weekly challenges through the autumn of 2025. And this year, my teammate and I placed first in Norway's first national championship in AI, out of more than 1,100 teams; the <a href="https://github.com/JardarIversen/ainm-2026" target="_blank" rel="noopener noreferrer">solution</a> is on GitHub.</p>
  <p>Logos itself is the turn from the math application to the language underneath it: one language for everything, built on a single commitment, radical unification. The program, its types, its proofs, the compiler, and the grammar itself all live in one structure. It is a serious systems language, with a borrow checker, native compilation, and no garbage collector, reaching also for machine-checked proofs and self-reflection. It does not run yet; a small Rust bootstrap seed is all there is so far, and the <a href="/roadmap/">roadmap</a> tracks it honestly.</p>
  <p class="about__coda">Sometimes I suspect that a complete meta-language, where each word is defined using all other words, is the closest one can get to reflecting on how God works.</p>
  <p class="about__cta">If it interests you, you are welcome to follow along on GitHub: star the <a href="https://github.com/ThobiasKnudsen/LogosLang" target="_blank" rel="noopener noreferrer">seed</a>, watch the language take shape, and word of the first build will come there.</p>
</article>`;
}

export function placeholderPage(title: string, body: string): string {
  return `<section class="placeholder"><h1>${title}</h1><p>${body}</p></section>`;
}

/** The 404 page. Emitted to `dist/404.html`; Cloudflare serves it with a 404 status. */
export function notFoundPage(): string {
  return `<section class="placeholder"><h1>Page not found</h1><p>That page does not exist. Head to the <a href="/">home page</a> or the <a href="/docs/">documentation</a>.</p></section>`;
}

// ── Download page ─────────────────────────────────────────────────────────────
// Pick a version; the install command + a direct download button appear for every
// OS/arch. The release data is baked in at build time (an embedded JSON island);
// client/main.ts re-renders the grid when the version changes and highlights the
// visitor's own OS. With JS off, the latest version's commands are fully rendered
// and every download link works. A completed LogosLang release rebuilds the site
// (via a deploy hook), so new versions and docs appear together.

function downloadCommandRow(asset: Asset): string {
  return `<div class="dl-row" data-arch="${asset.arch}">
      <div class="dl-row__head"><span class="dl-row__arch">${ARCH_LABELS[asset.arch]}</span><a class="logos-btn logos-btn--download dl-row__dl" href="${escapeHtml(asset.url)}" download>Download .${asset.ext}</a></div>
      <div class="dl-cmd"><pre class="dl-cmd__pre"><code>${escapeHtml(installCommand(asset))}</code></pre><button class="dl-copy" type="button" data-copy aria-label="Copy command">Copy</button></div>
    </div>`;
}

function downloadOsCard(release: Release, os: Os): string {
  const assets = assetsForOs(release, os);
  const body = assets.length
    ? assets.map(downloadCommandRow).join("")
    : `<p class="dl-card__none">No ${OS_LABELS[os]} build for ${escapeHtml(release.version)}.</p>`;
  return `<article class="dl-card" data-os="${os}"><h3 class="dl-card__os">${OS_LABELS[os]}</h3>${body}</article>`;
}

function downloadGrid(release: Release): string {
  return OS_ORDER.map((os) => downloadOsCard(release, os)).join("");
}

export function downloadPage(releases: Release[]): string {
  if (releases.length === 0) {
    return `<section class="download download--empty">
  <h1 class="download__title">Download Logos</h1>
  <p class="download__lead">Logos has no public builds yet. The moment the first version is released, this page lists a one-line install command and a direct download for every OS. Leave your email and you'll hear about it the day it happens.</p>
  ${notifyFormHtml("download")}
  <p class="download__notify-note">Emails for the most important builds only; you will not be spammed. Removal any time; see <a href="/privacy/">Privacy</a>.</p>
  <div class="download__empty-actions">
    <a class="logos-btn logos-btn--ghost" href="${GITHUB}/releases" target="_blank" rel="noopener noreferrer">Watch releases on GitHub</a>
    <a class="logos-btn logos-btn--ghost" href="/roadmap/">See the roadmap</a>
  </div>
</section>`;
  }

  const latest = releases[0]!;
  const options = releases
    .map((r, i) => {
      const tag = r.prerelease ? " (pre-release)" : "";
      return `<option value="${escapeHtml(r.version)}"${i === 0 ? " selected" : ""}>${escapeHtml(r.version)}${tag}</option>`;
    })
    .join("");
  const baked = JSON.stringify(releases).replace(/</g, "\\u003c");

  return `<section class="download" data-download>
  <h1 class="download__title">Download Logos</h1>
  <p class="download__lead">Choose a version, then copy the install command for your OS or download the build directly. Logos is early software, so expect breaking changes between versions.</p>
  <div class="download__bar">
    <label class="download__version">Version
      <select id="dl-version">${options}</select>
    </label>
    <span class="download__meta" id="dl-meta">latest: ${escapeHtml(latest.version)}</span>
  </div>
  <div class="download__grid" id="dl-grid">${downloadGrid(latest)}</div>
  <p class="download__hint">After unpacking, add the <code>logos</code> binary to your <code>PATH</code>. Older versions stay available here for reproducible installs.</p>
  <script type="application/json" id="logos-releases">${baked}</script>
</section>`;
}

// ── Playground page ───────────────────────────────────────────────────────────
// Pick a version, edit Logos, run it in the browser against that version's
// WebAssembly build (a `…-wasm.wasm` release asset, loaded per selected version).
// Until a real compiler targets WASM the releases carry a placeholder wasm and
// execution is stubbed, but the version picker and editor are live, so only the
// load+evaluate harness in client/main.ts needs swapping in later.

const PLAYGROUND_SAMPLE = `// Logos: declare, infer, reassign
a := 32
a = a + 1
a`;

export function playgroundPage(releases: Release[]): string {
  const runnable = releasesWithWasm(releases);
  if (runnable.length === 0) {
    return `<section class="playground playground--empty">
  <h1 class="playground__title">Playground</h1>
  <p class="playground__lead">An in-browser Logos playground is on the way. It runs the real Logos runtime compiled to WebAssembly, right here with no install, and arrives with the first release that ships a WASM build.</p>
  <div class="playground__empty-actions">
    <a class="logos-btn logos-btn--ghost" href="/roadmap/">See the roadmap</a>
    <a class="logos-btn logos-btn--ghost" href="/download/">Downloads</a>
  </div>
</section>`;
  }

  const options = runnable
    .map(
      (r, i) =>
        `<option value="${escapeHtml(r.version)}" data-wasm="${escapeHtml(r.wasm!.url)}"${i === 0 ? " selected" : ""}>${escapeHtml(r.version)}</option>`,
    )
    .join("");

  return `<section class="playground" data-playground>
  <div class="pg-bar">
    <label class="pg-version-label">Version
      <select id="pg-version">${options}</select>
    </label>
    <button class="logos-btn logos-btn--download" id="pg-run" type="button">Run ▸</button>
    <span class="pg-meta" id="pg-meta"></span>
  </div>
  <div class="pg-grid">
    <textarea id="pg-editor" class="pg-editor" spellcheck="false" aria-label="Logos source">${escapeHtml(PLAYGROUND_SAMPLE)}</textarea>
    <pre id="pg-output" class="pg-output" aria-live="polite">Choose a version and press Run.</pre>
  </div>
  <p class="pg-note">⚠️ The Logos runtime is a placeholder build, so in-browser evaluation isn't wired up yet. The version picker and editor are live; real execution lands when Logos targets WebAssembly.</p>
</section>`;
}

// ── Privacy & Cookies page ────────────────────────────────────────────────────
// A reviewable template describing the first-party, cookieless analytics. Set
// PRIVACY_CONTACT in the build env to surface a contact email; otherwise it points at
// GitHub issues. Keep this in sync with functions/api/collect.ts (what is stored).
export function privacyPage(): string {
  const contact = process.env.PRIVACY_CONTACT || "";
  const contactLine = contact
    ? `<a href="mailto:${escapeHtml(contact)}">${escapeHtml(contact)}</a>`
    : `the maintainers via the <a href="${GITHUB}/issues">GitHub repository</a>`;
  return `<article class="legal">
  <h1 class="legal__title">Privacy &amp; Cookies</h1>
  <p class="legal__updated">Applies to logoslang.dev.</p>

  <p>This is the documentation and marketing site for the Logos language. We keep data collection to a minimum, run our own analytics rather than handing anything to a third party, and never sell your data. There are <strong>no advertising or tracking cookies</strong>, and nothing loads from another company's servers to watch you.</p>

  <h2>Analytics we collect</h2>
  <p>To understand how the site is used, a small first-party script records a page view and a few interactions and sends them to our own server (a Cloudflare function), which stores them in our own database. What is recorded:</p>
  <ul>
    <li>the page you viewed and its title, the site or link that referred you, and your language;</li>
    <li>approximate location derived from your IP address by Cloudflare (country, region, city, and a city-level latitude/longitude that points at the city, not at you) and your network provider;</li>
    <li>your device type, browser, and operating system;</li>
    <li>how long the page was in view, how far you scrolled, and clicks on a few elements (downloads, outbound links, the version picker, the notify form, the playground).</li>
  </ul>
  <p>We do <strong>not</strong> store your IP address, and we do <strong>not</strong> record your name, email, or anything you type. We do not try to work out who you are, and this data is never sold or shared.</p>

  <h2>How visits are counted (no cookies)</h2>
  <p>Instead of cookies we keep two random, meaningless ids in your browser:</p>
  <ul>
    <li>a <strong>visitor id</strong> in <code>localStorage</code>, so returning visits can be counted. It stays until you clear your browser's site data, holds no personal information, and can be removed any time via your browser's "clear site data" for logoslang.dev.</li>
    <li>a <strong>session id</strong> in <code>sessionStorage</code>, which groups the pages of one visit and disappears when you close the tab.</li>
  </ul>
  <p>Neither is a cookie, neither is shared with anyone, and neither identifies you personally.</p>

  <h2>Release notifications (only if you sign up)</h2>
  <p>The home and download pages have an optional "get notified" form. If you submit it, we store the email address you entered, the time you signed up, and which page's form you used, in Cloudflare Workers KV, and use it for exactly one purpose: emailing you when the most important Logos builds are released. It is a low-volume announcement list; you will not be spammed. It is never sold, shared, or used for analytics, and it sets no cookies. The legal basis is your consent, given by submitting the form.</p>
  <p>To be removed from the list at any time, contact ${contactLine} and the address is deleted.</p>

  <h2>Cookies and local storage we use</h2>
  <ul>
    <li><code>theme</code> cookie: remembers your light/dark choice (strictly necessary). ~180 days.</li>
    <li><code>localStorage</code> visitor id and <code>sessionStorage</code> session id: the anonymous analytics ids described above. No advertising or third-party cookies are set.</li>
  </ul>

  <h2>Legal basis and your choices</h2>
  <p>The analytics are first-party, anonymous, and low-impact, used on the basis of our legitimate interest in understanding and improving the site. You can opt out at any time by clearing site data for logoslang.dev or using your browser's private mode or storage controls; the site works fully either way. If you would prefer we did not, contact ${contactLine}.</p>

  <h2>Where your data goes</h2>
  <p>The site, the analytics database, and any notification signups are all hosted on <strong>Cloudflare</strong>, which processes them on our behalf. No analytics data is sent to Google, Microsoft, or any other third party. See Cloudflare's <a href="https://www.cloudflare.com/privacypolicy/" target="_blank" rel="noopener noreferrer">privacy policy</a>.</p>

  <h2>Your rights</h2>
  <p>Depending on where you live (for example, the EEA or UK under the GDPR), you may have the right to access, correct, or erase your data, to object to or restrict processing, and to withdraw consent. To exercise these rights, contact ${contactLine}.</p>

  <h2>Changes</h2>
  <p>We may update this page as the site evolves; material changes will be reflected here.</p>
</article>`;
}

// The map itself renders in build/roadmap-render.ts, shared with the client: the
// static page is baked at DEFAULT_ASPECT (a landscape window) so it works with JS
// off, and the raw roadmap rides along in a JSON island so client/main.ts can
// re-render the same layout at the visitor's real window ratio.
export function roadmapPage(roadmap: Roadmap): string {
  const map = depmapHtml(roadmap, DEFAULT_ASPECT);
  if (!map) {
    return `<article class="roadmap">
  <h1 class="roadmap__title">Roadmap</h1>
  <p class="roadmap__lead">The roadmap is generated from the project's GitHub milestones and issues, and will appear here once they're published.</p>
</article>`;
  }
  const lead = `The roadmap is generated directly from the <a href="${GITHUB}" target="_blank" rel="noopener noreferrer">LogosLang GitHub repository</a>: every node below is an issue labelled <code>roadmap</code>, and every dashed line is a milestone. A milestone is a finish line: the issues above it are the work that gets Logos there, and everything below it comes later. Arrows point from a piece of work down to the work it unblocks.`;
  const legend = `<ul class="depmap-legend"><li class="is-done">Done</li><li class="is-ready">Ready</li><li class="is-blocked">Blocked</li></ul>`;
  const baked = JSON.stringify(roadmap).replace(/</g, "\\u003c");
  return `<article class="roadmap">
  <h1 class="roadmap__title">Roadmap</h1>
  <p class="roadmap__lead">${lead}</p>
  ${legend}
  ${map}
  <script type="application/json" id="logos-roadmap">${baked}</script>
</article>`;
}
