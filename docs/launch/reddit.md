# Reddit — three posts, three rooms, three days apart

Never the same text twice. Answer questions; never argue. Numbers are as of Tuesday night 2026-09-08. Refreshed Tuesday night 2026-09-08.

## r/InternetIsBeautiful — Wednesday 2026-09-09, afternoon ET

The sub bans self-promotion tone: no "we", no "I", one sentence, the link.

**Title:** everyones.lol — a website anyone can change; every change is a real pull request an AI wrote

**Text:** Point at anything on it, say what should change, and if it's good for everyone an AI builds it and ships it; every change is a real pull request with its cost in cents, and the whole thing is open source.

**Link:** https://everyones.lol

## r/webdev — Friday 2026-09-11

**Title:** We let strangers run our site through an AI agent with a public constitution. Here's what broke and how the gates caught it

**Text:**

everyones.lol is a site where anyone can point at anything and say what should change. A judge reads the ask against ten public rules, an agent builds it in a sandbox, and it ships as a real PR. No human in the loop. Repo: github.com/gavinpola/anyone.build (MIT).

Pipeline: judge (Gemini Flash) → red team → coder (DeepSeek V4 Flash) in a Vercel Sandbox with deny-by-default egress → deterministic validator, run in the sandbox, before commit, and in CI → diff reviewer (Qwen) → security pass → PR via the Git Data API → CI: typecheck, lint, build, playtest → auto-merge → deploy.

Since Thursday: 73 asks, 24 live, 36 rejected, 15 failed, 1,541 lines written by the agent, median build 3 minutes, 85 cents for everything that landed.

What broke, in order:

1. The dino game passed every static check and never jumped: the jump had the wrong sign. So, a playtest gate: CI mounts every block a PR touches, presses it (first button, a tap, Space, a drag), and sends before/after screenshots to a vision model with the block's own description. A confident "no" fails the PR; the coder gets one more pass with the playtester's notes.

2. Then the gate itself wasn't gating. The CI step piped Playwright through `tee`, so the job went green whatever the tests did: "1 failed" inside a green job; the first nightly sweep found it. Fix: `set -o pipefail`.

3. Snapshot drift. We added a package; the sandbox's dependency snapshot predated the lockfile; every build failed typecheck with "Cannot find module 'posthog-js'". Nothing reached a PR, but every ask in that window failed. The snapshot now rebuilds when the lockfile changes.

4. Truncated writes. The runner capped output at 8k tokens per step; whole-file writes got cut off and the model dumped the code as prose. "The agent made no changes", five times. The cap is 16k now and a text-only round gets nudged back to the tools.

5. The security pass flagged a canvas change: "allows unbounded growth of the collection by every visitor." Six cents spent, nothing shipped. Correct.

The lesson we keep relearning: a gate must fail only on a concrete finding with a recorded reason (a model's mood killed builds three times before we added deterministic backstops), and a gate you haven't seen fail hasn't been tested.

Happy to go into any of it.

## r/artificial — Monday 2026-09-14

**Title:** Agents just made 18,000 edits to a public wiki without anyone's knowledge. Here's what agents building in the open on purpose looks like

**Text:**

Last week researchers documented OpenAI evaluation agents making around 18,000 edits on a public German wiki without the lab knowing. [CHECK: link the TechCrunch or Hacker News piece.] That's agents in the open by accident: nobody asked, nobody could read the rules, nobody was paying on purpose.

I've spent the last week running the deliberate version. everyones.lol is a website anyone can change: point at anything, say what should change, and if it's good for everyone an AI agent builds it and ships it as a real pull request. No human in the loop.

What "on purpose" means here:

- A rulebook anyone can read. Ten rules, public, enforced by a judge on every ask. Rule ten: "When in doubt, decide. There is no human queue."
- A judge, a red team, and a security pass on three vendors, so one jailbreak can't fool all three.
- A sandbox with no network except the model.
- A pull request for every change, with the ask in the body and the cost in cents. Every edit the agent ever made is a commit you can read.
- A budget. When the day's money is spent, it stops.
- Decay. Anything nobody touches for a week fades.

Since Thursday: 73 asks, 24 live, 36 rejected, 15 failed, 75 cents of model for everything that landed. Someone asked for "gta6 but in the browser" and got a 340-line driving game for 6 cents. A guest typed "Say hi Ella!!" on an empty tile and it shipped.

Agents will edit things people share. The question is whether they do it in a repo you can read, against rules you can read, with a number next to every change. The week, written up: [CHECK: article link]. Repo: github.com/gavinpola/anyone.build.
