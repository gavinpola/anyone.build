#!/usr/bin/env node
/**
 * One real ask on production, timed from Send to live, the way a visitor would send it (no video).
 * Prints the seconds per stage. Costs a few cents; puts one small useful thing on the wall.
 *
 *   node launch/time-ask.mjs --ask "…" --block gta-browser
 */
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { chromium } = require("@playwright/test");

const arg = (k, d) => {
  const i = process.argv.indexOf(`--${k}`);
  return i >= 0 ? process.argv[i + 1] : d;
};
const URL_ = arg("url", "https://everyones.lol");
const CONVEX = arg("convex", "https://hushed-ladybug-141.convex.cloud");
const ASK = arg("ask", "Add a one-line how-to-play hint under the game: arrow keys steer, don't hit the buildings.");
const BLOCK = arg("block", "gta-browser");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function q(path, args = {}) {
  const res = await fetch(`${CONVEX}/api/query`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ path, args, format: "json" }) });
  const j = await res.json();
  return j.status === "success" ? j.value : null;
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1536, height: 864 } });
await page.addInitScript(() => localStorage.setItem("ab:help:seen", "1"));
await page.goto(URL_);
await page.waitForSelector('html[data-convex="ready"]', { timeout: 30_000 });
await page.waitForSelector("[data-world]", { state: "attached" });
await sleep(900);
const chip = page.locator(`[data-map-block="${BLOCK}"]`);
if (await chip.count()) {
  await chip.dispatchEvent("pointerdown");
  await sleep(700);
}
const target = page.locator(`[data-ab-block="${BLOCK}"]`).first();
const box = await target.boundingBox();
await page.keyboard.down("Shift");
await page.keyboard.down("Meta");
await page.mouse.click(box.x + box.width * 0.4, box.y + Math.min(box.height * 0.5, 160));
await page.keyboard.up("Meta");
await page.keyboard.up("Shift");
const dlg = page.getByRole("dialog", { name: /ask for a change/i });
await dlg.waitFor({ state: "visible", timeout: 8000 });
await dlg.getByRole("textbox").fill(ASK);
const t0 = Date.now();
await dlg.getByRole("button", { name: /^send/i }).first().click();
const stamp = (label) => console.log(`${((Date.now() - t0) / 1000).toFixed(1).padStart(6)}s  ${label}`);
stamp("sent");
await dlg.getByText(/judging/i).waitFor({ state: "visible", timeout: 20_000 }).catch(() => {});
stamp("judging");
// the composer's own outcome lines, exactly, so the ask's text can never match ("buildings" did once)
const verdict = dlg.getByText(/^(Approved\. Building now\.|It's live\.|Up for a vote\.|Not this time\.|It didn't make it\.)$/).first();
await verdict.waitFor({ state: "visible", timeout: 90_000 }).catch(() => {});
stamp(`verdict: ${(await verdict.textContent().catch(() => "?"))?.trim().slice(0, 60)}`);
await sleep(1500);
const active = (await q("requests:active", { roomId: "main" })) ?? [];
const mine = active.find((r) => (r.prompt ?? "") === ASK);
console.log("request:", mine ? `${mine.id} (${mine.status})` : "not in the active list (rejected, or already live)");
await browser.close();
if (!mine) process.exit(0);
let last = "";
while (Date.now() - t0 < 8 * 60_000) {
  const now = (await q("requests:active", { roomId: "main" })) ?? [];
  const r = now.find((x) => x.id === mine.id);
  if (!r) {
    stamp("gone from active: live (or failed)");
    break;
  }
  const s = `${r.status}${r.stage ? " · " + r.stage : ""}`;
  if (s !== last) {
    stamp(s);
    last = s;
  }
  await sleep(4000);
}
const landed = (await q("votes:recentChanges", { limit: 5 })) ?? [];
const hit = landed.find((c) => c.requestId === mine.id);
console.log(hit ? `LIVE: "${hit.summary}" +${hit.linesAdded} −${hit.linesRemoved} · ${hit.costCents ?? "?"}¢ · ${URL_}/c/${mine.id}` : "not live yet (check /admin)");
