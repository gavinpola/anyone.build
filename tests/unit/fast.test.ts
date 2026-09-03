import { describe, expect, it } from "vitest";
import { unifiedDiff } from "../../packages/gatekeeper/src/patch";
import { extractRewrite } from "../../packages/gatekeeper/src/prompts/fast";
import { parseUnifiedDiff, validateDiff } from "../../packages/gatekeeper/src/validate/diff.js";
import { fastEligible } from "../../convex/pipeline/fastRules";

const PATH = "src/rooms/main/blocks/hello.tsx";
const base = [
  'import { Card } from "@/kit";',
  "",
  "export default function Hello() {",
  "  return (",
  "    <Card>",
  "      <p>Hello there.</p>",
  "      <p>Have so fun.</p>",
  "    </Card>",
  "  );",
  "}",
  "",
  'export const block = { id: "hello", title: "Hello", description: "A hello", order: 1, size: "s" };',
  "",
].join("\n");

/** Every hunk header must describe its body exactly, or git and the reviewers would be reading lies. */
function checkHunks(diff: string) {
  const lines = diff.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i]!.match(/^@@ -(\d+),(\d+) \+(\d+),(\d+) @@$/);
    if (!m) continue;
    let oldC = 0;
    let newC = 0;
    for (let j = i + 1; j < lines.length && !lines[j]!.startsWith("@@") && lines[j] !== ""; j++) {
      const c = lines[j]![0];
      if (c !== "+") oldC++;
      if (c !== "-") newC++;
    }
    expect([oldC, newC]).toEqual([Number(m[2]), Number(m[4])]);
  }
}

describe("unifiedDiff (the fast path has no git)", () => {
  it("is empty for identical files and parses as one changed line otherwise", () => {
    expect(unifiedDiff(PATH, base, base)).toBe("");
    const next = base.replace("Have so fun.", "Have so much fun.");
    const diff = unifiedDiff(PATH, base, next);
    const files = parseUnifiedDiff(diff);
    expect(files).toHaveLength(1);
    expect(files[0]!.path).toBe(PATH);
    expect(files[0]!.added).toBe(1);
    expect(files[0]!.removed).toBe(1);
    expect(files[0]!.addedLines[0]).toContain("Have so much fun.");
    expect(diff.startsWith(`diff --git a/${PATH} b/${PATH}\n--- a/${PATH}\n+++ b/${PATH}\n@@ `)).toBe(true);
    checkHunks(diff);
    const v = validateDiff(diff, "tiny", { fullFiles: { [PATH]: next } });
    expect(v.ok, v.problems.join("; ")).toBe(true);
    expect(v.blockIds).toEqual(["hello"]);
  });
  it("splits far-apart changes into hunks, and handles inserts and deletes at the ends", () => {
    const many = Array.from({ length: 40 }, (_, i) => `line ${i}`).join("\n") + "\n";
    const edited = many.replace("line 2\n", "line two\n").replace("line 37\n", "line thirty-seven\n");
    const diff = unifiedDiff(PATH, many, edited);
    expect((diff.match(/^@@ /gm) ?? []).length).toBe(2);
    checkHunks(diff);
    const appended = many + "line 40\nline 41\n";
    const d2 = unifiedDiff(PATH, many, appended);
    expect(parseUnifiedDiff(d2)[0]).toMatchObject({ added: 2, removed: 0 });
    checkHunks(d2);
    const trimmed = many.replace("line 0\nline 1\n", "");
    const d3 = unifiedDiff(PATH, many, trimmed);
    expect(parseUnifiedDiff(d3)[0]).toMatchObject({ added: 0, removed: 2 });
    checkHunks(d3);
  });
  it("still trips the validator on a forbidden token in the rewrite", () => {
    const bad = base.replace("Hello there.", 'Hello there. <a href="https://x.test">x</a>');
    const v = validateDiff(unifiedDiff(PATH, base, bad), "tiny", { fullFiles: { [PATH]: bad } });
    expect(v.ok).toBe(false);
  });
});

describe("extractRewrite", () => {
  it("takes the summary and the fenced file, normalising line endings and the final newline", () => {
    const reply = "SUMMARY: Fixed the copy.\r\n```tsx\r\nconst a = 1;\r\nexport default a;\r\n```\r\n";
    expect(extractRewrite(reply)).toEqual({ content: "const a = 1;\nexport default a;\n", summary: "Fixed the copy." });
  });
  it("picks the largest fenced block and tolerates a missing summary", () => {
    const reply = "```\nshort\n```\nHere:\n```typescript\nline1\nline2\nline3\n```";
    expect(extractRewrite(reply)).toEqual({ content: "line1\nline2\nline3\n", summary: "" });
  });
  it("is null for CANNOT, prose without a fence, or an empty block", () => {
    expect(extractRewrite("CANNOT: this needs a new file.")).toBeNull();
    expect(extractRewrite("I changed the file for you.")).toBeNull();
    expect(extractRewrite("```tsx\n\n```")).toBeNull();
  });
});

describe("fastEligible", () => {
  const on = { fastPathEnabled: true };
  const tiny = { scope: "tiny" };
  it("takes a tiny change to one existing block or page file", () => {
    expect(fastEligible({ target: { path: PATH, blockId: "hello" }, verdict: tiny }, on)).toEqual({ ok: true });
    expect(fastEligible({ target: { path: "src/rooms/main/pages/guestbook.tsx", blockId: "page:guestbook" }, verdict: tiny }, on)).toEqual({ ok: true });
  });
  it("leaves everything else to the sandbox", () => {
    expect(fastEligible({ target: { path: PATH, blockId: "hello" }, verdict: { scope: "small" } }, on).ok).toBe(false);
    expect(fastEligible({ target: { path: "src/rooms/main/blocks/", blockId: "__new__" }, verdict: tiny }, on).ok).toBe(false);
    expect(fastEligible({ target: { path: PATH, blockId: "hello" }, verdict: { scope: "tiny", touchesBackend: true } }, on).ok).toBe(false);
    expect(fastEligible({ target: { path: "convex/rooms/main/poll.ts", blockId: "fn:poll" }, verdict: tiny }, on).ok).toBe(false);
    expect(fastEligible({ target: { path: PATH, blockId: "hello" }, verdict: tiny }, { fastPathEnabled: false }).ok).toBe(false);
    expect(fastEligible({ target: { path: PATH, blockId: "hello" }, verdict: null }, on).ok).toBe(false);
  });
});
