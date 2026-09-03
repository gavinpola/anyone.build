// Deterministic gate for the agent-editable surface. Runs in the sandbox, in CI, and (as a module) in Convex.
//   node scripts/validate-playground.mjs [--base <ref>] [--scope tiny|small|medium|large] [--staged]
import { execSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import { validateDiff } from "../packages/gatekeeper/src/validate/diff.js";

const args = process.argv.slice(2);
const opt = (k, d) => {
  const i = args.indexOf(k);
  return i >= 0 ? args[i + 1] : d;
};
const scope = opt("--scope", process.env.AB_SCOPE ?? "large");
const staged = args.includes("--staged");
const base = opt("--base", process.env.AB_BASE ?? "origin/main");

let diff;
if (staged) diff = execSync("git diff --cached --binary --no-color", { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
else if (existsSync(opt("--file", ""))) diff = readFileSync(opt("--file", ""), "utf8");
else diff = execSync(`git diff --binary --no-color ${base}...HEAD`, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });

const files = {};
for (const f of diff.matchAll(/^diff --git a\/(.+?) b\/(.+)$/gm)) {
  const p = f[2];
  if (existsSync(p)) files[p] = readFileSync(p, "utf8");
}
const v = validateDiff(diff, scope, { fullFiles: files });
console.log(JSON.stringify({ ok: v.ok, problems: v.problems, added: v.added, removed: v.removed, files: v.files.map((f) => f.path), blockIds: v.blockIds }, null, 2));
process.exit(v.ok ? 0 : 1);
