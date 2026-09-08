# Launch-day runbook — everyones.lol

Keep `/admin` open in a tab. Check it every hour. Everything below is a lever you already have.

## What to watch

- **`/admin` → How it's going**: asks in the last hour by outcome (live / rejected / failed / proposed). Healthy looks like mostly live and rejected, near-zero failed.
- **`/admin` → Failed builds**: every failure with the runner's last log lines. One-click **Rebuild** re-runs it under the same requester.
- **`/admin` → Spend**: today's budget, spent, reserved. The composer says "budget is spent" on its own when it runs out.
- **Header counters**: `N here` is presence right now; `views` and `changes` are totals.
- `stats:outcomes` from a terminal, if the admin page is slow:
  `curl -s -X POST https://hushed-ladybug-141.convex.cloud/api/query -H 'content-type: application/json' -d '{"path":"stats:outcomes","args":{"days":1},"format":"json"}'`

## The levers (all on `/admin`, no deploy needed)

| Symptom | Lever | What it does |
|---|---|---|
| Junk asks flooding in from signed-out people | **`guestsEnabled` off** | Signed-in only; the composer says so. Turn back on when it calms. |
| Builds failing in a pattern (a model down, a bad prompt) | **`fastPathEnabled` off** | Everything goes through the sandbox agent (slower, iterates). |
| Money going faster than planned | **`dailyBudgetCents`** | Lower it; the composer holds Send and says "budget is spent". Raise it when a patron tops up or you decide to. `0` = polite refusal for everyone. |
| One person abusing the wall | **`admin.banGuest`** (their guest tag from the feed card) | Their asks stop; their strokes on the canvas can be erased by anyone. |
| A change broke a block or offends | **Revert** on the change (leaderboard row or feed card) | One click; the PR is reverted and redeployed. The block's error boundary already keeps a crash from taking the wall down. |
| A block stops working | Nightly sweep opens an issue; **Rebuild** or revert | The sweep runs at 10:17 UTC; run it by hand: `gh workflow run sweep.yml`. |
| The judge is wrong about something | `/admin` → judge model or addendum; `requests.rejudge` | Same-day fix; the eval (`pnpm eval:judge`) is the check before changing the prompt. |

## Numbers already set

- Daily budget: **$20 today** (`dailyBudgetCents` 2000). The plan says $50 for launch day: set it on `/admin` Wednesday morning. Convex prod's OpenRouter key must have credit to match.
- One build per person at a time; sixty asks in line max (the composer says "the wall is full"); 300 guest asks an hour globally; per-block locks (25 min); reconcile cron every 10 min; sandbox 9 min; 8 concurrent sandbox builds (`concurrency` on `/admin`).
- Guests: 30 store writes a minute per tab; erase 30 calls a minute; namespace caps 5,000 docs / 1 MB.

## The one that already happened (2026-09-07 night)

Every build died at **"starting sandbox"**: Vercel answered 402, *Hobby plan usage limit exceeded for Snapshots Storage*. Vercel keeps a ~0.4 GB snapshot per build and forty had piled up. Fixed by deleting them; the build now prunes after itself (keeps the configured snapshot plus the newest three). If it recurs: `node scripts/refresh-snapshot.mjs` prunes too, and **Vercel Pro removes the ceiling** — on Hobby the wall stops building again after about forty more builds.

## If it goes wrong

1. **Everything failing**: look at the newest failure's log lines on `/admin`. A model outage shows as "judge attempt failed" or a coder timeout; the retry chain already falls back across vendors. If it persists, `fastPathEnabled` off, then wait 10 minutes.
2. **Convex sockets / "too many connections"** (thousands of tabs): Convex Pro is the fix; until then the page still loads and asks still work, cursors turn off above 30 present by design.
3. **Vercel sandbox limit reached**: builds queue (the composer says "N in line"); nothing breaks. Vercel Pro raises it.
4. **The wall filled with junk**: revert the offenders (one click each), `guestsEnabled` off for an hour, raise nothing.
5. **Site down**: Vercel keeps the last good deploy; check `vercel ls` and the Convex dashboard. Rollback = redeploy the previous commit from the Vercel dashboard.
6. **Turnstile**: not wired yet (the site key is missing from the secrets file). Until it is, the guest global cap and `banGuest` are the backstops.

## Who does what on the day

- Gavin: posts (X 9 AM ET, HN 10 AM ET), replies for the first hour, watches `/admin`.
- Yash: replies from the second hour, reverts anything ugly, keeps the feedback board moving.
- Claude (this session, on `/loop`): checks prod every tick, fixes what breaks, writes the numbers into the plan file; can post from the logged-in browser on a "go", one post at a time, each confirmed in chat first.
