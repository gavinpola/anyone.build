import type { FeedRequest, RejectionCategory, Target } from "./types";

/**
 * A local stand-in for the Convex pipeline so the whole UX can be exercised with no backend
 * (fresh clone, no keys). It judges with a couple of keyword rules and then walks a request
 * through the real status sequence with realistic timings.
 */
type Listener = () => void;
const listeners = new Set<Listener>();
let requests: FeedRequest[] = [];

function emit() {
  for (const l of listeners) l();
}

export function subscribe(l: Listener) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function getSnapshot() {
  return requests;
}

function patch(id: string, p: Partial<FeedRequest>) {
  requests = requests.map((r) => (r.id === id ? { ...r, ...p, updatedAt: Date.now() } : r));
  emit();
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

function judge(prompt: string): { approved: boolean; category?: RejectionCategory; hint: string } {
  const p = prompt.toLowerCase();
  if (/(https?:\/\/|\.com|\.io|buy|discount|promo|follow me|my startup)/.test(p))
    return { approved: false, category: "not_for_everyone", hint: "Promo, ads, or links go on the patron board, not the wall." };
  if (/(delete everything|remove all|wipe|nuke|blank the)/.test(p))
    return { approved: false, category: "destroys_others_work", hint: "Build on it, or say why it should go." };
  if (/(script|iframe|track|cookie|fetch|api key|env|secret|convex)/.test(p))
    return { approved: false, category: "unsafe_code", hint: "No scripts, trackers, forms that leave, or off-site calls." };
  if (p.length < 8) return { approved: false, category: "unclear", hint: "Point at the thing and say what it should become." };
  return { approved: true, hint: "Looks good for everyone." };
}

export async function submit(input: { prompt: string; target: Target; handle: string; avatarUrl: string | null }) {
  const id = `mock-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  const now = Date.now();
  const req: FeedRequest = {
    id,
    user: { handle: input.handle, avatarUrl: input.avatarUrl },
    prompt: input.prompt,
    target: input.target,
    status: "judging",
    plusOnes: 0,
    createdAt: now,
    updatedAt: now,
    mine: true,
  };
  requests = [req, ...requests];
  emit();

  await wait(1400 + Math.random() * 900);
  const v = judge(input.prompt);
  if (!v.approved) {
    patch(id, { status: "rejected", verdict: { approved: false, category: v.category, hint: v.hint, scope: "tiny" } });
    return id;
  }
  patch(id, { status: "queued", verdict: { approved: true, hint: v.hint, scope: "small" }, pinnedUntil: Date.now() + 60_000 });
  await wait(900);
  patch(id, { status: "building", stage: "cloning the wall" });
  await wait(2500);
  patch(id, { status: "building", stage: "agent · turn 3" });
  await wait(3500);
  patch(id, { status: "validating", stage: "typecheck · lint · build" });
  await wait(2200);
  patch(id, { status: "reviewing", stage: "second opinion on the diff" });
  await wait(1800);
  patch(id, {
    status: "preview",
    run: { previewUrl: "https://anyone-build-preview.vercel.app", prUrl: "https://github.com/anyone-build/anyone.build/pull/1", linesAdded: 14, linesRemoved: 3, summary: "Did the thing you asked, and nothing else." },
  });
  await wait(4000);
  patch(id, { status: "merging", stage: "rebasing on main" });
  await wait(2500);
  patch(id, { status: "live", stage: undefined, pinnedUntil: Date.now() + 60_000 });
  return id;
}

export function cancel(id: string) {
  const r = requests.find((x) => x.id === id);
  if (!r || ["live", "rejected", "failed", "cancelled"].includes(r.status)) return;
  patch(id, { status: "cancelled", stage: undefined });
}

export function plusOne(id: string) {
  const r = requests.find((x) => x.id === id);
  if (r) patch(id, { plusOnes: r.plusOnes + 1 });
}
