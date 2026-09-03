import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { useRoomId } from "./room-context";

/** A link to one of the room's pages (src/rooms/<room>/pages/<slug>.tsx). The only in-app navigation a block may do. */
export function PageLink({ to, className, children }: { to: string; className?: string; children: ReactNode }) {
  const room = useRoomId();
  return (
    <Link to="/r/$room/$slug" params={{ room, slug: to }} className={className}>
      {children}
    </Link>
  );
}
