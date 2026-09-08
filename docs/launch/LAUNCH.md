# LAUNCH.md — the week, as a checklist

All times Eastern. Who: **Gavin**, **Yash**, **Claude** (this session; posts only on "go", each post confirmed in chat first). Today is Monday 2026-09-07, Labor Day.

## Pre-post checks (every post, every channel)

- [ ] X Premium is on for both accounts (Premium+ on Gavin's if the article is an X Article)
- [ ] The link is in the first reply, not in the post
- [ ] The video is uploaded native, not linked
- [ ] The hook text is in frame one; captions are on
- [ ] The numbers in the copy were refreshed from `stats:global` and `stats:outcomes` today
- [ ] `/admin` is open in a tab; `stats:outcomes` checked within the last hour
- [ ] Someone is on replies for the next sixty minutes
- [ ] The unfurl was checked with a link previewer (image present, title right)

## Monday night (2026-09-07) — Claude, unattended

- [ ] Section 9 items 1–4: share cards committed, `og:image` + title fixed, stray file removed, "zoom in" copy fixed
- [ ] Section 10: the first-visit card and the header tagline, e2e green
- [ ] `docs/launch/RUNBOOK.md` written; the 09-07 dev e2e stall understood
- [ ] Raw footage recorded for all six clips (`docs/launch/clips/`, `SHOTLIST.md`); the real ask for clip 2 landed on prod; the deliberately rejected ask for clip 4 logged
- [ ] This folder: the eight copy files
- [ ] Morning note at the end of the plan
- [ ] **Gavin, before sleeping (~10 min):** X logged in on Chrome; TikTok account created and logged in; X Premium (or Premium+) bought; Convex Pro; Vercel Pro; OpenRouter topped up to about $150; ElevenLabs Starter key in `.secrets/keys.txt` as `ELEVENLABS_API_KEY`

## First thing Tuesday morning (Gavin, ~20 minutes, in this order)

1. **Free the disk** (≥ 10 GB): Downloads, Creative Cloud logs, browser/Spotify caches, the staged macOS update; empty the Trash. Nothing else tonight was blocked by anything but this.
2. Tell Claude **"record"** — it runs `node launch/record.mjs` (footage from the real site, one real ask), `node launch/cut.mjs`, installs `launch/video`, renders every clip to `docs/launch/clips/final/` (voiced and silent masters, 9:16 and 16:9), and shows you the list. Or run those four yourself.
3. Paste both Turnstile keys into `.secrets/keys.txt` (`TURNSTILE_SITE_KEY=`, `TURNSTILE_SECRET=`); Claude wires them.
4. X Premium on your account ($8), Premium+ ($40) only if the article stays an X Article; Convex Pro; Vercel Pro; OpenRouter ≥ $150.
5. Log into X and TikTok in Chrome and leave the tabs open.
6. Read `x-thread.md` and `article.md` once for voice; every number marked [CHECK] gets refreshed Tuesday night.

## Tuesday (2026-09-08)

- [ ] **Gavin:** Turnstile keys on Vercel and Convex prod (item 5); verify the widget shows signed out and an ask still lands
- [ ] **Gavin:** `VITE_POSTHOG_KEY` on Vercel (item 6); verify `$pageview` and `ask_sent` arrive
- [ ] **Gavin:** Convex Pro and Vercel Pro confirmed live; GitHub App "Actions: read & write" granted
- [ ] **Gavin:** `dailyBudgetCents` set on `/admin` (plan says 5000); OpenRouter balance ≥ $150 [CHECK: the config default is 2000]
- [ ] **Claude:** one real ask on prod, timed from Send to "It's live", number written into the plan
- [ ] **Claude:** clips 1–3 rendered (silent + captions, and voiced if the key is there); Gavin picks the master per clip
- [ ] **Claude:** article draft for Gavin's voice pass (`article.md`)
- [ ] **Gavin:** kill switches exercised once on dev (`guestsEnabled` off → the composer says so)
- [ ] **Gavin:** X Premium on both accounts (Yash too)
- [ ] **7:00 PM — Gavin posts TikTok #1 (GTA)**; caption and hashtags from `tiktok-captions.md`; bio link set to everyones.lol
- [ ] **Evening:** Gavin and Yash reply to TikTok comments; note the good asks for comment-reply clips

## Wednesday (2026-09-09) — launch day

- [ ] **8:30 AM — Gavin:** numbers refreshed in `x-thread.md` and `show-hn.md`; `/admin` open; friends pinged to reply (not like) at 9:00
- [ ] **9:00 AM — Gavin posts the X thread**: the post with video 2, no link; first reply with the link; then posts 1–7 in order, each with its clip
- [ ] **9:02 AM — Yash** quote-posts and replies; ten replies from friends by 9:15
- [ ] **9:00–10:00 — Gavin** replies to every reply; posts `/c/` card screenshots as people's asks land
- [ ] **9:30 AM — Gavin** pins the thread
- [ ] **10:00 AM — Gavin posts Show HN** (title and text from `show-hn.md`); **Gavin** on replies the first hour, **Yash** the second; prepared replies in the file
- [ ] **10:00 AM — Claude:** `stats:outcomes` hourly from here; watch for floods, failures caused by us, the budget line
- [ ] **12:30 PM — Gavin** reposts the thread with video 5 (phone) and the morning's `/c/` cards
- [ ] **Afternoon — Gavin posts r/InternetIsBeautiful** (title, one sentence, the link; no "we")
- [ ] **6:00 PM — Gavin** reposts with video 6 (fade) and the day-one numbers
- [ ] **7:00 PM — Gavin posts TikTok #2 (the loop)**
- [ ] **All day — Gavin and Yash** replying everywhere; **Claude** posting nothing without a "go"
- [ ] **Night — Claude:** day-one numbers written into the plan for the follow-up post; Product Hunt assets checked (three OG cards, timelapse GIF)

## Thursday (2026-09-10)

- [ ] **12:01 AM PT (3:01 AM ET) — Product Hunt goes live** if the assets were ready Wednesday night; **Gavin** posts the first comment from `product-hunt.md`; ten friends asked to comment
- [ ] **9:00 AM — Gavin publishes the article** (X Article on Premium+, or a long-form post on Premium); **Gavin** links it in the X thread's first reply and in an HN reply if anyone asked "why"
- [ ] **Claude:** the article's six screenshots ready by 8:00 AM (`article.md` lists the URLs)
- [ ] **7:00 PM — Gavin posts TikTok #3 (timelapse)**
- [ ] **Gavin and Yash:** replies on X, HN, PH, TikTok

## Friday (2026-09-11)

- [ ] **Morning — Gavin posts r/webdev** (the engineering story from `reddit.md`)
- [ ] **Midday — Gavin posts a "what people asked for this week" X thread** with the best `/c/` cards (**Claude** collects the cards Thursday night)
- [ ] **7:00 PM — Gavin posts TikTok #4 (rules)**

## Weekend (2026-09-12 and 13)

- [ ] **Saturday 7:00 PM — Gavin posts TikTok #5 (phone)**
- [ ] **Sunday 7:00 PM — TikTok #6 (fade), optional**
- [ ] **Claude:** comment-reply clips cut from the week's asks (the ask card, then the verdict or the block); **Gavin** posts them as replies
- [ ] **Claude:** the week's numbers and the funniest rejections collected for Monday

## Monday next (2026-09-14)

- [ ] **Morning — Gavin posts r/artificial** (the agents-in-the-open angle, linking the article)
- [ ] **Gavin posts the numbers follow-up** on X: day one and week one against the targets (10k visitors, 500 asks, 150 live changes, 100 sign-ins, zero failures caused by us)

## Kill switches (both of you; `/admin`)

`guestsEnabled` off (sign-in only) · `fastPathEnabled` off · `dailyBudgetCents` to 0 (everything rejects politely) · `admin.banGuest` · one-click revert on any change · the nightly sweep's issue. If the budget dies at 11 AM, raise it from `/admin`.
