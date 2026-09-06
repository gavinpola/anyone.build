"use node";
import { v } from "convex/values";
import { internalAction } from "../_generated/server";
import { lintFiles } from "../../packages/gatekeeper/src/lint/lint-files.js";

/**
 * Does the AST floor run here? A diagnostic for the deployment: lint one file by path and content the
 * way the pipeline does before a commit. `npx convex run pipeline/lintCheck:probe '{"path":"src/rooms/main/blocks/x.tsx","content":"..."}'`
 */
export const probe = internalAction({
  args: { path: v.string(), content: v.string() },
  handler: async (_ctx, { path, content }) => lintFiles([{ path, content }]),
});
