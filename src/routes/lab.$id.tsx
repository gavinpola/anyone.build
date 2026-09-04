import { createFileRoute } from "@tanstack/react-router";
import { BlockLab } from "@/core/room/BlockLab";

/** /lab/<block id>: one block alone. The playtest in CI drives it; people can peek too. */
export const Route = createFileRoute("/lab/$id")({
  component: Lab,
});

function Lab() {
  const { id } = Route.useParams();
  return <BlockLab id={id} />;
}
