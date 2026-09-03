import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "tests",
  testMatch: process.env.E2E_URL ? ["e2e/**/*.spec.ts"] : ["smoke/**/*.spec.ts"],
  timeout: 45_000,
  retries: 1,
  use: { baseURL: process.env.SMOKE_URL ?? "http://127.0.0.1:5173", viewport: { width: 1280, height: 800 } },
  reporter: [["list"]],
});
