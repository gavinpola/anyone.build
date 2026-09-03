# Architecture

```
Browser (Vite + React SPA on Vercel)
  │  Convex WebSocket (feed, leaderboard, presence counters, kit store)
  ▼
Convex (schema, functions, crons, HTTP webhooks)
  ├─► OpenRouter   judge · red team · diff review (structured JSON, different vendors)
  ├─► Vercel Sandbox   clone repo at main → sandbox/runner.mjs (AI SDK tool loop) → diff
  ├─► GitHub App   commit (Git Data API) · PR · merge · revert
  ◄── GitHub webhooks (check_suite, deployment_status, pull_request) · Vercel webhooks · Polar webhooks
  ▼
GitHub Actions CI (typecheck, lint, tests, build, playground validator) + Playwright smoke on the preview
  ▼
Vercel production deploy → the wall changes for everyone
```

## One request, end to end

| step | where | what |
|---|---|---|
| submit | `convex/requests.ts` | auth, trust, rate limits, dedupe (+1), target path check |
| judge | `convex/pipeline/judge.ts` | `packages/gatekeeper` judge → optional red team → verdict, scope, plan; budget reserved |
| queue | `convex/pipeline/executor.ts` | one build per block, global concurrency cap |
| build | `convex/pipeline/build.ts` | Vercel Sandbox: install, run `sandbox/runner.mjs`, read the diff |
| validate | `packages/gatekeeper/src/validate` | paths, sizes, forbidden code, secrets |
| review | `reviewDiff` | does the diff do only what was approved? |
| PR | `convex/pipeline/github.ts` | commit via Git Data API, open PR labeled `playground` |
| CI + preview | GitHub Actions, Vercel | checks + preview URL (webhooks update the card) |
| merge | `tryMerge` | serialized by the merge lock; squash merge; conflicts → `collided` |
| live | `markLiveBySha` | production deploy webhook → `changes` row → leaderboard |

## Scale notes

- Presence is per-minute bucket counters, not a list of everyone. Clients receive one number.
- The feed is two queries: `active` (small, hot) and `landed` (larger, cold). Global counters are coarse-rounded so unchanged results aren't re-sent.
- Per-block build locks avoid most conflicts; new blocks are separate files (`import.meta.glob`), so they never conflict.
- Convex Pro (10k concurrent sockets) before launch; Vercel Pro (required: commercial + sandbox credential injection).

## Setup

You need: a Vercel Pro team, a Convex deployment, an OpenRouter key, a GitHub App installed on the repo, a Polar org (patrons), a GitHub OAuth app (login).

```
npx convex env set OPENROUTER_API_KEY ...
npx convex env set SITE_URL https://anyone.build
npx convex env set GITHUB_REPO anyone-build/anyone.build
npx convex env set GITHUB_APP_ID ... GITHUB_APP_PRIVATE_KEY ... GITHUB_APP_INSTALLATION_ID ... GITHUB_WEBHOOK_SECRET ...
npx convex env set VERCEL_TOKEN ... VERCEL_TEAM_ID ... VERCEL_PROJECT_ID ... VERCEL_WEBHOOK_SECRET ...
npx convex env set GITHUB_CLIENT_ID ... GITHUB_CLIENT_SECRET ... BETTER_AUTH_SECRET ...
npx convex env set POLAR_ACCESS_TOKEN ... POLAR_WEBHOOK_SECRET ... POLAR_PRODUCT_ID ...
npx convex env set EXECUTOR sandbox
npx convex env set MAINTAINER_HANDLES yourhandle
```

GitHub App permissions: `contents: write`, `pull_requests: write`, `checks: read`, `deployments: read`, `metadata: read`. Events: `check_suite`, `check_run`, `pull_request`, `deployment_status`, `status`. Webhook URL: `https://<deployment>.convex.site/webhooks/github`.

Repo rulesets on `main`: require PR, require `checks` (and `smoke`) status, no force push, no bypass for the app. Enable "Allow squash merging" and "Automatically delete head branches". Labels: `playground`, `revert`.

`scripts/refresh-snapshot.mjs` builds a sandbox snapshot with dependencies installed; set `SANDBOX_SNAPSHOT_ID` to skip the install step on every run.
