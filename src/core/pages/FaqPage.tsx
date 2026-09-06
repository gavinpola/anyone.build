import { Link } from "@tanstack/react-router";
import { ArrowUpRight } from "lucide-react";
import { Prose } from "./Prose";

const REPO = "https://github.com/gavinpola/anyone.build";

const faq: Array<[string, string]> = [
  ["What is this?", "A website anyone can change. Point at something, say what should change, and if it's good for everyone, an agent writes the code and it ships. The wall started empty."],
  ["How do I change something?", "Tap an object's label for Change and Move, or press Change something and tap anything. On a laptop, hold ⇧⌘ (⇧Ctrl on Windows) and click anything, or drag out tiles to work on a space. Say what should change."],
  ["How do I move around?", "The wall is a world of tiles at 100%: there is no zoom. Drag the ground, swipe, scroll, or use the arrow keys. The map in the corner teleports; tap a tile to go there."],
  ["How do games get my keyboard?", "Tap the game. The object you last tapped has the keys: the arrows steer it instead of walking the world, and the label says so. Tap the ground or press Escape to walk again."],
  ["Do I need an account?", "No. Sign in with GitHub if you want your changes counted under your name; you can claim earlier ones later."],
  ["Who decides what ships?", "A gatekeeper model judges the request against the rules; a second model argues against it; a third reads the code it produced. Anything big goes up for a vote; anything loose is read generously; anything that isn't for everyone gets one honest line saying why. There is no human queue. All of it is open source."],
  ["Why was mine rejected?", "You'll see a short reason. The usual ones: it was promotion, it erased someone's work, it asked for something the wall can't safely run, or it wasn't clear what should change."],
  ["How long does it take?", "Judged in about a second. Built, checked, and live in a couple of minutes. You can watch it in Live."],
  ["Do I get credit?", "Every change is a real commit with your name on it, and it counts on the leaderboard."],
  ["Something is wrong with the site itself?", "The wall changes itself; the site around it (the header, the map, the composer) is ours. Leave feedback: everyone can vote on it, and when a maintainer approves one it becomes a job for the coding agent, which opens a pull request."],
  ["What does the patron get?", "The top of every page for one day (Eastern Time): name, logo, and a link, with clicks counted on the leaderboard."],
  ["When is my card charged?", "Only if you win, at midnight Eastern Time. Until then it's a hold, which shows as pending and disappears within a few days if you don't win."],
  ["What if someone outbids me?", "You get an email with the new high bid and one link to take it back. Nothing is charged."],
  ["Can I cancel a bid?", "No. A bid stands until the auction closes."],
  ["What if the winner's card fails?", "The next highest bid wins."],
  ["Where does the money go?", "Half of each winning bid tops up that day's public AI budget, which is what turns requests into code. The rest keeps the lights on."],
  ["What does a change cost you?", "A few cents. Cheap, fast models do the judging and the coding; the expensive part is the sandbox, and that's cents too."],
  ["Can I run this myself?", "Yes. It's MIT licensed and runs locally with no accounts. See the README."],
  [
    "Can I put this on my own site?",
    "Yes. One script tag gives your visitors the same point-and-ask; notes land in your inbox. Pull requests on your repo are invite-only for now. See For your site.",
  ],
];

const more: Array<{ to?: string; hash?: string; href?: string; label: string }> = [
  { to: "/rules", label: "All the rules" },
  { to: "/leaderboard", label: "The vote board and the leaderboard" },
  { to: "/leaderboard", hash: "feedback", label: "Feedback on the site, and the votes on it" },
  { href: REPO, label: "The source, judge and all" },
  { to: "/for-your-site", label: "For your own site, it's one script tag" },
];

/** More: where the "?" sends you. The links first, then the questions people ask. */
export function FaqPage() {
  const go = "group flex items-center justify-between border-t border-line py-3 text-[15px] text-ink hover:text-accent";
  return (
    <Prose title="More" intro="Point, ask, watch it ship. Everything past those three lines is here.">
      <nav aria-label="Go deeper" data-more-links>
        {more.map((m) =>
          m.to ? (
            <Link key={m.label} to={m.to} hash={m.hash} className={go}>
              <span>{m.label}</span>
              <ArrowUpRight size={15} className="text-muted group-hover:text-accent" />
            </Link>
          ) : (
            <a key={m.label} href={m.href} target="_blank" rel="noopener noreferrer" className={go}>
              <span>{m.label}</span>
              <ArrowUpRight size={15} className="text-muted group-hover:text-accent" />
            </a>
          ),
        )}
        <div className="border-t border-line" />
      </nav>
      <h2>Questions people ask</h2>
      <dl className="flex flex-col gap-5">
        {faq.map(([q, a]) => (
          <div key={q}>
            <dt className="font-semibold text-ink">{q}</dt>
            <dd className="mt-1">{a}</dd>
          </div>
        ))}
      </dl>
    </Prose>
  );
}
