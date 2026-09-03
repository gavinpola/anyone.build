import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { hasConvex } from "@/core/lib/providers";
import { useViewer } from "@/core/auth/useViewer";
import { timeAgo } from "@/core/lib/useNow";
import { Avatar } from "@/core/feed/RequestCard";

/** Maintainers only. The queue of things the machine wouldn't decide alone, and the levers. */
export function AdminPage() {
  const viewer = useViewer();
  if (!viewer.signedIn || viewer.trust < 3) {
    return (
      <div className="mx-auto max-w-xl px-6 py-24 text-center">
        <p className="placard smallcaps">admin</p>
        <h1 className="mt-2 font-display text-4xl">Maintainers only.</h1>
      </div>
    );
  }
  return (
    <div className="mx-auto flex max-w-[1100px] flex-col gap-10 px-4 py-8 sm:px-6">
      <NeedsHuman />
      <Flagged />
      <Config />
    </div>
  );
}

function NeedsHuman() {
  const rows = useQuery(api.admin.needsHuman, hasConvex ? {} : "skip");
  const decide = useMutation(api.requests.decide);
  return (
    <section>
      <h2 className="font-display text-2xl">Needs a human</h2>
      <div className="frame mt-3 overflow-hidden">
        {rows && rows.length ? (
          <ul>
            {rows.map((r) => (
              <li key={r.id} className="flex flex-col gap-2 border-t border-line px-4 py-3 first:border-t-0">
                <div className="flex items-center gap-2">
                  <Avatar handle={r.user.handle} url={r.user.avatarUrl} />
                  <span className="text-[13px] font-medium">@{r.user.handle}</span>
                  <span className="placard">{timeAgo(r.createdAt)} · confidence {r.confidence.toFixed(2)} · {r.verdict?.scope}</span>
                </div>
                <p className="text-[15px]">{r.prompt}</p>
                <p className="placard">
                  {r.target.line === 0 ? "new block" : `${r.target.blockId ?? "wall"} · <${r.target.tag}> · ${r.target.path}:${r.target.line}`}
                </p>
                {r.plan.length ? (
                  <ul className="ml-4 list-disc text-[13px] text-ink-2">
                    {r.plan.map((p) => (
                      <li key={p}>{p}</li>
                    ))}
                  </ul>
                ) : null}
                {r.verdict?.hint ? <p className="text-[13px] text-ink-2">judge: {r.verdict.hint}</p> : null}
                <div className="flex gap-2">
                  <button type="button" onClick={() => void decide({ id: r.id, approve: true })} className="h-8 rounded-md bg-ok px-3 text-[13px] font-medium text-paper">
                    Approve & build
                  </button>
                  <button type="button" onClick={() => void decide({ id: r.id, approve: false })} className="h-8 rounded-md border border-line px-3 text-[13px] hover:border-bad hover:text-bad">
                    Reject
                  </button>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="p-5 text-[14px] text-muted">Queue is empty.</p>
        )}
      </div>
    </section>
  );
}

function Flagged() {
  const rows = useQuery(api.flags.flagged, hasConvex ? {} : "skip");
  const revert = useMutation(api.admin.revert);
  return (
    <section>
      <h2 className="font-display text-2xl">Flagged changes</h2>
      <div className="frame mt-3 overflow-hidden">
        {rows && rows.length ? (
          <ul>
            {rows.map((c) => (
              <li key={c.id} className="flex items-center gap-3 border-t border-line px-4 py-3 first:border-t-0">
                <span className="num text-bad">{c.flagCount}</span>
                <span className="min-w-0 flex-1 truncate text-[14px]">{c.summary}</span>
                <span className="placard">{timeAgo(c.mergedAt)}</span>
                {c.prUrl.startsWith("https://") ? (
                  <a href={c.prUrl} target="_blank" rel="noopener noreferrer" className="placard hover:text-accent">PR ↗</a>
                ) : null}
                <button type="button" onClick={() => void revert({ changeId: c.id })} className="h-8 rounded-md border border-line px-3 text-[13px] hover:border-bad hover:text-bad">
                  Revert
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="p-5 text-[14px] text-muted">Nothing flagged.</p>
        )}
      </div>
    </section>
  );
}

const EDITABLE: Array<{ key: string; label: string; kind: "number" | "text" }> = [
  { key: "dailyBudgetCents", label: "Daily AI budget (cents)", kind: "number" },
  { key: "maxConcurrentBuilds", label: "Concurrent builds", kind: "number" },
  { key: "minBidCents", label: "Minimum bid (cents)", kind: "number" },
  { key: "bidStepCents", label: "Bid step (cents)", kind: "number" },
  { key: "patronTopUpPct", label: "Patron → budget (%)", kind: "number" },
  { key: "judgeModel", label: "Judge model", kind: "text" },
  { key: "redTeamModel", label: "Red team model", kind: "text" },
  { key: "reviewModel", label: "Review model", kind: "text" },
  { key: "coderModel", label: "Coder model", kind: "text" },
  { key: "maxTurns", label: "Max agent steps", kind: "number" },
];

function Config() {
  const all = useQuery(api.config.all_public, hasConvex ? {} : "skip");
  const set = useMutation(api.config.set);
  const [draft, setDraft] = useState<Record<string, string>>({});
  return (
    <section>
      <h2 className="font-display text-2xl">Levers</h2>
      <div className="frame mt-3 grid grid-cols-1 gap-x-6 gap-y-3 p-4 sm:grid-cols-2">
        {EDITABLE.map((f) => {
          const cur = all ? String((all as Record<string, unknown>)[f.key] ?? "") : "";
          const val = draft[f.key] ?? cur;
          return (
            <label key={f.key} className="flex flex-col gap-1 text-[13px]">
              <span className="text-ink-2">{f.label}</span>
              <span className="flex gap-2">
                <input
                  value={val}
                  onChange={(e) => setDraft((d) => ({ ...d, [f.key]: e.target.value }))}
                  className="h-9 flex-1 rounded-md border border-line bg-paper px-2 font-mono text-[13px]"
                />
                <button
                  type="button"
                  disabled={val === cur}
                  onClick={() => void set({ key: f.key, value: f.kind === "number" ? Number(val) : val }).then(() => setDraft((d) => ({ ...d, [f.key]: undefined as never })))}
                  className="h-9 rounded-md border border-line px-3 disabled:opacity-40"
                >
                  Save
                </button>
              </span>
            </label>
          );
        })}
      </div>
    </section>
  );
}
