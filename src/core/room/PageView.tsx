import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { RoomContext } from "@/kit/room-context";
import { BlockBoundary } from "@/core/lib/BlockBoundary";
import { Placard } from "@/core/lib/Placard";
import { FeedRail } from "@/core/feed/FeedRail";
import { findPage } from "./pages";

/** A room page: one agent-written file rendered as its own route, pickable like a block. */
export function PageView({ room, slug }: { room: string; slug: string }) {
  const page = findPage(room, slug);
  if (!page) {
    return (
      <div className="mx-auto max-w-[680px] px-4 py-16 text-center">
        <p className="placard smallcaps">No such page</p>
        <h1 className="mt-3 font-display text-3xl">Nothing at /r/{room}/{slug}.</h1>
        <p className="mt-3 text-[15px] text-ink-2">Pages are made the same way as everything else here: point at the wall and ask for one.</p>
        <Link to="/" className="mt-6 inline-flex items-center gap-1.5 text-[15px] text-accent hover:underline underline-offset-2">
          <ArrowLeft size={15} /> The wall
        </Link>
      </div>
    );
  }
  const { meta, Component, path } = page;
  const blockId = `page:${meta.slug}`;
  return (
    <RoomContext.Provider value={room}>
      <div className="mx-auto max-w-[1440px] px-4 py-6 sm:px-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <Link to="/" className="inline-flex items-center gap-1.5 text-[14px] text-accent hover:underline underline-offset-2">
            <ArrowLeft size={14} /> The wall
          </Link>
          <span className="placard truncate">
            /r/{room}/{meta.slug}
          </span>
        </div>
        <section data-ab-block={blockId} data-ab-path={path} className="frame flex min-h-[50dvh] flex-col">
          <div className="frame-body flex-1">
            <BlockBoundary title={meta.title}>
              <Component />
            </BlockBoundary>
          </div>
          <Placard blockId={blockId} title={meta.title} path={path} />
        </section>
        <FeedRail />
      </div>
    </RoomContext.Provider>
  );
}
