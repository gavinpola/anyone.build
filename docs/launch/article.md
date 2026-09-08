# The article — X Article on Gavin's account, Thursday 2026-09-10, 9:00 AM ET

Needs Premium+ for the Article format; the fallback is a long-form post on Premium (up to 25k characters, images inline). Draft Tuesday, Gavin edits for voice, publish Thursday. Link it in the X thread's first reply and in an HN reply if asked "why". Numbers are as of Sunday night 2026-09-06. [CHECK: refresh every number Wednesday night from `stats:global` and `stats:outcomes`; the day-one numbers go in the follow-up post the next week, not here.]

## Title options

1. We let strangers run our website through an AI. Here's what happened.
2. Nobody made this website. Everybody did.
3. I made a website anyone can change. Four days later it had a driving game in it.

---

[IMAGE: the wall as it looks today, landed on the newest block — screenshot https://everyones.lol/ at 1440 wide, desktop]

everyones.lol is a website anyone can change. You point at anything on it, say what should change in plain words, and if it's good for everyone an AI builds it and ships it, live, as a real pull request. You don't visit this site. You leave a mark on it.

That is the whole mechanic. There's no editor, no account needed, no queue with a person at the end of it. The ask goes to a judge, the judge says yes or no, and a coding agent does the work in a sandbox and opens a pull request on a public repo. When the checks pass it merges and deploys. A few minutes later the thing you pointed at is different, for everyone.

## Why

I keep going back to r/place, One Million Checkboxes, and the Million Dollar Homepage. They're the same idea from different decades: a shared thing strangers can carve a mark into, where you can watch the state move while you're on it. Nobody assigns a goal. The drama becomes the content: the pixel wars, the teenagers encoding URLs into the checkbox grid, the secret messages. People are much more attached to goals they came up with themselves.

Nobody had built that for a website. Not a canvas on a website; the website. The thing being changed is the site itself: the code, the layout, the games, the copy. That only became possible this year, because a coding agent on cheap models can now turn "make this say something braver" into a pull request for about three cents, and a judge model can read an ask and tell whether it's for everyone or just for you.

So the question was: if you take the human out of the loop entirely and let anyone on the internet drive a coding agent at a live site, does it fill with junk in an hour, or does something happen?

## How it stays sane

Ten rules. They're the constitution, they're public, and the judge enforces them verbatim. Rule one: "Make the room better for the people who visit it. A change should be something a stranger would be glad to find, not something only the requester wants." Rule three: "No ads, promotion, or links out." Rule eight: "The machinery is off limits." Rule ten is the one I care about most: "When in doubt, decide. There is no human queue, and nobody is ever told to ask one."

[IMAGE: the rules page — https://everyones.lol/rules]

Then the machinery. A judge (Gemini Flash) reads the ask against the rules and scopes it: tiny, small, medium, large. A red team on a different model argues against it. If it passes, a coder (DeepSeek V4 Flash) works in a Vercel Sandbox with no network except the model endpoint; the API key is injected at the firewall and the GitHub token never enters the box. The agent can only touch one directory. A deterministic validator and the same AST rules as ESLint run in the sandbox, again before anything is committed, and again in CI: no fetch, no storage, no scripts or images from elsewhere, no eval, no invisible unicode. A diff reviewer and a security pass on other vendors read the code. Then the patch is committed through GitHub's API, a pull request opens with the ask in the body and the cost in cents, and CI runs typecheck, lint, build, and a playtest that mounts the block, presses it, and asks a vision model whether it plausibly works. Green means it merges and deploys.

Money is capped per request by scope (a tiny change can spend fifty cents of model at most; a large one, six dollars) and per day by a public budget. Big asks aren't rejected: they go up for a vote, and every three hours the most-wanted one gets built. Anything nobody touches for a week fades; touch it and it comes back. And every change reverts in one click.

None of this is obscurity. The prompts are in the repo. The judge's eval set is in the repo. The security page says what holds and what doesn't. We think three model checks plus deterministic walls beat secrecy, and we'd rather people improve the prompt than guess at it.

## What happened in week one

The first change landed on Thursday, September 3rd, at five in the morning Eastern: a guest asked for a welcome header. Two cents.

[IMAGE: a ledger row — the Changes ledger on https://everyones.lol/leaderboard, one row showing the summary, who, +lines −lines, the cents, and the PR link]

By Tuesday night, the numbers: 73 asks. 24 changes live. 36 rejected by the judge (9 not for everyone, 9 unclear, 7 too big, 5 unsafe code, 3 out of bounds, 3 slow down). 15 failed the checks. 1,541 lines written by an agent, 76 removed. Median build time: three minutes and four seconds. The 21 live changes cost 75 cents of model in total. The 14 that failed cost another 89 cents. Call it a dollar sixty-four for the week, plus 631 pageviews and three signed-in builders. [CHECK: 68 asks is `stats:global`; the outcome counts sum to 71. Say which.]

Three asks I keep coming back to.

On Sunday afternoon, @rushil pointed at a block and typed "turn this into gta6 but in the browser." The judge read that as a top-down driving game, scoped it medium, and the agent wrote 340 lines: car physics, buildings you crash into, on-screen controls for phones. Six cents. Nineteen steps. Live in a few minutes as pull request #23. It's a crummy little driving game called GTA 6, and it's the best thing on the site.

[IMAGE: the GTA share card gliding to the game, then the game running — https://everyones.lol/c/kh7cfxm3z1y7p08ce84vayhakx8dxhy3]

That same evening a guest tapped an empty tile and typed "Say hi Ella!!" Twenty lines, three cents, tile 0,3. I don't know who Ella is. Neither does the agent. It shipped it anyway, because a stranger would be glad to find it.

And the eraser. Someone had asked for a shared drawing canvas earlier in the week (242 lines, six cents). Its eraser deleted whole strokes, which was annoying, so I pointed at it and typed, with typos, that it should erase parts of lines with a circular eraser you can size up and down. The agent replaced the eraser and the brush with a radius you scroll: 133 lines in, 57 out, seven cents. I didn't write a line of it. I'm listed as the builder.

[IMAGE: my builder page — https://everyones.lol/u/gavinpola]

Things broke. Three of them are worth telling.

The dino game compiled, passed every check, and didn't jump. The jump had the wrong sign. A type checker can't see that. So there's now a playtest gate in CI: every block a PR touches is mounted alone, rendered, pressed (the first button, a tap, Space, a drag), and screenshots from before and after go to a vision model with the block's own description and one question: does this plausibly work for someone who taps the right thing? A confident no fails the PR. Then we found the playtest gate itself wasn't gating. The CI step piped Playwright through tee, so the job went green whatever the tests did. The first nightly sweep found it. Fixed the same day.

For a stretch, every build failed typecheck in the sandbox because the dependency snapshot predated the lockfile; we'd added an analytics package. Nothing reached a PR. Typecheck in the sandbox caught it every time, which is the point, but every ask in that window failed. The snapshot now rebuilds itself when the lockfile changes.

The agent's runner capped output at 8k tokens per step, so whole-file writes got truncated, and the model then gave up and dumped the code as prose. "The agent made no changes." Five of the fourteen failures were this. Now the cap is 16k and a text-only round gets nudged back to the tools.

The security pass earned its keep once: it flagged a canvas change because "the implementation allows unbounded growth of the collection by every visitor." Six cents spent, nothing shipped. That's the right answer.

## The contrast

Last week, independent researchers documented OpenAI evaluation agents making around 18,000 edits on a public German wiki over a month, without the lab knowing. [CHECK: link the TechCrunch piece; confirm "a month".] That's what agents in the open look like by accident: nobody asked, nobody could read the rules, nobody was paying for it on purpose.

everyones.lol is the same thing on purpose. Agents building in public, with a rulebook anyone can read, a judge, a sandbox, a pull request for every change, a cost in cents next to each one, and a budget that stops when it's spent. I think this is what the next few years look like: agents editing things people share. The question is whether they do it in a repo you can read.

## What we don't know

Whether it fills with junk. Six days and 713 pageviews is not a launch. The judge rejected half the asks so far, and most of those were unclear, not malicious. We haven't met the flood yet.

Whether decay keeps it alive or just makes it empty. A week is a guess.

Whether the vote board works. Nothing has won a round yet: the board has been empty most of the week.

Whether the cheap models are enough. Most of the failures were the coder giving up partway through a medium build. The large tier routes to a frontier model and hasn't run in the loop yet.

## Ask it for something

Go to everyones.lol. Hold shift and command and click anything, or tap it on a phone. Say what should change. If it's good for everyone, it'll be live in a few minutes, and you'll be on the leaderboard as the person who asked for it. Reply to my thread with what it did.

[IMAGE: the timelapse — https://everyones.lol/timelapse, the last frame with the changes counter]

Nobody made this. Everybody made this.

One more thing. The same loop runs on your own site: your visitors point at the thing and say what should change, it lands in your inbox, and with your permission it becomes a pull request on your repo. everyones.lol/for-your-site
