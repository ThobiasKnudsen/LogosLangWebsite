// The homepage showcase (Thobias, 22 September 2026): a language picker, then a
// box with a row of tabs, one per example program, over two code panes, Logos on
// the left and on the right the picked language, so the same program can be read
// in Logos beside a language the visitor already knows.
//
// The Logos listings are taken from the LogosLang repo's own examples/ directory
// and docs (docs/v0.0.4), which is what the bootstrap seed runs today: functions,
// loops, `-> type` functions resolved at parse time, the drop model (alloc, own,
// `@`), `.compile()`, and the dyad view (`x:dyad.type`). The one liberty is `mut`
// on reassigned locals, the spelling the newest examples use though the seed does
// not yet enforce it. There is no I/O in the seed: a file's tail expression is its
// value and is printed, which is why the Logos versions end in a bare expression
// where the others print. The other languages are written as their idiomatic
// equivalents, and where a language cannot do what the tab shows its pane says
// so instead of showing a workaround (Thobias, 22 September 2026).
//
// Every tab x language pair is rendered at build time (Shiki for the other
// languages, the site's own tokenizer for Logos) and shipped hidden; the client
// (initShowcase, client/main.ts) shows the one pair the tabs and picker select.
import { createHighlighter } from "shiki";
import { escapeHtml } from "./templates.ts";
import { highlightLogosLines } from "./highlight.ts";

interface Lang {
  id: string;
  name: string;
  /** Shiki grammar id, or null for Logos (the site's own tokenizer). */
  shiki: string | null;
}
const LANGS: Lang[] = [
  { id: "logos", name: "Logos", shiki: null },
  { id: "rust", name: "Rust", shiki: "rust" },
  { id: "zig", name: "Zig", shiki: "zig" },
  { id: "c", name: "C", shiki: "c" },
  { id: "python", name: "Python", shiki: "python" },
  { id: "ts", name: "TypeScript", shiki: "typescript" },
];

interface Example {
  id: string;
  /** The tab's label. */
  label: string;
  /** Source per language id, for the languages that can do what the tab shows. */
  code: Partial<Record<string, string>>;
  /** The languages that cannot: their pane carries a message instead of code
   *  (Thobias, 22 September 2026; they showed the nearest workaround before).
   *  Every language is in exactly one of `code` and `none`. */
  none: string[];
}

const EXAMPLES: Example[] = [
  {
    id: "answer",
    label: "The answer",
    none: [],
    code: {
      logos: `# the answer, computed the long way
double := fn (x := i32 ?) -> i32 ( x + x ),
mut sum := i32 0,
for i in 0..7 ( sum = sum + i ),
double(sum)     # 42, the file's value`,
      rust: `// the answer, computed the long way
fn double(x: i32) -> i32 {
    x + x
}

fn main() {
    let mut sum = 0;
    for i in 0..7 {
        sum += i;
    }
    println!("{}", double(sum)); // 42
}`,
      zig: `// the answer, computed the long way
const std = @import("std");

fn double(x: i32) i32 {
    return x + x;
}

pub fn main() void {
    var sum: i32 = 0;
    var i: i32 = 0;
    while (i < 7) : (i += 1) sum += i;
    std.debug.print("{d}\\n", .{double(sum)}); // 42
}`,
      c: `// the answer, computed the long way
#include <stdio.h>

/* double is a keyword, so: */
int twice(int x) { return x + x; }

int main(void) {
    int sum = 0;
    for (int i = 0; i < 7; i++) sum += i;
    printf("%d\\n", twice(sum)); /* 42 */
    return 0;
}`,
      python: `# the answer, computed the long way
def double(x: int) -> int:
    return x + x

total = 0
for i in range(7):
    total += i
print(double(total))  # 42`,
      ts: `// the answer, computed the long way
const double = (x: number): number => x + x;

let sum = 0;
for (let i = 0; i < 7; i++) sum += i;
console.log(double(sum)); // 42`,
    },
  },
  {
    id: "type",
    label: "A function returns a type",
    none: ["rust", "c", "ts"],
    code: {
      logos: `# a function can return a type; the call runs at
# parse time and becomes the type it yields
pick := fn (i := i32 ?) -> type (
    if (i == 0) (i32) else (f64)
),

mut a := pick(1) ?,   # a is declared as an f64
a = 9.9,
pick(0) == i32        # true`,
      zig: `// a function can return a type, run at compile time
const std = @import("std");

fn pick(i: u8) type {
    return if (i == 0) i32 else f64;
}

pub fn main() void {
    const a: pick(1) = 9.9; // a is an f64
    const same = pick(0) == i32;
    std.debug.print("{d} {}\\n", .{ a, same });
}`,
      python: `# types are values, so a function can return one,
# though nothing checks what is then done with it
def pick(i: int) -> type:
    return int if i == 0 else float

a = pick(1)(9.9)       # an ordinary float
print(pick(0) is int)  # True`,
    },
  },
  {
    id: "compile",
    label: "Compile on request",
    none: ["rust", "zig", "c", "python", "ts"],
    code: {
      logos: `# interpreted by default; the source asks for machine
# code, and the next call jumps to it
sum_to := fn (n := i64 ?) -> i64 (
    mut i := i64 0,
    mut s := i64 0,
    while (i < n) (
        s = s + i,
        i = i + 1
    ),
    s
),
sum_to.compile(),
sum_to(1000000)`,
    },
  },
  {
    id: "own",
    label: "Ownership",
    none: ["python", "ts"],
    code: {
      logos: `# alloc returns an owning pointer and writes the
# teardown into this scope itself: \`defer free a\`
a := alloc i32 40,
b := own a,   # moves ownership; a's free no-ops
b@            # 40`,
      rust: `// a Box owns its heap value and frees it when the
// owner goes out of scope; a move hands that duty on
fn main() {
    let a = Box::new(40);
    let b = a; // ownership moves to b; a is gone
    println!("{}", *b); // 40
}`,
      zig: `// nothing is freed for you; \`defer\` writes the free
// beside the allocation that needs it
const std = @import("std");

pub fn main() !void {
    const gpa = std.heap.page_allocator;
    const a = try gpa.create(i32);
    defer gpa.destroy(a);
    a.* = 40;
    const b = a; // another name for the same place
    std.debug.print("{d}\\n", .{b.*}); // 40
}`,
      c: `// malloc returns a pointer; nothing frees it but you
#include <stdio.h>
#include <stdlib.h>

int main(void) {
    int *a = malloc(sizeof *a);
    *a = 40;
    int *b = a; /* a second name; a is still live */
    printf("%d\\n", *b); /* 40 */
    free(b);
    return 0;
}`,
    },
  },
  {
    id: "reflect",
    label: "Type reflection",
    none: ["c"],
    code: {
      logos: `# a value's type is read through the dyad view,
# and types compare by identity
x := i32 5,

same := x:dyad.type == i32,     # true
cross := x:dyad.type == f64,    # false
meta := i32:dyad.type == type,  # true: the root type

same and meta and not (cross)`,
      rust: `// a value's type has an identity at run time,
// though nothing more of it can be read back
use std::any::{Any, TypeId};

fn main() {
    let x: i32 = 5;
    let same = x.type_id() == TypeId::of::<i32>();
    let cross = x.type_id() == TypeId::of::<f64>();
    println!("{}", same && !cross); // true
}`,
      zig: `// @TypeOf reads a type at compile time; types compare
// with ==
const std = @import("std");

pub fn main() void {
    const x: i32 = 5;
    const same = @TypeOf(x) == i32; // true
    const cross = @TypeOf(x) == f64; // false
    const meta = @TypeOf(i32) == type; // true
    const all = same and meta and !cross;
    std.debug.print("{}\\n", .{all});
}`,
      python: `# types are objects, and \`type\` is its own type
x = 5

same = type(x) is int     # True
cross = type(x) is float  # False
meta = type(int) is type  # True
print(same and meta and not cross)`,
      ts: `// typeof names a handful of run-time kinds; the
// static types themselves are gone by run time
const x = 5;

const same = typeof x === "number"; // true
const cross = typeof x === "string"; // false
console.log(same && !cross);`,
    },
  },
];

/** The showcase section's HTML: the language picker, then one box holding the
 *  tab row and, under one line, two panes: Logos on the left, always, and on the
 *  right the language the picker selects (Thobias, 22 September 2026; for an hour
 *  it was one pane with Logos in the picker, and the picker sat under the box).
 *  Every tab x language listing is in the page and all but the first tab's carry
 *  `hidden`. */
export async function showcaseHtml(): Promise<string> {
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
  for (const ex of EXAMPLES) {
    for (const lang of LANGS) {
      if ((lang.id in ex.code) === ex.none.includes(lang.id)) {
        throw new Error(`showcase: example ${ex.id} must have ${lang.id} in code or in none`);
      }
    }
  }
  // A language that cannot do what the tab shows gets a message, centred in its
  // pane, and no code.
  const pane = (ex: Example, lang: Lang): string =>
    ex.none.includes(lang.id)
      ? `<div class="showcase__none"><p>${escapeHtml(lang.name)} does not support this.</p></div>`
      : render(lang, ex.code[lang.id]!);
  const [logos, ...others] = LANGS as [Lang, ...Lang[]];
  const tabs = EXAMPLES.map(
    (ex, i) =>
      `<button type="button" class="showcase__tab${i === 0 ? " is-active" : ""}" role="tab" aria-selected="${i === 0}" data-example="${ex.id}">${escapeHtml(ex.label)}</button>`,
  ).join("\n      ");
  const listing = (ex: Example, lang: Lang, shown: boolean): string =>
    `<div class="showcase__listing" data-example="${ex.id}" data-lang="${lang.id}"${shown ? "" : " hidden"}>${pane(ex, lang)}</div>`;
  const left = EXAMPLES.map((ex, i) => listing(ex, logos, i === 0)).join("\n        ");
  const right = EXAMPLES.flatMap((ex, i) =>
    others.map((lang, j) => listing(ex, lang, i === 0 && j === 0)),
  ).join("\n        ");
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
