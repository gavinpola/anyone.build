# anyone.build roadmap

_Living document. The autonomous loop updates this every tick: check things off, add what's new, keep the ordering honest. "Now" is what the next tick should pick up. Last updated 2026-09-03._

## Where we are

The wall is live in production (anyone-build.vercel.app, Convex `hushed-ladybug-141`) and the full loop runs with no human in it: point → judge → sandbox agent → validator → diff review → security pass → PR → CI → auto-merge → deploy → live. Guests can change it without an account. The "for your site" product (widget + inbox + four-plan page) is live. Three adversarial security reviews have run; the confirmed holes are fixed.

**Shipped:** guest identity + claim, Eastern Time days, the patron auction (holds, only the winner charged), the leaderboard, the fast/cheap model choices, pages (`/r/<room>/<slug>`), the room-function backend tier (off until Convex deploys on merge), the embedded security review, the `ask.js` widget + `/sites` dashboard, the four-plan offering page, punctuation targeting, and the realm-escape / store / triage security fixes.

## Now (next tick picks the top unchecked item)

- [x] **Fast path for tiny changes.** Shipped: `convex/pipeline/fast.ts`. Tiny scope on one existing block/page file → one model call rewrites the file (coder model by default; `fastModel` on /admin), a unified diff is generated in Convex (`packages/gatekeeper/src/patch.ts`), then the SAME validator + diff review + security pass + PR; CI is the typecheck. Any unusable reply (no file, no change, validator, reviewer says it didn't match, any error) requeues the request and the sandbox takes over, so success rate can't regress. `fastPathEnabled` toggle on /admin. 8 unit tests (diff round-trip through the real parser/validator, reply parsing, eligibility). NEXT: measure on prod (cost/time per tiny ask, fallback rate) and widen to small single-file restyles once the fallback rate is low; a syntax pre-check in Convex (a light TS parser) would catch the one class CI now catches late.
- [x] **Games buildable.** `useTick(cb,{fps})` shipped (bounded loop the kit owns). Judge token cap raised 1500→4000; category schema loosened + coerced (a stray "large" no longer throws); concrete in-scope hedges promoted to approve. Judge verified against the real model: "build a dino game" and "make GTA 6" approve at trust 3 as a large page. Example dino runner + e2e prove the primitive. NEXT: watch a real coder build a game end-to-end on prod (a signed-in trust-3 ask), and add a couple more kit primitives if the coder needs them (useKeys, a sprite helper).
- [x] **Proposals board.** Shipped: safe-but-big asks from signed-in people become `proposed` (a hedge-with-plan routes here too, not a dead reject); an "Up for a vote" section on the leaderboard; one upvote per signed-in person (proposalVotes table, guests can't); a daily cron (`proposals.promoteTop`, 05:07 UTC) builds the single top-voted proposal through the full safety pipeline. e2e covers propose → appear → vote. NEXT: watch a promotion build end-to-end on prod; consider a "you proposed this, it won" email (Resend); show the winner in the feed.
- [ ] **Encode `docs/WHAT-SHIPS.md` in the judge + an eval set.** The five gates, the reinterpretation move (dreams scoped down + capped, e.g. "GTA 6" → a tiny driving game), and the edge-case table become the judge prompt and `packages/gatekeeper/evals` cases.

## Reliability (learned the hard way)

- **Every gate must fail with a recorded reason and only on a concrete finding.** Learned three times on 2026-09-03: security review (resource-only), diff review (taste), size backstop (a clarity phrase). Judge/reviewer prompts state what the platform guarantees; deterministic backstops (`resourceOnly`, `reviewBlocks`, single-block floor) keep a model's mood from killing a build. When a new gate is added, add its regression test with the exact production text.

- [x] **Model-output schemas are lenient shapes; clamp, never throw.** Every "couldn't read that" in production traced to a schema constraint (a 201-char plan step hit `.max(200)`) or a strict provider (Azure rejected an optional field + maxLength). All `min/max/default/optional` are gone from model schemas; normalize steps clamp. `verdict-tolerance.test.ts` trips if one is re-added. Retry chain logs each attempt.
- [x] **No per-person daily caps.** Gavin hit "one ask a day as a guest." Removed: per-person daily limits are now effectively unlimited (500–5000/day), burst is 8/min (a fast human, not a script), in-flight builds per person 2/3/5, global guest cap 300/hr. Money is protected by the daily budget, per-request cost caps, and the global hourly caps — never by counting a person's asks. `limits.spec.ts` proves a guest can ask twice.
- [x] **Composer stale-panel race.** Reopening the composer on the same spot while the previous panel was still animating out reused the instance and showed the OLD request (no textbox). Fixed with React's render-time "adjust state when a prop changes" pattern; a fresh target always means a fresh box.
- [x] **Anyone can propose; size is never a rejection.** A guest's "build me a dino game" was a dead reject ("a big project; ask smaller"). Now: (1) any actor's too_big routes to the vote board (guests included — a proposal is just a row; voting needs an account; nothing builds without votes; unvoted proposals expire after 7 days); (2) the judge prompt says size is scope, never a verdict; (3) a deterministic backstop in normalizeJudge converts a size-flavored reject/hedge into a large proposal. Proven on the real judge (guest → too_big/proposal; maintainer → approve). e2e: guest-proposal.spec.ts.
- [x] **Red team was silently broken for medium asks.** gpt-5-nano returned empty responses at a 1200-token cap (reasoning spent the budget), so every medium ask hit "couldn't get a second opinion" once the ceiling let mediums through. Now: red team is `google/gemini-3.1-flash-lite` (always answers, <2s), cap 2500, prompt is harm-only (never "unclear"/"too_big"), and judge.ts only honors a block with a harm category. Trade-off: judge + red team are now both Google; the Qwen reviewer, security pass, and deterministic validator stay the independent floor.
- [ ] Re-evaluate a non-Google red team (deepseek at the 2500 cap, or another vendor) once one is reliable under 3s, to restore the three-vendor principle.
- [ ] Watch prod logs for `judge attempt failed` for a week; if any provider still rejects a schema, add it to the tolerance test.

## Security hardening (durable fixes beyond the source-level patches already shipped)

- [ ] **Render blocks in a sandboxed iframe** with a strict CSP (`connect-src 'none'`, tight `img-src`), a separate origin from the app. This is the durable fix for the realm-escape class: a denylist can't enumerate every escape, but a cross-origin sandbox with no network can't exfiltrate or read the app's cookies/localStorage regardless. The source-level bans + the existing app CSP are the interim floor.
- [ ] **Make Convex's deterministic re-check run the same AST rules as ESLint** (bundle the room rules or a Babel check), so the "floor" is identical on every side of the wall, not text-only in Convex.
- [ ] **Turnstile before launch.** The guest rate limit keys on a client-minted id, so the real backstops are the global hourly cap and Turnstile. Wire the Turnstile site key and require a valid ticket for guest submits.
- [ ] **Instant hold release on outbid (optional).** Today an outbid patron's Stripe hold is released at midnight close, not the instant they're outbid (legally fine — a hold is never a charge, and only the winner is captured). If we want money freed sooner, release the previous leader's hold in `markHeld` when outbid. Decide with Gavin.
- [ ] Periodic re-review: re-run the three adversarial passes on every gatekeeper/kit/validator change and on every Convex upgrade (the banned list is only as current as the last review).

## Stability & scale (the "don't crash out with 100+ people" problem)

- [ ] **Load-test the wall** at 100 / 1,000 concurrent viewers making changes. Verify the bucketed presence counters, the approved-only feed, the per-block build locks, the daily budget, and the 8-build concurrency hold up. Find the first thing that falls over.
- [x] **Live cursors** — shipped. Other people's pointers show on the wall at 2+ present, off above 30, throttled to ~120ms, positions normalized to the wall, swept with presence. e2e covers it. NEXT: true scale (100-1000) needs a dedicated realtime transport, not Convex writes — that's the open item; also a name/tag on hover and a taste pass on the arrow.
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

## Self-hosting models (Gavin asked)

Gavin's machine: Apple M4, 16 GB, Ollama installed but no models pulled. The pipeline already reads `MODEL_BASE_URL`, so pointing judge/coder at Ollama's OpenAI-compatible endpoint (`http://localhost:11434/v1`) works. No GPU purchase needed — Apple Silicon runs models on the built-in GPU via Metal; a 7B model is comfortable at 16 GB, a 14B is tight. The catch: production Convex and the Vercel sandbox run in the cloud and can't reach localhost, so self-hosting is for the LOCAL dev stack (free, great for stress-testing) or prod via a tunnel + always-on machine (unreliable on a laptop). At ~2-3¢/change on cloud the savings are small, so: use local models for dev, keep cloud for prod.

- [ ] Wire a dev profile: `MODEL_BASE_URL=http://localhost:11434/v1` + local model names so `pnpm dev` uses Ollama when it's running, falling back to cloud otherwise. Pull `qwen2.5-coder:7b` (coder) and `qwen2.5:3b` (judge/triage).

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
