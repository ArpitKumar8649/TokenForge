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
    inputTokens: int("inputTokens").default(0).notNull(),
    outputTokens: int("outputTokens").default(0).notNull(),
    totalTokens: int("totalTokens").default(0).notNull(),
    sourceIpHash: varchar("sourceIpHash", { length: 128 }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [
    index("usage_events_user_time_idx").on(table.userId, table.createdAt),
    index("usage_events_key_time_idx").on(table.apiKeyId, table.createdAt),
    index("usage_events_model_time_idx").on(table.modelId, table.createdAt),
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

export const providerConfigs = mysqlTable("provider_configs", {
  id: bigint("id", { mode: "number" }).autoincrement().primaryKey(),
  slug: varchar("slug", { length: 64 }).notNull().unique(),
  displayName: varchar("displayName", { length: 128 }).notNull(),
  baseUrl: varchar("baseUrl", { length: 512 }).notNull(),
  enabled: boolean("enabled").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

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
export type ProviderConfig = typeof providerConfigs.$inferSelect;
export type ModelConfig = typeof modelConfigs.$inferSelect;
export type AccountFlag = typeof accountFlags.$inferSelect;
export type AuditEvent = typeof auditEvents.$inferSelect;
export type PasswordCredential = typeof passwordCredentials.$inferSelect;
