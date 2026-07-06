// Cloudflare Pages Function: POST /api/collect
//
// Cookieless, first-party analytics ingest. The client beacon (initAnalytics in
// client/main.ts) posts small JSON events here via navigator.sendBeacon; this function
// enriches each with Cloudflare's edge geolocation (request.cf) and a coarse device
// label parsed from the User-Agent, then appends one row to the D1 database bound as
// DB. See db/schema.sql for the shape and /privacy/ for what is (and isn't) stored.
//
// Deliberately NOT stored: the raw IP address and the raw User-Agent string. Geo is
// Cloudflare's IP-derived city centroid, not a real position.
//
// One-time setup: create a D1 database and bind it as DB on the Pages project
// (Settings -> Functions -> D1 database bindings), then apply db/schema.sql. Until the
// binding exists this function answers 204 and stores nothing, so the site works
// unchanged before analytics is wired up.
//
// Like functions/api/subscribe.ts, this is type-checked and deployed by Cloudflare, not
// by the site build, so it declares the few Workers types it needs instead of pulling
// in @cloudflare/workers-types.

interface D1Result {
  success: boolean;
}
interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  run(): Promise<D1Result>;
}
interface D1Database {
  prepare(query: string): D1PreparedStatement;
}
interface Env {
  DB?: D1Database;
}

// Cloudflare populates request.cf with edge geolocation for every request. Fields are
// strings/numbers; latitude/longitude arrive as strings. If any come back empty on your
// zone, enable the free "Add visitor location headers" Managed Transform and read the
// CF-IP* headers instead.
interface CfProperties {
  country?: string;
  region?: string;
  city?: string;
  postalCode?: string;
  latitude?: string;
  longitude?: string;
  timezone?: string;
  asn?: number;
  asOrganization?: string;
}

const NO_CONTENT = new Response(null, { status: 204 });

/** Clamp a value to a trimmed string of at most `max` chars, or null if empty. */
function str(v: unknown, max: number): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  if (!s) return null;
  return s.length > max ? s.slice(0, max) : s;
}

/** A finite number from a string/number, or null. */
function num(v: unknown): number | null {
  const n = typeof v === "number" ? v : typeof v === "string" ? parseFloat(v) : NaN;
  return Number.isFinite(n) ? n : null;
}

/** Reject obvious cross-site posts: if an Origin header is present, its host must match. */
function sameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true; // some beacons omit Origin; caps + platform protections cover this
  try {
    return new URL(origin).host === new URL(request.url).host;
  } catch {
    return false;
  }
}

/** Coarse device / browser / OS labels from a User-Agent. Store these, not the raw UA. */
function parseUA(ua: string): { device: string; browser: string; os: string } {
  const s = ua || "";
  let os = "Other";
  if (/Windows NT/i.test(s)) os = "Windows";
  else if (/iPhone|iPad|iPod/i.test(s)) os = "iOS";
  else if (/Mac OS X/i.test(s)) os = "macOS";
  else if (/Android/i.test(s)) os = "Android";
  else if (/CrOS/i.test(s)) os = "ChromeOS";
  else if (/Linux/i.test(s)) os = "Linux";

  let browser = "Other";
  if (/Edg\//i.test(s)) browser = "Edge";
  else if (/OPR\/|Opera/i.test(s)) browser = "Opera";
  else if (/Firefox\//i.test(s)) browser = "Firefox";
  else if (/Chrome\//i.test(s)) browser = "Chrome";
  else if (/Safari\//i.test(s)) browser = "Safari";

  let device = "Desktop";
  if (/iPad|Tablet/i.test(s) || (/Android/i.test(s) && !/Mobile/i.test(s))) device = "Tablet";
  else if (/Mobi|iPhone|iPod/i.test(s)) device = "Mobile";

  return { device, browser, os };
}

/** External referrer host, or null for a direct hit or same-site navigation. */
function refHost(ref: string | null, siteHost: string): string | null {
  if (!ref) return null;
  try {
    const host = new URL(ref).host;
    return host && host !== siteHost ? host : null;
  } catch {
    return null;
  }
}

export async function onRequestPost(context: {
  request: Request;
  env: Env;
}): Promise<Response> {
  const { request, env } = context;

  // No binding yet, or a cross-site post: accept and drop (never error the beacon).
  if (!env.DB || !sameOrigin(request)) return NO_CONTENT;

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NO_CONTENT;
  }

  const visitor = str(body.vid, 64);
  const session = str(body.sid, 64);
  const type = body.type === "event" ? "event" : "pageview";
  const path = str(body.path, 512);
  // Identity + a path are the minimum; without them the row is meaningless.
  if (!visitor || !session || !path) return NO_CONTENT;

  const cf = (request as unknown as { cf?: CfProperties }).cf ?? {};
  const ua = parseUA(request.headers.get("user-agent") ?? "");
  const siteHost = new URL(request.url).host;

  const values = [
    Date.now(),
    visitor,
    session,
    type,
    str(body.name, 32),
    str(body.value, 256),
    path,
    str(body.title, 256),
    refHost(str(body.ref, 1024), siteHost),
    str(cf.country, 8),
    str(cf.region, 64),
    str(cf.city, 96),
    str(cf.postalCode, 16),
    num(cf.latitude),
    num(cf.longitude),
    str(cf.timezone, 64),
    typeof cf.asn === "number" ? cf.asn : null,
    str(cf.asOrganization, 96),
    ua.device,
    ua.browser,
    ua.os,
    str(body.lang, 16),
    (() => {
      const d = num(body.dur);
      return d === null ? null : Math.max(0, Math.round(d));
    })(),
  ];

  try {
    await env.DB.prepare(
      `INSERT INTO events
         (ts, visitor, session, type, name, value, path, title, ref,
          country, region, city, postal, lat, lon, tz, asn, asorg,
          device, browser, os, lang, dur)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    )
      .bind(...values)
      .run();
  } catch {
    // A storage hiccup must never surface as an error page to the beacon.
    return NO_CONTENT;
  }

  return NO_CONTENT;
}
