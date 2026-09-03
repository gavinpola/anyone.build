import type { ComponentType } from "react";
import type { PageMeta, PageModule } from "@/kit";

// Every file in src/rooms/<room>/pages is a page at /r/<room>/<slug>. Adding one never touches another file.
const modules = import.meta.glob<PageModule>("/src/rooms/*/pages/*.tsx", { eager: true });
// Dev/e2e only: example pages so the route and the picker can be exercised on a fresh clone.
const examples: Record<string, PageModule> =
  import.meta.env.DEV && import.meta.env.VITE_E2E_BLOCKS === "1" ? import.meta.glob<PageModule>("/docs/examples/pages/*.tsx", { eager: true }) : {};

export type PageEntry = { room: string; path: string; meta: PageMeta; Component: ComponentType };

export const pages: PageEntry[] = Object.entries({ ...examples, ...modules })
  .map(([p, mod]) => {
    const path = p.slice(1);
    const room = path.match(/^src\/rooms\/([a-z0-9-]+)\//)?.[1] ?? "main";
    return { room, path, meta: mod.page, Component: mod.default };
  })
  .filter((e) => e.meta && e.Component)
  .sort((a, b) => a.meta.title.localeCompare(b.meta.title));

export function pagesFor(room: string): PageEntry[] {
  return pages.filter((p) => p.room === room);
}

export function findPage(room: string, slug: string): PageEntry | null {
  return pages.find((p) => p.room === room && p.meta.slug === slug) ?? null;
}
