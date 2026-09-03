import { createFileRoute } from "@tanstack/react-router";
import { SitesPage } from "@/core/sites/SitesPage";

export const Route = createFileRoute("/sites")({
  component: SitesPage,
});
