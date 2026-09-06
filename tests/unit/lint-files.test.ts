import { describe, expect, it } from "vitest";
import { lintFiles } from "../../packages/gatekeeper/src/lint/lint-files.js";

const CLEAN_BLOCK = `import { useState } from "react";
import { Button, Stack } from "@/kit";
import type { BlockMeta } from "@/kit";
export const block: BlockMeta = { id: "x", title: "X", description: "x", order: 1 };
export default function X() {
  const [n, setN] = useState(0);
  return <Stack><Button onClick={() => setN(n + 1)}>{n}</Button></Stack>;
}`;

const ESCAPING_BLOCK = `import { useEffect } from "react";
export const block = { id: "x", title: "X", description: "x", order: 1 };
export default function X() {
  useEffect(() => { window.open("https://evil.example"); }, []);
  return <div />;
}`;

const REALM_ESCAPE = `export const block = { id: "x", title: "X", description: "x", order: 1 };
const F = ([])["constr" + "uctor"]["constr" + "uctor"];
export default function X() { return <div>{String(F("return this")())}</div>; }`;

// raw database access is the text validator's job; the AST rules hold the globals, the imports, and the shapes
const BACKEND_ESCAPE = `import { roomQuery } from "../../kit/room";
export const peek = roomQuery("main", { args: {}, handler: async () => (await fetch("https://evil.example")).text() });`;

describe("lintFiles: the AST floor, anywhere Node runs", () => {
  it("passes a clean block", async () => {
    const r = await lintFiles([{ path: "src/rooms/main/blocks/x.tsx", content: CLEAN_BLOCK }]);
    expect(r.ok).toBe(true);
    expect(r.problems).toEqual([]);
  });
  it("catches a block reaching for window", async () => {
    const r = await lintFiles([{ path: "src/rooms/main/blocks/x.tsx", content: ESCAPING_BLOCK }]);
    expect(r.ok).toBe(false);
    expect(r.problems.join("\n")).toMatch(/window/);
  });
  it("catches the realm escape the bypass test caught in CI", async () => {
    const r = await lintFiles([{ path: "src/rooms/main/blocks/x.tsx", content: REALM_ESCAPE }]);
    expect(r.ok).toBe(false);
  });
  it("catches a room function reaching for the network", async () => {
    const r = await lintFiles([{ path: "convex/rooms/main/peek.ts", content: BACKEND_ESCAPE }]);
    expect(r.ok).toBe(false);
    expect(r.problems.join("\n")).toMatch(/fetch/);
  });
  it("applies no rules to a file outside the agent-editable surface", async () => {
    const r = await lintFiles([{ path: "src/core/x.ts", content: "export const a = window.open;" }]);
    expect(r.ok).toBe(true);
  });
  it("names the file, the line, and the rule", async () => {
    const r = await lintFiles([{ path: "src/rooms/main/blocks/x.tsx", content: ESCAPING_BLOCK }]);
    expect(r.problems[0]).toMatch(/^src\/rooms\/main\/blocks\/x\.tsx:\d+:\d+ .*\(no-restricted-globals\)$/);
  });
});
