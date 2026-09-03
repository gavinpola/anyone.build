import { Room } from "@/core/room/Room";
import { FeedRail } from "@/core/feed/FeedRail";
import { FocusBar } from "@/core/share/FocusBar";

export function RoomPage({ focus }: { focus?: string } = {}) {
  return (
    <div className="mx-auto max-w-[1440px] px-4 py-6 sm:px-6">
      {focus ? <FocusBar id={focus} kind="c" /> : null}
      <Room />
      <FeedRail />
    </div>
  );
}
