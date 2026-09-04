import type { HttpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";

/** GitHub, Vercel, and Polar webhooks plus the patron click redirect. */
export function registerWebhooks(http: HttpRouter) {
  http.route({
    path: "/webhooks/health",
    method: "GET",
    handler: httpAction(async () => new Response("ok", { status: 200 })),
  });

  // Patron click-through: /go/<bidId> → counts, then redirects with utm.
  http.route({
    pathPrefix: "/go/",
    method: "GET",
    handler: httpAction(async (ctx, req) => {
      const id = new URL(req.url).pathname.slice("/go/".length).replace(/[^a-z0-9]/gi, "");
      if (!id) return new Response("not found", { status: 404 });
      let url: string | null = null;
      try {
        url = await ctx.runMutation(internal.patrons.recordClick, { bidId: id as never });
      } catch {
        url = null;
      }
      if (!url) return new Response("not found", { status: 404 });
      const u = new URL(url);
      if (!u.searchParams.has("utm_source")) u.searchParams.set("utm_source", "everyones.lol");
      return new Response(null, { status: 302, headers: { Location: u.toString(), "Cache-Control": "no-store", "Referrer-Policy": "origin" } });
    }),
  });

  http.route({
    path: "/webhooks/stripe",
    method: "POST",
    handler: httpAction(async (ctx, req) => {
      const body = await req.text();
      const result = await ctx.runAction(internal.webhookHandlers.stripe, { body, signature: req.headers.get("stripe-signature") ?? "" });
      return new Response(result.ok ? "ok" : result.error ?? "error", { status: result.status });
    }),
  });

  http.route({
    path: "/webhooks/github",
    method: "POST",
    handler: httpAction(async (ctx, req) => {
      const body = await req.text();
      const result = await ctx.runAction(internal.webhookHandlers.github, {
        body,
        signature: req.headers.get("x-hub-signature-256") ?? "",
        event: req.headers.get("x-github-event") ?? "",
        delivery: req.headers.get("x-github-delivery") ?? "",
      });
      return new Response(result.ok ? "ok" : result.error ?? "error", { status: result.status });
    }),
  });

  http.route({
    path: "/webhooks/vercel",
    method: "POST",
    handler: httpAction(async (ctx, req) => {
      const body = await req.text();
      const result = await ctx.runAction(internal.webhookHandlers.vercel, { body, signature: req.headers.get("x-vercel-signature") ?? "" });
      return new Response(result.ok ? "ok" : result.error ?? "error", { status: result.status });
    }),
  });
}
