/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as admin from "../admin.js";
import type * as analytics from "../analytics.js";
import type * as ask from "../ask.js";
import type * as auth from "../auth.js";
import type * as budget from "../budget.js";
import type * as config from "../config.js";
import type * as crons from "../crons.js";
import type * as cursors from "../cursors.js";
import type * as emails from "../emails.js";
import type * as flags from "../flags.js";
import type * as http from "../http.js";
import type * as kit_room from "../kit/room.js";
import type * as leaderboard from "../leaderboard.js";
import type * as lib_claim from "../lib/claim.js";
import type * as lib_days from "../lib/days.js";
import type * as lib_guest from "../lib/guest.js";
import type * as lib_notes from "../lib/notes.js";
import type * as maintenance from "../maintenance.js";
import type * as patrons from "../patrons.js";
import type * as payments from "../payments.js";
import type * as pipeline_build from "../pipeline/build.js";
import type * as pipeline_executor from "../pipeline/executor.js";
import type * as pipeline_fast from "../pipeline/fast.js";
import type * as pipeline_fastRules from "../pipeline/fastRules.js";
import type * as pipeline_github from "../pipeline/github.js";
import type * as pipeline_judge from "../pipeline/judge.js";
import type * as pipeline_source from "../pipeline/source.js";
import type * as pipeline_state from "../pipeline/state.js";
import type * as presence from "../presence.js";
import type * as proposals from "../proposals.js";
import type * as rateLimits from "../rateLimits.js";
import type * as requests from "../requests.js";
import type * as rooms_main_poll from "../rooms/main/poll.js";
import type * as sites from "../sites.js";
import type * as sitesTriage from "../sitesTriage.js";
import type * as stats from "../stats.js";
import type * as store from "../store.js";
import type * as turnstile from "../turnstile.js";
import type * as users from "../users.js";
import type * as votes from "../votes.js";
import type * as webhookHandlers from "../webhookHandlers.js";
import type * as webhookLog from "../webhookLog.js";
import type * as webhooks from "../webhooks.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  admin: typeof admin;
  analytics: typeof analytics;
  ask: typeof ask;
  auth: typeof auth;
  budget: typeof budget;
  config: typeof config;
  crons: typeof crons;
  cursors: typeof cursors;
  emails: typeof emails;
  flags: typeof flags;
  http: typeof http;
  "kit/room": typeof kit_room;
  leaderboard: typeof leaderboard;
  "lib/claim": typeof lib_claim;
  "lib/days": typeof lib_days;
  "lib/guest": typeof lib_guest;
  "lib/notes": typeof lib_notes;
  maintenance: typeof maintenance;
  patrons: typeof patrons;
  payments: typeof payments;
  "pipeline/build": typeof pipeline_build;
  "pipeline/executor": typeof pipeline_executor;
  "pipeline/fast": typeof pipeline_fast;
  "pipeline/fastRules": typeof pipeline_fastRules;
  "pipeline/github": typeof pipeline_github;
  "pipeline/judge": typeof pipeline_judge;
  "pipeline/source": typeof pipeline_source;
  "pipeline/state": typeof pipeline_state;
  presence: typeof presence;
  proposals: typeof proposals;
  rateLimits: typeof rateLimits;
  requests: typeof requests;
  "rooms/main/poll": typeof rooms_main_poll;
  sites: typeof sites;
  sitesTriage: typeof sitesTriage;
  stats: typeof stats;
  store: typeof store;
  turnstile: typeof turnstile;
  users: typeof users;
  votes: typeof votes;
  webhookHandlers: typeof webhookHandlers;
  webhookLog: typeof webhookLog;
  webhooks: typeof webhooks;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {
  rateLimiter: import("@convex-dev/rate-limiter/_generated/component.js").ComponentApi<"rateLimiter">;
  workflow: import("@convex-dev/workflow/_generated/component.js").ComponentApi<"workflow">;
  buildPool: import("@convex-dev/workpool/_generated/component.js").ComponentApi<"buildPool">;
  betterAuth: import("@convex-dev/better-auth/_generated/component.js").ComponentApi<"betterAuth">;
};
