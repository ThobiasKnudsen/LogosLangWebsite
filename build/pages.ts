// Inner HTML for the marketing pages. Kept faithful to the established design:
// golden-section hero, single Download CTA, and the "one idea" pillar grid.
const RELEASES = "https://github.com/ThobiasKnudsen/LogosLang/releases";

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
    title: "One rewriting engine",
    body: `Compiler optimization, computer algebra, and your own transforms are one operation. The same engine serves <code>x + 0 → x</code> and <code>sin²θ + cos²θ → 1</code>.`,
  },
  {
    title: "Pay only for what you verify",
    body: `A borrow checker like Rust's, then opt-in refinement types, contracts, and full dependent-type proofs, layered so lower code is never burdened by higher guarantees.`,
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
    <h1 class="hero__headline"><span class="hero__brand" aria-hidden="true">Λόγος&nbsp;</span><span class="hero__rotator" data-rotator aria-hidden="true"><span class="hero__rot-item is-current">is Radical Unification</span><span class="hero__rot-item">is the Last Language</span><span class="hero__rot-item">is the Most Coherent Language</span><span class="hero__rot-item">Never Settles for “OK”</span><span class="hero__rot-item">Unifies Code and Proof</span><span class="hero__rot-item">Optimizes Like Algebra</span><span class="hero__rot-item">Reads and Writes Itself</span><span class="hero__rot-item">Mimics the Mind</span></span><span class="sr-only">Logos is radical unification.</span></h1>
    <p class="hero__sub">The compiler, the parser, the types, the borrow checker, the proofs, all in one structure. The same operations that run your code can read, rewrite, optimize, and prove any of it, the compiler included.</p>
    <div class="hero__actions"><a class="logos-btn logos-btn--download" href="${RELEASES}">Download</a></div>
    <p class="hero__availability">Available on Windows, Mac and Linux.</p>
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

  <h2>One rewriting engine</h2>
  <p>Compiler optimization, computer algebra, and your own transformations are one operation: take a fragment, apply rewrite rules, and extract the form that minimizes a cost function, using equality saturation over an e-graph. The same engine serves the compiler's <code>x + 0 → x</code> and the mathematician's <code>sin²(θ) + cos²(θ) → 1</code>.</p>

  <h2>Pay only for what you verify</h2>
  <p>A systems programmer gets the base type system and a borrow checker. Beyond that the strata are opt-in: refinement types and pre/post-conditions, then termination measures, then full dependent types and proof terms checked by a small trusted kernel. Parts of a program can be verified while the rest stays lower.</p>
</article>`;
}

export function placeholderPage(title: string, body: string): string {
  return `<section class="placeholder"><h1>${title}</h1><p>${body}</p></section>`;
}
