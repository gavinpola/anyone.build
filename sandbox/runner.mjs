// The coder. Runs INSIDE the sandbox (or locally for contributors) against a clone of the repo.
// Small tool-calling loop on the Vercel AI SDK; any OpenRouter model with tool calling works.
// The tools themselves enforce the editable surface (src/rooms/**), so no prompt can widen it.
//
//   AB_JOB='{"systemPrompt":...,"userPrompt":...,"model":"z-ai/glm-5.3-flash","maxSteps":24,"maxTokens":400000,"scope":"small"}' \
//   AB_MODEL_KEY=sk-or-... node sandbox/runner.mjs
//
// In the Vercel Sandbox, AB_MODEL_KEY is a placeholder: the firewall injects the real key at egress.
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { generateText, tool, stepCountIs } from "ai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { z } from "zod";
import { isAllowedPath, isAllowedNewFile, BACKEND_FILE_RE } from "../packages/gatekeeper/src/validate/paths.js";
import { findForbidden } from "../packages/gatekeeper/src/validate/forbidden.js";
import { validateBackendFile } from "../packages/gatekeeper/src/validate/backend.js";

const root = process.cwd();
const outDir = process.env.AB_OUT ?? path.join(root, ".ab-out");
fs.mkdirSync(outDir, { recursive: true });
const job = JSON.parse(process.env.AB_JOB ?? fs.readFileSync(process.argv[2] ?? path.join(outDir, "job.json"), "utf8"));
const MAX_FILE_BYTES = 40 * 1024;
const MAX_BLOCK_LINES = 400;
const started = Date.now();
const log = (...a) => console.error(`[runner +${((Date.now() - started) / 1000).toFixed(1)}s]`, ...a);

function resolveInRepo(p) {
  const abs = path.resolve(root, p);
  if (!abs.startsWith(root + path.sep)) throw new Error("path escapes the repo");
  return abs;
}
function rel(abs) {
  return path.relative(root, abs).replaceAll("\\", "/");
}
const IGNORE = new Set(["node_modules", ".git", "dist", ".ab-out", ".vercel", ".convex", "coverage"]);

function guardWrite(p, content) {
  const r = p.replace(/^\.\//, "");
  if (!isAllowedPath(r)) return `Not allowed: only files under src/rooms/ may be written (${r}).`;
  const backend = BACKEND_FILE_RE.test(r) || r.startsWith("convex/");
  if (backend && !job.allowBackend) return `Not allowed: this request wasn't approved for backend changes (${r}).`;
  const exists = fs.existsSync(resolveInRepo(r));
  if (!exists && !isAllowedNewFile(r)) return `Not allowed: new files must be blocks (src/rooms/main/blocks/<slug>.tsx), pages (src/rooms/main/pages/<slug>.tsx), or room functions (convex/rooms/main/<file>.ts) (${r}).`;
  if (backend) {
    const problems = validateBackendFile(r, content);
    if (problems.length) return `Not allowed, fix before writing: ${problems.slice(0, 6).join("; ")}`;
    return null;
  }
  if (Buffer.byteLength(content, "utf8") > MAX_FILE_BYTES) return `Too large: files are capped at ${MAX_FILE_BYTES / 1024} KB.`;
  const lines = content.split("\n").length;
  if (lines > MAX_BLOCK_LINES) return `Too long: ${lines} lines, max ${MAX_BLOCK_LINES}. Split or simplify.`;
  const hits = findForbidden(content);
  if (hits.length) return `Forbidden content, fix before writing: ${[...new Set(hits.map((h) => `${h.why} (line ${h.line})`))].slice(0, 8).join("; ")}`;
  return null;
}

// Call the installed binaries directly: inside the sandbox the `pnpm` shim tries to fetch itself from the
// registry, which the firewall blocks, and every `pnpm exec` would stall for a minute before failing.
function bin(name) {
  const local = path.join(root, "node_modules", ".bin", name);
  return fs.existsSync(local) ? { cmd: local, pre: [] } : { cmd: "pnpm", pre: ["exec", name] };
}
function runBin(name, args, timeoutMs) {
  const b = bin(name);
  return run(b.cmd, [...b.pre, ...args], timeoutMs);
}

function run(cmd, args, timeoutMs) {
  const r = spawnSync(cmd, args, { cwd: root, encoding: "utf8", timeout: timeoutMs, maxBuffer: 16 * 1024 * 1024, env: { ...process.env, CI: "1", FORCE_COLOR: "0" } });
  const out = `${r.stdout ?? ""}\n${r.stderr ?? ""}`.trim();
  const tail = out.split("\n").slice(-60).join("\n");
  return { ok: r.status === 0 && !r.error, output: tail || (r.error ? String(r.error) : "") };
}

const tools = {
  list_files: tool({
    description: "List files under a directory of the repo (default src). Skips node_modules and build output.",
    inputSchema: z.object({ dir: z.string().default("src").describe("Directory relative to the repo root") }),
    execute: async ({ dir }) => {
      const abs = resolveInRepo(dir);
      const out = [];
      const walk = (d, depth) => {
        if (out.length >= 400 || depth > 6) return;
        for (const e of fs.readdirSync(d, { withFileTypes: true })) {
          if (IGNORE.has(e.name)) continue;
          const p = path.join(d, e.name);
          if (e.isDirectory()) walk(p, depth + 1);
          else out.push(rel(p));
        }
      };
      if (!fs.existsSync(abs)) return `No such directory: ${dir}`;
      walk(abs, 0);
      return out.join("\n") || "(empty)";
    },
  }),
  read_file: tool({
    description: "Read a file from the repo. Use it on the target file, @/kit (src/kit/index.ts), and any example you want to imitate.",
    inputSchema: z.object({ path: z.string() }),
    execute: async ({ path: p }) => {
      const abs = resolveInRepo(p);
      if (!fs.existsSync(abs) || fs.statSync(abs).isDirectory()) return `No such file: ${p}`;
      const buf = fs.readFileSync(abs);
      if (buf.length > 120 * 1024) return `File too large to read (${buf.length} bytes).`;
      return buf.toString("utf8");
    },
  }),
  write_file: tool({
    description: "Create or fully replace a file under src/rooms/. New files must be blocks: src/rooms/<room>/blocks/<slug>.tsx.",
    inputSchema: z.object({ path: z.string(), content: z.string() }),
    execute: async ({ path: p, content }) => {
      const err = guardWrite(p, content);
      if (err) return err;
      const abs = resolveInRepo(p);
      fs.mkdirSync(path.dirname(abs), { recursive: true });
      fs.writeFileSync(abs, content);
      log("wrote", p, content.length, "chars");
      return `Wrote ${p} (${content.split("\n").length} lines).`;
    },
  }),
  edit_file: tool({
    description: "Replace one exact occurrence of old_string with new_string in a file under src/rooms/. old_string must match exactly once.",
    inputSchema: z.object({ path: z.string(), old_string: z.string().min(1), new_string: z.string() }),
    execute: async ({ path: p, old_string, new_string }) => {
      const abs = resolveInRepo(p);
      if (!fs.existsSync(abs)) return `No such file: ${p}`;
      const cur = fs.readFileSync(abs, "utf8");
      const n = cur.split(old_string).length - 1;
      if (n === 0) return "old_string not found. Read the file again and copy the exact text.";
      if (n > 1) return `old_string matches ${n} times; include more surrounding context so it matches once.`;
      const next = cur.replace(old_string, () => new_string);
      const err = guardWrite(p, next);
      if (err) return err;
      fs.writeFileSync(abs, next);
      log("edited", p);
      return `Edited ${p}.`;
    },
  }),
  run_checks: tool({
    description: "Run typecheck, lint, build, and the playground validator. Call this after editing; fix anything it reports, then call it again.",
    inputSchema: z.object({}),
    execute: async () => {
      execFileSync("git", ["add", "-A", "src/rooms", "convex/rooms"], { cwd: root });
      const staged = execFileSync("git", ["diff", "--cached", "--name-only"], { cwd: root, encoding: "utf8" });
      const touchesBackend = /^convex\/rooms\//m.test(staged);
      const typecheck = runBin("tsc", ["-p", "tsconfig.json"], 180_000);
      const typecheckBackend = touchesBackend ? runBin("tsc", ["-p", "convex/tsconfig.json"], 180_000) : { ok: true, output: "" };
      if (!typecheckBackend.ok) { typecheck.ok = false; typecheck.output += "\n(convex) " + typecheckBackend.output; }
      const lint = runBin("eslint", touchesBackend ? ["src/rooms", "convex/rooms"] : ["src/rooms"], 120_000);
      const validator = run("node", ["scripts/validate-playground.mjs", "--staged", "--scope", job.scope ?? "large"], 60_000);
      const build = typecheck.ok && lint.ok && validator.ok ? runBin("vite", ["build"], 240_000) : { ok: false, output: "(skipped: fix the errors above first)" };
      last = { typecheck: typecheck.ok, lint: lint.ok, validator: validator.ok, build: build.ok };
      log("checks", last);
      for (const [name, r] of Object.entries({ typecheck, lint, validator, build })) if (!r.ok) log(`${name} output:`, r.output.slice(-600));
      const sections = [
        `typecheck: ${typecheck.ok ? "ok" : "FAIL\n" + typecheck.output}`,
        `lint: ${lint.ok ? "ok" : "FAIL\n" + lint.output}`,
        `validator: ${validator.ok ? "ok" : "FAIL\n" + validator.output}`,
        `build: ${build.ok ? "ok" : "FAIL\n" + build.output}`,
      ];
      return sections.join("\n\n").slice(0, 12_000);
    },
  }),
};
let last = { typecheck: false, lint: false, validator: false, build: false };

const openrouter = createOpenRouter({
  apiKey: process.env.AB_MODEL_KEY || "sandbox-placeholder",
  baseURL: process.env.AB_MODEL_BASE_URL || undefined,
  headers: { "HTTP-Referer": "https://anyone.build", "X-Title": "anyone.build coder" },
});

const maxSteps = Math.min(40, job.maxSteps ?? 24);
const maxTokens = job.maxTokens ?? 600_000;
// Hard wall-clock budget: stop the loop with a result before the sandbox itself is killed.
const deadlineMs = Math.max(60_000, job.deadlineMs ?? 8 * 60_000);
const outOfTime = () => Date.now() - started > deadlineMs;
const usageSoFar = (steps) => steps.reduce((a, s) => a + (s.usage?.inputTokens ?? 0) + (s.usage?.outputTokens ?? 0), 0);

let text = "";
let steps = [];
let totalUsage = { inputTokens: 0, outputTokens: 0 };
let error;
const changedSoFar = () => {
  try {
    return execFileSync("git", ["status", "--porcelain", "--", "src/rooms", "convex/rooms"], { cwd: root, encoding: "utf8" }).trim().length > 0;
  } catch {
    return false;
  }
};
const onStepFinish = (s) => {
  log("step", s.toolCalls?.map((c) => c.toolName).join(",") || "(text)", `in=${s.usage?.inputTokens ?? 0} out=${s.usage?.outputTokens ?? 0}`, s.finishReason === "length" ? "(cut off: output cap)" : "");
  // a refused write is the difference between "made no changes" and knowing why
  for (const r of s.toolResults ?? []) {
    const out = typeof r.output === "string" ? r.output : "";
    if ((r.toolName === "write_file" || r.toolName === "edit_file") && /^(Not allowed|Too |Forbidden|No such|old_string)/.test(out)) log("refused", r.toolName, out.slice(0, 160));
  }
};
// Up to three rounds: a model that answers in text without touching a file gets told, once or twice,
// to use the tools. Each round shares the deadline, the step cap, and the token budget.
const NUDGE = "\n\nYou replied with text but changed no files. Make the change now: edit_file for an existing file (an exact old_string → new_string), write_file only for a new file. Never paste code as text: a text reply without a tool call ends the run with nothing changed.";
for (let round = 0; round < 3; round++) {
  try {
    const result = await generateText({
      model: openrouter.chat(job.model),
      system: job.systemPrompt,
      prompt: round === 0 ? job.userPrompt : job.userPrompt + NUDGE,
      tools,
      stopWhen: [stepCountIs(Math.max(1, maxSteps - steps.length)), ({ steps: s }) => usageSoFar(steps) + usageSoFar(s) > maxTokens, () => outOfTime()],
      abortSignal: AbortSignal.timeout(Math.max(1000, deadlineMs - (Date.now() - started) + 30_000)),
      maxOutputTokens: 16000, // per step: a whole block file must fit in one write_file call (8000 cut mediums off mid-write)
      temperature: 0.2,
      maxRetries: 2,
      onStepFinish,
    });
    text = result.text ?? "";
    steps = steps.concat(result.steps ?? []);
    const u = result.totalUsage ?? {};
    totalUsage = { inputTokens: (totalUsage.inputTokens ?? 0) + (u.inputTokens ?? 0), outputTokens: (totalUsage.outputTokens ?? 0) + (u.outputTokens ?? 0) };
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
    log("model error", error);
    break;
  }
  if (changedSoFar() || outOfTime() || steps.length >= maxSteps) break;
  log("round", round + 1, "ended with no change; nudging the model to use the tools");
}
if (!error && outOfTime()) error = `ran out of time after ${steps.length} steps (${Math.round((Date.now() - started) / 1000)}s)`;
else if (!error && steps.length >= maxSteps) error = `hit the step limit (${maxSteps}) without finishing`;

// Final deterministic verification regardless of what the model claimed.
execFileSync("git", ["add", "-A", "src/rooms", "convex/rooms"], { cwd: root });
const diff = execFileSync("git", ["diff", "--cached", "--binary", "--no-color"], { cwd: root, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
const files = [...diff.matchAll(/^diff --git a\/(.+?) b\/(.+)$/gm)].map((m) => m[2]);
if (diff.trim() && !(last.typecheck && last.lint && last.validator && last.build)) {
  log("re-running checks before handing off");
  await tools.run_checks.execute({}, { toolCallId: "final", messages: [] });
}
let summary = "";
try {
  const m = text.match(/\{[\s\S]*\}/);
  if (m) summary = String(JSON.parse(m[0]).summary ?? "");
} catch {
  /* ignore */
}
if (!summary) summary = files.length ? `Changed ${files.map((f) => path.basename(f)).join(", ")}.` : "No changes were made.";

const ok = !error && diff.trim().length > 0 && last.typecheck && last.lint && last.validator && last.build;
fs.writeFileSync(path.join(outDir, "diff.patch"), diff);
const result = {
  ok,
  summary: summary.slice(0, 200),
  files,
  steps: steps.length,
  inputTokens: totalUsage.inputTokens ?? 0,
  outputTokens: totalUsage.outputTokens ?? 0,
  checks: last,
  error: error ?? (diff.trim() ? undefined : "the agent made no changes"),
  elapsedMs: Date.now() - started,
};
fs.writeFileSync(path.join(outDir, "result.json"), JSON.stringify(result, null, 2));
console.log("AB_RESULT " + JSON.stringify(result));
process.exit(ok ? 0 : 2);
