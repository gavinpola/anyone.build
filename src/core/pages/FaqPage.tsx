import { Prose } from "./Prose";

const faq: Array<[string, string]> = [
  ["What is this?", "A website anyone can change. Point at something, say what should change, and if it's good for everyone, an agent writes the code and it ships. The wall started empty."],
  ["How do I change something?", "Hold ⇧⌘ (⇧Ctrl on Windows) and click anything on the wall, or the empty wall itself. Say what should change."],
  ["Do I need an account?", "No. Sign in with GitHub if you want your changes counted under your name; you can claim earlier ones later."],
  ["Who decides what ships?", "A gatekeeper model judges the request against the rules; a second model argues against it; a third reads the code it produced. Anything unclear goes to a human. All of it is open source."],
  ["Why was mine rejected?", "You'll see a short reason. The usual ones: it was promotion, it erased someone's work, it asked for something the wall can't safely run, or it wasn't clear what should change."],
  ["How long does it take?", "Judged in about a second. Built, checked, and live in a couple of minutes. You can watch it in Live."],
  ["Do I get credit?", "Every change is a real commit with your name on it, and it counts on the leaderboard."],
  ["What does the patron get?", "The top of every page for one day (Eastern Time): name, logo, and a link, with clicks counted on the leaderboard."],
  ["When is my card charged?", "Only if you win, at midnight Eastern Time. Until then it's a hold, which shows as pending and disappears within a few days if you don't win."],
  ["What if someone outbids me?", "You get an email with the new high bid and one link to take it back. Nothing is charged."],
  ["Can I cancel a bid?", "No. A bid stands until the auction closes."],
  ["What if the winner's card fails?", "The next highest bid wins."],
  ["Where does the money go?", "Half of each winning bid tops up that day's public AI budget, which is what turns requests into code. The rest keeps the lights on."],
  ["What does a change cost you?", "A few cents. Cheap, fast models do the judging and the coding; the expensive part is the sandbox, and that's cents too."],
  ["Can I run this myself?", "Yes. It's MIT licensed and runs locally with no accounts. See the README."],
];

export function FaqPage() {
  return (
    <Prose title="FAQ">
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
