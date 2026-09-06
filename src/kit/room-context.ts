import { createContext, useContext } from "react";

/** Which room the current block or page belongs to. Set by the wall and by page routes. */
export const RoomContext = createContext<string>("main");

export function useRoomId(): string {
  return useContext(RoomContext);
}

/** Which block the current component is inside. Set by the wall, the stacked wall, and the lab. */
export const BlockContext = createContext<string | null>(null);

export function useBlockId(): string | null {
  return useContext(BlockContext);
}
