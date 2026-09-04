import { useRequests } from "@/core/lib/useRequests";
import { useNow } from "@/core/lib/useNow";
import { parsePoint, parseRegion, type Placed } from "./canvas";

const LIVE_FOR = 24 * 60 * 60 * 1000;
const SHOW = new Set(["queued", "building", "validating", "reviewing", "preview", "merging", "live", "proposed"]);

/**
 * Asks, pinned where they landed: a small avatar on the block (or the space) someone pointed at, for a
 * day. The wall shows its own conversation. Not interactive; the feed is.
 */
export function Pins({ at }: { at: Map<string, Placed> }) {
  const requests = useRequests();
  const now = useNow(60_000);
  const pins = requests
    .filter((r) => SHOW.has(r.status) && now - r.createdAt < LIVE_FOR)
    .map((r) => {
      let x: number | null = null;
      let y: number | null = null;
      const p = r.target.blockId ? at.get(r.target.blockId) : undefined;
      if (p) {
        x = p.x + p.w - 14;
        y = p.y - 8;
      } else {
        const region = parseRegion(r.target.text);
        const point = parsePoint(r.target.text);
        if (region) {
          x = region.x + 6;
          y = region.y + 6;
        } else if (point) {
          x = point.x;
          y = point.y;
        }
      }
      return x == null || y == null ? null : { id: r.id, x, y, handle: r.user.handle, avatar: r.user.avatarUrl, status: r.status, prompt: r.prompt };
    })
    .filter((p): p is NonNullable<typeof p> => p !== null)
    .slice(0, 60);
  if (!pins.length) return null;
  return (
    <div className="pins" aria-hidden>
      {pins.map((p, i) => (
        <span key={p.id} className="pin" data-status={p.status} style={{ left: p.x + (i % 3) * 6, top: p.y }} title={`${p.handle.replace("guest-", "guest · ")}: ${p.prompt}`}>
          {p.avatar ? <img src={p.avatar} alt="" /> : <span>{(p.handle.replace("guest-", "")[0] ?? "?").toUpperCase()}</span>}
        </span>
      ))}
    </div>
  );
}
