import { test, expect } from "@playwright/test";

/** A guest's big ask isn't a dead reject: it goes up for a vote (voting needs an account; building needs votes). */
const url = process.env.E2E_URL ?? "http://127.0.0.1:5173";

test("a guest asking for a whole game gets 'up for a vote', not a rejection", async ({ browser }) => {
  test.setTimeout(120_000);
  const page = await (await browser.newContext()).newPage();
  await page.goto(url);
  await expect(page.locator('html[data-convex="ready"]')).toBeAttached({ timeout: 20_000 });
  await page.getByRole("button", { name: /change something/i }).click();
  await page.locator('[data-ab-block="__new__"]').click({ position: { x: 110, y: 70 } });
  const box = page.getByRole("dialog", { name: /ask for a change/i });
  await box.getByRole("textbox").fill("build me a dino game app like in chrome " + Math.random().toString(36).slice(2, 6));
  await box.getByRole("button", { name: /^send|^ask/i }).first().click();
  await expect(box.getByText("Up for a vote.", { exact: true })).toBeVisible({ timeout: 60_000 });
  const text = (await box.innerText()).toLowerCase();
  expect(text).not.toMatch(/couldn.t tell|smaller|big project/);
  await page.context().close();
});
