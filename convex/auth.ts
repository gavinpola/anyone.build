import { createClient, type AuthFunctions, type GenericCtx } from "@convex-dev/better-auth";
import { convex, crossDomain } from "@convex-dev/better-auth/plugins";
import { betterAuth, type BetterAuthOptions } from "better-auth/minimal";
import { anonymous } from "better-auth/plugins";
import { components, internal } from "./_generated/api";
import type { DataModel } from "./_generated/dataModel";
import { query } from "./_generated/server";
import authConfig from "./auth.config";
import { mirrorAuthUser } from "./users";

const siteUrl = process.env.SITE_URL ?? "http://localhost:5173";

// The component calls back into these internal mutations when users are created/updated.
const authFunctions: AuthFunctions = internal.auth;

export const authComponent = createClient<DataModel>(components.betterAuth, {
  authFunctions,
  triggers: {
    user: {
      onCreate: async (ctx, authUser) => {
        await mirrorAuthUser(ctx, authUser as unknown as AuthUserLike);
      },
      onUpdate: async (ctx, newUser) => {
        await mirrorAuthUser(ctx, newUser as unknown as AuthUserLike);
      },
    },
  },
});

export const { onCreate, onUpdate, onDelete } = authComponent.triggersApi();

export type AuthUserLike = {
  _id: string;
  name?: string | null;
  email?: string | null;
  image?: string | null;
  handle?: string | null;
  githubId?: string | null;
  githubCreatedAt?: number | null;
  publicRepos?: number | null;
  followers?: number | null;
};

type GithubProfileLike = {
  id: string | number;
  login: string;
  created_at?: string;
  public_repos?: number;
  followers?: number;
};

export const createAuth = (ctx: GenericCtx<DataModel>) => {
  return betterAuth({
    baseURL: process.env.CONVEX_SITE_URL,
    trustedOrigins: [siteUrl],
    database: authComponent.adapter(ctx),
    emailAndPassword: { enabled: false },
    user: {
      additionalFields: {
        handle: { type: "string", required: false, input: false },
        githubId: { type: "string", required: false, input: false },
        githubCreatedAt: { type: "number", required: false, input: false },
        publicRepos: { type: "number", required: false, input: false },
        followers: { type: "number", required: false, input: false },
      },
    },
    socialProviders: {
      github: {
        clientId: process.env.GITHUB_CLIENT_ID ?? "",
        clientSecret: process.env.GITHUB_CLIENT_SECRET ?? "",
        scope: ["read:user", "user:email"],
        mapProfileToUser: (raw) => {
          const profile = raw as unknown as GithubProfileLike;
          return {
            handle: profile.login,
            githubId: String(profile.id),
            githubCreatedAt: profile.created_at ? Date.parse(profile.created_at) : undefined,
            publicRepos: profile.public_repos,
            followers: profile.followers,
          };
        },
      },
    },
    plugins: [
      crossDomain({ siteUrl }),
      convex({ authConfig }),
      // Dev only. Never set DEV_ANON_AUTH in production: anonymous users bypass the GitHub identity gate.
      ...(process.env.DEV_ANON_AUTH === "1" ? [anonymous()] : []),
    ],
  } satisfies BetterAuthOptions);
};

export const getAuthUser = query({
  args: {},
  handler: async (ctx) => {
    return authComponent.safeGetAuthUser(ctx);
  },
});
