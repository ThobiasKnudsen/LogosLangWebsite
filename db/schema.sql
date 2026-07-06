-- Analytics event store (Cloudflare D1 / SQLite). One row per event.
--
-- Cookieless: `visitor` is a random id kept in the browser's localStorage (persists
-- across sessions until the visitor clears site data) and `session` is a random id in
-- sessionStorage (one visit, gone when the tab closes). No raw IP is ever stored; geo
-- is Cloudflare's edge geolocation (request.cf), and lat/lon is a city centroid, not a
-- real position. See functions/api/collect.ts (writer) and functions/admin/stats.ts
-- (reader), plus the /privacy/ page.
--
-- Apply to the bound D1 database:
--   wrangler d1 execute logos-analytics --file db/schema.sql --remote   (production)
--   wrangler d1 execute logos-analytics --file db/schema.sql --local    (local dev)

CREATE TABLE IF NOT EXISTS events (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  ts       INTEGER NOT NULL,          -- epoch ms, server-stamped on ingest
  visitor  TEXT    NOT NULL,          -- persistent anonymous id (localStorage), cross-session
  session  TEXT    NOT NULL,          -- tab-scoped anonymous id (sessionStorage), one visit
  type     TEXT    NOT NULL,          -- 'pageview' | 'event'
  name     TEXT,                      -- event name: 'scroll' | 'dwell' | 'download' | 'outbound' | 'version' | 'notify' | 'playground'
  value    TEXT,                      -- event detail (e.g. 'linux-x86_64', '75', a host)
  path     TEXT    NOT NULL,          -- page path
  title    TEXT,                      -- page title
  ref      TEXT,                      -- external referrer host (null for direct / same-site)
  country  TEXT,
  region   TEXT,
  city     TEXT,
  postal   TEXT,
  lat      REAL,                      -- city centroid from Cloudflare (not GPS)
  lon      REAL,
  tz       TEXT,
  asn      INTEGER,                   -- network / ASN
  asorg    TEXT,                      -- network name
  device   TEXT,                      -- 'Desktop' | 'Mobile' | 'Tablet'
  browser  TEXT,
  os       TEXT,
  lang     TEXT,                      -- primary Accept-Language / navigator.language
  dur      INTEGER                    -- ms visible on page (dwell events)
);

CREATE INDEX IF NOT EXISTS idx_events_ts      ON events(ts);
CREATE INDEX IF NOT EXISTS idx_events_session ON events(session);
CREATE INDEX IF NOT EXISTS idx_events_visitor ON events(visitor);

-- Security audit log for the /admin/ dashboard itself, written by
-- functions/admin/_middleware.ts. Unlike `events`, this DOES record the IP and raw
-- User-Agent, because it is a log of who reached a private endpoint (not visitor
-- analytics). `outcome` is 'granted' (a successful dashboard open) or 'denied' (a
-- wrong password submitted on any /admin/* path). Requests with no credentials at all
-- are not logged, to keep the trail meaningful and flood-resistant.
CREATE TABLE IF NOT EXISTS admin_access (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  ts       INTEGER NOT NULL,
  outcome  TEXT NOT NULL,
  path     TEXT,
  ip       TEXT,
  country  TEXT,
  region   TEXT,
  city     TEXT,
  asn      INTEGER,
  asorg    TEXT,
  device   TEXT,
  browser  TEXT,
  os       TEXT,
  ua       TEXT
);
CREATE INDEX IF NOT EXISTS idx_admin_access_ts ON admin_access(ts);

-- Server-side traffic log, written by the root middleware (functions/_middleware.ts) on
-- every HTML page response. Unlike `events` (a client JS beacon that only sees real
-- browsers), this sees ALL traffic, including bots, crawlers, and AI fetchers that never
-- run JavaScript, so the dashboard can show absolutely everything with a bot filter.
-- `bot` is 1 for a detected non-human client and `bot_name` is the matched label
-- (e.g. 'GPTBot', 'ClaudeBot', 'Googlebot'). Same privacy stance as `events`: no raw IP
-- and no raw User-Agent are stored; geo is Cloudflare's edge data and the UA is reduced to
-- coarse device/browser/os. There is no visitor/session id here (a server request can't
-- read the browser's localStorage), so per-visitor views stay sourced from `events`.
CREATE TABLE IF NOT EXISTS requests (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  ts       INTEGER NOT NULL,          -- epoch ms, server-stamped
  method   TEXT,                      -- HTTP method (practically always GET)
  path     TEXT NOT NULL,             -- page path
  status   INTEGER,                   -- response status (200, 404, ...)
  bot      INTEGER NOT NULL DEFAULT 0,-- 1 = detected bot / crawler / non-browser
  bot_name TEXT,                      -- matched bot label, null for humans
  ref      TEXT,                      -- external referrer host (null for direct / same-site)
  country  TEXT,
  region   TEXT,
  city     TEXT,
  lat      REAL,                      -- city centroid from Cloudflare (not GPS)
  lon      REAL,
  asn      INTEGER,
  asorg    TEXT,
  device   TEXT,
  browser  TEXT,
  os       TEXT,
  lang     TEXT
);
CREATE INDEX IF NOT EXISTS idx_requests_ts  ON requests(ts);
CREATE INDEX IF NOT EXISTS idx_requests_bot ON requests(bot);
