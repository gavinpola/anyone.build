import { createContext, useContext } from "react";

/** Which room the current block or page belongs to. Set by the wall and by page routes. */
export const RoomContext = createContext<string>("main");

export function useRoomId(): string {
  return useContext(RoomContext);
}
