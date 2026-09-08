// Builds a Vercel Sandbox snapshot of the repo at main with dependencies installed, so each
// build skips `pnpm install`. Run nightly (or after dependency changes) and set SANDBOX_SNAPSHOT_ID.
//   VERCEL_TOKEN=... VERCEL_TEAM_ID=... VERCEL_PROJECT_ID=... GITHUB_REPO=anyone-build/everyones.lol node scripts/refresh-snapshot.mjs
import { Sandbox, Snapshot } from "@vercel/sandbox";

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
  // Snapshots are ~0.4 GB each and the plan meters their storage (forty of them exhausted the Hobby
  // allowance on 2026-09-07 and every build died at "starting sandbox"). Keep the newest three; drop the rest.
  const creds = { token: env("VERCEL_TOKEN"), teamId: env("VERCEL_TEAM_ID"), projectId: env("VERCEL_PROJECT_ID") };
  const page = await Snapshot.list({ ...creds, limit: 50 });
  const all = (page.snapshots ?? []).filter((o) => o.status !== "deleted").sort((a, b) => b.createdAt - a.createdAt);
  const keep = new Set([snap.snapshotId, ...all.slice(0, 3).map((o) => o.id)]);
  let pruned = 0;
  for (const o of all) {
    if (keep.has(o.id)) continue;
    try {
      const old = await Snapshot.get({ ...creds, snapshotId: o.id });
      await old.delete();
      pruned++;
    } catch (e) {
      console.error("could not prune " + o.id + ": " + String(e?.message ?? e).slice(0, 100));
    }
  }
  console.log(`pruned ${pruned} older snapshot${pruned === 1 ? "" : "s"}`);
} finally {
  await sandbox.stop();
}
