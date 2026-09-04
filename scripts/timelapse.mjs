// Screenshot the live wall and post it as this hour's timelapse frame. Runs on a schedule in GitHub Actions.
//   SITE_URL=https://anyone-build.vercel.app CONVEX_SITE_URL=https://….convex.site TIMELAPSE_TOKEN=… node scripts/timelapse.mjs
import { chromium } from "@playwright/test";

const site = process.env.SITE_URL ?? "https://anyone-build.vercel.app";
const convexSite = process.env.CONVEX_SITE_URL;
const token = process.env.TIMELAPSE_TOKEN;
if (!convexSite || !token) {
  console.error("CONVEX_SITE_URL and TIMELAPSE_TOKEN are required");
  process.exit(1);
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
const jpeg = await page.screenshot({ type: "jpeg", quality: 72, fullPage: false });
await browser.close();
const res = await fetch(`${convexSite.replace(/\/$/, "")}/timelapse/upload?changes=${changes}&here=${here}&width=${width}&height=${height}`, {
  method: "POST",
  headers: { authorization: `Bearer ${token}`, "content-type": "image/jpeg" },
  body: jpeg,
});
console.log(`frame ${Math.round(jpeg.length / 1024)} KB · ${changes} changes · ${here} here → ${res.status}`);
if (!res.ok) process.exit(1);
