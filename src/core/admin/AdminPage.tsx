import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { hasConvex, useQuerySafe } from "@/core/lib/providers";
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
      <HowItsGoing />
      <FailedBuilds />
      <NeedsHuman />
      <Flagged />
      <Spend />
      <Config />
    </div>
  );
}

/** The numbers, without anyone's words: outcomes over the last 7 days from stats.outcomes. */
function HowItsGoing() {
  const o = useQuerySafe(api.stats.outcomes, hasConvex ? { days: 7 } : "skip");
  const rows = (rec: Record<string, number>) => Object.entries(rec).filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]);
  return (
    <section data-how-its-going>
      <h2 className="font-display text-2xl">How it's going</h2>
      <p className="placard mt-1">The last 7 days. Counts only, never anyone's words. Failures list the reason the asker saw.</p>
      {!o ? (
        <p className="mt-3 text-[14px] text-muted">Loading…</p>
      ) : (
        <div className="mt-3 grid gap-4 md:grid-cols-3">
          <div className="frame p-4">
            <p className="placard">asks by outcome</p>
            <table className="mt-2 w-full text-[13px]">
              <tbody>
                {rows(o.byStatus).map(([k, n]) => (
                  <tr key={k} className="border-t border-line"><td className="py-1.5">{k}</td><td className="py-1.5 text-right tabular-nums">{n}</td></tr>
                ))}
              </tbody>
            </table>
            <p className="placard mt-3">live builds: median {o.liveBuildSeconds.median ?? "–"}s · p90 {o.liveBuildSeconds.p90 ?? "–"}s · {o.liveBuildSeconds.n}</p>
          </div>
          <div className="frame p-4">
            <p className="placard">why rejected</p>
            <table className="mt-2 w-full text-[13px]">
              <tbody>
                {rows(o.rejectedBy).map(([k, n]) => (
                  <tr key={k} className="border-t border-line"><td className="py-1.5">{k}</td><td className="py-1.5 text-right tabular-nums">{n}</td></tr>
                ))}
                {rows(o.rejectedBy).length === 0 ? <tr><td className="py-1.5 text-muted">none</td></tr> : null}
              </tbody>
            </table>
          </div>
          <div className="frame p-4">
            <p className="placard">how failed</p>
            <table className="mt-2 w-full text-[13px]">
              <tbody>
                {rows(o.failedBy).map(([k, n]) => (
                  <tr key={k} className="border-t border-line"><td className="py-1.5 pr-2">{k}</td><td className="py-1.5 text-right tabular-nums">{n}</td></tr>
                ))}
                {rows(o.failedBy).length === 0 ? <tr><td className="py-1.5 text-muted">none</td></tr> : null}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}

/** Failed builds, with one click to rebuild under the same requester and verdict. */
function FailedBuilds() {
  const rows = useQuerySafe(api.admin.failedRecent, hasConvex ? {} : "skip");
  const rebuild = useMutation(api.admin.rebuild);
  const [busy, setBusy] = useState<string | null>(null);
  return (
    <section data-failed-builds>
      <h2 className="font-display text-2xl">Failed builds</h2>
      <p className="placard mt-1">Rebuild re-runs the same ask for the same person with a fresh budget reservation. It queues like any other build.</p>
      <div className="frame mt-3 overflow-hidden">
        {rows && rows.length ? (
          <ul>
            {rows.map((r) => (
              <li key={r.id} className="flex items-center gap-3 border-t border-line px-4 py-3 first:border-t-0">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px]">{r.prompt}</span>
                  <span className="placard block truncate">
                    {timeAgo(r.at)} · {r.scope ?? "?"} · {r.hint} {r.error ? `· ${r.error}` : ""} · {(r.costCents / 100).toFixed(2)}$
                  </span>
                </span>
                {r.rebuildable ? (
                  <button
                    type="button"
                    disabled={busy === r.id}
                    onClick={() => {
                      setBusy(r.id);
                      void rebuild({ id: r.id }).catch(() => {}).finally(() => setBusy(null));
                    }}
                    className="rounded-md border border-line bg-card px-2.5 py-1 text-[12px] font-medium hover:border-line-2 disabled:opacity-50"
                  >
                    Rebuild
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="p-5 text-[14px] text-muted">{rows === null ? "Maintainers only." : rows ? "Nothing failed. Nice." : "Loading…"}</p>
        )}
      </div>
    </section>
  );
}

function NeedsHuman() {
  const rows = useQuerySafe(api.admin.needsHuman, hasConvex ? {} : "skip");
  const decide = useMutation(api.requests.decide);
  return (
    <section>
      <h2 className="font-display text-2xl">Retired queue (needs_human; nothing new lands here)</h2>
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
  const rows = useQuerySafe(api.flags.flagged, hasConvex ? {} : "skip");
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

const EDITABLE: Array<{ key: string; label: string; kind: "number" | "text" | "bool" }> = [
  { key: "dailyBudgetCents", label: "Daily AI budget (cents)", kind: "number" },
  { key: "maxConcurrentBuilds", label: "Concurrent builds", kind: "number" },
  { key: "minBidCents", label: "Minimum bid (cents)", kind: "number" },
  { key: "bidStepCents", label: "Bid step (cents)", kind: "number" },
  { key: "patronTopUpPct", label: "Patron → budget (%)", kind: "number" },
  { key: "judgeModel", label: "Judge model", kind: "text" },
  { key: "redTeamModel", label: "Red team model", kind: "text" },
  { key: "reviewModel", label: "Review model", kind: "text" },
  { key: "coderModel", label: "Coder model (tiny + small)", kind: "text" },
  { key: "coderModelMedium", label: "Coder model (medium)", kind: "text" },
  { key: "coderModelLarge", label: "Coder model (large: a proposal that won)", kind: "text" },
  { key: "maxTurns", label: "Max agent steps", kind: "number" },
  { key: "fastPathEnabled", label: "Fast path (tiny asks skip the sandbox)", kind: "bool" },
  { key: "fastModel", label: "Fast path model (empty = coder model)", kind: "text" },
  { key: "guestsEnabled", label: "Guests can ask (no account)", kind: "bool" },
  { key: "backendEnabled", label: "Room functions (agent-written backend)", kind: "bool" },
];

function Spend() {
  const c = useQuerySafe(api.admin.costs, hasConvex ? {} : "skip");
  const $ = (cents: number) => "$" + (cents / 100).toFixed(2);
  return (
    <section>
      <h2 className="font-display text-2xl">Spend</h2>
      <p className="placard mt-1">What the wall's builds cost. The daily cap is the money backstop; per-build caps by scope sit under it.</p>
      {!c ? (
        <p className="mt-3 text-[14px] text-muted">{c === null ? "Maintainers only." : "Loading…"}</p>
      ) : (
        <div className="mt-3 grid gap-4 md:grid-cols-2">
          <div className="frame p-4">
            <p className="placard">by day</p>
            <table className="mt-2 w-full text-[13px]">
              <tbody>
                {c.days.map((d) => (
                  <tr key={d.day} className="border-t border-line">
                    <td className="py-1.5 font-mono">{d.day}</td>
                    <td className="py-1.5 text-right tabular-nums">{$(d.spentCents)} spent</td>
                    <td className="py-1.5 text-right tabular-nums text-ink-2">{$(d.reservedCents)} held</td>
                    <td className="py-1.5 text-right tabular-nums text-ink-2">of {$(d.capCents + d.topUpCents)}</td>
                  </tr>
                ))}
                {c.days.length === 0 ? <tr><td className="py-1.5 text-muted">nothing yet</td></tr> : null}
              </tbody>
            </table>
          </div>
          <div className="frame p-4">
            <p className="placard">last {c.finished} finished builds · {$(c.totalCents)} total</p>
            <table className="mt-2 w-full text-[13px]">
              <tbody>
                {c.byScope.map((s) => (
                  <tr key={s.scope} className="border-t border-line">
                    <td className="py-1.5">{s.scope}</td>
                    <td className="py-1.5 text-right tabular-nums">{s.n} builds</td>
                    <td className="py-1.5 text-right tabular-nums">{$(s.avgCents)} avg</td>
                    <td className="py-1.5 text-right tabular-nums text-ink-2">{s.live} live · {s.failed} failed</td>
                  </tr>
                ))}
                {c.byScope.length === 0 ? <tr><td className="py-1.5 text-muted">nothing finished yet</td></tr> : null}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}

function Config() {
  const all = useQuerySafe(api.config.all_public, hasConvex ? {} : "skip");
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
                {f.kind === "bool" ? (
                  <select
                    value={val}
                    onChange={(e) => setDraft((d) => ({ ...d, [f.key]: e.target.value }))}
                    className="h-9 flex-1 rounded-md border border-line bg-paper px-2 font-mono text-[13px]"
                  >
                    <option value="true">on</option>
                    <option value="false">off</option>
                  </select>
                ) : (
                  <input
                    value={val}
                    onChange={(e) => setDraft((d) => ({ ...d, [f.key]: e.target.value }))}
                    className="h-9 flex-1 rounded-md border border-line bg-paper px-2 font-mono text-[13px]"
                  />
                )}
                <button
                  type="button"
                  disabled={val === cur}
                  onClick={() => void set({ key: f.key, value: f.kind === "number" ? Number(val) : f.kind === "bool" ? val === "true" : val }).then(() => setDraft((d) => ({ ...d, [f.key]: undefined as never })))}
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
