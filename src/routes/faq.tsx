import { createFileRoute } from "@tanstack/react-router";
import { FaqPage } from "@/core/pages/FaqPage";

export const Route = createFileRoute("/faq")({
  component: FaqPage,
});
