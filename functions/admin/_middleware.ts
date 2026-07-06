// Cloudflare Pages Functions middleware for /admin/*
//
// Guards the whole dashboard (the static /admin/ pages, /admin/world.geo.json, and the
// /admin/api/* functions) with HTTP Basic Auth, and logs access to the admin_access D1
// table so the owner can see when and roughly who has reached the endpoint. This runs
// before anything under /admin/, so no other file needs its own auth check.
//
// Brute-force defence: a per-IP, in-memory rate limiter caps failed password attempts
// (RL_MAX per RL_WINDOW_MS). Over the cap the request is rejected with 429 *before* the
// password is checked or anything is written to D1, so it throttles guessing and stops a
// flood of denied rows at the same time. This limiter is best-effort and per-isolate
// (Cloudflare runs many), so it is a backstop, not the authoritative control: pair it
// with an edge WAF rate-limiting rule on /admin/* (see README, admin setup). A successful
// sign-in from an IP clears that IP's counter, so the owner is never locked out by normal
// use.
//
// Setup: on the Pages project, add a **secret** ADMIN_PASSWORD (Settings -> Variables and
// Secrets), and optionally ADMIN_USER (defaults to "admin"). If ADMIN_PASSWORD is unset
// the endpoint fails closed (503), so a misconfiguration never leaves it open. For local
// `wrangler pages dev`, put ADMIN_PASSWORD in .dev.vars. (The plain `npm run dev` static
// server does not run middleware, so /admin/ is open there for convenience.)
//
// Logging policy: a successful dashboard open is logged as 'granted'; a wrong password on
// any /admin/* path is logged as 'denied'. Requests with no credentials are not logged
// (every legitimate first visit and every random bot starts that way), which keeps the
// audit trail meaningful and resistant to flooding.
//
// Type-checked and deployed by Cloudflare, not the site build, so it declares the few
// Workers types it needs (like functions/api/subscribe.ts and collect.ts).

interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  run(): Promise<unknown>;
}
interface D1Database {
  prepare(query: string): D1PreparedStatement;
}
interface Env {
  DB?: D1Database;
  ADMIN_USER?: string;
  ADMIN_PASSWORD?: string;
}
interface CfProperties {
  country?: string;
  region?: string;
  city?: string;
  asn?: number;
  asOrganization?: string;
}
type Context = {
  request: Request;
  env: Env;
  next: () => Promise<Response>;
};

const REALM = 'Logos analytics';

// ── Rate limiting (per-IP, in-memory, best-effort) ───────────────────────────
// Fixed window: an IP may fail auth RL_MAX times per RL_WINDOW_MS; further requests get
// 429 until the window rolls over. Held in module scope, so it persists across requests
// in the same Worker isolate but not across isolates or a cold start. RL_MAX_TRACKED
// bounds memory: if more distinct IPs than that pile up in one window (e.g. a distributed
// flood) the whole table is dropped rather than grown without limit. Tune the two knobs
// to taste; the edge WAF rule is the hard guarantee, this just makes guessing expensive.
const RL_MAX = 5;
const RL_WINDOW_MS = 60_000;
const RL_MAX_TRACKED = 100_000;

const failures = new Map<string, { count: number; resetAt: number }>();

/** Seconds the caller must wait if this IP is currently over the failure budget, else 0. */
function retryAfter(ip: string): number {
  const e = failures.get(ip);
  if (!e) return 0;
  const now = Date.now();
  if (now >= e.resetAt) {
    failures.delete(ip); // lazily drop expired windows on read
    return 0;
  }
  return e.count >= RL_MAX ? Math.ceil((e.resetAt - now) / 1000) : 0;
}

/** Count one failed attempt against this IP, starting a fresh window if needed. */
function recordFailure(ip: string): void {
  const now = Date.now();
  let e = failures.get(ip);
  if (!e || now >= e.resetAt) {
    if (failures.size >= RL_MAX_TRACKED) failures.clear();
    e = { count: 0, resetAt: now + RL_WINDOW_MS };
    failures.set(ip, e);
  }
  e.count++;
}

/** A correct password clears the IP's failure counter, so the owner is never locked out. */
function clearFailures(ip: string): void {
  failures.delete(ip);
}

function unauthorized(): Response {
  return new Response('Authentication required.', {
    status: 401,
    headers: { 'WWW-Authenticate': `Basic realm="${REALM}", charset="UTF-8"` },
  });
}

function tooManyRequests(retrySeconds: number): Response {
  return new Response('Too many attempts. Try again later.', {
    status: 429,
    headers: { 'Retry-After': String(retrySeconds) },
  });
}

/** Length-independent compare, to avoid leaking the password via response timing. */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function decodeBasic(header: string | null): { user: string; pass: string } | null {
  if (!header || !header.startsWith('Basic ')) return null;
  try {
    const decoded = atob(header.slice(6));
    const i = decoded.indexOf(':');
    if (i < 0) return null;
    return { user: decoded.slice(0, i), pass: decoded.slice(i + 1) };
  } catch {
    return null;
  }
}

/** Coarse device/browser/OS from a User-Agent (mirrors functions/api/collect.ts). */
function parseUA(ua: string): { device: string; browser: string; os: string } {
  const s = ua || '';
  let os = 'Other';
  if (/Windows NT/i.test(s)) os = 'Windows';
  else if (/iPhone|iPad|iPod/i.test(s)) os = 'iOS';
  else if (/Mac OS X/i.test(s)) os = 'macOS';
  else if (/Android/i.test(s)) os = 'Android';
  else if (/CrOS/i.test(s)) os = 'ChromeOS';
  else if (/Linux/i.test(s)) os = 'Linux';

  let browser = 'Other';
  if (/Edg\//i.test(s)) browser = 'Edge';
  else if (/OPR\/|Opera/i.test(s)) browser = 'Opera';
  else if (/Firefox\//i.test(s)) browser = 'Firefox';
  else if (/Chrome\//i.test(s)) browser = 'Chrome';
  else if (/Safari\//i.test(s)) browser = 'Safari';

  let device = 'Desktop';
  if (/iPad|Tablet/i.test(s) || (/Android/i.test(s) && !/Mobile/i.test(s))) device = 'Tablet';
  else if (/Mobi|iPhone|iPod/i.test(s)) device = 'Mobile';

  return { device, browser, os };
}

async function logAccess(env: Env, request: Request, outcome: string, path: string): Promise<void> {
  if (!env.DB) return;
  const cf = (request as unknown as { cf?: CfProperties }).cf ?? {};
  const ua = request.headers.get('user-agent') ?? '';
  const d = parseUA(ua);
  const ip = request.headers.get('cf-connecting-ip') ?? '';
  try {
    await env.DB.prepare(
      `INSERT INTO admin_access
         (ts, outcome, path, ip, country, region, city, asn, asorg, device, browser, os, ua)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    )
      .bind(
        Date.now(),
        outcome,
        path.slice(0, 512),
        ip.slice(0, 64),
        cf.country ?? null,
        cf.region ?? null,
        cf.city ?? null,
        typeof cf.asn === 'number' ? cf.asn : null,
        cf.asOrganization ?? null,
        d.device,
        d.browser,
        d.os,
        ua.slice(0, 512),
      )
      .run();
  } catch {
    // Logging must never break the gate.
  }
}

export async function onRequest(context: Context): Promise<Response> {
  const { request, env, next } = context;
  const path = new URL(request.url).pathname;

  // Fail closed: with no password configured, the dashboard is unreachable, not open.
  if (!env.ADMIN_PASSWORD) {
    return new Response('Admin access is not configured.', { status: 503 });
  }

  const ip = request.headers.get('cf-connecting-ip') ?? '';

  // Brute-force gate: once an IP is over its failure budget, reject up front, before the
  // password check and before any D1 write, so guessing is throttled and the audit log
  // can't be flooded with denied rows.
  const wait = retryAfter(ip);
  if (wait > 0) return tooManyRequests(wait);

  const creds = decodeBasic(request.headers.get('authorization'));
  // No credentials at all: prompt, and do not log (avoids logging every first visit / bot).
  if (!creds) return unauthorized();

  const user = env.ADMIN_USER || 'admin';
  const ok = safeEqual(creds.user, user) && safeEqual(creds.pass, env.ADMIN_PASSWORD);
  if (!ok) {
    recordFailure(ip);
    await logAccess(env, request, 'denied', path);
    return unauthorized();
  }

  clearFailures(ip);

  // Log the successful open once per page navigation (any tab's HTML shell). The
  // /admin/api/* and /admin/world.geo.json fetches carry Accept: */*, so they're excluded.
  if ((request.headers.get('accept') ?? '').includes('text/html')) {
    await logAccess(env, request, 'granted', path);
  }
  return next();
}
