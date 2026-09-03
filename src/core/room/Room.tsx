import type { BlockModule } from "@/kit";
import { PageLink } from "@/kit/PageLink";
import { RoomContext } from "@/kit/room-context";
import { pagesFor } from "./pages";
import { cn } from "@/core/lib/cn";
import { BlockBoundary } from "@/core/lib/BlockBoundary";
import { room } from "@/rooms/main/room";

// Every file in src/rooms/main/blocks is a block. Adding one never touches another file.
const modules = import.meta.glob<BlockModule>("/src/rooms/main/blocks/*.tsx", {
  eager: true,
});
// Dev/e2e only: hang the example blocks so every picker granularity can be exercised on a fresh clone.
const examples: Record<string, BlockModule> =
  import.meta.env.DEV && import.meta.env.VITE_E2E_BLOCKS === "1"
    ? import.meta.glob<BlockModule>("/docs/examples/blocks/*.tsx", {
        eager: true,
      })
    : {};

export const blocks = Object.entries({ ...examples, ...modules })
  .map(([path, mod]) => ({
    path: path.slice(1),
    meta: mod.block,
    Component: mod.default,
  }))
  .filter((b) => b.meta && b.Component)
  .sort(
    (a, b) => a.meta.order - b.meta.order || a.meta.id.localeCompare(b.meta.id),
  );

const NEW_BLOCK_PATH = `src/rooms/${room.id}/blocks/`;

const span: Record<string, string> = {
  sm: "lg:col-span-4 md:col-span-6",
  md: "lg:col-span-6 md:col-span-6",
  lg: "lg:col-span-8 md:col-span-12",
  full: "col-span-12",
};

export function Room() {
  const empty = blocks.length === 0;
  const pages = pagesFor(room.id);
  return (
    <RoomContext.Provider value={room.id}>
      <div className="grid grid-cols-12 gap-5" data-room={room.id}>
        {pages.length > 0 ? (
          <nav
            aria-label="Pages"
            className="col-span-12 flex flex-wrap items-center gap-2 px-1"
          >
            <span className="placard smallcaps">Pages</span>
            {pages.map((p) => (
              <PageLink
                key={p.meta.slug}
                to={p.meta.slug}
                className="rounded-md border border-line px-2.5 py-1 text-[13px] hover:bg-paper-2"
              >
                {p.meta.title}
              </PageLink>
            ))}
          </nav>
        ) : null}
        {blocks.map(({ meta, Component, path }) => (
          <section
            key={meta.id}
            data-ab-block={meta.id}
            data-ab-path={path}
            className={cn(
              "frame col-span-12 flex flex-col",
              span[meta.size] ?? span.md,
            )}
          >
            <div className="frame-body flex-1">
              <BlockBoundary title={meta.title}>
                <Component />
              </BlockBoundary>
            </div>
            </section>
        ))}

        {/* The open wall: pointing here means "add a block". Always present; it's the whole wall when empty. */}
        <section
          data-ab-block="__new__"
          data-ab-path={NEW_BLOCK_PATH}
          className={cn(
            "col-span-12 flex flex-col rounded-[var(--radius-frame)] border border-dashed border-line-2/70",
            empty ? "min-h-[62dvh]" : "min-h-[160px]",
          )}
        >
          <div className="frame-body flex flex-1 flex-col items-center justify-center p-8 text-center">
            {empty ? (
              <>
                <p className="placard smallcaps">The wall</p>
                <h1 className="mt-3 font-display text-4xl tracking-tight sm:text-6xl">
                  Nothing hangs here yet.
                </h1>
                <p className="mt-4 max-w-md text-[15px] text-ink-2">
                  Hold{" "}
                  <kbd className="rounded border border-line bg-paper-2 px-1 font-mono text-[12px]">
                    ⇧
                  </kbd>
                  <kbd className="ml-1 rounded border border-line bg-paper-2 px-1 font-mono text-[12px]">
                    ⌘
                  </kbd>
                  , click anywhere, say what should be here.
                </p>
              </>
            ) : (
              <p className="placard">
                Empty space. Point here to add something.
              </p>
            )}
          </div>
        </section>
      </div>
    </RoomContext.Provider>
  );
}
