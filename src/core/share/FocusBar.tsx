import { Component, useEffect, type ReactNode } from "react";
import { useQuery } from "convex/react";
import { Link } from "@tanstack/react-router";
import { api } from "../../../convex/_generated/api";
import { hasConvex } from "@/core/lib/providers";
import { Avatar } from "@/core/feed/RequestCard";
import { ShareButton, shareUrl } from "./ShareButton";

/**
 * Where a shared link lands: a short bar saying who asked for what, and the thing itself ringed and
 * scrolled into view. Kind "c" rings the block on the wall; kind "p" rings the row on the vote board.
 */
export function FocusBar({ id, kind }: { id: string; kind: "c" | "p" }) {
  return (
    <Quiet>
      <Inner id={id} kind={kind} />
    </Quiet>
  );
}

function Inner({ id, kind }: { id: string; kind: "c" | "p" }) {
  const d = useQuery(api.share.request, hasConvex ? { id } : "skip");
  const blockId = d?.primaryBlockId ?? null;
  useEffect(() => {
    if (!d) return;
    const selector = kind === "p" || d.status === "proposed" ? `[data-proposal="${id}"]` : blockId ? `[data-ab-block="${CSS.escape(blockId)}"]` : null;
    if (!selector) return;
    let ring: Element | null = null;
    const t0 = setTimeout(() => {
      ring = document.querySelector(selector);
      if (!ring) return;
      ring.scrollIntoView({ behavior: "smooth", block: "center" });
      ring.classList.add("share-ring");
    }, 150);
    const t1 = setTimeout(() => ring?.classList.remove("share-ring"), 3200);
    return () => {
      clearTimeout(t0);
      clearTimeout(t1);
      ring?.classList.remove("share-ring");
    };
  }, [d, id, kind, blockId]);

  if (d === undefined) return null;
  if (d === null) {
    return (
      <div className="frame mb-5 px-4 py-3 text-[13px] text-ink-2" data-focus="missing">
        That link points at something that isn't public, or isn't there any more. The wall is below.
      </div>
    );
  }
  const proposed = kind === "p" || d.status === "proposed";
  const live = d.status === "live";
  const isPage = blockId?.startsWith("page:");
  const by = d.by.guest ? "A guest" : `@${d.by.handle}`;
  const status = proposed
    ? `Up for a vote · ${d.votes ?? 0} ${d.votes === 1 ? "vote" : "votes"} so far. Sign in to vote; the most-wanted one gets built.`
    : live
      ? `${d.summary ?? "It's on the wall."}${d.reverted ? " (Since replaced by a later change.)" : ""}`
      : "Being built right now. Watch the feed.";
  return (
    <div className="frame mb-5 flex flex-wrap items-center gap-3 px-4 py-3" data-focus={d.status}>
      <Avatar handle={d.by.guest ? "g" : d.by.handle} url={d.by.avatarUrl} size={26} />
      <div className="min-w-0 flex-1">
        <p className="text-[13px] text-ink-2">
          {by} asked for this{proposed ? " and it's up for a vote" : ""}
        </p>
        <p className="truncate text-[15px] font-medium">“{d.ask}”</p>
        <p className="placard mt-0.5">{status}</p>
      </div>
      <div className="flex items-center gap-2">
        {isPage && blockId ? (
          <Link to="/r/$room/$slug" params={{ room: d.roomId, slug: blockId.slice("page:".length) }} className="h-8 rounded-md border border-line px-3 text-[13px] leading-8 hover:border-line-2">
            Open the page
          </Link>
        ) : null}
        <ShareButton url={shareUrl(proposed ? "p" : "c", d.id)} title={d.ask} text={proposed ? "Vote for this on anyone.build" : "Made on anyone.build, the website anyone can change"} />
        <Link to={proposed ? "/leaderboard" : "/"} className="h-8 rounded-md bg-ink px-3 text-[13px] leading-8 text-paper hover:opacity-90">
          {proposed ? "Vote" : "Change something too"}
        </Link>
      </div>
    </div>
  );
}

/** A share bar must never take the wall down with it (e.g. the query isn't deployed yet). */
class Quiet extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}
