// The Vercel build command. On production builds with a CONVEX_DEPLOY_KEY, it deploys the Convex
// backend and builds the site in one atomic step, so a merged room function goes live with the page
// that calls it. Without the key (previews, forks, or before the key is set) it is plain `pnpm build`.
import { spawnSync } from "node:child_process";

const isProd = process.env.VERCEL_ENV === "production";
const key = process.env.CONVEX_DEPLOY_KEY;

const run = (cmd, args) => {
  const r = spawnSync(cmd, args, { stdio: "inherit", env: process.env });
  if (r.status !== 0) process.exit(r.status ?? 1);
};

if (isProd && key) {
  console.log("[vercel-build] production + CONVEX_DEPLOY_KEY: deploying Convex, then building the site");
  run("npx", ["convex", "deploy", "--cmd", "pnpm build", "-y"]);
} else {
  console.log(`[vercel-build] ${isProd ? "production without CONVEX_DEPLOY_KEY" : "preview"}: building the site only`);
  run("pnpm", ["build"]);
}
