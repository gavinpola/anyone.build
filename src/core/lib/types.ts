export type RequestStatus =
  | "judging"
  | "needs_human"
  | "rejected"
  | "queued"
  | "building"
  | "validating"
  | "reviewing"
  | "preview"
  | "merging"
  | "live"
  | "failed"
  | "cancelled";

export type RejectionCategory =
  | "not_for_everyone"
  | "destroys_others_work"
  | "unsafe_code"
  | "out_of_bounds"
  | "unclear"
  | "too_big"
  | "collided"
  | "budget_spent"
  | "slow_down"
  | "build_failed";

export type Scope = "tiny" | "small" | "medium" | "large";

export type Target = {
  path: string;
  line: number;
  blockId?: string;
  blockTitle?: string;
  tag?: string;
  text?: string;
};

export type FeedRequest = {
  id: string;
  user: { handle: string; avatarUrl: string | null };
  prompt: string;
  target: Target;
  status: RequestStatus;
  stage?: string;
  verdict?: { approved: boolean; category?: RejectionCategory; hint: string; scope: Scope };
  run?: {
    previewUrl?: string;
    prUrl?: string;
    summary?: string;
    linesAdded?: number;
    linesRemoved?: number;
    costCents?: number;
  };
  plusOnes: number;
  createdAt: number;
  updatedAt: number;
  pinnedUntil?: number;
  mine?: boolean;
};

export const REJECTION_COPY: Record<RejectionCategory, { title: string; hint: string }> = {
  not_for_everyone: { title: "Not for everyone", hint: "Promo, ads, or links go on the patron board, not the wall." },
  destroys_others_work: { title: "That erases someone's work", hint: "Build on it, or say why it should go." },
  unsafe_code: { title: "Can't ship that", hint: "No scripts, trackers, forms that leave, or off-site calls." },
  out_of_bounds: { title: "Out of bounds", hint: "Only the wall itself can change, not the machinery behind it." },
  unclear: { title: "Couldn't tell what to change", hint: "Point at the thing and say what it should become." },
  too_big: { title: "Too big for one change", hint: "Split it into a couple of smaller asks." },
  collided: { title: "Someone else got there first", hint: "The wall moved under you. Try again on the new version." },
  budget_spent: { title: "Today's budget is spent", hint: "Patrons top it up. Or come back after midnight ET." },
  slow_down: { title: "Slow down", hint: "You've hit your limit for now." },
  build_failed: { title: "The build didn't pass", hint: "The agent couldn't make it work cleanly. Try a smaller ask." },
};

export const STATUS_STEPS: Array<{ key: string; label: string; statuses: RequestStatus[] }> = [
  { key: "judged", label: "Judged", statuses: ["judging"] },
  { key: "building", label: "Building", statuses: ["queued", "building", "validating", "reviewing"] },
  { key: "preview", label: "Preview", statuses: ["preview"] },
  { key: "merging", label: "Merging", statuses: ["merging"] },
  { key: "live", label: "Live", statuses: ["live"] },
];

export function stepIndex(status: RequestStatus): number {
  const i = STATUS_STEPS.findIndex((s) => s.statuses.includes(status));
  return i === -1 ? -1 : i;
}

export const STAGE_COPY: Partial<Record<RequestStatus, string>> = {
  judging: "Judging",
  needs_human: "Waiting for a maintainer",
  queued: "In line",
  building: "Writing the code",
  validating: "Checking the diff",
  reviewing: "Second opinion",
  preview: "Preview ready",
  merging: "Merging",
  live: "Live",
  rejected: "Rejected",
  failed: "Failed",
  cancelled: "Cancelled",
};
