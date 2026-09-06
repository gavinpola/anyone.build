import { createFileRoute } from "@tanstack/react-router";
import { RoomPage } from "@/core/layout/RoomPage";
import { tileFromPath } from "@/core/room/canvas";

/** A deep link into the world: /t/4,-2 lands with that tile in the middle of the screen. */
export const Route = createFileRoute("/t/$tile")({
  component: TilePage,
});

function TilePage() {
  const { tile } = Route.useParams();
  return <RoomPage tile={tileFromPath(tile)} />;
}
