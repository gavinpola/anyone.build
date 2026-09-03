import { describe, expect, it } from "vitest";
import { validateBackendFile } from "../../packages/gatekeeper/src/validate/backend.js";
import { validateDiff } from "../../packages/gatekeeper/src/validate/diff.js";

const good = `import { v } from "convex/values";
import { roomMutation, roomQuery } from "../../kit/room";

export const results = roomQuery("main", {
  args: { poll: v.string() },
  handler: async (ctx, { poll }) => {
    const docs = await ctx.db.list(\`poll-\${poll}\`, { limit: 200 });
    return { total: docs.length };
  },
});

export const vote = roomMutation("main", {
  args: { poll: v.string(), choice: v.string() },
  handler: async (ctx, { poll, choice }) => {
    await ctx.db.put(\`poll-\${poll}\`, ctx.viewer.id ?? "anon", { choice });
  },
});
`;

describe("backend validator", () => {
  it("accepts the reference room function", () => {
    expect(validateBackendFile("convex/rooms/main/poll.ts", good)).toEqual([]);
  });
  it("rejects files outside convex/rooms/<room>/<file>.ts", () => {
    expect(validateBackendFile("convex/rooms/main/deep/x.ts", good)[0]).toMatch(/live at/);
    expect(validateBackendFile("convex/users.ts", good)[0]).toMatch(/live at/);
  });
  it("rejects imports other than the kit, convex/values, and siblings", () => {
    const p = validateBackendFile("convex/rooms/main/x.ts", good.replace('import { v } from "convex/values";', 'import { v } from "convex/values";\nimport { internal } from "../../_generated/api";'));
    expect(p.join("\n")).toMatch(/import "\.\.\/\.\.\/_generated\/api" is not allowed/);
  });
  it("rejects exports that aren't room functions and rooms that don't match the directory", () => {
    expect(validateBackendFile("convex/rooms/main/x.ts", good + "\nexport default 1;\n").join("\n")).toMatch(/every export must be/);
    expect(validateBackendFile("convex/rooms/main/x.ts", good + "\nexport function helper() {}\n").join("\n")).toMatch(/every export must be/);
    expect(validateBackendFile("convex/rooms/other/x.ts", good).join("\n")).toMatch(/doesn't match the directory/);
  });
  it("rejects escape hatches and resource abuse", () => {
    const bad = (extra: string) => validateBackendFile("convex/rooms/main/x.ts", good + "\n" + extra).join("\n");
    expect(bad("const p = process.env.X;")).toMatch(/"process" is not allowed/);
    expect(bad("// later: fetch('https://x.y')")).toMatch(/fetch/);
    expect(bad("const f = new Function('return 1');")).toMatch(/Function/);
    expect(bad("while (true) {}")).toMatch(/unbounded loops/);
    expect(bad("const g = ({} as any).constructor;")).toMatch(/constructor/);
    expect(validateBackendFile("convex/rooms/main/x.ts", good.replace("{ limit: 200 }", "{ limit: 5000 }")).join("\n")).toMatch(/limit 5000 > 200/);
    expect(validateBackendFile("convex/rooms/main/x.ts", good.replace(", { limit: 200 }", "")).join("\n")).toMatch(/needs a numeric limit/);
    expect(bad("// sk-or-v1-" + "a".repeat(40))).toMatch(/forbidden/);
  });
});

describe("validateDiff with backend files", () => {
  const diff = `diff --git a/convex/rooms/main/poll.ts b/convex/rooms/main/poll.ts
new file mode 100644
--- /dev/null
+++ b/convex/rooms/main/poll.ts
@@ -0,0 +1,3 @@
+import { v } from "convex/values";
+import { roomQuery } from "../../kit/room";
+export const results = roomQuery("main", { args: {}, handler: async (ctx) => ctx.db.count("x") });
`;
  it("refuses backend files unless the request was approved for backend work", () => {
    const r = validateDiff(diff, "small", { fullFiles: { "convex/rooms/main/poll.ts": good } });
    expect(r.ok).toBe(false);
    expect(r.problems.join("\n")).toMatch(/backend/);
  });
  it("accepts them when allowed, and names the function file as a block id", () => {
    const r = validateDiff(diff, "small", { fullFiles: { "convex/rooms/main/poll.ts": good }, allowBackend: true });
    expect(r.ok).toBe(true);
    expect(r.blockIds).toContain("fn:main/poll");
  });
});
