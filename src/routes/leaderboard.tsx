import { createFileRoute } from "@tanstack/react-router";
import { LeaderboardPage } from "@/core/leaderboard/LeaderboardPage";

export const Route = createFileRoute("/leaderboard")({
  component: LeaderboardPage,
});
