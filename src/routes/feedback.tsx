import { createFileRoute, redirect } from "@tanstack/react-router";

/** The board moved under Changes on the leaderboard; the form lives in the "?" card. Old links still land. */
export const Route = createFileRoute("/feedback")({
  beforeLoad: () => {
    throw redirect({ to: "/leaderboard", hash: "feedback" });
  },
});
