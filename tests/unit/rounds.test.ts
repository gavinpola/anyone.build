import { describe, expect, it } from "vitest";
import { roundEndsAt, roundStartedAt, untilRoundEnd, ROUND_HOURS } from "../../convex/lib/rounds";

/** Rounds end at UTC 00:37, 03:37, … 21:37, the same boundaries the round cron fires on (minute 37 of every third hour). */
describe("proposal rounds", () => {
  const T = (s: string) => Date.parse(s);
  it("ends at the next three-hour boundary at :37", () => {
    expect(roundEndsAt(T("2026-09-04T10:00:00Z"))).toBe(T("2026-09-04T12:37:00Z"));
    expect(roundEndsAt(T("2026-09-04T12:37:00.001Z"))).toBe(T("2026-09-04T15:37:00Z"));
    expect(roundEndsAt(T("2026-09-04T12:37:00Z"))).toBe(T("2026-09-04T15:37:00Z"));
    expect(roundEndsAt(T("2026-09-04T00:10:00Z"))).toBe(T("2026-09-04T00:37:00Z"));
    expect(roundEndsAt(T("2026-09-04T23:50:00Z"))).toBe(T("2026-09-05T00:37:00Z"));
  });
  it("a round is three hours long", () => {
    const now = T("2026-09-04T10:00:00Z");
    expect(roundEndsAt(now) - roundStartedAt(now)).toBe(ROUND_HOURS * 3600_000);
  });
  it("says how long is left", () => {
    expect(untilRoundEnd(T("2026-09-04T11:25:00Z"))).toBe("1h 12m");
    expect(untilRoundEnd(T("2026-09-04T12:29:00Z"))).toBe("8m");
    expect(untilRoundEnd(T("2026-09-04T12:36:30Z"))).toBe("under a minute");
  });
});
