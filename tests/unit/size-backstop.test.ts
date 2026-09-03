import { describe, expect, it } from "vitest";
import { normalizeJudge } from "../../packages/gatekeeper/src/models";
import type { JudgeVerdict } from "../../packages/gatekeeper/src/schemas";

// The model's known failure mode: rejecting *because* an ask is big ("a big project; ask for
// something smaller"). Size is scope, never a verdict — this must become a large proposal.
const input = (trust: number) => ({ prompt: "build me a dino game app like in chrome", target: { path: "src/rooms/main/blocks/a.tsx", line: 1 }, snippet: "", manifest: [], recentChanges: [], requester: { handle: "u", trust } }) as never;
const base = { scope: "tiny", confidence: 0.6, touches_other_blocks: false, touches_backend: false, rationale: "" } as const;

describe("size is never a reason to reject", () => {
  it("a size-flavored 'unclear' reject becomes a large too_big proposal with a plan", () => {
    const v = { ...base, verdict: "reject", category: "unclear", public_hint: "A Chrome-like dino game is a big project; please ask for a smaller, more specific feature.", plan: [] } as unknown as JudgeVerdict;
    const n = normalizeJudge(v, input(-1));
    expect(n.verdict).toBe("reject");
    expect(n.category).toBe("too_big");
    expect(n.scope).toBe("large");
    expect(n.plan.length).toBeGreaterThan(0);
    expect(n.public_hint).toMatch(/up for a vote/i);
  });
  it("a size-flavored needs_human hedge becomes a large too_big proposal too", () => {
    const v = { ...base, verdict: "needs_human", category: null, public_hint: "This is too ambitious for an automatic change.", plan: ["Make a page"] } as unknown as JudgeVerdict;
    const n = normalizeJudge(v, input(1));
    expect(n.category).toBe("too_big");
    expect(n.scope).toBe("large");
  });
  it("a genuine no-plan 'unclear' with no size talk stays unclear", () => {
    const v = { ...base, verdict: "reject", category: "unclear", public_hint: "Point at something and say what should change.", plan: [] } as unknown as JudgeVerdict;
    const n = normalizeJudge(v, input(1));
    expect(n.category).toBe("unclear");
  });
  it("a real safety reject is never rescued by size language", () => {
    const v = { ...base, verdict: "reject", category: "unsafe_code", public_hint: "That would track visitors; it's too big a risk.", plan: [] } as unknown as JudgeVerdict;
    const n = normalizeJudge(v, input(3));
    expect(n.category).toBe("unsafe_code");
  });
});
