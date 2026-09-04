import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";

/**
 * Small operational endpoints, guarded by the ops token (the same secret the timelapse uploads with).
 * POST /ops/snapshot { snapshotId } after scripts/refresh-snapshot.mjs, so agent builds start from a
 * snapshot that matches the lockfile. Nothing here touches anyone's data.
 */
function authorized(request: Request): boolean {
  const token = process.env.OPS_TOKEN || process.env.TIMELAPSE_TOKEN;
  const auth = request.headers.get("authorization") ?? "";
  return Boolean(token) && auth === `Bearer ${token}`;
}

export const snapshot = httpAction(async (ctx, request) => {
  if (!authorized(request)) return new Response("nope", { status: 401 });
  let body: { snapshotId?: unknown } = {};
  try {
    body = (await request.json()) as { snapshotId?: unknown };
  } catch {
    return new Response("json body expected", { status: 400 });
  }
  const id = typeof body.snapshotId === "string" ? body.snapshotId.trim() : "";
  if (!/^snap_[A-Za-z0-9_-]{4,80}$/.test(id)) return new Response("bad snapshot id", { status: 400 });
  await ctx.runMutation(internal.config.setInternal, { key: "sandboxSnapshotId", value: id });
  return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { "content-type": "application/json" } });
});
