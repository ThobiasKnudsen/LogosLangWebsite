# Λόγος · logoslang.dev

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
npm run test:docs-model # unit-test the docs versioning (render) model
npm run test:releases   # unit-test the release/download model
npm run test:roadmap    # unit-test the roadmap model
```

**Docs live in the [LogosLang](https://github.com/ThobiasKnudsen/LogosLang) repo**
(under `docs/`), not here, so the language and its documentation version together. At
build time the site reads them from, in order: `$LOGOS_DOCS_DIR` if set; a sibling
`../LogosLang` checkout (best for local dev: edit docs there and the dev server
live-reloads); otherwise a shallow clone of LogosLang into `.docs-cache/`. The
versioning guard and the `new-version` scaffolder live in that repo too
(`.github/scripts/`), as plain bash. See "Docs versioning & release" below.

The build fetches LogosLang's GitHub Releases to bake the download page. It never
fails on a network error; for fast offline builds set `SKIP_RELEASES_FETCH=1`, or
point `LOGOS_RELEASES_JSON=<file>` at a saved API response to preview the populated
page.

## Stack & conventions

- **Custom SSG**: no framework. `npm run build` (`build/build.ts`) renders every
  page to a real static URL under `dist/`; `npm run dev` (`build/server.ts`) builds
  once, serves `dist/`, watches the sources, rebuilds, and live-reloads.
- **Markdown**: `markdown-it` for docs, with [Shiki](https://shiki.style) code
  highlighting (dual light/dark via CSS variables). Internal doc links are
  version-less and resolved within the viewed version at build time.
- **Versioned docs.** Each version is a complete, self-contained tree under
  `docs/vX.Y.Z/` (files are plain `name.md`). They live in the LogosLang repo; the
  *render* model (parse version folders, map a page across versions) lives here in
  `build/version.ts` (covered by `build/version.test.ts`), while the *guard* that
  enforces the layout + freeze lives in LogosLang as bash. The version picker and
  per-page version arrows are server-rendered and progressively enhanced by the client.
- **Bundling**: [esbuild](https://esbuild.github.io) bundles `client/main.ts` and
  `styles/theme.css` into `dist/assets/`, with self-hosted fonts emitted to
  `dist/assets/fonts/`.
- **SEO / AI discovery**: every page emits canonical + Open Graph/Twitter tags and
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
build/version.ts      docs versioning render model (version folders, page paths, arrows)
build/version.test.ts unit tests for the versioning model
build/releases.ts     browser-safe release model: asset-name parsing, install commands
build/fetch-releases.ts build-time fetch of LogosLang's GitHub Releases (node-only)
build/releases.test.ts unit tests for the release/download model
build/markdown.ts     markdown-it + Shiki + version-less link resolution
build/docs-render.ts  server-side render of a docs page (tree, version nav, article)
build/pages.ts        marketing pages (home hero, vision, roadmap, placeholders)
build/templates.ts    shared HTML shell: dock, footer, <head>, theme script
client/main.ts        client runtime: theme toggle, hero rotator, docs hydration
styles/theme.css       light/dark wisprflow theme: tokens, fonts, components
public/                static assets copied verbatim (favicon, og.png, robots.txt)
```

The documentation pages live in the LogosLang repo under `docs/vX.Y.Z/`, one complete
tree per version, fetched at build time. The guard + scaffolder that enforce the layout
live there too (`.github/scripts/docs-check.sh`, `new-version.sh`).

## Docs versioning & release (CI/CD)

Docs live in the **LogosLang** repo and are versioned by **that repo's git tags**; each
version is a complete tree under `docs/vX.Y.Z/`, and a released version is frozen. The
guard runs there, next to the docs, as plain bash (`.github/scripts/docs-check.sh`,
self-tested by `docs-check.test.sh`) so the language repo needs no Node/TypeScript. This
website just fetches those folders and renders them.

**The model in one line:** each version is a folder `docs/vX.Y.Z/`; you never edit a
released folder. You copy the latest folder to a new version and edit/add/remove/
restructure freely inside it. `R` = the newest `vX.Y.Z` tag on LogosLang = the frozen
line. Folders `<= R` are frozen; a folder `> R` is the in-progress next version.

`.github/scripts/new-version.sh [version]` (in LogosLang) starts a new version by
copying the latest folder, so you always begin from the previous version. Add a page by
creating a file in the folder, remove one by deleting its file, restructure by moving
files - all within the new version's folder.

**On every LogosLang pull request** (`.github/workflows/docs.yml` there):

- `test` self-tests the guard;
- `validate` enforces: `docs/` holds only `vX.Y.Z/` folders (each non-empty), and
  **freeze** - no file under a released folder (`<= R`) is added, modified, or deleted.
  Make `validate` a required check on LogosLang.

**On a docs push to LogosLang's `main`**, `docs.yml` sends a `docs-sync`
`repository_dispatch` to this repo; the `rebuild` workflow here fires the Cloudflare
deploy hook, and the rebuild re-clones the docs, so in-progress edits go live.

**On a LogosLang release**, pushing a tag `vX.Y.Z` in `../LogosLang` runs `release.yml`
there, which (0) **gates** the tag (strict semver, strictly newer than every existing
tag) **and verifies the docs** (the in-progress folder is named exactly `vX.Y.Z`, via
`docs-check.sh release`), or the run fails before building anything; (1) creates the
GitHub Release; (2) builds the per-OS/arch artifacts **and a WebAssembly build** and
uploads them; then (3) sends a `logoslang-release` `repository_dispatch` to this repo,
which fires the deploy hook. The tag itself (immutable) freezes those docs. The new
build *and* docs go live together.

## Download page & release builds

`/download/` (`downloadPage` in `build/pages.ts`) lets a visitor pick a version and
get a one-line install command plus a direct download for every OS/arch. The release
list is **baked at build time** by `build/fetch-releases.ts` (a deploy hook rebuilds
it on each release), and `client/main.ts` re-renders the grid on version change and
highlights the visitor's OS. With JS off, the latest version's commands all work.

**Asset naming convention**: the contract between LogosLang's `release.yml` and the
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

> ⚠️ Both build steps in `release.yml` are **clearly-marked placeholders**: the native
> jobs upload a stub archive, and the wasm job uploads a minimal valid (empty) wasm
> module. They wire the pipeline end to end; replace them with the real toolchain build
> once there's a compiler/seed to compile. The download and playground pages need no
> changes.

### One-time GitHub setup

1. **LogosLang repo → Settings → Secrets → Actions:** add `WEBSITE_DISPATCH_TOKEN`, a
   fine-grained PAT scoped to `ThobiasKnudsen/LogosLangWebsite` with
   **Contents: read & write** (the default `GITHUB_TOKEN` cannot dispatch cross-repo).
   It powers all three cross-repo notifications: `docs-sync`, `roadmap-sync`, and
   `logoslang-release`.
2. **This repo → Settings → Secrets → Actions:** add `CLOUDFLARE_DEPLOY_HOOK_URL` (a
   Cloudflare Pages → Settings → Builds & deployments → Deploy hook URL). The `rebuild`
   workflow POSTs it; if unset, that step is skipped.
3. **LogosLang repo → Settings → Branches → add a rule for `main`:** require the
   **`validate`** status check (from LogosLang's `docs.yml`) to pass before merging,
   and require a pull request, so no bad doc reaches `main` without the guard.
4. **LogosLang repo → Settings → Rules → Tags (optional):** add a tag ruleset for `v*`
   that blocks tag deletion/update, so a frozen release tag can never be moved.

That combination (required `validate` check + immutable release tags, both on LogosLang)
is what makes a completed version un-revisitable through normal merges.

### Releasing safely (multiple pushes, hotfixes)

A *push* and a *release* are different events. Push to `main` as many times as you
like while a version is in progress; nothing is finalized until you **tag** it, and
only the tag triggers the build + freeze. So "many pushes, one tag" is the normal flow.

- **Releasing is serialized.** Both release workflows use a `concurrency` group, so two
  version tags pushed close together queue instead of racing. Still, **tag one version
  at a time, in order**, so `R` advances predictably (0.0.2 → 0.0.3 → 0.0.4).
- **Hotfixes go to the next version.** Once `vX.Y.Z` is released its `docs/vX.Y.Z/`
  folder is frozen, so a fix can't edit it. Start `vX.Y.(Z+1)` (copy the folder) and
  correct it there.
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

## Release notifications (email capture)

The home hero and the (pre-release, empty) download page carry a "get notified"
form. It posts to `functions/api/subscribe.ts`, a **Cloudflare Pages Function**
deployed automatically from the `functions/` directory, which stores signups in a
Workers KV namespace: key `email:<address>`, value `{ email, subscribedAt, source }`.
Nothing else is stored (no IP, no user agent); `/privacy/` documents this.

**The promise made on the forms and on `/privacy/` is a low-volume list: emails for
the most important builds only, never spam, removal any time.** Changing that scope
requires changing the form copy, `/privacy/`, the client success message, and the
function's HTML page together, and only applies to signups collected after the
change.

**One-time setup** (until then the function answers 503 and the client tells the
visitor to watch GitHub releases instead, so the form degrades honestly):

1. Cloudflare dashboard → Storage & Databases → KV → create a namespace (e.g.
   `logos-subscribers`).
2. Pages project → Settings → Functions → **KV namespace bindings** → bind it as
   **`SUBSCRIBERS`** (Production, and Preview if you want preview deploys to work).
3. Redeploy.

Export the list when a release announcement goes out:

```sh
wrangler kv key list --namespace-id=<id> | jq -r '.[].name' | sed 's/^email://'
```

Client behavior: `initNotify` in `client/main.ts` submits via fetch and shows the
outcome inline; with JS off the function answers with a small self-contained HTML
page. A visually hidden `website` field is a honeypot: any value in it makes the
function claim success and store nothing. `npm run dev` serves a stub at
`/api/subscribe` (logs the email, answers `{ ok: true }`) so the forms work locally;
to exercise the real function locally use `wrangler pages dev dist`.

## Analytics & privacy

Analytics is **first-party, cookieless, and self-hosted on Cloudflare** - no third
parties (no Google, no Clarity), no advertising cookies, no raw IP stored. A small beacon
(`initAnalytics` in `client/main.ts`) posts page views and a few events (scroll depth,
dwell time, downloads, outbound clicks, version picks, notify submits, playground runs)
to the **`/api/collect`** Pages Function (`functions/api/collect.ts`), which enriches each
with Cloudflare's edge geolocation (`request.cf`: country, region, city, a city-centroid
lat/long, and network/ASN) and a coarse device/browser/OS label, then appends one row to
a **Cloudflare D1** database (`db/schema.sql`).

Identity is two random ids in the browser, not cookies: a persistent **`visitor`** id in
`localStorage` (counts returning visits across sessions) and a per-visit **`session`** id
in `sessionStorage` (gone when the tab closes). The `/privacy/` page (`privacyPage` in
`build/pages.ts`) documents exactly what is stored; keep it in sync with `collect.ts`.
`PRIVACY_CONTACT` (build env) sets the contact email shown there.

### Dashboard (`/admin/`)

A self-contained dashboard (`client/dashboard.ts`, shell in `build/build.ts`) renders four
tabs - **Map / Log / Users / Access** - with a time-range filter and click-through to a
single visit's page journey or a visitor's history across sessions. Data comes from
**`/admin/stats`** (`functions/admin/stats.ts`), which queries D1. The world map is a
vendored, self-hosted outline (`public/admin/world.geo.json`), so nothing loads from a
third party.

**Access control is HTTP Basic Auth** in `functions/admin/_middleware.ts`, which guards
everything under `/admin/` (the page, the data API, the map asset) and **fails closed** if
no password is set. It also appends a security row to the `admin_access` table on every
successful sign-in and every wrong-password attempt (time, IP, geo, network, device),
shown in the dashboard's **Access** tab. The page is also `noindex`, disallowed in
`robots.txt`, and absent from the sitemap, but that is discovery hygiene, not the gate.

**Brute-force protection** is two layers. In code, the middleware keeps a per-IP,
in-memory failure counter and returns `429` once an IP exceeds `RL_MAX` failed attempts
per `RL_WINDOW_MS` (default 5 per minute) - before checking the password or writing to
D1, so it throttles guessing and can't be used to flood the audit log. That limiter is
per-isolate and best-effort, so the **authoritative** control is an **edge WAF
rate-limiting rule** on `/admin/*` (step 4 below); set both. Whatever survives those still
faces the password, so make `ADMIN_PASSWORD` a long random string.

### One-time setup (Cloudflare)

1. **Create the D1 database and load the schema** (run `wrangler login` first):
   ```sh
   npm run db:create      # wrangler d1 create logos-analytics -> prints a database_id
   npm run db:schema      # applies db/schema.sql to the remote database
   ```
2. **Bind it to the Pages project** as **`DB`**: Pages project -> Settings -> Functions ->
   D1 database bindings -> add `DB` = `logos-analytics`, for **Production and Preview**.
   Until this binding exists, `/api/collect` answers `204` (stores nothing) and
   `/admin/stats` reports empty, so the site works unchanged.
3. **Set the dashboard password**: on the Pages project, Settings -> Variables and Secrets,
   add a **Secret** `ADMIN_PASSWORD` (a long random string), and optionally `ADMIN_USER`
   (defaults to `admin`), for Production. The middleware fails closed until this is set, so
   `/admin/` is never accidentally public. Full Cloudflare Access / Zero Trust is optional
   (the Basic Auth gate does not need it), but the WAF rule below is not optional.
4. **Add an edge rate-limiting rule** (the authoritative brute-force control; the in-code
   limiter is only a per-isolate backstop). In the Cloudflare dashboard for the domain:
   **Security -> WAF -> Rate limiting rules -> Create rule**:
   - **Field / match**: `URI Path` `starts with` `/admin/`
   - **Counting characteristic**: IP (`ip.src`)
   - **Rate**: e.g. `20` requests per `1 minute`
   - **Action**: `Block` for `Mitigation timeout` `10 minutes` (or `Managed Challenge`)

   Expression, if you use the editor directly: `starts_with(http.request.uri.path, "/admin/")`.
   Pick a threshold above what the dashboard itself fetches when you click around (it fires
   several `/admin/stats` requests per interaction) but far below what a guesser needs. The
   free plan includes one rate-limiting rule, which is enough for this.
5. Remove the old `GA4_ID` / `CLARITY_ID` env vars (no longer read), then redeploy.

Locally, `npm run dev` stubs `/api/collect` (logs, `204`) and `/admin/stats` (a fixture),
so the beacon and the `/admin/` dashboard work without Cloudflare (and without auth, since
the static dev server does not run middleware). To exercise the real Functions + D1, use
`wrangler pages dev dist` with a local D1 (`npm run db:schema:local`) and set
`ADMIN_PASSWORD` in `.dev.vars`. Only the real Cloudflare edge populates `request.cf`
geolocation.

Export the raw events any time:

```sh
wrangler d1 execute logos-analytics --remote --command "SELECT * FROM events" --json
```
