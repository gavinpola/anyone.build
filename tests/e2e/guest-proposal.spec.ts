import { test, expect, type Page } from "@playwright/test";

/**
 * The bar for a guest: medium just goes ("I want people to be able to do stuff"); only a genuinely
 * large build goes up for a vote (voting needs an account; building needs votes).
 */
const url = process.env.E2E_URL ?? "http://127.0.0.1:5173";

async function guestAsk(page: Page, text: string) {
  await page.getByRole("button", { name: /change something/i }).click();
  await page.locator('[data-ab-block="__new__"]').click();
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
  // no random token in a natural-language ask (the judge, rightly, asks what a nonsense word means); a colour
  // varies the text instead, so a run within twenty minutes of the last one isn't folded into it as a duplicate
  // (a thunderbolt block has lived on the wall since 09-04, and the judge reads a new one as replacing it)
  const colour = ["blue", "gold", "violet", "teal", "white", "crimson"][Math.floor(Math.random() * 6)];
  const medium = await guestAsk(page, `add a block with a slowly drifting ${colour} starfield drawn on a dark canvas, with a shooting star now and then`);
  expect(medium).toMatch(/approved/);
  expect(medium).not.toMatch(/up for a vote|couldn.t tell|smaller|big project/);

  // large: a whole multiplayer system — up for a vote, never a dead reject. A second visitor asks it: one
  // build per person at a time, and the first visitor's medium ask is still building.
  await page.context().close();
  const page2 = await (await browser.newContext()).newPage();
  await page2.goto(url);
  await expect(page2.locator('html[data-convex="ready"]')).toBeAttached({ timeout: 20_000 });
  const large = await guestAsk(page2, `build a full online multiplayer chess ${tag} with accounts, matchmaking, every piece rule, check and checkmate, a rated AI opponent, and a tournament system`);
  expect(large).toMatch(/up for a vote/);
  expect(large).not.toMatch(/couldn.t tell|smaller|big project/);
  await page2.context().close();
});
