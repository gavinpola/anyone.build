import { useState, type FormEvent } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation } from "convex/react";
import { Check, Copy, ExternalLink } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { hasConvex, useQuerySafe } from "@/core/lib/providers";
import { useViewer } from "@/core/auth/useViewer";
import { friendlyError } from "@/core/lib/errors";
import { cn } from "@/core/lib/cn";

const convexSite = (import.meta.env.VITE_CONVEX_SITE_URL as string | undefined) ?? "";
const apiUrl = convexSite ? `${convexSite}/ask/note` : "";

type Status = "new" | "done" | "dismissed";
const FILTERS: Array<{ id: Status | "all"; label: string }> = [
  { id: "new", label: "Open" },
  { id: "done", label: "Done" },
  { id: "dismissed", label: "Dismissed" },
  { id: "all", label: "All" },
];

const KIND_LABEL: Record<string, string> = { bug: "Bug", copy: "Copy", design: "Design", feature: "Feature", question: "Question", spam: "Spam" };

function ago(ts: number): string {
  const s = Math.max(0, Math.round((Date.now() - ts) / 1000));
  if (s < 60) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 48) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

function snippetFor(key: string): string {
  const origin = typeof window === "undefined" ? "https://everyones.lol" : window.location.origin;
  return `<script src="${origin}/ask.js" data-site="${key}"${apiUrl ? ` data-api="${apiUrl}"` : ""} defer></script>`;
}

const btn = "rounded-md border border-line bg-paper px-2.5 py-1 text-[13px] font-medium hover:bg-paper-2 disabled:opacity-50";
const primary = "rounded-md bg-ink px-3 py-1.5 text-[14px] font-medium text-paper hover:opacity-90 disabled:opacity-50";

/** Owner dashboard for "For your site": sites, their snippet, and the notes visitors leave. */
export function SitesPage() {
  const viewer = useViewer();
  return (
    <article className="mx-auto max-w-[960px] px-4 py-12 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="placard smallcaps">For your site</p>
          <h1 className="mt-1 font-display text-4xl">Your sites</h1>
        </div>
        <Link to="/for-your-site" className="text-[14px] text-accent hover:underline underline-offset-2">
          How this works
        </Link>
      </div>
      {!hasConvex ? (
        <p className="mt-8 rounded-md bg-paper-2 p-4 text-[15px] text-ink-2">The dashboard needs the backend. Run it with Convex to add sites.</p>
      ) : viewer.loading ? (
        <p className="mt-8 text-[15px] text-muted">One moment.</p>
      ) : !viewer.signedIn ? (
        <div className="mt-8 rounded-md border border-line p-5">
          <p className="text-[15px] text-ink-2">Sign in with GitHub to add a site. Your visitors never have to.</p>
          <button type="button" onClick={viewer.signIn} className={cn(primary, "mt-3")}>
            Sign in with GitHub
          </button>
        </div>
      ) : (
        <Dashboard />
      )}
    </article>
  );
}

function Dashboard() {
  const sites = useQuerySafe(api.sites.mine, {});
  const [selected, setSelected] = useState<Id<"sites"> | null>(null);
  const current = sites?.find((s) => s.id === selected) ?? sites?.[0] ?? null;
  return (
    <div className="mt-8 grid gap-8 md:grid-cols-[300px_1fr]">
      <div className="flex flex-col gap-4">
        <NewSite onCreated={(id) => setSelected(id)} />
        {sites === undefined ? (
          <p className="text-[14px] text-muted">Loading…</p>
        ) : sites.length === 0 ? (
          <p className="text-[14px] text-muted">No sites yet. Add one above; the snippet appears here.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {sites.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => setSelected(s.id)}
                  className={cn(
                    "w-full rounded-md border px-3 py-2 text-left hover:bg-paper-2",
                    current?.id === s.id ? "border-ink" : "border-line",
                  )}
                >
                  <span className="block truncate text-[15px] font-medium">{s.name}</span>
                  <span className="block truncate text-[13px] text-muted">{s.origin}</span>
                  <span className="mt-1 block text-[12px] text-ink-2 tabular-nums">
                    {s.open} open · {s.notes} total
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="min-w-0">{current ? <SiteDetail site={current} onRemoved={() => setSelected(null)} /> : null}</div>
    </div>
  );
}

function NewSite({ onCreated }: { onCreated: (id: Id<"sites">) => void }) {
  const create = useMutation(api.sites.create);
  const [name, setName] = useState("");
  const [origin, setOrigin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const r = await create({ name, origin });
      onCreated(r.id);
      setName("");
      setOrigin("");
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={submit} className="rounded-md border border-line p-3">
      <p className="placard smallcaps">Add a site</p>
      <label className="mt-2 block text-[13px] text-ink-2">
        Name
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          maxLength={60}
          placeholder="Acme"
          className="mt-1 w-full rounded-md border border-line bg-paper px-2.5 py-1.5 text-[14px] text-ink outline-none focus:border-ink"
        />
      </label>
      <label className="mt-2 block text-[13px] text-ink-2">
        Origin
        <input
          value={origin}
          onChange={(e) => setOrigin(e.target.value)}
          required
          inputMode="url"
          placeholder="https://acme.com"
          className="mt-1 w-full rounded-md border border-line bg-paper px-2.5 py-1.5 font-mono text-[13px] text-ink outline-none focus:border-ink"
        />
      </label>
      {error ? (
        <p role="alert" className="mt-2 text-[13px] text-bad">
          {error}
        </p>
      ) : null}
      <button type="submit" disabled={busy} className={cn(primary, "mt-3 w-full")}>
        {busy ? "Adding…" : "Add site"}
      </button>
    </form>
  );
}

type Site = NonNullable<ReturnType<typeof useQuerySafe<typeof api.sites.mine>>>[number];

function SiteDetail({ site, onRemoved }: { site: Site; onRemoved: () => void }) {
  const remove = useMutation(api.sites.remove);
  const [filter, setFilter] = useState<Status | "all">("new");
  const [copied, setCopied] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const notes = useQuerySafe(api.sites.notes, { siteId: site.id, status: filter === "all" ? undefined : filter });
  const snippet = snippetFor(site.key);
  const demo = `/ask-demo.html?site=${site.key}${apiUrl ? `&api=${encodeURIComponent(apiUrl)}` : ""}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(snippet);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked; the snippet is selectable */
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-display text-2xl">{site.name}</h2>
        <a href={site.origin} target="_blank" rel="noopener noreferrer" className="text-[13px] text-muted hover:underline">
          {site.origin}
        </a>
      </div>

      <div className="mt-4 rounded-md border border-line bg-paper-2 p-3" data-site-key={site.key}>
        <div className="flex items-center justify-between gap-2">
          <p className="placard smallcaps">Paste before &lt;/body&gt;</p>
          <div className="flex items-center gap-2">
            <a href={demo} target="_blank" rel="noopener noreferrer" className={cn(btn, "inline-flex items-center gap-1")}>
              Try it <ExternalLink size={12} />
            </a>
            <button type="button" onClick={copy} className={cn(btn, "inline-flex items-center gap-1")}>
              {copied ? <Check size={12} /> : <Copy size={12} />} {copied ? "Copied" : "Copy"}
            </button>
          </div>
        </div>
        <pre className="mt-2 overflow-x-auto whitespace-pre-wrap break-all font-mono text-[12px] leading-relaxed text-ink">
          <code>{snippet}</code>
        </pre>
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-2">
        <div role="tablist" className="flex gap-1">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              role="tab"
              aria-selected={filter === f.id}
              onClick={() => setFilter(f.id)}
              className={cn("rounded-md px-2.5 py-1 text-[13px]", filter === f.id ? "bg-ink text-paper" : "text-ink-2 hover:bg-paper-2")}
            >
              {f.label}
            </button>
          ))}
        </div>
        {confirm ? (
          <span className="flex items-center gap-2 text-[13px]">
            Delete this site and its notes?
            <button
              type="button"
              className={cn(btn, "border-bad text-bad")}
              onClick={() => {
                void remove({ siteId: site.id }).then(onRemoved);
              }}
            >
              Yes, delete
            </button>
            <button type="button" className={btn} onClick={() => setConfirm(false)}>
              Keep
            </button>
          </span>
        ) : (
          <button type="button" className="text-[13px] text-muted hover:text-bad" onClick={() => setConfirm(true)}>
            Delete site
          </button>
        )}
      </div>

      <ul className="mt-3 divide-y divide-line border-y border-line">
        {notes === undefined ? (
          <li className="py-6 text-[14px] text-muted">Loading…</li>
        ) : notes.length === 0 ? (
          <li className="py-6 text-[14px] text-muted">
            {filter === "new" ? "Nothing open. When a visitor points at something, it shows up here." : "Nothing here."}
          </li>
        ) : (
          notes.map((n) => <NoteRow key={n.id} n={n} />)
        )}
      </ul>
    </div>
  );
}

type Note = NonNullable<ReturnType<typeof useQuerySafe<typeof api.sites.notes>>>[number];

function NoteRow({ n }: { n: Note }) {
  const setStatus = useMutation(api.sites.setNoteStatus);
  const kind = n.triage ? (KIND_LABEL[n.triage.kind] ?? n.triage.kind) : null;
  return (
    <li className="py-4" data-note-status={n.status}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          {n.triage ? (
            <p className="text-[14px] font-medium">
              <span className={cn("placard mr-2", n.triage.kind === "spam" ? "text-bad" : "")}>{kind}</span>
              {n.triage.summary}
            </p>
          ) : null}
          <p className={cn("whitespace-pre-wrap text-[15px]", n.triage ? "mt-1 text-ink-2" : "font-medium")}>{n.note}</p>
          <p className="mt-1.5 truncate text-[12px] text-muted">
            <span className="font-mono">{n.path}</span>
            {n.elementText ? <span> · “{n.elementText.slice(0, 80)}”</span> : null}
            <span> · {ago(n.createdAt)}</span>
            {n.viewport ? <span> · {n.viewport}</span> : null}
          </p>
        </div>
        <div className="flex shrink-0 gap-1.5">
          {n.status === "new" ? (
            <>
              <button type="button" className={btn} onClick={() => void setStatus({ noteId: n.id, status: "done" })}>
                Done
              </button>
              <button type="button" className={btn} onClick={() => void setStatus({ noteId: n.id, status: "dismissed" })}>
                Dismiss
              </button>
            </>
          ) : (
            <button type="button" className={btn} onClick={() => void setStatus({ noteId: n.id, status: "new" })}>
              Reopen
            </button>
          )}
        </div>
      </div>
    </li>
  );
}
