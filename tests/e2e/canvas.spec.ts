import { test, expect, type Page } from "@playwright/test";

/**
 * The bounded canvas: a fixed world you zoom and pan; drag out a space to work on it; click a point to
 * add there; drag an object in pick mode to propose a move; the map jumps to a block and folds away;
 * the "?" says how; nothing floating ever blocks pointing.
 */
const url = process.env.E2E_URL ?? "http://127.0.0.1:5173";

async function ready(page: Page) {
  await expect(page.locator('html[data-convex="ready"]')).toBeAttached({ timeout: 20_000 });
  await expect(page.locator("[data-world]")).toBeAttached();
  await page.waitForTimeout(600); // fit + first pack
}

function zoomOf(style: string | null): number {
  const m = style?.match(/scale\(([\d.]+)\)/);
  return m ? Number(m[1]) : 1;
}

test("a fixed world, fitted on load; the bar zooms in and out and fits again", async ({ page }) => {
  await page.goto(url);
  await ready(page);
  const world = page.locator("[data-world]");
  const size = await world.getAttribute("data-world");
  expect(size).toMatch(/^2400x\d+$/);
  const z0 = zoomOf(await world.getAttribute("style"));
  expect(z0).toBeLessThan(1);
  await page.getByRole("button", { name: "Zoom in" }).click();
  await page.getByRole("button", { name: "Zoom in" }).click();
  const z1 = zoomOf(await world.getAttribute("style"));
  expect(z1).toBeGreaterThan(z0);
  await page.getByRole("button", { name: /fit the whole wall/i }).click();
  const z2 = zoomOf(await world.getAttribute("style"));
  expect(z2).toBeLessThan(z1);
  expect(Math.abs(z2 - z0)).toBeLessThan(0.05); // heights settle a little between fits
  await expect(page.locator("[data-minimap]")).toBeVisible();
});

test("drag out a space and the composer opens for that space; click a point and it opens for that point", async ({ page }) => {
  await page.goto(url);
  await ready(page);
  const world = page.locator("[data-world]");
  const box = (await world.boundingBox())!;
  const [, hStr] = (await world.getAttribute("data-world"))!.split("x");
  const zoom = box.width / 2400;
  const contentBottom = Number(await world.getAttribute("data-content-bottom"));
  // the band between the packed content and the add zone is always empty
  const yWorld = contentBottom + 50;
  expect(yWorld).toBeLessThan(Number(hStr) - 220);
  const y = box.y + yWorld * zoom;
  const describe = page.locator("[data-canvas-bar]").getByRole("button", { name: /change something/i });
  await describe.click();
  await page.mouse.move(box.x + 200 * zoom, y);
  await page.mouse.down();
  await page.mouse.move(box.x + 900 * zoom, y + 60 * zoom, { steps: 8 });
  await page.mouse.up();
  const dialog = page.getByRole("dialog", { name: /ask for a change/i });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText("This space")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();

  await describe.click();
  await page.mouse.click(box.x + 1200 * zoom, y);
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText("New block")).toBeVisible();
  await page.keyboard.press("Escape");
});

test("a skinny drag is still a space", async ({ page }) => {
  await page.goto(url);
  await ready(page);
  const world = page.locator("[data-world]");
  const box = (await world.boundingBox())!;
  const zoom = box.width / 2400;
  const contentBottom = Number(await world.getAttribute("data-content-bottom"));
  const y = box.y + (contentBottom + 50) * zoom;
  await page.locator("[data-canvas-bar]").getByRole("button", { name: /change something/i }).click();
  await page.mouse.move(box.x + 200 * zoom, y);
  await page.mouse.down();
  await page.mouse.move(box.x + 1400 * zoom, y + 3, { steps: 8 }); // a long, thin line
  await page.mouse.up();
  const dialog = page.getByRole("dialog", { name: /ask for a change/i });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText("This space")).toBeVisible();
  await page.keyboard.press("Escape");
});

test("in pick mode, drag an object and the ask to move it is written for you", async ({ page }) => {
  await page.goto(url);
  await ready(page);
  const first = page.locator("[data-world] [data-ab-block]:not([data-ab-block='__new__'])").first();
  const id = (await first.getAttribute("data-ab-block"))!;
  // zoom to it first, as a person would (the map jumps to an object)
  await page.locator(`[data-map-block="${id}"]`).dispatchEvent("pointerdown");
  await page.waitForTimeout(450);
  await page.locator("[data-canvas-bar]").getByRole("button", { name: /change something/i }).click();
  const box = (await first.boundingBox())!;
  await page.mouse.move(box.x + 40, box.y + 40);
  await page.mouse.down();
  await page.mouse.move(box.x + 220, box.y + 160, { steps: 10 });
  await page.mouse.up();
  const dialog = page.getByRole("dialog", { name: /ask for a change/i });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("textbox")).toHaveValue(/^Move .* to x=\d+, y=\d+/);
  await page.keyboard.press("Escape");
});

test("the map shows every object and jumps to one", async ({ page }) => {
  await page.goto(url);
  await ready(page);
  const rects = page.locator("[data-map-block]");
  expect(await rects.count()).toBeGreaterThan(0);
  const world = page.locator("[data-world]");
  const before = await world.getAttribute("style");
  await rects.last().dispatchEvent("pointerdown");
  await page.waitForTimeout(300);
  expect(await world.getAttribute("style")).not.toBe(before);
});

test("a signed-out visitor's stroke on the open canvas survives a reload", async ({ page }) => {
  test.setTimeout(90_000);
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

test("while a change is being proposed the wall holds still under the composer", async ({ page }) => {
  await page.goto(url);
  await ready(page);
  const world = page.locator("[data-world]");
  const box = (await world.boundingBox())!;
  const zoom = box.width / 2400;
  const contentBottom = Number(await world.getAttribute("data-content-bottom"));
  const y = box.y + (contentBottom + 50) * zoom;
  await page.locator("[data-canvas-bar]").getByRole("button", { name: /change something/i }).click();
  await page.mouse.click(box.x + 1200 * zoom, y);
  const dialog = page.getByRole("dialog", { name: /ask for a change/i });
  await expect(dialog).toBeVisible();
  const style = await world.getAttribute("style");
  const dbox = (await dialog.boundingBox())!;
  await page.mouse.move(box.x + 600 * zoom, y - 100);
  await page.mouse.wheel(0, 300);
  await page.mouse.wheel(200, 0);
  await page.waitForTimeout(300);
  expect(await world.getAttribute("style")).toBe(style); // no pan
  const dbox2 = (await dialog.boundingBox())!;
  expect(Math.abs(dbox2.y - dbox.y)).toBeLessThan(6); // the composer stayed put (a few px is the spring's tail, not a pan)
  await page.keyboard.press("Escape");
});

test("the open canvas is a picture at the overview and live when you're close", async ({ page }) => {
  await page.goto(url);
  await ready(page);
  const wrap = page.locator('[data-ab-block="collaborative-art"] [data-art-live]');
  test.skip((await wrap.count()) === 0, "no open canvas on this wall");
  await expect(wrap).toHaveAttribute("data-art-live", "0"); // small on screen: no live subscription
  await page.locator('[data-map-block="collaborative-art"]').dispatchEvent("pointerdown");
  await expect(wrap).toHaveAttribute("data-art-live", "1", { timeout: 5_000 }); // zoomed in: live strokes
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

test("the map shows what you point at: a hovered block, a dragged-out space, a point", async ({ page }) => {
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
  await page.getByRole("button", { name: /fit the whole wall/i }).click();
  await page.waitForTimeout(300);
  const world = page.locator("[data-world]");
  const wb = (await world.boundingBox())!;
  const zoom = wb.width / 2400;
  const contentBottom = Number(await world.getAttribute("data-content-bottom"));
  const y = wb.y + (contentBottom + 50) * zoom;
  await page.locator("[data-canvas-bar]").getByRole("button", { name: /change something/i }).click();
  await page.mouse.move(wb.x + 200 * zoom, y);
  await page.mouse.down();
  await page.mouse.move(wb.x + 900 * zoom, y + 60 * zoom, { steps: 8 });
  await expect(page.locator("rect[data-map-mark]")).toBeVisible();
  await page.mouse.up();
  await expect(page.getByRole("dialog", { name: /ask for a change/i })).toBeVisible();
  await expect(page.locator("rect[data-map-mark]")).toBeVisible();
  await page.keyboard.press("Escape");
  await page.locator("[data-canvas-bar]").getByRole("button", { name: /change something/i }).click();
  await page.mouse.click(wb.x + 1200 * zoom, y);
  await expect(page.getByRole("dialog", { name: /ask for a change/i })).toBeVisible();
  await expect(page.locator("circle[data-map-mark]")).toBeVisible();
  await page.keyboard.press("Escape");
});

test("the ? says how, and opens the full story", async ({ page }) => {
  await page.goto(url);
  await ready(page);
  await page.getByRole("button", { name: /how to use the canvas/i }).click();
  const pop = page.locator("[data-canvas-howto]");
  await expect(pop).toBeVisible();
  await expect(pop.getByText(/hold ⇧/i)).toBeVisible();
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

test("while pointing, a marquee started over the map still reaches the canvas", async ({ page }) => {
  await page.goto(url);
  await ready(page);
  const map = page.locator("[data-minimap]");
  const m = (await map.boundingBox())!;
  const w = (await page.locator("[data-world]").boundingBox())!;
  await page.locator("[data-canvas-bar]").getByRole("button", { name: /change something/i }).click();
  await expect(map).toHaveCSS("pointer-events", "none");
  // inside the map's box, over empty ground to the right of the centred world
  const x = Math.max(m.x + 12, w.x + w.width + 12);
  expect(x).toBeLessThan(m.x + m.width - 8);
  const y = m.y + 16;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x - 420, y - 220, { steps: 10 });
  await page.mouse.up();
  const dialog = page.getByRole("dialog", { name: /ask for a change/i });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText("This space")).toBeVisible();
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
  // zoom in, so the quiet refresh has something to bring back
  await page.getByRole("button", { name: "Zoom in" }).click();
  await page.getByRole("button", { name: "Zoom in" }).click();
  const zoomed = zoomOf(await page.locator("[data-world]").getAttribute("style"));
  // the next poll (every few seconds under the e2e flag) answers with a different build: the page refreshes
  // itself once the person pauses (the test's clicks count as activity, so a short pause first)
  await page.waitForEvent("load", { timeout: 20_000 });
  await ready(page);
  expect(await page.locator("[data-new-build]").count()).toBe(0); // there is no button; it just happens
  const back = zoomOf(await page.locator("[data-world]").getAttribute("style"));
  expect(Math.abs(back - zoomed)).toBeLessThan(0.02); // came back where it was, not re-fitted
});

