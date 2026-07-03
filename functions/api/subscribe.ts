// Cloudflare Pages Function: POST /api/subscribe
//
// Stores release-notification signups in a Workers KV namespace. One-time setup in
// the Cloudflare Pages project: create a KV namespace and bind it as SUBSCRIBERS
// (Settings -> Functions -> KV namespace bindings); see README "Release
// notifications". Until the binding exists the function answers 503 and the client
// falls back to pointing at GitHub releases, so the form degrades, never lies.
//
// Stored per signup: the email (lowercased, also the key, so re-submitting is a
// harmless overwrite), the signup time, and which form it came from. Deliberately
// nothing else: no IP, no user agent (see /privacy/).
//
// This file is deployed and type-checked by Cloudflare, not by the site build
// (tsconfig covers build/ and client/ only), so it declares the two Workers types
// it needs instead of pulling in @cloudflare/workers-types.

interface KVNamespace {
  put(key: string, value: string): Promise<void>;
}
interface Env {
  SUBSCRIBERS?: KVNamespace;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** A plain HTML form post (JS off) wants a page back; fetch asks for JSON. */
function wantsHtml(request: Request): boolean {
  const accept = request.headers.get("accept") ?? "";
  return accept.includes("text/html") && !accept.includes("application/json");
}

/** Minimal self-contained page for no-JS form posts, in the site's cream/ink. */
function htmlPage(status: number, title: string, body: string): Response {
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${title} | Λόγος</title>
<meta name="robots" content="noindex" />
</head>
<body style="margin:0;display:grid;place-items:center;min-height:100vh;background:#fdf8e3;color:#2c2b25;font-family:ui-sans-serif,system-ui,sans-serif;text-align:center;padding:2rem;box-sizing:border-box">
<main>
<h1 style="color:#16160f;font-weight:600">${title}</h1>
<p style="max-width:34rem">${body}</p>
<p><a href="/" style="color:#4f46e5">Back to logoslang.dev</a></p>
</main>
</body>
</html>`;
  return new Response(html, {
    status,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function respond(
  request: Request,
  status: number,
  error: string | null,
  page: { title: string; body: string },
): Response {
  if (wantsHtml(request)) return htmlPage(status, page.title, page.body);
  return new Response(JSON.stringify(error ? { ok: false, error } : { ok: true }), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

const SUCCESS = {
  title: "You're on the list",
  body: "You'll get an email when the most important Logos builds ship. You will not be spammed.",
};

export async function onRequestPost(context: {
  request: Request;
  env: Env;
}): Promise<Response> {
  const { request, env } = context;

  let email = "";
  let honeypot = "";
  let source = "";
  try {
    const type = request.headers.get("content-type") ?? "";
    if (type.includes("application/json")) {
      const data = (await request.json()) as Record<string, unknown>;
      email = String(data.email ?? "");
      honeypot = String(data.website ?? "");
      source = String(data.source ?? "");
    } else {
      const form = await request.formData();
      email = String(form.get("email") ?? "");
      honeypot = String(form.get("website") ?? "");
      source = String(form.get("source") ?? "");
    }
  } catch {
    return respond(request, 400, "bad-request", {
      title: "Something went wrong",
      body: "That submission could not be read. Go back and try again.",
    });
  }

  // A filled honeypot is a bot: claim success, store nothing.
  if (honeypot) return respond(request, 200, null, SUCCESS);

  email = email.trim().toLowerCase();
  if (!email || email.length > 254 || !EMAIL_RE.test(email)) {
    return respond(request, 400, "invalid-email", {
      title: "That didn't look like an email address",
      body: "Go back and check the address you typed.",
    });
  }

  if (!env.SUBSCRIBERS) {
    return respond(request, 503, "not-configured", {
      title: "Signup isn't wired up yet",
      body: 'The notification list is not configured on this deployment. Watch <a href="https://github.com/ThobiasKnudsen/LogosLang/releases" style="color:#4f46e5">releases on GitHub</a> instead.',
    });
  }

  // KV rejects (e.g. the one-write-per-second-per-key limit on a double-submit,
  // or a transient error) must not escape: an uncaught throw would surface as
  // Cloudflare's bare error page instead of the function's own response shape.
  try {
    await env.SUBSCRIBERS.put(
      `email:${email}`,
      JSON.stringify({
        email,
        subscribedAt: new Date().toISOString(),
        source: source.slice(0, 32),
      }),
    );
  } catch {
    return respond(request, 500, "storage-error", {
      title: "Something went wrong saving that",
      body: "Wait a moment and try again; if it keeps failing, watch releases on GitHub instead.",
    });
  }
  return respond(request, 200, null, SUCCESS);
}
