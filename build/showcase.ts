// The homepage showcase (Thobias, 22 September 2026): a language picker, then a
// box with a row of tabs, one per example program, over two code panes, Logos on
// the left and on the right the picked language, so the same program can be read
// in Logos beside a language the visitor already knows.
//
// The programs are files under content/showcase/, one folder per tab and one file
// per language (Thobias, 22 September 2026, so he can edit them himself):
//
//   content/showcase/<number>-<slug>/<anything>.<ext>
//
// The folder's number orders the tabs and its slug is the tab's label (dashes to
// spaces, first letter up), unless a label.txt in the folder says otherwise. A
// file's extension names its language (LANGS below); a language with no file in
// a folder is one that cannot do what the tab shows, and its pane says so. Every
// folder needs a .logos file, the left pane. content/showcase/README.md says the
// same for whoever opens the folder.
//
// The Logos listings are taken from the LogosLang repo's own examples/ directory,
// docs (docs/v0.0.4) and language sketch, which is what the bootstrap seed runs
// today: functions, loops, `-> type` functions resolved at parse time, the drop
// model (alloc, own, `@`), `.compile()`, the dyad view (`x:dyad.type`), and
// conjectures with proofs (language_sketch.logos p1, p3, p4; DESIGN.md's ruling
// that a proof applies as a rewrite). Two spellings are Thobias's own, ahead of
// the seed: `mut` on reassigned locals, and `print «…»` for output, with `{…}` in
// the string interpolating a value (the seed prints a file's tail expression). The
// other languages are written as their idiomatic equivalents.
//
// Every tab x language pair is rendered at build time (Shiki for the other
// languages, the site's own tokenizer for Logos, build/highlight.ts) and shipped
// hidden; the client (initShowcase, client/main.ts) shows the one pair the tabs
// and picker select.
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createHighlighter } from "shiki";
import { escapeHtml } from "./templates.ts";
import { highlightLogosLines } from "./highlight.ts";

const SHOWCASE_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "content",
  "showcase",
);

/** A listing line longer than this scrolls sideways in a half-width pane at the
 *  showcase's type size; the build warns about it rather than failing. */
const MAX_LINE = 54;

interface Lang {
  id: string;
  name: string;
  /** The file extension that names this language in a tab's folder. */
  ext: string;
  /** Shiki grammar id, or null for Logos (the site's own tokenizer). */
  shiki: string | null;
}
/** Logos first, always the left pane; the rest in the picker's order. */
const LANGS: Lang[] = [
  { id: "logos", name: "Logos", ext: ".logos", shiki: null },
  { id: "rust", name: "Rust", ext: ".rs", shiki: "rust" },
  { id: "zig", name: "Zig", ext: ".zig", shiki: "zig" },
  { id: "c", name: "C", ext: ".c", shiki: "c" },
  { id: "python", name: "Python", ext: ".py", shiki: "python" },
  { id: "ts", name: "TypeScript", ext: ".ts", shiki: "typescript" },
  { id: "lean", name: "Lean 4", ext: ".lean", shiki: "lean4" },
];

interface Example {
  /** The folder's slug; the tab's key in the markup. */
  id: string;
  /** The tab's label. */
  label: string;
  /** Source per language id, for the languages that have a file in the folder. */
  code: Partial<Record<string, string>>;
  /** The languages without one: their pane carries a message instead of code. */
  none: string[];
}

/** The tabs, read from content/showcase/ in folder-number order. */
async function loadExamples(): Promise<Example[]> {
  const entries = await fs.readdir(SHOWCASE_DIR, { withFileTypes: true });
  const dirs = entries
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort((a, b) => Number(a.split("-")[0]) - Number(b.split("-")[0]) || a.localeCompare(b));
  const examples: Example[] = [];
  for (const dir of dirs) {
    const m = /^(\d+)-([a-z0-9]+(?:-[a-z0-9]+)*)$/.exec(dir);
    if (!m) {
      throw new Error(`content/showcase/${dir}: a tab's folder is named <number>-<slug>, like 1-the-answer`);
    }
    const slug = m[2]!;
    const words = slug.replace(/-/g, " ");
    let label = words.charAt(0).toUpperCase() + words.slice(1);
    const code: Partial<Record<string, string>> = {};
    for (const file of (await fs.readdir(path.join(SHOWCASE_DIR, dir))).sort()) {
      const full = path.join(SHOWCASE_DIR, dir, file);
      if (file === "label.txt") {
        label = (await fs.readFile(full, "utf8")).trim();
        continue;
      }
      const lang = LANGS.find((l) => file.endsWith(l.ext));
      if (!lang) {
        throw new Error(`content/showcase/${dir}/${file}: no language has this extension (${LANGS.map((l) => l.ext).join(", ")})`);
      }
      if (code[lang.id] !== undefined) {
        throw new Error(`content/showcase/${dir}: two ${lang.name} files; one per language`);
      }
      const source = (await fs.readFile(full, "utf8")).replace(/\s+$/, "");
      source.split("\n").forEach((line, i) => {
        if (line.length > MAX_LINE) {
          console.warn(`content/showcase/${dir}/${file}:${i + 1}: ${line.length} characters; a half-width pane holds about ${MAX_LINE}`);
        }
      });
      code[lang.id] = source;
    }
    if (code.logos === undefined) {
      throw new Error(`content/showcase/${dir}: no .logos file, and the left pane is always Logos`);
    }
    examples.push({
      id: slug,
      label,
      code,
      none: LANGS.filter((l) => code[l.id] === undefined).map((l) => l.id),
    });
  }
  if (examples.length === 0) throw new Error("content/showcase: no tab folders");
  return examples;
}

/** The showcase section's HTML: the language picker, then one box holding the
 *  tab row and, under one line, two panes: Logos on the left, always, and on the
 *  right the language the picker selects. Every tab x language listing is in the
 *  page and all but the first tab's carry `hidden`. */
export async function showcaseHtml(): Promise<string> {
  const examples = await loadExamples();
  const shikiLangs = LANGS.flatMap((l) => (l.shiki ? [l.shiki] : []));
  const hl = await createHighlighter({
    themes: ["github-light", "github-dark"],
    langs: shikiLangs,
  });
  const render = (lang: Lang, code: string): string => {
    if (!lang.shiki) {
      return `<pre class="showcase__code"><code>${highlightLogosLines(code).join("\n")}</code></pre>`;
    }
    // Shiki emits <pre class="shiki ..." style="--shiki-light:...;--shiki-dark:..."><code>;
    // the site's .shiki rules pick the theme's variables (theme.css).
    const html = hl.codeToHtml(code, {
      lang: lang.shiki,
      themes: { light: "github-light", dark: "github-dark" },
      defaultColor: false,
    });
    return html.replace('<pre class="shiki', '<pre class="showcase__code shiki');
  };
  // A language with no file for the tab gets a message, centred in its pane,
  // and no code.
  const pane = (ex: Example, lang: Lang): string =>
    ex.none.includes(lang.id)
      ? `<div class="showcase__none"><p>${escapeHtml(lang.name)} does not support this.</p></div>`
      : render(lang, ex.code[lang.id]!);
  const [logos, ...others] = LANGS as [Lang, ...Lang[]];
  const tabs = examples
    .map(
      (ex, i) =>
        `<button type="button" class="showcase__tab${i === 0 ? " is-active" : ""}" role="tab" aria-selected="${i === 0}" data-example="${ex.id}">${escapeHtml(ex.label)}</button>`,
    )
    .join("\n      ");
  const listing = (ex: Example, lang: Lang, shown: boolean): string =>
    `<div class="showcase__listing" data-example="${ex.id}" data-lang="${lang.id}"${shown ? "" : " hidden"}>${pane(ex, lang)}</div>`;
  const left = examples.map((ex, i) => listing(ex, logos, i === 0)).join("\n        ");
  const right = examples
    .flatMap((ex, i) => others.map((lang, j) => listing(ex, lang, i === 0 && j === 0)))
    .join("\n        ");
  const langs = others
    .map(
      (lang, j) =>
        `<button type="button" class="showcase__lang${j === 0 ? " is-active" : ""}" aria-pressed="${j === 0}" data-lang="${lang.id}">${escapeHtml(lang.name)}</button>`,
    )
    .join("\n    ");
  return `<section class="showcase" aria-label="The same program in Logos and other languages" data-showcase>
  <div class="showcase__langs" role="group" aria-label="Language on the right">
    ${langs}
  </div>
  <div class="showcase__box">
    <div class="showcase__tabs" role="tablist" aria-label="Example">
      ${tabs}
    </div>
    <div class="showcase__panes">
      <div class="showcase__pane">
        <span class="showcase__pane-label">${escapeHtml(logos.name)}</span>
        ${left}
      </div>
      <div class="showcase__pane showcase__pane--other">
        <span class="showcase__pane-label" data-lang-label>${escapeHtml(others[0]!.name)}</span>
        ${right}
      </div>
    </div>
  </div>
</section>`;
}
