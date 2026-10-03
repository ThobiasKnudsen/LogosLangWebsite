# Knowledge

What this project is, the rules its code follows, and the reason for each, one rule per `###` heading. Point at a rule by its heading, never by a line number. Agents search this file and read only the rules they hit, so a rule stands on its own.

A rule carries its reason. A ruling on it is a **Ruled** line: the date, who, and the reason. A **Seed** line says what the code does today; it is the only kind of line an agent changes, and only the orchestrator writes the rest. What a ruling supersedes goes to `KNOWLEDGE_HISTORY.md` beside this file, under the same heading, with why.

## What the site is

logoslang.dev is the website of Logos, a programming language whose design, docs and code live in the LogosLang repo. The site is built by its own static generator (`build/build.ts`) and served by Cloudflare Pages; its docs pages are rendered from LogosLang's `docs/`.

## Content

### The site follows LogosLang's design
Every statement about Logos on the site (copy, code samples, the highlighter's word lists) follows LogosLang's ruling document, and every Logos program on the site comes from a real LogosLang source, never invented. Reason: the site is copy about a design that lives in another repo, so a ruling there silently makes samples here wrong; until 26 August 2026 the site still taught a vocabulary LogosLang had retired.
- **Seed:** LogosLang's ruling document is its root `DESIGN.md`. Its Logos sources are `examples/*.logos`, `identities/*.logos`, `language_sketch.logos` and `docs/`.

### The headline is the founder's voice
The homepage has one heading, "One language for everything". Headline-level and identity-level copy changes only after Thobias has seen the exact wording (a preview with `npm run dev`) and approved it; his own direct instruction counts as approval. Reason: it is the founder's voice and the project's identity, which he shapes himself, and "one language for everything" is LogosLang's identity, radical unification.
- **Ruled:** 22 September 2026, Thobias: "One language for everything" is the only heading, on a card.
- **Ruled:** 28 September 2026, Thobias: two sentences under the heading are wanted, so that answer engines have prose to quote, but they wait. He rejected a draft: "it seems to miss some points of what logos is. and it also seems too long". The next draft starts from LogosLang's own account of what Logos is, not from old site copy, and is short. He had the code's comments recounting old copy deleted "so that you dont get biased the next time".
- **Rejected:** 12 August 2026, Thobias, strongly, after it deployed: "Built for machines to write, and to prove" as the headline.
- **Seed:** `build/pages.ts` renders the heading in the logo's light purple with "everything" underlined, on a card in the margins' colour edged by a 1px white line. Nothing stands under it.

### "Maximally meta", always with "checked"
Logos is branded the maximally meta language, and every statement of the brand pairs it with the check: redefinitions of the language are borrow-checked and proof-checked like ordinary code. New copy (site, bios, README) leads with the one-graph mechanism, states the check, then the payoffs (one language for everything, executable human language for AI memory, machine-written code, math as values). No superlatives such as "no language comes close". Reason: "meta" alone reads as a footgun to working engineers (the Lisp, Smalltalk and Forth folklore); readers who know programming languages are won by naming the mechanism and answering the Lisp objection, not by a claimed rank.
- **Ruled:** 26 August 2026, Thobias chose the brand; the framing with the check was agreed with him the same day.
- **Seed:** on the homepage the comparison matrix carries the claim; the vision page keeps the long form.

### The quotes are part of the name
The quotes on the Logos stand where Thobias puts them and nowhere else. They, the Λόγος wordmark, the about page's coda and the site's other founder-voice elements are never moved or removed without his go-ahead, not even as a flagged change. Reason: the quotes are part of the name Λόγος for him, not decoration; when a session moved them on 26 August 2026 he asked "wait you just removed the banner with the quotes!!?!? why?".
- **Ruled:** 21 and 22 September 2026, Thobias: the quotes are stacked down both margins and scroll with the page, "barely visible" at rest and in full colour under the pointer. Only the first after the pointer enters a margin waits half a second; the next appears the moment the last fades, with "no delay".
- **Seed:** `build/wisdom.ts` renders every quote into each margin; `initMarginalia` in `client/main.ts` repeats them down a long page. They show only where the margins do (see "One column between two lines").

## Look

### Dark only
The site has one theme, dark, and no theme switch. No toggle and no light-only rules come back without his ask. Reason: Thobias, 22 September 2026: "remove the color toggling. there will only be dark mode for now".
- **Ruled:** 22 September 2026, Thobias, as quoted.
- **Seed:** `THEME = 'dark'` in `build/templates.ts`; the light tokens stay unused in `styles/theme.css`.

### One column between two lines
Every page is one column framed by two full-height hairlines, as on zed.dev and warp.dev, with margins a shade darker than the column. Everything sits inside the column (the floating dock, the sections, the footer); nothing spans the full window. Tints mix against the column's colour, never the margins'. Reason: Thobias's design for the site, asked for directly and shaped by him over three days.
- **Ruled:** 21 September 2026, Thobias: margins as on zed.dev and warp.dev; the menu and the footer rule only between the lines.
- **Ruled:** 22 September 2026, Thobias: the menu is a rounded, floating dock inside the column; its button is Download, with the GitHub mark as its own link beside it.
- **Ruled:** 23 September 2026, Thobias: a window wider than tall has margins a sixth of its width each.
- **Seed:** `--column` (57.5rem), `--margin` and `--gutter` in `styles/theme.css`. A portrait window under 76rem hides the margins, their lines and their quotes.

### Square corners, rounded controls
Corners are square, except buttons and the controls in a row with them, the dock and its links' hover outlines, the docs logo panel and the title card. Reason: Thobias, 21 September 2026: "stop all rounded edges. only straight lines", and the same evening "go back to rounded buttons".
- **Seed:** the admin dashboard (`client/dashboard.ts`) still has rounded corners of its own; he was told.

## Pages

### The homepage is hero, showcase and matrix
The homepage holds the heading, the showcase and the comparison matrix, and nothing else; the nav is Vision, Examples, Docs, About. A section or page Thobias cut (`KNOWLEDGE_HISTORY.md` lists them) comes back only on his ask. Reason: he cut the rest himself, each time on his own ask.
- **Ruled:** 29 September 2026, Thobias, cutting the roadmap page and the CI that rebuilt it: "not really needed, unorganized, fails builds all the time".
- **Seed:** `public/_redirects` sends /compare/ and /roadmap/ home.

### The showcase never fakes support
The showcase shows one program in Logos on the left and in a picked language on the right. A language that cannot do the example shows "not supported"; one that can do part of it shows its code under "lacking". Never a workaround dressed as support. The Logos side comes from a real LogosLang source (see "The site follows LogosLang's design"), ends in `print «…»`, and its lines fit a half-width pane, about 54 characters. Reason: the site claims honesty about what runs, and a showcase in guessed syntax, or a workaround shown as support, would break that.
- **Ruled:** 22 September 2026, Thobias: the showcase replaces the paragraph under the heading; the programs are files he edits himself, one folder per tab and one file per language, and his folder names stand as he typed them.
- **Ruled:** 22 September 2026, Thobias: partial support is its own state, because some languages can show part of a reflection though none reflects as much as Logos.
- **Ruled:** 22 September 2026, Thobias: Zig and C have no ownership; they free by hand but track none.
- **Seed:** the tabs are the numbered folders in `content/showcase/` (its `README.md` says how), read by `build/showcase.ts`. A file named `<name>.lacking.<ext>` is partial; no file for a language means not supported.

## Hosting

### Only logoslang.dev, no www
The site answers at logoslang.dev only. Reason: Thobias, 3 October 2026, in Q-thobias-1: "dont really need www."
- **Ruled:** 3 October 2026, Thobias, as quoted.
- **Seed:** www.logoslang.dev has no DNS record.
