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

test("cursors travel in tiles: where A points, W sees a pointer over the same ground", async ({ browser }) => {
  test.setTimeout(60_000);
  const a = await (await browser.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
  const w = await (await browser.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
  for (const p of [a, w]) {
    await p.goto(url);
    await expect(p.locator('html[data-convex="ready"]')).toBeAttached({ timeout: 20_000 });
  }
  await a.waitForTimeout(1500);
  // A keeps its pointer moving on the add zone (empty ground) while W looks for it: cursors only travel once
  // two people are counted here, so the first moves may go unsent
  const add = (await a.locator('[data-ab-block="__new__"]').boundingBox())!;
  const gx = add.x + add.width / 2;
  const gy = add.y + add.height / 2;
  // the tile under A's pointer, through A's camera (the add zone may be floating over the world, so read the ground itself)
  const vp = (await a.locator(".canvas-viewport").boundingBox())!;
  const cam = ((await a.locator("[data-world]").getAttribute("data-cam")) ?? "0,0").split(",").map(Number);
  const tile = [Math.floor((gx - vp.x + cam[0]!) / 360), Math.floor((gy - vp.y + cam[1]!) / 220)];
  let found = false;
  for (let k = 0; k < 80 && !found; k++) {
    await a.mouse.move(gx - (k % 2), gy);
    await a.waitForTimeout(250);
    // W draws it in world px at that tile, whatever W's own camera shows (other tests' pages may be pointing too:
    // one of the cursors W sees is A's, on A's tile)
    const all = await w.locator("[data-world] .cursor-label").evaluateAll((els) => els.map((el) => ({ left: parseFloat((el.parentElement as HTMLElement).style.left), top: parseFloat((el.parentElement as HTMLElement).style.top) })));
    found = all.some((at) => Math.floor(at.left / 360) === tile[0] && Math.floor(at.top / 220) === tile[1]);
  }
  expect(found).toBe(true);
});

