# Shot list — what got rendered (2026-09-08)

Everything under `docs/launch/clips/final/` (git-ignored, ~15 MB). Every frame is the real site on production; the voice is ElevenLabs "Liam" from `launch/voice-lines.json`; captions are burned in. Two masters per clip: **voiced** (16:9 for X and Shorts) and **silent with captions** (for TikTok, add a trending sound in the app), plus a **silent vertical** for the desktop clips (the footage sits in the middle band, captions below). To re-cut: change `launch/cut.mjs`, run `node launch/cut.mjs && node launch/render.mjs`.

| File | Clip | Length | Hook on screen | Where it goes |
|---|---|---|---|---|
| `gta-voiced.mp4` | 1 · GTA | 16 s | Someone asked this website for GTA 6. | X thread post 1, Shorts |
| `gta-silent-vertical.mp4` | 1 · GTA | 15 s | same | **TikTok #1 (Tue 7 PM ET)**, Reels |
| `gta-silent.mp4` | 1 · GTA | 15 s | same | spare (X, no voice) |
| `loop-voiced.mp4` | 2 · The loop | 22 s | This website does whatever you ask it to. | **X launch post (Wed 9 AM ET)**, Shorts |
| `loop-silent-vertical.mp4` | 2 · The loop | 20 s | same | TikTok #2 (Wed), Reels |
| `loop-silent.mp4` | 2 · The loop | 20 s | same | spare |
| `timelapse-voiced.mp4` | 3 · Timelapse | 14 s | Every change anyone ever made, in ten seconds. | X thread post 2 |
| `timelapse-silent-vertical.mp4` | 3 · Timelapse | 14 s | same | TikTok #3 (Thu) |
| `timelapse-silent.mp4` | 3 · Timelapse | 14 s | same | spare |
| `rules-voiced.mp4` | 4 · Rules | 50 s | So why isn't it a mess? | X thread post 3 (the one HN watches) |
| `rules-silent-vertical.mp4` | 4 · Rules | 50 s | same | TikTok #4 (Fri) |
| `rules-silent.mp4` | 4 · Rules | 50 s | same | spare |
| `phone-voiced.mp4` | 5 · Phone | 12 s | It works on your phone. | TikTok #5 (Sat), X repost |
| `phone-silent.mp4` | 5 · Phone | 6 s | same | spare |

What each one actually shows (from `docs/launch/clips/raw/marks.json`):

1. **GTA** — the `/c/` share page of @rushil's ask gliding to the game and ringing it; the game tapped and driven with the arrow keys; then the Changes ledger with the cents on every row.
2. **The loop** — the wall, the chord-click on the thank-you block, the ask typed live ("Make this thank everyone who changed something this week, in one warm line."), Send, "Judging…", "Approved. Building now."; a "2 minutes later" card; the `/c/` page of that same ask now live and ringed; its ledger row; the real GitHub commit. The change is on the wall: "Updated the thanks message to warmly acknowledge everyone who changed the wall this week."
3. **Timelapse** — `/timelapse`, play, the whole run.
4. **Rules** — `/rules` scrolled; a promo ask ("Add a link to my startup…") typed and refused; the vote board.
5. **Phone** — the first-visit card on a phone, two swipes, a long-press for the object sheet, Move.

Not in the cut: `phone-change.webm` (the composer didn't open on the phone tap in the recording; the phone clip stands without it), `desktop-landing.webm` (recorded, unused; the first-visit card at 1920×1080 is there if a clip wants it).

Clip 6 ("things fade") was optional and is not recorded: nothing has faded yet.
