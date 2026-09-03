import { Prose } from "./Prose";

const wall = [
  "Make it better for everyone. A change should be something a stranger is glad to find.",
  "Build on, don't bulldoze. Removing someone's work needs a reason a fair person would accept.",
  "No ads, promotion, or links out. Patrons pay for that. Links inside the wall go through the kit and an allowlist.",
  "No personal data, tracking, or off-site calls. Nothing collects or sends anything about visitors.",
  "Do what was asked and nothing hidden.",
  "Works on a phone or it doesn't ship.",
  "Nothing hateful, harassing, sexual, or illegal. No real people as targets.",
  "The machinery (header, feed, judge, pipeline, patron board, accounts) is off limits. Asking to change it goes to a human.",
  "One thing at a time. Small and clear beats big and vague.",
];

const patron = [
  "One slot a day. The highest bid at midnight Eastern Time gets the header for the next 24 hours: name, logo, link.",
  "A bid is a hold on your card, not a charge. Only the winner is charged, when the auction closes. Every other hold is released.",
  "Minimum bid $5, whole dollars. To lead, beat the high bid by at least $1. Ties go to the earlier bid.",
  "Bids stand until close. Raise your own bid any time; the old hold is released when the new one lands.",
  "Everyone who bid stays on the board for that day, winner on top, with their logo.",
  "No refunds once you've won. Half of every winning bid funds that day's AI budget.",
  "Links open through a counted redirect, so your clicks show on the leaderboard. No trackers.",
  "Products and people only. Nothing illegal, adult, hateful, or misleading. Those are removed without discussion.",
];

export function RulesPage() {
  return (
    <Prose title="Rules" intro="Two sets. One for the wall, one for the patron board. Both short on purpose.">
      <h2>The wall</h2>
      <ol className="flex flex-col gap-3">
        {wall.map((r, i) => (
          <li key={r} className="flex gap-3">
            <span className="placard num w-6 shrink-0 pt-1.5">{String(i + 1).padStart(2, "0")}</span>
            <span>{r}</span>
          </li>
        ))}
      </ol>
      <h2>Patron of the day</h2>
      <ol className="flex flex-col gap-3">
        {patron.map((r, i) => (
          <li key={r} className="flex gap-3">
            <span className="placard num w-6 shrink-0 pt-1.5">{String(i + 1).padStart(2, "0")}</span>
            <span>{r}</span>
          </li>
        ))}
      </ol>
    </Prose>
  );
}
