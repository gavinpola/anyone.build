import { useState } from "react";
import { Button, Input, Label, Stack, Text, useStore } from "@/kit";
import type { BlockMeta } from "@/kit";

export const block: BlockMeta = {
  id: "guestbook",
  title: "Guestbook",
  description: "Leave one line. The newest twenty are shown.",
  order: 20,
  size: "md",
};

type Entry = { text: string };

export default function Guestbook() {
  const { docs, put } = useStore<Entry>("guestbook");
  const [draft, setDraft] = useState("");
  const entries = [...docs].sort((a, b) => b.at - a.at).slice(0, 20);

  function submit() {
    const text = draft.trim().slice(0, 140);
    if (!text) return;
    put(`${Date.now()}`, { text });
    setDraft("");
  }

  return (
    <Stack className="p-5" gap={3}>
      <Label>Guestbook</Label>
      <div className="flex gap-2">
        <Input
          value={draft}
          maxLength={140}
          placeholder="Say something small"
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
        />
        <Button onClick={submit} disabled={!draft.trim()}>
          Sign
        </Button>
      </div>
      <Stack gap={1}>
        {entries.length === 0 ? (
          <Text muted className="text-[13px]">Nobody has signed yet.</Text>
        ) : (
          entries.map((e) => (
            <div key={e.key} className="flex items-baseline gap-2 border-t border-line py-2 first:border-t-0">
              <span className="placard shrink-0">@{e.by ?? "someone"}</span>
              <span className="text-[14px] text-ink-2">{e.value.text}</span>
            </div>
          ))
        )}
      </Stack>
    </Stack>
  );
}
