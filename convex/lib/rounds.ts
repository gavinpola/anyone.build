/**
 * Proposal rounds. Every ROUND_HOURS hours (UTC hours divisible by 3, at :37) the most-wanted
 * proposal is built and every other proposal expires, so the board starts over. Pure, shared by the
 * cron (which fires on the same boundaries) and the leaderboard's countdown.
 */
export const ROUND_HOURS = 3;
export const ROUND_MINUTE = 37;
const STEP = ROUND_HOURS * 60 * 60 * 1000;

/** The end of the round that contains `now`: the next boundary strictly after it. */
export function roundEndsAt(now: number): number {
  const d = new Date(now);
  let t = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, ROUND_MINUTE);
  while (t <= now) t += STEP;
  return t;
}

export function roundStartedAt(now: number): number {
  return roundEndsAt(now) - STEP;
}

/** "1h 12m" / "8m" / "under a minute". */
export function untilRoundEnd(now: number): string {
  const ms = roundEndsAt(now) - now;
  const m = Math.floor(ms / 60000);
  if (m < 1) return "under a minute";
  const h = Math.floor(m / 60);
  return h ? `${h}h ${m % 60}m` : `${m}m`;
}
