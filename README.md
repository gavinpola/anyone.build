# everyones.lol

**The website anyone can change.** Hold ⇧⌘, click anything on the wall, say what should change. If it's good for everyone, an agent writes the code, checks it, opens a pull request, and it ships. Everyone watches it happen.

- **Room** — the wall. Empty on day one. Whatever hangs there was asked for by a stranger and built by an agent.
- **Leaderboard** — builders ranked by changes shipped and lines pushed; the day's patron board (rank is what you pay); the ledger of changes with votes.
- **Gatekeeper** — a judge, a red team, and a diff reviewer, on cheap fast models, behind deterministic walls that don't get weaker by being public.

Everything here is open source, including the judge's rules (`packages/gatekeeper`). Please read [`docs/SECURITY.md`](docs/SECURITY.md) before poking at it, and [`docs/CONTRIBUTING.md`](docs/CONTRIBUTING.md) before opening a PR.

## Pages and room functions

A room can hold more than blocks. `src/rooms/<room>/pages/<slug>.tsx` is a whole route at `/r/<room>/<slug>`, listed on the wall and pickable like a block. `convex/rooms/<room>/<file>.ts` is a room function: server code that may only export `roomQuery` / `roomMutation` from the protected kit, with a capped per-room store and nothing else. Blocks call them with `useRoomQuery("file:fn")` and `useRoomMutation("file:fn")`. The reference pair is `convex/rooms/main/poll.ts` and `docs/examples/blocks/vote-once.tsx`. Room functions are switched off (`backendEnabled`) until the Vercel build deploys Convex on merge (`scripts/vercel-build.mjs` with a `CONVEX_DEPLOY_KEY`).

## For your site

The same point-and-ask, on any site: `public/ask.js` is a 250-line, dependency-free widget. Visitors hold ⇧⌘ (or tap Ask on a phone), click anything, and say it; notes land in the owner's inbox at `/sites` with the page, the element, and a one-line AI label. Pull requests on the owner's repo are the next tier. The thinking, pricing, and access model are in [`docs/PRODUCT.md`](docs/PRODUCT.md).

## Run it locally (no accounts needed)

```bash
pnpm install
pnpm dev              # the site on http://127.0.0.1:5173 (mock pipeline, in-memory)
```

For the real backend with zero signup, Convex runs locally and anonymously:

```bash
CONVEX_AGENT_MODE=anonymous npx convex dev      # writes .env.local, runs the backend on :3210
npx convex env set DEV_ANON_AUTH 1              # dev-only sign-in without a GitHub OAuth app
npx convex env set MOCK_JUDGE 1                 # dev-only judge (keyword rules) if you have no OpenRouter key
npx convex env set BETTER_AUTH_SECRET "$(openssl rand -base64 32)"
npx convex env set SITE_URL http://127.0.0.1:5173
echo VITE_DEV_ANON_AUTH=1 >> .env.local
pnpm dev
```

With an OpenRouter key (`npx convex env set OPENROUTER_API_KEY sk-or-...`) the real judge, red team, and diff reviewer run. The real coder needs Vercel Sandbox + a GitHub App (`EXECUTOR=sandbox`); see [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md#setup).

## How a change happens

```
point → ask → judge (≈1s) → build in a locked sandbox → validate → review → PR → CI → merge → deploy → live
```

Costs a few cents per change on the default models. The daily AI budget is public in the header; patrons top it up.

## Layout

```
src/core        the app: picker, composer, feed, leaderboard, patrons, auth   (protected)
src/kit         what a block may use: UI primitives, useStore, useCounter, SafeLink   (protected)
src/rooms       THE WALL — the only thing the agent may edit
convex          backend: schema, functions, pipeline, webhooks, crons
packages/gatekeeper   constitution, prompts, schemas, validators, budget math
sandbox         the agent runner that executes inside the sandbox
scripts         setup, manifest, validator, judge evals
```

MIT.
