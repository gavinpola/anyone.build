import { test, expect } from "@playwright/test";

/**
 * Sharing: a live change has a Share button that copies /c/<id>; opening that link shows who asked for
 * what and rings the block. A missing id degrades to the wall with a one-line note.
 */
const url = process.env.E2E_URL ?? "http://127.0.0.1:5173";

test("share a change: copy the link, open it, land on the block", async ({ browser }) => {
  test.setTimeout(150_000);
  const ctx = await browser.newContext({ permissions: ["clipboard-read", "clipboard-write"] });
  const page = await ctx.newPage();
  await page.addInitScript(() => {
    // desktop: no native share sheet, the button copies the link
    Object.defineProperty(navigator, "share", { value: undefined, configurable: true });
  });
  await page.goto(url);
  await expect(page.locator('html[data-convex="ready"]')).toBeAttached({ timeout: 20_000 });

  await page.getByRole("button", { name: /change something/i }).click();
  await page.locator('[data-ab-block="__new__"]').click({ position: { x: 110, y: 70 } });
  const box = page.getByRole("dialog", { name: /ask for a change/i });
  await box.getByRole("textbox").fill("A one-line thank-you note at the bottom of the wall for everyone who visits");
  await box.getByRole("button", { name: /^send|^ask/i }).first().click();
  await expect(box.getByText(/it's live/i)).toBeVisible({ timeout: 90_000 });

  await box.getByRole("button", { name: /share it/i }).click();
  await expect(box.getByRole("button", { name: /link copied/i })).toBeVisible();
  const link = await page.evaluate(() => navigator.clipboard.readText());
  expect(link).toMatch(/\/c\/[a-z0-9]+$/);

  await page.goto(link);
  await expect(page.locator("[data-focus]")).toBeVisible({ timeout: 20_000 });
  await expect(page.locator("[data-focus]")).toContainText(/asked for this/);
  await expect(page.locator("[data-focus]")).toContainText(/thank-you note/);
  await expect(page.locator("[data-room]")).toBeVisible();
  expect(page.url()).toContain("/c/");

  await page.goto(`${url}/c/notarealid000`);
  await expect(page.locator('[data-focus="missing"]')).toBeVisible({ timeout: 20_000 });
  await expect(page.locator("[data-room]")).toBeVisible();
  await ctx.close();
});
