import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { cn } from "@/core/lib/cn";

const ISSUE = "https://github.com/gavinpola/anyone.build/issues/new";
const inviteHref = (plan: string) =>
  `${ISSUE}?title=${encodeURIComponent(`Invite: ${plan} for my site`)}&body=${encodeURIComponent("Site: \nRepo: \nWhat visitors would change: \n")}`;
const talkHref = `${ISSUE}?title=${encodeURIComponent("Enterprise: let's talk")}&body=${encodeURIComponent("Company: \nSites: \nWhat you need: \n")}`;

const gets: Array<[string, string]> = [
  ["A feedback inbox that sorts itself", "Every note arrives with the page, the element, and a label: bug, copy, design, feature, question, spam."],
  ["A judge with your rules", "The public constitution decides what's good for everyone; your addendum decides what's good for you."],
  ["Pull requests, drafted", "An agent writes the change in a locked sandbox and opens a pull request on your repo. You merge."],
  ["Ship on green", "Your CI is the gate. Approved changes merge and deploy on their own, the way this site does."],
  ["Internal-only mode", "Only your team can ask. Visitors never see the widget, and nothing shows up on your pages."],
  ["Your code stays yours", "One repo, pull requests only, never a push to your default branch, and nothing kept but the diff you review."],
];

type Plan = { name: string; price: string; per?: string; state?: string; points: string[]; cta: { label: string; to?: string; href?: string }; featured?: boolean };
const plans: Plan[] = [
  {
    name: "Notes",
    price: "Free",
    points: ["Up to 10 sites", "300 notes a day, each", "AI triage and the inbox", "No account for your visitors"],
    cta: { label: "Add your site", to: "/sites" },
  },
  {
    name: "Drafts",
    price: "$29",
    per: "a month",
    state: "Invite-only",
    points: ["Everything in Notes", "40 pull requests a month, then $0.75 each", "Your rules on top of the judge's", "One repo per site"],
    cta: { label: "Ask for an invite", href: inviteHref("Drafts") },
    featured: true,
  },
  {
    name: "Ships",
    price: "$99",
    per: "a month",
    state: "Invite-only",
    points: ["Everything in Drafts", "200 pull requests a month, then $0.50 each", "Merge and deploy on green", "Internal-only mode", "Daily digest to your inbox"],
    cta: { label: "Ask for an invite", href: inviteHref("Ships") },
  },
  {
    name: "Enterprise",
    price: "Custom",
    points: ["Unlimited sites and pull requests", "SSO and an audit log", "Your own model keys, or a private runner", "Custom judge rules and review flow", "SLA and priority support"],
    cta: { label: "Talk to us", href: talkHref },
  },
];

const steps: Array<[string, string]> = [
  ["Point", "A visitor holds ⇧⌘ (or taps Ask on a phone), clicks the thing, and says what should change."],
  ["Judge", "A judge reads it against the rules and yours. Not worth doing? It says why. Worth doing? It plans the change."],
  ["Draft", "An agent builds it in a sandbox with no network but the model, runs your checks, and opens a pull request."],
  ["Ship", "You merge, or on Ships your CI merges for you. Either way it deploys with the rest of your site."],
];

const snippet = `<script src="https://anyone.build/ask.js" data-site="site_…" defer></script>`;

/** The one page that sells. Everything on it is true today or labeled invite-only. */
export function ForYourSitePage() {
  return (
    <article className="mx-auto max-w-[960px] px-4 py-12 sm:px-6">
      <div className="max-w-[720px]">
        <p className="placard smallcaps">For your site</p>
        <h1 className="mt-2 font-display text-4xl leading-[1.05] sm:text-5xl">Your visitors point at things. You ship the fix.</h1>
        <p className="mt-5 text-[17px] leading-relaxed text-ink-2">
          anyone.build for your site turns what people say on your pages into changes you control: a triaged inbox, a judge with your rules,
          pull requests drafted by an agent, and, when you want it, changes that ship themselves. The wall you just used runs on the same loop
          with nobody in it.
        </p>
        <div className="mt-7 flex flex-wrap items-center gap-3">
          <Link to="/sites" className="inline-flex items-center gap-1.5 rounded-md bg-ink px-4 py-2 text-[15px] font-medium text-paper hover:opacity-90">
            Add your site <ArrowRight size={16} />
          </Link>
          <span className="text-[14px] text-muted">Free to start. Setup is a minute; your visitors need no account.</span>
        </div>
      </div>

      <section className="mt-16">
        <p className="placard smallcaps">What you get</p>
        <dl className="mt-4 grid gap-x-8 gap-y-6 sm:grid-cols-2">
          {gets.map(([t, d]) => (
            <div key={t}>
              <dt className="text-[16px] font-semibold">{t}</dt>
              <dd className="mt-1 text-[15px] leading-relaxed text-ink-2">{d}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="mt-16">
        <p className="placard smallcaps">Plans</p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {plans.map((p) => (
            <div key={p.name} className={cn("flex flex-col rounded-[var(--radius-frame)] border p-5", p.featured ? "border-ink" : "border-line")}>
              <div className="flex items-baseline justify-between gap-2">
                <h2 className="font-display text-2xl">{p.name}</h2>
                {p.state ? <span className="placard">{p.state}</span> : null}
              </div>
              <p className="mt-3">
                <span className="font-display text-3xl">{p.price}</span>
                {p.per ? <span className="ml-1.5 text-[13px] text-muted">{p.per}</span> : null}
              </p>
              <ul className="mt-4 flex flex-1 flex-col gap-1.5 text-[14px] leading-relaxed text-ink-2">
                {p.points.map((pt) => (
                  <li key={pt} className="border-t border-line pt-1.5 first:border-t-0 first:pt-0">
                    {pt}
                  </li>
                ))}
              </ul>
              {p.cta.to ? (
                <Link to={p.cta.to} className={cn("mt-5 inline-flex items-center justify-center gap-1.5 rounded-md px-3 py-2 text-[14px] font-medium", p.featured ? "bg-ink text-paper hover:opacity-90" : "border border-line hover:bg-paper-2")}>
                  {p.cta.label} <ArrowRight size={14} />
                </Link>
              ) : (
                <a
                  href={p.cta.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cn("mt-5 inline-flex items-center justify-center gap-1.5 rounded-md px-3 py-2 text-[14px] font-medium", p.featured ? "bg-ink text-paper hover:opacity-90" : "border border-line hover:bg-paper-2")}
                >
                  {p.cta.label} <ArrowRight size={14} />
                </a>
              )}
            </div>
          ))}
        </div>
        <p className="mt-4 max-w-[720px] text-[14px] leading-relaxed text-muted">
          Model costs ride on the same cheap, fast models this site runs on; a change here costs a few cents. Drafts and Ships open one site at
          a time while this is an experiment. Prices are per workspace, not per seat.
        </p>
      </section>

      <section className="mt-16">
        <p className="placard smallcaps">How it works</p>
        <ol className="mt-4 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map(([t, d], i) => (
            <li key={t}>
              <span className="placard">{String(i + 1).padStart(2, "0")}</span>
              <p className="mt-1 text-[16px] font-semibold">{t}</p>
              <p className="mt-1 text-[14px] leading-relaxed text-ink-2">{d}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="mt-16 max-w-[720px]">
        <p className="placard smallcaps">Setup takes a minute</p>
        <pre className="mt-3 overflow-x-auto rounded-md border border-line bg-paper-2 p-4 font-mono text-[13px] leading-relaxed text-ink">
          <code>{snippet}</code>
        </pre>
        <p className="mt-3 text-[15px] leading-relaxed text-ink-2">
          One tag, from your dashboard. Styles live in a shadow root so it can't touch your page; it sets no cookies, tracks nobody, and sends
          one small message per note. For Drafts and Ships you also install our GitHub App on the one repo behind the site. The judge's rules
          are public,{" "}
          <a href="https://github.com/gavinpola/anyone.build/blob/main/docs/CONSTITUTION.md" target="_blank" rel="noopener noreferrer" className="text-accent hover:underline underline-offset-2">
            here
          </a>
          , and yours get appended.
        </p>
      </section>

      <section className="mt-16 max-w-[720px] border-t border-line pt-8">
        <p className="text-[15px] leading-relaxed text-ink-2">
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
