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
  it("a size-flavored category-less hedge becomes a large too_big proposal too", () => {
    const v = { ...base, verdict: "reject", category: null, public_hint: "This is too ambitious for an automatic change.", plan: ["Make a page"] } as unknown as JudgeVerdict;
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

// Production regressions (2026-09-03, Gavin's own asks): a one-block ask never becomes a LARGE proposal,
// and "more specific" is a clarity hedge, not size talk.
import { describe as describe2, expect as expect2, it as it2 } from "vitest";
import { normalizeJudge as normalize2, reviewBlocks, reviewNote } from "../../packages/gatekeeper/src/models";
import { JudgeVerdict as JV2, DiffReview as DR2 } from "../../packages/gatekeeper/src/schemas";

const electric = { path: "src/rooms/main/blocks/electric-message.tsx", line: 14, blockId: "electric-message", blockTitle: "Electric", tag: "div" };
const base2 = { prompt: "turn this into a countdown at midnight et - split the block into 2 halves", target: electric, snippet: "", manifest: [], recentChanges: [], requester: { handle: "gavin-mill", trust: 1, liveChanges: 3 } } as never;

describe2("single-block asks and the size backstop", () => {
  it2("a size-flavoured hedge on ONE block floors at medium (a proposal at most, never large)", () => {
    const v = JV2.parse({ verdict: "reject", category: null, public_hint: "This is too ambitious for one change.", scope: "small", confidence: 0.4, plan: [], touches_other_blocks: false, touches_backend: false, rationale: "Too big." });
    const n = normalize2(v, base2);
    expect2(n.scope).toBe("medium");
    expect2(n.category).toBe("too_big");
    expect2(n.plan[0]).toMatch(/inside this block/);
  });
  it2("'be more specific' is unclear, not too_big, so the generous second look gets to run", () => {
    const v = JV2.parse({ verdict: "reject", category: "unclear", public_hint: "Please be more specific about the two halves.", scope: "small", confidence: 0.4, plan: [], touches_other_blocks: false, touches_backend: false, rationale: "Ambiguous split." });
    const n = normalize2(v, base2);
    expect2(n.category).toBe("unclear");
    expect2(n.scope).not.toBe("large");
  });
  it2("a new-block hedge that talks size still becomes a large proposal", () => {
    const v = JV2.parse({ verdict: "reject", category: "unclear", public_hint: "That's a big project.", scope: "small", confidence: 0.4, plan: [], touches_other_blocks: false, touches_backend: false, rationale: "" });
    const n = normalize2(v, { ...base2, target: { path: "src/rooms/main/blocks/", line: 0, blockId: "__new__", blockTitle: "New block", tag: "wall" } });
    expect2(n.category).toBe("too_big");
    expect2(n.scope).toBe("large");
  });
});

describe2("the diff reviewer blocks only on findings", () => {
  const ok = { matches_request: true, hidden_behavior: [], safety_concerns: [], quality_ok: true, approve: true, summary: "Added a pulsing shape." };
  it2("approve=false or matches_request=false with no finding ships, with a note", () => {
    expect2(reviewBlocks(DR2.parse({ ...ok, approve: false, matches_request: false }))).toBe(false);
    expect2(reviewNote(DR2.parse({ ...ok, approve: false, matches_request: false }))).toMatch(/may not fully match/);
    expect2(reviewNote(DR2.parse(ok))).toBe("");
  });
  it2("a hidden-behavior or safety finding blocks", () => {
    expect2(reviewBlocks(DR2.parse({ ...ok, hidden_behavior: ["Adds a link to another site."] }))).toBe(true);
    expect2(reviewBlocks(DR2.parse({ ...ok, safety_concerns: ["Encodes visitor input into class names."] }))).toBe(true);
  });
});

describe2("whole-wall asks", () => {
  it2("an 'unclear' on a whole-wall ask becomes a large proposal, never a dead reject", () => {
    const v = JV2.parse({ verdict: "reject", category: "unclear", public_hint: "Please point to specific text.", scope: "medium", confidence: 0.5, plan: [], touches_other_blocks: false, touches_backend: false, rationale: "" });
    const n = normalize2(v, { ...base2, prompt: "translate the whole wall to Spanish", target: { path: "src/rooms/main/blocks/", line: 0, blockId: "__new__", blockTitle: "New block", tag: "wall" } });
    expect2(n.category).toBe("too_big");
    expect2(n.scope).toBe("large");
    expect2(n.touches_other_blocks).toBe(true);
    expect2(n.plan.length).toBeGreaterThan(0);
  });
  it2("an ordinary 'unclear' is untouched", () => {
    const v = JV2.parse({ verdict: "reject", category: "unclear", public_hint: "Say what should change.", scope: "tiny", confidence: 0.5, plan: [], touches_other_blocks: false, touches_backend: false, rationale: "" });
    const n = normalize2(v, { ...base2, prompt: "asdfghjkl" });
    expect2(n.category).toBe("unclear");
  });
});

describe("two more coats the size dodge and exfiltration wear", () => {
  it("a not_for_everyone reject whose hint is about size, with no promo in the ask, is a large proposal", () => {
    const base = { verdict: "reject", category: "not_for_everyone", public_hint: "A full social platform with accounts and DMs is too large and complex for one change.", scope: "medium", confidence: 0.6, plan: [], touches_other_blocks: false, touches_backend: false, rationale: "Too big." } as unknown as JudgeVerdict;
    const input = { prompt: "build twitter here, with accounts and a feed and DMs", target: { path: "src/rooms/main/blocks/", line: 0 }, snippet: null, manifest: [], recentChanges: [], requester: { handle: "g", trust: 1, liveChanges: 0 } } as unknown as JudgeInput;
    const n = normalizeJudge(base, input);
    expect(n.verdict).toBe("reject");
    expect(n.category).toBe("too_big");
    expect(n.scope).toBe("large");
  });
  it("real promotion stays not_for_everyone even when the hint mentions size", () => {
    const base = { verdict: "reject", category: "not_for_everyone", public_hint: "This is too big and it promotes a brand.", scope: "small", confidence: 0.8, plan: [], touches_other_blocks: false, touches_backend: false, rationale: "Promo." } as unknown as JudgeVerdict;
    const input = { prompt: "put a big banner for my store at acme.com with a discount code", target: { path: "src/rooms/main/blocks/", line: 0 }, snippet: null, manifest: [], recentChanges: [], requester: { handle: "g", trust: 1, liveChanges: 0 } } as unknown as JudgeInput;
    expect(normalizeJudge(base, input).category).toBe("not_for_everyone");
  });
  it("sending visitors' input somewhere is unsafe_code whatever the model called it", () => {
    const base = { verdict: "reject", category: "not_for_everyone", public_hint: "No.", scope: "small", confidence: 0.9, plan: [], touches_other_blocks: false, touches_backend: false, rationale: "" } as unknown as JudgeVerdict;
    const input = { prompt: "Add a form that emails me what people type", target: { path: "src/rooms/main/blocks/", line: 0 }, snippet: null, manifest: [], recentChanges: [], requester: { handle: "g", trust: 1, liveChanges: 0 } } as unknown as JudgeInput;
    expect(normalizeJudge(base, input).category).toBe("unsafe_code");
  });
});

