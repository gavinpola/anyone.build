# everyones.lol roadmap

_Living document. The autonomous loop updates this every tick: check things off, add what's new, keep the ordering honest. "Now" is what the next tick should pick up. Last updated 2026-09-03._

## Where we are

The wall is live in production (anyone-build.vercel.app, Convex `hushed-ladybug-141`) and the full loop runs with no human in it: point → judge → sandbox agent → validator → diff review → security pass → PR → CI → auto-merge → deploy → live. Guests can change it without an account. The "for your site" product (widget + inbox + four-plan page) is live. Three adversarial security reviews have run; the confirmed holes are fixed.

**Shipped:** guest identity + claim, Eastern Time days, the patron auction (holds, only the winner charged), the leaderboard, the fast/cheap model choices, pages (`/r/<room>/<slug>`), the room-function backend tier (off until Convex deploys on merge), the embedded security review, the `ask.js` widget + `/sites` dashboard, the four-plan offering page, punctuation targeting, and the realm-escape / store / triage security fixes.

## Now (next tick picks the top unchecked item)

- [x] **Fast path for tiny changes.** Shipped: `convex/pipeline/fast.ts`. Tiny scope on one existing block/page file → one model call rewrites the file (coder model by default; `fastModel` on /admin), a unified diff is generated in Convex (`packages/gatekeeper/src/patch.ts`), then the SAME validator + diff review + security pass + PR; CI is the typecheck. Any unusable reply (no file, no change, validator, reviewer says it didn't match, any error) requeues the request and the sandbox takes over, so success rate can't regress. `fastPathEnabled` toggle on /admin. 8 unit tests (diff round-trip through the real parser/validator, reply parsing, eligibility). 2026-09-04: first red on prod (the fast model invented a shape preset); now a red check on a fast-path PR closes it and hands the request to the sandbox once (`run.fastFailed`), so a fast miss is never a dead end, and the fast brief knows the block meta. NEXT: measure on prod (cost/time per tiny ask, fallback + red rate) and widen to small single-file restyles once the rates are low.
- [x] **Games buildable.** `useTick(cb,{fps})` shipped (bounded loop the kit owns). Judge token cap raised 1500→4000; category schema loosened + coerced (a stray "large" no longer throws); concrete in-scope hedges promoted to approve. Judge verified against the real model: "build a dino game" and "make GTA 6" approve at trust 3 as a large page. Example dino runner + e2e prove the primitive. NEXT: watch a real coder build a game end-to-end on prod (a signed-in trust-3 ask), and add a couple more kit primitives if the coder needs them (useKeys, a sprite helper).
- [x] **Proposals board.** Shipped: safe-but-big asks from signed-in people become `proposed` (a hedge-with-plan routes here too, not a dead reject); an "Up for a vote" section on the leaderboard; one upvote per signed-in person (proposalVotes table, guests can't); a daily cron (`proposals.promoteTop`, 05:07 UTC) builds the single top-voted proposal through the full safety pipeline. e2e covers propose → appear → vote. NEXT: watch a promotion build end-to-end on prod; consider a "you proposed this, it won" email (Resend); show the winner in the feed.
- [x] **Encode `docs/WHAT-SHIPS.md` in the judge + an eval set.** Shipped: `pnpm eval:judge` runs 62 cases (the edge table, every production misread, the attack classes) through `judgeWithSecondLooks` (the exact code the pipeline uses) and writes `packages/gatekeeper/evals/last-run.md`; thresholds: attack recall ≥ 95%, benign approval ≥ 85%, big asks never dead-rejected. First green run 2026-09-03. NEXT: run it on every judge-prompt change (a CI job with the key as a secret, gated to prompt-file changes); grow the set from production misreads; a red-team eval (harm-only) and a security-review eval (`security-cases.json`) in the same harness.

## Quality: games and widgets that actually work (Yash, 2026-09-03: "the dino game is completely broken")

- [x] **Playtest gate in CI.** Every block a PR touches is mounted alone at `/lab/<id>`, rendered, pressed (first visible button, a tap, Space/ArrowUp, a drag), checked for crash cards, page errors, and a dead canvas, then screenshots before/after go to a vision model with the block's own description: "does this plausibly work for someone who taps the right thing?" A confident no fails the `playtest` check (required for merge alongside `checks`) and the reasons land as a PR comment. Static blocks skip the vision call (no flakiness, no cost). `pnpm playtest` runs it locally against `vite preview`. Found and fixed: the dino's jump had the wrong sign (compiled fine, never jumped).
- [x] **Model routing by scope.** tiny/small AND medium → deepseek-v4-flash (qwen3-coder-plus was tried for medium on 2026-09-04 and killed 2 of 3 builds: it reads files then dumps the code as 8k tokens of prose instead of calling write_file); large (a proposal that won the daily vote, ≤1/day) → claude-sonnet-5, untested in the loop yet. Per-build caps unchanged; three levers on /admin. A coder must be checked for tool-use through OpenRouter before it's routed to.
- [x] **Spend panel on /admin.** By day (spent / held / cap) and by scope (builds, average cost, live vs failed).
- [ ] NEXT: feed the playtester's reasons back into the coder loop (a second sandbox pass with "the playtester said: …") instead of failing the PR; a nightly playtest sweep of the whole wall so regressions from one block's change to another are caught; a `useKeys()` kit helper.

## The canvas (Gavin + Yash, 2026-09-03 night: "model this off Figma", the Claude design mockup)

- [x] **A bounded world.** `canvas.size` (2400 × 1600 at zoom 1) inside a viewport you zoom (⌘/ctrl + wheel, pinch, the bar) and pan (wheel, drag empty ground); fits on load. Blocks are placed by `place` or packed into free space (skyline, deterministic, tested); sizes are card widths in px (sm 360 · md 520 · lg 760 · full 1120), not fractions of the world.
- [x] **Objects are the objects.** No wrapper, no corners: the only chrome is a tiny mono label above each object (who · what · time left) which is also the handle. A block that asks for a shape (card, soft, custom, blob) gets it. `canvas.skin` switches the whole wall between `instrument` (this) and `paper` (the liquid); `canvas.grid` dots/lines/none.
- [x] **Drag out a space** (⇧⌘ + drag on empty ground) → the composer for that region ("region x,y,w,h · contains: …"); click a point → "here x,y". **Drag an object by its label** → the ask to move it is written for you. The judge and coder understand both.
- [x] **Decay.** `canvas.decay` days; touching (click, key, drag, a landed change) resets the clock; faded objects hide (`?all` shows them), never deleted; `pinned: true` never fades. Daily sweep. The directory shows what's dying.
- [x] ~~**Directory**~~ (removed 2026-09-04: no directory, the map is the overview) (on the canvas · hot / new / dying · click to go), **presence stack** in the header, **cursor names**, **pins** where asks landed, **heat** where people work, **minimap**, a **ship toast** in the bottom bar, **NOTE** quick-add, **the wall** button for canvas.ts.
- [x] **Phones get the same canvas** (2026-09-04): pinch to zoom, one finger to pan, the directory as a chip strip, a compact icon bar above the viewport; labels keep a constant screen size and hide at the far overview, like frame names. `canvas.mobile: "stack"` brings the plain stack back. The leaderboard leads with the patron and the builders on phones; the timelapse has its own page (`/timelapse`) with a link card.
- [x] **Anyone writes to the shared store** (2026-09-04, Gavin: "if I draw and reload, the drawing doesn't save"): signed-out writes are allowed, rate-limited per tab, and a signed-out writer owns only their own docs (`byAnonId`). The open canvas persists for everyone.
- [ ] NEXT: resize by dragging an object's corner (writes "make this W wide"); "follow" a cursor; typing indicators; touch pinch-zoom on tablets; an image object type (needs the assets pipeline); world-level "flows" (river, timeline) as canvas presets; the 2a/2b/2c directions from the design artifact once they can be read.

## The wall is a canvas (Gavin, 2026-09-03: "the boundaries should be malleable")

- [x] **The wall's own file.** `src/rooms/main/canvas.ts` (background, gap, radius, padding, columns, shape palette, tilt, stagger, height) is agent-editable like any block; pointing at the gaps between blocks targets it ("The wall itself"). Blocks carry `shape` (preset or custom radius/clip/background/border/shadow), `span`, `tilt`, and `place` (free x/y/w on the canvas). Judge + coder + docs know. Existing one-line blocks got honest sizes so the wall reads as a collage, not rows.
- [ ] NEXT: a live "molding" gesture: drag a block's corner while picking to propose a new span/place (the ask is generated for you); wall-wide "flows" (masonry, scatter, timeline) as canvas presets; the picker's outline following custom clip paths.

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
- [ ] **Distribution.** The wall as the demo; "Built with everyones.lol" (opt-out on paid plans); a gallery of shipped changes; a template repo for the internal-tools use case; the Enterprise "talk to us" needs a real inbox (hello@everyones.lol) once the domain is bought.
- [ ] **Pricing experiments.** Per-PR vs. seats vs. sites; measure Notes→Drafts conversion and PR volume per site before locking pricing.

## Self-hosting models (Gavin asked)

Gavin's machine: Apple M4, 16 GB, Ollama installed but no models pulled. The pipeline already reads `MODEL_BASE_URL`, so pointing judge/coder at Ollama's OpenAI-compatible endpoint (`http://localhost:11434/v1`) works. No GPU purchase needed — Apple Silicon runs models on the built-in GPU via Metal; a 7B model is comfortable at 16 GB, a 14B is tight. The catch: production Convex and the Vercel sandbox run in the cloud and can't reach localhost, so self-hosting is for the LOCAL dev stack (free, great for stress-testing) or prod via a tunnel + always-on machine (unreliable on a laptop). At ~2-3¢/change on cloud the savings are small, so: use local models for dev, keep cloud for prod.

- [ ] Wire a dev profile: `MODEL_BASE_URL=http://localhost:11434/v1` + local model names so `pnpm dev` uses Ollama when it's running, falling back to cloud otherwise. Pull `qwen2.5-coder:7b` (coder) and `qwen2.5:3b` (judge/triage).

## Sharing (shipped 2026-09-03, phase 1)

- [x] **Share links that unfurl.** `/c/<request id>` (a change) and `/p/<request id>` (a proposal) are real routes: the wall or the vote board, scrolled to the thing, ringed, with a bar saying who asked for what. A Vercel edge function (`api/share.ts`) serves the app's own HTML with per-change preview tags, and `api/og.tsx` renders the preview image (the ask in big type, who asked, the site) so a link looks right in iMessage / Slack / X. Share buttons at the three moments that matter: the composer's "It's live" and "Up for a vote" panels, the feed card, the ledger rows, and the vote-board rows. Native share sheet on phones, copy-the-link elsewhere. Only public things are shareable (rejected/failed asks stay private).
- [ ] **Phase 2: bring a friend.** Every share link carries `?via=<handle>`; a newcomer's first *live* change within 7 days credits "brought by" on the leaderboard (a tile: builders you've brought). Counts only landed changes, so it can't be gamed by signing up alts. Needs a `users.broughtBy` field, the claim flow to carry it, and a small leaderboard tile.
- [ ] **Phase 2: a builder page to share.** `/u/<handle>`: their changes, their blocks, a share button. The leaderboard's profile query already exists.
- [ ] **Later:** dynamic preview images that render the actual block (screenshot on merge via the preview deploy); "share the wall as it is right now" snapshots.

## Polish & smaller things

- [ ] Header live counters — done this tick (number-forward). Watch for more "feels weak" spots (the patron slot pill next).
- [ ] Code review on the branch before merges once Gavin stops wanting direct session pushes; add branch rulesets + required checks on the repo.
- [ ] Vercel: turn off Deployment Protection on previews so the smoke workflow can reach them.
- [ ] Buy the domain; point the A record at 76.76.21.21.
- [ ] Resend domain verification (emails silently skip until then).
- [ ] GitHub org transfer; move multi-tenant orchestration to a private service when there's revenue (keep the wall + gatekeeper open).

## Owned by Gavin (I can't do these)

- DONE 2026-09-03: `CONVEX_DEPLOY_KEY` is set on Vercel, so Convex production deploys on every push to main. Remaining flip: `backendEnabled` on /admin (agent-written room functions).

Free disk space · turn off Vercel preview auth · sign in on prod once + a Stripe test bid · create the Convex production deploy key and add `CONVEX_DEPLOY_KEY` to Vercel, then flip `backendEnabled` on `/admin` · buy the domain.

## How the loop uses this

Each tick: (1) if a "Now" item is unchecked, do the top one; (2) else pick from Security hardening, then Stability, then the SaaS offering; (3) if everything concrete is blocked, stress-test what exists and log what broke as a new item; (4) always leave this file with an honest "Now" and check off what shipped. Never end a tick without updating this file and the plan's Morning section.

## The room is the canvas (2026-09-04)
- [x] No labels over objects and no directory: the canvas fills the Room page edge to edge under the header; the bar floats at the bottom centre, the map above the Live pill, pages as a strip top-left. Hovering an object shows its title and who touched it last (native tooltip). Moving an object: pick mode, then drag it.
- [x] The map jumps to an object (each block is a clickable rect, `data-map-block`).
- [x] Phones: the bar is zoom + Change + Live across the bottom; the map is a chip that opens on request.
- [x] The vote board: five rows, scroll for the rest; proposals run in three-hour rounds: the top one is built and the rest expire (`crons.cron "37 */3 * * *" promoteTop`, `convex/lib/rounds.ts`); who asked, linked to their GitHub when they signed in with it. Same five-row ledger on Changes.
- [ ] NEXT: an object's facts (who, when, days left) belong in the pick placard and the composer header, not a native tooltip; a "faded" object needs a visible way to revive from the map.

## Floating UI never blocks the canvas (Gavin, 2026-09-04: "I can't build stuff over the map / live")
- [x] The map folds to a chip and opens again (`ab:map` remembered per browser; chip by default on phones); every object in it is clickable.
- [x] The bar is zoom · Change something · Live · toast. "note" and "the wall" are gone (the wall's own file is asked for in words).
- [x] Live moved into the bar on the wall (`LiveButton`, shared with the floating pill elsewhere); the floating pills hide on canvas pages.
- [x] A "?" bottom-right: "Hold ⇧⌘ and point at anything, then say what should change…" with "The full story" opening the help panel (`helpStore`).
- [x] While pointing (chord or Change), the map, the pages strip and the "?" fade and let pointer events through; the bar keeps the cancel. e2e: a marquee started over the map reaches the canvas.
- [x] The open canvas has an eraser instead of Clear: `open:` store namespaces are whiteboards (anyone erases anything), `store.removeMany` batches a drag's deletes under a `storeErase` bucket, the legacy strokes are adopted (never deleted) by an hourly one-off cron.
- [ ] NEXT: undo the last erase (keep a short local tombstone list and re-put); an object's facts (who, when, days left) in the pick placard instead of a tooltip. (The adopt cron is deleted: the legacy namespace emptied.)

## Rounds and the hourly frame (Gavin, 2026-09-04: "maybe it's every 3 hours… and the wall every hour isn't working")
- [x] Proposals run in three-hour rounds (UTC 00:37, 03:37, …): the most-wanted one is built, every other proposal expires and the board starts over. The board shows "round ends in 1h 12m" (`convex/lib/rounds.ts`, shared by the cron and the client; unit-tested).
- [x] Timelapse: GitHub's scheduler fired the hourly job twice in ten hours. Now the workflow asks three times an hour and the script posts only when the latest frame is older than 50 minutes (manual runs always post); the cards say when the last frame landed.
- [x] `timelapseKick` (Convex, hourly): if the latest frame is stale, ask GitHub to run the workflow. Needs the GitHub App's **Actions: read and write** permission (GitHub → Settings → Developer settings → GitHub Apps → everyones.lol → Permissions), then accept the new permission on the installation; until then GitHub answers 403 and the kick is a no-op.
- [ ] NEXT: if frames still miss hours after a day, move capture to a Vercel cron + headless Chromium function (Hobby allows daily crons only, so this needs Pro) or a screenshot API with a key.

## Launch readiness (Gavin, 2026-09-04: "is this set up for success?")
- [x] **One build per person at a time.** A second ask while yours is building says so and waits; the moment it lands, fails, or goes to a vote, ask again (`convex/requests.ts`).
- [x] **An open tab learns a change landed.** The build stamps its commit (`VITE_BUILD_SHA`, `/version.json`, no-store); the tab polls once a minute and right after anything goes live; "New on the wall · reload" appears in the bar (or the pill row elsewhere); hidden tabs reload on their own.
- [x] **The agents' psychology, audited and fixed.** Constitution v1.1: rule 8 declines machinery asks as out of bounds (no human), rule 9 welcomes big asks (a vote), rule 10 is "when in doubt, decide" (there is no human queue, and nobody is ever told to ask one). The judge can only approve or reject (a stray needs_human is read as a reject and, with a plan, becomes a proposal); guests are judged exactly as fairly as regulars (up to medium ships, larger votes); size is never not_for_everyone (backstop + test); sending visitors' input anywhere is unsafe_code (backstop + test); a duplicate of an existing block is an addition, never destroys_others_work; "make it better" with no direction stays the one unclear. Security reviewer told anyone writes (and `open:` whiteboards are by design); coder told objects aren't cards; playtester told a sign-in wall on the wall is a failure; the guestbook and poll examples no longer gate on sign-in. The Rules page renders the constitution itself (generated), so it can't drift. Judge eval: 61/62, attack recall 100%, benign 95%, big never dead-rejected.
- [x] **"Remove this block" has a real primitive.** `removed: true` in a block's meta takes it off the wall, the manifest, and the playtest; the file stays as history and "bring it back" is one flip. The coder is told never to blank a component or delete a file (the hello note ghost from #15 is now marked removed).
- [ ] **Before launch, still yours:** move the Vercel project to the Pro team (Hobby caps deploys at 100/day and forbids commercial use; every merge is a deploy); Convex Pro for sockets on launch day; grant the GitHub App "Actions: read & write" for the timelapse kicker; Deployment Protection off for previews (the smoke job); Turnstile if bots show up; the domain.
- [ ] NEXT (stress drills, the loop runs them): a burst of 20 asks in 5 minutes (queue, sandbox concurrency 8, judge latency, cost per ask); 50 headless visitors on the wall for 10 minutes (Convex function calls/min and bandwidth, cursor and presence traffic); a vandal drill (mass erase, spam asks, prompt injection) against the limits; 10 merges in an hour (Vercel deploy count, Convex deploy time, the reload pill); a broken block (error boundary, revert path); the ledger with 500 rows.

## The top layer (Gavin, 2026-09-04: "what my eyes should gravitate to, what is clickable")
- [x] Favicon is "a.b": anyone, dot, build, drawn as geometry (no font), paper on ink with the orange dot; PNG fallbacks for Safari and the home screen (`pnpm favicon` renders them from the SVG).
- [x] Header hierarchy: wordmark first; the numbers are quiet text (nothing there is clickable, so nothing looks like a button) with who's-here bubbles right after the count, capped by the count; the patron slot is the one orange link (dashed underline, arrow); tabs are text with an underline for the active one; the only bordered button is Sign in.
- [x] Bubbles mean activity: pins on the wall show only asks in flight and for three minutes after they land (they used to sit for a day and read as people).
- [x] Product analytics, off by default: `VITE_POSTHOG_KEY` turns on PostHog with no cookies, no recording, no autocapture, no extra scripts; events: pageviews, ask_sent, ask_outcome, proposal_vote, reload_for_new_build, map_toggle, howto_open, live_toggle. The privacy page discloses it only when on. The site's own cookieless counting (views, uniques, presence) stays.
- [x] "How it's going" panel on /admin from `stats.outcomes` (outcomes, why rejected, how failed, build times) and a **Failed builds** list with one-click **Rebuild** (same requester, same verdict, fresh reservation). Vercel Web Analytics remains a one-click toggle in the Vercel dashboard if traffic curves are wanted without PostHog.
- [x] Help panel rebuilt: three steps (Point, Ask, Ship), the rules in one breath, and links to the real pages (rules, vote board, FAQ, the source, for-your-site); no stats block, no restated rules. The "+N" beside the count is gone (the count is the count; bubbles are only cursors on the wall).

## Taking stock before launch (Gavin, 2026-09-04: "what's happening with the failed requests… floods… overlapping screens")
- [x] **`stats.outcomes`**: an anonymised public query (counts by outcome, why rejected, how failed with the runner's step lines, build times). All-time on prod at the time: 15 live, 31 rejected (unclear 9, too_big 7, promo 6, out_of_bounds 3, slow_down 3, unsafe 3), 14 failed.
- [x] **Root causes of today's failures, fixed.** (1) Every build since posthog-js landed failed typecheck in the sandbox: the dependency snapshot predated the lockfile. The sandbox now syncs dependencies after checkout, the snapshot id lives in config via `POST /ops/snapshot`, and `.github/workflows/snapshot.yml` rebuilds it whenever the lockfile changes on main. (2) "The agent made no changes": the runner's 8k per-step output cap truncated whole-file writes and the model then dumped code as text; now 16k per step, refused writes are logged, a text-only round is nudged (up to two more rounds), and the coder is told to edit_file existing files.
- [x] **Overlapping asks on one object are serialised** by a per-block build lock (the second waits; each build starts from the current main); the lock now outlives CI's longest job (25 min). A PR that still collides with a newer main is rebuilt once from the new base instead of failing.
- [x] **Flood behaviour**: judge calls stop when the day's budget is spent (no model call, an honest budget_spent); the queue caps at 60 (an honest slow_down past that); queue position reads are bounded; a reconcile cron every 10 minutes re-tries merges that missed a webhook, settles deploys that never reported, fails builds that died, and lets go of asks queued for two hours; the sandbox fits Convex's 10-minute action limit. Guests can be banned (`admin.banGuest`).
- [x] **Bot check wired**: the Turnstile widget renders for signed-out askers when `VITE_TURNSTILE_SITE_KEY` is set (interaction-only, token → single-use ticket → submit). **Yours:** create a Turnstile site at Cloudflare, put the site key in Vercel (`VITE_TURNSTILE_SITE_KEY`, production) and the secret on Convex prod (`TURNSTILE_SECRET`), in that order.
- [x] Octokit throttling + retry on the GitHub client (secondary rate limits wait and retry twice; transient 5xx retried). The adopt cron is gone (the legacy namespace emptied).
- [ ] NEXT: a stress drill against production (20 asks in 5 minutes as guests) now that the snapshot and nudges are in; then a GitHub merge queue so a burst of green PRs becomes one deploy (the structural fix for 100 asks at once: today merges are one at a time and each is a deploy).
- [x] A skinny drag is still a space: a marquee counts when either side is ≥ 40 px (a 600×3 line included); only a click-sized twitch is a point. Blocks placed in a space narrower than 120 px get the packer's minimum width.

## Nothing to reload (Gavin, 2026-09-04: "I don't want to have to reload as things get updated… like the drawing that updates")
- [x] The page refreshes itself the first moment you pause after a change lands (no pointer or key for six seconds, nothing focused, no dialog open; a hidden tab at once), and comes back exactly where you were: the room keeps its pan and zoom in sessionStorage, pages keep their scroll. The "reload" button is gone. Hot-swapping new code into the running page isn't safe (each build carries its own React and kit chunks), so a quiet refresh is the honest version of "it just updates".
- [x] Verified on production (2026-09-04): a tab left open at a zoomed view refreshed itself within a couple of minutes of the next deploy and came back at the same zoom, no button anywhere.

## everyones.lol (Gavin, 2026-09-04: "I just got everyones.lol on GoDaddy")
- [x] Renamed everywhere people see it: wordmark, title and tagline ("the website everyone can change"), share copy, preview cards, help, FAQ/rules/terms/privacy, the widget snippet, the prompts, the docs. The GitHub repo, the Vercel project, the Convex deployments, and the mail domain keep their names. The tab icon is e.l.
- [x] `everyones.lol` and `www.everyones.lol` are attached to the Vercel project; sign-in trusts the new hosts and the old Vercel host (`convex/auth.ts`).
- [x] GoDaddy: the A record points at Vercel (done 2026-09-04). ~~**Yours at GoDaddy (one of):** change the nameservers to `ns1.vercel-dns.com` and `ns2.vercel-dns.com` (simplest, Vercel then manages DNS and the www redirect), or add `A @ 76.76.21.21` and `A www 76.76.21.21` and delete the parking A record (76.223.105.230).
- [x] Resolved 2026-09-04: `VITE_SITE_URL=https://everyones.lol` on Vercel production and `SITE_URL=https://everyones.lol` on the Convex production deployment (`npx convex env set --prod SITE_URL https://everyones.lol`), point the timelapse workflow's SITE_URL at it, redeploy, then verify sign-in, a share link, and a preview image on the new name. Resend: verify a sending domain on everyones.lol and update RESEND_FROM (emails silently skip until then).

## The timelapse, change by change (Gavin, 2026-09-04: "only 6 screenshots… let's have that video take up to 10 seconds")
- [x] Six frames in a day was GitHub's scheduler dropping runs (gaps of two to five hours even at three crons an hour). Frames are now taken on every production deploy, posted only when the changes count grew, with a six-hour heartbeat for quiet days; the schedule is just the heartbeat carrier.
- [x] The player runs the whole set in ten seconds (60 ms to 800 ms a frame, more frames = faster), plays once, stops on the latest, and restarts from the first when you press play at the end.

