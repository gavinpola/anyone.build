import { createAuthClient } from "better-auth/react";
import { anonymousClient } from "better-auth/client/plugins";
import { convexClient, crossDomainClient } from "@convex-dev/better-auth/client/plugins";

const siteUrl = import.meta.env.VITE_CONVEX_SITE_URL as string | undefined;
/** Dev only: lets a fresh clone sign in without a GitHub OAuth app (server must set DEV_ANON_AUTH=1). */
export const devAnonAuth = import.meta.env.VITE_DEV_ANON_AUTH === "1";

export const authClient = siteUrl
  ? createAuthClient({ baseURL: siteUrl, plugins: [convexClient(), crossDomainClient(), anonymousClient()] })
  : null;
