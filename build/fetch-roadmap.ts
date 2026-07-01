// Build-time fetch of LogosLang's roadmap issues AND their dependency edges,
// shaped into the model in roadmap.ts. Node-only (env / fs / child_process);
// imported by build.ts.
//
// Edges come from the per-issue `dependencies/blocked_by` REST endpoint (one call
// per issue). It works unauthenticated, but the anonymous limit is 60/hr, which a
// dev watch loop blows through, so we use a token when we can:
//   GITHUB_TOKEN=...          -> explicit token (CI / Cloudflare build env)
//   else: the local `gh` CLI session token, if gh is installed and logged in
// An empty/failed fetch must never blank the page, so every success writes
// content/roadmap.snapshot.json and any *network* failure falls back to it. The one
// exception is a RoadmapError (a roadmap issue with no milestone): that is a data
// error, not a transient one, so it fails the build instead of hiding the problem.
// Other hatches:
//   SKIP_ROADMAP_FETCH=1      -> skip the network, render from the snapshot
//   LOGOS_ROADMAP_JSON=path   -> read pre-assembled { issues, milestones } JSON instead
//                                (issues carry blockedBy; milestones is the repo list)

import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { roadmapFromApi, isRoadmap, RoadmapError, type Roadmap } from "./roadmap.ts";

const REPO = "ThobiasKnudsen/LogosLang";
const ISSUES_URL = `https://api.github.com/repos/${REPO}/issues?state=all&labels=roadmap&per_page=100`;
const MILESTONES_URL = `https://api.github.com/repos/${REPO}/milestones?state=all&per_page=100`;
const blockedByUrl = (n: number) =>
  `https://api.github.com/repos/${REPO}/issues/${n}/dependencies/blocked_by`;
const TIMEOUT_MS = 10000;

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SNAPSHOT_PATH = path.join(ROOT, "content/roadmap.snapshot.json");
const EMPTY: Roadmap = { milestones: [], stations: [] };

function readSnapshot(): Roadmap {
  try {
    const parsed = JSON.parse(readFileSync(SNAPSHOT_PATH, "utf8"));
    if (isRoadmap(parsed)) {
      // A legacy snapshot may predate the `labels` field; default it so the loaded
      // object matches the Station type and the renderer never sees `undefined`.
      for (const s of parsed.stations) if (!Array.isArray(s.labels)) s.labels = [];
      return parsed;
    }
    console.warn("roadmap: snapshot is malformed; ignoring it.");
  } catch {
    /* no snapshot yet */
  }
  return EMPTY;
}

function writeSnapshot(roadmap: Roadmap): void {
  try {
    writeFileSync(SNAPSHOT_PATH, `${JSON.stringify(roadmap, null, 2)}\n`);
  } catch (err) {
    console.warn(`roadmap: could not write snapshot (${(err as Error).message}).`);
  }
}

/** A token from the env, or the local gh CLI session (raises the unauth limit). */
function resolveToken(): string | undefined {
  if (process.env.GITHUB_TOKEN) return process.env.GITHUB_TOKEN;
  try {
    const t = execFileSync("gh", ["auth", "token"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    return t || undefined;
  } catch {
    return undefined; // gh not installed / not logged in (e.g. CI) -> stay anonymous
  }
}

export async function fetchRoadmap(): Promise<Roadmap> {
  if (process.env.SKIP_ROADMAP_FETCH === "1") return readSnapshot();

  if (process.env.LOGOS_ROADMAP_JSON) {
    let parsed: any;
    try {
      parsed = JSON.parse(readFileSync(process.env.LOGOS_ROADMAP_JSON, "utf8"));
    } catch (err) {
      console.warn(
        `roadmap: could not read LOGOS_ROADMAP_JSON (${(err as Error).message}); using snapshot.`,
      );
      return readSnapshot();
    }
    // A RoadmapError here (unscheduled issue) must surface, not fall back, same as
    // a live fetch. Only the file read above is a soft failure.
    const issues = Array.isArray(parsed) ? parsed : parsed?.issues;
    const ms = Array.isArray(parsed) ? [] : parsed?.milestones;
    return roadmapFromApi(issues, ms);
  }

  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "logoslang-website-build",
  };
  const token = resolveToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    // Issues and milestones in parallel; both are needed to build the bands.
    const [res, msRes] = await Promise.all([
      fetch(ISSUES_URL, { headers, signal: controller.signal }),
      fetch(MILESTONES_URL, { headers, signal: controller.signal }),
    ]);
    if (!res.ok || !msRes.ok) {
      const status = !res.ok ? res.status : msRes.status;
      console.warn(`roadmap: GitHub API returned ${status}; falling back to snapshot.`);
      return readSnapshot();
    }
    const raw = await res.json();
    const milestones = await msRes.json();
    const issues = Array.isArray(raw) ? raw.filter((i: any) => i && !i.pull_request) : [];

    // One blocked_by lookup per issue, in parallel.
    let edgeError = false;
    const withEdges = await Promise.all(
      issues.map(async (issue: any) => {
        try {
          const r = await fetch(blockedByUrl(issue.number), { headers, signal: controller.signal });
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          const blockers = await r.json();
          const blockedBy = Array.isArray(blockers)
            ? blockers.map((b: any) => b?.number).filter((n: unknown) => Number.isInteger(n))
            : [];
          return { ...issue, blockedBy };
        } catch {
          edgeError = true;
          return { ...issue, blockedBy: [] };
        }
      }),
    );

    // A partial edge fetch would draw a misleading graph, prefer the last good snapshot.
    if (edgeError) {
      console.warn(
        "roadmap: some dependency lookups failed (rate limit?); falling back to snapshot for a consistent graph.",
      );
      return readSnapshot();
    }

    const roadmap = roadmapFromApi(withEdges, milestones);
    if (roadmap.stations.length === 0) {
      console.warn("roadmap: no roadmap issues found; falling back to snapshot.");
      return readSnapshot();
    }
    writeSnapshot(roadmap);
    return roadmap;
  } catch (err) {
    // A RoadmapError is a data problem (unscheduled issue): fail the build so it
    // gets fixed, rather than silently rendering a stale snapshot.
    if (err instanceof RoadmapError) throw err;
    console.warn(`roadmap: fetch failed (${(err as Error).message}); falling back to snapshot.`);
    return readSnapshot();
  } finally {
    clearTimeout(timer);
  }
}
