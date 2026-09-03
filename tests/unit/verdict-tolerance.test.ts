import { describe, expect, it } from "vitest";
import { JudgeVerdict, RedTeamVerdict, DiffReview, SecurityReview } from "../../packages/gatekeeper/src/schemas";
import { normalizeJudge, NoteTriage } from "../../packages/gatekeeper/src/models";

// Production regression: a 201-char plan step made schema validation throw and a perfectly good
// "approve" was discarded as "couldn't read that". Model output must PARSE leniently and be
// CLAMPED, never rejected for length or an echoed field.

const long = (n: number) => "x".repeat(n);
const input = { prompt: "p", target: { path: "src/rooms/main/blocks/a.tsx", line: 1 }, snippet: "", manifest: [], recentChanges: [], requester: { handle: "u", trust: 3 } } as never;

describe("model-output schemas are lenient shapes", () => {
  it("JudgeVerdict parses over-long and over-count fields and a required touches_backend", () => {
    const raw = {
      verdict: "approve", category: "large", public_hint: long(400), scope: "tiny", confidence: 7,
      plan: [long(250), long(250), "c", "d", "e", "f", "g"], touches_other_blocks: false, touches_backend: false, rationale: long(2000),
    };
    const parsed = JudgeVerdict.safeParse(raw);
    expect(parsed.success).toBe(true);
  });
  it("normalizeJudge clamps everything to display limits and fixes the echoed category", () => {
    const v = JudgeVerdict.parse({
      verdict: "approve", category: "large", public_hint: long(400), scope: "tiny", confidence: 7,
      plan: [long(250), long(250), "c", "d", "e", "f", "g"], touches_other_blocks: false, touches_backend: false, rationale: long(2000),
    });
    const n = normalizeJudge(v, input);
    expect(n.verdict).toBe("approve");
    expect(n.category).toBeNull();
    expect(n.public_hint.length).toBeLessThanOrEqual(160);
    expect(n.plan.length).toBeLessThanOrEqual(5);
    expect(n.plan.every((p) => p.length <= 200)).toBe(true);
    expect(n.rationale.length).toBeLessThanOrEqual(600);
    expect(n.confidence).toBeLessThanOrEqual(1);
    expect(n.confidence).toBeGreaterThanOrEqual(0);
  });
  it("the other model schemas parse over-long content too", () => {
    expect(RedTeamVerdict.safeParse({ harms: Array(10).fill(long(300)), most_likely_intent: long(300), block: false, category: null, public_hint: long(300), confidence: 2 }).success).toBe(true);
    expect(DiffReview.safeParse({ matches_request: true, hidden_behavior: Array(9).fill(long(300)), safety_concerns: [], quality_ok: true, approve: true, summary: long(300) }).success).toBe(true);
    expect(SecurityReview.safeParse({ risk: "none", findings: Array(9).fill(long(300)), block: false, summary: long(300) }).success).toBe(true);
    expect(NoteTriage.safeParse({ kind: "bug", summary: long(300) }).success).toBe(true);
  });
  it("no model schema carries a constraint that strict providers reject", () => {
    // If someone re-adds .max()/.default()/.optional() to a model schema, this JSON-schema shape check trips.
    for (const S of [JudgeVerdict, RedTeamVerdict, DiffReview, SecurityReview, NoteTriage]) {
      const shape = (S as unknown as { shape: Record<string, { _def?: { checks?: unknown[]; defaultValue?: unknown; typeName?: string } }> }).shape;
      for (const [k, f] of Object.entries(shape)) {
        const def = (f as { _def?: { checks?: unknown[]; defaultValue?: unknown; typeName?: string; innerType?: unknown } })._def ?? {};
        expect(def.defaultValue, `${k} has a default`).toBeUndefined();
        expect(def.typeName, `${k} is optional`).not.toBe("ZodOptional");
      }
    }
  });
});
