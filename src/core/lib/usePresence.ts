import { useEffect } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { hasConvex } from "./providers";
import { tabSessionId } from "./session";

function useRoomPresenceCountConvex(roomId = "main"): number {
  const beat = useMutation(api.presence.heartbeat);
  const online = useQuery(api.presence.online, { roomId });
  useEffect(() => {
    let stop = false;
    const send = () => {
      if (stop || document.visibilityState !== "visible") return;
      void beat({ roomId, sessionId: tabSessionId() }).catch(() => {});
    };
    send();
    const t = setInterval(send, 60_000);
    document.addEventListener("visibilitychange", send);
    return () => {
      stop = true;
      clearInterval(t);
      document.removeEventListener("visibilitychange", send);
    };
  }, [beat, roomId]);
  return Math.max(1, online ?? 1);
}
function useRoomPresenceCountMock(): number {
  return 1;
}
export const useRoomPresenceCount: (roomId?: string) => number = hasConvex ? useRoomPresenceCountConvex : useRoomPresenceCountMock;
