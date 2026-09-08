#!/usr/bin/env node
/**
 * The voice: one MP3 per clip from launch/voice-lines.json, through ElevenLabs, with word timings so the
 * captions sit on the words. Writes launch/video/public/voice-<clip>.mp3 and voice-<clip>.json
 * ({ duration, words: [{ text, start, end }] }). The key comes from .secrets/keys.txt and is never printed.
 *
 *   node launch/voice.mjs            # every clip in voice-lines.json
 *   node launch/voice.mjs --only gta
 *   node launch/voice.mjs --voice cjVigY5qzO86Huf0OWal   (Eric, the calmer one; default is Liam)
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const arg = (k, d) => {
  const i = process.argv.indexOf(`--${k}`);
  return i >= 0 ? process.argv[i + 1] : d;
};
const only = arg("only", null);
const VOICE = arg("voice", "TX3LPaxmHKxFdv7VOQHJ"); // Liam: energetic, social-media creator
const MODEL = arg("model", "eleven_multilingual_v2");

const keyLine = readFileSync(join(here, "..", ".secrets", "keys.txt"), "utf8").split("\n").find((l) => l.startsWith("ELEVENLABS_API_KEY="));
const KEY = keyLine ? keyLine.slice("ELEVENLABS_API_KEY=".length).trim() : "";
if (!KEY) {
  console.error("ELEVENLABS_API_KEY missing in .secrets/keys.txt; the clips stay silent");
  process.exit(2);
}
const lines = JSON.parse(readFileSync(join(here, "voice-lines.json"), "utf8"));
const OUT = join(here, "video", "public");
mkdirSync(OUT, { recursive: true });

for (const [clip, spoken] of Object.entries(lines)) {
  if (only && !clip.includes(only)) continue;
  const text = Array.isArray(spoken) ? spoken.join(" ") : String(spoken);
  process.stdout.write(`${clip}: ${text.length} chars … `);
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE}/with-timestamps?output_format=mp3_44100_128`, {
    method: "POST",
    headers: { "xi-api-key": KEY, "content-type": "application/json" },
    body: JSON.stringify({ text, model_id: MODEL, voice_settings: { stability: 0.45, similarity_boost: 0.8, style: 0.35, use_speaker_boost: true } }),
  });
  if (!res.ok) {
    console.log(`failed: ${res.status} ${(await res.text()).slice(0, 160)}`);
    continue;
  }
  const j = await res.json();
  writeFileSync(join(OUT, `voice-${clip}.mp3`), Buffer.from(j.audio_base64, "base64"));
  const a = j.alignment ?? j.normalized_alignment;
  const words = [];
  let cur = null;
  for (let i = 0; i < a.characters.length; i++) {
    const ch = a.characters[i];
    if (/\s/.test(ch)) {
      if (cur) words.push(cur);
      cur = null;
      continue;
    }
    if (!cur) cur = { text: ch, start: a.character_start_times_seconds[i], end: a.character_end_times_seconds[i] };
    else {
      cur.text += ch;
      cur.end = a.character_end_times_seconds[i];
    }
  }
  if (cur) words.push(cur);
  const duration = words.length ? words[words.length - 1].end : 0;
  writeFileSync(join(OUT, `voice-${clip}.json`), JSON.stringify({ clip, text, duration, words }, null, 2));
  console.log(`${duration.toFixed(1)}s, ${words.length} words`);
}
