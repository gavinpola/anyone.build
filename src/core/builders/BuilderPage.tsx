import { Link } from "@tanstack/react-router";
import { ExternalLink } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import { hasConvex, useQuerySafe } from "@/core/lib/providers";
import { Avatar } from "@/core/feed/RequestCard";
import { ShareButton } from "@/core/share/ShareButton";
import { timeAgo, useNow } from "@/core/lib/useNow";

/** A builder's page to share: who they are, what they changed, each change a link onto the wall. */
export function BuilderPage({ handle }: { handle: string }) {
  const p = useQuerySafe(api.leaderboard.profile, hasConvex ? { handle } : "skip");
  const now = useNow(30_000);
  const origin = typeof window !== "undefined" ? window.location.origin : "https://everyones.lol";
  if (p === undefined) {
    return (
      <div className="mx-auto max-w-[760px] px-4 py-10 sm:px-6">
        <p className="text-[14px] text-muted">Loading…</p>
      </div>
    );
  }
  if (p === null) {
    return (
      <div className="mx-auto max-w-[760px] px-4 py-10 sm:px-6" data-builder-missing>
        <h1 className="font-display text-3xl">@{handle}</h1>
        <p className="mt-2 text-[15px] text-ink-2">Nobody by that name has built here yet.</p>
        <p className="mt-4 text-[14px]">
          <Link to="/" className="underline hover:text-accent">
            Go to the wall
          </Link>{" "}
          and change something; your name goes on the commit.
        </p>
      </div>
    );
  }
  const { user, changes } = p;
  const live = changes.filter((c) => !c.reverted);
  const first = changes.length ? changes[changes.length - 1]! : null;
  const github = `https://github.com/${user.handle}`;
  return (
    <div className="mx-auto max-w-[760px] px-4 py-10 sm:px-6" data-builder={user.handle}>
      <div className="flex flex-wrap items-center gap-4">
        <Avatar handle={user.handle} url={user.avatarUrl} size={56} />
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-3xl">@{user.handle}</h1>
          <p className="placard mt-1 flex flex-wrap items-center gap-x-2">
            <span>
              {live.length} change{live.length === 1 ? "" : "s"} on the wall
            </span>
            {first ? <span>· first one {timeAgo(first.mergedAt, now)}</span> : null}
            <a href={github} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 hover:text-accent">
              GitHub <ExternalLink size={11} />
            </a>
          </p>
        </div>
        <ShareButton url={`${origin}/u/${user.handle}`} title={`@${user.handle} on everyones.lol`} text={`What @${user.handle} built on everyones.lol, the website anyone can change`} />
      </div>

      <ol className="mt-8 divide-y divide-line border-y border-line" data-builder-changes>
        {changes.length === 0 ? (
          <li className="py-6 text-[14px] text-muted">Nothing landed yet.</li>
        ) : (
          changes.map((c) => (
            <li key={c.id} className="py-3">
              <Link to="/c/$id" params={{ id: c.requestId }} className="block hover:text-accent">
                <span className="block text-[15px]">{c.summary || "A change on the wall."}</span>
                <span className="placard mt-0.5 flex flex-wrap items-center gap-x-2">
                  <span>{timeAgo(c.mergedAt, now)}</span>
                  <span>· {c.blockIds.join(", ") || "the wall"}</span>
                  <span>
                    · <span className="text-ok">+{c.linesAdded}</span> <span className="text-bad">−{c.linesRemoved}</span>
                  </span>
                  {c.reverted ? <span className="text-bad">· reverted</span> : null}
                </span>
              </Link>
            </li>
          ))
        )}
      </ol>
    </div>
  );
}
