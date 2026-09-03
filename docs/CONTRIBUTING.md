# Contributing

Two ways in.

**Change the wall.** Go to the site, hold ⇧⌘, click something, ask. That's a contribution; it lands as a PR with your name on it.

**Change the machine.** Anything outside `src/rooms/` is a normal open-source PR: fork, branch, `pnpm install`, `pnpm dev`, then `pnpm typecheck && pnpm lint && pnpm test && pnpm build`. Those must pass, and a maintainer reviews it (CODEOWNERS).

Good first changes:
- the block kit (`src/kit`): new primitives blocks could use
- the judge (`packages/gatekeeper/src/prompts`): make it sharper. Keep `pnpm eval:judge` green.
- the validator (`packages/gatekeeper/src/validate`): something that got through? Add a fixture in `tests/unit`.
- design: it should feel like a place, not a product.

Running the whole pipeline locally without accounts is in the README. With an OpenRouter key you get the real judge. The real coder needs Vercel Sandbox + a GitHub App (see `docs/ARCHITECTURE.md`).

Be kind. It's a wall anyone can write on; treat the people on it that way.
