// Cloudflare Pages root middleware: canonical host, bot policy, and server-side traffic
// capture for ALL requests.
//
// The client analytics beacon (client/main.ts -> /api/collect) only ever sees real
// browsers that run JavaScript, so bots, crawlers, and AI fetchers (GPTBot, ClaudeBot,
// PerplexityBot, ...) are completely invisible to it. This middleware runs at the edge on
// every request and appends one row to the `requests` D1 table for each *page* response
// (Content-Type text/html), tagged bot vs human, so the dashboard can show absolutely all
// traffic with a bot filter. It runs before functions/admin/_middleware.ts in the chain
// but never touches auth; it only observes the response and logs.
//
// It also enforces two things the Cloudflare dashboard cannot on this plan:
//
//  1. One canonical hostname. Cloudflare's WAF, rate limiting and bot settings are scoped
//     to the logoslang.dev zone, so the production `*.pages.dev` alias serves the identical
//     site with none of them applied, and splits search ranking across two origins. It is
//     redirected here; preview deployments keep their own host but are marked noindex.
//  2. A bot policy, applied by kind (see BotKind). Blocking runs in code rather than in a
//     WAF rule because the free plan's rule budget is small, its `matches` regex operator
//     is Business+, and Bot Fight Mode cannot be scoped at all: it JS-challenges anything
//     that does not run JavaScript, which is exactly what the AI search crawlers behind
//     LLM answers are. Doing it here also covers the `*.pages.dev` hosts, which sit outside
//     the zone entirely, and keeps refused requests visible in /admin/.
//
// It logs nothing for /admin/* (its own dashboard, gated + rendered separately) and only
// for HTML responses, which naturally excludes /assets/*, /api/* (JSON/204), and static
// files. The write goes through waitUntil so it never delays the page, and every failure
// is swallowed so analytics can never break a request.
//
// Privacy: same stance as functions/api/collect.ts and the /privacy/ page. No raw IP and
// no raw User-Agent are stored; geo is Cloudflare's edge geolocation (request.cf) and the
// UA is reduced to coarse device/browser/os plus a bot label. There is deliberately no
// visitor/session id (a server request can't read the browser's localStorage); the
// dashboard follows these clients across visits by fingerprinting the columns already
// written here, so nothing extra needs collecting (functions/admin/api/stats.ts).
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

// What a bot is *for*. This is the whole bot policy: logoslang.dev wants the widest reach
// it can get, so every kind that can put a human in front of the language is welcome, and
// only the two kinds that take without giving anything back are refused.
type BotKind =
  | "search" // classic search index: Googlebot, bingbot, ...
  | "ai-search" // builds the retrieval index behind LLM answers: OAI-SearchBot, ...
  | "ai-assistant" // fetches a page because a human just asked an assistant to
  | "ai-training" // builds training corpora: how someone hears about LogosLang unprompted
  | "social" // link-preview unfurlers; blocking these makes every shared URL a bare link
  | "monitor" // uptime checks, Lighthouse, and our own Playwright runs
  | "scraper" // SEO backlink databases and data resellers: extract, never send anyone back
  | "tool"; // bare HTTP clients and scripting libraries

/** The kinds that get a 403. Everything else is let through untouched. */
const BLOCKED_KINDS: ReadonlySet<BotKind> = new Set<BotKind>(["scraper", "tool"]);

// Named bots first (so the label is precise), longest/most-specific patterns leading.
const BOT_NAMES: [RegExp, string, BotKind][] = [
  [/GPTBot/i, "GPTBot", "ai-training"],
  [/ChatGPT-User/i, "ChatGPT-User", "ai-assistant"],
  [/OAI-SearchBot/i, "OAI-SearchBot", "ai-search"],
  [/ClaudeBot/i, "ClaudeBot", "ai-training"],
  [/Claude-User/i, "Claude-User", "ai-assistant"],
  [/Claude-Web/i, "Claude-Web", "ai-assistant"],
  [/anthropic-ai/i, "Anthropic", "ai-training"],
  [/PerplexityBot/i, "PerplexityBot", "ai-search"],
  [/Perplexity-User/i, "Perplexity-User", "ai-assistant"],
  [/Google-Extended/i, "Google-Extended", "ai-training"],
  [/AdsBot-Google/i, "AdsBot-Google", "search"],
  [/Storebot-Google/i, "Storebot-Google", "search"],
  [/Googlebot/i, "Googlebot", "search"],
  [/bingbot/i, "bingbot", "search"],
  [/BingPreview/i, "BingPreview", "search"],
  [/DuckAssistBot/i, "DuckAssistBot", "ai-search"],
  [/DuckDuckBot/i, "DuckDuckBot", "search"],
  [/Baiduspider/i, "Baiduspider", "search"],
  [/YandexBot/i, "YandexBot", "search"],
  [/Sogou/i, "Sogou", "search"],
  [/Applebot/i, "Applebot", "search"],
  [/CCBot/i, "CCBot", "ai-training"],
  [/Bytespider/i, "Bytespider", "ai-training"],
  [/Amazonbot/i, "Amazonbot", "ai-search"],
  [/Meta-ExternalAgent/i, "Meta-ExternalAgent", "ai-training"],
  [/facebookexternalhit/i, "facebookexternalhit", "social"],
  [/FacebookBot/i, "FacebookBot", "ai-training"],
  [/cohere-ai/i, "cohere-ai", "ai-training"],
  [/Diffbot/i, "Diffbot", "scraper"],
  [/ImagesiftBot/i, "ImagesiftBot", "scraper"],
  [/YouBot/i, "YouBot", "ai-search"],
  [/PetalBot/i, "PetalBot", "search"],
  [/AhrefsBot/i, "AhrefsBot", "scraper"],
  [/SemrushBot/i, "SemrushBot", "scraper"],
  [/DotBot/i, "DotBot", "scraper"],
  [/MJ12bot/i, "MJ12bot", "scraper"],
  [/DataForSeoBot/i, "DataForSeoBot", "scraper"],
  [/Slurp/i, "Yahoo Slurp", "search"],
  [/Twitterbot/i, "Twitterbot", "social"],
  [/LinkedInBot/i, "LinkedInBot", "social"],
  [/Slackbot/i, "Slackbot", "social"],
  [/Discordbot/i, "Discordbot", "social"],
  [/TelegramBot/i, "TelegramBot", "social"],
  [/WhatsApp/i, "WhatsApp", "social"],
  [/UptimeRobot/i, "UptimeRobot", "monitor"],
  [/Pingdom/i, "Pingdom", "monitor"],
  [/HeadlessChrome/i, "HeadlessChrome", "monitor"],
  [/Lighthouse/i, "Lighthouse", "monitor"],
  [/curl\//i, "curl", "tool"],
  [/wget/i, "wget", "tool"],
  [/python-requests/i, "python-requests", "tool"],
  [/python-httpx|httpx/i, "httpx", "tool"],
  [/aiohttp/i, "aiohttp", "tool"],
  [/Go-http-client/i, "Go-http-client", "tool"],
  [/okhttp/i, "okhttp", "tool"],
  [/node-fetch/i, "node-fetch", "tool"],
  [/axios/i, "axios", "tool"],
  [/Scrapy/i, "Scrapy", "tool"],
  [/libwww-perl/i, "libwww-perl", "tool"],
  [/Java\//i, "Java", "tool"],
];
// Catch-all markers for unnamed automation.
const GENERIC_BOT = /bot\b|crawler|spider|crawl|slurp|scraper|headless|monitor|scan|fetch\b/i;

type Detection = { bot: number; name: string | null; block: boolean };

/** Classify a request as bot or human from its User-Agent (plus Cloudflare's own signal). */
function detectBot(ua: string, cf: CfProperties): Detection {
  for (const [re, name, kind] of BOT_NAMES) {
    if (re.test(ua)) return { bot: 1, name, block: BLOCKED_KINDS.has(kind) };
  }
  // A Cloudflare-verified crawler we have no name for is still a real crawler, and this is
  // checked before GENERIC_BOT on purpose: without it, tomorrow's search engine gets swept
  // into the unnamed-automation bucket below and refused purely for having "bot" in its UA.
  const verified = str(cf.verifiedBotCategory, 48);
  if (verified) return { bot: 1, name: verified, block: false };
  // Unnamed, unverified automation. Nothing here identifies itself as anything that could
  // send a reader back, so it is treated like the scraper/tool tier.
  if (!ua.trim()) return { bot: 1, name: "No UA", block: true };
  if (GENERIC_BOT.test(ua)) return { bot: 1, name: "Bot", block: true };
  return { bot: 0, name: null, block: false };
}

/** Log page views only: a GET that produced an HTML response, never the admin dashboard. */
function shouldLog(request: Request, res: Response): boolean {
  if (request.method !== "GET") return false;
  const path = new URL(request.url).pathname;
  if (path === "/admin" || path.startsWith("/admin/")) return false;
  const ct = res.headers.get("content-type") ?? "";
  return ct.includes("text/html");
}

async function record(
  db: D1Database,
  request: Request,
  status: number,
  b: Detection,
): Promise<void> {
  const cf = (request as unknown as { cf?: CfProperties }).cf ?? {};
  const url = new URL(request.url);
  const ua = request.headers.get("user-agent") ?? "";
  const d = parseUA(ua);
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

/** The one hostname the site is meant to be read on. */
const CANONICAL_HOST = "logoslang.dev";

/**
 * True for the production alias `<project>.pages.dev`, false for a preview deployment
 * `<hash>.<project>.pages.dev`. Previews must keep working on their own host, so only the
 * production alias (which duplicates logoslang.dev exactly) is redirected away.
 */
function isProductionPagesDev(host: string): boolean {
  return host.endsWith(".pages.dev") && host.split(".").length === 3;
}

/** Refusal for a blocked bot: no HTML to parse, nothing to cache, cheap to send. */
function forbidden(): Response {
  return new Response("Forbidden\n", {
    status: 403,
    headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" },
  });
}

/**
 * Preview deployments serve the whole site on a host that cannot be redirected without
 * making previews useless, so keep them out of the index instead: otherwise every preview
 * competes with logoslang.dev for the same queries.
 */
function noIndexPreview(res: Response, host: string): Response {
  if (!host.endsWith(".pages.dev")) return res;
  const out = new Response(res.body, res);
  out.headers.set("x-robots-tag", "noindex, nofollow");
  return out;
}

export async function onRequest(context: Context): Promise<Response> {
  const { request, env, next } = context;
  const url = new URL(request.url);

  if (isProductionPagesDev(url.hostname)) {
    url.hostname = CANONICAL_HOST;
    url.protocol = "https:"; // land on the final URL in one hop, never http -> https -> page
    return Response.redirect(url.toString(), 301);
  }

  const cf = (request as unknown as { cf?: CfProperties }).cf ?? {};
  const b = detectBot(request.headers.get("user-agent") ?? "", cf);

  // Refused before next(), so a blocked crawler never costs an asset fetch. Unlike the
  // page-view logging below this records every path it touched, including /admin/ probes
  // and asset URLs, because for a refused client that trail is the only thing worth having.
  if (b.block) {
    if (env.DB) context.waitUntil(record(env.DB, request, 403, b).catch(() => {}));
    return forbidden();
  }

  const res = await next();
  if (env.DB && shouldLog(request, res)) {
    // Fire-and-forget: never delay the page, never surface a logging error.
    context.waitUntil(record(env.DB, request, res.status, b).catch(() => {}));
  }
  return noIndexPreview(res, url.hostname);
}
