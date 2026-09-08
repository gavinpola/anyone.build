#!/usr/bin/env node
/**
 * The cut list: launch/video/cuts.json, from the recorder's marks (docs/launch/clips/raw/marks.json), the
 * voice timings (launch/video/public/voice-<clip>.json, if any), and the recipes below. Copies the raw
 * .webm files into launch/video/public/ so Remotion can read them. Two masters per clip: a voiced one
 * (when the voice file exists) and a silent one with captions; and two aspects where the footage allows.
 *
 *   node launch/cut.mjs
 */
import { readFileSync, writeFileSync, copyFileSync, existsSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const RAW = join(here, "..", "docs", "launch", "clips", "raw");
const PUB = join(here, "video", "public");
mkdirSync(PUB, { recursive: true });
const marks = JSON.parse(readFileSync(join(RAW, "marks.json"), "utf8"));
const at = (scene, note) => marks.marks.find((m) => m.scene === scene && m.note.startsWith(note))?.t;
const end = (scene) => Math.max(...marks.marks.filter((m) => m.scene === scene).map((m) => m.t), 0) + 0.8;
const voice = (clip) => {
  const p = join(PUB, `voice-${clip}.json`);
  return existsSync(p) ? JSON.parse(readFileSync(p, "utf8")) : null;
};
/** Captions from the voice's words: about six words a line, on the words' own times. */
function captionsFrom(v, offset = 0) {
  if (!v) return [];
  const out = [];
  let line = [];
  for (const w of v.words) {
    line.push(w);
    const text = line.map((x) => x.text).join(" ");
    if (line.length >= 6 || /[.!?]$/.test(w.text) || text.length > 34) {
      out.push({ from: line[0].start + offset, to: w.end + offset + 0.15, text });
      line = [];
    }
  }
  if (line.length) out.push({ from: line[0].start + offset, to: line[line.length - 1].end + offset + 0.15, text: line.map((x) => x.text).join(" ") });
  return out;
}
/** Silent masters get the hook and the same lines, spaced evenly over the clip. */
function captionsEven(lines, duration, start = 1.6) {
  const slot = (duration - start) / Math.max(1, lines.length);
  return lines.map((text, i) => ({ from: start + i * slot, to: start + (i + 1) * slot - 0.1, text }));
}

// Each recipe: the scenes and beats it uses, and the on-screen lines for the silent master.
// Beats are the recorder's mark notes; a segment is [scene, fromNote, toNote|"end", speed?, zoom?].
const RECIPES = {
  gta: {
    hook: "Someone asked this website for GTA 6.",
    segments: [
      ["desktop-gta", "share page", "ringed"],
      ["desktop-gta", "game tapped", "end"],
      ["desktop-ledger", "changes", "costs"],
    ],
    lines: ["\"turn this into gta6 but in the browser\"", "It built it. In the browser.", "It cost six cents.", "What would you ask for?"],
  },
  loop: {
    hook: "This website does whatever you ask it to.",
    segments: [
      ["desktop-loop", "at the game", "pointed"],
      ["desktop-loop", "pointed", "typed", 1, { x: 0.5, y: 0.55, scale: 1.35 }],
      ["desktop-loop", "typed", "judging"],
      ["desktop-loop", "judging", "verdict", 2],
      ["card", "2 minutes later"],
      ["desktop-live", "share page", "ringed"],
      ["desktop-live", "ledger row", "end"],
    ],
    lines: ["Point at anything.", "Say what should change.", "If it's good for everyone, an AI builds it.", "Live. For everyone.", "As a real pull request."],
  },
  timelapse: {
    hook: "Every change anyone ever made, in ten seconds.",
    segments: [["desktop-timelapse", "play", "end"]],
    lines: ["Nobody made this.", "Everybody made this."],
  },
  rules: {
    hook: "So why isn't it a mess?",
    segments: [
      ["desktop-rules", "rules", "scrolled"],
      ["desktop-rules", "typed promo", "verdict", 1.5],
      ["desktop-rules", "verdict", "vote board"],
      ["desktop-rules", "vote board", "end"],
    ],
    lines: ["Ten rules anyone can read.", "No ads. No links out. Nothing hidden.", "Big asks go to a vote.", "Every three hours the most-wanted one is built.", "No human in the loop."],
  },
  phone: {
    hook: "It works on your phone.",
    segments: [
      ["phone-landing", "landed", "card closed"],
      ["phone-landing", "swiped", "long-pressed"],
      ["phone-landing", "long-pressed", "end"],
    ],
    lines: ["A world of tiles.", "Swipe to walk.", "Hold an object to move it.", "Tap Change, tap anything, say it."],
  },
};

const cuts = [];
for (const [clip, r] of Object.entries(RECIPES)) {
  const segs = [];
  let total = 1.6; // the hook card
  for (const s of r.segments) {
    if (s[0] === "card") {
      segs.push({ src: "", from: 0, to: 1.4, card: s[1] });
      total += 1.4;
      continue;
    }
    const [scene, a, b, speed, zoom] = s;
    const from = at(scene, a);
    const to = b === "end" ? end(scene) : at(scene, b);
    if (from == null || to == null || to <= from) continue;
    const src = `${scene}.webm`;
    if (existsSync(join(RAW, src)) && !existsSync(join(PUB, src))) copyFileSync(join(RAW, src), join(PUB, src));
    segs.push({ src, from, to, speed: speed ?? 1, zoom });
    total += (to - from) / (speed ?? 1);
  }
  if (!segs.length) continue;
  const vertical = clip === "phone";
  const v = voice(clip);
  const duration = Math.max(total, (v?.duration ?? 0) + 2);
  const base = { width: vertical ? 1080 : 1920, height: vertical ? 1920 : 1080, hook: r.hook, segments: segs };
  if (v) cuts.push({ ...base, id: `${clip}-voiced`, duration, captions: captionsFrom(v, 1.6), audio: `voice-${clip}.mp3`, silent: false });
  cuts.push({ ...base, id: `${clip}-silent`, duration: total, captions: captionsEven(r.lines, total), audio: null, silent: true });
  // a vertical master of the desktop clips too: the footage sits in the middle band with the captions below
  if (!vertical) cuts.push({ ...base, width: 1080, height: 1920, id: `${clip}-silent-vertical`, duration: total, captions: captionsEven(r.lines, total), audio: null, silent: true });
}
writeFileSync(join(here, "video", "cuts.json"), JSON.stringify(cuts, null, 2));
console.log(`${cuts.length} compositions → launch/video/cuts.json`);
for (const c of cuts) console.log(`  ${c.id.padEnd(24)} ${c.width}×${c.height}  ${c.duration.toFixed(1)}s  ${c.segments.length} segments  ${c.captions.length} captions`);
