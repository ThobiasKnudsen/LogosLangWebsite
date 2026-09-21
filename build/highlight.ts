// The site's own Logos highlighter, shared by the examples page (build/pages.ts)
// and the homepage showcase (build/showcase.ts). Shiki has no Logos grammar, so
// this small tokenizer colours the marketing listings: comments, «strings»,
// numbers, keywords, ground types and operators become spans (styled by the
// --tok-* vars, see .listing in theme.css); everything else, whitespace
// included, is escaped verbatim. Not a general lexer: just enough for snippets
// the build controls.
import { escapeHtml } from "./templates.ts";

const LOGOS_KEYWORDS = new Set([
  "fn",
  "mut",
  "immut",
  "shared",
  "if",
  "else",
  "for",
  "while",
  "and",
  "or",
  "xor",
  "not",
  "where",
  "eval",
  "self",
  "error",
  "undefined",
  "in",
  "break",
  "is",
  "true",
  "false",
  // The drop model (docs/reference/memory): allocation, the takes, and teardown.
  "alloc",
  "own",
  "drop",
  "free",
  "defer",
  "share",
  "take",
  // Output (the designed spelling; the seed has no I/O yet).
  "print",
]);
// `@dyad` / `@void` tokenize as the `@` operator plus a bare identifier, so the
// pointer type names appear here without their prefix.
// `left` and `right` are the two associativity identities (ruled 9 September 2026),
// keywords with nothing behind them, so they color like the other ground identities.
const LOGOS_TYPES =
  /^(?:[iu](?:8|16|32|64)|f32|f64|string|bool|void!?|dyad|logos|type|instance|lex|exec|scope|proof|conjecture|parsing_tape|callable|number|generic_number|array|left|right)$/;

/** One HTML string per source line, each line's tokens wrapped in tok-* spans. */
export function highlightLogosLines(source: string): string[] {
  const TOKEN =
    /«[^»]*»|\d[\d_]*(?:\.\d+)?|[A-Za-z_][A-Za-z0-9_@]*!?|:=|->|==|!=|<=|>=|[:=+\-*/%^<>.&@()[\],?!]/g;
  const renderCode = (code: string): string => {
    let out = "";
    let idx = 0;
    for (const m of code.matchAll(TOKEN)) {
      out += escapeHtml(code.slice(idx, m.index));
      const t = m[0];
      if (t.startsWith("«"))
        out += `<span class="tok-str">${escapeHtml(t)}</span>`;
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
  return source.split("\n").map((line) => {
    const hash = line.indexOf("#");
    if (hash < 0) return renderCode(line);
    return (
      renderCode(line.slice(0, hash)) +
      `<span class="tok-comment">${escapeHtml(line.slice(hash))}</span>`
    );
  });
}
