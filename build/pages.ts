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
import { bandsOf, type Band, type Roadmap, type Station } from "./roadmap.ts";

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
    <h1 class="hero__headline"><span class="hero__brand" aria-hidden="true">Λόγος</span><span class="hero__rotator" data-rotator aria-hidden="true"><span class="hero__rot-item is-current">Is Radical Unification</span><span class="hero__rot-item">Makes English Programmable</span><span class="hero__rot-item">Reflects on Every Aspect of Itself</span><span class="hero__rot-item">Proves Its Own Code Correct</span><span class="hero__rot-item">Borrow-Checks Without a GC</span><span class="hero__rot-item">Optimizes Like Algebra</span><span class="hero__rot-item">Compiles to Native Speed</span><span class="hero__rot-item">Ships Its Compiler as a Library</span><span class="hero__rot-item">Reads and Writes Itself</span><span class="hero__rot-item">Is a Complete Meta-Language</span><span class="hero__rot-item">Mirrors the Mind</span></span><span class="sr-only">Logos: a self-proving meta-language.</span></h1>
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

// The roadmap is LogosLang's `roadmap`-labelled GitHub issues grouped into
// MILESTONE BANDS (build/roadmap.ts + fetch-roadmap.ts). The issue tracker is the
// single source of truth. Each milestone is a horizontal "finish line": its issues
// render in the band directly above the line, and every later milestone (and its
// issues) renders below it. Within a band the "blocked by" links are drawn as
// arrows (dagre, from a blocker down to what it unblocks); dependencies that cross a
// milestone boundary are drawn as connectors in the same style. Status is derived from the
// graph (Done / Ready / Blocked); every roadmap issue must have a milestone.

// Node sizing for the dependency map. Nodes are HTML cards; dagre lays them out and
// routes edges *around* them. Each card aims at a 2:1 (wide:tall) shape: since taller
// text needs a wider card to keep that ratio, we solve width = 2 * height (height
// falls as width grows) per card, then clamp. Cards with more text end up both wider
// and taller, but keep the same proportion; the reserved height hugs the text with no
// dead space below, and the tags sit on the top row next to `#N`. CSS caps the width
// to `calc(100vw - 3rem)` so a card is never wider than the window (phones).
const PADDING_X = 24; // .depnode left + right padding (0.75rem * 2)
const BLURB_PX_PER_CHAR = 6.7; // average char advance for the blurb font (tight fit)
const TITLE_PX_PER_CHAR = 7.6; // ... and for the larger title font
const NODE_MIN_W = 220;
const NODE_MAX_W = 560;
const NODE_ASPECT = 2; // target width / height

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
 * Width and height for a card, aiming at NODE_ASPECT:1 (wide:tall). height(width) is
 * non-increasing (wider wraps to fewer rows), so f(w) = w - aspect*height(w) rises
 * monotonically and has one root: the width at which the ratio is hit. Binary-search
 * it, clamp to [MIN, MAX], then set the width to exactly aspect*height so the box
 * reads at the target ratio (short cards that bottom out at MIN stay a bit flatter).
 */
function nodeDims(s: Station): { w: number; h: number } {
  const f = (w: number) => w - NODE_ASPECT * heightForWidth(s, w);
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
  return { w: Math.min(NODE_MAX_W, Math.max(NODE_MIN_W, NODE_ASPECT * h)), h };
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

/** The milestone "finish line": a full-width rule with a label pill on the left. */
function milestoneLineHtml(
  band: Band,
  centerY: number,
  width: number,
  height: number,
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
  const cls = m.state === "closed" ? " msline--closed" : "";
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
 * Lay out the whole roadmap as ONE dagre graph so every dependency edge (within a
 * milestone or across milestones) is ranked and routed the same way, around nodes.
 *
 * Milestone banding is enforced with an invisible boundary node per milestone: every
 * issue in a milestone links down to its boundary, and the boundary links down to the
 * next milestone's issues. That forces each milestone's issues above its line and
 * below all earlier ones, while dagre still routes cross-milestone edges around nodes.
 * Boundary/ordering edges are never drawn. The milestone line is drawn at its
 * boundary node's y. The whole graph is shifted right by a LEFT GUTTER wide enough for
 * the widest label pill, which stays flush-left so edges never cross behind a label.
 */
function bandedMap(bands: Band[], stations: Station[]): string {
  const LINE_H = 30; // reserved vertical space for a milestone line (boundary node)
  const LABEL_MARGIN = 28; // clear space between the label column and the graph
  const LABEL_GUTTER = Math.min(
    340,
    Math.round(Math.max(...bands.map(estLabelWidth)) + LABEL_MARGIN),
  );

  const g = new dagre.graphlib.Graph();
  g.setGraph({
    rankdir: "TB",
    ranksep: 50,
    nodesep: 16,
    edgesep: 18,
    marginx: 18,
    marginy: 18,
  });
  g.setDefaultEdgeLabel(() => ({}));

  const inSet = new Set(stations.map((s) => s.number));
  const heights = new Map<number, number>();
  const widths = new Map<number, number>();
  for (const s of stations) {
    const { w, h } = nodeDims(s);
    heights.set(s.number, h);
    widths.set(s.number, w);
    g.setNode(String(s.number), { width: w, height: h });
  }
  // Real dependency edges (blocker -> dependent); the only ones drawn.
  for (const s of stations) {
    for (const b of s.blockedBy) {
      if (inSet.has(b)) g.setEdge(String(b), String(s.number));
    }
  }

  // Invisible boundary node + ordering edges per milestone (see the doc comment).
  const boundaryId = (n: number) => `__ms_${n}`;
  const boundaryIds = new Set<string>();
  let prev: string | null = null;
  for (const band of bands) {
    const bid = boundaryId(band.milestone.number);
    boundaryIds.add(bid);
    g.setNode(bid, { width: 1, height: LINE_H });
    for (const s of band.stations) g.setEdge(String(s.number), bid); // issues above the line
    if (prev) {
      g.setEdge(prev, bid); // keep boundaries ordered even across empty milestones
      for (const s of band.stations) g.setEdge(prev, String(s.number)); // issues below the prev line
    }
    prev = bid;
  }

  dagre.layout(g);

  // Bounding box over real node rects, real edge points, and boundary y-extents.
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
  const isReal = (e: { v: string; w: string }) =>
    !boundaryIds.has(e.v) && !boundaryIds.has(e.w);
  const realEdges: { x: number; y: number }[][] = g
    .edges()
    .filter(isReal)
    .map((e) => g.edge(e).points);
  for (const pts of realEdges) for (const p of pts) see(p.x, p.y);
  for (const bid of boundaryIds) {
    const n = g.node(bid);
    see(n.x, n.y - LINE_H / 2);
    see(n.x, n.y + LINE_H / 2);
  }

  const offX = CANVAS_PAD + LABEL_GUTTER - minX;
  const offY = CANVAS_PAD - minY;
  const W = Math.max(
    Math.ceil(maxX - minX + CANVAS_PAD * 2 + LABEL_GUTTER),
    320,
  );
  const H = Math.ceil(maxY - minY + CANVAS_PAD * 2);

  const edgesHtml = realEdges
    .map((pts) => {
      const d = pts
        .map(
          (p, i) =>
            `${i === 0 ? "M" : "L"}${(p.x + offX).toFixed(1)},${(p.y + offY).toFixed(1)}`,
        )
        .join(" ");
      return `<path class="depedge" d="${d}" marker-end="url(#dep-arrow)" />`;
    })
    .join("");

  const nodesHtml = stations
    .map((s) => {
      const n = g.node(String(s.number));
      const h = heights.get(s.number)!;
      const w = widths.get(s.number)!;
      const left = (n.x - w / 2 + offX).toFixed(1);
      const top = (n.y - h / 2 + offY).toFixed(1);
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

  const linesHtml = bands
    .map((band) => {
      const n = g.node(boundaryId(band.milestone.number));
      return milestoneLineHtml(band, n.y + offY, W, LINE_H);
    })
    .join("");

  return `<div class="depmap-scroll"><div class="depmap" style="width:${W}px;height:${H}px" role="img" aria-label="Roadmap milestones and dependency graph"><svg class="depmap__edges" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" aria-hidden="true"><defs><marker id="dep-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto"><path d="M0,0 L8,4 L0,8 z" /></marker></defs>${edgesHtml}</svg>${linesHtml}${nodesHtml}</div></div>`;
}

export function roadmapPage(roadmap: Roadmap): string {
  const bands = bandsOf(roadmap);
  if (bands.length === 0) {
    return `<article class="roadmap">
  <h1 class="roadmap__title">Roadmap</h1>
  <p class="roadmap__lead">The roadmap is generated from the project's GitHub milestones and issues, and will appear here once they're published.</p>
</article>`;
  }
  const lead = `The headline is the destination, not the current release. Logos is pre-alpha, so nothing here ships yet. Each milestone is a finish line: the issues above it are the work that gets Logos there, and every milestone below is still further out. Within a milestone the arrows point from a piece of work down to what it unblocks.`;
  const legend = `<ul class="depmap-legend"><li class="is-done">Done</li><li class="is-ready">Ready</li><li class="is-blocked">Blocked</li></ul>`;
  return `<article class="roadmap">
  <h1 class="roadmap__title">Roadmap</h1>
  <p class="roadmap__lead">${lead}</p>
  ${legend}
  ${bandedMap(bands, roadmap.stations)}
</article>`;
}
