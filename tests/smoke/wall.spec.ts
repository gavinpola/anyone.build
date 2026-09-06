import { test, expect } from "@playwright/test";

test("the wall renders without console errors", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  await page.goto("/");
  await expect(page.locator("[data-room]")).toBeVisible();
  // the world is there at 100% (no zoom), with a way in
  await expect(page.locator("[data-world]")).toBeAttached();
  await expect(page.getByRole("button", { name: /change something/i })).toBeVisible();
  // every block either renders or shows its own crash card, never a blank wall
  const crashed = await page.getByText("this block crashed").count();
  expect(crashed).toBe(0);
  expect(errors.filter((e) => !/convex|websocket|auth/i.test(e))).toEqual([]);
});

test("leaderboard renders", async ({ page }) => {
  await page.goto("/leaderboard");
  await expect(page.getByText("Patron of the day").first()).toBeVisible();
});
