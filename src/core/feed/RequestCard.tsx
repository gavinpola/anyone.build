import { useState } from "react";
import { motion } from "motion/react";
import { ExternalLink, GitPullRequest, Plus, X } from "lucide-react";
import { cn } from "@/core/lib/cn";
import { elapsed, timeAgo } from "@/core/lib/useNow";
import { cancelRequest, plusOneRequest } from "@/core/lib/useRequests";
import { REJECTION_COPY, STAGE_COPY, STATUS_STEPS, stepIndex, type FeedRequest } from "@/core/lib/types";
import { ShareButton, shareUrl } from "@/core/share/ShareButton";

const TERMINAL = new Set(["live", "rejected", "failed", "cancelled"]);

export function RequestCard({ r, now }: { r: FeedRequest; now: number }) {
  const [open, setOpen] = useState(false);
  const idx = stepIndex(r.status);
  const rejected = r.status === "rejected";
  const failed = r.status === "failed" || r.status === "cancelled";
  const live = r.status === "live";
  const inProgress = !TERMINAL.has(r.status);
  const pinned = (r.pinnedUntil ?? 0) > now;
  const copy = rejected && r.verdict?.category ? REJECTION_COPY[r.verdict.category] : null;

  return (
    <motion.article
      data-status={r.status}
      data-request-id={r.id}
      layout
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 500, damping: 40 }}
      className={cn("frame p-3", pinned && "border-accent/60", live && "bg-ok-soft/40", rejected && "opacity-90")}
    >
      <div className="flex items-center gap-2">
        <Avatar handle={r.user.guest ? "g" : r.user.handle} url={r.user.avatarUrl} />
        <span className="text-[13px] font-medium">{r.user.guest ? <span className="text-ink-2">{r.user.handle.replace("guest-", "guest · ")}</span> : `@${r.user.handle}`}</span>
        <span className="placard">{timeAgo(r.createdAt, now)}</span>
        <StatusPill r={r} now={now} />
        {live || r.status === "proposed" ? (
          <ShareButton compact className="ml-auto" url={shareUrl(r.status === "proposed" ? "p" : "c", r.id)} title={r.prompt} text={r.status === "proposed" ? "Vote for this on everyones.lol" : "Made on everyones.lol, the website anyone can change"} />
        ) : null}
      </div>

      <button type="button" onClick={() => setOpen((o) => !o)} className="mt-2 block w-full text-left">
        <p className={cn("text-[14px] leading-snug text-ink", !open && "line-clamp-2")}>{r.prompt}</p>
      </button>
      <p className="placard mt-1 truncate">
        {r.target.line === 0 ? (
          <span className="text-accent">{r.target.tag === "region" ? "A space on the wall" : "New block"}</span>
        ) : (
          <>
            <span className="text-accent">{r.target.blockId === "__canvas__" ? "The wall itself" : (r.target.blockTitle ?? r.target.blockId ?? "wall")}</span>
            {r.target.tag ? <span> · {`<${r.target.tag}>`}</span> : null}
            <span className="opacity-70"> · {r.target.path.replace("src/rooms/main/blocks/", "")}:{r.target.line}</span>
          </>
        )}
      </p>

      {rejected ? (
        <div className="mt-2 rounded-md bg-bad-soft px-3 py-2">
          <p className="text-[13px] font-medium text-bad">{copy?.title ?? "Rejected"}</p>
          <p className="text-[12px] text-ink-2">{r.verdict?.hint ?? copy?.hint}</p>
        </div>
      ) : failed ? (
        <div className="mt-2 rounded-md bg-paper-2 px-3 py-2 text-[12px] text-muted">{STAGE_COPY[r.status]}</div>
      ) : (
        <Tracker idx={idx} live={live} />
      )}

      {inProgress ? (
        <p className="placard mt-2 flex items-center gap-2">
          <span className={live ? "live-dot" : "judging-dot"} />
          <span>{STAGE_COPY[r.status] ?? r.status}{r.stage ? ` · ${r.stage}` : ""}</span>
          <span className="ml-auto tabular-nums">{elapsed(r.createdAt, now)}</span>
        </p>
      ) : null}

      {live && r.run?.summary ? (
        <p className="mt-2 text-[13px] text-ink-2">
          {r.run.summary}
          {typeof r.run.linesAdded === "number" ? (
            <span className="placard ml-2">
              <span className="text-ok">+{r.run.linesAdded}</span> <span className="text-bad">−{r.run.linesRemoved ?? 0}</span>
            </span>
          ) : null}
        </p>
      ) : null}

      {(r.run?.previewUrl || r.run?.prUrl || (inProgress && r.mine) || (!r.mine && inProgress)) && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {r.run?.previewUrl ? (
            <a href={r.run.previewUrl} target="_blank" rel="noopener noreferrer" className="inline-flex h-7 items-center gap-1 rounded-md border border-line bg-card px-2 text-[12px] hover:border-line-2">
              Preview <ExternalLink size={12} />
            </a>
          ) : null}
          {r.run?.prUrl ? (
            <a href={r.run.prUrl} target="_blank" rel="noopener noreferrer" className="inline-flex h-7 items-center gap-1 rounded-md border border-line bg-card px-2 text-[12px] hover:border-line-2">
              <GitPullRequest size={12} /> PR
            </a>
          ) : null}
          {!r.mine && inProgress ? (
            <button type="button" onClick={() => plusOneRequest(r.id)} className="inline-flex h-7 items-center gap-1 rounded-md border border-line bg-card px-2 text-[12px] hover:border-line-2">
              <Plus size={12} /> {r.plusOnes > 0 ? r.plusOnes : "Same"}
            </button>
          ) : null}
          {r.mine && inProgress && r.status !== "merging" ? (
            <button type="button" onClick={() => cancelRequest(r.id)} className="ml-auto inline-flex h-7 items-center gap-1 rounded-md px-2 text-[12px] text-muted hover:bg-paper-2 hover:text-ink">
              <X size={12} /> Cancel
            </button>
          ) : null}
        </div>
      )}
    </motion.article>
  );
}

function Tracker({ idx, live }: { idx: number; live: boolean }) {
  return (
    <div className="mt-2.5 flex items-center gap-1">
      {STATUS_STEPS.map((s, i) => {
        const done = i < idx || live;
        const current = i === idx && !live;
        return (
          <div key={s.key} className="flex flex-1 flex-col gap-1">
            <div
              className={cn(
                "h-1 rounded-full transition-colors",
                done ? "bg-ok" : current ? "bg-accent" : "bg-line",
                current && "animate-pulse",
              )}
            />
            <span className={cn("placard text-[10px]", done ? "text-ok" : current ? "text-accent" : "")}>{s.label}</span>
          </div>
        );
      })}
    </div>
  );
}

function StatusPill({ r, now: _now }: { r: FeedRequest; now: number }) {
  const map: Record<string, string> = {
    live: "bg-ok-soft text-ok",
    rejected: "bg-bad-soft text-bad",
    failed: "bg-paper-2 text-muted",
    cancelled: "bg-paper-2 text-muted",
    judging: "bg-warn-soft text-warn",
    needs_human: "bg-warn-soft text-warn",
  };
  const cls = map[r.status] ?? "bg-accent-soft text-accent";
  return <span className={cn("ml-auto rounded-full px-2 py-0.5 text-[11px] font-medium", cls)}>{STAGE_COPY[r.status] ?? r.status}</span>;
}

export function Avatar({ handle, url, size = 22 }: { handle: string; url: string | null; size?: number }) {
  return (
    <span
      className="flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-line bg-paper-2 text-[10px] font-medium uppercase"
      style={{ width: size, height: size }}
    >
      {url ? <img src={url} alt="" className="h-full w-full object-cover" /> : handle.slice(0, 2)}
    </span>
  );
}
