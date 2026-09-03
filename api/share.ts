/**
 * /c/<request id> and /p/<request id> (rewritten here by vercel.json): the app's own HTML with this
 * change's preview tags injected, so a link unfurls in iMessage / Slack / X with the ask and the
 * builder's name, and a person who opens it gets the app at the same URL (the SPA route focuses the
 * block). Anything missing or failing degrades to the plain app, never to an error page.
 */
import { INDEX_HTML } from "./_index.js";
import { fetchShare, injectMeta, shareMeta } from "./_share.js";

export const config = { runtime: "edge" };

const CONVEX_URL = process.env.VITE_CONVEX_URL || "https://hushed-ladybug-141.convex.cloud";

export default async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const kind = url.searchParams.get("kind") === "p" ? "p" : "c";
  const id = (url.searchParams.get("id") ?? "").replace(/[^a-z0-9]/gi, "").slice(0, 64);
  const [html, data] = await Promise.all([
    INDEX_HTML
      ? Promise.resolve(INDEX_HTML)
      : fetch(new URL("/index.html", url.origin))
          .then((r) => (r.ok ? r.text() : ""))
          .catch(() => ""),
    fetchShare(CONVEX_URL, id),
  ]);
  if (!html) return Response.redirect(new URL("/", url.origin).toString(), 302);
  const meta = shareMeta(kind, id, data, url.origin);
  return new Response(injectMeta(html, meta), {
    status: 200,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "public, max-age=0, s-maxage=60, stale-while-revalidate=600",
    },
  });
}
