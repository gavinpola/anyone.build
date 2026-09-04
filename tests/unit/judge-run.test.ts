import { describe, expect, it } from "vitest";
import { judgeWithSecondLooks, type JudgeFn } from "../../packages/gatekeeper/src/judge-run";
import type { JudgeVerdict } from "../../packages/gatekeeper/src/schemas";

const cfg = { apiKey: "x", judgeModel: "google/gemini-2.5-flash", redTeamModel: "google/gemini-3.1-flash-lite", reviewModel: "m" };
const base: JudgeVerdict = { verdict: "approve", category: null, public_hint: "ok", scope: "small", confidence: 0.9, plan: ["a", "b"], touches_other_blocks: false, touches_backend: false, rationale: "" };
const usage = { inputTokens: 1000, outputTokens: 200, model: "m" };
const block = { path: "src/rooms/main/blocks/clock.tsx", line: 20, blockId: "clock" };
const input = (prompt: string, target = block) => ({ prompt, target, snippet: null, manifest: [], recentChanges: [], requester: { handle: "t", trust: 0, liveChanges: 0 } });

/** A scripted judge: returns the verdicts in order; records the addenda it was called with. */
function scripted(verdicts: Array<JudgeVerdict | Error>) {
  const addenda: string[] = [];
  const fn: JudgeFn = async (c) => {
    addenda.push(c.addendum ?? "");
    const v = verdicts.shift();
    if (!v) throw new Error("no more scripted verdicts");
    if (v instanceof Error) throw v;
    return { verdict: v, usage };
  };
  return { fn, addenda };
}

describe("judgeWithSecondLooks (the judge as the pipeline runs it)", () => {
  it("approves in one call when the model approves, and accounts the cost", async () => {
    const s = scripted([base]);
    const r = await judgeWithSecondLooks(cfg, input("make this a countdown"), { backendAvailable: false, judgeFn: s.fn });
    expect(r.verdict.verdict).toBe("approve");
    expect(r.calls).toBe(1);
    expect(r.cents).toBeGreaterThan(0);
    expect(r.secondLooks).toEqual([]);
  });
  it("retries once, then falls back to the other vendor", async () => {
    const s = scripted([new Error("boom"), new Error("boom again"), base]);
    const log: string[] = [];
    const r = await judgeWithSecondLooks(cfg, input("make this a countdown"), { backendAvailable: false, judgeFn: s.fn, log: (m) => log.push(m) });
    expect(r.verdict.verdict).toBe("approve");
    expect(r.calls).toBe(3);
    expect(log.filter((m) => m.startsWith("judge attempt failed"))).toHaveLength(2);
  });
  it("gives a lazy 'unclear' one generous second look, and takes an approve", async () => {
    const s = scripted([{ ...base, verdict: "reject", category: "unclear", plan: [] }, base]);
    const r = await judgeWithSecondLooks(cfg, input("turn this into a countdown at midnight"), { backendAvailable: false, judgeFn: s.fn });
    expect(r.verdict.verdict).toBe("approve");
    expect(r.secondLooks).toEqual(["lazy unclear"]);
    expect(s.addenda[1]).toMatch(/SECOND LOOK: this ask has a target/);
  });
  it("does not second-look a three-word 'unclear' (nothing to interpret)", async () => {
    const s = scripted([{ ...base, verdict: "reject", category: "unclear", plan: [] }]);
    const r = await judgeWithSecondLooks(cfg, input("asdf qwer zxcv"), { backendAvailable: false, judgeFn: s.fn });
    expect(r.verdict.category).toBe("unclear");
    expect(r.calls).toBe(1);
  });
  it("a one-block 'too big' gets the single-block second look; a new-block 'too big' stays a proposal", async () => {
    const s = scripted([{ ...base, verdict: "reject", category: "too_big", scope: "medium" }, { ...base, scope: "medium" }]);
    const r = await judgeWithSecondLooks(cfg, input("split this into two halves with a countdown"), { backendAvailable: false, judgeFn: s.fn });
    expect(r.verdict.verdict).toBe("approve");
    expect(r.secondLooks).toEqual(["one-block too_big"]);
    expect(s.addenda[1]).toMatch(/ONE existing block \(clock\)/);
    const s2 = scripted([{ ...base, verdict: "reject", category: "too_big", scope: "large" }]);
    const r2 = await judgeWithSecondLooks(cfg, input("build a chess game", { path: "src/rooms/main/blocks/", line: 0, blockId: "__new__" }), { backendAvailable: false, judgeFn: s2.fn });
    expect(r2.verdict.category).toBe("too_big");
    expect(r2.calls).toBe(1);
  });
  it("re-plans a backend-flagged approve on the kit store when room functions aren't available, and keeps the backend plan when they are", async () => {
    const s = scripted([{ ...base, touches_backend: true }, { ...base, touches_backend: false }]);
    const r = await judgeWithSecondLooks(cfg, input("a collaborative art block anyone can add to"), { backendAvailable: false, judgeFn: s.fn });
    expect(r.verdict.touches_backend).toBe(false);
    expect(r.secondLooks).toEqual(["kit-store re-plan"]);
    expect(s.addenda[1]).toMatch(/room functions are NOT available/);
    const s2 = scripted([{ ...base, touches_backend: true }]);
    const r2 = await judgeWithSecondLooks(cfg, input("a poll with one vote per person"), { backendAvailable: true, judgeFn: s2.fn });
    expect(r2.verdict.touches_backend).toBe(true);
    expect(r2.calls).toBe(1);
  });
  it("keeps the first verdict when a second look fails or still hedges", async () => {
    const s = scripted([{ ...base, verdict: "reject", category: "unclear", plan: [] }, new Error("timeout")]);
    const r = await judgeWithSecondLooks(cfg, input("make this thing a little better please"), { backendAvailable: false, judgeFn: s.fn });
    expect(r.verdict.category).toBe("unclear");
    const s2 = scripted([{ ...base, verdict: "reject", category: "unclear", plan: [] }, { ...base, verdict: "reject", category: "too_big" }]);
    const r2 = await judgeWithSecondLooks(cfg, input("make this thing a little better please"), { backendAvailable: false, judgeFn: s2.fn });
    expect(r2.verdict.category).toBe("unclear");
  });
});
