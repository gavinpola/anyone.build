import { RoomContext } from "@/kit/room-context";
import { BlockBoundary } from "@/core/lib/BlockBoundary";
import { room } from "@/rooms/main/room";
import { blocks } from "./Room";

/**
 * One block, alone, at full width: what the playtest (tests/blocks) and a curious human look at.
 * Same markup as the wall (data-ab-block, frame, boundary) so behaviour matches.
 */
export function BlockLab({ id }: { id: string }) {
  const b = blocks.find((x) => x.meta.id === id);
  if (!b) {
    return (
      <div className="mx-auto max-w-[960px] px-4 py-10" data-lab="missing">
        <p className="text-[15px] text-ink-2">No block called “{id}”.</p>
        <p className="placard mt-2">{blocks.map((x) => x.meta.id).join(" · ") || "no blocks yet"}</p>
      </div>
    );
  }
  const { meta, Component, path } = b;
  return (
    <RoomContext.Provider value={room.id}>
      <div className="mx-auto max-w-[960px] px-4 py-8" data-lab={meta.id}>
        <p className="placard mb-3">
          lab · {meta.title} · <span className="opacity-70">{path}</span>
        </p>
        <section data-ab-block={meta.id} data-ab-path={path} className="frame flex flex-col">
          <div className="frame-body flex-1">
            <BlockBoundary title={meta.title}>
              <Component />
            </BlockBoundary>
          </div>
        </section>
      </div>
    </RoomContext.Provider>
  );
}
