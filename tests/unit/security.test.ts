import { describe, expect, it } from "vitest";
import { SecurityReview } from "../../packages/gatekeeper/src/schemas";
import { securityBlocks } from "../../packages/gatekeeper/src/models";

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
  it("rejects malformed reviews", () => {
    expect(SecurityReview.safeParse({ ...base, risk: "critical" }).success).toBe(false);
    expect(SecurityReview.safeParse({ ...base, risk: "none", findings: new Array(9).fill("x") }).success).toBe(false);
  });
});
