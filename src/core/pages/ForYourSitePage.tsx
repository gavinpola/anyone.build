import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";

const tiers: Array<{ n: string; name: string; state: string; body: string }> = [
  {
    n: "01",
    name: "Notes",
    state: "Available now · free",
    body: "Visitors hold ⇧⌘ and click anything (on a phone, tap Ask), then say it. It lands in your inbox with the page, the element, and a one-line label: bug, copy, design, feature.",
  },
  {
    n: "02",
    name: "Drafts",
    state: "Invite-only",
    body: "A judge with your rules filters the noise. An agent writes the change in a locked sandbox and opens a pull request on your repo. You merge.",
  },
  {
    n: "03",
    name: "Ships",
    state: "Invite-only",
    body: "Your CI is the gate. Approved changes merge and deploy on their own, the way this site does.",
  },
];

const snippet = `<script src="https://anyone.build/ask.js" data-site="site_…" defer></script>`;

/** The one page that sells. Everything on it is true today. */
export function ForYourSitePage() {
  return (
    <article className="mx-auto max-w-[760px] px-4 py-12 sm:px-6">
      <p className="placard smallcaps">For your site</p>
      <h1 className="mt-2 font-display text-4xl leading-[1.05] sm:text-5xl">Your visitors point at things. You get the fix.</h1>
      <p className="mt-5 max-w-[600px] text-[17px] leading-relaxed text-ink-2">
        The wall you just used is the demo. Put the same point-and-ask on your own site, and decide how far it goes: a note in your inbox, a pull
        request you merge, or a change that ships itself.
      </p>
      <div className="mt-7 flex flex-wrap items-center gap-3">
        <Link to="/sites" className="inline-flex items-center gap-1.5 rounded-md bg-ink px-4 py-2 text-[15px] font-medium text-paper hover:opacity-90">
          Add your site <ArrowRight size={16} />
        </Link>
        <span className="text-[14px] text-muted">One script tag. No account for your visitors.</span>
      </div>

      <section className="mt-14">
        <p className="placard smallcaps">How far it goes</p>
        <ol className="mt-3 divide-y divide-line border-y border-line">
          {tiers.map((t) => (
            <li key={t.n} className="grid gap-1 py-5 sm:grid-cols-[3rem_1fr] sm:gap-4">
              <span className="placard pt-1">{t.n}</span>
              <div>
                <div className="flex flex-wrap items-baseline gap-x-3">
                  <h2 className="font-display text-2xl">{t.name}</h2>
                  <span className="placard">{t.state}</span>
                </div>
                <p className="mt-1.5 max-w-[560px] text-[15px] leading-relaxed text-ink-2">{t.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="mt-14">
        <p className="placard smallcaps">The whole install</p>
        <pre className="mt-3 overflow-x-auto rounded-md border border-line bg-paper-2 p-4 font-mono text-[13px] leading-relaxed text-ink">
          <code>{snippet}</code>
        </pre>
        <p className="mt-3 max-w-[600px] text-[15px] leading-relaxed text-ink-2">
          Styles live in a shadow root, so it can't touch your page. It sets no cookies, tracks nobody, and sends one small message per note: the
          page, the element, and what the visitor wrote.
        </p>
      </section>

      <section className="mt-14">
        <p className="placard smallcaps">What we'd need from you</p>
        <dl className="mt-3 grid gap-4 text-[15px] leading-relaxed">
          <div>
            <dt className="font-medium">For Notes</dt>
            <dd className="text-ink-2">The script tag. That's it.</dd>
          </div>
          <div>
            <dt className="font-medium">For Drafts and Ships</dt>
            <dd className="text-ink-2">
              Install our GitHub App on the one repo behind the site. It can open pull requests; it can't push to your default branch. The agent
              works in a sandbox with no network except the model, and your code never leaves it except as the diff you review. The judge's rules
              are public, <a href="https://github.com/gavinpola/anyone.build/blob/main/docs/CONSTITUTION.md" target="_blank" rel="noopener noreferrer" className="text-accent hover:underline underline-offset-2">here</a>, and yours get appended.
            </dd>
          </div>
        </dl>
      </section>

      <section className="mt-14">
        <p className="placard smallcaps">Pricing</p>
        <dl className="mt-3 divide-y divide-line border-y border-line text-[15px]">
          <div className="grid grid-cols-[6rem_1fr] gap-4 py-3">
            <dt className="font-medium">Notes</dt>
            <dd className="text-ink-2">Free. Up to 10 sites, 300 notes a day each.</dd>
          </div>
          <div className="grid grid-cols-[6rem_1fr] gap-4 py-3">
            <dt className="font-medium">Drafts</dt>
            <dd className="text-ink-2">$29 a month. 40 pull requests included, then $0.75 each.</dd>
          </div>
          <div className="grid grid-cols-[6rem_1fr] gap-4 py-3">
            <dt className="font-medium">Ships</dt>
            <dd className="text-ink-2">$99 a month. 200 pull requests included, then $0.50 each. Internal-only mode, so only your team can ask.</dd>
          </div>
        </dl>
        <p className="mt-4 max-w-[600px] text-[15px] leading-relaxed text-ink-2">
          Model costs ride on the same cheap, fast models this site runs on, and a change here costs a few cents. While this is an experiment,
          Drafts and Ships open one site at a time.{" "}
          <a
            href="https://github.com/gavinpola/anyone.build/issues/new?title=Invite%3A%20Drafts%20for%20my%20site&body=Site%3A%20%0ARepo%3A%20%0AWhat%20visitors%20would%20change%3A%20"
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent hover:underline underline-offset-2"
          >
            Ask for an invite.
          </a>
        </p>
      </section>

      <section className="mt-14 border-t border-line pt-8">
        <p className="max-w-[600px] text-[15px] leading-relaxed text-ink-2">
          Why this exists: the loop on the wall works because strangers can point at the thing instead of describing it. Your users are
          strangers to your codebase too.
        </p>
        <p className="mt-4">
          <Link to="/sites" className="inline-flex items-center gap-1.5 text-[15px] font-medium text-accent hover:underline underline-offset-2">
            Add your site <ArrowRight size={15} />
          </Link>
        </p>
      </section>
    </article>
  );
}
