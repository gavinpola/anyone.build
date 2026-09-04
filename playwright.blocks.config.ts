import { defineConfig } from "@playwright/test";

/** The playtest (tests/blocks): run against a built site, `pnpm preview` on 4173 by default. */
export default defineConfig({
  testDir: "tests/blocks",
  timeout: 120_000,
  retries: 0,
  workers: 1,
  use: { viewport: { width: 1000, height: 800 } },
  reporter: [["list"]],
});
