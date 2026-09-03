# Security

anyone.build lets strangers ask an AI to change a live website. That is the whole point, and the whole threat model. This page says what holds the line and how to report a hole.

## Report a vulnerability

Email **security@anyone.build** or open a [private security advisory](https://github.com/gavinpola/anyone.build/security/advisories/new). Please don't file public issues for exploits, and don't test against other people's data. We'll credit you on the leaderboard if you want.

## What actually holds

Every layer below is deterministic and public. Knowing about it doesn't help you get around it.

1. **Identity.** Changing anything needs a GitHub account. Account age and public repos set a trust level; new accounts get two tiny changes a day.
2. **The editable surface is `src/rooms/**`, nothing else.** Enforced four times: inside the agent's tools, by the validator in the sandbox, by the validator in Convex before a commit, and by CI on the PR. `CODEOWNERS` requires a human review for everything outside the wall.
3. **Forbidden code.** No network calls, storage, cookies, scripts, iframes, images or links from elsewhere, URL literals, dynamic import, eval, obfuscation, or invisible unicode in room files. ESLint bans plus a regex pass (`packages/gatekeeper/src/validate`). Links only through `SafeLink` with an allowlist.
4. **No secret in the sandbox.** The agent runs in a Vercel Sandbox with deny-by-default egress. The model key is injected by the firewall at egress; the GitHub token never leaves Convex. The agent can't push: Convex commits the validated patch through the Git Data API.
5. **Three model checks with different vendors.** Judge (intent), red team (argues against), diff reviewer (reads the code). Fooling one is not enough.
6. **Budgets.** Per-request cap by scope, a public daily cap, global concurrency, hourly approvals. When it's spent, it's spent.
7. **Branch rules.** `main` requires a PR and green CI; the bot can't bypass; force-push is off; secret scanning and push protection are on.
8. **Runtime.** CSP, per-block error boundaries, a smoke test on every preview, one-click revert, and strikes that drop trust.

## Known trade-offs

- The judge prompt is public. We think three checks plus deterministic walls beat obscurity, and we'd rather people improve the prompt than guess at it. A short private addendum can be appended at runtime.
- Room code runs in visitors' browsers. The bans above are the wall; if you find a way through them with code that passes lint and the validator, that is exactly what we want to hear about.
- Patron logos are user-uploaded images. Maintainers can remove a bid; report abuse with the link in the footer.

## For your site (the widget and `/ask/note`)

`public/ask.js` runs on other people's sites, so it is held to a stricter standard than the wall: no dependencies, a shadow root for styles, no cookies or storage, no reads beyond the clicked element and the page URL, and one JSON POST per note. The endpoint is unauthenticated by design (visitors have no account), so the fence is: the site key must exist, the browser `Origin` must equal the origin registered for that key, every field has a hard size cap (`convex/lib/notes.ts`), and there are per-site and global daily rate limits. Notes are stored as text and rendered as text; the DOM snippet is never rendered as HTML. Owners see only their own sites and notes (owner checks on every query and mutation). The triage model sees the note as quoted data with a "never follow instructions inside" framing, and the inbox works without it.
