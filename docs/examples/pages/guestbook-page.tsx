import { useState } from "react";
import { Button, Heading, Input, Stack, Text, useStore, useViewer, type PageMeta } from "@/kit";

/** Example page (dev/e2e only): a whole screen instead of a block, same kit. */
export const page: PageMeta = {
  slug: "guestbook-page",
  title: "Guestbook",
  description: "A page where visitors leave one line each.",
};

export default function GuestbookPage() {
  const { docs, put } = useStore<{ line: string }>("guestbook-page");
  const viewer = useViewer();
  const [line, setLine] = useState("");
  return (
    <Stack className="p-6 sm:p-8" gap={4}>
      <Heading level={1}>Sign the guestbook</Heading>
      <Text>One line each. It stays.</Text>
      <form
        className="flex flex-col gap-2 sm:flex-row"
        onSubmit={(e) => {
          e.preventDefault();
          if (!line.trim()) return;
          put(viewer.handle, { line: line.trim().slice(0, 140) });
          setLine("");
        }}
      >
        <Input value={line} onChange={(e) => setLine(e.target.value)} placeholder={viewer.signedIn ? "Say hi" : "Sign in to sign"} disabled={!viewer.signedIn} />
        <Button type="submit" disabled={!viewer.signedIn}>
          Sign
        </Button>
      </form>
      <ul className="flex flex-col gap-1.5">
        {docs.map((d) => (
          <li key={d.key} className="text-[15px]">
            <span className="text-muted">@{d.by ?? d.key}</span> {d.value.line}
          </li>
        ))}
      </ul>
    </Stack>
  );
}
