# anyone.build roadmap

_Living document. The autonomous loop updates this every tick: check things off, add what's new, keep the ordering honest. "Now" is what the next tick should pick up. Last updated 2026-09-03._

## Where we are

The wall is live in production (anyone-build.vercel.app, Convex `hushed-ladybug-141`) and the full loop runs with no human in it: point → judge → sandbox agent → validator → diff review → security pass → PR → CI → auto-merge → deploy → live. Guests can change it without an account. The "for your site" product (widget + inbox + four-plan page) is live. Three adversarial security reviews have run; the confirmed holes are fixed.

**Shipped:** guest identity + claim, Eastern Time days, the patron auction (holds, only the winner charged), the leaderboard, the fast/cheap model choices, pages (`/r/<room>/<slug>`), the room-function backend tier (off until Convex deploys on merge), the embedded security review, the `ask.js` widget + `/sites` dashboard, the four-plan offering page, punctuation targeting, and the realm-escape / store / triage security fixes.

## Now (next tick picks the top unchecked item)

- [ ] **Fast path for tiny changes.** Route tiny scope through an in-Convex coder on a cheaper/faster model instead of the sandbox; keep the validator + diff review + security pass; let CI be the typecheck. ~1¢ and <60s vs ~4-6¢ and ~2min; removes the 8-sandbox ceiling for the common case. Medium/large keep the sandbox.
- [ ] **Games buildable.** Add `useTick(cb, {fps})` to the kit — a bounded game loop the kit owns (fps cap, cleanup on unmount, pause when hidden) so blocks never touch requestAnimationFrame (canvas already allowed; input via React props). Raise the judge output-token cap (1500 truncates big asks → the "couldn't read that" reject). Teach the coder about useTick + canvas; teach the judge to route "a game/app" to a page. Prove it by shipping a dino game on prod.
- [ ] **Proposals board.** Unsure-or-too-big asks become `proposed` instead of rejected; signed-in users upvote (new `proposalVotes` table keyed to requestId, mirroring `votes`, no guests); a daily cron promotes the top proposal into the normal pipeline (validator + diff review + security pass still gate it). Big builds are rationed by votes → cost stays flat. Lives as a section ON the leaderboard page, in the change-ledger style, no new nav. Encodes `docs/WHAT-SHIPS.md`.
- [ ] **Encode `docs/WHAT-SHIPS.md` in the judge + an eval set.** The five gates, the reinterpretation move (dreams scoped down + capped, e.g. "GTA 6" → a tiny driving game), and the edge-case table become the judge prompt and `packages/gatekeeper/evals` cases.

## Security hardening (durable fixes beyond the source-level patches already shipped)

- [ ] **Render blocks in a sandboxed iframe** with a strict CSP (`connect-src 'none'`, tight `img-src`), a separate origin from the app. This is the durable fix for the realm-escape class: a denylist can't enumerate every escape, but a cross-origin sandbox with no network can't exfiltrate or read the app's cookies/localStorage regardless. The source-level bans + the existing app CSP are the interim floor.
- [ ] **Make Convex's deterministic re-check run the same AST rules as ESLint** (bundle the room rules or a Babel check), so the "floor" is identical on every side of the wall, not text-only in Convex.
- [ ] **Turnstile before launch.** The guest rate limit keys on a client-minted id, so the real backstops are the global hourly cap and Turnstile. Wire the Turnstile site key and require a valid ticket for guest submits.
- [ ] **Instant hold release on outbid (optional).** Today an outbid patron's Stripe hold is released at midnight close, not the instant they're outbid (legally fine — a hold is never a charge, and only the winner is captured). If we want money freed sooner, release the previous leader's hold in `markHeld` when outbid. Decide with Gavin.
- [ ] Periodic re-review: re-run the three adversarial passes on every gatekeeper/kit/validator change and on every Convex upgrade (the banned list is only as current as the last review).

## Stability & scale (the "don't crash out with 100+ people" problem)

- [ ] **Load-test the wall** at 100 / 1,000 concurrent viewers making changes. Verify the bucketed presence counters, the approved-only feed, the per-block build locks, the daily budget, and the 8-build concurrency hold up. Find the first thing that falls over.
- [ ] **Live cursors / presence** (Gavin's ask, for community feel). Show where other people are pointing in real time. Must be built for scale: sample and throttle cursor updates, cap the number of cursors rendered, and never fan out every mouse-move to every viewer — aggregate through the existing bucketed presence, not a per-move broadcast. Prototype at 10, prove at 100.
- [ ] **Backpressure and graceful degradation:** when the build queue or budget is saturated, the wall says "busy, try soon" instead of queuing for 30 minutes; the fast path (above) is the main relief valve.
- [ ] **Cost dashboard:** show per-change cost on the feed card and ledger row (data already on each request), and a daily spend view on `/admin`.

## Product: the SaaS offering (standing focus — see [[feedback-saas-offering]])

In order:

- [ ] **Billing.** Stripe Checkout subscription mode for Drafts and Ships, customer portal, metered PR overage; a `plans` table keyed by workspace; entitlement checks in `sites.*` and the pipeline.
- [ ] **Tenancy.** `workspaces` (owner, members, plan); sites under workspaces; per-site GitHub App installation id, judge addendum, models, and budget; the pipeline takes a site instead of the env repo.
- [ ] **Onboarding.** Add site → paste tag → first note in a minute, with a dashboard confirmation; "connect a repo" as the upgrade moment.
- [ ] **Retention.** Daily digest email of open notes and shipped PRs (Resend is wired); weekly "what shipped, what it cost"; Slack digest on Ships.
- [ ] **Trust.** Public pipeline status page; per-PR cost and risk shown to customers; a written data policy; the SOC 2 path for Enterprise.
- [ ] **Distribution.** The wall as the demo; "Built with anyone.build" (opt-out on paid plans); a gallery of shipped changes; a template repo for the internal-tools use case; the Enterprise "talk to us" needs a real inbox (hello@anyone.build) once the domain is bought.
- [ ] **Pricing experiments.** Per-PR vs. seats vs. sites; measure Notes→Drafts conversion and PR volume per site before locking pricing.

## Polish & smaller things

- [ ] Header live counters — done this tick (number-forward). Watch for more "feels weak" spots (the patron slot pill next).
- [ ] Code review on the branch before merges once Gavin stops wanting direct session pushes; add branch rulesets + required checks on the repo.
- [ ] Vercel: turn off Deployment Protection on previews so the smoke workflow can reach them.
- [ ] Buy the domain; point the A record at 76.76.21.21.
- [ ] Resend domain verification (emails silently skip until then).
- [ ] GitHub org transfer; move multi-tenant orchestration to a private service when there's revenue (keep the wall + gatekeeper open).

## Owned by Gavin (I can't do these)

Free disk space · turn off Vercel preview auth · sign in on prod once + a Stripe test bid · create the Convex production deploy key and add `CONVEX_DEPLOY_KEY` to Vercel, then flip `backendEnabled` on `/admin` · buy the domain.

## How the loop uses this

Each tick: (1) if a "Now" item is unchecked, do the top one; (2) else pick from Security hardening, then Stability, then the SaaS offering; (3) if everything concrete is blocked, stress-test what exists and log what broke as a new item; (4) always leave this file with an honest "Now" and check off what shipped. Never end a tick without updating this file and the plan's Morning section.
