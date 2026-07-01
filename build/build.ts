// Static build: render every docs snapshot to its own static page (real URLs, no
// SPA shell), emit a structure-only manifest for client hydration, generate the
// marketing pages, and bundle the client JS + CSS (with self-hosted fonts).
import { promises as fs, existsSync, mkdirSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as esbuild from "esbuild";
import {
  parseVersionDir,
  versionToString,
  sortVersions,
  latestTree,
  globalVersionStrings,
  type VersionTree,
  type DocPage,
} from "./version.ts";
import { renderMarkdown, parseFrontmatter } from "./markdown.ts";
import { page, SITE_URL, absUrl, setAssetUrls } from "./templates.ts";
import {
  homePage,
  visionPage,
  roadmapPage,
  placeholderPage,
  downloadPage,
  playgroundPage,
  privacyPage,
  notFoundPage,
} from "./pages.ts";
import { renderDocsMain } from "./docs-render.ts";
import { fetchReleases } from "./fetch-releases.ts";
import { fetchRoadmap } from "./fetch-roadmap.ts";

export const ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const DIST = path.join(ROOT, "dist");

// The docs live in the LogosLang repo (ThobiasKnudsen/LogosLang) under docs/, not in
// this repo, so the language and its documentation version together. resolveDocsDir()
// locates them, in order of preference:
//   1. $LOGOS_DOCS_DIR   an explicit path (CI override / offline preview)
//   2. ../LogosLang/docs a local sibling checkout (best for dev: live edits, no clone)
//   3. a shallow clone of LogosLang into .docs-cache/ (Cloudflare / CI build)
const DOCS_REPO =
  process.env.LOGOS_DOCS_REPO ??
  "https://github.com/ThobiasKnudsen/LogosLang.git";
const DOCS_REF = process.env.LOGOS_DOCS_REF ?? "main";
const DOCS_CACHE = path.join(ROOT, ".docs-cache", "logoslang");

/** A local LogosLang docs checkout to render from without cloning, or null. */
export function localDocsDir(): string | null {
  const override = process.env.LOGOS_DOCS_DIR;
  if (override) return path.resolve(override);
  const sibling = path.resolve(ROOT, "..", "LogosLang", "docs");
  return existsSync(sibling) ? sibling : null;
}

/** Shallow-clone (or refresh) LogosLang's docs into the cache; returns its docs/ dir. */
function cloneDocs(): string {
  const run = (args: string[], cwd?: string) =>
    execFileSync("git", args, { cwd, stdio: ["ignore", "ignore", "inherit"] });
  try {
    if (existsSync(path.join(DOCS_CACHE, ".git"))) {
      run(["fetch", "--depth", "1", "origin", DOCS_REF], DOCS_CACHE);
      run(["reset", "--hard", "FETCH_HEAD"], DOCS_CACHE);
    } else {
      rmSync(DOCS_CACHE, { recursive: true, force: true });
      mkdirSync(path.dirname(DOCS_CACHE), { recursive: true });
      run(["clone", "--depth", "1", "--branch", DOCS_REF, DOCS_REPO, DOCS_CACHE]);
    }
  } catch (err) {
    throw new Error(
      `failed to fetch docs from ${DOCS_REPO} (ref ${DOCS_REF}). Check out LogosLang ` +
        `next to this repo, or set LOGOS_DOCS_DIR to a local docs/ checkout. Cause: ${
          (err as Error).message
        }`,
    );
  }
  return path.join(DOCS_CACHE, "docs");
}

/** Resolve the docs source directory, cloning LogosLang if no local copy exists. */
export function resolveDocsDir(): string {
  const local = localDocsDir();
  if (local) {
    if (!existsSync(local)) throw new Error(`docs directory not found: ${local}`);
    return local;
  }
  return cloneDocs();
}

async function walk(dir: string): Promise<string[]> {
  const out: string[] = [];
  let entries: import("node:fs").Dirent[];
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await walk(full)));
    else if (entry.isFile() && entry.name.endsWith(".md")) out.push(full);
  }
  return out;
}

async function writePage(rel: string, html: string): Promise<void> {
  const dest = path.join(DIST, rel);
  await fs.mkdir(path.dirname(dest), { recursive: true });
  await fs.writeFile(dest, html);
}

async function copyDir(src: string, dest: string): Promise<void> {
  let entries: import("node:fs").Dirent[];
  try {
    entries = await fs.readdir(src, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    const from = path.join(src, entry.name);
    const to = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      await fs.mkdir(to, { recursive: true });
      await copyDir(from, to);
    } else {
      await fs.copyFile(from, to);
    }
  }
}

/** Strip HTML tags and collapse whitespace for a ~155-char meta description. */
function metaDescription(html: string): string {
  const text = html
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
  return text.length > 155 ? `${text.slice(0, 152).trimEnd()}…` : text;
}

/** Title for a page: its frontmatter `title`, else a prettified last path segment. */
function titleForPage(source: string, pagePath: string): string {
  const { title } = parseFrontmatter(source);
  if (title) return title;
  const seg = pagePath.slice(pagePath.lastIndexOf("/") + 1);
  return seg.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/** A page's URL: canonical `/docs/<path>/` for the latest version, else versioned. */
function pageUrl(versionStr: string, pagePath: string, isLatest: boolean): string {
  return isLatest ? `/docs/${pagePath}/` : `/docs/v${versionStr}/${pagePath}/`;
}

/**
 * Render the docs into `dist`. Each version is a complete tree under `docs/vX.Y.Z/`;
 * we emit a versioned page at `/docs/v<ver>/<path>/` for every page in every version,
 * a canonical `/docs/<path>/` for the latest version, a `/docs/` landing, and a
 * structure-only `manifest.json` (per-version page lists, no HTML) for the client.
 */
async function renderDocs(docsDir: string): Promise<{
  pageCount: number;
  versions: string[];
  docEntries: { path: string; title: string; desc: string }[];
}> {
  // Discover `vX.Y.Z/` folders and read each version's page tree.
  let dirEntries: import("node:fs").Dirent[];
  try {
    dirEntries = await fs.readdir(docsDir, { withFileTypes: true });
  } catch {
    dirEntries = [];
  }

  const trees: VersionTree[] = [];
  const sourceOf = new Map<string, string>(); // `${versionStr}::${path}` -> source
  for (const entry of dirEntries) {
    if (!entry.isDirectory()) continue;
    const version = parseVersionDir(entry.name);
    if (!version) continue;
    const versionStr = versionToString(version);
    const verDir = path.join(docsDir, entry.name);
    const pages: DocPage[] = [];
    for (const abs of await walk(verDir)) {
      const pagePath = path
        .relative(verDir, abs)
        .split(path.sep)
        .join("/")
        .replace(/\.md$/, "");
      const source = await fs.readFile(abs, "utf8");
      sourceOf.set(`${versionStr}::${pagePath}`, source);
      pages.push({ path: pagePath, title: titleForPage(source, pagePath) });
    }
    pages.sort((a, b) => a.path.localeCompare(b.path));
    trees.push({ version, versionStr, pages });
  }

  const sorted = sortVersions(trees);
  const versions = globalVersionStrings(trees);
  const latest = latestTree(trees);
  const latestStr = latest ? latest.versionStr : null;

  // Structure-only manifest: per-version page lists for client hydration, no HTML.
  const manifest = {
    versions,
    latest: latestStr,
    trees: Object.fromEntries(sorted.map((t) => [t.versionStr, t.pages])),
  };
  await fs.writeFile(path.join(DIST, "manifest.json"), JSON.stringify(manifest));

  if (!latest) {
    await writePage(
      "docs/index.html",
      page({
        title: "Docs",
        active: "docs",
        bodyClass: "docs-page",
        header: "none",
        footer: false,
        main: '<div class="docs"><p>No documentation has been published yet.</p></div>',
      }),
    );
    return { pageCount: 0, versions, docEntries: [] };
  }

  // Render every page's HTML once, keyed by `${versionStr}::${path}`. Links resolve
  // within the page's own version.
  const htmlOf = new Map<string, string>();
  for (const tree of sorted) {
    const pagePaths = new Set(tree.pages.map((p) => p.path));
    const isLatest = tree.versionStr === latestStr;
    for (const pg of tree.pages) {
      const source = sourceOf.get(`${tree.versionStr}::${pg.path}`)!;
      const currentDir = pg.path.includes("/")
        ? pg.path.slice(0, pg.path.lastIndexOf("/"))
        : "";
      const { html } = await renderMarkdown(source, {
        currentDir,
        pagePaths,
        versionStr: tree.versionStr,
        isLatest,
      });
      htmlOf.set(`${tree.versionStr}::${pg.path}`, html);
    }
  }

  // Render one docs page (a `#docs-app` block) at a given version.
  const renderTo = async (opts: {
    urlPath: string;
    versionStr: string;
    isLatest: boolean;
    page: DocPage;
    canonical: string;
    docTitle?: string;
  }) => {
    const html = htmlOf.get(`${opts.versionStr}::${opts.page.path}`) ?? "";
    const main = renderDocsMain({
      trees: sorted,
      versionStr: opts.versionStr,
      isLatest: opts.isLatest,
      currentPath: opts.page.path,
      html,
      versions,
      latestStr,
    });
    const docTitle = opts.docTitle ?? opts.page.title;
    const docDesc = metaDescription(html);
    await writePage(
      opts.urlPath,
      page({
        title: docTitle,
        active: "docs",
        bodyClass: "docs-page",
        header: "none",
        footer: false,
        canonical: opts.canonical,
        description: docDesc,
        jsonLd: {
          "@context": "https://schema.org",
          "@type": "TechArticle",
          headline: docTitle,
          name: docTitle,
          description: docDesc,
          url: absUrl(opts.canonical),
          inLanguage: "en",
          isPartOf: { "@type": "WebSite", name: "Logos", url: SITE_URL },
        },
        main,
      }),
    );
  };

  // Versioned permalink for every page in every version.
  for (const tree of sorted) {
    const isLatest = tree.versionStr === latestStr;
    for (const pg of tree.pages) {
      await renderTo({
        urlPath: `docs/v${tree.versionStr}/${pg.path}/index.html`,
        versionStr: tree.versionStr,
        isLatest,
        page: pg,
        canonical: pageUrl(tree.versionStr, pg.path, isLatest),
      });
    }
  }

  // Canonical `/docs/<path>/` for the latest version (also feeds sitemap + llms.txt).
  const docEntries: { path: string; title: string; desc: string }[] = [];
  for (const pg of latest.pages) {
    await renderTo({
      urlPath: `docs/${pg.path}/index.html`,
      versionStr: latest.versionStr,
      isLatest: true,
      page: pg,
      canonical: `/docs/${pg.path}/`,
    });
    docEntries.push({
      path: `/docs/${pg.path}/`,
      title: pg.title,
      desc: metaDescription(htmlOf.get(`${latest.versionStr}::${pg.path}`) ?? ""),
    });
  }

  // `/docs/` lands on the first page of the latest version.
  const first = latest.pages[0];
  if (first) {
    await renderTo({
      urlPath: "docs/index.html",
      versionStr: latest.versionStr,
      isLatest: true,
      page: first,
      canonical: `/docs/${first.path}/`,
      docTitle: "Docs",
    });
  }

  return { pageCount: latest.pages.length, versions, docEntries };
}

/**
 * Bundle the client JS + CSS with content-hashed filenames (e.g. theme-AB12CD.css)
 * so a fresh deploy never collides with a stale copy cached at a fixed URL. Returns
 * the hashed asset paths for the page shell to link.
 */
async function bundleAssets(): Promise<{ cssHref: string; jsHref: string }> {
  const assetsDir = path.join(DIST, "assets");
  const hrefOf = (
    meta: { outputs: Record<string, unknown> },
    ext: string,
  ): string => {
    const key = Object.keys(meta.outputs).find((k) => k.endsWith(ext));
    if (!key) throw new Error(`bundleAssets: no ${ext} output emitted`);
    return `/assets/${path.basename(key)}`;
  };

  const js = await esbuild.build({
    entryPoints: [path.join(ROOT, "client/main.ts")],
    bundle: true,
    format: "esm",
    target: ["es2020"],
    minify: true,
    outdir: assetsDir,
    entryNames: "[name]-[hash]",
    metafile: true,
    logLevel: "silent",
  });
  const css = await esbuild.build({
    entryPoints: [path.join(ROOT, "styles/theme.css")],
    bundle: true,
    minify: true,
    outdir: assetsDir,
    entryNames: "[name]-[hash]",
    loader: { ".woff2": "file", ".woff": "file" },
    assetNames: "fonts/[name]-[hash]",
    metafile: true,
    logLevel: "silent",
  });
  return {
    jsHref: hrefOf(js.metafile, ".js"),
    cssHref: hrefOf(css.metafile, ".css"),
  };
}

export async function build(): Promise<void> {
  await fs.rm(DIST, { recursive: true, force: true });
  await fs.mkdir(path.join(DIST, "assets"), { recursive: true });

  // Bundle first so the hashed asset URLs are known before any page is rendered.
  const assets = await bundleAssets();
  setAssetUrls(assets.cssHref, assets.jsHref);

  const homeDesc =
    "Logos is a self-hosting systems programming language built on radical unification: programs, types, proofs, the optimizer, the standard library, and the compiler itself all live in one reflectable structure, the Logic Graph.";
  const roadmapDesc =
    "Where Logos actually stands: an honest map of what runs today versus the still-planned pieces of the vision, from the self-hosting seed to dependent-type proofs.";
  const examplesDesc =
    "Worked Logos examples are on the way, showing the one structure carrying real programs, types, proofs, and rewrites.";
  const playgroundDesc =
    "An in-browser Logos playground is on the way: evaluate expressions and watch the same engine the compiler uses rewrite them live.";
  const downloadDesc =
    "Download Logos: pick a version and get a one-line install command and a direct download for macOS, Linux, and Windows.";

  // Released builds, baked into the download page. Never fails the build (see
  // fetch-releases.ts); a release fires a deploy hook that rebuilds this page.
  const releases = await fetchReleases();
  // Roadmap stations, generated from LogosLang's `roadmap`-labelled GitHub issues.
  // Falls back to content/roadmap.snapshot.json if GitHub is unreachable, so the
  // page never blanks (see fetch-roadmap.ts).
  const roadmap = await fetchRoadmap();

  await writePage(
    "index.html",
    page({
      title: "Λόγος",
      active: "",
      bodyClass: "home",
      path: "/",
      description: homeDesc,
      jsonLd: [
        {
          "@context": "https://schema.org",
          "@type": "WebSite",
          name: "Logos",
          alternateName: "Λόγος",
          url: SITE_URL,
          description: homeDesc,
        },
        {
          "@context": "https://schema.org",
          "@type": "SoftwareApplication",
          name: "Logos",
          alternateName: "Λόγος",
          applicationCategory: "DeveloperApplication",
          operatingSystem: "Windows, macOS, Linux",
          url: SITE_URL,
          downloadUrl: absUrl("/download/"),
          description: homeDesc,
          offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
        },
      ],
      main: homePage(),
    }),
  );
  await writePage(
    "vision/index.html",
    page({
      title: "Vision",
      active: "vision",
      path: "/vision/",
      description:
        "Radical unification: why Logos puts programs, types, proofs, compilation, and the compiler itself in one structure.",
      main: visionPage(),
    }),
  );
  await writePage(
    "roadmap/index.html",
    page({
      title: "Roadmap",
      active: "roadmap",
      path: "/roadmap/",
      description: roadmapDesc,
      main: roadmapPage(roadmap),
    }),
  );
  await writePage(
    "examples/index.html",
    page({
      title: "Examples",
      active: "examples",
      path: "/examples/",
      description: examplesDesc,
      main: placeholderPage(
        "Examples",
        "Worked examples are on the way, showing the one structure carrying real programs, types, proofs, and rewrites.",
      ),
    }),
  );
  await writePage(
    "playground/index.html",
    page({
      title: "Playground",
      active: "playground",
      path: "/playground/",
      description: playgroundDesc,
      main: playgroundPage(releases),
    }),
  );
  await writePage(
    "download/index.html",
    page({
      title: "Download",
      active: "download",
      path: "/download/",
      description: downloadDesc,
      main: downloadPage(releases),
    }),
  );
  await writePage(
    "privacy/index.html",
    page({
      title: "Privacy & Cookies",
      active: "",
      path: "/privacy/",
      description:
        "How logoslang.dev handles data and cookies: consent-gated analytics (Microsoft Clarity, Google Analytics), what is collected, and your choices.",
      main: privacyPage(),
    }),
  );
  // Emitted to dist/404.html; Cloudflare Pages serves it (with a 404 status) for any
  // route that doesn't match a static file, instead of falling back to the home page.
  await writePage(
    "404.html",
    page({
      title: "Page not found",
      active: "",
      description: "That page does not exist.",
      main: notFoundPage(),
    }),
  );

  const docs = await renderDocs(resolveDocsDir());

  // Discovery files: sitemap of canonical URLs, and llms.txt pointing AI
  // answer-engines at the same content with one-line summaries.
  const marketing = [
    { path: "/", title: "Logos: Radical Unification", desc: homeDesc },
    {
      path: "/vision/",
      title: "Vision",
      desc: "Radical unification: programs, types, proofs, compilation, and the compiler in one structure.",
    },
    { path: "/roadmap/", title: "Roadmap", desc: roadmapDesc },
    { path: "/examples/", title: "Examples", desc: examplesDesc },
    { path: "/playground/", title: "Playground", desc: playgroundDesc },
    { path: "/download/", title: "Download", desc: downloadDesc },
  ];
  const docsLanding = docs.docEntries.length
    ? [
        {
          path: "/docs/",
          title: "Documentation",
          desc: "Logos documentation: getting started, guides, internals, and the operator reference.",
        },
      ]
    : [];
  const allEntries = [...marketing, ...docsLanding, ...docs.docEntries];
  // Privacy goes in the sitemap but not llms.txt (it isn't content for AI engines).
  await writeSitemap([...allEntries.map((e) => e.path), "/privacy/"]);
  await writeLlmsTxt(marketing, docsLanding, docs.docEntries);

  await copyDir(path.join(ROOT, "public"), DIST);

  console.log(
    `built ${docs.pageCount} docs pages (latest), versions [${docs.versions.join(", ")}] -> dist/`,
  );
}

/** Emit a sitemap.xml of absolute canonical URLs. */
async function writeSitemap(paths: string[]): Promise<void> {
  const urls = paths
    .map((p) => `  <url><loc>${absUrl(p)}</loc></url>`)
    .join("\n");
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`;
  await fs.writeFile(path.join(DIST, "sitemap.xml"), xml);
}

/**
 * Emit llms.txt: a Markdown map of the site for AI answer-engines, following the
 * llmstxt.org convention (H1 name, blockquote summary, then linked sections).
 */
async function writeLlmsTxt(
  marketing: { path: string; title: string; desc: string }[],
  docsLanding: { path: string; title: string; desc: string }[],
  docEntries: { path: string; title: string; desc: string }[],
): Promise<void> {
  const line = (e: { path: string; title: string; desc: string }) =>
    `- [${e.title}](${absUrl(e.path)}): ${e.desc}`;
  const parts = [
    "# Logos (Λόγος)",
    "",
    "> Logos is a self-hosting systems programming language built on radical unification: programs, types, proofs, the optimizer, the standard library, and the compiler itself all live in one reflectable structure, the Logic Graph. The same operations that run a program can read, write, update, optimize, and prove any of it",
    "",
    "## Pages",
    "",
    marketing.map(line).join("\n"),
  ];
  if (docEntries.length) {
    parts.push(
      "",
      "## Documentation",
      "",
      [...docsLanding, ...docEntries].map(line).join("\n"),
    );
  }
  await fs.writeFile(path.join(DIST, "llms.txt"), parts.join("\n") + "\n");
}

// Run when invoked directly (npm run build).
if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  build().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
