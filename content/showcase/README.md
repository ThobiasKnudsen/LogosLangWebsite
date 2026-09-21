# The homepage showcase

The tabbed code box under the homepage heading is built from this folder.
Edit the files here; `npm run dev` rebuilds on save.

- **One folder per tab**, named `<number>-<slug>`. The number orders the tabs
  and the slug is the label: `2-a-function-returns-a-type` shows as
  "A function returns a type". Put a `label.txt` in the folder to override the
  label.
- **One file per language** in each folder. The extension names the language;
  the file's base name does not matter.

  | Extension | Language   |
  | --------- | ---------- |
  | `.logos`  | Logos      |
  | `.rs`     | Rust       |
  | `.zig`    | Zig        |
  | `.c`      | C          |
  | `.py`     | Python     |
  | `.ts`     | TypeScript |
  | `.lean`   | Lean 4     |

- **A language with no file** in a folder is shown as "does not support this"
  on that tab. Delete a file to say a language cannot do it; add one to say it
  can.
- **Every folder needs a `.logos` file**: Logos is always the left pane.
- **Keep lines to about 54 characters**; longer lines scroll sideways in the
  half-width pane, and the build prints a warning for each one.
- Adding a language means adding it to `LANGS` in `build/showcase.ts` (its
  extension and Shiki grammar) and, for Logos, to the tokenizer in
  `build/highlight.ts`.

The Logos listings follow the LogosLang repo's `examples/`, `docs/` and
`language_sketch.logos`. `print «… {value}»` is the designed spelling for
output; the seed prints a file's tail expression instead.
