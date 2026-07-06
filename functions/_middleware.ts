// Cloudflare Pages root middleware: server-side traffic capture for ALL requests.
//
// The client analytics beacon (client/main.ts -> /api/collect) only ever sees real
// browsers that run JavaScript, so bots, crawlers, and AI fetchers (GPTBot, ClaudeBot,
// PerplexityBot, ...) are completely invisible to it. This middleware runs at the edge on
// every request and appends one row to the `requests` D1 table for each *page* response
// (Content-Type text/html), tagged bot vs human, so the dashboard can show absolutely all
// traffic with a bot filter. It runs before functions/admin/_middleware.ts in the chain
// but never touches auth; it only observes the response and logs.
//
// It logs nothing for /admin/* (its own dashboard, gated + rendered separately) and only
// for HTML responses, which naturally excludes /assets/*, /api/* (JSON/204), and static
// files. The write goes through waitUntil so it never delays the page, and every failure
// is swallowed so analytics can never break a request.
//
// Privacy: same stance as functions/api/collect.ts and the /privacy/ page. No raw IP and
// no raw User-Agent are stored; geo is Cloudflare's edge geolocation (request.cf) and the
// UA is reduced to coarse device/browser/os plus a bot label. There is deliberately no
// visitor/session id (a server request can't read the browser's localStorage).
//
// Setup: apply db/schema.sql (creates `requests`) and bind D1 as DB on the Pages project.
// Until the binding exists this logs nothing and passes every request through unchanged.
//
// Type-checked and deployed by Cloudflare, not the site build, so it declares the few
// Workers types it needs (matching functions/api/collect.ts and functions/admin/*).

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
interface CfProperties {
  country?: string;
  region?: string;
  city?: string;
  latitude?: string;
  longitude?: string;
  asn?: number;
  asOrganization?: string;
  verifiedBotCategory?: string;
}
type Context = {
  request: Request;
  env: Env;
  next: () => Promise<Response>;
  waitUntil: (promise: Promise<unknown>) => void;
};

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

/** Coarse device / browser / OS labels from a User-Agent. Mirrors collect.ts. */
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

// Named bots first (so the label is precise), longest/most-specific patterns leading.
const BOT_NAMES: [RegExp, string][] = [
  [/GPTBot/i, "GPTBot"],
  [/ChatGPT-User/i, "ChatGPT-User"],
  [/OAI-SearchBot/i, "OAI-SearchBot"],
  [/ClaudeBot/i, "ClaudeBot"],
  [/Claude-User/i, "Claude-User"],
  [/Claude-Web/i, "Claude-Web"],
  [/anthropic-ai/i, "Anthropic"],
  [/PerplexityBot/i, "PerplexityBot"],
  [/Perplexity-User/i, "Perplexity-User"],
  [/Google-Extended/i, "Google-Extended"],
  [/AdsBot-Google/i, "AdsBot-Google"],
  [/Storebot-Google/i, "Storebot-Google"],
  [/Googlebot/i, "Googlebot"],
  [/bingbot/i, "bingbot"],
  [/BingPreview/i, "BingPreview"],
  [/DuckAssistBot/i, "DuckAssistBot"],
  [/DuckDuckBot/i, "DuckDuckBot"],
  [/Baiduspider/i, "Baiduspider"],
  [/YandexBot/i, "YandexBot"],
  [/Sogou/i, "Sogou"],
  [/Applebot/i, "Applebot"],
  [/CCBot/i, "CCBot"],
  [/Bytespider/i, "Bytespider"],
  [/Amazonbot/i, "Amazonbot"],
  [/Meta-ExternalAgent/i, "Meta-ExternalAgent"],
  [/facebookexternalhit/i, "facebookexternalhit"],
  [/FacebookBot/i, "FacebookBot"],
  [/cohere-ai/i, "cohere-ai"],
  [/Diffbot/i, "Diffbot"],
  [/ImagesiftBot/i, "ImagesiftBot"],
  [/YouBot/i, "YouBot"],
  [/PetalBot/i, "PetalBot"],
  [/AhrefsBot/i, "AhrefsBot"],
  [/SemrushBot/i, "SemrushBot"],
  [/DotBot/i, "DotBot"],
  [/MJ12bot/i, "MJ12bot"],
  [/DataForSeoBot/i, "DataForSeoBot"],
  [/Slurp/i, "Yahoo Slurp"],
  [/Twitterbot/i, "Twitterbot"],
  [/LinkedInBot/i, "LinkedInBot"],
  [/Slackbot/i, "Slackbot"],
  [/Discordbot/i, "Discordbot"],
  [/TelegramBot/i, "TelegramBot"],
  [/WhatsApp/i, "WhatsApp"],
  [/UptimeRobot/i, "UptimeRobot"],
  [/Pingdom/i, "Pingdom"],
  [/HeadlessChrome/i, "HeadlessChrome"],
  [/Lighthouse/i, "Lighthouse"],
  [/curl\//i, "curl"],
  [/wget/i, "wget"],
  [/python-requests/i, "python-requests"],
  [/python-httpx|httpx/i, "httpx"],
  [/aiohttp/i, "aiohttp"],
  [/Go-http-client/i, "Go-http-client"],
  [/okhttp/i, "okhttp"],
  [/node-fetch/i, "node-fetch"],
  [/axios/i, "axios"],
  [/Scrapy/i, "Scrapy"],
  [/libwww-perl/i, "libwww-perl"],
  [/Java\//i, "Java"],
];
// Catch-all markers for unnamed automation.
const GENERIC_BOT = /bot\b|crawler|spider|crawl|slurp|scraper|headless|monitor|scan|fetch\b/i;

/** Classify a request as bot or human from its User-Agent (plus Cloudflare's own signal). */
function detectBot(ua: string, cf: CfProperties): { bot: number; name: string | null } {
  for (const [re, name] of BOT_NAMES) if (re.test(ua)) return { bot: 1, name };
  if (!ua.trim()) return { bot: 1, name: "No UA" };
  if (GENERIC_BOT.test(ua)) return { bot: 1, name: "Bot" };
  const verified = str(cf.verifiedBotCategory, 48);
  if (verified) return { bot: 1, name: verified };
  return { bot: 0, name: null };
}

/** Log page views only: a GET that produced an HTML response, never the admin dashboard. */
function shouldLog(request: Request, res: Response): boolean {
  if (request.method !== "GET") return false;
  const path = new URL(request.url).pathname;
  if (path === "/admin" || path.startsWith("/admin/")) return false;
  const ct = res.headers.get("content-type") ?? "";
  return ct.includes("text/html");
}

async function record(db: D1Database, request: Request, status: number): Promise<void> {
  const cf = (request as unknown as { cf?: CfProperties }).cf ?? {};
  const url = new URL(request.url);
  const ua = request.headers.get("user-agent") ?? "";
  const d = parseUA(ua);
  const b = detectBot(ua, cf);
  const lang = (request.headers.get("accept-language") ?? "").split(",")[0] || null;

  await db
    .prepare(
      `INSERT INTO requests
         (ts, method, path, status, bot, bot_name, ref,
          country, region, city, lat, lon, asn, asorg, device, browser, os, lang)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    )
    .bind(
      Date.now(),
      request.method,
      url.pathname.slice(0, 512),
      status,
      b.bot,
      b.name,
      refHost(request.headers.get("referer"), url.host),
      str(cf.country, 8),
      str(cf.region, 64),
      str(cf.city, 96),
      num(cf.latitude),
      num(cf.longitude),
      typeof cf.asn === "number" ? cf.asn : null,
      str(cf.asOrganization, 96),
      d.device,
      d.browser,
      d.os,
      str(lang, 16),
    )
    .run();
}

export async function onRequest(context: Context): Promise<Response> {
  const { request, env, next } = context;
  const res = await next();
  if (env.DB && shouldLog(request, res)) {
    // Fire-and-forget: never delay the page, never surface a logging error.
    context.waitUntil(record(env.DB, request, res.status).catch(() => {}));
  }
  return res;
}
