import { createFileRoute } from "@tanstack/react-router";
import { TermsPage } from "@/core/pages/TermsPage";

export const Route = createFileRoute("/terms")({
  component: TermsPage,
});
