# X launch thread — Wednesday 2026-09-09, 9:00 AM ET

Video native (upload the file, never a link to it). No link in the post; the link goes in the first reply. Reply to every reply for the first hour. Pin the thread. Yash quote-posts at 9:02 and replies; ten replies from friends in the first fifteen minutes.

Numbers below are as of Tuesday night 2026-09-08. Refreshed Tuesday night 2026-09-08 from `stats:global` / `stats:outcomes`.

## The post (video 2, "The loop", attached — no link)

I made a website anyone can change.

Point at anything, say what should change, and an AI builds it and ships it, live, as a real pull request. Almost everything on it was asked for by strangers.

(Said "almost": 8 of the 24 live changes were Gavin's own asks.)

## First reply (the link)

everyones.lol

ask it for something and reply here with what it did

## The thread (one post per clip, in this order)

**1. GTA (video 1 attached)**

Someone asked it to "turn this into gta6 but in the browser."

The judge read that as a top-down driving game, called it medium, and built it. 340 lines. 6 cents. Merged as a real pull request.

The car crashes into buildings. It's the best thing on the site.

**2. Timelapse (video 3 attached)**

Every change anyone ever made, in ten seconds.

A frame is taken on every deploy. This is all of them so far. Nobody planned any of it.

Nobody made this. Everybody made this.

**3. Rules (video 4 attached)**

So why isn't it a mess.

Ten rules, public, enforced by a judge on every ask. Ads, links out, tracking, hate: "not this time", with the reason. Big asks go to a vote; every three hours the most-wanted one gets built. No human in the loop.

**4. The numbers**

Since Thursday:

73 asks
24 changes live
36 rejected by the judge, 15 failed the checks
1,541 lines written by an agent
median build: 3 minutes

The 21 that landed cost 75 cents of model, total. The 14 that didn't, 89 cents.

**5. Two of my favourites**

A guest tapped an empty tile and typed "Say hi Ella!!" Twenty lines, three cents, live in minutes. Nobody knows who Ella is.

I asked the shared canvas's eraser to erase parts of lines, not whole ones. The agent rebuilt it as a circular eraser with a radius you scroll. 7 cents.

**6. The repo**

It's all open source, including the judge's rules, every prompt, and the eval set the judge is tested against. MIT.

github.com/gavinpola/anyone.build

Every change on the site is a PR in there, opened by the agent, with the ask in the body and the cost in cents.

**7. For your site (last)**

Last thing. The same loop runs on your own site: your visitors point at the thing and say what should change, it lands in your inbox, and with your permission it becomes a pull request on your repo. everyones.lol/for-your-site

## Reposts (quote the pinned thread with a new clip; never the same clip twice)

**12:30 PM ET (video 5, "On your phone", attached)**

It works on your phone. Swipe to walk, hold an object to move it.

Three hours in: [CHECK: asks sent / live] changes people have asked for since 9. Screenshots of the /c/ cards below.

**6:00 PM ET (video 6, "Things fade", attached)**

If nobody touches something for a week, it fades. Touch it and it comes back.

Day one: [CHECK: asks / live / rejected from stats:outcomes at 6 PM]. The judge's best rejection of the day is in the replies.

## Reply templates (paste, then edit to the question)

1. **What stops spam?** A judge reads every ask against ten public rules before any code runs; asking costs nothing, building costs the budget. One build per person at a time, a 60-ask line, a global hourly cap for guests, a bot check for signed-out asks, and a public daily budget that just says no when it's spent.

2. **Who pays?** Me, for now. A change costs 2 to 7 cents of model on the cheap models it runs on. The day's budget is public in the header; patrons can top it up. [CHECK: today's `dailyBudgetCents` on /admin — the config default is $20, the plan says $50 for launch.]

3. **Is it open source?** Yes, MIT, all of it: the site, the judge's prompt, the rules, the validator, the eval set. github.com/gavinpola/anyone.build. Every change on the wall is a PR in that repo.

4. **Can it break?** A block can. Each one runs in its own error boundary, a broken one shows a crash card, not a broken page, and any change reverts in one click. The header, the judge, and the pipeline aren't on the wall; rule 8 makes them off limits.

5. **What model?** Judge: Gemini 2.5 Flash. Red team and security pass: Gemini 3.1 Flash Lite. Coder: DeepSeek V4 Flash. Reviewer: Qwen3 Coder. Large builds that win a vote go to Claude Sonnet 5. All through OpenRouter; three vendors on purpose so one jailbreak can't fool all three.

6. **Why?** r/place and the million checkboxes showed people want to carve a mark into something shared. Nobody had done it for a website where the thing you change is the site itself. It only became possible this year: an agent can turn "make this say something braver" into a pull request for three cents.

7. **Can I ask for anything?** Anything that's for everyone. Ads, links out, tracking, hate, "make me admin": no, with a reason. Big things ("build a chat") aren't rejected; they go up for a vote and the winner gets built every three hours.

8. **How long does it take?** Tiny changes in under a minute. Median build so far is about three minutes; the slow ones, seven. You get a "Judging…" then "Building now" then "It's live" and a link to the PR.

9. **What if it writes something bad?** It has. The security pass flagged a change that let a shared collection grow without bound; the reviewer bounced another; the playtest gate fails games that compile but don't work. Failures are private, cost a few cents, and never reach the wall.

10. **Can it run on my site?** Yes. A 250-line widget: visitors point at the thing and say what should change, notes land in your inbox with the element and page, and with your permission it becomes a PR on your repo. everyones.lol/for-your-site
