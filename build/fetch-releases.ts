// Build-time fetch of LogosLang's GitHub Releases, shaped into the browser-safe
// model in releases.ts. Node-only (uses process.env / fs); imported by build.ts.
//
// The build must never fail because GitHub is slow, rate-limited, or offline: a
// failed fetch just yields an empty list, and the download page renders its
// "no builds yet" state. Escape hatches for local/offline work:
//   SKIP_RELEASES_FETCH=1     -> always [] (fast offline builds)
//   LOGOS_RELEASES_JSON=path  -> read the GitHub API JSON from a file instead
//   GITHUB_TOKEN=...          -> authenticated request (higher rate limit)

import { readFileSync } from 'node:fs';
import { releasesFromApi, type Release } from './releases.ts';

const REPO = 'ThobiasKnudsen/LogosLang';
const API_URL = `https://api.github.com/repos/${REPO}/releases?per_page=100`;
const TIMEOUT_MS = 6000;

export async function fetchReleases(): Promise<Release[]> {
	if (process.env.SKIP_RELEASES_FETCH === '1') return [];

	if (process.env.LOGOS_RELEASES_JSON) {
		try {
			return releasesFromApi(JSON.parse(readFileSync(process.env.LOGOS_RELEASES_JSON, 'utf8')));
		} catch (err) {
			console.warn(`releases: could not read LOGOS_RELEASES_JSON (${(err as Error).message}); using none.`);
			return [];
		}
	}

	const headers: Record<string, string> = {
		Accept: 'application/vnd.github+json',
		'X-GitHub-Api-Version': '2022-11-28',
		'User-Agent': 'logoslang-website-build',
	};
	if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;

	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
	try {
		const res = await fetch(API_URL, { headers, signal: controller.signal });
		if (!res.ok) {
			console.warn(`releases: GitHub API returned ${res.status}; download page will show "no builds yet".`);
			return [];
		}
		return releasesFromApi(await res.json());
	} catch (err) {
		console.warn(`releases: fetch failed (${(err as Error).message}); download page will show "no builds yet".`);
		return [];
	} finally {
		clearTimeout(timer);
	}
}
