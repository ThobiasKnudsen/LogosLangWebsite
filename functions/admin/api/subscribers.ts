// Cloudflare Pages Function: GET /admin/api/subscribers
//
// Read-only list of release-notification signups for the admin dashboard's Subscribers
// tab. Reads the same SUBSCRIBERS KV namespace that functions/api/subscribe.ts writes to
// (key `email:<address>`, value `{ email, subscribedAt, source }`). Gated by
// functions/admin/_middleware.ts (HTTP Basic Auth), so it assumes an authorized caller.
//
// If the SUBSCRIBERS binding does not exist yet, it answers `configured: false` so the
// dashboard can tell you to bind it, matching how subscribe.ts degrades.
//
// Type-checked and deployed by Cloudflare, not the site build, so it declares the few
// Workers types it needs (like the other functions/ files).

interface KVListKey {
  name: string;
}
interface KVListResult {
  keys: KVListKey[];
  list_complete: boolean;
  cursor?: string;
}
interface KVNamespace {
  list(options?: { prefix?: string; cursor?: string; limit?: number }): Promise<KVListResult>;
  get(key: string): Promise<string | null>;
}
interface Env {
  SUBSCRIBERS?: KVNamespace;
}

interface Subscriber {
  email: string;
  subscribedAt: string | null;
  source: string | null;
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}

export async function onRequestGet(context: { env: Env }): Promise<Response> {
  const kv = context.env.SUBSCRIBERS;
  if (!kv) return json({ configured: false, count: 0, subscribers: [] });

  const subs: Subscriber[] = [];
  let cursor: string | undefined;
  // Page through all keys (KV lists up to 1000 per call); cap the loop as a backstop.
  for (let page = 0; page < 50; page++) {
    const res = await kv.list({ prefix: "email:", cursor, limit: 1000 });
    // Fetch this page's values in parallel rather than one blocking round-trip each.
    const values = await Promise.all(res.keys.map((k) => kv.get(k.name)));
    res.keys.forEach((k, i) => {
      const fallback = k.name.replace(/^email:/, "");
      const raw = values[i];
      if (!raw) {
        subs.push({ email: fallback, subscribedAt: null, source: null });
        return;
      }
      try {
        const v = JSON.parse(raw) as { email?: string; subscribedAt?: string; source?: string };
        subs.push({
          email: v.email ?? fallback,
          subscribedAt: v.subscribedAt ?? null,
          source: v.source ?? null,
        });
      } catch {
        subs.push({ email: fallback, subscribedAt: null, source: null });
      }
    });
    if (res.list_complete || !res.cursor) break;
    cursor = res.cursor;
  }

  // Newest first (ISO timestamps sort lexicographically).
  subs.sort((a, b) => (b.subscribedAt ?? "").localeCompare(a.subscribedAt ?? ""));
  return json({ configured: true, count: subs.length, subscribers: subs });
}
