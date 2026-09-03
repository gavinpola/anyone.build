import { RateLimiter, MINUTE, HOUR } from "@convex-dev/rate-limiter";
import { components } from "./_generated/api";

const DAY = 24 * HOUR;

export const rateLimiter = new RateLimiter(components.rateLimiter, {
  // No per-person daily cap (Gavin: "no limit"). Money is protected by the daily budget, per-request
  // cost caps, and the global hourly caps — not by counting a person's asks. These stay generous so
  // a human can't hit them; the burst bucket below is the only per-person brake (anti-script).
  submitTrust0: { kind: "fixed window", rate: 500, period: DAY },
  submitTrust1: { kind: "fixed window", rate: 1000, period: DAY },
  submitTrust2: { kind: "fixed window", rate: 2000, period: DAY },
  submitTrust3: { kind: "fixed window", rate: 5000, period: DAY },
  // guests (no account): the browser-minted id is not an abuse boundary anyway; the real guest
  // brakes are the burst bucket, the global hourly guest cap, and the daily budget.
  submitGuest: { kind: "fixed window", rate: 500, period: DAY },
  guestPlusOne: { kind: "token bucket", rate: 5, period: MINUTE, capacity: 5 },
  claim: { kind: "fixed window", rate: 20, period: DAY },
  // burst protection
  submitBurst: { kind: "token bucket", rate: 8, period: MINUTE, capacity: 8 }, // a human iterating fast, not a script
  // global approvals per hour (cost control)
  approvalsGlobal: { kind: "fixed window", rate: 240, period: HOUR },
  // kit store writes
  storeWrite: { kind: "token bucket", rate: 30, period: MINUTE, capacity: 30 },
  storeWriteAnon: { kind: "token bucket", rate: 5, period: MINUTE, capacity: 5 },
  // flags
  flag: { kind: "fixed window", rate: 20, period: DAY },
  // "for your site": notes from visitors, per site and overall; sites per owner
  siteNote: { kind: "token bucket", rate: 300, period: DAY, capacity: 60 },
  notesGlobal: { kind: "fixed window", rate: 5000, period: DAY },
  // The triage LLM call is the only paid work in the note path; cap it hard and globally so a note
  // flood (the site key is public and the Origin header is spoofable) can't become a free LLM faucet.
  triageGlobal: { kind: "fixed window", rate: 1000, period: DAY },
  triageSite: { kind: "token bucket", rate: 100, period: DAY, capacity: 30 },
  siteCreate: { kind: "fixed window", rate: 5, period: DAY },
});

export function submitLimitFor(trust: number) {
  return (["submitTrust0", "submitTrust1", "submitTrust2", "submitTrust3"] as const)[Math.min(3, Math.max(0, trust))]!;
}
