# The homepage showcase

The tabbed code box under the homepage heading is built from this folder.
Edit the files here; `npm run dev` rebuilds on save.

- **One folder per tab.** A leading number orders the tabs, and the rest of
  the name is the label, with dashes and underscores shown as spaces and the
  first letter capitalised: `2-function-returns-type` shows as "Function
  returns type", `6-Proof` as "Proof", `1-42` as "42". Put a `label.txt` in
  the folder to set the label outright.
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
  | `.rkt`    | Racket     |
  | `.lean`   | Lean 4     |

- **A language with no file** in a folder is marked "not supported" on that
  tab. Delete a file to say a language cannot do it; add one to say it can.
- **A language that can do only part of it** keeps its file, named
  `<name>.lacking.<ext>` (for example `any-reflection.lacking.py`); its pane
  is then marked "lacking" on its first line, above the code, in the same box.
- **A folder becomes a tab once it has a `.logos` file**: Logos is always the
  left pane. Until then the build skips the folder with a warning.
- **Other files are skipped** with a warning (an unknown extension, a second
  file for the same language), never a failed build, so editing while
  `npm run dev` runs is safe.
- **Keep lines to about 54 characters**; longer lines scroll sideways in the
  half-width pane, and the build prints a warning for each one.
- Adding a language means adding it to `LANGS` in `build/showcase.ts` (its
  extension and Shiki grammar) and, for Logos, to the tokenizer in
  `build/highlight.ts`.

The Logos listings follow the LogosLang repo's `examples/`, `docs/` and
`language_sketch.logos`. `print «… {value}»` is the output word (DESIGN.md,
›The command line is Logos source‹); the seed prints a file's tail expression
instead.
