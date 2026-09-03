import { Room } from "@/core/room/Room";
import { FeedRail } from "@/core/feed/FeedRail";

export function RoomPage() {
  return (
    <div className="mx-auto max-w-[1440px] px-4 py-6 sm:px-6">
      <Room />
      <FeedRail />
    </div>
  );
}
