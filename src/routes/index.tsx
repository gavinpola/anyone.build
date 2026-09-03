import { createFileRoute } from "@tanstack/react-router";
import { RoomPage } from "@/core/layout/RoomPage";

export const Route = createFileRoute("/")({
  component: RoomPage,
});
