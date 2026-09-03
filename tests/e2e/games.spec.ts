import { test, expect } from "@playwright/test";

/** Games: the kit's useTick loop + a canvas make a playable game a block can build. */
const url = process.env.E2E_URL ?? "http://127.0.0.1:5173";

test("the dino runner starts, runs, and scores through the kit game loop", async ({ page }) => {
  await page.goto(url + "/");
  const block = page.locator('[data-ab-block="dino-run"]');
  await expect(block).toBeVisible();
  const board = block.getByRole("button", { name: /dino game/i });
  await expect(block.getByText(/press space or tap to start/i)).toBeVisible();

  // start the loop
  await board.focus();
  await page.keyboard.press("Space");
  await expect(block.getByText(/press space or tap to start/i)).toBeHidden();

  // the loop advances the score over time (proves useTick is ticking)
  const scoreText = block.getByText(/best/i);
  const read = async () => Number(((await scoreText.innerText()).match(/^(\d+)/) ?? [])[1] ?? "0");
  const first = await read();
  await page.waitForTimeout(700);
  const later = await read();
  expect(later).toBeGreaterThan(first);

  // a jump is accepted without throwing (the canvas is being drawn)
  await page.keyboard.press("Space");
  await expect(block.locator("canvas")).toBeVisible();
});
