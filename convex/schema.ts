import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export const requestStatus = v.union(
  v.literal("judging"),
  v.literal("needs_human"),
  v.literal("proposed"), // safe + for-everyone but too big to auto-ship: up for a vote on the leaderboard
  v.literal("rejected"),
  v.literal("queued"),
  v.literal("building"),
  v.literal("validating"),
  v.literal("reviewing"),
  v.literal("preview"),
  v.literal("merging"),
  v.literal("live"),
  v.literal("failed"),
  v.literal("cancelled"),
);

export const rejectionCategory = v.union(
  v.literal("not_for_everyone"),
  v.literal("destroys_others_work"),
  v.literal("unsafe_code"),
  v.literal("out_of_bounds"),
  v.literal("unclear"),
  v.literal("too_big"),
  v.literal("collided"),
  v.literal("budget_spent"),
  v.literal("slow_down"),
  v.literal("build_failed"),
);

export const scope = v.union(v.literal("tiny"), v.literal("small"), v.literal("medium"), v.literal("large"));

export default defineSchema({
  users: defineTable({
    // identity comes from Better Auth; we mirror what the app needs
    authId: v.string(),
    githubId: v.optional(v.string()),
    handle: v.string(),
    name: v.optional(v.string()),
    avatarUrl: v.optional(v.string()),
    githubCreatedAt: v.optional(v.number()),
    publicRepos: v.optional(v.number()),
    followers: v.optional(v.number()),
    trust: v.number(), // 0 new · 1 builder · 2 trusted · 3 maintainer
    strikes: v.number(),
    banned: v.optional(v.boolean()),
    liveChanges: v.number(),
    linesChanged: v.number(),
    reverted: v.number(),
    createdAt: v.number(),
    lastSeenAt: v.number(),
  })
    .index("by_authId", ["authId"])
    .index("by_handle", ["handle"])
    .index("by_liveChanges", ["liveChanges"])
    .index("by_linesChanged", ["linesChanged"]),

  // Anyone can ask without an account. A guest is a browser-held secret id with a public tag;
  // signing in later binds the guest to the user and credits their earlier changes.
  guests: defineTable({
    guestId: v.string(), // secret to the browser; bearer token
    tag: v.string(), // public, shown as "guest · a3f9"
    userId: v.optional(v.id("users")), // set on claim; bound forever
    claimedAt: v.optional(v.number()),
    requests: v.number(),
    banned: v.optional(v.boolean()),
    createdAt: v.number(),
    lastSeenAt: v.number(),
  })
    .index("by_guestId", ["guestId"])
    .index("by_user", ["userId"]),

  guestTickets: defineTable({
    ticket: v.string(),
    guestId: v.string(),
    expiresAt: v.number(),
    used: v.boolean(),
  })
    .index("by_ticket", ["ticket"])
    .index("by_expiresAt", ["expiresAt"]),

  requests: defineTable({
    userId: v.optional(v.id("users")),
    guestId: v.optional(v.string()),
    roomId: v.string(),
    prompt: v.string(),
    target: v.object({
      path: v.string(),
      line: v.number(),
      blockId: v.optional(v.string()),
      tag: v.optional(v.string()),
      text: v.optional(v.string()),
    }),
    status: requestStatus,
    stage: v.optional(v.string()), // free-text sub-stage for the timeline ("cloning", "agent turn 4/15"…)
    verdict: v.optional(
      v.object({
        touchesBackend: v.optional(v.boolean()),
        approved: v.boolean(),
        category: v.optional(rejectionCategory),
        hint: v.string(),
        scope: scope,
        confidence: v.number(),
        plan: v.array(v.string()),
        redTeamed: v.boolean(),
        model: v.string(),
      }),
    ),
    run: v.optional(
      v.object({
        sandboxId: v.optional(v.string()),
        branch: v.optional(v.string()),
        baseSha: v.optional(v.string()),
        headSha: v.optional(v.string()),
        prNumber: v.optional(v.number()),
        prUrl: v.optional(v.string()),
        previewUrl: v.optional(v.string()),
        summary: v.optional(v.string()),
        filesTouched: v.optional(v.array(v.string())),
        linesAdded: v.optional(v.number()),
        linesRemoved: v.optional(v.number()),
        costCents: v.optional(v.number()),
        turns: v.optional(v.number()),
        startedAt: v.optional(v.number()),
        finishedAt: v.optional(v.number()),
        error: v.optional(v.string()),
        blockIds: v.optional(v.array(v.string())),
        mergeSha: v.optional(v.string()),
        securityRisk: v.optional(v.string()), // none | low | medium | high, from the security pass
        fastFailed: v.optional(v.boolean()), // the fast path's PR went red in CI; the sandbox is building instead
        collidedRetry: v.optional(v.boolean()), // the PR collided with a newer main once; rebuilt from the new base
      }),
    ),
    budgetCents: v.number(), // reserved cap for this request
    budgetDay: v.optional(v.string()), // the ET day the reservation was booked on
    settled: v.optional(v.boolean()), // budget settled exactly once
    plusOnes: v.number(),
    proposalVotes: v.optional(v.number()), // tally while status is "proposed"
    promotedFrom: v.optional(v.id("requests")), // set on the queued clone when a proposal wins
    pinnedUntil: v.optional(v.number()),
    workflowId: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_createdAt", ["createdAt"])
    .index("by_status", ["status", "createdAt"])
    .index("by_user", ["userId", "createdAt"])
    .index("by_guest", ["guestId", "createdAt"])
    .index("by_room", ["roomId", "createdAt"])
    .index("by_status_votes", ["status", "proposalVotes"]),

  // One vote per signed-in person on a proposal (a "proposed" request). Guests can't vote.
  proposalVotes: defineTable({
    requestId: v.id("requests"),
    userId: v.id("users"),
    createdAt: v.number(),
  })
    .index("by_request_user", ["requestId", "userId"])
    .index("by_user", ["userId"]),

  changes: defineTable({
    requestId: v.id("requests"),
    userId: v.optional(v.id("users")),
    guestId: v.optional(v.string()),
    roomId: v.string(),
    blockIds: v.array(v.string()),
    primaryBlockId: v.optional(v.string()),
    files: v.array(v.string()),
    linesAdded: v.number(),
    linesRemoved: v.number(),
    sha: v.string(),
    prNumber: v.number(),
    prUrl: v.string(),
    summary: v.string(),
    mergedAt: v.number(),
    revertedAt: v.optional(v.number()),
    revertedBy: v.optional(v.id("users")),
    flagCount: v.number(),
    votes: v.optional(v.number()),
  })
    .index("by_mergedAt", ["mergedAt"])
    .index("by_user", ["userId", "mergedAt"])
    .index("by_guest", ["guestId", "mergedAt"])
    .index("by_block", ["primaryBlockId", "mergedAt"])
    .index("by_request", ["requestId"]),

  votes: defineTable({
    changeId: v.id("changes"),
    userId: v.id("users"),
    createdAt: v.number(),
  })
    .index("by_change_user", ["changeId", "userId"])
    .index("by_user", ["userId"]),

  flags: defineTable({
    changeId: v.id("changes"),
    userId: v.id("users"),
    reason: v.string(),
    createdAt: v.number(),
  })
    .index("by_change", ["changeId"])
    .index("by_change_user", ["changeId", "userId"]),

  // Daily auction for the next day's patron slot. A bid is an authorization hold on the bidder's card;
  // at midnight Eastern Time the highest is captured and every other hold is released.
  bids: defineTable({
    slotDay: v.string(), // YYYY-MM-DD (UTC) of the slot being bid on
    userId: v.id("users"),
    name: v.string(),
    url: v.optional(v.string()),
    blurb: v.optional(v.string()),
    logoId: v.optional(v.id("_storage")),
    email: v.optional(v.string()),
    amountCents: v.number(),
    checkoutSessionId: v.string(),
    paymentIntentId: v.optional(v.string()),
    status: v.union(
      v.literal("pending"), // checkout started, no hold yet
      v.literal("held"), // hold placed; in the running
      v.literal("won"), // captured
      v.literal("lost"), // released at close
      v.literal("cancelled"), // withdrawn or replaced by a higher bid from the same bidder
      v.literal("failed"), // capture failed at close
      v.literal("removed"), // maintainer removed
    ),
    clicks: v.number(),
    createdAt: v.number(),
    heldAt: v.optional(v.number()),
    resolvedAt: v.optional(v.number()),
  })
    .index("by_slot", ["slotDay", "status", "amountCents"])
    .index("by_session", ["checkoutSessionId"])
    .index("by_intent", ["paymentIntentId"])
    .index("by_user", ["userId", "slotDay"]),

  patronDays: defineTable({
    day: v.string(), // the slot day
    closed: v.boolean(),
    winnerBidId: v.optional(v.id("bids")),
    winningCents: v.optional(v.number()),
    totalCents: v.number(), // sum of all holds at close (what people were willing to pay)
    bidCount: v.number(),
    changesFunded: v.number(),
  }).index("by_day", ["day"]),

  budgets: defineTable({
    day: v.string(),
    capCents: v.number(),
    spentCents: v.number(),
    reservedCents: v.number(),
    topUpCents: v.number(),
  }).index("by_day", ["day"]),

  config: defineTable({
    key: v.string(),
    value: v.any(),
    updatedAt: v.number(),
  }).index("by_key", ["key"]),

  storeDocs: defineTable({
    namespace: v.string(),
    key: v.string(),
    value: v.any(),
    by: v.optional(v.string()), // handle
    byUserId: v.optional(v.id("users")),
    byAnonId: v.optional(v.string()), // a signed-out writer: this tab's id; only they can overwrite it (or remove it, unless the namespace is an open: whiteboard)
    at: v.number(),
    bytes: v.number(),
  })
    .index("by_namespace", ["namespace", "at"])
    .index("by_namespace_key", ["namespace", "key"]),

  storeNamespaces: defineTable({
    namespace: v.string(),
    count: v.number(),
    bytes: v.number(),
  }).index("by_namespace", ["namespace"]),

  stats: defineTable({
    key: v.string(), // "global"
    changesAllTime: v.number(),
    requestsAllTime: v.number(),
    revenueCents: v.number(),
    viewsAllTime: v.optional(v.number()),
  }).index("by_key", ["key"]),

  // Presence without fan-out: one doc per tab (upserted once a minute) + per-minute counters.
  // Live cursors: one throttled row per active tab, positioned as a fraction (0..1) of the wall so it
  // maps across screen sizes. Swept with presence. Rendering is capped client-side; this is not a
  // firehose transport (see the roadmap note on a dedicated channel for true scale).
  cursors: defineTable({
    roomId: v.string(),
    sessionId: v.string(),
    x: v.number(),
    y: v.number(),
    hue: v.number(),
    name: v.optional(v.string()),
    at: v.number(),
  })
    .index("by_room_session", ["roomId", "sessionId"])
    .index("by_room_at", ["roomId", "at"]),

  presenceSessions: defineTable({
    roomId: v.string(),
    sessionId: v.string(),
    minute: v.number(),
  }).index("by_room_session", ["roomId", "sessionId"]),

  presenceBuckets: defineTable({
    roomId: v.string(),
    minute: v.number(),
    count: v.number(),
  }).index("by_room_minute", ["roomId", "minute"]),

  // One in-flight build per block; global concurrency is a config value.
  buildLocks: defineTable({
    key: v.string(), // "block:<roomId>:<blockId>" or "global"
    requestId: v.id("requests"),
    lockedAt: v.number(),
  }).index("by_key", ["key"]),

  mergeLock: defineTable({
    key: v.string(), // "main"
    requestId: v.optional(v.id("requests")),
    lockedAt: v.optional(v.number()),
  }).index("by_key", ["key"]),

  // First-party, cookieless analytics: daily aggregates only, no IPs, no user ids.
  dayStats: defineTable({
    day: v.string(),
    views: v.number(),
    uniques: v.number(),
    clicks: v.number(),
  }).index("by_day", ["day"]),

  routeViews: defineTable({
    day: v.string(),
    route: v.string(),
    views: v.number(),
  }).index("by_day_route", ["day", "route"]),

  visitors: defineTable({
    day: v.string(),
    sessionHash: v.string(), // per-tab random id, hashed; never an IP
  }).index("by_day_session", ["day", "sessionHash"]),

  // "For your site": a customer's site that embeds ask.js. The key is public; the origin is the fence.
  sites: defineTable({
    ownerId: v.id("users"),
    key: v.string(),
    name: v.string(),
    origin: v.string(),
    tier: v.union(v.literal("notes"), v.literal("drafts"), v.literal("ships")),
    notes: v.number(),
    open: v.number(),
    createdAt: v.number(),
    lastNoteAt: v.optional(v.number()),
  })
    .index("by_key", ["key"])
    .index("by_owner", ["ownerId"]),

  // A visitor pointed at something on a customer's site and said what should change.
  notes: defineTable({
    siteId: v.id("sites"),
    url: v.string(),
    path: v.string(),
    title: v.optional(v.string()),
    selector: v.string(),
    elementText: v.string(),
    html: v.string(),
    note: v.string(),
    viewport: v.optional(v.string()),
    status: v.union(v.literal("new"), v.literal("done"), v.literal("dismissed")),
    triage: v.optional(v.object({ kind: v.string(), summary: v.string(), model: v.string() })),
    createdAt: v.number(),
  })
    .index("by_site", ["siteId", "createdAt"])
    .index("by_site_status", ["siteId", "status", "createdAt"]),

  /** High scores for games on the wall: one row per person per game (their best), top 50 kept. */
  scores: defineTable({
    game: v.string(),
    score: v.number(),
    handle: v.string(),
    owner: v.string(), // u:<userId> or a:<anonId>
    userId: v.optional(v.id("users")),
    at: v.number(),
  })
    .index("by_game_score", ["game", "score"])
    .index("by_game_owner", ["game", "owner"]),

  /**
   * Decay: each block has a clock that resets when someone touches it (plays, clicks, moves, changes it).
   * When the clock runs out the block fades (hidden from the wall, never deleted; a touch revives it).
   */
  blockLife: defineTable({
    roomId: v.string(),
    blockId: v.string(),
    lastTouchedAt: v.number(),
    touches: v.number(),
    fadedAt: v.optional(v.number()),
  }).index("by_room_block", ["roomId", "blockId"]),

  /** The wall, every hour: a frame per hour from a scheduled screenshot, kept 30 days. */
  timelapse: defineTable({
    at: v.number(),
    storageId: v.id("_storage"),
    width: v.number(),
    height: v.number(),
    bytes: v.number(),
    changes: v.number(),
    here: v.number(),
  }).index("by_at", ["at"]),

  webhookEvents: defineTable({
    source: v.union(v.literal("github"), v.literal("vercel"), v.literal("stripe")),
    eventId: v.string(),
    type: v.string(),
    receivedAt: v.number(),
  }).index("by_source_event", ["source", "eventId"]),
});
