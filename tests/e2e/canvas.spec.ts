import { test, expect, type Page } from "@playwright/test";

/**
 * The bounded canvas: a fixed world you zoom and pan; drag out a space to work on it; click a point to
 * add there; drag a block by its bar to propose a move; the directory jumps to a block.
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
  await expect(page.locator("[data-directory]")).toBeVisible();
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

test("drag a block by its label and the ask to move it is written for you", async ({ page }) => {
  await page.goto(url);
  await ready(page);
  const first = page.locator("[data-world] [data-ab-block]:not([data-ab-block='__new__'])").first();
  const chrome = first.locator(".object-label");
  const box = (await chrome.boundingBox())!;
  await page.mouse.move(box.x + 30, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + 180, box.y + 120, { steps: 10 });
  await page.mouse.up();
  const dialog = page.getByRole("dialog", { name: /ask for a change/i });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("textbox")).toHaveValue(/^Move .* to x=\d+, y=\d+/);
  await page.keyboard.press("Escape");
});

test("the directory lists what's on the canvas and jumps to a block", async ({ page }) => {
  await page.goto(url);
  await ready(page);
  const rows = page.locator("[data-directory-item]");
  expect(await rows.count()).toBeGreaterThan(0);
  const world = page.locator("[data-world]");
  const before = await world.getAttribute("style");
  await rows.last().click();
  await page.waitForTimeout(300);
  expect(await world.getAttribute("style")).not.toBe(before);
});
