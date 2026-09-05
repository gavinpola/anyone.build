import { test, expect, type Page } from "@playwright/test";

/** Guests: no account, one small change, private rejections, and claiming credit on sign-in. */
const url = process.env.E2E_URL ?? "http://127.0.0.1:5173";

async function ready(page: Page) {
  await expect(page.locator('html[data-convex="ready"]')).toBeAttached({ timeout: 20_000 });
}

test("a guest can ask without signing in and it shows as a guest", async ({ page }) => {
  await page.goto(url);
  await ready(page);
  await expect(page.getByRole("button", { name: /^sign in/i })).toBeVisible();
  await page.getByRole("button", { name: /change something/i }).click();
  await page.locator('[data-ab-block="__new__"]').click();
  const box = page.getByRole("dialog", { name: /ask for a change/i });
  await expect(box.getByText(/no account needed/i)).toBeVisible();
  await box.getByRole("textbox").fill("A one-line hello note at the bottom of the wall");
  await box.getByRole("button", { name: /send/i }).click();
  await expect(box.getByText(/approved|slow down|didn.t fit|too big|a human will look|not for everyone/i).first()).toBeVisible({ timeout: 40_000 });
  await box.getByRole("button", { name: /watch it in live|^close$/i }).first().click();
  const feed = page.getByRole("dialog", { name: /live feed/i });
  if (!(await feed.isVisible())) await page.getByRole("button", { name: /^live/i }).click({ force: true });
  const card = feed.locator("article", { hasText: "A one-line hello note" }).first();
  await expect(card).toBeVisible();
  await expect(card.getByText(/guest ·/)).toBeVisible();
});

test("signing in offers to claim the guest's work", async ({ page }) => {
  await page.goto(url);
  await ready(page);
  await page.getByRole("button", { name: /change something/i }).click();
  await page.locator('[data-ab-block="__new__"]').click();
  const box = page.getByRole("dialog", { name: /ask for a change/i });
  await box.getByRole("textbox").fill("Add a tiny thank-you note at the bottom of the wall");
  await box.getByRole("button", { name: /send/i }).click();
  await expect(box.getByText(/approved|slow down|didn.t fit|too big|a human will look|not for everyone/i).first()).toBeVisible({ timeout: 40_000 });
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: /^sign in/i }).click();
  await expect(page.getByRole("button", { name: /sign out/i })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText(/before signing in/i)).toBeVisible({ timeout: 15_000 });
  await page.getByRole("button", { name: /claim them/i }).click();
  await expect(page.getByText(/now count for/i)).toBeVisible({ timeout: 15_000 });
});
