import { test, expect, type Page } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

/**
 * The walkable world: tiles at 100%, no zoom. You land where the action is and walk (drag the ground,
 * arrow keys, the wheel). Tap empty ground to add there; drag out tiles to work on a space; drag an
 * object in pick mode to propose a move; the label opens the object sheet (Change · Move); the map
 * teleports and folds away; the "?" says how; nothing floating ever blocks pointing.
 */
const url = process.env.E2E_URL ?? "http://127.0.0.1:5173";
const TILE_W = 360;
const TILE_H = 220;

async function ready(page: Page) {
  await expect(page.locator('html[data-convex="ready"]')).toBeAttached({ timeout: 20_000 });
  await expect(page.locator("[data-world]")).toBeAttached();
  await page.waitForTimeout(700); // first pack + landing
}

function camOf(attr: string | null): { x: number; y: number } {
  const [x, y] = (attr ?? "0,0").split(",").map(Number);
  return { x: x!, y: y! };
}

/** The screen position of a world point, through the camera. */
async function onScreen(page: Page, wx: number, wy: number) {
  const vp = (await page.locator(".canvas-viewport").boundingBox())!;
  const cam = camOf(await page.locator("[data-world]").getAttribute("data-cam"));
  return { x: vp.x + wx - cam.x, y: vp.y + wy - cam.y };
}

/**
 * Walk until a world point is well inside the viewport, one arrow key per tile. Keys move the world
 * whatever is under the pointer (a drag would not: on the e2e wall the example blocks fill the first
 * screen), and the camera clamps to the known world, so the frontier is always reachable.
 */
async function walkTo(page: Page, wx: number, wy: number) {
  await page.mouse.click(10, 10); // no object has the keys
  const vp = (await page.locator(".canvas-viewport").boundingBox())!;
  const m = 60;
  for (let i = 0; i < 80; i++) {
    const p = await onScreen(page, wx, wy);
    const dx = p.x < vp.x + m ? -1 : p.x > vp.x + vp.width - m ? 1 : 0;
    const dy = p.y < vp.y + m ? -1 : p.y > vp.y + vp.height - m ? 1 : 0;
    if (dx === 0 && dy === 0) return p;
    await page.keyboard.press(dx < 0 ? "ArrowLeft" : dx > 0 ? "ArrowRight" : dy < 0 ? "ArrowUp" : "ArrowDown");
    await page.waitForTimeout(80);
  }
  return onScreen(page, wx, wy);
}

test("the world is tiles at 100%: no zoom anywhere, and you land on a block, not the top-left", async ({ page }) => {
  await page.goto(url);
  await ready(page);
  const world = page.locator("[data-world]");
  await expect(world).toHaveAttribute("data-world", "tiles");
  const style = (await world.getAttribute("style")) ?? "";
  expect(style).not.toMatch(/scale\(/);
  expect(style).toMatch(/translate\(/);
  await expect(page.getByRole("button", { name: "Zoom in" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /fit the whole wall/i })).toHaveCount(0);
  // a block is on screen at its natural size (a one-tile block is ~328px wide)
  const first = page.locator("[data-world] [data-ab-block]:not([data-ab-block='__new__'])").first();
  const box = (await first.boundingBox())!;
  const vp = (await page.locator(".canvas-viewport").boundingBox())!;
  expect(box.width).toBeGreaterThanOrEqual(300);
  expect(box.x + box.width).toBeGreaterThan(vp.x);
  expect(box.x).toBeLessThan(vp.x + vp.width);
  await expect(page.locator("[data-minimap]")).toBeVisible();
  await expect(page.locator("[data-tile-readout]")).toContainText(/tile/i);
});

test("arrow keys walk one tile; the wheel walks too; the world holds still under the composer", async ({ page }) => {
  await page.goto(url);
  await ready(page);
  const world = page.locator("[data-world]");
  const c0 = camOf(await world.getAttribute("data-cam"));
  await page.mouse.click(10, 10); // focus nothing in particular
  await page.keyboard.press("ArrowRight");
  await page.waitForTimeout(400);
  const c1 = camOf(await world.getAttribute("data-cam"));
  expect(c1.x - c0.x).toBeGreaterThan(TILE_W - 40); // one tile (or the edge of the world)
  await page.keyboard.press("ArrowLeft");
  await page.waitForTimeout(400);
  const c2 = camOf(await world.getAttribute("data-cam"));
  expect(Math.abs(c2.x - c0.x)).toBeLessThan(4);
  const vp = (await page.locator(".canvas-viewport").boundingBox())!;
  await page.mouse.move(vp.x + vp.width / 2, vp.y + vp.height / 2);
  await page.mouse.wheel(0, 120);
  await page.waitForTimeout(200);
  const c3 = camOf(await world.getAttribute("data-cam"));
  expect(c3.y).toBeGreaterThan(c2.y);
  // ctrl+wheel used to zoom: now it does nothing
  await page.keyboard.down("Control");
  await page.mouse.wheel(0, -300);
  await page.keyboard.up("Control");
  await page.waitForTimeout(200);
  expect(await world.getAttribute("style")).not.toMatch(/scale\(/);
  expect(camOf(await world.getAttribute("data-cam"))).toEqual(c3);
  // proposing a change: no walking (the add zone may first walk you to its tile, so read the camera once the composer is up)
  await page.locator('[data-ab-block="__new__"]').click();
  const dialog = page.getByRole("dialog", { name: /ask for a change/i });
  await expect(dialog).toBeVisible();
  await page.waitForTimeout(400);
  const c4 = camOf(await world.getAttribute("data-cam"));
  await page.mouse.move(vp.x + vp.width / 2, vp.y + 100);
  await page.mouse.wheel(0, 300);
  await page.waitForTimeout(200);
  expect(camOf(await world.getAttribute("data-cam"))).toEqual(c4);
  await page.keyboard.press("Escape");
});

test("the add zone is always in view and names its tile; the composer opens for that tile", async ({ page }) => {
  await page.goto(url);
  await ready(page);
  const add = page.locator('[data-ab-block="__new__"]');
  await expect(add).toBeVisible();
  const tile = await add.getAttribute("data-tile");
  expect(tile).toMatch(/^-?\d+,-?\d+$/);
  await expect(add).toContainText(new RegExp(`tile ${tile!.replace("-", "\\-")}`, "i"));
  await add.getByText(/add something here/i).click();
  const dialog = page.getByRole("dialog", { name: /ask for a change/i });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText("New block")).toBeVisible();
  await expect(dialog.getByText(`tile ${tile}`)).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
});

test("tap empty ground and the add zone moves there", async ({ page }) => {
  await page.goto(url);
  await ready(page);
  const world = page.locator("[data-world]");
  const bounds = ((await world.getAttribute("data-bounds")) ?? "").split(",").map(Number);
  const add = page.locator('[data-ab-block="__new__"]');
  const before = await add.getAttribute("data-tile");
  // walk to the frontier's top-left corner, which is empty by definition, and tap it
  const fx = bounds[0]!;
  const fy = bounds[1]!;
  const at = await walkTo(page, fx * TILE_W + TILE_W / 2, fy * TILE_H + TILE_H / 2);
  await page.mouse.click(at.x, at.y);
  await page.waitForTimeout(300);
  await expect(add).toHaveAttribute("data-tile", `${fx},${fy}`);
  expect(await add.getAttribute("data-tile")).not.toBe(before);
});

test("drag out tiles and the composer opens for that space, snapped to tiles", async ({ page }) => {
  await page.goto(url);
  await ready(page);
  const world = page.locator("[data-world]");
  const bounds = ((await world.getAttribute("data-bounds")) ?? "").split(",").map(Number);
  // the frontier row above the content is empty ground: drag across it
  const y = bounds[1]! * TILE_H + TILE_H / 2;
  // walk so that row is on screen, then start the drag a little inside the world's left edge on that row
  const x = bounds[0]! * TILE_W + 80;
  await walkTo(page, x + 500, y);
  const start = await walkTo(page, x, y);
  await page.locator("[data-canvas-bar]").getByRole("button", { name: /change something/i }).click();
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(start.x + 500, start.y + 40, { steps: 8 });
  await expect(page.locator("rect[data-map-mark]")).toBeVisible();
  await page.mouse.up();
  const dialog = page.getByRole("dialog", { name: /ask for a change/i });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText("This space")).toBeVisible();
  await expect(dialog.getByText(/tiles -?\d+,-?\d+→-?\d+,-?\d+/)).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
});

test("in pick mode, drag an object and the ask to move it is written for you, in tiles", async ({ page }) => {
  await page.goto(url);
  await ready(page);
  const first = page.locator("[data-world] [data-ab-block]:not([data-ab-block='__new__'])").first();
  const id = (await first.getAttribute("data-ab-block"))!;
  await page.locator(`[data-map-block="${id}"]`).dispatchEvent("pointerdown");
  await page.waitForTimeout(450);
  await page.locator("[data-canvas-bar]").getByRole("button", { name: /change something/i }).click();
  const box = (await first.boundingBox())!;
  await page.mouse.move(box.x + 40, box.y + 40);
  await page.mouse.down();
  await page.mouse.move(box.x + 40 + TILE_W, box.y + 40 + TILE_H, { steps: 10 });
  await page.mouse.up();
  const dialog = page.getByRole("dialog", { name: /ask for a change/i });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("textbox")).toHaveValue(/^Move .* to tile -?\d+,-?\d+/);
  await page.keyboard.press("Escape");
});

test("the object you tap has the keys: arrows steer it, not the world; the ground or Escape gives them back", async ({ page }) => {
  await page.goto(url);
  await ready(page);
  const game = page.locator('[data-ab-block="dino-game"]');
  test.skip((await game.count()) === 0, "no dino on this wall");
  await page.locator('[data-map-block="dino-game"]').dispatchEvent("pointerdown");
  await page.waitForTimeout(450);
  const world = page.locator("[data-world]");
  await expect(game).toHaveAttribute("data-active", "1"); // going to it hands it the keys
  await expect(page.locator('[data-object-label="dino-game"] [data-object-keys]')).toBeVisible();
  await expect(page.locator("[data-walk-hint]")).toHaveAttribute("data-walk-hint", "keys");
  const c0 = camOf(await world.getAttribute("data-cam"));
  await page.keyboard.press("ArrowRight");
  await page.waitForTimeout(350);
  expect(camOf(await world.getAttribute("data-cam"))).toEqual(c0); // the game has the arrows
  await page.keyboard.press("Escape");
  await expect(game).not.toHaveAttribute("data-active", "1");
  await page.keyboard.press("ArrowRight");
  await page.waitForTimeout(350);
  expect(camOf(await world.getAttribute("data-cam")).x).toBeGreaterThan(c0.x); // the world walks again
  // tapping the block's body hands it the keys again; tapping the ground takes them back
  const box = (await game.boundingBox())!;
  await page.mouse.click(box.x + box.width / 2, box.y + 30);
  await expect(game).toHaveAttribute("data-active", "1");
  const add = (await page.locator('[data-ab-block="__new__"]').boundingBox())!;
  const vp = (await page.locator(".canvas-viewport").boundingBox())!;
  // some ground: just above the bar, far left, unless a block sits there
  const gx = vp.x + 30;
  const gy = vp.y + vp.height - 120;
  const onBlock = await page.evaluate(([x, y]) => Boolean(document.elementFromPoint(x, y)?.closest("[data-ab-block]")), [gx, gy]);
  if (!onBlock) {
    await page.mouse.click(gx, gy);
    await expect(game).not.toHaveAttribute("data-active", "1");
  } else {
    await page.mouse.click(add.x + 8, add.y + 8); // the add zone is ground too, and opens the composer
    await page.keyboard.press("Escape");
  }
});

test("the label is the handle: it opens the object sheet, Change opens the composer, Move asks where", async ({ page }) => {
  await page.goto(url);
  await ready(page);
  const first = page.locator("[data-world] [data-ab-block]:not([data-ab-block='__new__'])").first();
  const id = (await first.getAttribute("data-ab-block"))!;
  await page.locator(`[data-map-block="${id}"]`).dispatchEvent("pointerdown");
  await page.waitForTimeout(450);
  const label = page.locator(`[data-object-label="${id}"]`);
  await expect(label).toBeVisible();
  await expect(label).toContainText(/\d×\d/);
  await label.click();
  const sheet = page.locator(`[data-object-sheet="${id}"]`);
  await expect(sheet).toBeVisible();
  await expect(sheet.locator("[data-sheet-facts]")).toHaveText(/(@[\w·\- ]+|someone) made this.*(stays|faded|fades today|days? left)/);
  await sheet.getByRole("button", { name: "Change" }).click();
  const dialog = page.getByRole("dialog", { name: /ask for a change/i });
  await expect(dialog).toBeVisible();
  await expect(sheet).toHaveCount(0);
  await expect(dialog.locator("[data-composer-facts]")).toHaveText(/made this.*(stays|faded|days? left)/);
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();

  await label.click();
  await expect(sheet).toBeVisible();
  await sheet.getByRole("button", { name: "Move" }).click();
  await expect(page.locator(".move-hint")).toBeVisible();
  // tap the add zone's tile (free ground): the move is proposed there
  const add = page.locator('[data-ab-block="__new__"]');
  const tile = (await add.getAttribute("data-tile"))!;
  const abox = (await add.boundingBox())!;
  await page.mouse.click(abox.x + abox.width / 2, abox.y + abox.height / 2);
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("textbox")).toHaveValue(new RegExp(`^Move .* to tile ${tile.replace("-", "\\-")}`));
  await page.keyboard.press("Escape");
});

test("the map is a teleport pad: every object on it, a tap jumps, the filters light things up", async ({ page }) => {
  await page.goto(url);
  await ready(page);
  const rects = page.locator("[data-map-block]");
  expect(await rects.count()).toBeGreaterThan(0);
  const world = page.locator("[data-world]");
  const before = await world.getAttribute("data-cam");
  await rects.last().dispatchEvent("pointerdown");
  await page.waitForTimeout(400);
  expect(await world.getAttribute("data-cam")).not.toBe(before);
  // the block we jumped to is on screen
  const id = (await rects.last().getAttribute("data-map-block"))!;
  const box = (await page.locator(`[data-ab-block="${id}"]`).boundingBox())!;
  const vp = (await page.locator(".canvas-viewport").boundingBox())!;
  expect(box.x).toBeGreaterThanOrEqual(vp.x - 1);
  expect(box.x + box.width).toBeLessThanOrEqual(vp.x + vp.width + 1);
  // filters
  await page.locator('[data-map-filter="new"]').click();
  await expect(page.locator('[data-map-filter="new"]')).toHaveAttribute("aria-pressed", "true");
  await page.locator('[data-map-filter="new"]').click();
  await expect(page.locator('[data-map-filter="new"]')).toHaveAttribute("aria-pressed", "false");
  await expect(page.locator(".minimap-view")).toBeVisible();
});

test("a deep link lands on its tile", async ({ page }) => {
  await page.goto(url + "/t/4,-2");
  await ready(page);
  await expect(page.locator("[data-world]")).toHaveAttribute("data-tile", "4,-2");
  await expect(page.locator("[data-tile-readout]")).toContainText("4,-2");
});

test("a signed-out visitor's stroke on the open canvas survives a reload", async ({ page }) => {
  test.setTimeout(90_000);
  // a refused store write is silent on the page; surface it here so a failure explains itself
  page.on("console", (m) => {
    if (m.text().includes("[kit store]")) console.log("PAGE:", m.text().slice(0, 240));
  });
  await page.goto(url);
  await ready(page);
  const chip = page.locator('[data-map-block="collaborative-art"]');
  test.skip((await chip.count()) === 0, "no open canvas on this wall");
  await chip.dispatchEvent("pointerdown");
  await page.waitForTimeout(500);
  const art = page.locator('[data-ab-block="collaborative-art"] canvas');
  await expect(art).toBeVisible();
  await expect(page.locator('[data-ab-block="collaborative-art"] [data-art-live]')).toHaveAttribute("data-art-live", "1", { timeout: 5_000 });
  await expect(page.locator('[data-ab-block="collaborative-art"]')).not.toContainText(/zoom in to draw|loading strokes/, { timeout: 15_000 });
  const box = (await art.boundingBox())!;
  const before = (await page.locator('[data-ab-block="collaborative-art"]').innerText()).match(/(\d+) strokes?/)?.[1] ?? "0";
  await page.mouse.move(box.x + box.width * 0.3, box.y + box.height * 0.5);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.6, box.y + box.height * 0.6, { steps: 8 });
  await page.mouse.up();
  await expect(page.locator('[data-ab-block="collaborative-art"]')).toContainText(new RegExp(`${Number(before) + 1} strokes?`), { timeout: 15_000 });
  await page.reload();
  await ready(page);
  await expect(page.locator('[data-ab-block="collaborative-art"]')).toContainText(new RegExp(`${Number(before) + 1} strokes?`), { timeout: 20_000 });

  // and the eraser rubs it out again (a vertical sweep across the stroke's path)
  await page.locator('[data-map-block="collaborative-art"]').dispatchEvent("pointerdown");
  await page.waitForTimeout(500);
  const block = page.locator('[data-ab-block="collaborative-art"]');
  await block.getByRole("button", { name: "eraser" }).click();
  const box2 = (await art.boundingBox())!;
  await page.mouse.move(box2.x + box2.width * 0.45, box2.y + box2.height * 0.35);
  await page.mouse.down();
  await page.mouse.move(box2.x + box2.width * 0.45, box2.y + box2.height * 0.75, { steps: 12 });
  await page.mouse.up();
  // the eraser is circular and splits what it crosses (PR #18), so the count moves: down for a short stroke, up for a split
  await expect
    .poll(async () => Number((await block.innerText()).match(/(\d+) strokes?/)?.[1] ?? NaN), { timeout: 15_000 })
    .not.toBe(Number(before) + 1);
  // and undo puts it back exactly as it was
  await block.getByRole("button", { name: "undo erase" }).click();
  await expect
    .poll(async () => Number((await block.innerText()).match(/(\d+) strokes?/)?.[1] ?? NaN), { timeout: 15_000 })
    .toBe(Number(before) + 1);
  await expect(block.getByRole("button", { name: "undo erase" })).toHaveCount(0);
});

test("anyone can erase anyone's stroke: a second visitor rubs out the first one's", async ({ browser }) => {
  test.setTimeout(120_000);
  const a = await (await browser.newContext()).newPage();
  const b = await (await browser.newContext()).newPage();
  await a.goto(url);
  await ready(a);
  test.skip((await a.locator('[data-map-block="collaborative-art"]').count()) === 0, "no open canvas on this wall");
  const count = async (page: Page) => Number((await page.locator('[data-ab-block="collaborative-art"]').innerText()).match(/(\d+) strokes?/)?.[1] ?? NaN);
  const jump = async (page: Page) => {
    await page.locator('[data-map-block="collaborative-art"]').dispatchEvent("pointerdown");
    await page.waitForTimeout(500);
    // the live strokes, not the baked picture's count from a minute ago
    await expect(page.locator('[data-ab-block="collaborative-art"] [data-art-live]')).toHaveAttribute("data-art-live", "1", { timeout: 5_000 });
    await expect(page.locator('[data-ab-block="collaborative-art"]')).not.toContainText(/zoom in to draw|loading strokes/, { timeout: 15_000 });
    return (await page.locator('[data-ab-block="collaborative-art"] canvas').boundingBox())!;
  };
  const boxA = await jump(a);
  const start = await count(a);
  await a.mouse.move(boxA.x + boxA.width * 0.2, boxA.y + boxA.height * 0.25);
  await a.mouse.down();
  await a.mouse.move(boxA.x + boxA.width * 0.4, boxA.y + boxA.height * 0.25, { steps: 8 });
  await a.mouse.up();
  await expect(a.locator('[data-ab-block="collaborative-art"]')).toContainText(new RegExp(`${start + 1} strokes?`), { timeout: 15_000 });

  await b.goto(url);
  await ready(b);
  const boxB = await jump(b);
  await expect.poll(() => count(b), { timeout: 15_000 }).toBe(start + 1);
  await b.locator('[data-ab-block="collaborative-art"]').getByRole("button", { name: "eraser" }).click();
  await b.mouse.move(boxB.x + boxB.width * 0.3, boxB.y + boxB.height * 0.1);
  await b.mouse.down();
  await b.mouse.move(boxB.x + boxB.width * 0.3, boxB.y + boxB.height * 0.45, { steps: 12 });
  await b.mouse.up();
  // B's eraser changed A's stroke (split or gone), and A sees the same picture B does
  await expect.poll(() => count(b), { timeout: 15_000 }).not.toBe(start + 1);
  const seenByB = await count(b);
  await expect.poll(() => count(a), { timeout: 15_000 }).toBe(seenByB);
});

test("a block marked removed is off the wall and off the map", async ({ page }) => {
  await page.goto(url);
  await ready(page);
  await expect(page.locator('[data-ab-block="hello-note-6e0z"]')).toHaveCount(0);
  await expect(page.locator('[data-map-block="hello-note-6e0z"]')).toHaveCount(0);
});

test("in pick mode a drag over the open canvas picks, it does not draw", async ({ page }) => {
  await page.goto(url);
  await ready(page);
  const chip = page.locator('[data-map-block="collaborative-art"]');
  test.skip((await chip.count()) === 0, "no open canvas on this wall");
  await chip.dispatchEvent("pointerdown");
  await page.waitForTimeout(500);
  const block = page.locator('[data-ab-block="collaborative-art"]');
  await expect(block.locator("[data-art-live]")).toHaveAttribute("data-art-live", "1", { timeout: 5_000 });
  await expect(block).not.toContainText(/zoom in to draw|loading strokes/, { timeout: 15_000 });
  const before = (await block.innerText()).match(/(\d+) strokes?/)?.[1] ?? "0";
  await page.locator("[data-canvas-bar]").getByRole("button", { name: /change something/i }).click();
  const box = (await block.locator("canvas").boundingBox())!;
  await page.mouse.move(box.x + box.width * 0.3, box.y + box.height * 0.5);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.6, box.y + box.height * 0.6, { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(1500);
  await expect(block).toContainText(new RegExp(`${before} strokes?`)); // nothing drawn
  await page.keyboard.press("Escape");
});

test("the open canvas is live when it is on screen", async ({ page }) => {
  await page.goto(url);
  await ready(page);
  const wrap = page.locator('[data-ab-block="collaborative-art"] [data-art-live]');
  test.skip((await wrap.count()) === 0, "no open canvas on this wall");
  await page.locator('[data-map-block="collaborative-art"]').dispatchEvent("pointerdown");
  await expect(wrap).toHaveAttribute("data-art-live", "1", { timeout: 5_000 }); // two tiles wide at 100%: live strokes
});

test("the map folds to a chip, remembers it, and opens again", async ({ page }) => {
  await page.goto(url);
  await ready(page);
  const map = page.locator("[data-minimap]");
  await expect(map).toHaveAttribute("data-minimap-open", "1");
  expect(await page.locator("[data-map-block]").count()).toBeGreaterThan(0);
  await page.getByRole("button", { name: /hide the map/i }).click();
  await expect(map).toHaveAttribute("data-minimap-open", "0");
  await expect(map).toBeVisible();
  await expect(page.locator("[data-map-block]")).toHaveCount(0);
  await page.reload();
  await ready(page);
  await expect(page.locator("[data-minimap]")).toHaveAttribute("data-minimap-open", "0");
  await page.getByRole("button", { name: /show the map/i }).click();
  await expect(page.locator("[data-minimap]")).toHaveAttribute("data-minimap-open", "1");
  expect(await page.locator("[data-map-block]").count()).toBeGreaterThan(0);
});

test("the map shows what you point at: a hovered block, a tile", async ({ page }) => {
  await page.goto(url);
  await ready(page);
  const first = page.locator("[data-world] [data-ab-block]:not([data-ab-block='__new__'])").first();
  const id = (await first.getAttribute("data-ab-block"))!;
  await page.locator(`[data-map-block="${id}"]`).dispatchEvent("pointerdown");
  await page.waitForTimeout(450);
  await page.locator("[data-canvas-bar]").getByRole("button", { name: /change something/i }).click();
  const box = (await first.boundingBox())!;
  await page.mouse.move(box.x + 30, box.y + 30);
  await expect(page.locator(`[data-map-block="${id}"]`)).toHaveClass(/is-hot/);
  await page.keyboard.press("Escape");
  await page.locator('[data-ab-block="__new__"]').click();
  await expect(page.getByRole("dialog", { name: /ask for a change/i })).toBeVisible();
  await expect(page.locator("circle[data-map-mark]")).toBeVisible();
  await page.keyboard.press("Escape");
});

test("a faded object is listed on the map, and a click there brings it back", async ({ page }) => {
  test.setTimeout(120_000);
  const env = existsSync(".env.local") ? readFileSync(".env.local", "utf8") : "";
  test.skip(!/CONVEX_DEPLOYMENT=/.test(env), "needs the dev deployment (npx convex run)");
  await page.goto(url);
  await ready(page);
  // an object that can fade: the last unpinned one on the wall
  const candidates = page.locator("[data-world] [data-ab-block]:not([data-ab-block='__new__']):not([data-ab-left='pinned'])");
  test.skip((await candidates.count()) === 0, "nothing on this wall can fade");
  const id = (await candidates.last().getAttribute("data-ab-block"))!;
  const run = (fn: string, args: object) => execFileSync("npx", ["convex", "run", fn, JSON.stringify(args)], { stdio: "pipe" });
  run("life:fade", { blockId: id });
  try {
    await expect(page.locator(`[data-world] [data-ab-block="${id}"]`)).toHaveCount(0, { timeout: 15_000 });
    await expect(page.locator(`[data-map-block="${id}"]`)).toHaveCount(0);
    const revive = page.locator(`[data-map-faded="${id}"]`);
    await expect(revive).toBeVisible();
    await revive.click();
    await expect(page.locator(`[data-world] [data-ab-block="${id}"]`)).toHaveCount(1, { timeout: 15_000 });
    await expect(page.locator(`[data-map-block="${id}"]`)).toHaveCount(1);
    await expect(page.locator("[data-map-faded-list]")).toHaveCount(0);
  } finally {
    // whatever happened, the object is back for the next test
    run("life:touchInternal", { roomId: "main", blockIds: [id] });
  }
});

test("the placard and the composer say who made an object and how long it has left", async ({ page }) => {
  await page.goto(url);
  await ready(page);
  const first = page.locator("[data-world] [data-ab-block]:not([data-ab-block='__new__'])").first();
  const id = (await first.getAttribute("data-ab-block"))!;
  await expect(first).toHaveAttribute("data-ab-left", /pinned|faded|^\d+$/);
  await page.locator(`[data-map-block="${id}"]`).dispatchEvent("pointerdown");
  await page.waitForTimeout(450);
  await page.locator("[data-canvas-bar]").getByRole("button", { name: /change something/i }).click();
  const box = (await first.boundingBox())!;
  await page.mouse.move(box.x + 30, box.y + 30);
  const facts = page.locator("[data-placard-facts]");
  await expect(facts).toBeVisible();
  await expect(facts).toHaveText(/(@[\w·\- ]+|someone).*(pinned|faded|\d+d left)/);
  await page.mouse.click(box.x + 30, box.y + 30);
  const dialog = page.getByRole("dialog", { name: /ask for a change/i });
  await expect(dialog).toBeVisible();
  await expect(dialog.locator("[data-composer-facts]")).toHaveText(/made this.*(stays|faded|days? left)/);
  await page.keyboard.press("Escape");
});

test("the ? says how, and opens the full story", async ({ page }) => {
  await page.goto(url);
  await ready(page);
  await page.getByRole("button", { name: /how to use the canvas/i }).click();
  const pop = page.locator("[data-canvas-howto]");
  await expect(pop).toBeVisible();
  await expect(pop.getByText(/walk it/i)).toBeVisible();
  await pop.getByRole("button", { name: /the full story/i }).click();
  const help = page.getByRole("dialog", { name: /how this works/i });
  await expect(help).toBeVisible();
  expect((await help.boundingBox())!.height).toBeGreaterThan(300);
  await page.keyboard.press("Escape");
  await expect(help).toBeHidden();
  await page.getByRole("button", { name: /how to use the canvas/i }).click();
  await expect(pop).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(pop).toBeHidden();
});

test("Live lives in the bar and opens the feed", async ({ page }) => {
  await page.goto(url);
  await ready(page);
  const live = page.getByRole("button", { name: /^live/i });
  await expect(live).toHaveCount(1);
  await expect(page.locator("[data-canvas-bar] [data-live-button]")).toBeVisible();
  await live.click();
  await expect(page.getByRole("dialog", { name: /live feed/i })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: /live feed/i })).toBeHidden();
});

test("while pointing, the map lets a marquee through", async ({ page }) => {
  await page.goto(url);
  await ready(page);
  await page.locator("[data-canvas-bar]").getByRole("button", { name: /change something/i }).click();
  await expect(page.locator("[data-minimap]")).toHaveCSS("pointer-events", "none");
  await expect(page.locator(".walk-hint")).toHaveCSS("pointer-events", "none");
  await page.keyboard.press("Escape");
});

test("when a change lands after the tab loaded, the page refreshes itself when you pause and comes back where you were", async ({ page }) => {
  // the first answers (this tab's baseline; dev strict mode asks twice) are one build, then a newer one lands
  let first = 0;
  await page.route("**/version.json*", (route) => {
    first ||= Date.now();
    void route.fulfill({ json: { sha: Date.now() - first < 1500 ? "aaaaaaa" : "bbbbbbb", at: Date.now() } });
  });
  await page.goto(url);
  await ready(page);
  // walk somewhere, so the quiet refresh has something to bring back
  await page.mouse.click(10, 10);
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowDown");
  await page.waitForTimeout(500);
  const walked = await page.locator("[data-world]").getAttribute("data-cam");
  // the next poll (every few seconds under the e2e flag) answers with a different build: the page refreshes
  // itself once the person pauses (the test's clicks count as activity, so a short pause first)
  await page.waitForEvent("load", { timeout: 20_000 });
  await ready(page);
  expect(await page.locator("[data-new-build]").count()).toBe(0); // there is no button; it just happens
  expect(await page.locator("[data-world]").getAttribute("data-cam")).toBe(walked); // came back where it was, not re-landed
});

test.describe("phones", () => {
  test.use({ viewport: { width: 390, height: 800 }, hasTouch: true, isMobile: true });
  test("one tile across at 100%, a neighbour strip, the big Change, and a long-press opens the sheet", async ({ page }) => {
    await page.goto(url);
    await ready(page);
    const first = page.locator("[data-world] [data-ab-block]:not([data-ab-block='__new__'])").first();
    const box = (await first.boundingBox())!;
    expect(box.width).toBeGreaterThanOrEqual(300); // readable, not a thumbnail
    expect(box.width).toBeLessThanOrEqual(390);
    await expect(page.locator(".neighbour-strip")).toBeVisible();
    await expect(page.locator(".neighbour-strip .here")).toContainText(/tile -?\d+,-?\d+/);
    await expect(page.getByRole("button", { name: "Zoom in" })).toHaveCount(0);
    // a block whose label is on screen (walk right until there is one)
    const vp = (await page.locator(".canvas-viewport").boundingBox())!;
    let id: string | null = null;
    let at: { x: number; y: number } | null = null;
    for (let i = 0; i < 6 && !id; i++) {
      for (const el of await page.locator("[data-object-label]").all()) {
        const b = await el.boundingBox();
        // on screen, and clear of the strip, the pill, and the bar along the bottom
        if (b && b.y > vp.y + 4 && b.y + b.height < vp.y + vp.height - 170 && b.x >= vp.x && b.x + 40 < vp.x + vp.width) {
          id = await el.getAttribute("data-object-label");
          at = { x: b.x + 20, y: b.y + b.height / 2 };
          break;
        }
      }
      if (!id) {
        await page.locator(".neighbour-strip button").last().tap();
        await page.waitForTimeout(400);
      }
    }
    expect(id).not.toBeNull();
    await page.touchscreen.tap(at!.x, at!.y);
    await expect(page.locator(`[data-object-sheet="${id}"]`)).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.locator(`[data-object-sheet="${id}"]`)).toHaveCount(0);
  });
});
