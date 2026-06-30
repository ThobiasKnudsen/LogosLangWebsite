# Λόγος — logoslang.dev

The marketing + documentation website for **Logos**, a self-hosting systems
language built on radical unification.

A small **custom static-site generator** written in TypeScript (run with
[`tsx`](https://github.com/privatenumber/tsx), no framework), deployed to
Cloudflare Pages. Light, wisprflow.ai-inspired theme.

## Develop

Requires **Node 22+** (pinned in `.node-version`).

```sh
npm install
npm run dev             # dev server at http://localhost:4321 (watch + live-reload)
npm run build           # production build to ./dist
npm run test:docs-model # unit-test the docs versioning model
npm run test:ci-check   # unit-test the CI freeze/forward-only guard
npm run test:releases   # unit-test the release/download model
npm run test:new-doc    # unit-test the new-doc version picker

npm run new-doc -- reference/operators   # scaffold a new doc, auto-named vX.Y.Z_operators.md
```

The build fetches LogosLang's GitHub Releases to bake the download page. It never
fails on a network error; for fast offline builds set `SKIP_RELEASES_FETCH=1`, or
point `LOGOS_RELEASES_JSON=<file>` at a saved API response to preview the populated
page.

## Stack & conventions

- **Custom SSG** — no framework. `npm run build` (`build/build.ts`) renders every
  page to a real static URL under `dist/`; `npm run dev` (`build/server.ts`) builds
  once, serves `dist/`, watches the sources, rebuilds, and live-reloads.
- **Markdown** — `markdown-it` for docs, with [Shiki](https://shiki.style) code
  highlighting (dual light/dark via CSS variables). Internal doc links are
  version-less and resolved to `/docs/<section>/` at build time.
- **Versioned docs** — doc files are named `vX.Y.Z_name.md`; the prefix is the
  version at which that page's content last changed. The model lives in
  `build/version.ts` (covered by `build/version.test.ts`). The version picker and
  per-page history are server-rendered and progressively enhanced by the client.
- **Bundling** — [esbuild](https://esbuild.github.io) bundles `client/main.ts` and
  `styles/theme.css` into `dist/assets/`, with self-hosted fonts emitted to
  `dist/assets/fonts/`.
- **SEO / AI discovery** — every page emits canonical + Open Graph/Twitter tags and
  schema.org JSON-LD; the build also writes `sitemap.xml` and an
  [`llms.txt`](https://llmstxt.org) map so AI answer-engines can read the site.
- **Fonts** (self-hosted via Fontsource): Figtree (UI/body), EB Garamond (serif +
  the Greek `Λόγος` wordmark), JetBrains Mono (code).
- **Theme tokens** live in `styles/theme.css`; light/dark is a cookie-driven
  `[data-theme]` switch applied before first paint.

## Structure

```
build/build.ts        the static build: pages, docs, sitemap, llms.txt, asset bundle
build/server.ts       dev server: build, serve dist/, watch, live-reload
build/version.ts      docs versioning model (sections, snapshots, effective version)
build/version.test.ts unit tests for the versioning model
build/ci-check.ts     CI guard: prefix validation, freeze + forward-only, release check
build/ci-check.test.ts unit tests for the CI guard
build/releases.ts     browser-safe release model: asset-name parsing, install commands
build/fetch-releases.ts build-time fetch of LogosLang's GitHub Releases (node-only)
build/releases.test.ts unit tests for the release/download model
build/new-doc.ts      scaffold a new doc pre-named with the correct version prefix
build/new-doc.test.ts unit tests for the new-doc version picker
build/markdown.ts     markdown-it + Shiki + version-less link resolution
build/docs-render.ts  server-side render of a docs page (tree, version nav, article)
build/pages.ts        marketing pages (home hero, vision, roadmap, placeholders)
build/templates.ts    shared HTML shell: dock, footer, <head>, theme script
client/main.ts        client runtime: theme toggle, hero rotator, docs hydration
content/docs/**        documentation pages (vX.Y.Z_name.md)
styles/theme.css       light/dark wisprflow theme: tokens, fonts, components
public/                static assets copied verbatim (favicon, og.png, robots.txt)
```

## Docs versioning & release (CI/CD)

Docs versions are driven by **LogosLang's git tags**, and old snapshots are frozen
once released. Two workflows enforce this; the logic is `build/ci-check.ts`.

**The model in one line:** a doc is `vX.Y.Z_name.md`; you never edit a released file
in place — you copy it to a newer version and edit the copy. `R` = the newest `vX.Y.Z`
tag on *this* repo = the frozen line. Versions `<= R` are frozen; `> R` are in progress.

New docs are named manually, but `npm run new-doc -- <dir/name>` scaffolds the file
already prefixed with the right version (the current in-progress line, or one patch
above the last release) so you don't have to hand-name it.

**On every pull request** (`.github/workflows/docs-ci.yml` → `validate`):

- every file under `content/docs` must carry a valid `vX.Y.Z_` prefix;
- **freeze** — no snapshot `<= R` may be added, modified, or deleted;
- **forward-only** — changed snapshots must be version `> R`.

**On a LogosLang release** — pushing a tag `vX.Y.Z` in `../LogosLang` runs
`release.yml` there, which (0) **gates** the tag — it must be strict semver `vX.Y.Z`
and strictly newer than every existing tag, or the run fails before building anything;
(1) creates the GitHub Release; (2) builds the per-OS/arch artifacts **and a
WebAssembly build** and uploads them; then (3) sends a `logoslang-release`
`repository_dispatch` to this repo. The `release` job here verifies every in-progress doc is named exactly
`vX.Y.Z`, tags this repo `vX.Y.Z` (advancing `R`, freezing those docs permanently),
and fires a Cloudflare deploy hook so the site rebuilds — the new build *and* docs go
live together.

## Download page & release builds

`/download/` (`downloadPage` in `build/pages.ts`) lets a visitor pick a version and
get a one-line install command plus a direct download for every OS/arch. The release
list is **baked at build time** by `build/fetch-releases.ts` (a deploy hook rebuilds
it on each release), and `client/main.ts` re-renders the grid on version change and
highlights the visitor's OS. With JS off, the latest version's commands all work.

**Asset naming convention** — the contract between LogosLang's `release.yml` and the
download + playground pages (`build/releases.ts`). Assets that don't match are ignored:

```
logos-<version>-<os>-<arch>.<ext>     # native build, shown on /download/
  <version> vX.Y.Z      <os> macos | linux | windows
  <arch>    x86_64 | aarch64      <ext> tar.gz (macos, linux) | zip (windows)

logos-<version>-wasm.wasm             # WebAssembly build, powers /playground/
```

`/playground/` (`playgroundPage` in `build/pages.ts`) lets a visitor pick any version
that ships a `…-wasm.wasm` build, edit Logos, and run it in the browser. The version
picker and editor are live now; the load → instantiate → evaluate step in
`client/main.ts` is a documented stub (see its `initPlayground` TODO) until Logos has
a runtime that targets WebAssembly. Each `<option>` already carries its wasm URL in
`data-wasm`, and the eventual harness should run it in a **Web Worker** with a
timeout/terminate kill-switch so runaway user code can't freeze the tab.

> ⚠️ Both build steps in `release.yml` are **clearly-marked placeholders** — the native
> jobs upload a stub archive, and the wasm job uploads a minimal valid (empty) wasm
> module. They wire the pipeline end to end; replace them with the real toolchain build
> once there's a compiler/seed to compile. The download and playground pages need no
> changes.

### One-time GitHub setup

1. **LogosLang repo → Settings → Secrets → Actions:** add `WEBSITE_DISPATCH_TOKEN`, a
   fine-grained PAT scoped to `ThobiasKnudsen/LogosLangWebsite` with
   **Contents: read & write** (the default `GITHUB_TOKEN` cannot dispatch cross-repo).
2. **This repo → Settings → Secrets → Actions:** add `CLOUDFLARE_DEPLOY_HOOK_URL` (a
   Cloudflare Pages → Settings → Builds & deployments → Deploy hook URL). The release
   job POSTs it to rebuild; if unset, that step is skipped.
3. **This repo → Settings → Branches → add a rule for `main`:** require the
   **`validate`** status check to pass before merging, and require a pull request
   (so nothing reaches `main` without the guard). Optionally restrict force-pushes.
4. **This repo → Settings → Rules → Tags (optional):** add a tag ruleset for `v*`
   that blocks tag deletion/update, so a frozen release tag can never be moved.

That combination — required `validate` check + immutable release tags — is what makes
a completed version un-revisitable through normal merges.

### Releasing safely (multiple pushes, hotfixes)

A *push* and a *release* are different events. Push to `main` as many times as you
like while a version is in progress — nothing is finalized until you **tag** it, and
only the tag triggers the build + freeze. So "many pushes, one tag" is the normal flow.

- **Releasing is serialized.** Both release workflows use a `concurrency` group, so two
  version tags pushed close together queue instead of racing. Still, **tag one version
  at a time, in order**, so `R` advances predictably (0.0.2 → 0.0.3 → 0.0.4).
- **Hotfixes go to the next version.** Once `vX.Y.Z` is released its docs are frozen,
  so a fix can't edit them — bump to `vX.Y.(Z+1)` and add the corrected snapshots there.
- **Never move a published tag.** Re-pushing a tag won't re-freeze anything (the
  pipeline is idempotent), and the optional tag ruleset blocks it outright.

## Deploy (Cloudflare Pages)

Connect this repo in the Cloudflare Pages dashboard with:

- **Build command:** `npm run build`
- **Output directory:** `dist`
- **Node version:** read from `.node-version` (22)

Set `SITE_URL` to the production origin (defaults to `https://logoslang.dev`) so
canonical URLs, social cards, the sitemap, and `llms.txt` resolve absolutely. Then
add `logoslang.dev` as a custom domain in the Pages project.

## Analytics & privacy

Analytics is **consent-gated and off by default**. The build reads three optional env
vars; with the ids unset, there is no banner, no scripts, and no cookies at all:

- `GA4_ID` — Google Analytics 4 measurement id (`G-XXXXXXXXXX`).
- `CLARITY_ID` — Microsoft Clarity project id (heatmaps, session replays).
- `PRIVACY_CONTACT` — optional email shown on `/privacy/` (else it points at GitHub).

When either id is set, every page gets a cookie consent banner (`templates.ts` +
`initConsent` in `client/main.ts`). **Nothing tracking loads until the visitor clicks
Accept** — only then are the GA4 and Clarity scripts injected and their cookies set.
Reject loads nothing; the choice lives in a strictly-necessary `consent` cookie, and
"Cookie settings" in the footer reopens the banner to change it. The `/privacy/` page
(`privacyPage` in `build/pages.ts`) documents what's collected — review/adjust it.

To turn it on: create the GA4 + Clarity projects, then add `GA4_ID`, `CLARITY_ID`
(and optionally `PRIVACY_CONTACT`) as **Production environment variables** in the
Cloudflare Pages project and redeploy.
