import { useEffect } from "react";
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { hasConvex } from "@/core/lib/providers";
import { tabSessionId } from "@/core/lib/session";

/**
 * Decay's other half: interacting with a block (a click, a key, a drag inside it) touches it, and its
 * clock resets. Throttled per block per tab; never for the add zone or the wall itself.
 */
export function useTouch(wallRef: React.RefObject<HTMLElement | null>, enabled: boolean) {
  const touch = useMutation(api.life.touch);
  useEffect(() => {
    const wall = wallRef.current;
    if (!wall || !enabled || !hasConvex) return;
    const last = new Map<string, number>();
    const onDown = (e: Event) => {
      const el = (e.target as HTMLElement | null)?.closest<HTMLElement>("[data-ab-block]");
      const id = el?.dataset.abBlock;
      if (!id || id === "__new__" || id === "__canvas__" || el?.dataset.pinnedForever) return;
      const now = Date.now();
      if (now - (last.get(id) ?? 0) < 8000) return;
      last.set(id, now);
      void touch({ blockId: id, anonId: tabSessionId() }).catch(() => {});
    };
    wall.addEventListener("pointerdown", onDown, { passive: true });
    wall.addEventListener("keydown", onDown, { passive: true });
    return () => {
      wall.removeEventListener("pointerdown", onDown);
      wall.removeEventListener("keydown", onDown);
    };
  }, [wallRef, enabled, touch]);
}
