// Prints the launch checklist with the exact commands, and a one-click GitHub App manifest URL.
const org = process.env.GH_ORG ?? "anyone-build";
const repo = process.env.GH_REPO ?? "everyones.lol";
const convexSite = process.env.CONVEX_SITE_URL ?? "https://<deployment>.convex.site";
const manifest = {
  name: "everyones.lol",
  url: "https://everyones.lol",
  hook_attributes: { url: `${convexSite}/webhooks/github` },
  redirect_url: "https://everyones.lol",
  public: false,
  default_permissions: { contents: "write", pull_requests: "write", checks: "read", deployments: "read", metadata: "read", statuses: "read" },
  default_events: ["check_suite", "check_run", "pull_request", "deployment_status", "status"],
};
console.log(`
everyones.lol — launch checklist
================================
You (accounts, money):
  1. Buy everyones.lol (Porkbun). Point it at Vercel.
  2. Create the GitHub org "${org}" and push this repo to ${org}/${repo}.
  3. Vercel: Pro plan; import the repo; add env VITE_CONVEX_URL, VITE_CONVEX_SITE_URL, VITE_SITE_URL.
  4. Convex: npx convex login; npx convex dev --configure new (cloud); later: Pro before launch.
  5. OpenRouter: create key, add $10.   → npx convex env set OPENROUTER_API_KEY sk-or-...
  6. GitHub App: open this URL, click Create, install on the repo, note App ID / Installation ID / private key:
     https://github.com/organizations/${org}/settings/apps/new?state=anyone&manifest=${encodeURIComponent(JSON.stringify(manifest))}
  7. GitHub OAuth app (login): callback ${convexSite}/api/auth/callback/github
  8. Stripe: STRIPE_SECRET_KEY, then a webhook endpoint ${convexSite}/webhooks/stripe for checkout.session.completed, checkout.session.expired, payment_intent.canceled → STRIPE_WEBHOOK_SECRET
  9. Vercel webhook (deployment.succeeded) → ${convexSite}/webhooks/vercel, VERCEL_WEBHOOK_SECRET
 10. Repo settings: rulesets on main (PR + checks + smoke required), squash merges, auto-delete branches, secret scanning on, labels playground/revert.

Then: npx convex env set EXECUTOR sandbox; node scripts/refresh-snapshot.mjs; npx convex env set SANDBOX_SNAPSHOT_ID ...
`);
