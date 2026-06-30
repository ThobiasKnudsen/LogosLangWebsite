// Inner HTML for the marketing pages. Kept faithful to the established design:
// golden-section hero, single Download CTA, and the "one idea" pillar grid.
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

const DOWNLOAD = "/download/";
const GITHUB = "https://github.com/ThobiasKnudsen/LogosLang";

const PILLARS: { title: string; body: string }[] = [
  {
    title: "One structure for everything",
    body: `Programs, types, proofs, the optimizer, the standard library, even the compiler's own logic live in a single reflectable structure. The same operations you run on your code traverse any of it.`,
  },
  {
    title: "A tiny seed that self-hosts",
    body: `A minimal Rust seed starts the system; everything beyond is written in Logos until it compiles itself. Small enough to audit by hand, and eventually verify.`,
  },
  {
    title: "Interpret by default, JIT on demand",
    body: `Code is interpreted by default; freeze a region and it JIT-compiles via Cranelift, staying fully reflectable through the graph it came from.`,
  },
  {
    title: "Memory safety without a garbage collector",
    body: `A borrow checker with lexical lifetimes, ownership, and moves: many readers <em>or</em> one writer, proven at compile time. No garbage collector, no runtime cost. The same rule governs visibility, borrowing, and reflection alike.`,
  },
  {
    title: "One rewriting engine",
    body: `Compiler optimization, computer algebra, and your own transforms are one operation. The same engine serves <code>x + 0 → x</code> and <code>sin²θ + cos²θ → 1</code>.`,
  },
  {
    title: "Pay only for what you verify",
    body: `Memory safety comes free; above it, opt-in refinement types, pre- and post-conditions, then full dependent-type proofs checked by a small kernel. Lower code is never burdened by higher guarantees.`,
  },
  {
    title: "The compiler is a library",
    body: `The borrow checker, type checker, optimizer, and the lowerings to native code are ordinary Logos over the graph, not a sealed black box. Adding an optimization or a backend is library work.`,
  },
  {
    title: "Concurrency without data races",
    body: `<code>parallel for</code> over disjoint indices and stackless <code>async</code> tasks, with the borrow checker proving data-race freedom statically. Shared graph reads are free; writes are exclusive.`,
  },
  {
    title: 'Never settle for "ok" syntax',
    body: `Syntax is data too. The grammar lives in the graph, so the language can be extended and rewritten: a constructor or macro is ordinary library work.`,
  },
];

export function homePage(): string {
  const cards = PILLARS.map(
    (p) =>
      `<article class="pillar"><h3>${p.title}</h3><p>${p.body}</p></article>`,
  ).join("");

  return `<section class="hero">
  <div class="hero__copy">
    <h1 class="hero__headline"><span class="hero__brand" aria-hidden="true">Λόγος&nbsp;</span><span class="hero__rotator" data-rotator aria-hidden="true"><span class="hero__rot-item is-current">Is Radical Unification</span><span class="hero__rot-item">Proves Its Own Code Correct</span><span class="hero__rot-item">Borrow-Checks Without a GC</span><span class="hero__rot-item">Optimizes Like Algebra</span><span class="hero__rot-item">Compiles to Native Speed</span><span class="hero__rot-item">Ships Its Compiler as a Library</span><span class="hero__rot-item">Reads and Writes Itself</span><span class="hero__rot-item">Is a Complete Meta-Language</span><span class="hero__rot-item">Mirrors the Mind</span></span><span class="sr-only">Logos: a self-proving meta-language.</span></h1>
    <p class="hero__sub">The compiler, the parser, the files, the build, the types, the borrow checker, the proofs, all in one structure. The same operations that run your code can read, rewrite, optimize, and prove any of it.</p>
    <div class="hero__actions"><a class="logos-btn logos-btn--download" href="${DOWNLOAD}">Download</a><a class="logos-btn logos-btn--ghost" href="/roadmap/">Roadmap</a></div>
    <p class="hero__availability">Pre-alpha build for Windows, Mac and Linux.</p>
  </div>
</section>
<section class="pillars">
  <h2>One idea, all the way down</h2>
  <div class="pillar-grid">${cards}</div>
</section>`;
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

export function placeholderPage(title: string, body: string): string {
  return `<section class="placeholder"><h1>${title}</h1><p>${body}</p></section>`;
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
  <p class="download__lead">Logos is pre-alpha, so there are no published builds yet. The moment a version is released, this page lists a one-line install command and a direct download for every OS.</p>
  <div class="download__empty-actions">
    <a class="logos-btn logos-btn--download" href="${GITHUB}/releases" target="_blank" rel="noopener noreferrer">Watch releases on GitHub</a>
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
  <p class="download__lead">Choose a version, then copy the install command for your OS or download the build directly. Logos is pre-alpha — expect breaking changes between versions.</p>
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
// execution is stubbed — but the version picker and editor are live, so only the
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
  <p class="playground__lead">An in-browser Logos playground is on the way. It runs the real Logos runtime compiled to WebAssembly — right here, no install — and arrives with the first release that ships a WASM build.</p>
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

// The roadmap is a metro map and the site's honest counterweight to the hero.
// Work is grouped into themed colored lines; every station carries its own
// status. In-progress stations sit in the "toward v1" zone above the v1
// interchange; planned stations fan out below it, releasing across v1.X / v2 /
// v3 (those versions are deliberately not nodes here). Nothing ships yet.
// Overlapping claims are merged into a single station each; keep statuses
// current as work lands.
type Status = "prog" | "plan";
type Station = { status: Status; title: string; body: string };
type Line = { theme: string; line: string; stations: Station[] };

const LINES: Line[] = [
  {
    theme: "The Logic Graph",
    line: "graph",
    stations: [
      {
        status: "prog",
        title: "One structure for everything",
        body: `The Logic Graph: one structure holding programs, types, the standard library, and the compiler's own logic, all traversed by the same operations.`,
      },
      {
        status: "prog",
        title: "A tiny seed that self-hosts",
        body: `A minimal Rust seed bootstraps the system and processes Logos until it compiles itself; its primitives ship as opaque native code and are ported to reflectable Logos source over time.`,
      },
      {
        status: "prog",
        title: "The mutability and construction model",
        body: `mut as a recursive type modifier and an undefined-to-defined-to-frozen lifecycle, so immutability is the default and frozen is final.`,
      },
      {
        status: "prog",
        title: "Source and runtime graphs",
        body: `A persistent file-backed source graph that is the program's identity, plus an ephemeral arena-allocated runtime graph cleaned up by scope lifetimes, no GC.`,
      },
    ],
  },
  {
    theme: "Parsing & identity",
    line: "parse",
    stations: [
      {
        status: "prog",
        title: "Syntax is data",
        body: `The grammar lives in the graph, so a new operator, constructor, or macro is ordinary library work rather than a change to the language.`,
      },
      {
        status: "plan",
        title: "The identity-recognition engine",
        body: `One engine for parsing, reflection, and rewrite matching: a merged, stratified recognizer that returns every identity matching at a node.`,
      },
      {
        status: "plan",
        title: "Incremental re-identification",
        body: `Edits touch only the tokens they change; each cached identity is a reader, invalidated exactly when the tokens or rules it consulted change.`,
      },
    ],
  },
  {
    theme: "Execution",
    line: "exec",
    stations: [
      {
        status: "prog",
        title: "Interpret by default, JIT on demand",
        body: `Logic Graph code is interpreted directly; a frozen region JIT-compiles via Cranelift and stays reflectable through the graph it came from. Hot regions are promoted to native code automatically and deoptimized back to interpretation when a structural write invalidates them — the choice is profitability, never semantics.`,
      },
      {
        status: "prog",
        title: "Compile-time evaluation and metaprogramming",
        body: `A comptime marker bakes results into the artifact, with the whole language available at parse time over real Logic Graph rather than a macro sublanguage.`,
      },
    ],
  },
  {
    theme: "Compilation & optimization",
    line: "compile",
    stations: [
      {
        status: "prog",
        title: "The compiler is a library",
        body: `The checker, optimizer, and the lowerings to native code are ordinary Logos over the graph, not a sealed black box.`,
      },
      {
        status: "prog",
        title: "One rewriting engine",
        body: `A single equality-saturation engine for compiler optimization, computer algebra, and user transforms, with first-class rule sets and cost functions.`,
      },
      {
        status: "prog",
        title: "The Logos IR",
        body: `A target-agnostic intermediate layer with explicit basic blocks, control flow, memory operations, and types, itself a stratum of the graph. One backend interface consumes it, so Cranelift (the default), LLVM, and other targets are interchangeable and mixable per function or module.`,
      },
    ],
  },
  {
    theme: "Memory & concurrency",
    line: "memory",
    stations: [
      {
        status: "prog",
        title: "User-replaceable allocators",
        body: `Arena, bump, pool, system, and custom allocators behind one interface, with arenas carrying the graph's cyclic structures.`,
      },
      {
        status: "plan",
        title: "The borrow checker, one read/write rule",
        body: `Lexical lifetimes, ownership, and moves with no GC; place- and reference-granular borrows; the same many-readers-or-one-writer rule that also governs visibility and reflection.`,
      },
      {
        status: "prog",
        title: "Multithreading and task scheduling",
        body: `Two concurrency shapes the borrow checker proves race-free. parallel for spreads work over disjoint indices, with threads reading shared graph structure through ordinary shared borrows while writes stay exclusive. Stackless async tasks run on user-controlled executor pools, pausing at an explicit .await, with preemption and cancellation at the boundaries where a task's live state is materialized as graph data.`,
      },
    ],
  },
  {
    theme: "Types & proofs",
    line: "proofs",
    stations: [
      {
        status: "plan",
        title: "Capability and effect tracking",
        body: `Effects as capabilities (pure, total, async, thread-pinned, GPU-subset, allocator-bound) tracked through the call graph, so compile-time code is I/O-free and builds reproduce.`,
      },
      {
        status: "plan",
        title: "Pay only for what you verify",
        body: `Opt-in strata: refinement types with SMT discharge, then pre- and post-conditions, then termination measures. Lower code is never burdened by higher guarantees.`,
      },
      {
        status: "plan",
        title: "Dependent types and a proof kernel",
        body: `Propositions as types and proofs as programs, checked by a small trusted kernel and erased before codegen, with a stratified universe hierarchy.`,
      },
      {
        status: "plan",
        title: "The ecumenical proof system",
        body: `Many theories in one graph, including contradictory ones, each proof carrying the axioms it rests on so that only consistent results combine.`,
      },
    ],
  },
  {
    theme: "Interop & errors",
    line: "interop",
    stations: [
      {
        status: "prog",
        title: "Errors are values",
        body: `Fallible functions return tagged unions (T | Error), handled explicitly via match; no exceptions and no implicit propagation in the core.`,
      },
      {
        status: "prog",
        title: "Native interop and the Rust bridge",
        body: `Calling existing native code in-process across the C ABI with no linker step, independent of which backend compiled either side.`,
      },
    ],
  },
  {
    theme: "Tooling",
    line: "tooling",
    stations: [
      {
        status: "plan",
        title: "A batteries-included standard library",
        body: `Single canonical solutions decided and documented before release: collections, strings, numerics, symbolic math, allocators, concurrency, I/O, and verification.`,
      },
      {
        status: "plan",
        title: "LSP-first editor support",
        body: `A Logos-written language server bringing rich highlighting, errors, autocomplete, and refactoring to any LSP editor.`,
      },
      {
        status: "plan",
        title: "Debugger and profiler integration",
        body: `Standard-protocol DAP debugging, samplers, and flamegraphs, so users keep the tools they already know.`,
      },
      {
        status: "plan",
        title: "A documentation generator",
        body: `Generated from the same graph that holds types, examples, capabilities, and proofs, so docs carry verified examples and proof obligations.`,
      },
      {
        status: "plan",
        title: "A Logos-native structural editor",
        body: `Semantic editing directly on Logic Graphs and an IDE customizable in Logos: the long-term goal, not on the critical path.`,
      },
    ],
  },
];

function milestoneHtml(name: string, note: string, cls: string): string {
  return `<div class="milestone ${cls}"><span class="milestone__dot"></span><span class="milestone__name">${name}</span><span class="milestone__note">${note}</span></div>`;
}

function stationHtml(s: Station): string {
  const label = s.status === "prog" ? "In progress" : "Planned";
  return `<li class="stop"><span class="stop__dot"></span><div class="stop__body"><h3 class="stop__name">${s.title}</h3><p class="stop__desc">${s.body}</p><span class="chip chip--${s.status}">${label}</span></div></li>`;
}

function zoneHtml(status: Status): string {
  return LINES.map((l) => {
    const stops = l.stations.filter((s) => s.status === status);
    if (stops.length === 0) return "";
    return `<section class="line" data-line="${l.line}"><h2 class="line__theme">${l.theme}</h2><ol class="line__stops">${stops
      .map(stationHtml)
      .join("")}</ol></section>`;
  }).join("");
}

export function roadmapPage(): string {
  return `<article class="roadmap">
  <h1 class="roadmap__title">Roadmap</h1>
  <p class="roadmap__lead">The headline is the destination, not the current release. Logos is pre-alpha and nothing here ships yet. Everything above the v1 interchange is in progress now; everything below it is planned, landing across later versions.</p>
  <div class="metro">
    ${milestoneHtml("v0", "bootstrap begins", "milestone--origin")}
    <div class="metro-lines">${zoneHtml("prog")}</div>
    ${milestoneHtml("v1", "first self-hosting release", "milestone--v1")}
    <div class="metro-lines">${zoneHtml("plan")}</div>
    <p class="metro-future">Branch lines release across v1.X &middot; v2 &middot; v3.</p>
  </div>
</article>`;
}
