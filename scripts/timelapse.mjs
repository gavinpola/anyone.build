// Screenshot the live wall and post it as a timelapse frame: one per change that lands, plus a slow heartbeat. Runs in GitHub Actions on every production deploy and on a schedule.
//   SITE_URL=https://anyone-build.vercel.app CONVEX_SITE_URL=https://….convex.site TIMELAPSE_TOKEN=… node scripts/timelapse.mjs
import { chromium } from "@playwright/test";

const site = process.env.SITE_URL ?? "https://anyone-build.vercel.app";
const convexSite = process.env.CONVEX_SITE_URL;
const token = process.env.TIMELAPSE_TOKEN;
if (!convexSite || !token) {
  console.error("CONVEX_SITE_URL and TIMELAPSE_TOKEN are required");
  process.exit(1);
}
// A frame when the wall changed: the header's "changes" count grew since the last frame. A quiet wall
// gets a heartbeat frame every six hours so a day still reads as a day. FORCE=1 (a manual run) always posts.
// (GitHub drops scheduled runs on quiet repos, so this runs on every production deploy as well as on a
// schedule; the decision here keeps that from doubling frames.)
const convexUrl = process.env.CONVEX_URL;
const HEARTBEAT_MS = 6 * 60 * 60 * 1000;
let latest = null;
if (convexUrl) {
  try {
    const q = await fetch(`${convexUrl.replace(/\/$/, "")}/api/query`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ path: "timelapse:list", args: { limit: 1 }, format: "json" }),
    });
    const j = await q.json();
    latest = j?.value?.[j.value.length - 1] ?? null;
  } catch (e) {
    console.log("could not read the latest frame; posting anyway:", String(e).slice(0, 120));
  }
}
const width = 1280;
const height = 1600;
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
await page.goto(site, { waitUntil: "networkidle" });
await page.waitForSelector('html[data-convex="ready"]', { timeout: 30_000 }).catch(() => {});
await page.waitForTimeout(4000); // fonts, the liquid layer's measurement, live counters
const header = (await page.locator("header").innerText().catch(() => "")).replace(/\s+/g, " ");
const grab = (label) => Number((header.match(new RegExp(`(\\d[\\d,]*)\\s*${label}`, "i")) ?? [])[1]?.replace(/,/g, "") ?? 0);
const changes = grab("CHANGES");
const here = grab("HERE");
if (!process.env.FORCE && latest) {
  const grew = changes > (latest.changes ?? 0);
  const stale = Date.now() - latest.at > HEARTBEAT_MS;
  if (!grew && !stale) {
    console.log(`no new change since the last frame (${latest.changes} → ${changes}, ${Math.round((Date.now() - latest.at) / 60000)} min ago); nothing to do`);
    await browser.close();
    process.exit(0);
  }
}
const jpeg = await page.screenshot({ type: "jpeg", quality: 72, fullPage: false });
await browser.close();
const res = await fetch(`${convexSite.replace(/\/$/, "")}/timelapse/upload?changes=${changes}&here=${here}&width=${width}&height=${height}`, {
  method: "POST",
  headers: { authorization: `Bearer ${token}`, "content-type": "image/jpeg" },
  body: jpeg,
});
console.log(`frame ${Math.round(jpeg.length / 1024)} KB · ${changes} changes · ${here} here → ${res.status}`);
if (!res.ok) process.exit(1);
