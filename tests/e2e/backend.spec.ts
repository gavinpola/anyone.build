import { test, expect, type Page } from "@playwright/test";

/** The backend tier: a block calls a room function (convex/rooms/main/poll.ts) through the kit hooks. */
const url = process.env.E2E_URL ?? "http://127.0.0.1:5173";

async function ready(page: Page) {
  await expect(page.locator('html[data-convex="ready"]')).toBeAttached({ timeout: 20_000 });
}

test("a signed-in visitor votes once through a room function and the tally updates", async ({ page }) => {
  await page.goto(url + "/");
  await ready(page);
  if (!(await page.getByRole("button", { name: /sign out/i }).isVisible())) {
    await page.getByRole("button", { name: /^sign in/i }).first().click();
    await expect(page.getByRole("button", { name: /sign out/i })).toBeVisible({ timeout: 20_000 });
  }
  const block = page.locator('[data-ab-block="vote-once"]');
  await expect(block).toBeVisible();
  await expect(block.getByText(/votes?$/)).toBeVisible({ timeout: 15_000 });
  const before = Number(((await block.getByText(/votes?$/).innerText()).match(/(\d+)/) ?? [])[1] ?? "0");
  const warm = block.getByRole("button", { name: /^warm/ });
  const warmBefore = Number(((await warm.innerText()).match(/(\d+)/) ?? [])[1] ?? "0");
  await warm.click();
  await expect(warm).toContainText(String(warmBefore + 1), { timeout: 15_000 });
  // voting again for another choice moves the vote instead of adding one
  const cool = block.getByRole("button", { name: /^cool/ });
  await cool.click();
  await expect(warm).toContainText(String(warmBefore), { timeout: 15_000 });
  await expect(block.getByText(/votes?$/)).toContainText(String(before + 1));
});

test("a guest is told to sign in", async ({ browser }) => {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto(url + "/");
  await ready(page);
  const block = page.locator('[data-ab-block="vote-once"]');
  await expect(block.getByText(/sign in to vote/i)).toBeVisible({ timeout: 15_000 });
  await block.getByRole("button", { name: /^neither/ }).click();
  await expect(block.getByRole("alert")).toContainText(/sign in/i, { timeout: 15_000 });
  await ctx.close();
});
