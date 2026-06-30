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
import {
  LINE_ORDER,
  LINE_LABELS,
  v1DueOn,
  type Station,
  type Zone,
  type ChipStatus,
} from "./roadmap.ts";

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

// The roadmap is a metro map generated from LogosLang GitHub issues (see
// build/roadmap.ts + fetch-roadmap.ts), so the issue tracker is the single source
// of truth. The eight themed lines and the v0/v1 milestone framing are fixed
// presentation; issues only fill stations into them via `area:<key>` labels. A
// station's band (toward-v1 vs after-v1) comes from its milestone, and its chip
// (Done / In progress / Planned) from its issue state.

function chipLabel(status: ChipStatus): string {
  return status === "done"
    ? "Done"
    : status === "prog"
      ? "In progress"
      : "Planned";
}

function stationHtml(s: Station): string {
  return `<li class="stop"><span class="stop__dot"></span><div class="stop__body"><h3 class="stop__name">${escapeHtml(s.title)}</h3><p class="stop__desc">${escapeHtml(s.body)}</p><span class="chip chip--${s.status}">${chipLabel(s.status)}</span></div></li>`;
}

function zoneHtml(stations: Station[], zone: Zone): string {
  return LINE_ORDER.map((key) => {
    const stops = stations.filter((s) => s.line === key && s.zone === zone);
    if (stops.length === 0) return "";
    return `<section class="line" data-line="${key}"><h2 class="line__theme">${LINE_LABELS[key]}</h2><ol class="line__stops">${stops
      .map(stationHtml)
      .join("")}</ol></section>`;
  }).join("");
}

function milestoneHtml(name: string, note: string, cls: string): string {
  return `<div class="milestone ${cls}"><span class="milestone__dot"></span><span class="milestone__name">${name}</span><span class="milestone__note">${note}</span></div>`;
}

function formatDue(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ""
    : d.toLocaleDateString("en-US", {
        month: "short",
        year: "numeric",
        timeZone: "UTC",
      });
}

export function roadmapPage(stations: Station[]): string {
  if (stations.length === 0) {
    return `<article class="roadmap">
  <h1 class="roadmap__title">Roadmap</h1>
  <p class="roadmap__lead">The roadmap is generated from the project's GitHub issues and will appear here once they are published.</p>
</article>`;
  }
  const due = v1DueOn(stations);
  const v1Note =
    due && formatDue(due)
      ? `first self-hosting release &middot; target ${formatDue(due)}`
      : "first self-hosting release";
  return `<article class="roadmap">
  <h1 class="roadmap__title">Roadmap</h1>
  <p class="roadmap__lead">The headline is the destination, not the current release. Logos is pre-alpha and nothing here ships yet. Everything above the v1 interchange is in progress now; everything below it is planned, landing across later versions.</p>
  <div class="metro">
    ${milestoneHtml("v0", "bootstrap begins", "milestone--origin")}
    <div class="metro-lines">${zoneHtml(stations, "v1")}</div>
    ${milestoneHtml("v1", v1Note, "milestone--v1")}
    <div class="metro-lines">${zoneHtml(stations, "later")}</div>
    <p class="metro-future">Branch lines release across v1.X &middot; v2 &middot; v3.</p>
  </div>
</article>`;
}
