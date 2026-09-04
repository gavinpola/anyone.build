import { Prose } from "./Prose";
import { CONSTITUTION_RULES, CONSTITUTION_VERSION } from "@/core/lib/constitution.gen";

// The wall's rules are the constitution the judge enforces, verbatim (generated; see scripts/sync-constitution.mjs).
const wall = CONSTITUTION_RULES;


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
      <h2>The wall <span className="placard ml-2 align-middle">constitution v{CONSTITUTION_VERSION}</span></h2>
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
