import { describe, expect, it } from "vitest";
import { siteDay, siteDayStart, nextSiteMidnight, auctionSlotDay, etOffsetMs } from "../../convex/lib/days";

const utc = (s: string) => Date.parse(s);

describe("Eastern Time days", () => {
  it("offsets: EST in winter, EDT in summer", () => {
    expect(etOffsetMs(utc("2026-01-15T12:00:00Z"))).toBe(-5 * 3600_000);
    expect(etOffsetMs(utc("2026-07-15T12:00:00Z"))).toBe(-4 * 3600_000);
  });
  it("siteDay rolls at ET midnight, not UTC midnight", () => {
    expect(siteDay(utc("2026-09-03T03:59:00Z"))).toBe("2026-09-02"); // 23:59 EDT
    expect(siteDay(utc("2026-09-03T04:00:00Z"))).toBe("2026-09-03"); // 00:00 EDT
    expect(siteDay(utc("2026-01-10T04:59:00Z"))).toBe("2026-01-09"); // 23:59 EST
    expect(siteDay(utc("2026-01-10T05:00:00Z"))).toBe("2026-01-10");
  });
  it("siteDayStart and nextSiteMidnight around the 2026 DST transitions", () => {
    // Spring forward: 2026-03-08 02:00 EST → 03:00 EDT
    expect(siteDayStart("2026-03-08")).toBe(utc("2026-03-08T05:00:00Z"));
    expect(siteDayStart("2026-03-09")).toBe(utc("2026-03-09T04:00:00Z"));
    expect(nextSiteMidnight(utc("2026-03-08T12:00:00Z"))).toBe(utc("2026-03-09T04:00:00Z"));
    // Fall back: 2026-11-01 02:00 EDT → 01:00 EST
    expect(siteDayStart("2026-11-01")).toBe(utc("2026-11-01T04:00:00Z"));
    expect(siteDayStart("2026-11-02")).toBe(utc("2026-11-02T05:00:00Z"));
    expect(nextSiteMidnight(utc("2026-11-01T12:00:00Z"))).toBe(utc("2026-11-02T05:00:00Z"));
  });
  it("the slot up for auction is tomorrow in ET", () => {
    expect(auctionSlotDay(utc("2026-09-03T03:00:00Z"))).toBe("2026-09-03"); // still Sep 2 in ET
    expect(auctionSlotDay(utc("2026-09-03T05:00:00Z"))).toBe("2026-09-04");
  });
});
