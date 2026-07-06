// Cloudflare Pages Function: GET /admin/stats
//
// Read side of the cookieless analytics: queries the D1 database bound as DB and backs
// the three dashboard tabs (Map, Log, Users) plus two drill-downs (one session, one
// visitor). Paired with client/dashboard.ts, which renders the JSON, and written by
// functions/api/collect.ts. See db/schema.sql.
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

  const url = new URL(request.url);
  const q = url.searchParams;
  const now = Date.now();
  const to = intParam(q.get("to"), now, 0, now + 86_400_000);
  const from = intParam(q.get("from"), to - 7 * 86_400_000, 0, to);

  const db = env.DB;

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

  // ── Log: reverse-chronological activity stream ─────────────────────────────
  if (view === "log") {
    const limit = intParam(q.get("limit"), 200, 1, 500);
    const offset = intParam(q.get("offset"), 0, 0, 1_000_000);
    const { results } = await db
      .prepare(
        `SELECT ts, visitor, session, type, name, path, city, country, device, ref
           FROM events WHERE ts >= ? AND ts <= ? ORDER BY ts DESC LIMIT ? OFFSET ?`,
      )
      .bind(from, to, limit, offset)
      .all();
    return json({ rows: results });
  }

  // ── Users: one row per visitor in range ────────────────────────────────────
  if (view === "users") {
    const limit = intParam(q.get("limit"), 200, 1, 1000);
    const offset = intParam(q.get("offset"), 0, 0, 1_000_000);
    const { results } = await db
      .prepare(
        `SELECT visitor,
                COUNT(DISTINCT session) AS visits,
                SUM(CASE WHEN type = 'pageview' THEN 1 ELSE 0 END) AS pageviews,
                MIN(ts) AS firstSeen,
                MAX(ts) AS lastSeen,
                GROUP_CONCAT(DISTINCT country) AS countries
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
      countries: typeof r.countries === "string" && r.countries ? r.countries.split(",") : [],
    }));
    return json({ users });
  }

  // ── Map (default): one dot per visit, plus range totals ────────────────────
  const totals = await db
    .prepare(
      `SELECT SUM(CASE WHEN type = 'pageview' THEN 1 ELSE 0 END) AS pageviews,
              COUNT(DISTINCT session) AS visits,
              COUNT(DISTINCT visitor) AS visitors
         FROM events WHERE ts >= ? AND ts <= ?`,
    )
    .bind(from, to)
    .first();

  const { results: dots } = await db
    .prepare(
      `SELECT session,
              MAX(visitor) AS visitor,
              MIN(ts)      AS start,
              MAX(lat)     AS lat,
              MAX(lon)     AS lon,
              MAX(city)    AS city,
              MAX(region)  AS region,
              MAX(country) AS country,
              SUM(CASE WHEN type = 'pageview' THEN 1 ELSE 0 END) AS pages
         FROM events WHERE ts >= ? AND ts <= ?
         GROUP BY session
         HAVING lat IS NOT NULL AND lon IS NOT NULL
         ORDER BY start DESC LIMIT 5000`,
    )
    .bind(from, to)
    .all();

  return json({
    totals: totals ?? { pageviews: 0, visits: 0, visitors: 0 },
    dots,
  });
}
