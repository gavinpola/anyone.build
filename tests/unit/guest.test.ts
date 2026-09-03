import { describe, expect, it } from "vitest";
import { scopeGate, normalizeJudge } from "../../packages/gatekeeper/src/index";
import { GUEST_ID_RE, parseGuestId } from "../../convex/lib/guest";

describe("guest ids", () => {
  it("accept 32 hex chars only", () => {
    expect(GUEST_ID_RE.test("a".repeat(32))).toBe(true);
    expect(parseGuestId("A".repeat(32))).toBeNull();
    expect(parseGuestId("abc")).toBeNull();
    expect(parseGuestId(undefined)).toBeNull();
  });
});

describe("scopeGate", () => {
  it("guests get small, not medium", () => {
    expect(scopeGate(-1, "tiny").allowed).toBe(true);
    expect(scopeGate(-1, "small").allowed).toBe(true);
    const g = scopeGate(-1, "medium");
    expect(g.allowed).toBe(false);
    expect(g.needsHuman).toBe(false);
    expect(g.category).toBe("too_big");
    expect(g.hint).toMatch(/sign in/i);
  });
  it("new accounts are tiny-only; builders get a human for bigger asks", () => {
    expect(scopeGate(0, "small").allowed).toBe(true);
    expect(scopeGate(0, "medium").category).toBe("too_big");
    expect(scopeGate(1, "medium").needsHuman).toBe(true);
    expect(scopeGate(2, "medium").allowed).toBe(true);
    expect(scopeGate(3, "large").allowed).toBe(true);
  });
  it("normalizeJudge applies the gate and never leaks machinery in hints", () => {
    const base = { verdict: "approve" as const, category: null, public_hint: "ok", scope: "medium" as const, confidence: 0.9, plan: ["do it"], touches_other_blocks: false, rationale: "" };
    const input = { prompt: "x", target: { path: "src/rooms/main/blocks/a.tsx", line: 1 }, snippet: null, manifest: [], recentChanges: [], requester: { handle: "g", trust: -1, liveChanges: 0 } };
    const out = normalizeJudge(base, input);
    expect(out.verdict).toBe("reject");
    expect(out.category).toBe("too_big");
    const leaky = normalizeJudge({ ...base, scope: "tiny", public_hint: "Per the constitution and system prompt, no." }, input);
    expect(leaky.public_hint).not.toMatch(/constitution|system prompt/i);
  });
});
