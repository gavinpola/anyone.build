import { test, expect, type Page } from "@playwright/test";

/** Proposals: a safe-but-big ask from a signed-in person goes up for a vote on the leaderboard. */
const url = process.env.E2E_URL ?? "http://127.0.0.1:5173";

async function ready(page: Page) {
  await expect(page.locator('html[data-convex="ready"]')).toBeAttached({ timeout: 20_000 });
}
async function signIn(page: Page) {
  if (await page.getByRole("button", { name: /sign out/i }).isVisible()) return;
  await page.getByRole("button", { name: /^sign in/i }).first().click();
  await expect(page.getByRole("button", { name: /sign out/i })).toBeVisible({ timeout: 20_000 });
}

test("a big ask becomes a proposal, appears on the leaderboard, and can be voted", async ({ page }) => {
  await page.goto(url + "/");
  await ready(page);
  await signIn(page);

  // a trust-1 (dev) account ships up to medium; a genuinely large build becomes a proposal
  const tag = "chess " + Math.random().toString(36).slice(2, 6);
  await page.getByRole("button", { name: /change something/i }).click();
  await page.locator('[data-ab-block="__new__"]').click();
  const box = page.getByRole("dialog", { name: /ask for a change/i });
  await box.getByRole("textbox").fill(`${tag}: redesign every block on the wall in a neon theme, change all of them together, and add three new pages (rules, a gallery, and a full multiplayer chess game with accounts and matchmaking)`);
  await box.getByRole("button", { name: /^send|^ask/i }).first().click();
  await expect(box.getByText("Up for a vote.", { exact: true })).toBeVisible({ timeout: 40_000 });
  await page.keyboard.press("Escape");

  // it shows on the leaderboard's proposals section, and voting moves the count
  await page.goto(url + "/leaderboard");
  await ready(page);
  const section = page.locator("section", { hasText: "Up for a vote" }).first();
  await expect(section.getByRole("heading", { name: /up for a vote/i })).toBeVisible();
  const row = section.locator("li", { hasText: tag }).first();
  await expect(row).toBeVisible({ timeout: 15_000 });
  const voteBtn = row.getByRole("button").first();
  const before = Number(((await voteBtn.innerText()).match(/(\d+)/) ?? [])[1] ?? "0");
  await voteBtn.click();
  await expect(voteBtn).toContainText(String(before + 1), { timeout: 10_000 });
  await expect(voteBtn).toHaveAttribute("aria-pressed", "true");
  await voteBtn.click(); // toggle off
  await expect(voteBtn).toContainText(String(before), { timeout: 10_000 });
  await expect(voteBtn).toHaveAttribute("aria-pressed", "false");
});
