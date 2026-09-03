import { RateLimiter, MINUTE, HOUR } from "@convex-dev/rate-limiter";
import { components } from "./_generated/api";

const DAY = 24 * HOUR;

export const rateLimiter = new RateLimiter(components.rateLimiter, {
  // requests per user per day, by trust level
  submitTrust0: { kind: "fixed window", rate: 2, period: DAY },
  submitTrust1: { kind: "fixed window", rate: 10, period: DAY },
  submitTrust2: { kind: "fixed window", rate: 25, period: DAY },
  submitTrust3: { kind: "fixed window", rate: 1000, period: DAY },
  // guests (no account): one a day per browser, plus a global cap (Convex mutations can't see IPs)
  submitGuest: { kind: "fixed window", rate: 1, period: DAY },
  guestPlusOne: { kind: "token bucket", rate: 5, period: MINUTE, capacity: 5 },
  claim: { kind: "fixed window", rate: 20, period: DAY },
  // burst protection
  submitBurst: { kind: "token bucket", rate: 3, period: MINUTE, capacity: 3 },
  // global approvals per hour (cost control)
  approvalsGlobal: { kind: "fixed window", rate: 240, period: HOUR },
  // kit store writes
  storeWrite: { kind: "token bucket", rate: 30, period: MINUTE, capacity: 30 },
  storeWriteAnon: { kind: "token bucket", rate: 5, period: MINUTE, capacity: 5 },
  // flags
  flag: { kind: "fixed window", rate: 20, period: DAY },
});

export function submitLimitFor(trust: number) {
  return (["submitTrust0", "submitTrust1", "submitTrust2", "submitTrust3"] as const)[Math.min(3, Math.max(0, trust))]!;
}
