import { test, expect } from "@playwright/test";

/** Live cursors: with two people present, one person's pointer shows up for the other. */
const url = process.env.E2E_URL ?? "http://127.0.0.1:5173";

test("a second person's cursor appears on the wall", async ({ browser }) => {
  const a = await (await browser.newContext()).newPage();
  const b = await (await browser.newContext()).newPage();
  for (const p of [a, b]) {
    await p.goto(url);
    await expect(p.locator('html[data-convex="ready"]')).toBeAttached({ timeout: 20_000 });
  }
  // both tabs register as present (cursors turn on at 2+ here); give presence a moment to settle
  await a.waitForTimeout(2500);

  const wall = a.locator("[data-room]");
  const box = (await wall.boundingBox())!;
  for (let i = 0; i < 14; i++) {
    await a.mouse.move(box.x + 120 + i * 18, box.y + 140 + i * 6);
    await a.waitForTimeout(130);
  }
  // the other tab renders a cursor svg inside the wall overlay
  await expect(b.locator("[data-room] svg").first()).toBeVisible({ timeout: 10_000 });

  await a.context().close();
  await b.context().close();
});

test("a cursor over the ground beside the wall still shows for others", async ({ browser }) => {
  test.setTimeout(60_000);
  const a = await (await browser.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
  const w = await (await browser.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
  for (const p of [a, w]) {
    await p.goto(url);
    await expect(p.locator('html[data-convex="ready"]')).toBeAttached({ timeout: 20_000 });
  }
  await a.waitForTimeout(1500);
  const world = (await a.locator("[data-world]").boundingBox())!;
  const vp = (await a.locator(".canvas-viewport").boundingBox())!;
  test.skip(world.x + world.width > vp.x + vp.width - 60, "no ground to the right of the wall at this size");
  // A parks its pointer on the empty ground right of the wall and keeps it alive
  const gx = vp.x + vp.width - 30;
  const gy = world.y + world.height * 0.3;
  for (let k = 0; k < 8; k++) {
    await a.mouse.move(gx - (k % 2), gy);
    await a.waitForTimeout(300);
  }
  const seen = w.locator("[data-world] .cursor-label");
  await expect(seen.first()).toBeAttached({ timeout: 10_000 });
  const left = await seen.first().locator("xpath=..").evaluate((el) => parseFloat((el as HTMLElement).style.left));
  expect(left).toBeGreaterThan(100); // beyond the wall's right edge, and still drawn
});

