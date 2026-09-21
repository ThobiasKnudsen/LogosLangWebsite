// Inner HTML for the marketing pages. The homepage order: the hero is the identity,
// "Λόγος / One language for everything", over one paragraph on the mechanism (one
// graph, checked redefinition); then the honest comparison matrix, and the
// get-notified form last, where a convinced reader lands. No code listing: one ran
// down the homepage's right-hand side from 11 to 21 September 2026, and the examples
// page has the same definitions. The reflections on the Logos live in the page
// margins now (build/wisdom.ts).
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

// ── The examples ──────────────────────────────────────────────────────────────
// One definition per example, each with a title and a line of prose, on the examples
// page (Thobias, 15 September 2026). Joined by blank lines, their `code` fields were
// also one continuous file down the homepage's right-hand side, as if the homepage
// were a single Logos source read top to bottom (Thobias, 11 September 2026), until
// the homepage dropped its code on 21 September 2026.
//
// The examples are the language defining itself, in the order dependency demands:
// the dyad, the self-classifying `logos`, `type` (which reads its own bracket), `(`
// (the scope opener and the eager-segment driver), and finally `+`, an ordinary
// operator built out of all of it. Every definition is lifted from a REAL file in the
// sibling repo rather than written for the website (LogosLang/identities/dyad.logos,
// type.logos and open_parenthesis.logos) with their comments stripped and the
// alignment regularised. Two placeholders had to be filled: `(`'s parse_rank is
// literally `…` in the source ("near the top of the axis; `,` sits above it") and
// `+` has no source file at all. Those two numbers, 9.0 and 4.0, are the only
// invented values here; DESIGN.md pins no table of ranks, only that the axis is an
// f64 where higher binds tighter and fractional values let a new operator slot
// between two existing ones.
//
// Sourced from LogosLang/DESIGN.md and LogosLang/identities/*.logos (September 2026):
//   - `instance (…)` declaring the per-instance fields, and the filled slots written
//     with `=` (a slot the type declared is filled, not redeclared), from
//     identities/type.logos, which also dates `parse_rank`: it was spelled
//     `precedence` until 10 September 2026.
//   - `tape[0]:dyad.type = +` first, which initializes the value so its fields are
//     available to write (the constructor ruling of 9 September 2026).
//   - The operand check is the membership ruling of 8 September 2026: `is` is
//     membership in a collection (`x is c`, a plain boolean operator like `==`, no
//     proof machinery), and `number` is the collection of the numeric types the
//     library defines, so "a is a number" is `a:dyad.type is number`. That is the
//     spelling of "is a" in a language with no inheritance, where `==` on types is
//     identity. The and-group distributes, so one line covers both operands.
//   - `lhs` / `rhs` rather than DESIGN.md's `.operands` collection: ruled for `+` by
//     Thobias, 11 September 2026, and it keeps the `+` example and the homepage's
//     Logic Graph figure telling the same story.
// The one invented value is the 4.0. DESIGN.md pins no table of ranks, only that the
// axis is an f64 where higher binds tighter and fractional values let a new operator
// slot between two existing ones without renumbering.
interface Example {
  /** The anchor on the examples page. */
  id: string;
  /** The identifier being defined; shown in mono, so `(` and `+` read as code. */
  title: string;
  /** A line or two on what the definition does, from the source file's own comments
   *  (LogosLang/identities/*.logos). Build-controlled HTML: may carry <code>. */
  lead: string;
  code: string;
}

const EXAMPLES: Example[] = [
  {
    id: "dyad",
    title: "dyad",
    lead: "The one node the Logic Graph is made of: a type and a value. Its <code>type</code> field is itself a dyad, so the first definition already refers to itself.",
    code: `dyad := type (instance (type := @dyad ?, value := @void ?))`,
  },
  {
    id: "logos",
    title: "logos",
    lead: "The language, defined as an instance of itself. There is nothing above it in the graph.",
    code: `logos := logos (logos)`,
  },
  {
    id: "type",
    title: "type",
    lead: "What every type carries, declared once as slots, and the same slots filled for <code>type</code> itself. Its constructor reads its own bracket: it opens the definition scope, drives the bracket's parse the way <code>(</code> does, and replaces its own cell with the finished type.",
    code: `type := type (
  instance (
    parse_rank    := f64 ?
    lex_rank      := f64 ?
    associativity := ?
    constructor   := fn (tape := parsing_tape ?) -> void ?
    destructor    := ?
    code          := ?
  )

  parse_rank    = f64 2.0
  associativity = left

  constructor = fn (tape := parsing_tape ?) -> void (
    if tape[1] != lex «(»[0]
      error «type must be followed by (»

    definition := scope ?
    (.constructor(tape.recenter(1))
    tape[0] = dyad (type, definition)
    tape.remove(1)
  )
)`,
  },
  {
    id: "scope",
    title: "scope",
    lead: "A scope is an array of dyads: the expressions constructed inside one bracket. Its constructor is still a hole; <code>(</code> is what fills a scope.",
    code: `scope := type (
  constructor = fn (tape := parsing_tape ?) -> void ( ? )

  instance (
    self := array dyad ()
  )
)`,
  },
  {
    id: "fn",
    title: "fn",
    lead: "A function is a type like any other: an input type, an output, the body the graph can read, the compiled code it lowers to, and the size of its frame. <code>run</code> jumps to the compiled code when there is some and walks the body when there is not, so interpretation is not a second machine.",
    code: `fn := type (
  instance (
    compile := fn () -> void ?
    run     := fn () -> void ?
    input   := type ?
    output  := ?
    body    := ?
    bcode   := callable ?
    frame   := u64 ?
  )
)`,
  },
  {
    id: "open-parenthesis",
    title: "(",
    lead: "The scope opener is the driver of the parse. Constructed the moment it is lexed, it reads its interior one cell at a time: a cell that binds at least as tightly as <code>(</code> is constructed on the spot, and at each <code>,</code> or the closing <code>)</code> the rest of the segment is constructed highest rank first. The constructed cells, in order, become the scope.",
    code: `( := type (
  parse_rank    = f64 9.0
  associativity = left

  constructor = fn (tape := parsing_tape ?) -> void (
    body  := array @dyad ()
    first := 1
    i     := 1

    while true (
      cell := tape[i]

      if cell == lex «)»[0] or cell == lex «,»[0] (
        while true (
          k := highest_unconstructed(tape, first, i)
          if k == ? break
          tape[k].constructor(tape.recenter(k))
        )
        for k in first..i (
          if not tape.is_constructed[k]
            error «unconstructed cell at a segment boundary»
          body.push(tape[k])
        )
        if cell == lex «)»[0] break
        first = i + 1
      ) else if cell.parse_rank >= (.parse_rank (
        cell.constructor(tape.recenter(i))
      )
      i = i + 1
    )

    tape[0] = dyad (scope, body)
    for k in 1..i+1 ( tape.remove(1) )
  )
)`,
  },
  {
    id: "plus",
    title: "+",
    lead: "An ordinary operator, built out of everything above it. Its constructor checks that the cell on each side is a number, fills its own dyad with them as <code>lhs</code> and <code>rhs</code>, and removes both from the tape.",
    code: `+ := type (
  instance (
    lhs := @dyad ?
    rhs := @dyad ?
  )

  parse_rank    = f64 4.0
  associativity = left

  constructor = fn (tape := parsing_tape ?) -> void (
    if not ((tape[-1] and tape[1]):dyad.type is number)
      error «+ takes a number on each side»

    tape[0]:dyad.type = +
    tape[0]:dyad.value.lhs = tape[-1]
    tape[0]:dyad.value.rhs = tape[1]
    tape.remove(1)
    tape.remove(-1)
  )
)`,
  },
  {
    id: "proof",
    title: "proof",
    lead: "A proof is a rewrite rule together with its evidence: the holes it quantifies over, the premises that must hold, a pattern and its replacement, the derivation from one to the other, and the world of axioms it rests on. Its constructor is still a hole.",
    code: `proof := type (
  constructor = fn (tape := parsing_tape ?) -> void ( ? )

  instance (
    holes       := array dyad ()
    premises    := array dyad ()
    pattern     := dyad ?
    replacement := dyad ?
    derivation  := ?
    world       := array @proof ()
  )
)`,
  },
  {
    id: "total",
    title: "total",
    lead: "With <code>+</code> defined, this is ordinary code: three numbers and two operators, parsed by the machinery above.",
    code: `total := 2 + 3 + 4`,
  },
];

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
  "in",
  "break",
  "is",
  "true",
  "false",
]);
// `@dyad` / `@void` tokenize as the `@` operator plus a bare identifier, so the
// pointer type names appear here without their prefix.
// `left` and `right` are the two associativity identities (ruled 9 September 2026),
// keywords with nothing behind them, so they color like the other ground identities.
const LOGOS_TYPES =
  /^(?:[iu](?:8|16|32|64)|f32|f64|string|bool|void!?|dyad|logos|type|instance|lex|exec|scope|proof|conjecture|parsing_tape|callable|number|generic_number|array|left|right)$/;

/** Minimal Logos highlighter for the fixed homepage sample: comments, «strings»,
 *  numbers, keywords, primitive types, and operators become spans; everything else
 *  (including whitespace) is escaped verbatim. Not a general lexer; just enough for
 *  marketing snippets this file controls. */
function highlightLogosLines(source: string): string[] {
  const TOKEN =
    /«[^»]*»|\d[\d_]*(?:\.\d+)?|[A-Za-z_][A-Za-z0-9_@]*!?|:=|->|==|!=|<=|>=|[:=+\-*/%^<>.&@()[\],?!]/g;
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
  return source.split("\n").map((line) => {
    const hash = line.indexOf("#");
    if (hash < 0) return renderCode(line);
    return (
      renderCode(line.slice(0, hash)) +
      `<span class="tok-comment">${escapeHtml(line.slice(hash))}</span>`
    );
  });
}

/** A listing's lines as blocks: each line is its own block so that a blank source
 *  line still takes a line's height, from .code-line's min-height; the lines carry
 *  no "\n" between them, since a newline plus a block would render as a second,
 *  empty line. */
function codeLinesHtml(source: string): string {
  return highlightLogosLines(source)
    .map((line) => `<span class="code-line">${line}</span>`)
    .join("");
}

// ── Examples page ─────────────────────────────────────────────────────────────
// One article per definition (Thobias, 15 September 2026), in dependency order, with
// the identifier as its title, a line or two of prose from the source file's own
// comments, and the code held by an open bracket down its left side (see .listing).
export function examplesPage(): string {
  const items = EXAMPLES.map(
    (e) => `  <article class="example" id="${e.id}">
    <h2 class="example__title">${escapeHtml(e.title)}</h2>
    <p class="example__lead">${e.lead}</p>
    <pre class="listing example__code"><code>${codeLinesHtml(e.code)}</code></pre>
  </article>`,
  ).join("\n");
  return `<section class="examples">
  <h1 class="examples__title">Examples</h1>
  <p class="examples__lead">The language defining itself, one definition at a time, in the order that dependency demands: the dyad, the self-classifying <code>logos</code>, <code>type</code>, the scope opener <code>(</code>, and <code>+</code>, an ordinary operator built out of all of it. The definitions come from the language's own <a href="${GITHUB}" target="_blank" rel="noopener noreferrer">source files</a> with their comments stripped, except <code>+</code>, which has no file yet. None of it runs yet; the <a href="/roadmap/">roadmap</a> says where things stand.</p>
${items}
</section>`;
}

// ── Comparison matrix ─────────────────────────────────────────────────────────
// Logos next to the languages a PL-literate visitor reaches for first. The Logos
// column describes the design Logos is built toward, not software that runs today;
// the "Usable today" row says so in the table's own terms, and the ladder's Logos
// rung says it in words. The table keeps the rows where OTHER languages beat Logos
// (content-addressed code, ecosystem, tooling, being usable at all). It had a lead
// paragraph saying all this until Thobias cut it (21 September 2026): title,
// legend, chips, table, notes. Verdicts for the other columns were researched and
// adversarially fact-checked per language (July 2026); the numbered footnotes carry
// the nuance a one-glyph cell cannot.
//
// On the homepage the reader chooses the columns (Thobias, 21 September 2026): a ×
// in each language header hides that column, a chip row above the table adds it
// back, and the choice is kept in localStorage. /compare/ shows all eleven.

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

interface CompareLang {
  /** The column's handle: on every cell as data-lang, and in the reader's
   *  localStorage as part of their hidden set, so it must not change once shipped. */
  id: string;
  name: string;
}
const COMPARE_LANGS: CompareLang[] = [
  { id: "logos", name: "Logos" },
  { id: "cpp", name: "C/C++" },
  { id: "rust", name: "Rust" },
  { id: "zig", name: "Zig" },
  { id: "lean", name: "Lean 4" },
  { id: "unison", name: "Unison" },
  { id: "racket", name: "Racket" },
  { id: "smalltalk", name: "Smalltalk" },
  { id: "julia", name: "Julia" },
  { id: "python", name: "Python" },
  { id: "ts", name: "TS/JS" },
  { id: "mojo", name: "Mojo" },
];

// The columns the homepage hides to begin with: eleven neighbors were too many to
// read (Thobias, 21 September 2026). Ranked by what each column adds. Mojo, Zig and
// Python each say what a neighbor says (Zig agrees with C/C++ on 17 of 23 rows,
// Python with TS/JS on 17); Unison's and TS/JS's only yes cells sit in rows where
// Logos is itself only partial; C/C++ has no row where it beats Rust. Every one of
// them is a chip above the table, one click from coming back.
const HOME_HIDDEN = ["cpp", "zig", "unison", "python", "ts", "mojo"];

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

/** @param toggles When given, every column but Logos gets a hide button, a chip row
 *  above the table offers the hidden ones back, and `hidden` names the columns that
 *  start out hidden (the client side is in initCompare, client/main.ts). Without it,
 *  the plain table. */
function compareHtml(toggles?: { hidden: readonly string[] }): string {
  const hidden = new Set(toggles?.hidden ?? []);
  for (const id of hidden) {
    if (!COMPARE_LANGS.some((l) => l.id === id)) {
      throw new Error(`compareHtml: unknown language id ${id}`);
    }
  }
  // Every column but Logos carries its language id on each cell, so a toggle can
  // reach the whole column; a hidden column's cells start out .is-off. Cells are in
  // COMPARE_LANGS order, so a cell past the last language is a data error.
  const langAt = (i: number): CompareLang => {
    const lang = COMPARE_LANGS[i];
    if (!lang) throw new Error(`compareHtml: cell ${i} has no language`);
    return lang;
  };
  const colAttrs = (i: number): string => (i === 0 ? "" : ` data-lang="${langAt(i).id}"`);
  const off = (i: number): string => (hidden.has(langAt(i).id) ? " is-off" : "");
  const head = COMPARE_LANGS.map((lang, i) => {
    const hide =
      toggles && i > 0
        ? `<button type="button" class="compare__off" data-lang="${lang.id}" aria-label="Hide ${lang.name}">×</button>`
        : "";
    return `<th scope="col" class="compare__lang${i === 0 ? " compare__lang--logos" : ""}${off(i)}"${colAttrs(i)}>${lang.name}${hide}</th>`;
  }).join("");
  const rows = COMPARE_ROWS.map((row) => {
    const cells = row.cells
      .map((cell, i) => {
        const sup = cell.note
          ? `<sup class="compare__ref"><a href="#compare-note-${cell.note}" aria-label="Note ${cell.note}">${cell.note}</a></sup>`
          : "";
        return `<td class="compare__cell is-${cell.v}${i === 0 ? " compare__cell--logos" : ""}${off(i)}"${colAttrs(i)}><span aria-hidden="true">${VERDICT_GLYPH[cell.v]}</span><span class="sr-only">${VERDICT_TEXT[cell.v]}</span>${sup}</td>`;
      })
      .join("");
    return `<tr><th scope="row" class="compare__cap">${row.label}<span class="compare__sub">${row.sub}</span></th>${cells}</tr>`;
  }).join("");
  const notes = COMPARE_NOTES.map(
    (note, i) => `<li id="compare-note-${i + 1}">${note}</li>`,
  ).join("");
  // One chip per language, in column order; a chip is .is-off while its column
  // shows, and the row is .is-empty when nothing is hidden.
  const chips = toggles
    ? `
  <div class="compare__chips${hidden.size === 0 ? " is-empty" : ""}" data-compare-chips>
    <span class="compare__chips-label">Add a language:</span>
    ${COMPARE_LANGS.slice(1)
      .map(
        (lang) =>
          `<button type="button" class="compare__chip${hidden.has(lang.id) ? "" : " is-off"}" data-lang="${lang.id}">+ ${lang.name}</button>`,
      )
      .join("\n    ")}
  </div>`
    : "";
  return `<section class="compare" aria-label="How Logos compares to other languages">
  <h2 class="compare__title">Comparison Matrix</h2>
  <ul class="compare__legend"><li class="is-yes"><span aria-hidden="true">✓</span> has it</li><li class="is-partial"><span aria-hidden="true">~</span> partial</li><li class="is-no"><span aria-hidden="true">✗</span> no</li></ul>${chips}
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

/** The matrix on its own page as well. It left the homepage when that became a
 *  two-column read (11 September 2026), since a 13-column table with an intrinsic
 *  floor of 82rem cannot share a page with anything, and went back to the foot of the
 *  homepage when the code column went (21 September 2026). It carries its own title,
 *  so the page is the section. */
export function comparePage(): string {
  return compareHtml();
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

// The homepage is one column of sections, each sizing itself (Thobias, 21 September
// 2026). It was a two-column grid, prose down the left and one continuous code
// listing down the right, from 11 September 2026 until the code was dropped.
//
// Three sections: the hero, the comparison matrix, the signup. The ladder of meta,
// the Logic Graph figure, "Checked, not clever" and "Built from proven parts" sat
// between the hero and the matrix until 21 September 2026, when Thobias cut them.
// The quotes that ran as a band under the hero moved into the page margins the same
// day (build/wisdom.ts).
export function homePage(): string {
  return `<section class="hero">
  <h1 class="hero__headline">
    <span class="hero__brand" aria-hidden="true">Λόγος</span>
    <span class="hero__lead" aria-hidden="true">One language for everything</span>
    <span class="sr-only">Λόγος: one language for everything.</span>
  </h1>
  <p class="hero__sub">Logos is maximally meta. Its grammar, types, proofs, compiler and interpreter live in the same graph as your program, so your code can read and redefine any of them, and every change is checked. Meta used to mean unchecked and slow. Here it is neither.</p>
</section>
${compareHtml({ hidden: HOME_HIDDEN })}
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
    <li><code>localStorage</code> <code>compareHidden</code>: which columns you have hidden in the homepage's comparison table. A convenience, nothing personal; it stays until you clear site data.</li>
    <li><code>sessionStorage</code> <code>wisdomIndex</code>: which of the quotes in the page margins comes up next, so you keep meeting new ones as you browse. A single number; it disappears when you close the tab.</li>
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
