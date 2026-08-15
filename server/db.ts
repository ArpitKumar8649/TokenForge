import { and, desc, eq, gte, lte, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { createHmac, randomBytes } from "node:crypto";
import {
  accountControls,
  accountFlags,
  apiKeys,
  creditAccounts,
  creditLedger,
  dailyCheckins,
  dailyUsage,
  InsertUser,
  usageEvents,
  users,
  loginAttempts,
  modelConfigs,
  passwordCredentials,
  platformSettings,
  providerConfigs,
} from "../drizzle/schema";
import { ENV } from "./_core/env";
import { hashPassword, normalizeEmail, nextFailedLoginState, normalizeEmailAllowlistEntries, retryAfterSeconds, verifyPassword } from "./localAuth";
import { DAILY_CHECKIN_CREDIT_NANOS, INTRODUCTORY_CREDIT_NANOS } from "./creditPricing";
import { CLUSTER_PROTOCOL_PROVIDER_SLUG, FXQIDIAN_PROVIDER_SLUG, TOKENHARBOR_PROVIDER_SLUG, TOKENFORGE_MODEL_CATALOGUE, TOKENFORGE_MODEL_IDS, type TokenForgeModelId } from "./modelCatalogue";

let _db: ReturnType<typeof drizzle> | null = null;

export const DEFAULT_DAILY_REQUEST_LIMIT = 100;
export const DEFAULT_DAILY_TOKEN_LIMIT = 100_000;
export const DEFAULT_MAX_CONCURRENT_REQUESTS = 2;
const INTRODUCTORY_CREDIT_REFERENCE = "introductory-credit-v1";
const EMAIL_ALLOWLIST_SETTING_KEY = "email_allowlist";

export type ApiKeyRecord = typeof apiKeys.$inferSelect;
export type EmailAllowlistConfig = { entries: string[]; updatedAt: Date; updatedByUserId: number | null };

const CATALOGUE_DEFINITIONS = TOKENFORGE_MODEL_CATALOGUE;

export function utcUsageDate(value = new Date()) {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
}

function utcCalendarKey(value = new Date()) {
  return value.toISOString().slice(0, 10);
}

export async function ensureCreditAccount(userId: number) {
  const db = await getDb();
  if (!db) return null;
  const existing = (await db.select().from(creditAccounts).where(eq(creditAccounts.userId, userId)).limit(1))[0];
  if (existing) return existing;
  try {
    return await db.transaction(async tx => {
      const again = (await tx.select().from(creditAccounts).where(eq(creditAccounts.userId, userId)).limit(1))[0];
      if (again) return again;
      await tx.insert(creditAccounts).values({ userId, balanceNanos: INTRODUCTORY_CREDIT_NANOS });
      await tx.insert(creditLedger).values({
        userId,
        kind: "introductory_grant",
        amountNanos: INTRODUCTORY_CREDIT_NANOS,
        balanceAfterNanos: INTRODUCTORY_CREDIT_NANOS,
        referenceId: INTRODUCTORY_CREDIT_REFERENCE,
        note: "Welcome promotional credit",
      });
      return (await tx.select().from(creditAccounts).where(eq(creditAccounts.userId, userId)).limit(1))[0] ?? null;
    });
  } catch (error: any) {
    if (error?.code !== "ER_DUP_ENTRY") throw error;
    return (await db.select().from(creditAccounts).where(eq(creditAccounts.userId, userId)).limit(1))[0] ?? null;
  }
}

export async function reserveCredit(userId: number, amountNanos: number, requestId: string) {
  const db = await getDb();
  if (!db) return { authorized: false, balanceNanos: 0 };
  const account = await ensureCreditAccount(userId);
  if (!account) return { authorized: false, balanceNanos: 0 };
  const amount = Math.max(0, Math.trunc(amountNanos));
  if (amount === 0) return { authorized: true, balanceNanos: account.balanceNanos };
  return db.transaction(async tx => {
    const result = await tx.update(creditAccounts)
      .set({ balanceNanos: sql`${creditAccounts.balanceNanos} - ${amount}` })
      .where(and(eq(creditAccounts.userId, userId), gte(creditAccounts.balanceNanos, amount)));
    if (!result[0].affectedRows) {
      const latest = (await tx.select().from(creditAccounts).where(eq(creditAccounts.userId, userId)).limit(1))[0];
      return { authorized: false, balanceNanos: latest?.balanceNanos ?? 0 };
    }
    const latest = (await tx.select().from(creditAccounts).where(eq(creditAccounts.userId, userId)).limit(1))[0];
    const balanceNanos = latest?.balanceNanos ?? 0;
    await tx.insert(creditLedger).values({
      userId,
      kind: "usage_debit",
      amountNanos: -amount,
      balanceAfterNanos: balanceNanos,
      referenceId: `reservation:${requestId}`,
      note: "Reserved for an inference request",
    });
    return { authorized: true, balanceNanos };
  });
}

export async function settleReservedCredit(input: { userId: number; requestId: string; reservedNanos: number; finalChargeNanos: number; releaseReason?: string }) {
  const db = await getDb();
  if (!db) return { balanceNanos: 0, chargedNanos: 0 };
  const reserved = Math.max(0, Math.trunc(input.reservedNanos));
  const chargedNanos = Math.min(reserved, Math.max(0, Math.trunc(input.finalChargeNanos)));
  const refund = reserved - chargedNanos;
  if (refund === 0) {
    const account = await ensureCreditAccount(input.userId);
    return { balanceNanos: account?.balanceNanos ?? 0, chargedNanos };
  }
  return db.transaction(async tx => {
    await tx.update(creditAccounts).set({ balanceNanos: sql`${creditAccounts.balanceNanos} + ${refund}` }).where(eq(creditAccounts.userId, input.userId));
    const account = (await tx.select().from(creditAccounts).where(eq(creditAccounts.userId, input.userId)).limit(1))[0];
    const balanceNanos = account?.balanceNanos ?? 0;
    await tx.insert(creditLedger).values({
      userId: input.userId,
      kind: "manual_adjustment",
      amountNanos: refund,
      balanceAfterNanos: balanceNanos,
      referenceId: `settlement:${input.requestId}`,
      note: input.releaseReason ?? "Unused reservation returned after metered completion",
    });
    return { balanceNanos, chargedNanos };
  });
}

export async function getCreditProfile(userId: number, now = new Date()) {
  const db = await getDb();
  if (!db) return null;
  const account = await ensureCreditAccount(userId);
  if (!account) return null;
  const today = utcUsageDate(now);
  const [ledger, checkins, todayCheckin] = await Promise.all([
    db.select().from(creditLedger).where(eq(creditLedger.userId, userId)).orderBy(desc(creditLedger.createdAt)).limit(50),
    db.select().from(dailyCheckins).where(and(eq(dailyCheckins.userId, userId), gte(dailyCheckins.checkinDate, utcUsageDate(new Date(now.getTime() - 41 * 86_400_000))))).orderBy(desc(dailyCheckins.checkinDate)),
    db.select({ id: dailyCheckins.id }).from(dailyCheckins).where(and(eq(dailyCheckins.userId, userId), eq(dailyCheckins.checkinDate, today))).limit(1),
  ]);
  return {
    balanceNanos: account.balanceNanos,
    canCheckIn: !todayCheckin[0],
    today: utcCalendarKey(now),
    ledger,
    checkins: checkins.map(entry => ({ ...entry, day: utcCalendarKey(new Date(entry.checkinDate)) })),
  };
}

export async function claimDailyCheckin(userId: number, now = new Date()) {
  const db = await getDb();
  if (!db) throw new Error("TokenForge database is unavailable");
  await ensureCreditAccount(userId);
  const checkinDate = utcUsageDate(now);
  const referenceId = `checkin:${utcCalendarKey(now)}`;
  try {
    return await db.transaction(async tx => {
      const already = (await tx.select({ id: dailyCheckins.id }).from(dailyCheckins).where(and(eq(dailyCheckins.userId, userId), eq(dailyCheckins.checkinDate, checkinDate))).limit(1))[0];
      if (already) return { claimed: false, rewardNanos: 0 };
      await tx.insert(dailyCheckins).values({ userId, checkinDate, rewardNanos: DAILY_CHECKIN_CREDIT_NANOS });
      await tx.update(creditAccounts).set({ balanceNanos: sql`${creditAccounts.balanceNanos} + ${DAILY_CHECKIN_CREDIT_NANOS}` }).where(eq(creditAccounts.userId, userId));
      const account = (await tx.select().from(creditAccounts).where(eq(creditAccounts.userId, userId)).limit(1))[0];
      await tx.insert(creditLedger).values({
        userId,
        kind: "daily_checkin",
        amountNanos: DAILY_CHECKIN_CREDIT_NANOS,
        balanceAfterNanos: account?.balanceNanos ?? DAILY_CHECKIN_CREDIT_NANOS,
        referenceId,
        note: "UTC daily check-in reward",
      });
      return { claimed: true, rewardNanos: DAILY_CHECKIN_CREDIT_NANOS };
    });
  } catch (error: any) {
    if (error?.code === "ER_DUP_ENTRY") return { claimed: false, rewardNanos: 0 };
    throw error;
  }
}

export function hashApiKey(plainTextKey: string) {
  const pepper = process.env.JWT_SECRET;
  if (!pepper) throw new Error("JWT_SECRET is required to hash TokenForge API keys");
  return createHmac("sha256", pepper).update(plainTextKey).digest("hex");
}

function newPlaintextKey() {
  return `tf_live_${randomBytes(32).toString("base64url")}`;
}

export function publicApiKey(key: ApiKeyRecord) {
  return {
    id: key.id,
    label: key.label,
    prefix: key.keyPrefix,
    status: key.status,
    createdAt: key.createdAt,
    lastUsedAt: key.lastUsedAt,
    revokedAt: key.revokedAt,
  };
}

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) return;

  const values: InsertUser = { openId: user.openId };
  const updateSet: Record<string, unknown> = {};
  (["name", "email", "loginMethod"] as const).forEach(field => {
    if (user[field] !== undefined) {
      values[field] = user[field] ?? null;
      updateSet[field] = user[field] ?? null;
    }
  });
  values.lastSignedIn = user.lastSignedIn ?? new Date();
  updateSet.lastSignedIn = values.lastSignedIn;
  if (user.role !== undefined) {
    values.role = user.role;
    updateSet.role = user.role;
  } else if (user.openId === ENV.ownerOpenId) {
    values.role = "admin";
    updateSet.role = "admin";
  }
  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0];
}

export async function createPasswordUser(input: { email: string; password: string; name?: string }) {
  const db = await getDb();
  if (!db) throw new Error("TokenForge database is unavailable");
  const email = normalizeEmail(input.email);
  const existing = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
  if (existing[0]) return null;

  const passwordHash = await hashPassword(input.password);
  const openId = `tf_local_${randomBytes(18).toString("base64url")}`;
  try {
    const userId = await db.transaction(async tx => {
      const inserted = await tx.insert(users).values({
        openId,
        email,
        name: input.name?.trim() || email.split("@")[0] || "TokenForge developer",
        loginMethod: "password",
        lastSignedIn: new Date(),
      });
      const createdUserId = Number(inserted[0].insertId);
      await tx.insert(passwordCredentials).values({ userId: createdUserId, passwordHash });
      return createdUserId;
    });
    await Promise.all([ensureAccountControl(userId), ensureCreditAccount(userId)]);
    return getUserByOpenId(openId);
  } catch (error: any) {
    if (error?.code === "ER_DUP_ENTRY") return null;
    throw error;
  }
}

export async function authenticatePasswordUser(emailInput: string, password: string) {
  const db = await getDb();
  if (!db) throw new Error("TokenForge database is unavailable");
  const email = normalizeEmail(emailInput);
  const rows = await db
    .select({ user: users, passwordHash: passwordCredentials.passwordHash })
    .from(users)
    .innerJoin(passwordCredentials, eq(passwordCredentials.userId, users.id))
    .where(eq(users.email, email))
    .limit(1);
  const account = rows[0];
  if (!account || !(await verifyPassword(password, account.passwordHash))) return null;
  await db.update(users).set({ lastSignedIn: new Date() }).where(eq(users.id, account.user.id));
  return account.user;
}

function hashLoginIdentifier(email: string) {
  const pepper = process.env.JWT_SECRET;
  if (!pepper) throw new Error("JWT_SECRET is required for TokenForge authentication throttling");
  return createHmac("sha256", pepper).update(`login:${normalizeEmail(email)}`).digest("hex");
}

export async function getPasswordLoginThrottle(email: string, now = new Date()) {
  const db = await getDb();
  if (!db) throw new Error("TokenForge database is unavailable");
  const identifierHash = hashLoginIdentifier(email);
  const record = (await db.select().from(loginAttempts).where(eq(loginAttempts.identifierHash, identifierHash)).limit(1))[0];
  const retryAfter = retryAfterSeconds(record?.blockedUntil ?? null, now);
  return { blocked: retryAfter > 0, retryAfterSeconds: retryAfter };
}

export async function recordFailedPasswordLogin(email: string, now = new Date()) {
  const db = await getDb();
  if (!db) throw new Error("TokenForge database is unavailable");
  const identifierHash = hashLoginIdentifier(email);

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const current = (await db.select().from(loginAttempts).where(eq(loginAttempts.identifierHash, identifierHash)).limit(1))[0];
    const next = nextFailedLoginState(current ? { failureCount: current.failureCount, windowStartedAt: current.windowStartedAt, blockedUntil: current.blockedUntil } : null, now);
    try {
      if (current) {
        await db.update(loginAttempts).set(next).where(eq(loginAttempts.id, current.id));
      } else {
        await db.insert(loginAttempts).values({ identifierHash, ...next });
      }
      return { blocked: retryAfterSeconds(next.blockedUntil, now) > 0, retryAfterSeconds: retryAfterSeconds(next.blockedUntil, now) };
    } catch (error: any) {
      if (error?.code !== "ER_DUP_ENTRY" || attempt === 1) throw error;
    }
  }
  return { blocked: false, retryAfterSeconds: 0 };
}

export async function clearFailedPasswordLogin(email: string) {
  const db = await getDb();
  if (!db) return;
  await db.delete(loginAttempts).where(eq(loginAttempts.identifierHash, hashLoginIdentifier(email)));
}

export async function getEmailAllowlistConfig(): Promise<EmailAllowlistConfig | null> {
  const db = await getDb();
  if (!db) return null;
  const record = (await db.select().from(platformSettings).where(eq(platformSettings.settingKey, EMAIL_ALLOWLIST_SETTING_KEY)).limit(1))[0];
  if (!record) return null;
  try {
    const parsed = JSON.parse(record.value) as { entries?: unknown };
    const entries = Array.isArray(parsed.entries) && parsed.entries.every(entry => typeof entry === "string")
      ? normalizeEmailAllowlistEntries(parsed.entries)
      : [];
    return { entries, updatedAt: record.updatedAt, updatedByUserId: record.updatedByUserId };
  } catch {
    return { entries: [], updatedAt: record.updatedAt, updatedByUserId: record.updatedByUserId };
  }
}

export async function setEmailAllowlistConfig(entries: readonly string[], updatedByUserId: number): Promise<EmailAllowlistConfig> {
  const db = await getDb();
  if (!db) throw new Error("TokenForge database is unavailable");
  const normalizedEntries = normalizeEmailAllowlistEntries(entries);
  await db.insert(platformSettings).values({
    settingKey: EMAIL_ALLOWLIST_SETTING_KEY,
    value: JSON.stringify({ entries: normalizedEntries }),
    updatedByUserId,
  }).onDuplicateKeyUpdate({ set: { value: JSON.stringify({ entries: normalizedEntries }), updatedByUserId, updatedAt: new Date() } });
  const saved = await getEmailAllowlistConfig();
  if (!saved) throw new Error("Email allowlist configuration did not persist");
  return saved;
}

export async function promoteUserToAdmin(userId: number) {
  const db = await getDb();
  if (!db) return false;
  const result = await db.update(users).set({ role: "admin" }).where(eq(users.id, userId));
  return result[0].affectedRows > 0;
}

export async function ensureAccountControl(userId: number) {
  const db = await getDb();
  if (!db) return null;
  await db
    .insert(accountControls)
    .values({
      userId,
      dailyRequestLimit: DEFAULT_DAILY_REQUEST_LIMIT,
      dailyTokenLimit: DEFAULT_DAILY_TOKEN_LIMIT,
      maxConcurrentRequests: DEFAULT_MAX_CONCURRENT_REQUESTS,
    })
    .onDuplicateKeyUpdate({ set: { userId } });
  const rows = await db.select().from(accountControls).where(eq(accountControls.userId, userId)).limit(1);
  return rows[0] ?? null;
}

export async function createApiKey(userId: number, label: string) {
  const db = await getDb();
  if (!db) throw new Error("TokenForge database is unavailable");

  const secret = newPlaintextKey();
  const keyPrefix = `${secret.slice(0, 15)}…`;
  const keyHash = hashApiKey(secret);
  await db.insert(apiKeys).values({ userId, label, keyPrefix, keyHash });
  const created = await db.select().from(apiKeys).where(eq(apiKeys.keyHash, keyHash)).limit(1);
  if (!created[0]) throw new Error("API key creation did not persist");
  return { key: secret, record: publicApiKey(created[0]) };
}

export async function listApiKeys(userId: number) {
  const db = await getDb();
  if (!db) return [];
  const keys = await db.select().from(apiKeys).where(eq(apiKeys.userId, userId)).orderBy(desc(apiKeys.createdAt));
  return keys.map(publicApiKey);
}

export async function revokeApiKey(userId: number, apiKeyId: number) {
  const db = await getDb();
  if (!db) return false;
  const result = await db
    .update(apiKeys)
    .set({ status: "revoked", revokedAt: new Date() })
    .where(and(eq(apiKeys.id, apiKeyId), eq(apiKeys.userId, userId), eq(apiKeys.status, "active")));
  return result[0].affectedRows > 0;
}

export async function rotateApiKey(userId: number, apiKeyId: number, label: string) {
  const wasRevoked = await revokeApiKey(userId, apiKeyId);
  if (!wasRevoked) return null;
  return createApiKey(userId, label);
}

export async function findActiveApiKey(plainTextKey: string) {
  const db = await getDb();
  if (!db) return null;
  const hash = hashApiKey(plainTextKey);
  const rows = await db
    .select()
    .from(apiKeys)
    .where(and(eq(apiKeys.keyHash, hash), eq(apiKeys.status, "active")))
    .limit(1);
  return rows[0] ?? null;
}

export async function touchApiKey(apiKeyId: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(apiKeys).set({ lastUsedAt: new Date() }).where(eq(apiKeys.id, apiKeyId));
}

export async function getQuotaStatus(userId: number) {
  const db = await getDb();
  const controls = await ensureAccountControl(userId);
  if (!db || !controls) return null;
  const today = utcUsageDate();
  const totals = await db
    .select({
      requests: sql<number>`coalesce(sum(${dailyUsage.requestCount}), 0)`,
      tokens: sql<number>`coalesce(sum(${dailyUsage.totalTokens}), 0)`,
    })
    .from(dailyUsage)
    .where(and(eq(dailyUsage.userId, userId), eq(dailyUsage.usageDate, today)));
  const usedRequests = Number(totals[0]?.requests ?? 0);
  const usedTokens = Number(totals[0]?.tokens ?? 0);
  return {
    day: today.toISOString().slice(0, 10),
    suspended: controls.isSuspended,
    suspicious: controls.isSuspicious,
    requestLimit: controls.dailyRequestLimit,
    tokenLimit: controls.dailyTokenLimit,
    maxConcurrentRequests: controls.maxConcurrentRequests,
    usedRequests,
    usedTokens,
    remainingRequests: Math.max(0, controls.dailyRequestLimit - usedRequests),
    remainingTokens: Math.max(0, controls.dailyTokenLimit - usedTokens),
  };
}

export async function getUsageSummary(userId: number) {
  const db = await getDb();
  const quota = await getQuotaStatus(userId);
  if (!db) return { quota, totalRequests: 0, totalTokens: 0, daily: [] as { day: string; requests: number; tokens: number }[] };
  const totals = await db
    .select({
      totalRequests: sql<number>`coalesce(sum(${dailyUsage.requestCount}), 0)`,
      totalTokens: sql<number>`coalesce(sum(${dailyUsage.totalTokens}), 0)`,
    })
    .from(dailyUsage)
    .where(eq(dailyUsage.userId, userId));
  const start = new Date();
  start.setUTCDate(start.getUTCDate() - 13);
  const rows = await db
    .select({ day: dailyUsage.usageDate, requests: dailyUsage.requestCount, tokens: dailyUsage.totalTokens })
    .from(dailyUsage)
    .where(and(eq(dailyUsage.userId, userId), gte(dailyUsage.usageDate, utcUsageDate(start))))
    .orderBy(dailyUsage.usageDate);
  return {
    quota,
    totalRequests: Number(totals[0]?.totalRequests ?? 0),
    totalTokens: Number(totals[0]?.totalTokens ?? 0),
    daily: rows.map(row => ({ day: new Date(row.day).toISOString().slice(0, 10), requests: Number(row.requests), tokens: Number(row.tokens) })),
  };
}

export async function getPublicModelTokenMetrics() {
  const byModel = Object.fromEntries(TOKENFORGE_MODEL_IDS.map(modelId => [modelId, 0])) as Record<TokenForgeModelId, number>;
  const empty = { totalTokens: 0, byModel };
  const db = await getDb();
  if (!db) return empty;
  const rows = await db
    .select({ modelId: dailyUsage.modelId, totalTokens: sql<number>`coalesce(sum(${dailyUsage.totalTokens}), 0)` })
    .from(dailyUsage)
    .groupBy(dailyUsage.modelId);
  for (const row of rows) {
    if (TOKENFORGE_MODEL_IDS.includes(row.modelId as TokenForgeModelId)) byModel[row.modelId as TokenForgeModelId] = Number(row.totalTokens ?? 0);
  }
  return { totalTokens: Object.values(byModel).reduce((total, amount) => total + amount, 0), byModel };
}

export async function recordUsage(input: {
  requestId: string;
  userId: number;
  apiKeyId?: number;
  modelId: string;
  status: "success" | "rejected" | "provider_error" | "cancelled";
  source?: "api" | "playground";
  stream?: boolean;
  inputTokens?: number;
  outputTokens?: number;
  chargeNanos?: number;
  sourceIpHash?: string;
}) {
  const db = await getDb();
  if (!db) return;
  const inputTokens = input.inputTokens ?? 0;
  const outputTokens = input.outputTokens ?? 0;
  const totalTokens = inputTokens + outputTokens;
  const chargeNanos = input.chargeNanos ?? 0;
  const day = utcUsageDate();
  await db.insert(usageEvents).values({ ...input, inputTokens, outputTokens, totalTokens, chargeNanos });
  await db
    .insert(dailyUsage)
    .values({ userId: input.userId, apiKeyId: input.apiKeyId, usageDate: day, modelId: input.modelId, requestCount: 1, inputTokens, outputTokens, totalTokens })
    .onDuplicateKeyUpdate({
      set: {
        requestCount: sql`${dailyUsage.requestCount} + 1`,
        inputTokens: sql`${dailyUsage.inputTokens} + ${inputTokens}`,
        outputTokens: sql`${dailyUsage.outputTokens} + ${outputTokens}`,
        totalTokens: sql`${dailyUsage.totalTokens} + ${totalTokens}`,
        updatedAt: new Date(),
      },
    });
}

export async function getUsageLogs(input: { userId: number; modelId?: string; source?: "api" | "playground"; from?: Date; to?: Date; limit?: number }) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [eq(usageEvents.userId, input.userId)];
  if (input.modelId) conditions.push(eq(usageEvents.modelId, input.modelId));
  if (input.source) conditions.push(eq(usageEvents.source, input.source));
  if (input.from) conditions.push(gte(usageEvents.createdAt, input.from));
  if (input.to) conditions.push(lte(usageEvents.createdAt, input.to));
  return db
    .select({
      id: usageEvents.id,
      requestId: usageEvents.requestId,
      createdAt: usageEvents.createdAt,
      source: usageEvents.source,
      stream: usageEvents.stream,
      status: usageEvents.status,
      modelId: usageEvents.modelId,
      inputTokens: usageEvents.inputTokens,
      outputTokens: usageEvents.outputTokens,
      totalTokens: usageEvents.totalTokens,
      chargeNanos: usageEvents.chargeNanos,
      apiKeyLabel: apiKeys.label,
    })
    .from(usageEvents)
    .leftJoin(apiKeys, eq(usageEvents.apiKeyId, apiKeys.id))
    .where(and(...conditions))
    .orderBy(desc(usageEvents.createdAt))
    .limit(Math.min(100, Math.max(1, input.limit ?? 50)));
}

export async function getRecentRequestCounts(userId: number, sourceIpHash: string, since: Date) {
  const db = await getDb();
  if (!db) return { account: 0, ip: 0 };
  const [accountRows, ipRows] = await Promise.all([
    db
      .select({ count: sql<number>`count(*)` })
      .from(usageEvents)
      .where(and(eq(usageEvents.userId, userId), gte(usageEvents.createdAt, since))),
    db
      .select({ count: sql<number>`count(*)` })
      .from(usageEvents)
      .where(and(eq(usageEvents.sourceIpHash, sourceIpHash), gte(usageEvents.createdAt, since))),
  ]);
  return { account: Number(accountRows[0]?.count ?? 0), ip: Number(ipRows[0]?.count ?? 0) };
}

export async function ensureCatalogue() {
  const db = await getDb();
  if (!db) return;
  const baseUrl = process.env.FXQIDIAN_BASE_URL ?? "https://fxqidian.de5.net";
  const clusterBaseUrl = process.env.CLUSTER_PROTOCOL_BASE_URL ?? "https://api.clusterprotocol.ai";
  const tokenHarborBaseUrl = process.env.TOKENHARBOR_BASE_URL ?? "https://tokenharbor.ai";
  await db.insert(providerConfigs).values([
    { slug: FXQIDIAN_PROVIDER_SLUG, displayName: "Selected hosted inference", baseUrl },
    { slug: CLUSTER_PROTOCOL_PROVIDER_SLUG, displayName: "Cluster Protocol", baseUrl: clusterBaseUrl },
    { slug: TOKENHARBOR_PROVIDER_SLUG, displayName: "TokenHarbor", baseUrl: tokenHarborBaseUrl },
  ]).onDuplicateKeyUpdate({ set: { baseUrl: sql`values(${providerConfigs.baseUrl})`, displayName: sql`values(${providerConfigs.displayName})` } });
  for (const model of CATALOGUE_DEFINITIONS) {
    await db.insert(modelConfigs).values({ modelId: model.id, displayName: model.displayName, description: model.description, capabilities: [...model.capabilities], providerSlug: model.providerSlug }).onDuplicateKeyUpdate({
      set: { displayName: model.displayName, description: model.description, capabilities: [...model.capabilities], providerSlug: model.providerSlug },
    });
  }
}

export async function isModelAvailable(modelId: string) {
  await ensureCatalogue();
  const db = await getDb();
  if (!db) return false;
  const records = await db.select({ enabled: modelConfigs.enabled, providerEnabled: providerConfigs.enabled }).from(modelConfigs).leftJoin(providerConfigs, eq(modelConfigs.providerSlug, providerConfigs.slug)).where(eq(modelConfigs.modelId, modelId)).limit(1);
  return Boolean(records[0]?.enabled && records[0]?.providerEnabled);
}

export function normalizeModelAvailability(rows: Array<{ modelId: string; enabled: boolean; providerEnabled: boolean | null }>) {
  return rows.map(row => ({ modelId: row.modelId, available: Boolean(row.enabled && row.providerEnabled) }));
}

export async function getModelAvailabilitySnapshot() {
  await ensureCatalogue();
  const db = await getDb();
  if (!db) return [];
  const rows = await db
    .select({
      modelId: modelConfigs.modelId,
      enabled: modelConfigs.enabled,
      providerEnabled: providerConfigs.enabled,
    })
    .from(modelConfigs)
    .leftJoin(providerConfigs, eq(modelConfigs.providerSlug, providerConfigs.slug));
  return normalizeModelAvailability(rows);
}

export async function getAdminOverview() {
  await ensureCatalogue();
  const db = await getDb();
  if (!db) return { models: [], providers: [], accounts: [], usage: [] };
  const [models, providers, accounts, usage] = await Promise.all([
    db.select().from(modelConfigs).orderBy(modelConfigs.displayName),
    db.select().from(providerConfigs).orderBy(providerConfigs.displayName),
    db.select({ id: users.id, name: users.name, email: users.email, role: users.role, suspended: accountControls.isSuspended, suspicious: accountControls.isSuspicious, requestLimit: accountControls.dailyRequestLimit, tokenLimit: accountControls.dailyTokenLimit }).from(users).leftJoin(accountControls, eq(users.id, accountControls.userId)).orderBy(desc(users.lastSignedIn)).limit(100),
    db.select({ day: dailyUsage.usageDate, requests: sql<number>`coalesce(sum(${dailyUsage.requestCount}), 0)`, tokens: sql<number>`coalesce(sum(${dailyUsage.totalTokens}), 0)` }).from(dailyUsage).where(gte(dailyUsage.usageDate, utcUsageDate(new Date(Date.now() - 13 * 86_400_000)))).groupBy(dailyUsage.usageDate).orderBy(dailyUsage.usageDate),
  ]);
  return { models, providers, accounts, usage: usage.map(row => ({ day: new Date(row.day).toISOString().slice(0, 10), requests: Number(row.requests), tokens: Number(row.tokens) })) };
}

export async function setModelEnabled(modelId: string, enabled: boolean) {
  const db = await getDb();
  if (!db) return false;
  const result = await db.update(modelConfigs).set({ enabled }).where(eq(modelConfigs.modelId, modelId));
  return result[0].affectedRows > 0;
}

export async function setProviderEnabled(slug: string, enabled: boolean) {
  const db = await getDb();
  if (!db) return false;
  const result = await db.update(providerConfigs).set({ enabled }).where(eq(providerConfigs.slug, slug));
  return result[0].affectedRows > 0;
}

export async function setAccountControl(input: { userId: number; isSuspended?: boolean; dailyRequestLimit?: number; dailyTokenLimit?: number }) {
  const db = await getDb();
  if (!db) return false;
  await ensureAccountControl(input.userId);
  const patch: Record<string, unknown> = {};
  if (input.isSuspended !== undefined) patch.isSuspended = input.isSuspended;
  if (input.dailyRequestLimit !== undefined) patch.dailyRequestLimit = input.dailyRequestLimit;
  if (input.dailyTokenLimit !== undefined) patch.dailyTokenLimit = input.dailyTokenLimit;
  if (!Object.keys(patch).length) return true;
  const result = await db.update(accountControls).set(patch).where(eq(accountControls.userId, input.userId));
  return result[0].affectedRows > 0;
}

export async function listOpenFlags() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(accountFlags).where(eq(accountFlags.status, "open")).orderBy(desc(accountFlags.createdAt)).limit(100);
}

export async function createAccountFlag(input: { userId: number; kind: "quota_exceeded" | "rate_circuit" | "suspicious_usage"; reason: string }) {
  const db = await getDb();
  if (!db) return;
  await db.insert(accountFlags).values(input);
}

export async function markAccountSuspicious(userId: number) {
  const db = await getDb();
  if (!db) return;
  await ensureAccountControl(userId);
  await db.update(accountControls).set({ isSuspicious: true }).where(eq(accountControls.userId, userId));
}

export async function writeAuditEvent(input: { actorUserId?: number; targetUserId?: number; action: string; entityType: string; entityId?: string; metadata?: Record<string, unknown> }) {
  const db = await getDb();
  if (!db) return;
  const { auditEvents } = await import("../drizzle/schema");
  await db.insert(auditEvents).values(input);
}
