import { useRequests } from "@/core/lib/useRequests";
import { useNow } from "@/core/lib/useNow";
import { parseTile, parseTiles, tileGround, type Rect } from "./canvas";

const LANDED_FOR = 3 * 60 * 1000; // a landed change keeps its pin for a few minutes, then the object speaks for itself
const IN_FLIGHT = new Set(["judging", "queued", "building", "validating", "reviewing", "preview", "merging"]);

/**
 * Asks in flight, pinned where they point: a small avatar on the block (or the space) someone is
 * changing right now, and for a few minutes after it lands. A bubble means activity, so the bubbles
 * on the wall and the people count never tell different stories. Not interactive; the feed is.
 */
export function Pins({ at }: { at: Map<string, Rect> }) {
  const requests = useRequests();
  const now = useNow(15_000);
  const pins = requests
    .filter((r) => IN_FLIGHT.has(r.status) || (r.status === "live" && now - r.updatedAt < LANDED_FOR))
    .map((r) => {
      let x: number | null = null;
      let y: number | null = null;
      const p = r.target.blockId ? at.get(r.target.blockId) : undefined;
      if (p) {
        x = p.x + p.w - 14;
        y = p.y - 8;
      } else {
        const tiles = parseTiles(r.target.text);
        const tile = parseTile(r.target.text);
        const g = tiles ? tileGround(tiles) : tile ? tileGround({ ...tile, w: 1, h: 1 }) : null;
        if (g) {
          x = g.x + 22;
          y = g.y + 22;
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
