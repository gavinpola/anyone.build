import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import path from "node:path";
import { stampSource } from "./scripts/vite-plugin-stamp.ts";

export default defineConfig({
  plugins: [
    tanstackRouter({ target: "react", autoCodeSplitting: true }),
    stampSource({ root: import.meta.dirname }),
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      "@gatekeeper": path.resolve(import.meta.dirname, "packages/gatekeeper/src"),
    },
  },
  server: { port: 5173 },
  build: { sourcemap: true },
});
