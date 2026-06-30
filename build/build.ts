// Static build: render every docs snapshot to its own static page (real URLs, no
// SPA shell), emit a structure-only manifest for client hydration, generate the
// marketing pages, and bundle the client JS + CSS (with self-hosted fonts).
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as esbuild from "esbuild";
import {
  buildSections,
  globalVersions,
  versionToString,
  parseVersionString,
  compareVersions,
  effectiveSnapshot,
  visibleSections,
  type SemVer,
} from "./version.ts";
import { renderMarkdown } from "./markdown.ts";
import { page, SITE_URL, absUrl, setAssetUrls } from "./templates.ts";
import {
  homePage,
  visionPage,
  roadmapPage,
  placeholderPage,
  downloadPage,
  playgroundPage,
  privacyPage,
} from "./pages.ts";
import { renderDocsMain } from "./docs-render.ts";
import { fetchReleases } from "./fetch-releases.ts";
import { fetchRoadmap } from "./fetch-roadmap.ts";

export const ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const DOCS_DIR = path.join(ROOT, "content/docs");
const DIST = path.join(ROOT, "dist");

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

/**
 * Render the docs into `dist`: a structure-only `manifest.json` (no HTML) plus one
 * static page per snapshot at `/docs/<id>/v<ver>/`, a canonical `/docs/<id>/` for
 * each section's newest snapshot, and a `/docs/` landing on the first section.
 */
async function renderDocs(): Promise<{
  sectionCount: number;
  versions: string[];
  docEntries: { path: string; title: string; desc: string }[];
}> {
  const absFiles = await walk(DOCS_DIR);
  const relFiles = absFiles.map((f) =>
    path.relative(DOCS_DIR, f).split(path.sep).join("/"),
  );
  const sections = buildSections(relFiles);
  const sectionIds = new Set(sections.map((s) => s.id));

  // Render each snapshot's HTML and title once, keyed by `id@version`.
  const htmlBySnap = new Map<string, string>();
  const titleBySnap = new Map<string, string>();
  for (const section of sections) {
    for (const snap of section.snapshots) {
      const source = await fs.readFile(path.join(DOCS_DIR, snap.file), "utf8");
      const { title, html } = await renderMarkdown(
        source,
        section.dir,
        sectionIds,
      );
      htmlBySnap.set(`${section.id}@${snap.versionStr}`, html);
      titleBySnap.set(
        `${section.id}@${snap.versionStr}`,
        title ?? section.name,
      );
    }
  }
  const titleOf = (id: string, ver: string) =>
    titleBySnap.get(`${id}@${ver}`) ?? id;
  const htmlOf = (id: string, ver: string) =>
    htmlBySnap.get(`${id}@${ver}`) ?? "";

  const versions = globalVersions(sections).map(versionToString);
  const latestStr = versions.length ? versions[versions.length - 1]! : null;

  // Structure-only manifest: metadata for client hydration, no HTML payload.
  const manifest = {
    versions,
    latest: latestStr,
    sections: sections.map((s) => ({
      id: s.id,
      dir: s.dir,
      name: s.name,
      snapshots: s.snapshots.map((sn) => ({
        version: sn.versionStr,
        title: titleOf(s.id, sn.versionStr),
      })),
    })),
  };
  await fs.writeFile(
    path.join(DIST, "manifest.json"),
    JSON.stringify(manifest),
  );

  if (!latestStr) {
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
    return { sectionCount: 0, versions, docEntries: [] };
  }
  const latest = parseVersionString(latestStr);

  // Render one docs page (a `#docs-app` block) at a given global context.
  const renderTo = async (opts: {
    urlPath: string;
    global: SemVer;
    currentId: string;
    viewedVersion: SemVer;
    canonical: string;
  }) => {
    const main = renderDocsMain({
      sections,
      global: opts.global,
      isLatestGlobal: compareVersions(opts.global, latest) === 0,
      currentId: opts.currentId,
      viewedVersion: opts.viewedVersion,
      titleOf,
      htmlOf,
      versions,
    });
    const docTitle = titleOf(
      opts.currentId,
      versionToString(opts.viewedVersion),
    );
    const docDesc = metaDescription(
      htmlOf(opts.currentId, versionToString(opts.viewedVersion)),
    );
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

  // Canonical docs URLs (one per section, newest snapshot) for sitemap + llms.txt.
  const docEntries: { path: string; title: string; desc: string }[] = [];

  for (const section of sections) {
    const canonical = `/docs/${section.id}/`;
    const newest = effectiveSnapshot(section, latest)!; // section's latest snapshot

    // Canonical page: the section at the newest global version.
    await renderTo({
      urlPath: `docs/${section.id}/index.html`,
      global: latest,
      currentId: section.id,
      viewedVersion: newest.version,
      canonical,
    });
    docEntries.push({
      path: canonical,
      title: titleOf(section.id, newest.versionStr),
      desc: metaDescription(htmlOf(section.id, newest.versionStr)),
    });

    // Historical permalinks: each snapshot shown against the latest global
    // version, so the version picker stays put and an off-version snapshot
    // carries the "current version is vX" warning.
    for (const snap of section.snapshots) {
      await renderTo({
        urlPath: `docs/${section.id}/v${snap.versionStr}/index.html`,
        global: latest,
        currentId: section.id,
        viewedVersion: snap.version,
        canonical,
      });
    }
  }

  // `/docs/` lands on the first section visible at the newest version.
  const first = visibleSections(sections, latest)[0];
  if (first) {
    const newest = effectiveSnapshot(first, latest)!;
    const main = renderDocsMain({
      sections,
      global: latest,
      isLatestGlobal: true,
      currentId: first.id,
      viewedVersion: newest.version,
      titleOf,
      htmlOf,
      versions,
    });
    await writePage(
      "docs/index.html",
      page({
        title: "Docs",
        active: "docs",
        bodyClass: "docs-page",
        header: "none",
        footer: false,
        canonical: `/docs/${first.id}/`,
        main,
      }),
    );
  }

  return { sectionCount: sections.length, versions, docEntries };
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
  const docs = await renderDocs();

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
    `built ${docs.sectionCount} docs sections, versions [${docs.versions.join(", ")}] -> dist/`,
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
