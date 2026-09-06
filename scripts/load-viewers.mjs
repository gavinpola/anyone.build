#!/usr/bin/env node
/**
 * Load-test the wall with N lightweight viewers: each one is a Convex client subscribed to what a tab
 * subscribes to (presence, the feed, life, provenance, stats, budget, the art preview; cursors only while
 * the wall is small enough for tabs to send them), heartbeating like a tab. Joins are ramped over --ramp
 * seconds (a launch surge), then it holds for --minutes and reports: time to first value per query, how
 * long until everyone saw the settled presence count, update counts, mutation errors, memory.
 *
 *   node scripts/load-viewers.mjs --url https://<dev>.convex.cloud --n 100 --ramp 10 --minutes 2
 *
 * Run it against the dev deployment (it writes presence rows there); never against prod without a go.
 */
/* global setInterval, clearInterval */
import { ConvexClient } from "convex/browser";
import { makeFunctionReference } from "convex/server";

const arg = (k, d) => {
  const i = process.argv.indexOf(`--${k}`);
  return i >= 0 ? process.argv[i + 1] : d;
};
const url = arg("url", process.env.CONVEX_URL);
const N = Number(arg("n", 100));
const rampS = Number(arg("ramp", 10));
const minutes = Number(arg("minutes", 2));
const roomId = "main";
if (!url) {
  console.error("--url or CONVEX_URL is required");
  process.exit(1);
}

const q = (name) => makeFunctionReference(name);
const hex = () => Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, "0")).join("");
const pct = (xs, p) => (xs.length ? xs.slice().sort((a, b) => a - b)[Math.min(xs.length - 1, Math.floor(xs.length * p))] : null);
const onlineOf = (v) => (typeof v === "number" ? v : (v?.online ?? v?.count ?? v?.present ?? null));

const subs = [
  ["presence:online", { roomId }],
  ["requests:active", { roomId }],
  ["requests:landed", { roomId, limit: 20 }],
  ["life:list", { roomId }],
  ["leaderboard:blockProvenance", { roomId }],
  ["stats:global", {}],
  ["budget:today", {}],
  ["art:latest", { namespace: "open:collab-art" }],
];
const withCursors = N <= 30;

const t0 = Date.now();
const firstValue = Object.fromEntries(subs.map(([n]) => [n, []]));
const updates = Object.fromEntries(subs.map(([n]) => [n, 0]));
if (withCursors) {
  firstValue["cursors:active"] = [];
  updates["cursors:active"] = 0;
}
const settledAt = []; // per viewer: when its presence count first reached 95% of N
const errors = {};
const viewers = [];
let peakOnline = 0;

function note(err) {
  const k = String(err?.message ?? err).replace(/\[Request ID: [^\]]+\]\s*/g, "").slice(0, 80);
  errors[k] = (errors[k] ?? 0) + 1;
}

function spawn(i) {
  const client = new ConvexClient(url, { unsavedChangesWarning: false });
  const sessionId = hex();
  const started = Date.now();
  const seen = new Set();
  let settled = false;
  const watch = (name, args) => {
    client.onUpdate(q(name), args, (v) => {
      updates[name]++;
      if (!seen.has(name)) {
        seen.add(name);
        firstValue[name].push(Date.now() - started);
      }
      if (name === "presence:online") {
        const n = onlineOf(v);
        if (typeof n === "number") {
          peakOnline = Math.max(peakOnline, n);
          if (!settled && n >= Math.ceil(N * 0.95)) {
            settled = true;
            settledAt.push(Date.now() - t0);
          }
        }
      }
    });
  };
  for (const [name, args] of subs) watch(name, args);
  if (withCursors) watch("cursors:active", { roomId, sessionId });
  const beat = () => client.mutation(q("presence:heartbeat"), { roomId, sessionId }).catch(note);
  void beat();
  const timer = setInterval(beat, 60_000);
  let mover = null;
  if (withCursors && i < 10) {
    // a few tabs move their pointer, five times a second, like a real hand
    mover = setInterval(() => {
      client.mutation(q("cursors:move"), { roomId, sessionId, x: Math.random(), y: Math.random(), hue: (i * 37) % 360 }).catch(note);
    }, 200);
  }
  viewers.push({ client, timer, mover, sessionId });
}

console.log(`${N} viewers joining over ${rampS}s, then holding ${minutes} min · ${url.replace(/^https?:\/\//, "")}`);
for (let i = 0; i < N; i++) {
  spawn(i);
  if (rampS > 0) await new Promise((r) => setTimeout(r, (rampS * 1000) / N));
}
const joinedAt = Date.now() - t0;
console.log(`all joined at +${(joinedAt / 1000).toFixed(1)}s · rss ${(process.memoryUsage().rss / 1e6).toFixed(0)} MB`);

const holdEnd = Date.now() + minutes * 60_000;
let lastReport = Date.now();
while (Date.now() < holdEnd) {
  await new Promise((r) => setTimeout(r, 1000));
  if (Date.now() - lastReport >= 30_000) {
    lastReport = Date.now();
    const total = Object.values(updates).reduce((a, b) => a + b, 0);
    console.log(`+${((Date.now() - t0) / 1000).toFixed(0)}s · updates ${total} · settled ${settledAt.length}/${N} · peak online ${peakOnline} · errors ${Object.values(errors).reduce((a, b) => a + b, 0)}`);
  }
}

// leave politely, in batches
for (const v of viewers) {
  clearInterval(v.timer);
  if (v.mover) clearInterval(v.mover);
}
for (const v of viewers) {
  v.client.mutation(q("presence:leave"), { roomId, sessionId: v.sessionId }).catch(() => {});
  if (withCursors) v.client.mutation(q("cursors:leave"), { roomId, sessionId: v.sessionId }).catch(() => {});
}
await new Promise((r) => setTimeout(r, 1500));
for (const v of viewers) v.client.close();

const report = {
  viewers: N,
  rampSeconds: rampS,
  holdMinutes: minutes,
  joinedAfterMs: joinedAt,
  peakOnline,
  settled: { count: settledAt.length, p50Ms: pct(settledAt, 0.5), p95Ms: pct(settledAt, 0.95), maxMs: pct(settledAt, 1) },
  firstValueMs: Object.fromEntries(Object.entries(firstValue).map(([k, xs]) => [k, { p50: pct(xs, 0.5), p95: pct(xs, 0.95), got: xs.length }])),
  updates,
  updatesPerViewer: Number((Object.values(updates).reduce((a, b) => a + b, 0) / N).toFixed(1)),
  errors,
  rssMB: Number((process.memoryUsage().rss / 1e6).toFixed(0)),
};
console.log(JSON.stringify(report, null, 2));
process.exit(0);
