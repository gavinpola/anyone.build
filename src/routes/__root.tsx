import { createRootRoute, Outlet } from "@tanstack/react-router";
import { AppShell } from "@/core/layout/AppShell";

export const Route = createRootRoute({
  component: () => (
    <AppShell>
      <Outlet />
    </AppShell>
  ),
  notFoundComponent: () => (
    <div className="mx-auto max-w-xl px-6 py-24 text-center">
      <p className="placard smallcaps">404</p>
      <h1 className="font-display text-4xl mt-2">Nothing hangs here yet.</h1>
      <p className="text-muted mt-3">Someone could change that.</p>
    </div>
  ),
});
