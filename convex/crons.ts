import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();
// Convex schedules in UTC only; the site's day is Eastern Time. An hourly tick notices when the
// ET date has rolled over (04:01 or 05:01 UTC depending on DST) and closes the auction then.
crons.hourly("auction tick (ET midnight)", { minuteUTC: 1 }, internal.payments.tickAuction, {});
crons.hourly("sweep turnstile tickets", { minuteUTC: 17 }, internal.turnstile.sweep, {});
crons.hourly("expire stale needs_human", { minuteUTC: 23 }, internal.maintenance.expireNeedsHuman, {});
// The top-voted proposal gets built once a day, just after the ET midnight roll-over. One per day
// keeps big community builds affordable; the winner still passes the full safety pipeline. 05:07 UTC
// is ~1am ET (DST) / midnight ET (standard) — right after the auction close.
crons.daily("promote top proposal", { hourUTC: 5, minuteUTC: 7 }, internal.proposals.promoteTop, {});
crons.daily("expire unvoted proposals", { hourUTC: 5, minuteUTC: 12 }, internal.maintenance.expireStaleProposals, {});
// Keep the presence tables tiny.
crons.interval("sweep presence", { minutes: 10 }, internal.presence.sweep, {});
export default crons;
