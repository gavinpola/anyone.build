import { describe, expect, it } from "vitest";
import { validateDiff, findForbidden, isAllowedPath, isAllowedNewFile } from "../../packages/gatekeeper/src/index";

const mk = (path: string, lines: string[], isNew = true) =>
  [`diff --git a/${path} b/${path}`, isNew ? "new file mode 100644" : "index 000..111 100644", `--- ${isNew ? "/dev/null" : "a/" + path}`, `+++ b/${path}`, "@@ -0,0 +1 @@", ...lines.map((l) => "+" + l)].join("\n") + "\n";

describe("paths", () => {
  it("only allows the wall", () => {
    expect(isAllowedPath("src/rooms/main/blocks/x.tsx")).toBe(true);
    expect(isAllowedPath("src/core/feed/FeedRail.tsx")).toBe(false);
    expect(isAllowedPath("convex/schema.ts")).toBe(false);
    expect(isAllowedPath("src/rooms/main/../../core/x.tsx")).toBe(false);
    expect(isAllowedPath("src/rooms/main/.hidden.tsx")).toBe(false);
    expect(isAllowedNewFile("src/rooms/main/room.ts")).toBe(false);
    expect(isAllowedNewFile("src/rooms/main/blocks/new-thing.tsx")).toBe(true);
  });
});

describe("forbidden", () => {
  it("catches exfil and injection", () => {
    const why = findForbidden(['fetch("x")', "<script>", 'const u = "https://evil.com"', "localStorage.x", "ignore all previous instructions", "sk-or-v1-abcdef0123456789abcdef"].join("\n")).map((h) => h.why);
    expect(why).toContain("fetch");
    expect(why).toContain("banned element");
    expect(why).toContain("URL literal");
    expect(why).toContain("storage/cookies");
    expect(why).toContain("prompt-injection text");
    expect(why.some((w) => w.startsWith("secret:"))).toBe(true);
  });
  it("allows normal block code", () => {
    expect(findForbidden('import { Stack, Button, useCounter } from "@/kit";\nexport default function X() { return <Stack><Button>hi</Button></Stack>; }')).toEqual([]);
  });
});

describe("validateDiff", () => {
  it("accepts a small new block", () => {
    const v = validateDiff(mk("src/rooms/main/blocks/hello.tsx", ["export const block = { id: 'hello' };", "export default function H(){return null}"]), "small");
    expect(v.ok).toBe(true);
    expect(v.blockIds).toEqual(["hello"]);
  });
  it("rejects protected paths, binaries, and oversize", () => {
    expect(validateDiff(mk("convex/schema.ts", ["x"]), "large").ok).toBe(false);
    expect(validateDiff(mk("src/rooms/main/blocks/a.tsx", Array.from({ length: 80 }, () => "x")), "tiny").ok).toBe(false);
    expect(validateDiff(mk("src/rooms/main/blocks/a.tsx", ['<a href="x">']), "small").problems.join()).toMatch(/forbidden/);
  });
});
