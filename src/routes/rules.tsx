import { createFileRoute } from "@tanstack/react-router";
import { RulesPage } from "@/core/pages/RulesPage";

export const Route = createFileRoute("/rules")({
  component: RulesPage,
});
