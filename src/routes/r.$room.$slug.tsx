import { createFileRoute } from "@tanstack/react-router";
import { PageView } from "@/core/room/PageView";

export const Route = createFileRoute("/r/$room/$slug")({
  component: RoutePage,
});

function RoutePage() {
  const { room, slug } = Route.useParams();
  return <PageView room={room} slug={slug} />;
}
