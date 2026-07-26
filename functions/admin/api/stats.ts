// Cloudflare Pages Function: GET /admin/api/stats
//
// Read side of the cookieless analytics: queries the D1 database bound as DB and backs
// the dashboard tabs (Map, Log, Users, Access) plus three drill-downs (one session, one
// visitor, one server-side client). Paired with client/dashboard.ts, which renders the
// JSON, and written by functions/api/collect.ts and functions/_middleware.ts. See
// db/schema.sql.
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

// The set of visitors treated as human. A visitor is human once they have EVER emitted a
// `dwell` event: the beacon fires it on `pagehide` when a real browser leaves a page (see
// client/main.ts and functions/api/collect.ts). A visitor that only ever logged pageviews
// and never one dwell never ran that unload path, which is the fingerprint of an automated
// client (e.g. an AI research crawler that executes the beacon's opening pageview but is
// torn down without a pagehide). It's a strong signal, not a certainty, so it only sorts a
// visitor between the Humans and Bots buckets rather than deleting anything. Used as a fixed
// (non-user-controlled) subquery fragment; `events.visitor` is NOT NULL, so `NOT IN` against
// it can never be swallowed by a NULL row.
const HUMAN_VISITORS = "SELECT visitor FROM events WHERE name = 'dwell'";

// ── Server-side client identity ────────────────────────────────────────────────
// `requests` rows carry no visitor id (a server request can't read localStorage), so the
// clients that never run JS -- crawlers, AI fetchers, curl, JS-off browsers -- have no way
// to be followed across visits. This fingerprint stands in for one: the columns below are
// stored on BOTH `events` and `requests`, spelled identically, so the same expression runs
// against either table and the two can be compared.
//
// It is deliberately coarse, and that is the whole trade: nothing new is collected and no
// privacy claim on /privacy/ changes, so it also works retroactively over history already
// on disk. The cost is that two people behind one ISP on the same browser and city collapse
// into one row, and one client that switches network (wifi -> mobile) splits into two.
//
// Every part is COALESCE'd so the expression can never evaluate to NULL: it is used on the
// right-hand side of a `NOT IN`, where a single NULL row would silently swallow the whole
// result set.
const FINGERPRINT =
  "COALESCE(asn, 0) || '|' || COALESCE(device, '') || '|' || COALESCE(browser, '') || '|' ||" +
  " COALESCE(os, '') || '|' || COALESCE(country, '') || '|' || COALESCE(city, '')";

// The Users-tab id for a server-side client. Prefixed with the bot label so two different
// crawlers sharing a cloud ASN stay separate rows. `events` has no bot_name column, so
// comparisons against the beacon use FINGERPRINT (the shared part) instead.
const CLIENT_KEY = `COALESCE(bot_name, '') || '|' || ${FINGERPRINT}`;

// A client with no id of its own gets visits cut on idle time instead: a gap this long
// between two hits starts a new visit. 30 minutes is the usual analytics convention and
// matches how a browser session id tends to expire in practice.
const VISIT_GAP_MS = 30 * 60_000;

// A `requests` row is already represented on the Users tab when the beacon saw the same
// client: it is a real browser (bot = 0) whose fingerprint also appears in `events` for the
// window, so it already has a visitor row and counting it again would list every human
// twice. Bot rows are never dropped, so a crawler sharing a fingerprint with a human still
// gets its own row.
const NOT_ALREADY_A_VISITOR =
  `(bot = 1 OR ${FINGERPRINT} NOT IN (SELECT ${FINGERPRINT} FROM events WHERE ts >= ? AND ts <= ?))`;

/** One `requests` row as read back for the client drill-down. */
interface ClientHit {
  ts: number;
  path: string;
  status: number | null;
  ref: string | null;
  bot: number;
  bot_name: string | null;
  city: string | null;
  region: string | null;
  country: string | null;
  asorg: string | null;
  device: string | null;
  browser: string | null;
  os: string | null;
}

/** Split time-ordered hits into visits, cutting whenever the client idles past the gap. */
function intoVisits<T extends { ts: number }>(hits: T[]): { start: number; end: number; hits: T[] }[] {
  const visits: { start: number; end: number; hits: T[] }[] = [];
  for (const h of hits) {
    const cur = visits[visits.length - 1];
    if (cur && h.ts - cur.end <= VISIT_GAP_MS) {
      cur.end = h.ts;
      cur.hits.push(h);
    } else {
      visits.push({ start: h.ts, end: h.ts, hits: [h] });
    }
  }
  return visits;
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

  // ── Drill-down: one server-side client's whole history, cut into visits ─────
  // The counterpart of the visitor drill-down for clients that never ran the beacon. Like
  // that one it ignores the time window and shows everything on record, so a crawler's
  // behaviour is readable across visits rather than only inside the current range. No
  // dedup here: these rows are what this exact fingerprint did.
  const clientId = q.get("client");
  if (clientId) {
    const { results } = await db
      .prepare(
        `SELECT ts, path, status, ref, bot, bot_name, city, region, country, asorg, device, browser, os
           FROM requests WHERE ${CLIENT_KEY} = ? ORDER BY ts ASC LIMIT 2000`,
      )
      .bind(clientId)
      .all<ClientHit>();
    const first = results[0];
    return json({
      client: clientId,
      bot: Number(first?.bot ?? 0),
      bot_name: first?.bot_name ?? null,
      // Most recent visit first, matching the visitor panel.
      visits: intoVisits(results)
        .map((v) => {
          const h = v.hits[0]!;
          return {
            start: v.start,
            end: v.end,
            city: h.city, region: h.region, country: h.country, asorg: h.asorg,
            device: h.device, browser: h.browser, os: h.os,
            hits: v.hits.map((r) => ({ ts: r.ts, path: r.path, status: r.status, ref: r.ref })),
          };
        })
        .reverse(),
    });
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

  // ── Users: one row per client in range, from BOTH sources ──────────────────
  // Two kinds of row, unioned:
  //   'visitor' -- ran the JS beacon, so it has a real localStorage id (`events`).
  //   'client'  -- never ran it, so it is identified by FINGERPRINT (`requests`).
  // Without the second kind the tab only ever listed the handful of clients that execute
  // JavaScript, while the Log tab showed every crawler and no-JS fetcher that actually hit
  // the site. NOT_ALREADY_A_VISITOR keeps a real browser from being listed under both.
  if (view === "users") {
    const limit = intParam(q.get("limit"), 200, 1, 1000);
    const offset = intParam(q.get("offset"), 0, 0, 1_000_000);
    // Honour the shared audience filter here too: humans are dwell-having visitors, bots are
    // zero-dwell ones (see HUMAN_VISITORS). Neither selected -> nothing to list.
    if (!wantHumans && !wantBots) return json({ users: [] });
    const audience =
      wantHumans && wantBots
        ? ""
        : wantHumans
          ? `AND visitor IN (${HUMAN_VISITORS})`
          : `AND visitor NOT IN (${HUMAN_VISITORS})`;
    // Distinct city|country pairs per visitor. GROUP_CONCAT joins with commas and can't
    // take a custom separator alongside DISTINCT, so each pair uses '|' internally and any
    // stray comma in a city name is stripped, keeping the client's comma-split unambiguous.
    // Pairs where both city and country are null are dropped (GROUP_CONCAT skips NULLs).
    const beacon = await db
      .prepare(
        `SELECT visitor,
                CASE WHEN visitor IN (${HUMAN_VISITORS}) THEN 0 ELSE 1 END AS bot,
                COUNT(DISTINCT session) AS visits,
                SUM(CASE WHEN type = 'pageview' THEN 1 ELSE 0 END) AS pageviews,
                MIN(ts) AS firstSeen,
                MAX(ts) AS lastSeen,
                GROUP_CONCAT(DISTINCT CASE WHEN city IS NOT NULL OR country IS NOT NULL
                  THEN REPLACE(COALESCE(city, ''), ',', ' ') || '|' || COALESCE(country, '')
                END) AS locations
           FROM events WHERE ts >= ? AND ts <= ? ${audience}
           GROUP BY visitor ORDER BY lastSeen DESC LIMIT ? OFFSET ?`,
      )
      .bind(from, to, limit, offset)
      .all();

    // Server-side clients. A client has no session id, so visits are cut on idle time:
    // LAG marks every hit that follows a gap longer than VISIT_GAP_MS as a new visit and
    // SUM counts them. Audience maps the same way it does on the Log tab, by the bot flag.
    const clientAudience = wantHumans && wantBots ? "" : wantHumans ? "AND bot = 0" : "AND bot = 1";
    const clients = await db
      .prepare(
        `WITH hits AS (
           SELECT ${CLIENT_KEY} AS id,
                  ts, bot, bot_name, asorg, device, browser, os, country, city
             FROM requests
            WHERE ts >= ? AND ts <= ? ${clientAudience} AND ${NOT_ALREADY_A_VISITOR}
         ), cut AS (
           SELECT *,
                  CASE WHEN LAG(ts) OVER (PARTITION BY id ORDER BY ts) IS NULL
                         OR ts - LAG(ts) OVER (PARTITION BY id ORDER BY ts) > ${VISIT_GAP_MS}
                       THEN 1 ELSE 0 END AS newvisit
             FROM hits
         )
         SELECT id,
                MAX(bot)      AS bot,
                MAX(bot_name) AS bot_name,
                MAX(asorg)    AS asorg,
                MAX(device)   AS device,
                MAX(browser)  AS browser,
                MAX(os)       AS os,
                SUM(newvisit) AS visits,
                COUNT(*)      AS pageviews,
                MIN(ts)       AS firstSeen,
                MAX(ts)       AS lastSeen,
                GROUP_CONCAT(DISTINCT CASE WHEN city IS NOT NULL OR country IS NOT NULL
                  THEN REPLACE(COALESCE(city, ''), ',', ' ') || '|' || COALESCE(country, '')
                END) AS locations
           FROM cut GROUP BY id ORDER BY lastSeen DESC LIMIT ? OFFSET ?`,
      )
      .bind(from, to, from, to, limit, offset)
      .all();

    const locs = (v: unknown): string[] =>
      typeof v === "string" && v ? v.split(",") : [];
    const users = [
      ...beacon.results.map((r) => ({
        kind: "visitor" as const,
        id: String(r.visitor),
        bot: Number(r.bot),
        visits: Number(r.visits ?? 0),
        pageviews: Number(r.pageviews ?? 0),
        firstSeen: Number(r.firstSeen ?? 0),
        lastSeen: Number(r.lastSeen ?? 0),
        locations: locs(r.locations),
      })),
      ...clients.results.map((r) => ({
        kind: "client" as const,
        id: String(r.id),
        bot: Number(r.bot),
        visits: Number(r.visits ?? 0),
        pageviews: Number(r.pageviews ?? 0),
        firstSeen: Number(r.firstSeen ?? 0),
        lastSeen: Number(r.lastSeen ?? 0),
        locations: locs(r.locations),
        botName: (r.bot_name as string | null) ?? null,
        asorg: (r.asorg as string | null) ?? null,
        device: (r.device as string | null) ?? null,
        browser: (r.browser as string | null) ?? null,
        os: (r.os as string | null) ?? null,
      })),
    ]
      .sort((a, b) => b.lastSeen - a.lastSeen)
      .slice(0, limit);
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
           FROM events WHERE ts >= ? AND ts <= ? AND visitor IN (${HUMAN_VISITORS})`,
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
             AND visitor IN (${HUMAN_VISITORS})
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

    // Events-side bots: visitors that ran the JS beacon (so they land in `events`) but never
    // emitted a dwell, i.e. never a real pagehide. The UA-based `requests.bot` flag can't
    // catch these (they carry an ordinary browser UA), so fold them into the same Bots
    // bucket here: their pageviews add to the hit count and their locations to the bot dots.
    const eb = await db
      .prepare(
        `SELECT COUNT(*) AS hits FROM events
           WHERE type = 'pageview' AND ts >= ? AND ts <= ?
             AND visitor NOT IN (${HUMAN_VISITORS})`,
      )
      .bind(from, to)
      .first<{ hits: number }>();
    totals.botHits += Number(eb?.hits ?? 0);
    const ebd = await db
      .prepare(
        `SELECT lat, lon,
                MAX(city)    AS city,
                MAX(region)  AS region,
                MAX(country) AS country,
                MAX(asorg)   AS asorg,
                NULL         AS bot_name,
                COUNT(*)     AS hits
           FROM events
           WHERE type = 'pageview' AND ts >= ? AND ts <= ?
             AND lat IS NOT NULL AND lon IS NOT NULL
             AND visitor NOT IN (${HUMAN_VISITORS})
           GROUP BY lat, lon
           ORDER BY hits DESC LIMIT 5000`,
      )
      .bind(from, to)
      .all();
    botDots = botDots.concat(ebd.results);
  }

  return json({ totals, dots, botDots });
}
