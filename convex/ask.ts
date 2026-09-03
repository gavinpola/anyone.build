import type { HttpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { validateNote } from "./lib/notes";

// No credentials are involved, so a wildcard is right: the site key + Origin check happen server-side.
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type",
  "Access-Control-Max-Age": "86400",
};

/** The endpoint ask.js posts to from customers' sites. */
export function registerAsk(http: HttpRouter) {
  http.route({
    path: "/ask/note",
    method: "OPTIONS",
    handler: httpAction(async () => new Response(null, { status: 204, headers: CORS })),
  });

  http.route({
    path: "/ask/note",
    method: "POST",
    handler: httpAction(async (ctx, req) => {
      const json = (body: unknown, status: number) =>
        new Response(JSON.stringify(body), {
          status,
          headers: { ...CORS, "content-type": "application/json", "cache-control": "no-store" },
        });
      const length = Number(req.headers.get("content-length") ?? 0);
      if (length > 12_000) return json({ error: "too large" }, 413);
      let body: unknown;
      try {
        body = await req.json();
      } catch {
        return json({ error: "bad json" }, 400);
      }
      const origin = req.headers.get("origin");
      const v = validateNote(body, origin);
      if (!v.ok) return json({ error: v.error }, 400);
      const r = await ctx.runMutation(internal.sites.ingest, { origin: origin!, note: v.note });
      return r.ok ? json({ ok: true }, 200) : json({ error: r.error }, r.status);
    }),
  });
}
