// Release model shared by the build (bakes the data) and the client (re-renders on
// version/arch change). MUST stay browser-safe: no node imports, so esbuild can
// bundle the pure helpers into client/main.ts. The build-time network fetch lives
// in fetch-releases.ts.
//
// Asset naming convention (the contract between LogosLang's release workflow and
// this download page):
//
//     logos-<version>-<os>-<arch>.<ext>
//
//   <version> = the tag, with leading v, e.g. v0.0.3
//   <os>      = macos | linux | windows
//   <arch>    = x86_64 | aarch64
//   <ext>     = tar.gz (macos, linux) | zip (windows)
//
// Assets that do not match are ignored, so release notes, checksums, etc. are safe
// to attach alongside.

import { parseVersionString, compareVersions } from './version.ts';

export type Os = 'macos' | 'linux' | 'windows';
export type Arch = 'x86_64' | 'aarch64';

export interface Asset {
	os: Os;
	arch: Arch;
	ext: string; // 'tar.gz' | 'zip'
	name: string;
	url: string;
	size: number;
}

/** The OS/arch-agnostic WebAssembly build that powers the in-browser playground. */
export interface WasmAsset {
	name: string;
	url: string;
	size: number;
}

export interface Release {
	/** Tag with leading v, e.g. "v0.0.3". */
	version: string;
	/** Release title (falls back to the tag). */
	name: string;
	/** ISO date string, or null. */
	publishedAt: string | null;
	prerelease: boolean;
	assets: Asset[];
	/** The `logos-<version>-wasm.wasm` build, if this release ships one. */
	wasm: WasmAsset | null;
}

export const OS_ORDER: Os[] = ['macos', 'linux', 'windows'];
export const ARCH_ORDER: Arch[] = ['x86_64', 'aarch64'];

export const OS_LABELS: Record<Os, string> = {
	macos: 'macOS',
	linux: 'Linux',
	windows: 'Windows',
};

export const ARCH_LABELS: Record<Arch, string> = {
	x86_64: 'x86-64 (Intel/AMD)',
	aarch64: 'ARM64 (Apple Silicon / ARM)',
};

const ASSET_RE = /^logos-(v\d+\.\d+\.\d+)-(macos|linux|windows)-(x86_64|aarch64)\.(tar\.gz|zip)$/;
const WASM_ASSET_RE = /^logos-(v\d+\.\d+\.\d+)-wasm\.wasm$/;

export function parseAssetName(name: string): { version: string; os: Os; arch: Arch; ext: string } | null {
	const m = ASSET_RE.exec(name);
	if (!m) return null;
	return { version: m[1]!, os: m[2] as Os, arch: m[3] as Arch, ext: m[4]! };
}

export function parseWasmAssetName(name: string): { version: string } | null {
	const m = WASM_ASSET_RE.exec(name);
	return m ? { version: m[1]! } : null;
}

/** Compare tag strings like "v0.1.0" descending-friendly (returns a<b<0). */
export function compareTags(a: string, b: string): number {
	return compareVersions(parseVersionString(a.replace(/^v/, '')), parseVersionString(b.replace(/^v/, '')));
}

/**
 * Shape the raw GitHub Releases API JSON into our model: drop drafts, keep only
 * convention-matching assets, sort releases newest-first and each release's assets
 * by OS then arch. Pure; unit-tested without network.
 */
export function releasesFromApi(apiReleases: unknown): Release[] {
	if (!Array.isArray(apiReleases)) return [];
	const out: Release[] = [];
	for (const r of apiReleases as any[]) {
		if (!r || r.draft || typeof r.tag_name !== 'string') continue;
		if (!/^v\d+\.\d+\.\d+$/.test(r.tag_name)) continue;
		const assets: Asset[] = [];
		let wasm: WasmAsset | null = null;
		for (const a of Array.isArray(r.assets) ? r.assets : []) {
			const name = a?.name ?? '';
			const w = parseWasmAssetName(name);
			if (w) {
				if (w.version === r.tag_name) {
					wasm = { name, url: a.browser_download_url, size: typeof a.size === 'number' ? a.size : 0 };
				}
				continue;
			}
			const parsed = parseAssetName(name);
			if (!parsed || parsed.version !== r.tag_name) continue;
			assets.push({
				os: parsed.os,
				arch: parsed.arch,
				ext: parsed.ext,
				name: a.name,
				url: a.browser_download_url,
				size: typeof a.size === 'number' ? a.size : 0,
			});
		}
		assets.sort(
			(x, y) =>
				OS_ORDER.indexOf(x.os) - OS_ORDER.indexOf(y.os) ||
				ARCH_ORDER.indexOf(x.arch) - ARCH_ORDER.indexOf(y.arch)
		);
		out.push({
			version: r.tag_name,
			name: typeof r.name === 'string' && r.name ? r.name : r.tag_name,
			publishedAt: typeof r.published_at === 'string' ? r.published_at : null,
			prerelease: !!r.prerelease,
			assets,
			wasm,
		});
	}
	out.sort((a, b) => compareTags(b.version, a.version));
	return out;
}

/** Assets for one OS within a release, sorted by arch. */
export function assetsForOs(release: Release, os: Os): Asset[] {
	return release.assets.filter((a) => a.os === os);
}

/** A copy-paste terminal one-liner that downloads and unpacks the asset. */
export function installCommand(asset: Asset): string {
	if (asset.os === 'windows') {
		return `irm ${asset.url} -OutFile logos.zip; Expand-Archive logos.zip -DestinationPath logos`;
	}
	return `curl -fsSL ${asset.url} -o logos.tar.gz && tar -xzf logos.tar.gz`;
}

/** Short label for a download button, e.g. ".tar.gz · ARM64 (Apple Silicon / ARM)". */
export function assetLabel(asset: Asset): string {
	return `.${asset.ext} · ${ARCH_LABELS[asset.arch]}`;
}

/** Releases that ship a WebAssembly build, i.e. are runnable in the playground. */
export function releasesWithWasm(releases: Release[]): Release[] {
	return releases.filter((r) => r.wasm !== null);
}
