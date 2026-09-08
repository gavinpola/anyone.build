#!/usr/bin/env node
/**
 * Records the launch footage from the real site: every frame is the product. One browser context per
 * scene, each its own .webm, at a phone size (1080×1920) or a desktop size (1920×1080, rendered from a
 * 1536×864 viewport so type reads at 125%). Beats are logged to marks.json so the cut can find them.
 *
 *   node launch/record.mjs                 # everything, against https://everyones.lol
 *   node launch/record.mjs --only gta      # one scene
 *   node launch/record.mjs --url http://127.0.0.1:5173
 *
 * Two scenes ask the wall for something real (a small useful ask that lands; a promo ask the judge
 * refuses, which stays private). Everything else only reads.
 */
/* global navigator, localStorage */
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync, renameSync, existsSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const { chromium } = require("@playwright/test");

const here = dirname(fileURLToPath(import.meta.url));
const OUT = join(here, "..", "docs", "launch", "clips", "raw");
mkdirSync(OUT, { recursive: true });

const arg = (k, d) => {
  const i = process.argv.indexOf(`--${k}`);
  return i >= 0 ? process.argv[i + 1] : d;
};
const URL_ = (arg("url", "https://everyones.lol")).replace(/\/$/, "");
const CONVEX = arg("convex", "https://hushed-ladybug-141.convex.cloud");
const only = arg("only", null);

const MARKS = join(OUT, "marks.json");
const prior = existsSync(MARKS) ? JSON.parse(readFileSync(MARKS, "utf8")) : { marks: [] };
const marks = prior.marks ?? [];
const saveMarks = (extra = {}) => writeFileSync(MARKS, JSON.stringify({ ...prior, ...extra, url: URL_, at: new Date().toISOString(), marks }, null, 2));
const mark = (scene, note, t0) => {
  const t = (Date.now() - t0) / 1000;
  marks.push({ scene, t: Number(t.toFixed(2)), note });
  console.log(`  ${t.toFixed(1).padStart(6)}s  ${note}`);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function q(path, args = {}) {
  const res = await fetch(`${CONVEX}/api/query`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ path, args, format: "json" }) });
  const j = await res.json();
  return j.status === "success" ? j.value : null;
}

const SIZES = {
  desktop: { viewport: { width: 1536, height: 864 }, video: { width: 1920, height: 1080 } },
  phone: { viewport: { width: 405, height: 720 }, video: { width: 1080, height: 1920 }, mobile: true },
};

/** Run one scene in a fresh context that records itself. */
const redo = process.argv.includes("--redo");
async function scene(browser, name, kind, fn, { firstVisit = false } = {}) {
  if (only && !name.includes(only)) return;
  if (!redo && existsSync(join(OUT, `${name}.webm`)) && marks.some((m) => m.scene === name)) {
    console.log(`\n▷ ${name}: already recorded (pass --redo to record again)`);
    return;
  }
  // a re-take replaces the old marks for this scene
  for (let i = marks.length - 1; i >= 0; i--) if (marks[i].scene === name) marks.splice(i, 1);
  const s = SIZES[kind];
  console.log(`\n▶ ${name} (${kind})`);
  const ctx = await browser.newContext({
    viewport: s.viewport,
    deviceScaleFactor: 1,
    hasTouch: Boolean(s.mobile),
    isMobile: Boolean(s.mobile),
    recordVideo: { dir: OUT, size: s.video },
    colorScheme: "light",
  });
  const page = await ctx.newPage();
  // the first-visit card only shows to a person; these scenes are people
  await page.addInitScript((first) => {
    if (first) Object.defineProperty(navigator, "webdriver", { get: () => false });
    else localStorage.setItem("ab:help:seen", String(Date.now()));
  }, firstVisit);
  const t0 = Date.now();
  try {
    await fn(page, (note) => mark(name, note, t0), t0);
  } catch (e) {
    console.log(`  ! ${name}: ${String(e).slice(0, 200)}`);
    marks.push({ scene: name, t: (Date.now() - t0) / 1000, note: "ERROR " + String(e).slice(0, 120) });
  }
  await sleep(800);
  const video = page.video();
  await ctx.close();
  if (video) {
    const p = await video.path();
    const dest = join(OUT, `${name}.webm`);
    if (existsSync(dest)) renameSync(dest, dest.replace(/\.webm$/, `.${Date.now()}.webm`));
    renameSync(p, dest);
    console.log(`  → ${dest}`);
  }
  saveMarks();
}

const ready = async (page) => {
  await page.waitForSelector('html[data-convex="ready"]', { timeout: 30_000 });
  await page.waitForSelector("[data-world]", { state: "attached", timeout: 30_000 });
  await sleep(900);
};

/** ⇧⌘-click the given locator (desktop): the chord that points at one thing. */
async function chordClick(page, locator) {
  const box = await locator.boundingBox();
  await page.keyboard.down("Shift");
  await page.keyboard.down("Meta");
  await page.mouse.move(box.x + box.width * 0.4, box.y + box.height * 0.5, { steps: 12 });
  await sleep(500);
  await page.mouse.click(box.x + box.width * 0.4, box.y + box.height * 0.5);
  await page.keyboard.up("Meta");
  await page.keyboard.up("Shift");
}

async function typeSlow(page, text) {
  const box = page.getByRole("dialog", { name: /ask for a change/i });
  const ta = box.getByRole("textbox");
  await ta.click();
  await ta.type(text, { delay: 38 });
}

/** Jump the camera to a block through the map (the map is open by default on desktop). */
async function goToBlock(page, id) {
  const chip = page.locator(`[data-map-block="${id}"]`);
  if ((await chip.count()) === 0) return;
  await chip.dispatchEvent("pointerdown");
  await sleep(700);
}

const browser = await chromium.launch();
const recent = (await q("votes:recentChanges", { limit: 40 })) ?? [];
const gta = recent.find((c) => c.blockIds?.includes("gta-browser"));
console.log("gta change:", gta ? gta.requestId : "(not found)");

// ---------- desktop ----------

await scene(browser, "desktop-landing", "desktop", async (page, m) => {
  await page.goto(URL_);
  await ready(page);
  m("landed");
  await page.waitForSelector("[data-canvas-howto][data-first-visit]", { timeout: 6000 }).catch(() => {});
  m("card");
  await sleep(3200);
  await page.mouse.click(700, 200); // the ground: the card closes, the wall stays
  m("card closed");
  await sleep(600);
  for (const k of ["ArrowRight", "ArrowRight", "ArrowDown"]) {
    await page.keyboard.press(k);
    await sleep(700);
  }
  m("walked");
  const label = page.locator("[data-world] .object-label").first();
  if ((await label.count()) > 0) {
    const b = await label.boundingBox();
    if (b) await page.mouse.move(b.x + 20, b.y + 10, { steps: 20 });
  }
  await sleep(1800);
  m("end");
}, { firstVisit: true });

let askedId = null;
await scene(browser, "desktop-loop", "desktop", async (page, m) => {
  await page.goto(URL_);
  await ready(page);
  await goToBlock(page, "thanks-for-visiting");
  m("at the game");
  await sleep(900);
  const target = page.locator('[data-ab-block="thanks-for-visiting"]').first();
  await chordClick(page, target);
  m("pointed");
  const box = page.getByRole("dialog", { name: /ask for a change/i });
  await box.waitFor({ state: "visible", timeout: 8000 });
  await sleep(900);
  await typeSlow(page, "Make this thank everyone who changed something this week, in one warm line.");
  m("typed");
  await sleep(700);
  await box.getByRole("button", { name: /^send/i }).first().click();
  m("sent");
  await box.getByText(/judging/i).waitFor({ state: "visible", timeout: 15_000 }).catch(() => {});
  m("judging");
  await box.getByText(/^(Approved\. Building now\.|It's live\.|Up for a vote\.|Not this time\.|It didn't make it\.)$/).first().waitFor({ state: "visible", timeout: 60_000 }).catch(() => {});
  m("verdict");
  await sleep(2500);
  // find the request so the live scene can come back to it
  const active = (await q("requests:active", { roomId: "main" })) ?? [];
  const mine = active.find((r) => /thank everyone who changed something/i.test(r.prompt ?? ""));
  askedId = mine?.id ?? null;
  m(`request ${askedId ?? "?"}`);
});

if (!askedId && prior.asked) askedId = prior.asked;
if (askedId && !(only && !"desktop-live".includes(only))) {
  // wait, without recording, for the change to land (a real build: about two minutes)
  console.log("\n… waiting for the change to land");
  const t0 = Date.now();
  let live = false;
  while (Date.now() - t0 < 6 * 60_000) {
    const active = (await q("requests:active", { roomId: "main" })) ?? [];
    const still = active.find((r) => r.id === askedId);
    if (!still) {
      live = true;
      break;
    }
    process.stdout.write(`   ${still.status} ${Math.round((Date.now() - t0) / 1000)}s\r`);
    await sleep(5000);
  }
  console.log(live ? `\n   landed after ${Math.round((Date.now() - t0) / 1000)}s` : "\n   did not land in 6 min");
  marks.push({ scene: "desktop-live", t: 0, note: `build took ${Math.round((Date.now() - t0) / 1000)}s` });
}

await scene(browser, "desktop-live", "desktop", async (page, m) => {
  await page.goto(`${URL_}/c/${askedId ?? (gta?.requestId ?? "")}`);
  await ready(page);
  m("share page");
  await page.waitForSelector("[data-focus]", { timeout: 20_000 }).catch(() => {});
  await sleep(3500);
  m("ringed");
  await page.goto(`${URL_}/leaderboard`);
  await page.waitForSelector("text=Changes", { timeout: 20_000 }).catch(() => {});
  await sleep(800);
  const row = page.locator("li", { hasText: /thank/i }).first();
  if ((await row.count()) > 0) {
    await row.scrollIntoViewIfNeeded();
    const b = await row.boundingBox();
    if (b) await page.mouse.move(b.x + 200, b.y + b.height / 2, { steps: 15 });
    m("ledger row");
    await sleep(2200);
    const pr = row.getByRole("link", { name: /PR/ });
    if ((await pr.count()) > 0) {
      const href = await pr.getAttribute("href");
      if (href) {
        await page.goto(href);
        m("github");
        await sleep(3500);
      }
    }
  }
});

await scene(browser, "desktop-gta", "desktop", async (page, m) => {
  await page.goto(`${URL_}/c/${gta?.requestId ?? ""}`);
  await ready(page);
  m("share page");
  await page.waitForSelector("[data-focus]", { timeout: 20_000 }).catch(() => {});
  await sleep(3000);
  m("ringed");
  const game = page.locator('[data-ab-block="gta-browser"]').first();
  const start = game.getByRole("button", { name: /start|play|go/i }).first();
  if ((await start.count()) > 0) await start.click();
  else await game.click({ position: { x: 40, y: 120 } });
  m("game tapped");
  await sleep(400);
  const keys = ["ArrowUp", "ArrowUp", "ArrowLeft", "ArrowUp", "ArrowRight", "ArrowUp", "ArrowUp", "ArrowLeft", "ArrowUp", "ArrowUp"];
  for (const k of keys) {
    await page.keyboard.down(k);
    await sleep(380);
    await page.keyboard.up(k);
    await sleep(120);
  }
  m("drove");
  await sleep(1200);
});

await scene(browser, "desktop-timelapse", "desktop", async (page, m) => {
  await page.goto(`${URL_}/timelapse`);
  await page.waitForSelector("text=/change by change/i", { timeout: 20_000 }).catch(() => {});
  await sleep(1200);
  const play = page.getByRole("button", { name: /play/i }).first();
  if ((await play.count()) > 0) await play.click();
  m("play");
  await sleep(11_500);
  m("end");
});

await scene(browser, "desktop-rules", "desktop", async (page, m) => {
  await page.goto(`${URL_}/rules`);
  await sleep(1200);
  m("rules");
  for (let i = 0; i < 6; i++) {
    await page.mouse.wheel(0, 260);
    await sleep(650);
  }
  m("scrolled");
  await page.goto(URL_);
  await ready(page);
  await goToBlock(page, "welcome-message");
  const target = page.locator('[data-ab-block="welcome-message"], [data-ab-block="thanks-for-visiting"]').first();
  await chordClick(page, target);
  const box = page.getByRole("dialog", { name: /ask for a change/i });
  await box.waitFor({ state: "visible", timeout: 8000 });
  await sleep(700);
  await typeSlow(page, "Add a link to my startup https://coolapp.io please");
  m("typed promo");
  await box.getByRole("button", { name: /^send/i }).first().click();
  m("sent promo");
  await box.getByText(/^(Approved\. Building now\.|It's live\.|Up for a vote\.|Not this time\.|It didn't make it\.)$/).first().waitFor({ state: "visible", timeout: 60_000 }).catch(() => {});
  m("verdict");
  await sleep(3200);
  await page.goto(`${URL_}/leaderboard`);
  await page.waitForSelector("text=/up for a vote/i", { timeout: 20_000 }).catch(() => {});
  const vote = page.getByText(/up for a vote/i).first();
  if ((await vote.count()) > 0) await vote.scrollIntoViewIfNeeded();
  m("vote board");
  await sleep(3500);
});

await scene(browser, "desktop-map", "desktop", async (page, m) => {
  await page.goto(URL_);
  await ready(page);
  const show = page.getByRole("button", { name: /show the map/i });
  if ((await show.count()) > 0) await show.click();
  m("map");
  await sleep(1000);
  for (const f of ["hot", "new", "mine", "hot"]) {
    const b = page.locator(`[data-map-filter="${f}"]`);
    if ((await b.count()) > 0) await b.click();
    m(`filter ${f}`);
    await sleep(1400);
  }
  const chip = page.locator("[data-map-block]").nth(2);
  if ((await chip.count()) > 0) {
    await chip.dispatchEvent("pointerdown");
    m("teleported");
  }
  await sleep(2000);
});

await scene(browser, "desktop-ledger", "desktop", async (page, m) => {
  await page.goto(`${URL_}/leaderboard`);
  await page.waitForSelector("text=Changes", { timeout: 20_000 }).catch(() => {});
  const h = page.getByRole("heading", { name: /^changes$/i }).first();
  if ((await h.count()) > 0) await h.scrollIntoViewIfNeeded();
  m("changes");
  await sleep(800);
  const rows = page.locator("[data-cost]");
  const n = Math.min(await rows.count(), 4);
  for (let i = 0; i < n; i++) {
    const b = await rows.nth(i).boundingBox();
    if (b) await page.mouse.move(b.x, b.y + 4, { steps: 10 });
    await sleep(700);
  }
  m("costs");
  await sleep(1500);
});

// ---------- phone ----------

await scene(browser, "phone-landing", "phone", async (page, m) => {
  await page.goto(URL_);
  await ready(page);
  m("landed");
  await page.waitForSelector("[data-canvas-howto][data-first-visit]", { timeout: 6000 }).catch(() => {});
  m("card");
  await sleep(3000);
  await page.touchscreen.tap(200, 150);
  m("card closed");
  await sleep(500);
  // swipe to walk, twice
  for (const dx of [-220, -220]) {
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: 300, y: 380 }] });
    for (let i = 1; i <= 10; i++) {
      await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: 300 + (dx * i) / 10, y: 380 }] });
      await sleep(25);
    }
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await cdp.detach();
    await sleep(700);
  }
  m("swiped");
  // long-press a label: the object sheet
  const label = page.locator("[data-world] .object-label").first();
  const b = await label.boundingBox();
  if (b) {
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: b.x + 20, y: b.y + 8 }] });
    await sleep(650);
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await cdp.detach();
    m("long-pressed");
    await sleep(2200);
    const move = page.getByRole("button", { name: /^move$/i }).first();
    if ((await move.count()) > 0) {
      await move.click();
      m("move");
      await sleep(1200);
      await page.keyboard.press("Escape"); // never send the move ask from here
    }
  }
  await sleep(1200);
}, { firstVisit: true });

await scene(browser, "phone-change", "phone", async (page, m) => {
  await page.goto(URL_);
  await ready(page);
  await sleep(600);
  await page.getByRole("button", { name: /^change/i }).first().click();
  m("change");
  await sleep(700);
  const block = page.locator("[data-world] [data-ab-block]:not([data-ab-block='__new__'])").first();
  const b = await block.boundingBox();
  if (b) await page.touchscreen.tap(b.x + b.width / 2, b.y + Math.min(b.height / 2, 120));
  m("tapped a block");
  const box = page.getByRole("dialog", { name: /ask for a change/i });
  await box.waitFor({ state: "visible", timeout: 8000 }).catch(() => {});
  await sleep(600);
  await typeSlow(page, "make this say something braver");
  m("typed");
  await sleep(2000);
  await page.keyboard.press("Escape"); // not sent
});

await browser.close();
saveMarks({ gta: gta?.requestId ?? null, asked: askedId ?? prior.asked ?? null });
console.log(`\nmarks → ${join(OUT, "marks.json")}`);
