import {
  bigint,
  boolean,
  date,
  index,
  int,
  json,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
}, table => [uniqueIndex("users_email_unique_idx").on(table.email)]);

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Administrator-created account reservations. A reservation is activated only after GitHub OAuth
 * returns the exact same verified email address; no OAuth subject or credential is stored here.
 */
export const preProvisionedAccounts = mysqlTable(
  "pre_provisioned_accounts",
  {
    id: bigint("id", { mode: "number" }).autoincrement().primaryKey(),
    email: varchar("email", { length: 320 }).notNull(),
    introductoryCreditNanos: bigint("introductoryCreditNanos", { mode: "number" }).notNull(),
    provisionedByUserId: int("provisionedByUserId").references(() => users.id, { onDelete: "set null" }),
    activatedUserId: int("activatedUserId").unique().references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    activatedAt: timestamp("activatedAt"),
  },
  table => [
    uniqueIndex("pre_provisioned_accounts_email_unique_idx").on(table.email),
    index("pre_provisioned_accounts_activation_idx").on(table.activatedAt, table.createdAt),
  ],
);

/** One compact shareable affiliate code per account. The user relationship and code are both unique. */
export const referralCodes = mysqlTable(
  "referral_codes",
  {
    id: bigint("id", { mode: "number" }).autoincrement().primaryKey(),
    userId: int("userId").notNull().unique().references(() => users.id, { onDelete: "cascade" }),
    code: varchar("code", { length: 4 }).notNull().unique(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [index("referral_codes_code_idx").on(table.code)],
);

/** A referred account can be rewarded once, preventing duplicate or self-referral credit grants. */
export const referralAttributions = mysqlTable(
  "referral_attributions",
  {
    id: bigint("id", { mode: "number" }).autoincrement().primaryKey(),
    referrerUserId: int("referrerUserId").notNull().references(() => users.id, { onDelete: "cascade" }),
    referredUserId: int("referredUserId").notNull().unique().references(() => users.id, { onDelete: "cascade" }),
    rewardNanos: bigint("rewardNanos", { mode: "number" }).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [index("referral_attributions_referrer_time_idx").on(table.referrerUserId, table.createdAt)],
);

/** A durable reservation and receipt for the reusable 150-member special referral campaign. */
export const specialReferralClaims = mysqlTable(
  "special_referral_claims",
  {
    id: bigint("id", { mode: "number" }).autoincrement().primaryKey(),
    campaignKey: varchar("campaignKey", { length: 64 }).notNull(),
    slotNumber: int("slotNumber").notNull(),
    userId: int("userId").notNull().unique().references(() => users.id, { onDelete: "cascade" }),
    reservedAt: timestamp("reservedAt").defaultNow().notNull(),
    verifiedAt: timestamp("verifiedAt"),
    awardedAt: timestamp("awardedAt"),
    giftViewedAt: timestamp("giftViewedAt"),
  },
  table => [
    uniqueIndex("special_referral_claims_campaign_slot_unique_idx").on(table.campaignKey, table.slotNumber),
    index("special_referral_claims_campaign_verified_idx").on(table.campaignKey, table.verifiedAt, table.awardedAt),
  ],
);

/** First-party credentials. Passwords are stored only as salted scrypt derivations. */
export const passwordCredentials = mysqlTable(
  "password_credentials",
  {
    id: bigint("id", { mode: "number" }).autoincrement().primaryKey(),
    userId: int("userId").notNull().unique().references(() => users.id, { onDelete: "cascade" }),
    passwordHash: varchar("passwordHash", { length: 255 }).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [index("password_credentials_user_idx").on(table.userId)],
);

/** Stable external identities used for sign-in. Tokens are deliberately never stored here. */
export const oauthIdentities = mysqlTable(
  "oauth_identities",
  {
    id: bigint("id", { mode: "number" }).autoincrement().primaryKey(),
    userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
    provider: varchar("provider", { length: 32 }).notNull(),
    providerUserId: varchar("providerUserId", { length: 128 }).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    uniqueIndex("oauth_identities_provider_subject_idx").on(table.provider, table.providerUserId),
    uniqueIndex("oauth_identities_user_provider_idx").on(table.userId, table.provider),
  ],
);

/** Hashed identity tombstones prevent a deliberately deleted account from being recreated by the same sign-in identity. */
export const deletedIdentityTombstones = mysqlTable(
  "deleted_identity_tombstones",
  {
    id: bigint("id", { mode: "number" }).autoincrement().primaryKey(),
    kind: varchar("kind", { length: 32 }).notNull(),
    identifierHash: varchar("identifierHash", { length: 128 }).notNull(),
    deletedAt: timestamp("deletedAt").defaultNow().notNull(),
  },
  table => [
    uniqueIndex("deleted_identity_kind_hash_unique_idx").on(table.kind, table.identifierHash),
  ],
);

/** Hashed login identifiers with bounded counters for first-party sign-in throttling. */
export const loginAttempts = mysqlTable(
  "login_attempts",
  {
    id: bigint("id", { mode: "number" }).autoincrement().primaryKey(),
    identifierHash: varchar("identifierHash", { length: 128 }).notNull().unique(),
    failureCount: int("failureCount").default(0).notNull(),
    windowStartedAt: timestamp("windowStartedAt").defaultNow().notNull(),
    blockedUntil: timestamp("blockedUntil"),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [index("login_attempts_blocked_idx").on(table.blockedUntil)],
);

export const apiKeys = mysqlTable(
  "api_keys",
  {
    id: bigint("id", { mode: "number" }).autoincrement().primaryKey(),
    userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
    keyPrefix: varchar("keyPrefix", { length: 24 }).notNull(),
    keyHash: varchar("keyHash", { length: 128 }).notNull().unique(),
    label: varchar("label", { length: 100 }).notNull(),
    status: mysqlEnum("status", ["active", "revoked"]).default("active").notNull(),
    lastUsedAt: timestamp("lastUsedAt"),
    revokedAt: timestamp("revokedAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    index("api_keys_user_status_idx").on(table.userId, table.status),
    uniqueIndex("api_keys_user_label_idx").on(table.userId, table.label),
  ],
);

export const accountControls = mysqlTable(
  "account_controls",
  {
    id: bigint("id", { mode: "number" }).autoincrement().primaryKey(),
    userId: int("userId").notNull().unique().references(() => users.id, { onDelete: "cascade" }),
    dailyRequestLimit: int("dailyRequestLimit").default(100).notNull(),
    dailyTokenLimit: int("dailyTokenLimit").default(100_000).notNull(),
    maxConcurrentRequests: int("maxConcurrentRequests").default(2).notNull(),
    isSuspended: boolean("isSuspended").default(false).notNull(),
    isSuspicious: boolean("isSuspicious").default(false).notNull(),
    suspensionReason: varchar("suspensionReason", { length: 512 }),
    /** Timestamp only: Discord identity and OAuth tokens are intentionally not retained. */
    discordVerifiedAt: timestamp("discordVerifiedAt"),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [index("account_controls_safety_idx").on(table.isSuspended, table.isSuspicious)],
);

export const usageEvents = mysqlTable(
  "usage_events",
  {
    id: bigint("id", { mode: "number" }).autoincrement().primaryKey(),
    requestId: varchar("requestId", { length: 64 }).notNull().unique(),
    userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
    apiKeyId: bigint("apiKeyId", { mode: "number" }).references(() => apiKeys.id, { onDelete: "set null" }),
    modelId: varchar("modelId", { length: 128 }).notNull(),
    status: mysqlEnum("status", ["success", "rejected", "provider_error", "cancelled"]).notNull(),
    source: mysqlEnum("source", ["api", "playground"]).default("api").notNull(),
    stream: boolean("stream").default(false).notNull(),
    inputTokens: int("inputTokens").default(0).notNull(),
    outputTokens: int("outputTokens").default(0).notNull(),
    totalTokens: int("totalTokens").default(0).notNull(),
    chargeNanos: bigint("chargeNanos", { mode: "number" }).default(0).notNull(),
    sourceIpHash: varchar("sourceIpHash", { length: 128 }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [
    index("usage_events_user_time_idx").on(table.userId, table.createdAt),
    index("usage_events_key_time_idx").on(table.apiKeyId, table.createdAt),
    index("usage_events_model_time_idx").on(table.modelId, table.createdAt),
    index("usage_events_user_status_time_idx").on(table.userId, table.status, table.createdAt),
  ],
);

/** A non-withdrawable promotional balance, stored in nanodollars to avoid fractional-cent rounding. */
export const creditAccounts = mysqlTable(
  "credit_accounts",
  {
    id: bigint("id", { mode: "number" }).autoincrement().primaryKey(),
    userId: int("userId").notNull().unique().references(() => users.id, { onDelete: "cascade" }),
    balanceNanos: bigint("balanceNanos", { mode: "number" }).default(0).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [index("credit_accounts_balance_idx").on(table.balanceNanos)],
);

/** Append-only record of TokenForge promotional-credit grants and usage debits. */
export const creditLedger = mysqlTable(
  "credit_ledger",
  {
    id: bigint("id", { mode: "number" }).autoincrement().primaryKey(),
    userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
    kind: mysqlEnum("kind", ["introductory_grant", "daily_checkin", "usage_debit", "manual_adjustment", "referral_reward", "special_referral_bonus"]).notNull(),
    amountNanos: bigint("amountNanos", { mode: "number" }).notNull(),
    balanceAfterNanos: bigint("balanceAfterNanos", { mode: "number" }).notNull(),
    referenceId: varchar("referenceId", { length: 128 }),
    note: varchar("note", { length: 256 }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [
    index("credit_ledger_user_time_idx").on(table.userId, table.createdAt),
    uniqueIndex("credit_ledger_user_reference_unique_idx").on(table.userId, table.referenceId),
  ],
);

/** One immutable aggregate record for each administrator giveaway, paired with per-recipient ledger entries. */
export const creditGiveaways = mysqlTable(
  "credit_giveaways",
  {
    id: varchar("id", { length: 32 }).primaryKey(),
    actorUserId: int("actorUserId").references(() => users.id, { onDelete: "set null" }),
    amountNanos: bigint("amountNanos", { mode: "number" }).notNull(),
    recipientCount: int("recipientCount").notNull(),
    totalAmountNanos: bigint("totalAmountNanos", { mode: "number" }).notNull(),
    announcementNote: varchar("announcementNote", { length: 256 }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [index("credit_giveaways_created_idx").on(table.createdAt)],
);

/** One recipient receipt per giveaway allows the dashboard to surface and dismiss a personal credit announcement. */
export const creditGiveawayNotifications = mysqlTable(
  "credit_giveaway_notifications",
  {
    id: bigint("id", { mode: "number" }).autoincrement().primaryKey(),
    giveawayId: varchar("giveawayId", { length: 32 }).notNull().references(() => creditGiveaways.id, { onDelete: "cascade" }),
    userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
    dismissedAt: timestamp("dismissedAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [
    uniqueIndex("credit_giveaway_notifications_giveaway_user_unique_idx").on(table.giveawayId, table.userId),
    index("credit_giveaway_notifications_user_dismissed_created_idx").on(table.userId, table.dismissedAt, table.createdAt),
  ],
);

/** A unique UTC-day record prevents concurrent requests from receiving more than one daily check-in reward. */
export const dailyCheckins = mysqlTable(
  "daily_checkins",
  {
    id: bigint("id", { mode: "number" }).autoincrement().primaryKey(),
    userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
    checkinDate: date("checkinDate").notNull(),
    rewardNanos: bigint("rewardNanos", { mode: "number" }).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [
    uniqueIndex("daily_checkins_user_date_unique_idx").on(table.userId, table.checkinDate),
    index("daily_checkins_user_date_idx").on(table.userId, table.checkinDate),
  ],
);

export const dailyUsage = mysqlTable(
  "daily_usage",
  {
    id: bigint("id", { mode: "number" }).autoincrement().primaryKey(),
    userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
    apiKeyId: bigint("apiKeyId", { mode: "number" }).references(() => apiKeys.id, { onDelete: "set null" }),
    usageDate: date("usageDate").notNull(),
    modelId: varchar("modelId", { length: 128 }).notNull(),
    requestCount: int("requestCount").default(0).notNull(),
    inputTokens: int("inputTokens").default(0).notNull(),
    outputTokens: int("outputTokens").default(0).notNull(),
    totalTokens: int("totalTokens").default(0).notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    uniqueIndex("daily_usage_unique_idx").on(table.userId, table.apiKeyId, table.usageDate, table.modelId),
    index("daily_usage_user_date_idx").on(table.userId, table.usageDate),
  ],
);

/** Provider-only GLM 5.3 tool-call state, encrypted and automatically expired. */
export const glmToolContinuationStates = mysqlTable(
  "glm_tool_continuation_states",
  {
    id: bigint("id", { mode: "number" }).autoincrement().primaryKey(),
    userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
    toolCallId: varchar("toolCallId", { length: 128 }).notNull(),
    ciphertext: text("ciphertext").notNull(),
    iv: varchar("iv", { length: 32 }).notNull(),
    authTag: varchar("authTag", { length: 32 }).notNull(),
    expiresAt: timestamp("expiresAt").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    uniqueIndex("glm_tool_continuation_user_tool_unique_idx").on(table.userId, table.toolCallId),
    index("glm_tool_continuation_expires_idx").on(table.expiresAt),
  ],
);

export const providerConfigs = mysqlTable("provider_configs", {
  id: bigint("id", { mode: "number" }).autoincrement().primaryKey(),
  slug: varchar("slug", { length: 64 }).notNull().unique(),
  displayName: varchar("displayName", { length: 128 }).notNull(),
  baseUrl: varchar("baseUrl", { length: 512 }).notNull(),
  enabled: boolean("enabled").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

/**
 * Server-encrypted, administrator-managed OrcaRouter credentials. The actual key
 * material is never returned through tRPC, audit records, or telemetry.
 */
export const orcaRouterCredentialSlots = mysqlTable(
  "orcarouter_credential_slots",
  {
    id: bigint("id", { mode: "number" }).autoincrement().primaryKey(),
    slot: int("slot").notNull(),
    ciphertext: text("ciphertext").notNull(),
    iv: varchar("iv", { length: 32 }).notNull(),
    authTag: varchar("authTag", { length: 32 }).notNull(),
    keyFingerprint: varchar("keyFingerprint", { length: 16 }).notNull(),
    lastValidatedAt: timestamp("lastValidatedAt").notNull(),
    updatedByUserId: int("updatedByUserId").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [uniqueIndex("orcarouter_credential_slots_slot_unique_idx").on(table.slot)],
);

/** Singleton-like platform settings keyed by a stable, audited identifier. */
export const platformSettings = mysqlTable("platform_settings", {
  settingKey: varchar("settingKey", { length: 96 }).primaryKey(),
  value: text("value").notNull(),
  updatedByUserId: int("updatedByUserId").references(() => users.id, { onDelete: "set null" }),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

/** Durable aggregate health and request metrics keyed by a non-reversible provider credential fingerprint. */
export const providerKeyMetrics = mysqlTable(
  "provider_key_metrics",
  {
    id: bigint("id", { mode: "number" }).autoincrement().primaryKey(),
    providerModelId: varchar("providerModelId", { length: 64 }).notNull(),
    credentialFingerprint: varchar("credentialFingerprint", { length: 64 }).notNull(),
    requestCount: bigint("requestCount", { mode: "number" }).default(0).notNull(),
    successCount: bigint("successCount", { mode: "number" }).default(0).notNull(),
    failureCount: bigint("failureCount", { mode: "number" }).default(0).notNull(),
    lastRequestAt: timestamp("lastRequestAt"),
    lastSuccessAt: timestamp("lastSuccessAt"),
    lastFailureAt: timestamp("lastFailureAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    uniqueIndex("provider_key_metrics_model_fingerprint_unique_idx").on(table.providerModelId, table.credentialFingerprint),
    index("provider_key_metrics_model_updated_idx").on(table.providerModelId, table.updatedAt),
  ],
);

/**
 * Administrator-only aggregate usage for internal model entries within a managed provider group.
 * It stores opaque entry IDs rather than the upstream model identifier, which remains encrypted
 * in the provider runtime setting and is never part of public gateway payloads.
 */
export const managedProviderModelUsage = mysqlTable(
  "managed_provider_model_usage",
  {
    providerModelId: varchar("providerModelId", { length: 64 }).notNull(),
    providerGroupId: varchar("providerGroupId", { length: 96 }).notNull(),
    modelEntryId: varchar("modelEntryId", { length: 96 }).notNull(),
    inputTokens: bigint("inputTokens", { mode: "number" }).default(0).notNull(),
    outputTokens: bigint("outputTokens", { mode: "number" }).default(0).notNull(),
    totalTokens: bigint("totalTokens", { mode: "number" }).default(0).notNull(),
    requestCount: bigint("requestCount", { mode: "number" }).default(0).notNull(),
    lastUsedAt: timestamp("lastUsedAt"),
    retiredAt: timestamp("retiredAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    uniqueIndex("managed_provider_model_usage_entry_unique_idx").on(table.providerModelId, table.providerGroupId, table.modelEntryId),
    index("managed_provider_model_usage_group_updated_idx").on(table.providerModelId, table.providerGroupId, table.updatedAt),
  ],
);

/** Durable request-capacity and health telemetry for the administrator-authorized Render proxy endpoints. */
export const renderProxyEndpointMetrics = mysqlTable(
  "render_proxy_endpoint_metrics",
  {
    endpointId: varchar("endpointId", { length: 96 }).primaryKey(),
    endpointUrl: varchar("endpointUrl", { length: 512 }).notNull(),
    activeRequests: int("activeRequests").default(0).notNull(),
    peakActiveRequests: int("peakActiveRequests").default(0).notNull(),
    requestCount: bigint("requestCount", { mode: "number" }).default(0).notNull(),
    successCount: bigint("successCount", { mode: "number" }).default(0).notNull(),
    failureCount: bigint("failureCount", { mode: "number" }).default(0).notNull(),
    timeoutCount: bigint("timeoutCount", { mode: "number" }).default(0).notNull(),
    cooldownUntil: timestamp("cooldownUntil"),
    lastRequestAt: timestamp("lastRequestAt"),
    lastSuccessAt: timestamp("lastSuccessAt"),
    lastFailureAt: timestamp("lastFailureAt"),
    /** Last completed upstream HTTP status, retained for administrator diagnostics only. */
    lastHttpStatus: int("lastHttpStatus"),
    /** Bounded category such as http, timeout, network, or stream; never a raw upstream error object. */
    lastFailureKind: varchar("lastFailureKind", { length: 32 }),
    /** Raw upstream failure detail after mandatory credential redaction. */
    lastFailureMessage: text("lastFailureMessage"),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [index("render_proxy_endpoint_metrics_updated_idx").on(table.updatedAt)],
);

/**
 * Credential-redacted raw upstream failure attempts for supported managed models.
 * These records identify the selected provider group or authorized Render endpoint
 * without persisting credentials, request bodies, headers, or user identifiers.
 */
export const claudeOpus5FailureLogs = mysqlTable(
  "claude_opus5_failure_logs",
  {
    id: bigint("id", { mode: "number" }).autoincrement().primaryKey(),
    modelId: varchar("modelId", { length: 64 }).notNull().default("claude-opus-5"),
    sourceType: mysqlEnum("sourceType", ["provider", "render"]).notNull(),
    sourceId: varchar("sourceId", { length: 96 }).notNull(),
    sourceLabel: varchar("sourceLabel", { length: 128 }).notNull(),
    httpStatus: int("httpStatus"),
    failureKind: varchar("failureKind", { length: 32 }).notNull(),
    retryable: boolean("retryable").default(false).notNull(),
    /** Raw upstream body or network diagnostic after mandatory credential redaction. */
    callerMessage: text("callerMessage").notNull(),
    occurredAt: timestamp("occurredAt").defaultNow().notNull(),
  },
  table => [
    index("claude_opus5_failure_logs_occurred_idx").on(table.occurredAt),
    index("claude_opus5_failure_logs_model_occurred_idx").on(table.modelId, table.occurredAt),
    index("claude_opus5_failure_logs_source_occurred_idx").on(table.sourceType, table.sourceId, table.occurredAt),
  ],
);

export const modelConfigs = mysqlTable(
  "model_configs",
  {
    id: bigint("id", { mode: "number" }).autoincrement().primaryKey(),
    modelId: varchar("modelId", { length: 128 }).notNull().unique(),
    providerSlug: varchar("providerSlug", { length: 64 }).notNull(),
    displayName: varchar("displayName", { length: 128 }).notNull(),
    description: text("description").notNull(),
    capabilities: json("capabilities").$type<string[]>().notNull(),
    enabled: boolean("enabled").default(true).notNull(),
    contextWindow: int("contextWindow"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [index("model_configs_provider_enabled_idx").on(table.providerSlug, table.enabled)],
);

export const accountFlags = mysqlTable(
  "account_flags",
  {
    id: bigint("id", { mode: "number" }).autoincrement().primaryKey(),
    userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
    kind: mysqlEnum("kind", ["quota_exceeded", "rate_circuit", "suspicious_usage"]).notNull(),
    reason: varchar("reason", { length: 512 }).notNull(),
    status: mysqlEnum("status", ["open", "reviewed", "dismissed"]).default("open").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    reviewedAt: timestamp("reviewedAt"),
  },
  table => [index("account_flags_user_status_idx").on(table.userId, table.status)],
);

export const auditEvents = mysqlTable(
  "audit_events",
  {
    id: bigint("id", { mode: "number" }).autoincrement().primaryKey(),
    actorUserId: int("actorUserId").references(() => users.id, { onDelete: "set null" }),
    targetUserId: int("targetUserId").references(() => users.id, { onDelete: "set null" }),
    action: varchar("action", { length: 128 }).notNull(),
    entityType: varchar("entityType", { length: 64 }).notNull(),
    entityId: varchar("entityId", { length: 128 }),
    metadata: json("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [index("audit_events_actor_time_idx").on(table.actorUserId, table.createdAt)],
);

export type ApiKey = typeof apiKeys.$inferSelect;
export type AccountControl = typeof accountControls.$inferSelect;
export type UsageEvent = typeof usageEvents.$inferSelect;
export type DailyUsage = typeof dailyUsage.$inferSelect;
export type GlmToolContinuationState = typeof glmToolContinuationStates.$inferSelect;
export type CreditAccount = typeof creditAccounts.$inferSelect;
export type CreditLedgerEntry = typeof creditLedger.$inferSelect;
export type CreditGiveaway = typeof creditGiveaways.$inferSelect;
export type CreditGiveawayNotification = typeof creditGiveawayNotifications.$inferSelect;
export type DailyCheckin = typeof dailyCheckins.$inferSelect;
export type ProviderConfig = typeof providerConfigs.$inferSelect;
export type OrcaRouterCredentialSlot = typeof orcaRouterCredentialSlots.$inferSelect;
export type ModelConfig = typeof modelConfigs.$inferSelect;
export type AccountFlag = typeof accountFlags.$inferSelect;
export type AuditEvent = typeof auditEvents.$inferSelect;
export type PasswordCredential = typeof passwordCredentials.$inferSelect;
export type PlatformSetting = typeof platformSettings.$inferSelect;
export type ProviderKeyMetric = typeof providerKeyMetrics.$inferSelect;
export type RenderProxyEndpointMetric = typeof renderProxyEndpointMetrics.$inferSelect;
export type DeletedIdentityTombstone = typeof deletedIdentityTombstones.$inferSelect;
export type ReferralCode = typeof referralCodes.$inferSelect;
export type ReferralAttribution = typeof referralAttributions.$inferSelect;
