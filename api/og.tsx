/**
 * The preview image for a shared link: the ask in big type, who asked, and the site. Rendered on the
 * Node runtime with satori (element tree → SVG) and resvg (SVG → PNG). Generic card when the record
 * isn't public. Nothing here is user-specific beyond what the public feed already shows.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createElement as h } from "react";
import satori from "satori";
import { Resvg } from "@resvg/resvg-js";
import { byLine, fetchShare, tidy } from "./_share.js";

export const config = { runtime: "nodejs" };

const CONVEX_URL = process.env.VITE_CONVEX_URL || "https://hushed-ladybug-141.convex.cloud";
const FONT = readFileSync(fileURLToPath(new URL("./_fonts/Geist-Regular.ttf", import.meta.url)));

// A named GET export is the Web-signature form on the Node runtime (a default export would get Node's
// request object, whose url is a bare path).
export async function GET(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const kind = url.searchParams.get("kind") === "p" ? "p" : "c";
  const id = (url.searchParams.get("id") ?? "").replace(/[^a-z0-9]/gi, "").slice(0, 64);
  const d = await fetchShare(CONVEX_URL, id);

  const label = !d ? "THE WEBSITE ANYONE CAN CHANGE" : kind === "p" || d.status === "proposed" ? "UP FOR A VOTE" : d.status === "live" ? "LIVE ON THE WALL" : "BEING BUILT RIGHT NOW";
  const ask = d ? tidy(d.ask, 140) : "Point at something. Say what should change. If it's good for everyone, it ships.";
  const foot = d ? `asked by ${byLine(d)}${d.votes != null ? ` · ${d.votes} ${d.votes === 1 ? "vote" : "votes"}` : ""}` : "an experiment in building together";
  const size = ask.length > 100 ? 44 : ask.length > 60 ? 54 : 64;

  const card = h(
    "div",
    {
      style: {
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "64px 72px",
        background: "linear-gradient(135deg, #1b1712 0%, #0e0c09 55%, #050403 100%)",
        color: "#f4efe3",
        fontFamily: "Geist",
      },
    },
    h("div", { style: { display: "flex", alignItems: "center", gap: 14, fontSize: 24, letterSpacing: 4, color: "#ffd84d" } }, [
      h("div", { key: "dot", style: { width: 14, height: 14, borderRadius: 999, background: "#ffd84d" } }),
      h("div", { key: "label" }, label),
    ]),
    h("div", { style: { display: "flex", fontSize: size, lineHeight: 1.15, fontWeight: 400, maxWidth: 1000 } }, d ? `“${ask}”` : ask),
    h("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "flex-end", fontSize: 26, color: "#bfb8a8" } }, [
      h("div", { key: "foot" }, foot),
      h("div", { key: "brand", style: { fontSize: 30, color: "#f4efe3" } }, "everyones.lol"),
    ]),
  );

  const svg = await satori(card as never, { width: 1200, height: 630, fonts: [{ name: "Geist", data: FONT, weight: 400, style: "normal" }] });
  const png = new Resvg(svg, { fitTo: { mode: "width", value: 1200 } }).render().asPng();
  return new Response(png, {
    status: 200,
    headers: { "content-type": "image/png", "cache-control": "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400" },
  });
}
