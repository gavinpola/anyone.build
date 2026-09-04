import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();
// Convex schedules in UTC only; the site's day is Eastern Time. An hourly tick notices when the
// ET date has rolled over (04:01 or 05:01 UTC depending on DST) and closes the auction then.
crons.hourly("auction tick (ET midnight)", { minuteUTC: 1 }, internal.payments.tickAuction, {});
crons.hourly("sweep turnstile tickets", { minuteUTC: 17 }, internal.turnstile.sweep, {});
crons.hourly("expire stale needs_human", { minuteUTC: 23 }, internal.maintenance.expireNeedsHuman, {});
// Proposal rounds: every three hours (UTC hours divisible by 3, at :37, the same boundaries as
// convex/lib/rounds.ts) the most-wanted proposal is built through the full safety pipeline and every
// other proposal expires, so the board starts over. One build per round keeps big builds affordable.
crons.cron("proposal round: build the top one, the rest start over", "37 */3 * * *", internal.proposals.promoteTop, {});
// Keep the presence tables tiny.
crons.interval("sweep presence", { minutes: 10 }, internal.presence.sweep, {});
// Nothing stays stuck: re-try merges that missed a webhook, settle deploys that never reported, fail dead builds.
crons.interval("reconcile stuck requests", { minutes: 10 }, internal.maintenance.reconcile, {});
crons.daily("prune timelapse frames older than 30 days", { hourUTC: 5, minuteUTC: 20 }, internal.timelapse.prune, {});
// GitHub drops scheduled runs on quiet repos: once an hour, if the latest frame is stale, ask it to run
// the timelapse workflow (works once the GitHub App has the Actions permission; harmless until then).
crons.hourly("kick the timelapse", { minuteUTC: 3 }, internal.timelapseKick.kick, {});

crons.daily("decay: fade what ran out", { hourUTC: 5, minuteUTC: 33 }, internal.life.sweep, {});

export default crons;
