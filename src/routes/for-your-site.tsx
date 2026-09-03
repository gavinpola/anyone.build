import { createFileRoute } from "@tanstack/react-router";
import { ForYourSitePage } from "@/core/pages/ForYourSitePage";

export const Route = createFileRoute("/for-your-site")({
  component: ForYourSitePage,
});
