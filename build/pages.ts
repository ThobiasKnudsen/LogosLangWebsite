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
import dagre from "@dagrejs/dagre";
import { STATUS_LABELS, type Station } from "./roadmap.ts";

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
    <li><strong>Microsoft Clarity</strong> — aggregated usage, heatmaps, and session replays (clicks, scrolling, navigation), with text input masked.</li>
    <li><strong>Google Analytics 4</strong> — aggregated traffic: pages viewed, referrer / traffic source, approximate (city-level) location derived from your IP, and device, browser, and operating system.</li>
  </ul>
  <p>We do <strong>not</strong> collect your name, email, or other identifying details from ordinary browsing, and we do not attempt to identify individual visitors.</p>

  <h2>Cookies we use</h2>
  <ul>
    <li><code>consent</code> — remembers your accept/reject choice (strictly necessary). ~180 days.</li>
    <li><strong>Microsoft Clarity:</strong> <code>_clck</code>, <code>_clsk</code> and related — set only after you accept.</li>
    <li><strong>Google Analytics:</strong> <code>_ga</code>, <code>_ga_*</code> — set only after you accept.</li>
  </ul>

  <h2>Legal basis and your choices</h2>
  <p>Analytics cookies are used on the basis of your <strong>consent</strong>. You can reject them (the site works fully without them), and change your mind at any time via <strong>“Cookie settings”</strong> in the footer. Rejecting or withdrawing stops new analytics cookies; you can clear existing ones in your browser.</p>

  <h2>Where your data goes</h2>
  <p>When enabled, data is processed by Microsoft (Clarity) and Google (Google Analytics) as our processors, which may involve transfer outside your country. See the <a href="https://privacy.microsoft.com/privacystatement" target="_blank" rel="noopener noreferrer">Microsoft Privacy Statement</a> and the <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer">Google Privacy Policy</a>.</p>

  <h2>Your rights</h2>
  <p>Depending on where you live (for example, the EEA or UK under the GDPR), you may have the right to access, correct, or erase your data, to object to or restrict processing, and to withdraw consent. To exercise these rights, contact ${contactLine}.</p>

  <h2>Changes</h2>
  <p>We may update this page as the site evolves; material changes will be reflected here.</p>
</article>`;
}

// The roadmap is the DEPENDENCY GRAPH of LogosLang's `roadmap`-labelled GitHub
// issues (build/roadmap.ts + fetch-roadmap.ts) — the issue tracker is the single
// source of truth, and there are no categories. Each issue is a node; its
// "blocked by" links are the edges. Nodes are laid out in dependency tiers (build
// order) with arrows pointing from a blocker down to what it unblocks; status is
// derived from the graph (Done / Ready / Blocked). Before any dependency is linked
// the graph is edgeless, so we show a plain readiness grid until edges exist.

// Node sizing for the dependency map. Nodes are HTML cards (so the whole blurb is
// readable and wraps); dagre lays them out and routes edges *around* them, and the
// edges are drawn in an SVG layer underneath. Width is fixed; height is estimated
// from the wrapped title + (clamped) blurb so dagre reserves the right room.
const NODE_W = 250;
// Conservative chars-per-line (fewer than the box truly fits) so the estimated
// height OVER-reserves rather than under: nodes never clip their text and dagre
// never lets them overlap. No line caps — the whole blurb is shown.
const TITLE_CPL = 24;
const BLURB_CPL = 30;

function estLines(text: string, cpl: number): number {
  return text ? Math.max(1, Math.ceil(text.length / cpl)) : 0;
}

function nodeHeight(s: Station): number {
  const titleLines = estLines(s.title, TITLE_CPL);
  const blurbLines = estLines(s.blurb, BLURB_CPL);
  // padding + num line + title + (gap + blurb) + slack
  return 22 + 18 + titleLines * 19 + (blurbLines ? 6 + blurbLines * 18 : 0) + 8;
}

/** The dependency map: dagre layout, HTML node cards over an SVG edge layer. */
function depMapSvg(stations: Station[]): string {
  const g = new dagre.graphlib.Graph();
  g.setGraph({ rankdir: "TB", ranksep: 52, nodesep: 30, edgesep: 18, marginx: 18, marginy: 18 });
  g.setDefaultEdgeLabel(() => ({}));
  const heights = new Map<number, number>();
  for (const s of stations) {
    const h = nodeHeight(s);
    heights.set(s.number, h);
    g.setNode(String(s.number), { width: NODE_W, height: h });
  }
  // Edge blocker -> dependent, so an arrow points from a blocker down to what it unblocks.
  for (const s of stations) {
    for (const b of s.blockedBy) {
      if (heights.has(b)) g.setEdge(String(b), String(s.number));
    }
  }
  dagre.layout(g);

  // Bounding box over node rects AND routed edge points (dagre can route slightly
  // outside the node area); translate everything into a 0-based, padded canvas.
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  const see = (x: number, y: number) => {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  };
  for (const s of stations) {
    const n = g.node(String(s.number));
    see(n.x - n.width / 2, n.y - n.height / 2);
    see(n.x + n.width / 2, n.y + n.height / 2);
  }
  const edgePts: { x: number; y: number }[][] = g.edges().map((e) => g.edge(e).points);
  for (const pts of edgePts) for (const p of pts) see(p.x, p.y);
  const pad = 8;
  const offX = pad - minX;
  const offY = pad - minY;
  const W = Math.ceil(maxX - minX + pad * 2);
  const H = Math.ceil(maxY - minY + pad * 2);

  const edgesSvg = edgePts
    .map((pts) => {
      const d = pts
        .map((p, i) => `${i === 0 ? "M" : "L"}${(p.x + offX).toFixed(1)},${(p.y + offY).toFixed(1)}`)
        .join(" ");
      return `<path class="depedge" d="${d}" marker-end="url(#dep-arrow)" />`;
    })
    .join("");

  const nodesHtml = stations
    .map((s) => {
      const n = g.node(String(s.number));
      const h = heights.get(s.number)!;
      const left = (n.x - NODE_W / 2 + offX).toFixed(1);
      const top = (n.y - h / 2 + offY).toFixed(1);
      const href = s.url
        ? ` href="${escapeHtml(s.url)}" target="_blank" rel="noopener noreferrer"`
        : "";
      const desc = s.blurb ? `<p class="depnode__desc">${escapeHtml(s.blurb)}</p>` : "";
      return `<a class="depnode depnode--${s.status}"${href} style="left:${left}px;top:${top}px;width:${NODE_W}px;height:${h}px"><span class="depnode__num">#${s.number}</span><h3 class="depnode__title">${escapeHtml(s.title)}</h3>${desc}</a>`;
    })
    .join("");

  return `<div class="depmap-scroll"><div class="depmap" style="width:${W}px;height:${H}px" role="img" aria-label="Roadmap dependency graph"><svg class="depmap__edges" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" aria-hidden="true"><defs><marker id="dep-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto"><path d="M0,0 L8,4 L0,8 z" /></marker></defs>${edgesSvg}</svg>${nodesHtml}</div></div>`;
}

/** Edgeless fallback: a readiness-grouped card grid until dependencies are linked. */
function depGrid(stations: Station[]): string {
  const cards = stations
    .map((s) => {
      const href = s.url
        ? `href="${escapeHtml(s.url)}" target="_blank" rel="noopener noreferrer"`
        : "";
      const desc = s.blurb ? `<p class="depcard__desc">${escapeHtml(s.blurb)}</p>` : "";
      return `<li class="depcard depcard--${s.status}"><a class="depcard__link" ${href}><span class="depcard__num">#${s.number}</span><h3 class="depcard__title">${escapeHtml(s.title)}</h3>${desc}<span class="chip chip--${s.status}">${STATUS_LABELS[s.status]}</span></a></li>`;
    })
    .join("");
  return `<ul class="depgrid">${cards}</ul>`;
}

export function roadmapPage(stations: Station[]): string {
  if (stations.length === 0) {
    return `<article class="roadmap">
  <h1 class="roadmap__title">Roadmap</h1>
  <p class="roadmap__lead">The roadmap is generated from the project's GitHub issues and will appear here once they're published.</p>
</article>`;
  }
  const hasEdges = stations.some((s) => s.blockedBy.length > 0);
  const lead = hasEdges
    ? `The headline is the destination, not the current release. Logos is pre-alpha — nothing here ships yet. Each box is a tracked issue and the arrows point from a piece of work down to what it unblocks, so the top rows are buildable now and the lower rows wait on them.`
    : `The headline is the destination, not the current release. Logos is pre-alpha — nothing here ships yet. These are the tracked issues; as their <em>blocked by</em> links are added on GitHub, this becomes a build-order dependency graph.`;
  const legend = `<ul class="depmap-legend"><li class="is-done">Done</li><li class="is-ready">Ready</li><li class="is-blocked">Blocked</li></ul>`;
  return `<article class="roadmap">
  <h1 class="roadmap__title">Roadmap</h1>
  <p class="roadmap__lead">${lead}</p>
  ${legend}
  ${hasEdges ? depMapSvg(stations) : depGrid(stations)}
</article>`;
}
