// Cloudflare Pages Function: GET /admin/api/stats
//
// Read side of the cookieless analytics: queries the D1 database bound as DB and backs
// the dashboard tabs (Map, Log, Users, Access) plus two drill-downs (one session, one
// visitor). Paired with client/dashboard.ts, which renders the JSON, and written by
// functions/api/collect.ts and functions/_middleware.ts. See db/schema.sql.
//
// SECURITY: everything under /admin/ is gated by functions/admin/_middleware.ts (HTTP
// Basic Auth), so this function assumes the caller is already authenticated and adds no
// auth of its own.
//
// Type-checked and deployed by Cloudflare, not the site build, so it declares the few
// Workers types it needs (matching functions/api/subscribe.ts and collect.ts).

interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  all<T = Record<string, unknown>>(): Promise<{ results: T[] }>;
  first<T = Record<string, unknown>>(): Promise<T | null>;
}
interface D1Database {
  prepare(query: string): D1PreparedStatement;
}
interface Env {
  DB?: D1Database;
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}

/** Clamp an integer query param to a range, falling back to `def`. */
function intParam(v: string | null, def: number, min: number, max: number): number {
  const n = v === null ? NaN : parseInt(v, 10);
  if (!Number.isFinite(n)) return def;
  return Math.min(max, Math.max(min, n));
}

export async function onRequestGet(context: { request: Request; env: Env }): Promise<Response> {
  const { request, env } = context;

  // Before the D1 binding exists, answer with empty shapes so the dashboard shows
  // "no data" instead of erroring.
  if (!env.DB) return json({ empty: true });

  // Any D1 error (most often a table db/schema.sql hasn't created yet, e.g. admin_access
  // or requests before the schema is re-applied) degrades to an empty result instead of a
  // 500, so the dashboard shows "no data" and stays usable rather than breaking the tab.
  try {
    return await respond(env.DB, request);
  } catch {
    return json({ empty: true });
  }
}

async function respond(db: D1Database, request: Request): Promise<Response> {
  const url = new URL(request.url);
  const q = url.searchParams;
  const now = Date.now();
  const to = intParam(q.get("to"), now, 0, now + 86_400_000);
  const from = intParam(q.get("from"), to - 7 * 86_400_000, 0, to);

  // Audience filter, shared by every view. Humans come from the `events` beacon, bots from
  // server-side `requests`. Default: humans on, bots off (a direct API call without params
  // behaves like before; the dashboard always sends both explicitly).
  const wantHumans = q.get("humans") !== "0";
  const wantBots = q.get("bots") === "1";

  // ── Drill-down: one session's events in order ──────────────────────────────
  const sessionId = q.get("session");
  if (sessionId) {
    const { results } = await db
      .prepare(
        `SELECT ts, type, name, value, path, title, dur, city, country, device, visitor
           FROM events WHERE session = ? ORDER BY ts ASC LIMIT 1000`,
      )
      .bind(sessionId)
      .all();
    return json({
      session: sessionId,
      visitor: (results[0]?.visitor as string) ?? "",
      events: results.map((r) => ({
        ts: r.ts, type: r.type, name: r.name, value: r.value, path: r.path,
        title: r.title, dur: r.dur, city: r.city, country: r.country, device: r.device,
      })),
    });
  }

  // ── Drill-down: one visitor's whole history, grouped into sessions ─────────
  const visitorId = q.get("visitor");
  if (visitorId) {
    const { results } = await db
      .prepare(
        `SELECT ts, session, type, name, value, path, title, dur,
                city, region, country, device, browser, os, ref
           FROM events WHERE visitor = ? ORDER BY ts ASC LIMIT 2000`,
      )
      .bind(visitorId)
      .all();
    const order: string[] = [];
    const bySession = new Map<string, { session: string; start: number; end: number; city: unknown; region: unknown; country: unknown; device: unknown; browser: unknown; os: unknown; ref: unknown; events: unknown[] }>();
    for (const r of results) {
      const sid = r.session as string;
      let s = bySession.get(sid);
      if (!s) {
        s = {
          session: sid, start: r.ts as number, end: r.ts as number,
          city: r.city, region: r.region, country: r.country,
          device: r.device, browser: r.browser, os: r.os, ref: r.ref, events: [],
        };
        bySession.set(sid, s);
        order.push(sid);
      }
      s.end = r.ts as number;
      s.events.push({ ts: r.ts, type: r.type, name: r.name, value: r.value, path: r.path, title: r.title, dur: r.dur });
    }
    // Most recent session first.
    const sessions = order.map((sid) => bySession.get(sid)!).sort((a, b) => b.start - a.start);
    return json({ visitor: visitorId, sessions });
  }

  const view = q.get("view") ?? "map";

  // ── Access: security audit log for the dashboard itself ────────────────────
  if (view === "access") {
    const limit = intParam(q.get("limit"), 200, 1, 500);
    const { results } = await db
      .prepare(
        `SELECT ts, outcome, path, ip, country, region, city, asorg, device, browser, os
           FROM admin_access WHERE ts >= ? AND ts <= ? ORDER BY ts DESC LIMIT ?`,
      )
      .bind(from, to, limit)
      .all();
    return json({ access: results });
  }

  // ── Log: every server-side request (all traffic), split by the bot flag ────
  // Sourced from `requests`, so it shows literally every hit that reached the origin,
  // JS or not (no-JS clients, unrecognized fetchers, and detected bots alike). Humans =
  // non-bot rows, bots = bot rows. Per-visitor drill-down lives on the Map/Users, which
  // stay sourced from the richer `events` beacon.
  if (view === "log") {
    const limit = intParam(q.get("limit"), 200, 1, 500);
    const offset = intParam(q.get("offset"), 0, 0, 1_000_000);
    if (!wantHumans && !wantBots) return json({ rows: [] });
    // Fixed, non-user-controlled fragment.
    const botClause = wantHumans && wantBots ? "" : wantHumans ? "AND bot = 0" : "AND bot = 1";

    // Per-column filters, applied server-side across ALL matching rows (not just a loaded
    // page). Each `f_<col>` does a case-insensitive substring match. The expressions are a
    // fixed whitelist and the values are bound, so this is injection-safe.
    const LOG_FILTERS: Record<string, string> = {
      client: "CASE WHEN bot = 1 THEN COALESCE(bot_name, 'bot') ELSE 'human' END",
      page: "path",
      status: "CAST(status AS TEXT)",
      country: "COALESCE(country, '')",
      city: "COALESCE(city, '')",
      network: "COALESCE(asorg, '')",
      device: "COALESCE(device, '')",
      browser: "COALESCE(browser, '')",
      os: "COALESCE(os, '')",
      referrer: "COALESCE(ref, 'direct')",
    };
    const filterClauses: string[] = [];
    const filterVals: string[] = [];
    for (const [key, expr] of Object.entries(LOG_FILTERS)) {
      const v = (q.get(`f_${key}`) ?? "").trim();
      if (v) {
        filterClauses.push(`AND ${expr} LIKE ?`);
        filterVals.push(`%${v}%`);
      }
    }

    const { results } = await db
      .prepare(
        `SELECT ts, path, status, bot, bot_name, browser, os, device, city, country, asorg, ref
           FROM requests
           WHERE ts >= ? AND ts <= ? ${botClause} ${filterClauses.join(" ")}
           ORDER BY ts DESC LIMIT ? OFFSET ?`,
      )
      .bind(from, to, ...filterVals, limit, offset)
      .all<{ bot: number }>();
    const rows = results.map((r) => ({ ...r, kind: r.bot ? "bot" : "human" }));
    return json({ rows });
  }

  // ── Users: one row per visitor in range ────────────────────────────────────
  if (view === "users") {
    const limit = intParam(q.get("limit"), 200, 1, 1000);
    const offset = intParam(q.get("offset"), 0, 0, 1_000_000);
    // Distinct city|country pairs per visitor. GROUP_CONCAT joins with commas and can't
    // take a custom separator alongside DISTINCT, so each pair uses '|' internally and any
    // stray comma in a city name is stripped, keeping the client's comma-split unambiguous.
    // Pairs where both city and country are null are dropped (GROUP_CONCAT skips NULLs).
    const { results } = await db
      .prepare(
        `SELECT visitor,
                COUNT(DISTINCT session) AS visits,
                SUM(CASE WHEN type = 'pageview' THEN 1 ELSE 0 END) AS pageviews,
                MIN(ts) AS firstSeen,
                MAX(ts) AS lastSeen,
                GROUP_CONCAT(DISTINCT CASE WHEN city IS NOT NULL OR country IS NOT NULL
                  THEN REPLACE(COALESCE(city, ''), ',', ' ') || '|' || COALESCE(country, '')
                END) AS locations
           FROM events WHERE ts >= ? AND ts <= ?
           GROUP BY visitor ORDER BY lastSeen DESC LIMIT ? OFFSET ?`,
      )
      .bind(from, to, limit, offset)
      .all();
    const users = results.map((r) => ({
      visitor: r.visitor,
      visits: r.visits,
      pageviews: r.pageviews,
      firstSeen: r.firstSeen,
      lastSeen: r.lastSeen,
      locations: typeof r.locations === "string" && r.locations ? r.locations.split(",") : [],
    }));
    return json({ users });
  }

  // ── Map (default): human dots from events, bot dots from requests ──────────
  const totals = { pageviews: 0, visits: 0, visitors: 0, botHits: 0 };
  let dots: unknown[] = [];
  let botDots: unknown[] = [];

  if (wantHumans) {
    const t = await db
      .prepare(
        `SELECT SUM(CASE WHEN type = 'pageview' THEN 1 ELSE 0 END) AS pageviews,
                COUNT(DISTINCT session) AS visits,
                COUNT(DISTINCT visitor) AS visitors
           FROM events WHERE ts >= ? AND ts <= ?`,
      )
      .bind(from, to)
      .first<{ pageviews: number; visits: number; visitors: number }>();
    if (t) {
      totals.pageviews = Number(t.pageviews ?? 0);
      totals.visits = Number(t.visits ?? 0);
      totals.visitors = Number(t.visitors ?? 0);
    }
    // One dot per (visit, location). Grouping by lat/lon as well as session means a single
    // visit whose IP changed mid-way (a VPN toggled on/off, a phone hopping networks) shows
    // a separate, coherent dot for each place, instead of one dot with independently-maxed,
    // mixed-up coordinates. Within a (session, lat, lon) group the city/region/country and
    // network are constant, so MAX() picks the right value.
    const { results } = await db
      .prepare(
        `SELECT session,
                MAX(visitor) AS visitor,
                MIN(ts)      AS start,
                lat,
                lon,
                MAX(city)    AS city,
                MAX(region)  AS region,
                MAX(country) AS country,
                MAX(asorg)   AS asorg,
                SUM(CASE WHEN type = 'pageview' THEN 1 ELSE 0 END) AS pages
           FROM events
           WHERE ts >= ? AND ts <= ? AND lat IS NOT NULL AND lon IS NOT NULL
           GROUP BY session, lat, lon
           ORDER BY start DESC LIMIT 5000`,
      )
      .bind(from, to)
      .all();
    dots = results;
  }

  if (wantBots) {
    const bt = await db
      .prepare(`SELECT COUNT(*) AS hits FROM requests WHERE bot = 1 AND ts >= ? AND ts <= ?`)
      .bind(from, to)
      .first<{ hits: number }>();
    totals.botHits = Number(bt?.hits ?? 0);
    // One aggregated dot per bot location, sized by hit count on the client.
    const { results } = await db
      .prepare(
        `SELECT lat, lon,
                MAX(city)     AS city,
                MAX(region)   AS region,
                MAX(country)  AS country,
                MAX(asorg)    AS asorg,
                MAX(bot_name) AS bot_name,
                COUNT(*)      AS hits
           FROM requests
           WHERE bot = 1 AND ts >= ? AND ts <= ? AND lat IS NOT NULL AND lon IS NOT NULL
           GROUP BY lat, lon
           ORDER BY hits DESC LIMIT 5000`,
      )
      .bind(from, to)
      .all();
    botDots = results;
  }

  return json({ totals, dots, botDots });
}
