import { test, expect, type Page } from "@playwright/test";

/** No per-person daily cap: a guest can ask more than once a day (Gavin: "no limit"); only one build at a time per person. */
const url = process.env.E2E_URL ?? "http://127.0.0.1:5173";

async function ask(page: Page, text: string) {
  await page.getByRole("button", { name: /change something/i }).click();
  await page.locator('[data-ab-block="__new__"]').click();
  const box = page.getByRole("dialog", { name: /ask for a change/i });
  await box.getByRole("textbox").fill(text);
  await box.getByRole("button", { name: /^send|^ask/i }).first().click();
  // any real verdict is fine, and so is "still building" (one build per person at a time); the one
  // thing that must NOT appear is the daily "slow down"
  await expect(box.getByText(/approved|not for everyone|up for a vote|didn.t fit|too big|slow down|unclear|couldn.t tell|still building/i).first()).toBeVisible({ timeout: 40_000 });
  const text2 = (await box.innerText()).toLowerCase();
  await page.keyboard.press("Escape");
  return text2;
}

test("a guest is not capped to one ask a day", async ({ browser }) => {
  test.setTimeout(150_000); // two real-judge verdicts, back to back
  const page = await (await browser.newContext()).newPage();
  await page.goto(url);
  await expect(page.locator('html[data-convex="ready"]')).toBeAttached({ timeout: 20_000 });
  const tag = Math.random().toString(36).slice(2, 6);
  const first = await ask(page, `A one-line hello note ${tag} at the bottom of the wall`);
  expect(first).not.toMatch(/slow down|limit for today|one change a day/);
  const second = await ask(page, `A second small note ${tag} that says thanks for visiting`);
  expect(second).not.toMatch(/slow down|limit for today|one change a day/);
  await page.context().close();
});
