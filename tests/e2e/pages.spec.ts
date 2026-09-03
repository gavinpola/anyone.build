import { test, expect } from "@playwright/test";

/** Pages: a room file that is its own route, listed on the wall, pickable like a block. */
const url = process.env.E2E_URL ?? "http://127.0.0.1:5173";

test("the wall lists pages and a page renders at its route", async ({ page }) => {
  await page.goto(url + "/");
  const strip = page.getByRole("navigation", { name: "Pages" });
  await expect(strip).toBeVisible();
  await strip.getByRole("link", { name: "Guestbook" }).click();
  await expect(page).toHaveURL(/\/r\/main\/guestbook-page$/);
  await expect(page.getByRole("heading", { name: /sign the guestbook/i })).toBeVisible();
  const frame = page.locator('[data-ab-block="page:guestbook-page"]');
  await expect(frame).toBeVisible();
  await expect(frame).toHaveAttribute("data-ab-path", "docs/examples/pages/guestbook-page.tsx");
  // stamped for the picker: elements inside carry a file:line stamp
  await expect(frame.locator("[data-ab]").first()).toBeAttached();
  await expect(frame.getByText(/guestbook/i).first()).toBeVisible();
  await page.getByRole("link", { name: /the wall/i }).first().click();
  await expect(page).toHaveURL(/\/$/);
});

test("pointing inside a page opens the composer for that page", async ({ page }) => {
  await page.goto(url + "/r/main/guestbook-page");
  await page.locator('[data-ab-block="page:guestbook-page"]').waitFor();
  await page.getByRole("button", { name: /change something/i }).click();
  await page.getByRole("heading", { name: /sign the guestbook/i }).click();
  const box = page.getByRole("dialog", { name: /ask for a change/i });
  await expect(box).toBeVisible();
  await expect(box.getByText(/guestbook/i).first()).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(box).toBeHidden();
});

test("an unknown page says so and links back", async ({ page }) => {
  await page.goto(url + "/r/main/nope");
  await expect(page.getByText(/no such page/i)).toBeVisible();
  await page.getByRole("link", { name: /the wall/i }).click();
  await expect(page).toHaveURL(/\/$/);
});
