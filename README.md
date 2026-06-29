# Λόγος — logoslang.dev

The marketing + documentation website for **Logos**, a self-hosting systems
language built on radical unification.

Built with [Astro](https://astro.build) + [Starlight](https://starlight.astro.build),
deployed to Cloudflare Pages. Light, wisprflow.ai-inspired theme.

## Develop

Requires **Node 22+** (pinned in `.node-version`).

```sh
npm install
npm run dev      # local dev server at http://localhost:4321
npm run build    # production build to ./dist
npm run preview  # preview the production build
```

## Stack & conventions

- **Astro + Starlight** — docs framework: sidebar, dark/light, MDX, Expressive Code.
- **Search** — Pagefind (static, client-side, zero-config), built at `npm run build`.
- **LLM ingestion** — `starlight-llms-txt` emits `/llms.txt`, `/llms-full.txt`,
  `/llms-small.txt` so agents (Claude, Cursor, …) can read the docs.
- **Fonts** (self-hosted via Fontsource, mirroring wisprflow.ai):
  Figtree (UI/body), EB Garamond (serif + the Greek `Λόγος` wordmark),
  JetBrains Mono (code).
- **Theme tokens** live in `src/styles/theme.css`. Accent is one swap (`--logos-accent`).

## Structure

```
astro.config.mjs              site config, Starlight, llms-txt plugin, sidebar
src/styles/theme.css          light wisprflow theme: tokens, fonts, buttons
src/components/Hero.astro      home hero (headline + parked alternates in comments)
src/content/docs/index.mdx     home (splash) — hero + pillars
src/content/docs/**            documentation pages
```

## Deploy (Cloudflare Pages)

Connect this repo in the Cloudflare Pages dashboard with:

- **Build command:** `npm run build`
- **Output directory:** `dist`
- **Node version:** read from `.node-version` (22)

Then add `logoslang.dev` as a custom domain in the Pages project.
