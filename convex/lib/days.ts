/**
 * The site's day is Eastern Time (America/New_York). Implemented without Intl so it behaves the
 * same in the Convex runtime, Node, and the browser. US DST: second Sunday of March 02:00 EST →
 * first Sunday of November 02:00 EDT.
 */
const H = 3600_000;
const pad = (n: number) => String(n).padStart(2, "0");

function nthSundayUtcDate(year: number, month0: number, n: number): number {
  const firstDow = new Date(Date.UTC(year, month0, 1)).getUTCDay();
  return 1 + ((7 - firstDow) % 7) + (n - 1) * 7;
}

/** UTC offset of Eastern Time at instant `ts`, in ms (−5h EST, −4h EDT). */
export function etOffsetMs(ts: number): number {
  const y = new Date(ts).getUTCFullYear();
  const dstStart = Date.UTC(y, 2, nthSundayUtcDate(y, 2, 2), 7); // 02:00 EST
  const dstEnd = Date.UTC(y, 10, nthSundayUtcDate(y, 10, 1), 6); // 02:00 EDT
  return ts >= dstStart && ts < dstEnd ? -4 * H : -5 * H;
}

function dayOf(utcLike: number): string {
  const d = new Date(utcLike);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

/** YYYY-MM-DD in Eastern Time. */
export function siteDay(ts = Date.now()): string {
  return dayOf(ts + etOffsetMs(ts));
}

/** The instant (UTC ms) when `day` begins in Eastern Time. */
export function siteDayStart(day: string): number {
  const [y, m, d] = day.split("-").map(Number) as [number, number, number];
  const wall = Date.UTC(y, m - 1, d); // the wall-clock midnight, expressed as if UTC
  const est = wall + 5 * H;
  if (est + etOffsetMs(est) === wall) return est;
  return wall + 4 * H;
}

/** Next Eastern-Time midnight after `ts`. */
export function nextSiteMidnight(ts = Date.now()): number {
  const [y, m, d] = siteDay(ts).split("-").map(Number) as [number, number, number];
  return siteDayStart(dayOf(Date.UTC(y, m - 1, d + 1)));
}

/** The slot currently up for auction: tomorrow, Eastern Time. */
export function auctionSlotDay(ts = Date.now()): string {
  return siteDay(nextSiteMidnight(ts));
}

