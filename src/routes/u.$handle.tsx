import { createFileRoute } from "@tanstack/react-router";
import { BuilderPage } from "@/core/builders/BuilderPage";

/** A builder's page: /u/<handle>. What they changed on the wall, each change a link onto it. */
export const Route = createFileRoute("/u/$handle")({
  component: Builder,
});

function Builder() {
  const { handle } = Route.useParams();
  return <BuilderPage handle={handle} />;
}
