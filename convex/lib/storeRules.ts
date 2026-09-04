/**
 * Who may remove a kit-store doc. Plain namespaces are author-owned: by account for signed-in
 * people, by browser tab for signed-out ones. A namespace that starts with `open:` is a whiteboard:
 * anyone may remove any doc in it (an eraser on a shared canvas). Maintainers (trust 3) may remove
 * anything. Overwrites stay author-only everywhere; this is only about removal.
 */
export const OPEN_PREFIX = "open:";

export function isOpenNamespace(namespace: string): boolean {
  return namespace.startsWith(OPEN_PREFIX);
}

export function canRemove(opts: { namespace: string; existing: { byUserId?: string | null; byAnonId?: string | null }; viewerId: string | null; trust: number; anon: string | undefined }): boolean {
  if (opts.trust >= 3) return true;
  if (isOpenNamespace(opts.namespace)) return true;
  const { existing, viewerId, anon } = opts;
  if (viewerId) return existing.byUserId === viewerId;
  return !existing.byUserId && !!anon && existing.byAnonId === anon;
}
