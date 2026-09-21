// The site's own Logos highlighter, shared by the examples page (build/pages.ts)
// and the homepage showcase (build/showcase.ts). Shiki has no Logos grammar, so
// this small tokenizer colours the marketing listings. Everything in Logos is an
// identity, so the categories follow an identity's ROLE in the line rather than a
// fixed word list alone (Thobias, 22 September 2026, asking for better colouring
// of each identity):
//
//   tok-comment  # to the end of the line
//   tok-str      «…», with {…} inside it an interpolation: the braces as
//                operators and the expression coloured as code
//   tok-num      a number literal
//   tok-kw       the structural words: fn, type, conjecture, proof, instance,
//                the control words, the gate words, the boolean words
//   tok-type     the ground types (i32, f64, dyad, number, array, …)
//   tok-fn       an identity being called (`double(…)`, a rule `twice(…)`, a
//                method `.compile()`) and the builtins that act as one
//                (print, alloc, own, drop, free, defer, share, take, eval, error)
//   tok-def      an identity at its definition: left of `:=`, left of a spaced
//                `:` (declare), or a loop variable after `for`
//   tok-field    an identity read off another with `.` (`.type`, `.value`)
//   tok-hole     `?`, the hole
//   tok-op       every other operator
//
// The palette (theme.css, --tok-*) is the one Shiki's github-dark uses in the
// other panes, so Logos beside Rust or Lean reads as one scheme. Not a general
// lexer: just enough for snippets the build controls, and every character not
// in a token is escaped verbatim, whitespace included.
import { escapeHtml } from "./templates.ts";

const KEYWORDS = new Set([
  "fn",
  "type",
  "instance",
  "conjecture",
  "proof",
  "scope",
  "mut",
  "immut",
  "shared",
  "if",
  "else",
  "for",
  "while",
  "in",
  "where",
  "and",
  "or",
  "xor",
  "not",
  "is",
  "break",
  "self",
  "undefined",
  "true",
  "false",
]);
// Identities that act as functions on what follows them: output, the drop model
// (docs/reference/memory), evaluation and errors.
const BUILTINS = new Set([
  "print",
  "alloc",
  "own",
  "drop",
  "free",
  "defer",
  "share",
  "take",
  "eval",
  "error",
]);
// `@dyad` / `@void` tokenize as the `@` operator plus a bare identifier, so the
// pointer type names appear here without their prefix. `left` and `right` are the
// two associativity identities (ruled 9 September 2026), ground identities too.
const TYPES =
  /^(?:[iu](?:8|16|32|64)|f32|f64|string|bool|void!?|dyad|logos|lex|exec|parsing_tape|callable|number|generic_number|array|left|right)$/;

const TOKEN =
  /«[^»]*»|\d[\d_]*(?:\.\d+)?|[A-Za-z_][A-Za-z0-9_]*!?|:=|->|==|!=|<=|>=|\.\.|[:=+\-*/%^<>.&@()[\]{},?!]/g;

const span = (cls: string, html: string): string =>
  `<span class="${cls}">${html}</span>`;

/** One HTML string per source line, each line's tokens wrapped in tok-* spans. */
export function highlightLogosLines(source: string): string[] {
  return source.split("\n").map((line) => {
    const hash = line.indexOf("#");
    if (hash < 0) return renderCode(line);
    return (
      renderCode(line.slice(0, hash)) +
      span("tok-comment", escapeHtml(line.slice(hash)))
    );
  });
}

function renderCode(code: string): string {
  const tokens = [...code.matchAll(TOKEN)];
  let out = "";
  let idx = 0;
  tokens.forEach((m, i) => {
    out += escapeHtml(code.slice(idx, m.index));
    const t = m[0];
    const prev = tokens[i - 1];
    const next = tokens[i + 1];
    // What sits between this token and its neighbours: `x:dyad` (no gap) is the
    // view, `a : i32` (a gap) a declaration; `f(` a call, `fn (` not.
    const gapBefore = prev ? code.slice(prev.index + prev[0].length, m.index) : " ";
    const gapAfter = next ? code.slice(m.index + t.length, next.index) : " ";
    out += classify(t, prev?.[0], next?.[0], gapBefore, gapAfter);
    idx = m.index + t.length;
  });
  return out + escapeHtml(code.slice(idx));
}

function classify(
  t: string,
  prev: string | undefined,
  next: string | undefined,
  gapBefore: string,
  gapAfter: string,
): string {
  if (t.startsWith("«")) return renderString(t);
  if (/^\d/.test(t)) return span("tok-num", t);
  if (/^[A-Za-z_]/.test(t)) {
    const called = next === "(" && gapAfter === "";
    if (prev === "." && gapBefore === "") return span(called ? "tok-fn" : "tok-field", escapeHtml(t));
    // A definition first, whatever the word: a field spelled `type := @dyad ?`
    // is being declared there.
    if (next === ":=" || (next === ":" && gapAfter !== "") || prev === "for") {
      return span("tok-def", escapeHtml(t));
    }
    // `type (…)` constructs a type and is structural; bare `type` is the root
    // type as a value (`i32:dyad.type == type`), a type like i32.
    if (t === "type" && next !== "(") return span("tok-type", t);
    if (KEYWORDS.has(t)) return span("tok-kw", t);
    if (BUILTINS.has(t)) return span("tok-fn", t);
    if (TYPES.test(t)) return span("tok-type", t);
    if (called) return span("tok-fn", escapeHtml(t));
    return escapeHtml(t);
  }
  if (t === "?") return span("tok-hole", "?");
  return span("tok-op", escapeHtml(t));
}

/** A «…» string, its {…} interpolations rendered as code between operator braces. */
function renderString(t: string): string {
  const inner = t.slice(1, -1);
  const text = (s: string): string => (s ? span("tok-str", escapeHtml(s)) : "");
  let out = span("tok-str", "«");
  let idx = 0;
  for (const m of inner.matchAll(/\{([^}]*)\}/g)) {
    out += text(inner.slice(idx, m.index));
    out += span("tok-op", "{") + renderCode(m[1]!) + span("tok-op", "}");
    idx = m.index + m[0].length;
  }
  return out + text(inner.slice(idx)) + span("tok-str", "»");
}
