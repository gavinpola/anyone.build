import { createFileRoute } from "@tanstack/react-router";
import { PrivacyPage } from "@/core/pages/PrivacyPage";

export const Route = createFileRoute("/privacy")({
  component: PrivacyPage,
});
