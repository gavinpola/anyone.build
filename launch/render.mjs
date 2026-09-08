#!/usr/bin/env node
/**
 * Renders every composition in launch/video/cuts.json to MP4 (H.264, faststart) and copies the results
 * to docs/launch/clips/final/. Remotion brings its own ffmpeg. Run `npm install` in launch/video first.
 *
 *   node launch/render.mjs            # all
 *   node launch/render.mjs --only gta # by id substring
 */
import { execFileSync } from "node:child_process";
import { readFileSync, mkdirSync, copyFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const video = join(here, "video");
const arg = (k, d) => {
  const i = process.argv.indexOf(`--${k}`);
  return i >= 0 ? process.argv[i + 1] : d;
};
const only = arg("only", null);
const cuts = JSON.parse(readFileSync(join(video, "cuts.json"), "utf8"));
const FINAL = join(here, "..", "docs", "launch", "clips", "final");
mkdirSync(FINAL, { recursive: true });
mkdirSync(join(video, "out"), { recursive: true });

for (const c of cuts) {
  if (only && !c.id.includes(only)) continue;
  const out = join(video, "out", `${c.id}.mp4`);
  const t0 = Date.now();
  process.stdout.write(`${c.id} (${c.width}×${c.height}, ${c.duration.toFixed(1)}s) … `);
  try {
    execFileSync("npx", ["remotion", "render", "src/index.ts", c.id, out, "--codec=h264", "--crf=20", "--log=error", "--concurrency=4"], { cwd: video, stdio: ["ignore", "ignore", "inherit"] });
    copyFileSync(out, join(FINAL, `${c.id}.mp4`));
    console.log(`${Math.round((Date.now() - t0) / 1000)}s → docs/launch/clips/final/${c.id}.mp4`);
  } catch (e) {
    console.log(`failed: ${String(e).slice(0, 200)}`);
  }
}
