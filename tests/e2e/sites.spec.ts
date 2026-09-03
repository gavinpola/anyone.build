import { test, expect, type Page } from "@playwright/test";

/** "For your site": add a site, get the snippet, leave a note through the real widget, see it in the inbox. */
const url = process.env.E2E_URL ?? "http://127.0.0.1:5173";

async function ready(page: Page) {
  await expect(page.locator('html[data-convex="ready"]')).toBeAttached({ timeout: 20_000 });
}

async function signIn(page: Page, path = "/") {
  await page.goto(url + path);
  await ready(page);
  if (await page.getByRole("button", { name: /sign out/i }).isVisible()) return;
  await page.getByRole("button", { name: /^sign in/i }).first().click();
  await expect(page.getByRole("button", { name: /sign out/i })).toBeVisible({ timeout: 20_000 });
}

test("the product page reads and links", async ({ page }) => {
  await page.goto(url + "/for-your-site");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Your visitors point at things");
  await expect(page.getByRole("heading", { name: "Notes" })).toBeVisible();
  await expect(page.getByText(/ask\.js/)).toBeVisible();
  await page.getByRole("link", { name: /add your site/i }).first().click();
  await expect(page).toHaveURL(/\/sites$/);
  await expect(page.getByRole("heading", { name: /your sites/i })).toBeVisible();
});

test("the footer and help panel point at it", async ({ page }) => {
  await page.goto(url + "/");
  await expect(page.getByRole("contentinfo").getByRole("link", { name: /for your site/i })).toBeVisible();
  await page.getByRole("button", { name: /how this works/i }).click();
  const help = page.getByRole("dialog", { name: /how this works/i });
  await expect(help.getByRole("link", { name: /one script tag/i })).toBeVisible();
});

test("add a site, leave a note through the widget, work the inbox", async ({ page }) => {
  await signIn(page, "/sites");
  const name = "Demo " + Math.random().toString(36).slice(2, 6);

  // add the site (the same origin twice returns the existing one, so this is idempotent)
  const form = page.getByRole("heading", { name: /your sites/i }).locator("xpath=../..").locator("xpath=..");
  await form.getByLabel("Name").fill(name);
  await form.getByLabel("Origin").fill(url);
  await form.getByRole("button", { name: /add site/i }).click();
  const snippetBox = page.locator("[data-site-key]").first();
  await expect(snippetBox).toBeVisible({ timeout: 15_000 });
  const key = (await snippetBox.getAttribute("data-site-key")) ?? "";
  expect(key).toMatch(/^site_[a-f0-9]{20}$/);
  await expect(snippetBox.locator("code")).toContainText(`data-site="${key}"`);

  // the demo page with the real widget
  const demoHref = (await page.getByRole("link", { name: /try it/i }).getAttribute("href")) ?? "";
  expect(demoHref).toContain(key);
  await page.goto(url + demoHref);
  await expect(page.locator("#banner")).toContainText(/hold|tap ask/i);
  const h1 = page.locator("main h1");
  const box = (await h1.boundingBox())!;
  await page.keyboard.down("Shift");
  await page.keyboard.down("Meta");
  await page.mouse.move(box.x + 40, box.y + box.height / 2);
  await page.mouse.click(box.x + 40, box.y + box.height / 2);
  await page.keyboard.up("Meta");
  await page.keyboard.up("Shift");
  const dlg = page.getByRole("dialog", { name: "Ask for a change" });
  await expect(dlg).toBeVisible();
  await expect(dlg.getByText(/notes that stay out of the way/i)).toBeVisible();
  const noteText = "Headline is too long on phones " + key.slice(-4);
  await dlg.getByRole("textbox").fill(noteText);
  await dlg.getByRole("button", { name: "Send" }).click();
  await expect(dlg.getByText(/sent\. thank you/i)).toBeVisible({ timeout: 15_000 });
  await expect(dlg).toBeHidden({ timeout: 5_000 });

  // escape disarms without sending
  await page.keyboard.down("Shift");
  await page.keyboard.down("Meta");
  await page.mouse.click(box.x + 40, box.y + box.height / 2);
  await page.keyboard.up("Meta");
  await page.keyboard.up("Shift");
  await expect(dlg).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dlg).toBeHidden();

  // the inbox
  await page.goto(url + "/sites");
  await ready(page);
  await page.getByRole("button", { name: new RegExp(name) }).click();
  const row = page.locator("li[data-note-status]", { hasText: noteText }).first();
  await expect(row).toBeVisible({ timeout: 15_000 });
  await expect(row).toContainText("/ask-demo.html");
  await row.getByRole("button", { name: "Done" }).click();
  await expect(row).toBeHidden();
  await page.getByRole("tab", { name: "Done" }).click();
  const done = page.locator("li[data-note-status='done']", { hasText: noteText }).first();
  await expect(done).toBeVisible();
  await done.getByRole("button", { name: "Reopen" }).click();
  await expect(done).toBeHidden();

  // delete the demo site so runs don't pile up
  await page.getByRole("button", { name: /delete site/i }).click();
  await page.getByRole("button", { name: /yes, delete/i }).click();
  await expect(page.getByRole("button", { name: new RegExp(name) })).toBeHidden({ timeout: 10_000 });
});
