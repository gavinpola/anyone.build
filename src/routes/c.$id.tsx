import { createFileRoute } from "@tanstack/react-router";
import { RoomPage } from "@/core/layout/RoomPage";

/** A shared change: the wall, scrolled to the block, with a bar saying who asked for what. */
export const Route = createFileRoute("/c/$id")({
  component: SharedChange,
});

function SharedChange() {
  const { id } = Route.useParams();
  return <RoomPage focus={id} />;
}
