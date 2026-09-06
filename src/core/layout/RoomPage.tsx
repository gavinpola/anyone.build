import { Room } from "@/core/room/Room";
import { FeedRail } from "@/core/feed/FeedRail";
import { FocusBar } from "@/core/share/FocusBar";

export function RoomPage({ focus, tile }: { focus?: string; tile?: { x: number; y: number } | null } = {}) {
  return (
    <div className="room-page">
      {focus ? <div className="mx-auto max-w-[1440px] px-4 pt-4 sm:px-6"><FocusBar id={focus} kind="c" /></div> : null}
      <Room tile={tile ?? null} />
      <FeedRail />
    </div>
  );
}
