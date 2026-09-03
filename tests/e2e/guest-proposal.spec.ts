import { test, expect, type Page } from "@playwright/test";

/**
 * The bar for a guest: medium just goes ("I want people to be able to do stuff"); only a genuinely
 * large build goes up for a vote (voting needs an account; building needs votes).
 */
const url = process.env.E2E_URL ?? "http://127.0.0.1:5173";

async function guestAsk(page: Page, text: string) {
  await page.getByRole("button", { name: /change something/i }).click();
  await page.locator('[data-ab-block="__new__"]').click({ position: { x: 110, y: 70 } });
  const box = page.getByRole("dialog", { name: /ask for a change/i });
  await box.getByRole("textbox").fill(text);
  await box.getByRole("button", { name: /^send|^ask/i }).first().click();
  await expect(box.getByText(/up for a vote|approved|couldn.t tell|not for everyone|too big|unclear|slow down/i).first()).toBeVisible({ timeout: 60_000 });
  const t = (await box.innerText()).toLowerCase();
  await page.keyboard.press("Escape");
  await page.waitForTimeout(600);
  return t;
}

test("a guest's medium ask just goes; a genuinely large one goes up for a vote", async ({ browser }) => {
  test.setTimeout(180_000);
  const page = await (await browser.newContext()).newPage();
  await page.goto(url);
  await expect(page.locator('html[data-convex="ready"]')).toBeAttached({ timeout: 20_000 });
  const tag = Math.random().toString(36).slice(2, 6);

  // medium: a real visual restyle of one block — should be approved outright, not voted on
  // no random token in a natural-language ask: the judge (rightly) asks what a nonsense word means
  const medium = await guestAsk(page, `add a block in dark mode with a glowing thunderbolt drawn in it in a really cool visual way`);
  expect(medium).toMatch(/approved/);
  expect(medium).not.toMatch(/up for a vote|couldn.t tell|smaller|big project/);

  // large: a whole multiplayer system — up for a vote, never a dead reject
  const large = await guestAsk(page, `build a full online multiplayer chess ${tag} with accounts, matchmaking, every piece rule, check and checkmate, a rated AI opponent, and a tournament system`);
  expect(large).toMatch(/up for a vote/);
  expect(large).not.toMatch(/couldn.t tell|smaller|big project/);
  await page.context().close();
});
