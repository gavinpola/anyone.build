# anyone.build for your site — the product memo

_Written 2026-09-03, the night after the wall went live. This is the honest version._

## The one-line

Your visitors point at the thing on your site and say what should change. It lands in your inbox as a triaged note; with your permission it becomes a pull request; with your CI as the gate it ships itself. The wall at anyone.build is the public demo of the whole loop running with zero humans.

## Is it a product?

Yes, with a narrow wedge, and it is worth being clear about both halves.

**Why yes.** Visual feedback widgets are a real, paid category (Marker.io, BugHerd, Userback, Usersnap: roughly $39 to $159 a month per team). They all stop at "screenshot plus annotation into Jira". Coding agents (Copilot coding agent, Devin, Cursor background agents, Claude Code on GitHub) all start from an issue somebody already wrote. Nobody closes the loop from *the page itself* to a reviewed PR with a judge deciding what is worth doing. The wedge is: **the page is the issue tracker.** Pointing beats describing, for users and for the agent, because the element, the page, the selector, and the DOM snippet come along for free. That is exactly why the wall works.

**Why narrow.** Three things are true and none of them are fatal:

1. Buyers are scared of visitor-driven code changes. So the product is sold as a feedback tool that can also fix things, not as "let strangers edit your site". The default tier is notes only. Escalation is opt-in per site, and "internal only" (only your team can ask) exists from day one of the paid tiers.
2. Code quality on an arbitrary repo is much harder than on the wall. The wall works because the kit is constrained and the validator is deterministic. On a customer repo the honest promise is "small, self-contained changes: copy, styling, small components, small backend handlers", with the customer's CI as the gate. Drafts (a PR you merge) is the realistic paid product for a year; Ships is for teams who already trust their CI.
3. Platform risk. Vercel Toolbar comments plus v0, or GitHub's own agent, could ship 70% of this. The defense is being the neutral, cheap, end-user-facing layer that works on any host, and being first with the judge, the public rules, and the visible loop.

## Who buys

- **Indie hackers and small SaaS** (self-serve, $29). They read every note and merge every good PR. The widget on their marketing site is a support channel that produces fixes.
- **Agencies** ($99, many sites). Client feedback today is a Loom and a Slack thread; "your client points at it, you get a PR draft" is a workflow they will pay for immediately. One dashboard, ten sites, is the agency shape.
- **Internal tools teams** ($99, internal-only mode). Employees point at the broken thing in the admin panel. No public exposure at all.

## Tiers, and what each one is allowed to touch

| Tier | What happens | Access we need | Who can ask |
| --- | --- | --- | --- |
| **Notes** (free) | Note lands in the inbox with page, element, DOM snippet, one-line AI label (bug / copy / design / feature / question / spam) | one script tag; no repo | anyone on the site |
| **Drafts** ($29) | Judge (the public constitution plus your addendum) filters; agent builds in the sandbox; PR opens on your repo; you merge | GitHub App installed on one repo, PR permission only | anyone, or internal-only |
| **Ships** ($99) | Same, then required checks pass and it merges and deploys | GitHub App plus a branch ruleset that lets the app merge when checks pass | anyone, or internal-only |

Everything the wall enforces carries over unchanged: deterministic validator before any model sees code, sandbox with no egress except the model, the app never pushes to the default branch, code leaves the sandbox only as the diff, revert is one click.

## Unit economics

Per note: storage plus one flash-lite call for triage, about $0.001. Effectively free.

Per PR draft on the cheap models this site runs on (DeepSeek/Qwen coder, Gemini flash-lite judge, cheap reviewer):

| Cost | Range |
| --- | --- |
| Sandbox minutes (2 vCPU, 2 to 6 min) | $0.02 to $0.06 |
| Coder tokens | $0.02 to $0.15 |
| Judge, red team, review, security review | $0.01 to $0.03 |
| **Total** | **$0.05 to $0.25** |

On a frontier coder the same run is $0.50 to $2.50. Pricing above is set so Drafts at 40 PRs is 80%+ gross margin on cheap models and still positive on frontier models; overage at $0.75 keeps heavy users profitable. Model cost is shown to the customer per PR, at cost, so the incentive to pick cheap models is shared.

## Signup and payment flow (the whole thing)

1. Sign in with GitHub on anyone.build (already exists).
2. `/sites`: add a site by name and origin. Get the snippet. Paste it. Notes work immediately. Nothing to pay.
3. Upgrade to Drafts: Stripe Checkout subscription (the Stripe account and webhook already exist for patrons), then "Install the GitHub App on one repo" (the same GitHub App, a second installation on the customer's repo; we store the installation id on the site). Then a per-site addendum to the judge's rules and a toggle for internal-only.
4. Each PR shows in the site's inbox with the diff link and the cost. Monthly usage rolls into the subscription; overage is metered.
5. Ships: same plus a required-checks setting and a branch ruleset the customer applies themselves (we print it; we never hold admin on their repo).

## Security and access model

- Notes never need a repo. The site key is public; the fence is the browser `Origin` header matched to the registered origin, plus per-site and global rate limits and hard size caps on every field.
- The widget runs in a shadow root, sets no cookies, reads nothing but the clicked element and the page URL, and posts one JSON message. It can be audited in a minute; it is 250 lines and served from our origin.
- For Drafts/Ships the GitHub App is installed on the one repo; permissions are contents (write, for branches) and pull requests. It cannot bypass branch protection. The sandbox has no network except the model endpoint; the OpenRouter key is injected by the sandbox firewall and never enters the VM.
- Tenant isolation is by site id on every query, owner checks on every mutation, and the same rule the wall has: no raw table access from anything agent-written.
- Customer code never persists on our side. The snapshot for their repo is theirs (per-installation), and the diff is the only artifact that leaves the sandbox.

## Open source: what stays open

The wall, the kit, the validator, the constitution, and every prompt stay open. That is the trust argument and the marketing: "here is exactly what decides". The product code (sites, notes, billing) lives in the same repo for now because the moat is not the code; it is the running system, the tuned prompts, the data, and the trust. When there is revenue, the multi-tenant orchestration (customer repos, billing, installations) moves to a private service and the open repo keeps the wall and the gatekeeper. That matches Theo's line: open the malleable surface, keep the orchestration private.

## How it sits inside anyone.build without taking over

One footer link, one line at the bottom of the help panel, and the `/for-your-site` page. No banners, no header slot. The widget's popover says "Powered by anyone.build" in 11px grey. The wall stays the wall.

## Built tonight

- `public/ask.js`: the widget. Chord (⇧⌘ or ⇧Ctrl) and a pill on touch devices, hover outline, popover, CSS path + element text + DOM snippet, Escape, ⌘Enter.
- `/ask/note` endpoint on Convex with CORS, size caps, origin check, rate limits; `convex/lib/notes.ts` is the pure validator (unit-tested).
- `sites` and `notes` tables; owner-only queries and mutations; AI triage on each note (`packages/gatekeeper/src/prompts/triage.ts`, public).
- `/sites` dashboard: add site, snippet with copy, Try-it demo page, inbox with Open / Done / Dismissed, delete.
- `/for-your-site`: the page.
- e2e: add a site, leave a note through the real widget on the demo page, work the inbox, delete.

## Not built yet (in order)

1. Stripe subscriptions for Drafts and Ships (Checkout subscription mode, customer portal, metered overage).
2. Per-site GitHub App installation and a per-site judge addendum; the pipeline already takes a repo slug, so the executor needs a `siteId` and the installation id instead of the env repo.
3. Internal-only mode (notes accepted only from signed-in members of a GitHub org, verified through the widget with a short-lived token).
4. Email digest of open notes (Resend is wired).
5. Screenshot capture in the widget (html-to-image inside the shadow root; opt-in per site because of privacy).
