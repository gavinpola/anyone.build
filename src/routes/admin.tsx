import { createFileRoute } from "@tanstack/react-router";
import { AdminPage } from "@/core/admin/AdminPage";

export const Route = createFileRoute("/admin")({
  component: AdminPage,
});
