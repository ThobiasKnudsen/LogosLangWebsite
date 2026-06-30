// Build-time fetch of LogosLang's roadmap issues, shaped into the browser-safe
// model in roadmap.ts. Node-only (uses process.env / fs); imported by build.ts.
//
// Unlike releases (where an empty fetch is a valid "no builds yet" state), an empty
// or failed roadmap fetch must NOT blank the page. So every successful fetch writes
// content/roadmap.snapshot.json, and any failure falls back to that last-known-good
// snapshot. Escape hatches for local/offline work:
//   SKIP_ROADMAP_FETCH=1      -> skip the network, render from the committed snapshot
//   LOGOS_ROADMAP_JSON=path   -> read the GitHub Issues API JSON from a file instead
//   GITHUB_TOKEN=...          -> authenticated request (higher rate limit)

import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { roadmapFromApi, isStationArray, type Station } from "./roadmap.ts";

const REPO = "ThobiasKnudsen/LogosLang";
const API_URL = `https://api.github.com/repos/${REPO}/issues?state=all&labels=roadmap&per_page=100`;
const TIMEOUT_MS = 6000;

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SNAPSHOT_PATH = path.join(ROOT, "content/roadmap.snapshot.json");

/** Last-known-good stations committed to the repo; [] if missing or malformed. */
function readSnapshot(): Station[] {
  try {
    const parsed = JSON.parse(readFileSync(SNAPSHOT_PATH, "utf8"));
    if (isStationArray(parsed)) return parsed;
    console.warn("roadmap: snapshot is malformed; ignoring it.");
  } catch {
    /* no snapshot yet */
  }
  return [];
}

function writeSnapshot(stations: Station[]): void {
  try {
    writeFileSync(SNAPSHOT_PATH, `${JSON.stringify(stations, null, 2)}\n`);
  } catch (err) {
    console.warn(`roadmap: could not write snapshot (${(err as Error).message}).`);
  }
}

export async function fetchRoadmap(): Promise<Station[]> {
  if (process.env.SKIP_ROADMAP_FETCH === "1") return readSnapshot();

  if (process.env.LOGOS_ROADMAP_JSON) {
    try {
      return roadmapFromApi(
        JSON.parse(readFileSync(process.env.LOGOS_ROADMAP_JSON, "utf8")),
      );
    } catch (err) {
      console.warn(
        `roadmap: could not read LOGOS_ROADMAP_JSON (${(err as Error).message}); using snapshot.`,
      );
      return readSnapshot();
    }
  }

  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "logoslang-website-build",
  };
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(API_URL, { headers, signal: controller.signal });
    if (!res.ok) {
      console.warn(
        `roadmap: GitHub API returned ${res.status}; falling back to snapshot.`,
      );
      return readSnapshot();
    }
    const stations = roadmapFromApi(await res.json());
    if (stations.length === 0) {
      console.warn("roadmap: no roadmap issues found; falling back to snapshot.");
      return readSnapshot();
    }
    writeSnapshot(stations);
    return stations;
  } catch (err) {
    console.warn(
      `roadmap: fetch failed (${(err as Error).message}); falling back to snapshot.`,
    );
    return readSnapshot();
  } finally {
    clearTimeout(timer);
  }
}
