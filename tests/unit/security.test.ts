import { describe, expect, it } from "vitest";
import { SecurityReview } from "../../packages/gatekeeper/src/schemas";
import { securityBlocks, resourceOnly } from "../../packages/gatekeeper/src/models";

const base = { findings: [], block: false, summary: "Static text with kit components." };

describe("security review decision", () => {
  it("ships when the model sees no or low risk and doesn't block", () => {
    expect(securityBlocks(SecurityReview.parse({ ...base, risk: "none" }))).toBe(false);
    expect(securityBlocks(SecurityReview.parse({ ...base, risk: "low", findings: ["Uses useCounter for a public tally."] }))).toBe(false);
  });
  it("blocks on medium or high risk regardless of the model's block flag", () => {
    expect(securityBlocks(SecurityReview.parse({ ...base, risk: "medium" }))).toBe(true);
    expect(securityBlocks(SecurityReview.parse({ ...base, risk: "high" }))).toBe(true);
  });
  it("blocks when the model says block, even at low risk", () => {
    expect(securityBlocks(SecurityReview.parse({ ...base, risk: "low", block: true }))).toBe(true);
  });
  it("resource-only findings never block: the kit caps storage (production regression, the collaborative art block)", () => {
    const findings = [
      "src/rooms/main/blocks/collaborative-art.tsx: The implementation allows unbounded growth of the collection by every visitor, as it lacks logic to prune or limit the number of stored strokes.",
      "src/rooms/main/blocks/collaborative-art.tsx: The use of `useStore` to save every user-generated stroke as a new document without access controls or rate limiting allows for potential data flooding of the room's storage.",
    ];
    expect(resourceOnly(findings)).toBe(true);
    expect(securityBlocks(SecurityReview.parse({ ...base, risk: "medium", findings }))).toBe(false);
    expect(securityBlocks(SecurityReview.parse({ ...base, risk: "high", block: true, findings }))).toBe(false);
  });
  it("a harm finding blocks even when phrased with resource words; no findings at medium still blocks", () => {
    const f = ["Stores every keystroke the visitor types into a shared collection that grows without bound."];
    expect(resourceOnly(f)).toBe(false);
    expect(securityBlocks(SecurityReview.parse({ ...base, risk: "medium", findings: f }))).toBe(true);
    const mixed = ["The collection grows without bound.", "Encodes the viewer's handle into class names."];
    expect(securityBlocks(SecurityReview.parse({ ...base, risk: "medium", findings: mixed }))).toBe(true);
    expect(securityBlocks(SecurityReview.parse({ ...base, risk: "medium", findings: [] }))).toBe(true);
  });
  it("rejects malformed reviews", () => {
    expect(SecurityReview.safeParse({ ...base, risk: "critical" }).success).toBe(false);
    // Over-count findings now PARSE (lenient shape) and are clamped to 6 in securityReview(); length is never a reason to throw away a review.
    expect(SecurityReview.safeParse({ ...base, risk: "none", findings: new Array(9).fill("x") }).success).toBe(true);
  });
});
