// Inner HTML for the marketing pages. Kept faithful to the established design:
// golden-section hero (whose primary action is the get-notified form until real
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
// Honest target syntax in the systems meta-language register of the actual sources,
// not a CAS demo: the declare/reassign lines follow reference/operators verbatim,
// the fn signature, `error «…»` body, dyad struct, and assign(declare(&mut logos,
// «:=»), ?, ?) are taken near-verbatim from LogosLang's language_sketch.logos, and
// `?` (the typed unknown) is DESIGN.md substrate vocabulary. The card labels it all
// as target syntax so it never overclaims.
const HOME_SAMPLE = `# Declare with \`:=\`, reassign with \`=\`.
count := mut i32 0
count = count + 1

# Systems code: borrowed references, checked errors.
advance := fn (tokens : &mut array dyad, idx : u64) -> void! (
    if idx+1 >= tokens.size
        error «not enough tokens after idx»
    # rewrite or evaluate the graph from here
)

# The language is defined in itself: the node cell, «:=»,
# and «=» are ordinary declarations in the Logic Graph.
dyad := struct (type := dyad@ undefined, value := void@ undefined)
assign(declare(&mut logos, «:=»), ?, ?)
assign(declare(&mut logos, «=»), ?, ?)`;

const LOGOS_KEYWORDS = new Set([
  "fn", "mut", "immut", "type", "struct", "shared", "if", "else", "for",
  "while", "and", "or", "xor", "not", "where", "eval", "self", "error",
  "undefined",
]);
const LOGOS_TYPES = /^(?:[iu](?:8|16|32|64)|f32|f64|string|bool|dyad@?|void@|exec@)$/;

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
      if (t.startsWith("«")) out += `<span class="tok-str">${escapeHtml(t)}</span>`;
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

function codePeekHtml(): string {
  return `<section class="code-peek" aria-label="What Logos looks like">
  <h2 class="code-peek__title">What Logos looks like</h2>
  <p class="code-peek__lead">Target syntax, taken straight from the language design and the <a href="/docs/">docs</a>: everyday systems code and the language's own definition live in the same structure. The compiler that runs it is pre-alpha; the <a href="/roadmap/">roadmap</a> tracks what actually works today.</p>
  <figure class="code-card">
    <figcaption class="code-card__bar"><span class="code-card__name">target-syntax.logos</span><span class="code-card__badge">target syntax, not yet runnable</span></figcaption>
    <pre class="code-card__pre"><code>${highlightLogos(HOME_SAMPLE)}</code></pre>
  </figure>
</section>`;
}

// ── Comparison matrix ─────────────────────────────────────────────────────────
// Logos next to the languages a PL-literate visitor reaches for first. The Logos
// column describes the design Logos is built toward (the lead paragraph carries the
// pre-alpha disclaimer once, rather than per cell), and the table keeps the rows
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

const COMPARE_LANGS = ["Logos", "Rust", "Lean 4", "Unison", "Racket", "Smalltalk"];

const COMPARE_ROWS: CompareRow[] = [
  {
    label: "Memory safety without a GC",
    sub: "ownership and borrow checking, zero runtime cost",
    cells: [{ v: "yes" }, { v: "yes" }, { v: "no" }, { v: "no" }, { v: "no" }, { v: "no" }],
  },
  {
    label: "Compiles to native machine code",
    sub: "AOT or JIT, systems-grade performance",
    cells: [{ v: "yes" }, { v: "yes" }, { v: "yes", note: 1 }, { v: "partial" }, { v: "partial" }, { v: "partial" }],
  },
  {
    label: "Formal proofs in the language",
    sub: "dependent types / theorem proving built in",
    cells: [{ v: "yes" }, { v: "no" }, { v: "yes" }, { v: "no" }, { v: "no" }, { v: "no" }],
  },
  {
    label: "Gradual verification",
    sub: "prove one part, leave the rest ordinary code",
    cells: [{ v: "yes" }, { v: "no" }, { v: "yes" }, { v: "no" }, { v: "no" }, { v: "no" }],
  },
  {
    label: "Code as data",
    sub: "programs are a structure the language can read",
    cells: [{ v: "yes" }, { v: "partial", note: 2 }, { v: "yes" }, { v: "partial" }, { v: "yes" }, { v: "yes" }],
  },
  {
    label: "Semantic reflection",
    sub: "the readable structure carries types and checked facts",
    cells: [{ v: "yes" }, { v: "no" }, { v: "yes" }, { v: "no" }, { v: "partial" }, { v: "partial", note: 3 }],
  },
  {
    label: "Compiler extensible as a library",
    sub: "new syntax and optimizations as ordinary libraries",
    cells: [{ v: "yes" }, { v: "partial", note: 2 }, { v: "yes" }, { v: "no" }, { v: "yes", note: 4 }, { v: "yes" }],
  },
  {
    label: "First-class rewrite engine",
    sub: "equality saturation shared by compiler and user code",
    cells: [{ v: "yes" }, { v: "no" }, { v: "partial", note: 5 }, { v: "no" }, { v: "partial", note: 8 }, { v: "partial", note: 8 }],
  },
  {
    label: "Live system",
    sub: "redefine parts of a running program",
    cells: [{ v: "yes" }, { v: "no" }, { v: "no" }, { v: "partial" }, { v: "partial" }, { v: "yes" }],
  },
  {
    label: "Content-addressed code",
    sub: "definitions identified by hash of their content",
    cells: [{ v: "no", note: 6 }, { v: "no" }, { v: "no" }, { v: "yes" }, { v: "no" }, { v: "no" }],
  },
  {
    label: "Usable today",
    sub: "a stable compiler you can build real software on now",
    cells: [{ v: "no" }, { v: "yes" }, { v: "yes" }, { v: "yes", note: 7 }, { v: "yes" }, { v: "yes" }],
  },
  {
    label: "Package ecosystem",
    sub: "packages, users, production track record",
    cells: [{ v: "no" }, { v: "yes" }, { v: "partial" }, { v: "partial", note: 7 }, { v: "partial" }, { v: "partial" }],
  },
  {
    label: "Mature IDE and tooling",
    sub: "completion, go-to-definition, refactoring that work now",
    cells: [{ v: "no" }, { v: "yes" }, { v: "yes" }, { v: "partial" }, { v: "partial" }, { v: "yes" }],
  },
];

const COMPARE_NOTES: string[] = [
  "Lean 4 compiles through C, but its runtime uses reference counting: fast, yet not a no-GC systems language.",
  "Rust proc macros transform token streams before type checking; the compiler's passes are not extensible.",
  "Smalltalk reflects everything at runtime, but nothing is statically typed or proved.",
  "Racket's #lang makes whole languages ordinary libraries; the optimizer itself is not user-extensible.",
  "Lean's simp and @[csimp] rule sets are first-class directed rewriting; there is no e-graph equality saturation.",
  "Not a Logos goal: source files stay canonical, so a build is reproducible from text alone.",
  "Most of Unison's public production mileage is Unison Cloud, built by the language's own company.",
  "Racket's macro expander and Smalltalk's Refactoring-Browser rewriter are user-drivable tree rewriting; neither is equality saturation, and neither serves as the compiler's optimizer.",
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
      `<th scope="col" class="compare__lang${i === 0 ? " compare__lang--logos" : ""}">${lang}${
        i === 0 ? '<span class="compare__pre">pre-alpha</span>' : ""
      }</th>`,
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
  <p class="compare__lead">The first question a language-literate visitor asks is "why not Rust, Lean, Unison, or a Lisp?". Here is the honest answer. <strong>Logos is pre-alpha</strong>: its column is the design it is being built toward, not software you can run today, while every other column is what ships now. Some rows are things other languages do well that Logos does not attempt at all.</p>
  <ul class="compare__legend"><li class="is-yes"><span aria-hidden="true">✓</span> has it</li><li class="is-partial"><span aria-hidden="true">~</span> partial</li><li class="is-no"><span aria-hidden="true">✗</span> no</li></ul>
  <div class="compare__scroll">
    <table class="compare__table">
      <thead><tr><th scope="col" class="compare__cap">Capability</th>${head}</tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </div>
  <ol class="compare__notes">${notes}</ol>
</section>`;
}

export function homePage(): string {
  return `<section class="hero">
  <div class="hero__copy">
    <p class="hero__note"><strong>NOTE:</strong> The Logos programming language isn't done yet, so much of what is stated here isn't something you can download today, but rather an attempt to show what Logos aims towards.</p>
    <h1 class="hero__headline"><span class="hero__brand" aria-hidden="true">Λόγος</span><span class="hero__rotator" data-rotator aria-hidden="true"><span class="hero__rot-item is-current">Compiles to Native Speed</span><span class="hero__rot-item">Ships Its Compiler as a Library</span><span class="hero__rot-item">Reads and Writes Itself</span><span class="hero__rot-item">Is a Complete Meta-Language</span><span class="hero__rot-item">Mirrors the Mind</span><span class="hero__rot-item">Is Radical Unification</span><span class="hero__rot-item">Makes English Programmable</span><span class="hero__rot-item">Reflects on Every Aspect of Itself</span><span class="hero__rot-item">Proves Its Own Code Correct</span><span class="hero__rot-item">Borrow-Checks Without a GC</span><span class="hero__rot-item">Optimizes Like Algebra</span></span><span class="sr-only">Logos: a self-proving meta-language.</span></h1>
    <p class="hero__sub">The compiler, the parser, the files, the build, the types, the borrow checker, the proofs, all in one structure. The same operations that run your code can read, rewrite, optimize, and prove any of it.</p>
    ${notifyFormHtml("home-hero")}
    <p class="hero__availability">No public builds yet. You will get an email for the most important builds. You will not be spammed (<a href="/privacy/">privacy</a>).</p>
    <div class="hero__actions"><a class="logos-btn logos-btn--ghost" href="/vision/">the Vision</a><a class="logos-btn logos-btn--ghost" href="/roadmap/">Roadmap</a></div>
  </div>
</section>
<section class="wisdom" aria-label="On the Logos, voices across the ages">
  <div class="wisdom__scroll"><div class="wisdom__track">${wisdomUnits()}</div></div>
</section>
${codePeekHtml()}
${compareHtml()}`;
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
  <p>Logic Graph code is interpreted by default. Freeze a region and it can be JIT-compiled with Cranelift, staying fully reflectable through the Logic Graph it was compiled from. The interpret-versus-compile choice is a matter of profitability, not semantics.</p>

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
// Who is building Logos, written in Thobias's own voice (first person). The photo
// ships as /public/thobias.jpg (a web-sized copy of resources/images/
// ThobiasKnudsen.jpg).
export function aboutPage(): string {
  return `<article class="about">
  <h1 class="about__title">About</h1>
  <p class="about__lead">I'm <strong>Thobias Melfjord Knudsen</strong>, a systems programmer from Trondheim, Norway, and I design and build Logos.</p>
  <p>In March 2026 I won Norway's first national AI championship, <a href="https://app.ainm.no" target="_blank" rel="noopener noreferrer">NM i AI</a>, placing first ahead of more than 1,100 teams and 3,100 participants. I did not win by writing everything by hand, but by understanding the problems deeply and orchestrating fleets of AI agents with precision. That is the same way I build Logos.</p>
  <p>In the subject Algorithms and Data Structures at NTNU, one of the hardest subjects on the university with 900 students, I made the fastest algorithm most times through the fall of 2025.</p>
  <p>My background is close to the metal: hash tables in Zig, logging and concurrency libraries in C, systems work in Rust. That history is why Logos insists on being a serious systems language first, with a borrow checker and native compilation, even as it reaches for proofs, reflection, and the unification the <a href="/vision/">vision</a> describes.</p>
  <p>Ever since I learned programming in 2020 I've always wanted a programming language where the language itself has no boundaries of expressiveness. I wanted something where you could express anything logical in the programming language, just like English. Mathematics is its own language, but in nearly all math problems there is English text to explain and answer the maths involved. That means math itself is an incomplete language in terms of expressiveness. English is more expressive. Since Logos aims to have no restrictions on expressiveness, Logos should be able to express all languages (linguistic, programmatic, Rust, Python, C, WASM, GPU languages, HDL, proof systems, Verilog, etc.) and it should be able to read all aspects of itself. But Logos also needs to have some sort of restrictions so that it catches errors, just like Rust. And since Logos should be able to express anything and can host a proof system, it should be able to go way beyond Rust when it comes to safety long term.</p>
  <p class="about__links">Find me on <a href="https://github.com/ThobiasKnudsen" target="_blank" rel="noopener noreferrer">GitHub</a>, <a href="https://no.linkedin.com/in/thobias-melfjord-knudsen-510084320" target="_blank" rel="noopener noreferrer">LinkedIn</a>, and <a href="https://x.com/thobknu" target="_blank" rel="noopener noreferrer">X</a>.</p>
  <figure class="about__portrait">
    <img src="/thobias.jpg" alt="Thobias Melfjord Knudsen" width="843" height="900" loading="lazy" />
    <figcaption>Thobias Melfjord Knudsen</figcaption>
  </figure>
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
  <p class="download__lead">Logos is pre-alpha and has no public builds yet. The moment the first version is released, this page lists a one-line install command and a direct download for every OS. Leave your email and you'll hear about it the day it happens.</p>
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
  <p class="download__lead">Choose a version, then copy the install command for your OS or download the build directly. Logos is pre-alpha, so expect breaking changes between versions.</p>
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
// A reviewable template describing the consent-gated analytics. Set PRIVACY_CONTACT
// in the build env to surface a contact email; otherwise it points at GitHub issues.
export function privacyPage(): string {
  const contact = process.env.PRIVACY_CONTACT || "";
  const contactLine = contact
    ? `<a href="mailto:${escapeHtml(contact)}">${escapeHtml(contact)}</a>`
    : `the maintainers via the <a href="${GITHUB}/issues">GitHub repository</a>`;
  return `<article class="legal">
  <h1 class="legal__title">Privacy &amp; Cookies</h1>
  <p class="legal__updated">Applies to logoslang.dev.</p>

  <p>This is the documentation and marketing site for the Logos language. We keep data collection to a minimum and never sell it. Analytics run <strong>only if you accept</strong> in the cookie banner.</p>

  <h2>What we collect (only with your consent)</h2>
  <p>If you accept analytics cookies, two third-party tools help us understand how the site is used:</p>
  <ul>
    <li><strong>Microsoft Clarity</strong>: aggregated usage, heatmaps, and session replays (clicks, scrolling, navigation), with text input masked.</li>
    <li><strong>Google Analytics 4</strong>: aggregated traffic such as pages viewed, referrer / traffic source, approximate (city-level) location derived from your IP, and device, browser, and operating system.</li>
  </ul>
  <p>We do <strong>not</strong> collect your name, email, or other identifying details from ordinary browsing, and we do not attempt to identify individual visitors.</p>

  <h2>Release notifications (only if you sign up)</h2>
  <p>The home and download pages have an optional "get notified" form. If you submit it, we store the email address you entered, the time you signed up, and which page's form you used, in Cloudflare Workers KV, and use it for exactly one purpose: emailing you when the most important Logos builds are released. It is a low-volume announcement list; you will not be spammed. It is never sold, shared, or used for analytics, and it sets no cookies. The legal basis is your consent, given by submitting the form.</p>
  <p>To be removed from the list at any time, contact ${contactLine} and the address is deleted.</p>

  <h2>Cookies we use</h2>
  <ul>
    <li><code>consent</code>: remembers your accept/reject choice (strictly necessary). ~180 days.</li>
    <li><strong>Microsoft Clarity:</strong> <code>_clck</code>, <code>_clsk</code> and related: set only after you accept.</li>
    <li><strong>Google Analytics:</strong> <code>_ga</code>, <code>_ga_*</code>: set only after you accept.</li>
  </ul>

  <h2>Legal basis and your choices</h2>
  <p>Analytics cookies are used on the basis of your <strong>consent</strong>. You can reject them (the site works fully without them), and change your mind at any time via <strong>“Cookie settings”</strong> in the footer. Rejecting or withdrawing stops new analytics cookies; you can clear existing ones in your browser.</p>

  <h2>Where your data goes</h2>
  <p>If you sign up for release notifications, the address is stored with Cloudflare, which hosts this site. When enabled, analytics data is processed by Microsoft (Clarity) and Google (Google Analytics) as our processors, which may involve transfer outside your country. See the <a href="https://privacy.microsoft.com/privacystatement" target="_blank" rel="noopener noreferrer">Microsoft Privacy Statement</a> and the <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer">Google Privacy Policy</a>.</p>

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
  const lead = `The roadmap is generated directly from the <a href="${GITHUB}" target="_blank" rel="noopener noreferrer">LogosLang GitHub repository</a>: every card below is an issue labelled <code>roadmap</code>, and every dashed line is a milestone. A milestone is a finish line: the issues above it are the work that gets Logos there, and everything below it comes later. Arrows point from a piece of work down to the work it unblocks.`;
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
