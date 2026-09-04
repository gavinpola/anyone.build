// Builds a Vercel Sandbox snapshot of the repo at main with dependencies installed, so each
// build skips `pnpm install`. Run nightly (or after dependency changes) and set SANDBOX_SNAPSHOT_ID.
//   VERCEL_TOKEN=... VERCEL_TEAM_ID=... VERCEL_PROJECT_ID=... GITHUB_REPO=anyone-build/everyones.lol node scripts/refresh-snapshot.mjs
import { Sandbox } from "@vercel/sandbox";

const env = (k) => {
  if (!process.env[k]) throw new Error("missing " + k);
  return process.env[k];
};
const sandbox = await Sandbox.create({
  token: env("VERCEL_TOKEN"),
  teamId: env("VERCEL_TEAM_ID"),
  projectId: env("VERCEL_PROJECT_ID"),
  source: { type: "git", url: `https://github.com/${env("GITHUB_REPO")}.git`, revision: "main" },
  runtime: "node22",
  timeout: 10 * 60 * 1000,
  resources: { vcpus: 2 },
  networkPolicy: { allow: ["github.com", "codeload.github.com", "registry.npmjs.org", "*.npmjs.org"] },
});
try {
  const install = await sandbox.runCommand("corepack", ["pnpm", "install", "--frozen-lockfile"]);
  if (install.exitCode !== 0) throw new Error(await install.stderr());
  await sandbox.runCommand("corepack", ["pnpm", "exec", "vite", "build"]); // warms caches
  const snap = await sandbox.snapshot();
  console.log("SANDBOX_SNAPSHOT_ID=" + snap.snapshotId);
} finally {
  await sandbox.stop();
}
