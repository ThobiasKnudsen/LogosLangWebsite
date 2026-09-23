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
// The folder's leading number orders the tabs and the rest of its name is the
// tab's label (dashes and underscores as spaces, the first letter up, the rest
// as typed), unless a label.txt in the folder says otherwise. A file's extension
// names its language (LANGS below); a language with no file in a folder is one
// that cannot do what the tab shows, and its pane says so. A folder needs a
// .logos file, the left pane, before it is a tab. content/showcase/README.md says
// the same for whoever opens the folder.
//
// The Logos listings are taken from the LogosLang repo's own examples/ directory,
// docs (docs/v0.0.4) and language sketch, which is what the bootstrap seed runs
// today: functions, loops, `-> type` functions resolved at parse time, the drop
// model (alloc, own, `@`), `.compile()`, the type read (`x:type`, ruled 23
// September 2026), and conjectures with proofs (language_sketch.logos p1, p3, p4;
// DESIGN.md's ruling that a proof applies as a rewrite). `print «…»` is the output
// word (DESIGN.md, 23 September 2026), `{…}` in the string interpolating a value;
// the seed prints a file's tail expression instead. The other languages are
// written as their idiomatic equivalents.
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
  { id: "racket", name: "Racket", ext: ".rkt", shiki: "racket" },
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
  /** The languages whose file is named `<name>.lacking.<ext>`: they can do only
   *  part of what the tab shows, and their pane says so above the code
   *  (Thobias, 22 September 2026: no other language reflects on as much as
   *  Logos, yet some can show something). */
  lacking: string[];
}

/** A folder's name split into its ordering number, if it has one, and the rest. */
function parseDirName(dir: string): { order: number; rest: string } {
  const m = /^(\d+)[-_ ]*(.*)$/.exec(dir);
  return m && m[2] ? { order: Number(m[1]), rest: m[2] } : { order: Infinity, rest: dir };
}

/** The tabs, read from content/showcase/ in folder-number order. The folders are
 *  edited by hand while the dev server watches, so nothing here fails the build:
 *  a file the build cannot place is warned about and skipped, and a folder with
 *  no Logos file yet is left out until it has one. */
async function loadExamples(): Promise<Example[]> {
  const entries = await fs.readdir(SHOWCASE_DIR, { withFileTypes: true });
  const dirs = entries
    .filter((e) => e.isDirectory() && !e.name.startsWith("."))
    .map((e) => e.name)
    .sort((a, b) => parseDirName(a).order - parseDirName(b).order || a.localeCompare(b));
  const examples: Example[] = [];
  const ids = new Set<string>();
  for (const dir of dirs) {
    const { rest } = parseDirName(dir);
    // The label is the folder's name after its number, dashes and underscores as
    // spaces and the first letter up, so `6-Proof` is "Proof" and `1-42` is "42";
    // the id is the same made safe for an attribute.
    const words = rest.replace(/[-_]+/g, " ").trim();
    let label = words.charAt(0).toUpperCase() + words.slice(1);
    let id = words.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "tab";
    while (ids.has(id)) id += "-2";
    const code: Partial<Record<string, string>> = {};
    const lacking: string[] = [];
    for (const file of (await fs.readdir(path.join(SHOWCASE_DIR, dir))).sort()) {
      const full = path.join(SHOWCASE_DIR, dir, file);
      if (file.startsWith(".")) continue;
      if (file === "label.txt") {
        label = (await fs.readFile(full, "utf8")).trim() || label;
        continue;
      }
      const lang = LANGS.find((l) => file.endsWith(l.ext));
      if (!lang) {
        console.warn(`content/showcase/${dir}/${file}: skipped, no language has this extension (${LANGS.map((l) => l.ext).join(", ")})`);
        continue;
      }
      if (code[lang.id] !== undefined) {
        console.warn(`content/showcase/${dir}/${file}: skipped, the folder already has a ${lang.name} file`);
        continue;
      }
      const source = (await fs.readFile(full, "utf8")).replace(/\s+$/, "");
      source.split("\n").forEach((line, i) => {
        if (line.length > MAX_LINE) {
          console.warn(`content/showcase/${dir}/${file}:${i + 1}: ${line.length} characters; a half-width pane holds about ${MAX_LINE}`);
        }
      });
      code[lang.id] = source;
      if (file.slice(0, -lang.ext.length).endsWith(".lacking")) lacking.push(lang.id);
    }
    if (code.logos === undefined) {
      console.warn(`content/showcase/${dir}: no .logos file yet, so no tab; the left pane is always Logos`);
      continue;
    }
    ids.add(id);
    examples.push({
      id,
      label,
      code,
      none: LANGS.filter((l) => code[l.id] === undefined).map((l) => l.id),
      lacking,
    });
  }
  if (examples.length === 0) throw new Error("content/showcase: no folder with a .logos file, so nothing to show");
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
  // A language with no file for the tab gets a note on the pane's first line
  // and no code; one whose file is marked lacking gets the same kind of note
  // above its code (Thobias, 22 September 2026: both notes in one form, on the
  // line the language's name is on, and just the word: "not supported" or
  // "lacking").
  const note = (text: string): string => `<p class="showcase__note">${escapeHtml(text)}</p>`;
  const pane = (ex: Example, lang: Lang): string => {
    if (ex.none.includes(lang.id)) return note("not supported");
    const code = render(lang, ex.code[lang.id]!);
    return ex.lacking.includes(lang.id) ? note("lacking") + code : code;
  };
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
