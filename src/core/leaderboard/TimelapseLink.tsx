import { useQuery } from "convex/react";
import { Link } from "@tanstack/react-router";
import { api } from "../../../convex/_generated/api";
import { hasConvex } from "@/core/lib/providers";
import { timeAgo, useNow } from "@/core/lib/useNow";

/** A small door to the timelapse page: the latest frame and how many there are. */
export function TimelapseLink() {
  const frames = useQuery(api.timelapse.list, hasConvex ? { limit: 1 } : "skip");
  const latest = frames?.[frames.length - 1];
  const now = useNow(60_000);
  return (
    <Link to="/timelapse" className="frame flex items-center gap-4 p-3 hover:border-line-2" data-timelapse-link>
      <span className="block h-14 w-20 shrink-0 overflow-hidden bg-paper-2">{latest ? <img src={latest.url} alt="" className="block h-full w-full object-cover object-top" loading="lazy" /> : null}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-medium">The wall, every hour</span>
        <span className="placard mt-0.5 block">{frames === undefined ? "…" : !latest ? "the first frame lands within the hour" : `last frame ${timeAgo(latest.at, now)} · a frame an hour, 30 days · scrub it`}</span>
      </span>
      <span className="placard">→</span>
    </Link>
  );
}
