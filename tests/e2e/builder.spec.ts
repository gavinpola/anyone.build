import { test, expect, type Page } from "@playwright/test";

/** A builder's page: reached from the builders ledger, shareable, and honest about an unknown name. */
const url = process.env.E2E_URL ?? "http://127.0.0.1:5173";

async function ready(page: Page) {
  await expect(page.locator('html[data-convex="ready"]')).toBeAttached({ timeout: 20_000 });
}

test("a builder's name on the leaderboard opens their page, with their changes linking onto the wall", async ({ page }) => {
  await page.goto(url + "/leaderboard");
  await ready(page);
  const first = page.locator("[data-builder]").first();
  await first.waitFor({ state: "attached", timeout: 15_000 }).catch(() => {}); // the ledger is a live query
  test.skip((await first.count()) === 0, "no builders on this deployment yet");
  const handle = (await first.getAttribute("data-builder"))!;
  await first.click();
  await expect(page).toHaveURL(new RegExp(`/u/${handle}$`));
  await expect(page.getByRole("heading", { name: `@${handle}` })).toBeVisible();
  await expect(page.getByText(/changes? on the wall/)).toBeVisible();
  await expect(page.getByRole("button", { name: /share/i })).toBeVisible();
  const rows = page.locator("[data-builder-changes] li a");
  if ((await rows.count()) > 0) {
    await rows.first().click();
    await expect(page).toHaveURL(/\/c\/[a-z0-9]+$/);
    await expect(page.locator("[data-world]")).toBeAttached({ timeout: 15_000 });
  }
});

test("an unknown handle says so and points at the wall", async ({ page }) => {
  await page.goto(url + "/u/nobody-" + Math.random().toString(36).slice(2, 8));
  await ready(page);
  await expect(page.locator("[data-builder-missing]")).toBeVisible();
  await expect(page.getByText(/nobody by that name/i)).toBeVisible();
  await page.getByRole("link", { name: /go to the wall/i }).click();
  await expect(page.locator("[data-world]")).toBeAttached({ timeout: 15_000 });
});
