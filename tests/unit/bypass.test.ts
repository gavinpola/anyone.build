import { describe, expect, it } from "vitest";
import { ESLint } from "eslint";
import { findForbidden } from "../../packages/gatekeeper/src/validate/forbidden.js";
import { validateBackendFile } from "../../packages/gatekeeper/src/validate/backend.js";

// The exact bypasses the adversarial review confirmed against the real validators. Each must now be
// caught by BOTH the text validator (findForbidden / validateBackendFile) and the real ESLint config.

const REALM_ESCAPE = `export default function B() {
  const g = [].constructor.constructor("return this")();
  const doc = g["docu" + "ment"];
  const x = doc["coo" + "kie"];
  g["fe" + "tch"]("nope");
  return <div>{String(x)}</div>;
}`;

const JSX_SPREAD = `export default function B() {
  const Tag = "img";
  const attrs = { ["sr" + "c"]: "nope" };
  return <Tag {...attrs} />;
}`;

const MULTILINE_EVAL = `export default function B() {
  const r = eval
  ("2+2");
  return <div>{r}</div>;
}`;

const BACKEND_ESCAPE = `import { roomQuery } from "../../kit/room";
const F = ([])["constr" + "uctor"]["constr" + "uctor"];
export const peek = roomQuery("main", { args: {}, handler: async () => F("return this")() });`;

async function lintRoom(code: string): Promise<string[]> {
  const eslint = new ESLint({ overrideConfigFile: "eslint.config.js" });
  const [res] = await eslint.lintText(code, { filePath: "src/rooms/main/blocks/x.tsx" });
  return (res?.messages ?? []).map((m) => m.message);
}

describe("confirmed bypasses are now caught", () => {
  it("realm escape: [].constructor.constructor — text validator", () => {
    const hits = findForbidden(REALM_ESCAPE).map((h) => h.why);
    expect(hits.some((w) => /constructor|computed string-concat/.test(w))).toBe(true);
  });
  it("realm escape — ESLint", async () => {
    const msgs = await lintRoom(REALM_ESCAPE);
    expect(msgs.join("\n")).toMatch(/constructor|computed member/i);
  });

  it("dynamic JSX tag + spread props — text validator", () => {
    const hits = findForbidden(JSX_SPREAD).map((h) => h.why);
    expect(hits.some((w) => /spread|computed string-concat/.test(w))).toBe(true);
  });
  it("dynamic JSX tag + spread props — ESLint", async () => {
    const msgs = await lintRoom(JSX_SPREAD);
    expect(msgs.join("\n")).toMatch(/spread|computed member/i);
  });

  it("multi-line eval slips the per-line check but not the normalized pass", () => {
    const hits = findForbidden(MULTILINE_EVAL).map((h) => h.why);
    expect(hits.some((w) => /eval/.test(w))).toBe(true);
  });
  it("multi-line eval — ESLint", async () => {
    const msgs = await lintRoom(MULTILINE_EVAL);
    expect(msgs.join("\n")).toMatch(/eval/i);
  });

  it("backend realm escape via split-string constructor — backend validator", () => {
    const probs = validateBackendFile("convex/rooms/main/x.ts", BACKEND_ESCAPE);
    expect(probs.join("\n")).toMatch(/constructor|computed string-concat/);
  });
});

describe("legitimate room code still passes the text validator", () => {
  it("array indexing and normal member access are fine", () => {
    const ok = `export default function B() {
      const arr = [1, 2, 3];
      const first = arr[0];
      const obj = { a: 1 };
      return <div>{first + obj.a}</div>;
    }`;
    expect(findForbidden(ok)).toEqual([]);
  });
});
