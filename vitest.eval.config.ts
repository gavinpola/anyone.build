import { defineConfig } from "vitest/config";
import path from "node:path";

/**
 * The judge eval: real model calls, real money (a few cents). Not part of `pnpm test`.
 *   OPENROUTER_API_KEY=… pnpm eval:judge
 */
export default defineConfig({
  test: { include: ["packages/gatekeeper/evals/**/*.eval.ts"], environment: "node", testTimeout: 900_000, hookTimeout: 60_000, fileParallelism: false },
  resolve: { alias: { "@": path.resolve(import.meta.dirname, "src") } },
});
