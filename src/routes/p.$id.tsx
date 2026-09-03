import { createFileRoute } from "@tanstack/react-router";
import { LeaderboardPage } from "@/core/leaderboard/LeaderboardPage";

/** A shared proposal: the vote board, scrolled to the row, with a bar saying who asked for what. */
export const Route = createFileRoute("/p/$id")({
  component: SharedProposal,
});

function SharedProposal() {
  const { id } = Route.useParams();
  return <LeaderboardPage focus={id} />;
}
