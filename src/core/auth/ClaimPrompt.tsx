import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { hasConvex, useQuerySafe } from "@/core/lib/providers";
import { useViewer } from "./useViewer";
import { friendlyError } from "@/core/lib/errors";

/** After signing in: credit what this browser did as a guest. One line, one button, then gone. */
export function ClaimPrompt() {
  const viewer = useViewer();
  const claimable = useQuerySafe(api.users.claimable, hasConvex && viewer.signedIn ? { guestId: viewer.guestId } : "skip");
  const claim = useMutation(api.users.claim);
  const [done, setDone] = useState<{ requests: number; changes: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  if (!viewer.signedIn || !claimable || claimable.claimedByOther) return null;
  // Only credit what actually landed: rejected or in-flight asks aren't "things you made".
  const n = claimable.changes;
  if (!done && n === 0) return null;
  return (
    <div className="border-b border-line bg-accent-soft/50">
      <div className="mx-auto flex max-w-[1440px] flex-wrap items-center gap-3 px-4 py-2 text-[13px] sm:px-6">
        {done ? (
          <span>
            {done.changes} {done.changes === 1 ? "change" : "changes"} and {done.requests} {done.requests === 1 ? "request" : "requests"} now count for <span className="font-semibold">@{viewer.handle}</span>.
          </span>
        ) : (
          <>
            <span>
              You made <span className="font-semibold">{n}</span> {n === 1 ? "change" : "changes"} to this wall before signing in.
            </span>
            <button
              type="button"
              onClick={() =>
                claim({ guestId: viewer.guestId })
                  .then((r) => setDone(r))
                  .catch((e) => setError(friendlyError(e)))
              }
              className="h-7 rounded-md bg-accent px-3 text-[13px] font-semibold text-accent-ink hover:brightness-95"
            >
              Claim them
            </button>
            {error ? <span className="text-bad">{error}</span> : null}
          </>
        )}
      </div>
    </div>
  );
}
