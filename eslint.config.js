// @ts-check
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import { roomRules } from "./packages/gatekeeper/src/lint/room-rules.js";

export default tseslint.config(
  { ignores: ["dist", "node_modules", "convex/_generated", "src/routeTree.gen.ts", "playwright-report", "test-results"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.{ts,tsx}"],
    plugins: { "react-hooks": reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
    },
  },
  // Node scripts (plain ESM, no build step)
  {
    files: ["scripts/**/*.mjs", "sandbox/**/*.mjs"],
    languageOptions: {
      globals: { console: "readonly", process: "readonly", Buffer: "readonly", URL: "readonly", fetch: "readonly", setTimeout: "readonly", clearTimeout: "readonly", AbortSignal: "readonly", AbortController: "readonly", TextEncoder: "readonly", TextDecoder: "readonly", crypto: "readonly" },
    },
  },
  // Agent-editable surface: hard bans, enforced identically in the sandbox, Convex, and CI.
  {
    files: ["src/rooms/**/*.{ts,tsx}"],
    rules: roomRules,
  },
);
