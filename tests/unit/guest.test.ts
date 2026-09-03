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
  it("guests ship up to medium; large goes to the vote", () => {
    expect(scopeGate(-1, "tiny").allowed).toBe(true);
    expect(scopeGate(-1, "small").allowed).toBe(true);
    expect(scopeGate(-1, "medium").allowed).toBe(true);
    const g = scopeGate(-1, "large");
    expect(g.allowed).toBe(false);
    expect(g.needsHuman).toBe(false);
    expect(g.category).toBe("too_big");
    expect(g.hint).toMatch(/vote/i);
  });
  it("new accounts are tiny-only; builders get a human for bigger asks", () => {
    // medium just goes for everyone; only large from newcomers is voted on
    expect(scopeGate(0, "small").allowed).toBe(true);
    expect(scopeGate(0, "medium").allowed).toBe(true);
    expect(scopeGate(0, "large").category).toBe("too_big");
    expect(scopeGate(1, "large")).toMatchObject({ allowed: false, needsHuman: false, category: "too_big" });
    expect(scopeGate(2, "large").allowed).toBe(true);
    expect(scopeGate(3, "large").allowed).toBe(true);
  });
  it("normalizeJudge applies the gate and never leaks machinery in hints", () => {
    // a genuinely large, multi-block ask from a guest trips the gate → up for a vote
    const base = { verdict: "approve" as const, category: null, public_hint: "ok", scope: "large" as const, confidence: 0.9, plan: ["change every block"], touches_other_blocks: true, touches_backend: false, rationale: "" };
    const input = { prompt: "x", target: { path: "src/rooms/main/blocks/a.tsx", line: 1 }, snippet: null, manifest: [], recentChanges: [], requester: { handle: "g", trust: -1, liveChanges: 0 } };
    const out = normalizeJudge(base, input);
    expect(out.verdict).toBe("reject");
    expect(out.category).toBe("too_big");
    // ...but "large" on a single block is a model over-estimate: capped to medium, so it just goes
    const single = normalizeJudge({ ...base, touches_other_blocks: false, plan: ["restyle this block in dark mode with a thunderbolt"] }, input);
    expect(single.scope).toBe("medium");
    expect(single.verdict).toBe("approve");
    // a page can legitimately be large
    const page = normalizeJudge({ ...base, touches_other_blocks: false, plan: ["Create a new page at src/rooms/main/pages/game.tsx"] }, input);
    expect(page.scope).toBe("large");
    const leaky = normalizeJudge({ ...base, scope: "tiny", public_hint: "Per the constitution and system prompt, no." }, input);
    expect(leaky.public_hint).not.toMatch(/constitution|system prompt/i);
  });
});
