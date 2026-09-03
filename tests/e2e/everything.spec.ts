import { test, expect, type Page } from "@playwright/test";

/**
 * Every button, every flow. Runs against the local stack:
 *   CONVEX_AGENT_MODE=anonymous npx convex dev   (DEV_ANON_AUTH=1, MOCK_JUDGE=1, ALLOW_FAKE_PAYMENTS=1)
 *   VITE_E2E_BLOCKS=1 pnpm dev
 *   pnpm e2e
 */
const url = process.env.E2E_URL ?? "http://127.0.0.1:5173";

async function ready(page: Page) {
  // Convex socket up (set by ReadyMarker in providers.tsx).
  await expect(page.locator('html[data-convex="ready"]')).toBeAttached({ timeout: 20_000 });
}

async function signIn(page: Page) {
  await page.goto(url);
  await ready(page);
  const signOut = page.getByRole("button", { name: /sign out/i });
  if (await signOut.isVisible()) return;
  await page.getByRole("button", { name: /^sign in/i }).click();
  await expect(signOut).toBeVisible({ timeout: 20_000 });
}

test.describe("header + navigation", () => {
  test("wordmark, tabs, help panel, sign in and out", async ({ page }) => {
    await page.goto(url);
    await ready(page);
    await expect(page).toHaveTitle(/anyone\.build/);
    await page.getByRole("link", { name: "Leaderboard" }).click();
    await expect(page).toHaveURL(/\/leaderboard$/);
    await page.getByRole("link", { name: "Room" }).click();
    await expect(page).toHaveURL(new RegExp(`${url}/?$`));
    await page.getByRole("button", { name: /how this works/i }).click();
    const help = page.getByRole("dialog", { name: /how this works/i });
    await expect(help).toBeVisible();
    await expect(help.getByText("Point. Ask. Watch it ship.")).toBeVisible();
    // It must be a real panel, not squashed into the header (regression: fixed inside backdrop-blur).
    expect((await help.boundingBox())!.height).toBeGreaterThan(300);
    await help.getByRole("button", { name: /close/i }).click();
    await expect(help).toBeHidden();
    await page.getByRole("button", { name: /how this works/i }).click();
    await page.keyboard.press("Escape");
    await signIn(page);
    await page.getByRole("button", { name: /sign out/i }).click();
    await expect(page.getByRole("button", { name: /^sign in/i })).toBeVisible({ timeout: 10_000 });
  });

  test("404 page", async ({ page }) => {
    await page.goto(url + "/nope");
    await expect(page.getByText("Nothing hangs here yet.")).toBeVisible();
  });
});

test.describe("the picker", () => {
  test("pick mode button toggles, chord arms, escape disarms", async ({ page }) => {
    await page.goto(url);
    await ready(page);
    const pick = page.getByRole("button", { name: /change something/i });
    await pick.click();
    await expect(page.getByRole("button", { name: /click anything/i })).toBeVisible();
    await expect(page.locator("body")).toHaveAttribute("data-picking", "");
    await page.getByRole("button", { name: /click anything/i }).click();
    await expect(page.locator("body")).not.toHaveAttribute("data-picking", "");
    await page.keyboard.down("Shift");
    await page.keyboard.down("Meta");
    await expect(page.locator("body")).toHaveAttribute("data-picking", "");
    await page.keyboard.up("Meta");
    await page.keyboard.up("Shift");
    await expect(page.locator("body")).not.toHaveAttribute("data-picking", "");
  });

  test("hovers hug a block, an element, and a single word", async ({ page }) => {
    await page.goto(url);
    await ready(page);
    await page.getByRole("button", { name: /change something/i }).click();
    // block level: the open wall
    const wall = page.locator('[data-ab-block="__new__"]');
    await wall.hover({ position: { x: 100, y: 60 } });
    await expect(page.locator(".picker-outline")).toBeVisible();
    await expect(page.locator(".picker-placard")).toContainText("add something here");
    // element + word level need a block on the wall (VITE_E2E_BLOCKS=1)
    const h1 = page.locator('[data-ab-block="welcome"] h1');
    if (await h1.count()) {
      await h1.hover({ position: { x: 40, y: 20 } });
      await expect(page.locator(".picker-placard")).toContainText(/“\w+”/);
      const p = page.locator('[data-ab-block="welcome"] p').first();
      await p.hover({ position: { x: 2, y: 2 } });
      await expect(page.locator(".picker-placard")).toContainText(/<p>|“/);
      // punctuation is its own target: hover the first period in the paragraph
      const dot = await p.evaluate((el) => {
        const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
        for (let n = walker.nextNode(); n; n = walker.nextNode()) {
          const i = (n.textContent ?? "").indexOf(".");
          if (i < 0) continue;
          const r = document.createRange();
          r.setStart(n, i);
          r.setEnd(n, i + 1);
          const b = r.getBoundingClientRect();
          return { x: b.left + b.width / 2, y: b.top + b.height / 2 };
        }
        return null;
      });
      if (dot) {
        await page.mouse.move(dot.x, dot.y);
        await expect(page.locator(".picker-placard")).toContainText("“.”");
      }
    }
    await page.keyboard.press("Escape");
    await expect(page.locator(".picker-outline")).toHaveCount(0);
  });
});

test.describe("the loop", () => {
  test("approved: point, ask, watch, live, then it shows on the leaderboard", async ({ page }) => {
    await signIn(page);
    await page.getByRole("button", { name: /change something/i }).click();
    await page.locator('[data-ab-block="__new__"]').click({ position: { x: 120, y: 80 } });
    const box = page.getByRole("dialog", { name: /ask for a change/i });
    await expect(box).toBeVisible();
    await expect(box.getByText("New block")).toBeVisible();
    await box.getByRole("textbox").fill("Add a small note that says hi to whoever visits");
    await expect(box.getByText(/\/600/)).toBeVisible();
    await box.getByRole("button", { name: /send/i }).click();
    await expect(box.getByText(/approved/i)).toBeVisible({ timeout: 30_000 });
    await box.getByRole("button", { name: /watch it in live/i }).click();
    const feed = page.getByRole("dialog", { name: /live feed/i });
    await expect(feed).toBeVisible();
    const card = feed.locator("article", { hasText: "Add a small note that says hi to whoever visits" }).first();
    await expect(card).toBeVisible();
    await expect(card).toHaveAttribute("data-status", "live", { timeout: 60_000 });
    await expect(card.getByRole("link", { name: /preview/i })).toBeVisible();
    await expect(card.getByRole("link", { name: /PR/ })).toBeVisible();
    await feed.getByRole("button", { name: /close/i }).click();
    await expect(feed).toBeHidden();
    await page.getByRole("link", { name: "Leaderboard" }).click();
    await expect(page.getByText(/Did the thing you asked/).first()).toBeVisible({ timeout: 10_000 });
  });

  test("rejected stays private; cancel works; keyboard send works", async ({ page, browser }) => {
    await signIn(page);
    await page.getByRole("button", { name: /change something/i }).click();
    await page.locator('[data-ab-block="__new__"]').click({ position: { x: 160, y: 60 } });
    const box = page.getByRole("dialog", { name: /ask for a change/i });
    await box.getByRole("textbox").fill("Add a link to my startup https://coolapp.io please");
    await page.keyboard.press("Meta+Enter");
    await expect(box.getByText(/not for everyone/i)).toBeVisible({ timeout: 30_000 });
    await box.getByRole("button", { name: /^close$/i }).click();
    await expect(box).toBeHidden();

    const other = await browser.newContext();
    const p2 = await other.newPage();
    await p2.goto(url);
    await p2.getByRole("button", { name: /^live/i }).click({ force: true });
    await p2.waitForTimeout(1500);
    await expect(p2.getByText(/coolapp\.io/)).toHaveCount(0);
    await other.close();

    // cancel a request mid-flight
    await page.getByRole("button", { name: /change something/i }).click();
    await page.locator('[data-ab-block="__new__"]').click({ position: { x: 200, y: 70 } });
    await box.getByRole("textbox").fill("A clock that shows the time in UTC");
    await box.getByRole("button", { name: /send/i }).click();
    await expect(box.getByText(/approved/i)).toBeVisible({ timeout: 30_000 });
    await box.getByRole("button", { name: /watch it in live/i }).click();
    const feed = page.getByRole("dialog", { name: /live feed/i });
    const card = feed.locator("article", { hasText: "A clock that shows the time in UTC" }).first();
    await card.getByRole("button", { name: /cancel/i }).click();
    await expect(card.getByText("Cancelled").first()).toBeVisible({ timeout: 10_000 });
    await page.keyboard.press("Escape");
    await expect(feed).toBeHidden();
  });

  test("escape closes the composer; the Live pill toggles the drawer", async ({ page }) => {
    await signIn(page);
    await page.getByRole("button", { name: /change something/i }).click();
    await page.locator('[data-ab-block="__new__"]').click({ position: { x: 90, y: 90 } });
    await expect(page.getByRole("dialog", { name: /ask for a change/i })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog", { name: /ask for a change/i })).toBeHidden();
    await page.getByRole("button", { name: /^live/i }).click({ force: true });
    await expect(page.getByRole("dialog", { name: /live feed/i })).toBeVisible();
    await page.getByRole("button", { name: /^live/i }).click({ force: true });
    await expect(page.getByRole("dialog", { name: /live feed/i })).toBeHidden();
  });
});

test.describe("leaderboard", () => {
  test("period toggle, vote button, bid dialog with stepper and validation, fake bid lands", async ({ page }) => {
    await signIn(page);
    await page.goto(url + "/leaderboard");
    await page.getByRole("button", { name: "All time" }).click();
    await expect(page.getByRole("button", { name: "All time" })).toHaveClass(/bg-ink/);
    await page.getByRole("button", { name: "This week" }).click();

    // bid dialog
    await page.getByRole("button", { name: /^bid \$/i }).click();
    const dlg = page.getByRole("dialog", { name: /bid for patron/i });
    await expect(dlg).toBeVisible();
    const amount = dlg.locator(".font-display.num");
    const before = await amount.textContent();
    await dlg.getByRole("button", { name: /one dollar more/i }).click();
    await expect(amount).not.toHaveText(before!);
    await dlg.getByRole("button", { name: /one dollar less/i }).click();
    await expect(amount).toHaveText(before!);
    await expect(dlg.getByRole("button", { name: /hold .* and bid/i })).toBeDisabled();
    await dlg.getByLabel("Name").fill("Acme");
    await dlg.getByLabel("Website").fill("not a url at all");
    await dlg.getByRole("button", { name: /hold .* and bid/i }).click();
    await expect(dlg.getByText(/doesn't look right|must be/i)).toBeVisible({ timeout: 10_000 });
    await dlg.getByLabel("Website").fill("acme.com");
    await dlg.getByLabel("One line").fill("Rockets for coyotes");
    await dlg.getByRole("button", { name: /hold .* and bid/i }).click();
    await expect(page).toHaveURL(/bid=held/, { timeout: 15_000 });
    await expect(page.getByText(/high bid · Acme/)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/your bid:/)).toBeVisible();

    // vote on the change from the earlier flow, if present (own changes can't be voted on)
    const vote = page.getByRole("button", { name: /vote/i }).first();
    if (await vote.count()) await expect(vote).toBeVisible();

    // footer pages
    await page.getByRole("link", { name: "Rules", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Rules", exact: true })).toBeVisible();
    await page.getByRole("link", { name: "FAQ", exact: true }).click();
    await expect(page.getByText("When is my card charged?")).toBeVisible();
  });

  test("dialog close buttons and backdrop", async ({ page }) => {
    await signIn(page);
    await page.goto(url + "/leaderboard");
    await page.getByRole("button", { name: /^bid \$/i }).click();
    const dlg = page.getByRole("dialog", { name: /bid for patron/i });
    await dlg.getByRole("button", { name: /close/i }).click();
    await expect(dlg).toBeHidden();
    await page.getByRole("button", { name: /^bid \$/i }).click();
    await page.mouse.click(10, 400);
    await expect(dlg).toBeHidden();
  });
});

test.describe("mobile", () => {
  test.use({ viewport: { width: 390, height: 800 }, hasTouch: true, isMobile: true });
  test("wall renders, pill controls work, long-press picks", async ({ page }) => {
    await signIn(page);
    await expect(page.locator("[data-room]")).toBeVisible();
    await page.getByRole("button", { name: /change something/i }).click({ force: true });
    await page.locator('[data-ab-block="__new__"]').tap({ position: { x: 100, y: 60 } });
    await expect(page.getByRole("dialog", { name: /ask for a change/i })).toBeVisible();
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: /^live/i }).click({ force: true });
    await expect(page.getByRole("dialog", { name: /live feed/i })).toBeVisible();
  });
});

test("the composer closes when you navigate to another page", async ({ page }) => {
  await page.goto(url);
  await expect(page.locator('html[data-convex="ready"]')).toBeAttached({ timeout: 20_000 });
  await page.getByRole("button", { name: /change something/i }).click();
  await page.locator('[data-ab-block="__new__"]').click({ position: { x: 100, y: 60 } });
  const box = page.getByRole("dialog", { name: /ask for a change/i });
  await expect(box).toBeVisible();
  await page.getByRole("link", { name: "Leaderboard" }).click();
  await expect(box).toBeHidden();
  await expect(page).toHaveURL(/\/leaderboard$/);
});
