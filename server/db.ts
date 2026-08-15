import { and, desc, eq, gte, inArray, like, lte, notInArray, or, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { createHmac, randomBytes, randomInt } from "node:crypto";
import {
  accountControls,
  accountFlags,
  apiKeys,
  auditEvents,
  creditAccounts,
  creditLedger,
  dailyCheckins,
  dailyUsage,
  deletedIdentityTombstones,
  InsertUser,
  usageEvents,
  users,
  loginAttempts,
  modelConfigs,
  oauthIdentities,
  passwordCredentials,
  platformSettings,
  providerConfigs,
  referralAttributions,
  referralCodes,
} from "../drizzle/schema";
import { ENV } from "./_core/env";
import { hashPassword, normalizeEmail, nextFailedLoginState, normalizeEmailAllowlistEntries, retryAfterSeconds, verifyPassword } from "./localAuth";
import { DAILY_CHECKIN_CREDIT_NANOS, INTRODUCTORY_CREDIT_NANOS } from "./creditPricing";
import { CLUSTER_PROTOCOL_PROVIDER_SLUG, FXQIDIAN_PROVIDER_SLUG, TOKENHARBOR_PROVIDER_SLUG, TOKENFORGE_MODEL_CATALOGUE, TOKENFORGE_MODEL_IDS, type TokenForgeModelId } from "./modelCatalogue";
import { getClusterProtocolCredentialPool } from "./clusterProtocolCredentials";
import { getFxqidianCredentialPool } from "./fxqidianCredentials";
import { getProviderCredentialTelemetry } from "./providerCredentialTelemetry";
import { TOKENFORGE_REFERRAL_REWARD_NANOS, normalizeReferralCode } from "../shared/referrals";

let _db: ReturnType<typeof drizzle> | null = null;

export const DEFAULT_DAILY_REQUEST_LIMIT = 100;
export const DEFAULT_DAILY_TOKEN_LIMIT = 100_000;
export const DEFAULT_MAX_CONCURRENT_REQUESTS = 2;
const INTRODUCTORY_CREDIT_REFERENCE = "introductory-credit-v1";
const EMAIL_ALLOWLIST_SETTING_KEY = "email_allowlist";
const ANNOUNCEMENT_TEXT_SETTING_KEY = "announcement_text";
const SESSION_VERSION_SETTING_KEY = "auth_session_version";
const AFFILIATE_CODE_ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";
const AFFILIATE_CODE_LENGTH = 4;

export class DeletedAccountIdentityError extends Error {
  constructor() {
    super("This TokenForge account was permanently deleted");
    this.name = "DeletedAccountIdentityError";
  }
}

export type ApiKeyRecord = typeof apiKeys.$inferSelect;
export type EmailAllowlistConfig = { entries: string[]; updatedAt: Date; updatedByUserId: number | null };
export type AdminEmailProviderCount = { provider: string; accountCount: number };

const CATALOGUE_DEFINITIONS = TOKENFORGE_MODEL_CATALOGUE;

export function utcUsageDate(value = new Date()) {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
}

function hashDeletedIdentity(kind: string, identifier: string) {
  const pepper = process.env.JWT_SECRET;
  if (!pepper) throw new Error("JWT_SECRET is required for TokenForge account deletion safeguards");
  return createHmac("sha256", pepper).update(`deleted:${kind}:${identifier}`).digest("hex");
}

export async function isDeletedIdentity(kind: "email" | "github" | "open_id", identifier: string) {
  const db = await getDb();
  if (!db) return false;
  const normalized = kind === "email" ? normalizeEmail(identifier) : identifier.trim();
  if (!normalized) return false;
  const record = await db.select({ id: deletedIdentityTombstones.id }).from(deletedIdentityTombstones)
    .where(and(eq(deletedIdentityTombstones.kind, kind), eq(deletedIdentityTombstones.identifierHash, hashDeletedIdentity(kind, normalized)))).limit(1);
  return Boolean(record[0]);
}

export async function assertIdentityIsNotDeleted(kind: "email" | "github" | "open_id", identifier: string) {
  if (await isDeletedIdentity(kind, identifier)) throw new DeletedAccountIdentityError();
}

export async function getAuthSessionVersion() {
  const db = await getDb();
  if (!db) return 0;
  const record = (await db.select({ value: platformSettings.value }).from(platformSettings).where(eq(platformSettings.settingKey, SESSION_VERSION_SETTING_KEY)).limit(1))[0];
  const value = Number.parseInt(record?.value ?? "0", 10);
  return Number.isSafeInteger(value) && value >= 0 ? value : 0;
}

/** Advances the global session version so every previously issued browser session becomes invalid. */
export async function revokeAllTokenForgeSessions() {
  const db = await getDb();
  if (!db) throw new Error("TokenForge database is unavailable");
  await db.insert(platformSettings).values({ settingKey: SESSION_VERSION_SETTING_KEY, value: "1" })
    .onDuplicateKeyUpdate({ set: { value: sql`cast(${platformSettings.value} as unsigned) + 1`, updatedAt: new Date(), updatedByUserId: null } });
  return getAuthSessionVersion();
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

function newReferralCode() {
  return Array.from(
    { length: AFFILIATE_CODE_LENGTH },
    () => AFFILIATE_CODE_ALPHABET[randomInt(AFFILIATE_CODE_ALPHABET.length)],
  ).join("");
}

/** Creates a compact affiliate code once per account; the code does not reveal account identity. */
export async function getOrCreateReferralCode(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("TokenForge database is unavailable");
  const existing = (await db.select().from(referralCodes).where(eq(referralCodes.userId, userId)).limit(1))[0];
  if (existing) return existing;

  for (let attempt = 0; attempt < 8; attempt += 1) {
    try {
      await db.insert(referralCodes).values({ userId, code: newReferralCode() });
      const created = (await db.select().from(referralCodes).where(eq(referralCodes.userId, userId)).limit(1))[0];
      if (created) return created;
    } catch (error: any) {
      if (error?.code !== "ER_DUP_ENTRY") throw error;
      const concurrent = (await db.select().from(referralCodes).where(eq(referralCodes.userId, userId)).limit(1))[0];
      if (concurrent) return concurrent;
    }
  }
  throw new Error("TokenForge could not create a referral link");
}

/**
 * Grants both parties exactly once after a new referred account is created.
 * The unique referred-user record is the authoritative idempotency control.
 */
export async function awardReferralForNewUser(referredUserId: number, rawReferralCode?: string | null) {
  const referralCode = normalizeReferralCode(rawReferralCode);
  if (!referralCode) return { awarded: false as const, reason: "no_valid_code" as const };
  const db = await getDb();
  if (!db) throw new Error("TokenForge database is unavailable");
  const invitation = (await db.select().from(referralCodes).where(eq(referralCodes.code, referralCode)).limit(1))[0];
  if (!invitation || invitation.userId === referredUserId) return { awarded: false as const, reason: "ineligible" as const };

  await Promise.all([ensureCreditAccount(invitation.userId), ensureCreditAccount(referredUserId)]);
  try {
    const outcome = await db.transaction(async tx => {
      const prior = (await tx.select({ id: referralAttributions.id }).from(referralAttributions).where(eq(referralAttributions.referredUserId, referredUserId)).limit(1))[0];
      if (prior) return { awarded: false as const, reason: "already_rewarded" as const };

      const inserted = await tx.insert(referralAttributions).values({
        referrerUserId: invitation.userId,
        referredUserId,
        rewardNanos: TOKENFORGE_REFERRAL_REWARD_NANOS,
      });
      const referralId = Number(inserted[0].insertId);
      await tx.update(creditAccounts)
        .set({ balanceNanos: sql`${creditAccounts.balanceNanos} + ${TOKENFORGE_REFERRAL_REWARD_NANOS}` })
        .where(inArray(creditAccounts.userId, [invitation.userId, referredUserId]));
      const accounts = await tx.select().from(creditAccounts).where(inArray(creditAccounts.userId, [invitation.userId, referredUserId]));
      const balances = new Map(accounts.map(account => [account.userId, account.balanceNanos]));
      await tx.insert(creditLedger).values([
        {
          userId: invitation.userId,
          kind: "referral_reward",
          amountNanos: TOKENFORGE_REFERRAL_REWARD_NANOS,
          balanceAfterNanos: balances.get(invitation.userId) ?? TOKENFORGE_REFERRAL_REWARD_NANOS,
          referenceId: `referral:${referralId}:inviter`,
          note: "Referral reward for an eligible new member",
        },
        {
          userId: referredUserId,
          kind: "referral_reward",
          amountNanos: TOKENFORGE_REFERRAL_REWARD_NANOS,
          balanceAfterNanos: balances.get(referredUserId) ?? TOKENFORGE_REFERRAL_REWARD_NANOS,
          referenceId: `referral:${referralId}:new-member`,
          note: "Welcome reward from a valid referral",
        },
      ]);
      return { awarded: true as const, referralId, referrerUserId: invitation.userId };
    });
    if (outcome.awarded) {
      await writeAuditEvent({ actorUserId: outcome.referrerUserId, targetUserId: referredUserId, action: "referral_reward_awarded", entityType: "referral", entityId: String(outcome.referralId), metadata: { rewardNanos: TOKENFORGE_REFERRAL_REWARD_NANOS } });
    }
    return outcome;
  } catch (error: any) {
    if (error?.code === "ER_DUP_ENTRY") return { awarded: false as const, reason: "already_rewarded" as const };
    throw error;
  }
}

export async function getReferralOverview(userId: number) {
  const db = await getDb();
  if (!db) return null;
  const code = await getOrCreateReferralCode(userId);
  const [attributions, received] = await Promise.all([
    db.select({ id: referralAttributions.id, createdAt: referralAttributions.createdAt, rewardNanos: referralAttributions.rewardNanos, memberName: users.name })
      .from(referralAttributions)
      .innerJoin(users, eq(referralAttributions.referredUserId, users.id))
      .where(eq(referralAttributions.referrerUserId, userId))
      .orderBy(desc(referralAttributions.createdAt)),
    db.select({ rewardNanos: referralAttributions.rewardNanos, createdAt: referralAttributions.createdAt })
      .from(referralAttributions)
      .where(eq(referralAttributions.referredUserId, userId))
      .limit(1),
  ]);
  return {
    code: code.code,
    referrals: attributions.map(item => ({ id: item.id, name: item.memberName || "New TokenForge member", createdAt: item.createdAt, rewardNanos: item.rewardNanos })),
    totalRewardNanos: attributions.reduce((total, item) => total + item.rewardNanos, 0),
    receivedRewardNanos: received[0]?.rewardNanos ?? 0,
  };
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

  await assertIdentityIsNotDeleted("open_id", user.openId);
  if (user.email) await assertIdentityIsNotDeleted("email", user.email);

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
  }
  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0];
}

export async function createPasswordUser(input: { email: string; password: string; name?: string; referralCode?: string }) {
  const db = await getDb();
  if (!db) throw new Error("TokenForge database is unavailable");
  const email = normalizeEmail(input.email);
  if (await isDeletedIdentity("email", email)) return null;
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
    await Promise.all([ensureAccountControl(userId), ensureCreditAccount(userId), getOrCreateReferralCode(userId)]);
    await awardReferralForNewUser(userId, input.referralCode);
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

/** Returns the currently published public announcement, normalized so whitespace-only values remain unpublished. */
export async function getAnnouncementText(): Promise<string | null> {
  const db = await getDb();
  if (!db) return null;
  const record = (await db.select({ value: platformSettings.value }).from(platformSettings).where(eq(platformSettings.settingKey, ANNOUNCEMENT_TEXT_SETTING_KEY)).limit(1))[0];
  const text = record?.value.trim() ?? "";
  return text || null;
}

/** Persists an administrator-authored announcement. An empty value intentionally clears the public banner. */
export async function setAnnouncementText(text: string, updatedByUserId: number): Promise<string | null> {
  const db = await getDb();
  if (!db) throw new Error("TokenForge database is unavailable");
  const value = text.trim().slice(0, 500);
  await db.insert(platformSettings).values({
    settingKey: ANNOUNCEMENT_TEXT_SETTING_KEY,
    value,
    updatedByUserId,
  }).onDuplicateKeyUpdate({ set: { value, updatedByUserId, updatedAt: new Date() } });
  return value || null;
}

export async function promoteUserToAdmin(userId: number) {
  const db = await getDb();
  if (!db) return false;
  const result = await db.update(users).set({ role: "admin" }).where(eq(users.id, userId));
  return result[0].affectedRows > 0;
}

export async function demoteUserToStandardRole(userId: number) {
  const db = await getDb();
  if (!db) return false;
  const result = await db.update(users).set({ role: "user" }).where(eq(users.id, userId));
  return result[0].affectedRows > 0;
}

/** Clears legacy persistent admin flags; access is now carried only by a passcode-issued session. */
export async function clearLegacyAdministratorRoles() {
  const db = await getDb();
  if (!db) return false;
  const result = await db.update(users).set({ role: "user" }).where(eq(users.role, "admin"));
  return result[0].affectedRows >= 0;
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

let catalogueInitialization: Promise<void> | null = null;

export async function ensureCatalogue() {
  if (catalogueInitialization) return catalogueInitialization;
  catalogueInitialization = (async () => {
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
    await db.insert(modelConfigs).values(CATALOGUE_DEFINITIONS.map(model => ({ modelId: model.id, displayName: model.displayName, description: model.description, capabilities: [...model.capabilities], providerSlug: model.providerSlug }))).onDuplicateKeyUpdate({
      set: { displayName: sql`values(${modelConfigs.displayName})`, description: sql`values(${modelConfigs.description})`, capabilities: sql`values(${modelConfigs.capabilities})`, providerSlug: sql`values(${modelConfigs.providerSlug})` },
    });
    await db.delete(modelConfigs).where(notInArray(modelConfigs.modelId, [...TOKENFORGE_MODEL_IDS]));
  })();
  try {
    await catalogueInitialization;
  } catch (error) {
    catalogueInitialization = null;
    throw error;
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

export type AdminAccountBase = {
  id: number;
  name: string | null;
  email: string | null;
  createdAt: Date;
  lastSignedIn: Date;
  suspended: boolean | null;
  suspicious: boolean | null;
  requestLimit: number | null;
  tokenLimit: number | null;
  balanceNanos: number | null;
};

export type AdminAccountUsage = {
  userId: number;
  requestCount: number | null;
  totalTokens: number | null;
  lastActivityAt: Date | string | null;
};

export type AdminAccountDirectoryInput = {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: "all" | "active" | "suspended" | "flagged";
};

export function normalizeAdminAccountDirectoryInput(input: AdminAccountDirectoryInput = {}) {
  return {
    page: Math.max(1, Math.trunc(input.page ?? 1)),
    pageSize: Math.min(50, Math.max(5, Math.trunc(input.pageSize ?? 10))),
    search: input.search?.trim().slice(0, 120) ?? "",
    status: input.status ?? "all",
  };
}

/** Combines separately aggregated sensitive account data without returning any API-key material. */
export function composeAdminAccountOverview(accounts: AdminAccountBase[], usageRows: AdminAccountUsage[]) {
  const usageByUser = new Map(usageRows.map(row => [row.userId, row]));
  return accounts.map(account => {
    const usage = usageByUser.get(account.id);
    const lastActivity = usage?.lastActivityAt ? new Date(usage.lastActivityAt) : null;
    return {
      ...account,
      balanceNanos: Number(account.balanceNanos ?? 0),
      requestCount: Number(usage?.requestCount ?? 0),
      totalTokens: Number(usage?.totalTokens ?? 0),
      lastActivityAt: lastActivity && !Number.isNaN(lastActivity.getTime()) ? lastActivity : null,
    };
  });
}

/** Shapes aggregate mailbox-provider rows for the admin dashboard without exposing individual email addresses. */
export function normalizeAdminEmailProviderCounts(rows: Array<{ provider: string | null; accountCount: number | string }>): AdminEmailProviderCount[] {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const provider = row.provider?.trim().toLowerCase() ?? "";
    const accountCount = Number(row.accountCount);
    if (!provider || provider.includes("@") || !Number.isSafeInteger(accountCount) || accountCount <= 0) continue;
    counts.set(provider, (counts.get(provider) ?? 0) + accountCount);
  }
  return Array.from(counts.entries())
    .map(([provider, accountCount]) => ({ provider, accountCount }))
    .sort((left, right) => right.accountCount - left.accountCount || left.provider.localeCompare(right.provider));
}

function escapeMysqlLike(value: string) {
  return value.replace(/[\\%_]/g, character => `\\${character}`);
}

/** Returns a privacy-safe, server-paginated directory without selecting API-key records or key material. */
export async function listAdminAccounts(input: AdminAccountDirectoryInput = {}) {
  const db = await getDb();
  const query = normalizeAdminAccountDirectoryInput(input);
  if (!db) return { items: [], total: 0, page: query.page, pageSize: query.pageSize, pageCount: 0 };

  const filters = [];
  if (query.search) {
    const pattern = `%${escapeMysqlLike(query.search)}%`;
    filters.push(or(
      like(users.name, pattern),
      like(users.email, pattern),
      sql`cast(${users.id} as char) like ${pattern}`,
    ));
  }
  if (query.status === "suspended") filters.push(eq(accountControls.isSuspended, true));
  if (query.status === "flagged") filters.push(eq(accountControls.isSuspicious, true));
  if (query.status === "active") {
    filters.push(or(eq(accountControls.isSuspended, false), sql`${accountControls.userId} is null`));
  }
  const whereClause = filters.length ? and(...filters) : undefined;
  const [{ total }] = await db
    .select({ total: sql<number>`count(*)` })
    .from(users)
    .leftJoin(accountControls, eq(users.id, accountControls.userId))
    .where(whereClause);
  const pageCount = Math.ceil(Number(total) / query.pageSize);
  const page = pageCount ? Math.min(query.page, pageCount) : 1;
  const accounts = await db
    .select({ id: users.id, name: users.name, email: users.email, createdAt: users.createdAt, lastSignedIn: users.lastSignedIn, suspended: accountControls.isSuspended, suspicious: accountControls.isSuspicious, requestLimit: accountControls.dailyRequestLimit, tokenLimit: accountControls.dailyTokenLimit, balanceNanos: creditAccounts.balanceNanos })
    .from(users)
    .leftJoin(accountControls, eq(users.id, accountControls.userId))
    .leftJoin(creditAccounts, eq(users.id, creditAccounts.userId))
    .where(whereClause)
    .orderBy(desc(users.lastSignedIn), desc(users.id))
    .limit(query.pageSize)
    .offset((page - 1) * query.pageSize);
  const userIds = accounts.map(account => account.id);
  const usageRows = userIds.length
    ? await db.select({ userId: usageEvents.userId, requestCount: sql<number>`coalesce(count(${usageEvents.id}), 0)`, totalTokens: sql<number>`coalesce(sum(${usageEvents.totalTokens}), 0)`, lastActivityAt: sql<Date | null>`max(${usageEvents.createdAt})` }).from(usageEvents).where(inArray(usageEvents.userId, userIds)).groupBy(usageEvents.userId)
    : [];

  return { items: composeAdminAccountOverview(accounts, usageRows), total: Number(total), page, pageSize: query.pageSize, pageCount };
}

export type GitHubIdentityInput = { providerUserId: string; email: string; name: string | null; referralCode?: string };

/** Resolves GitHub by immutable provider subject. An existing matching email is never auto-linked. */
export async function resolveGitHubIdentity(input: GitHubIdentityInput) {
  const db = await getDb();
  if (!db) throw new Error("TokenForge database is unavailable");
  const provider = "github";
  await assertIdentityIsNotDeleted("github", input.providerUserId);
  await assertIdentityIsNotDeleted("email", input.email);
  const existingIdentity = (await db.select({ user: users }).from(oauthIdentities).innerJoin(users, eq(oauthIdentities.userId, users.id)).where(and(eq(oauthIdentities.provider, provider), eq(oauthIdentities.providerUserId, input.providerUserId))).limit(1))[0]?.user;
  if (existingIdentity) {
    const lastSignedIn = new Date();
    await db.update(users).set({ lastSignedIn }).where(eq(users.id, existingIdentity.id));
    return { kind: "resolved" as const, user: { ...existingIdentity, lastSignedIn } };
  }

  const email = normalizeEmail(input.email);
  const existingEmail = (await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1))[0];
  if (existingEmail) return { kind: "link_required" as const };

  try {
    const userId = await db.transaction(async tx => {
      const inserted = await tx.insert(users).values({
        openId: `tf_github_${input.providerUserId}`,
        email,
        name: input.name?.trim() || email.split("@")[0] || "GitHub developer",
        loginMethod: "github",
        lastSignedIn: new Date(),
      });
      const createdUserId = Number(inserted[0].insertId);
      await tx.insert(oauthIdentities).values({ userId: createdUserId, provider, providerUserId: input.providerUserId });
      return createdUserId;
    });
    await Promise.all([ensureAccountControl(userId), ensureCreditAccount(userId), getOrCreateReferralCode(userId)]);
    await awardReferralForNewUser(userId, input.referralCode);
    const user = (await db.select().from(users).where(eq(users.id, userId)).limit(1))[0];
    if (!user) throw new Error("TokenForge could not load the new GitHub account");
    return { kind: "resolved" as const, user };
  } catch (error: any) {
    if (error?.code !== "ER_DUP_ENTRY") throw error;
    const concurrentIdentity = (await db.select({ user: users }).from(oauthIdentities).innerJoin(users, eq(oauthIdentities.userId, users.id)).where(and(eq(oauthIdentities.provider, provider), eq(oauthIdentities.providerUserId, input.providerUserId))).limit(1))[0]?.user;
    if (concurrentIdentity) return { kind: "resolved" as const, user: concurrentIdentity };
    return { kind: "link_required" as const };
  }
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
  if (!db) return { models: [], providers: [], accounts: [], usage: [], emailProviders: [], totals: { totalTokens: 0, totalRequests: 0 }, providerTelemetry: getProviderCredentialTelemetry({}) };
  const emailProvider = sql<string>`lower(substring_index(${users.email}, '@', -1))`;
  const [models, providers, accounts, usage, accountUsage, totals, emailProviderRows] = await Promise.all([
    db.select().from(modelConfigs).orderBy(modelConfigs.displayName),
    db.select().from(providerConfigs).orderBy(providerConfigs.displayName),
    db.select({ id: users.id, name: users.name, email: users.email, createdAt: users.createdAt, lastSignedIn: users.lastSignedIn, suspended: accountControls.isSuspended, suspicious: accountControls.isSuspicious, requestLimit: accountControls.dailyRequestLimit, tokenLimit: accountControls.dailyTokenLimit, balanceNanos: creditAccounts.balanceNanos }).from(users).leftJoin(accountControls, eq(users.id, accountControls.userId)).leftJoin(creditAccounts, eq(users.id, creditAccounts.userId)).orderBy(desc(users.lastSignedIn)).limit(100),
    db.select({ day: dailyUsage.usageDate, requests: sql<number>`coalesce(sum(${dailyUsage.requestCount}), 0)`, tokens: sql<number>`coalesce(sum(${dailyUsage.totalTokens}), 0)` }).from(dailyUsage).where(gte(dailyUsage.usageDate, utcUsageDate(new Date(Date.now() - 13 * 86_400_000)))).groupBy(dailyUsage.usageDate).orderBy(dailyUsage.usageDate),
    db.select({ userId: usageEvents.userId, requestCount: sql<number>`coalesce(count(${usageEvents.id}), 0)`, totalTokens: sql<number>`coalesce(sum(${usageEvents.totalTokens}), 0)`, lastActivityAt: sql<Date | null>`max(${usageEvents.createdAt})` }).from(usageEvents).groupBy(usageEvents.userId),
    db.select({ totalTokens: sql<number>`coalesce(sum(${usageEvents.totalTokens}), 0)`, totalRequests: sql<number>`coalesce(count(${usageEvents.id}), 0)` }).from(usageEvents),
    db.select({ provider: emailProvider, accountCount: sql<number>`count(${users.id})` }).from(users).where(sql`${users.email} is not null and ${users.email} like '%@%'`).groupBy(emailProvider).orderBy(desc(sql`count(${users.id})`), emailProvider),
  ]);
  const providerTelemetry = getProviderCredentialTelemetry({
    [FXQIDIAN_PROVIDER_SLUG]: getFxqidianCredentialPool().length,
    [CLUSTER_PROTOCOL_PROVIDER_SLUG]: getClusterProtocolCredentialPool().length,
    [TOKENHARBOR_PROVIDER_SLUG]: process.env.TOKENHARBOR_API_KEY?.trim() ? 1 : 0,
  });
  return { models, providers, accounts: composeAdminAccountOverview(accounts, accountUsage), usage: usage.map(row => ({ day: new Date(row.day).toISOString().slice(0, 10), requests: Number(row.requests), tokens: Number(row.tokens) })), emailProviders: normalizeAdminEmailProviderCounts(emailProviderRows), totals: { totalTokens: Number(totals[0]?.totalTokens ?? 0), totalRequests: Number(totals[0]?.totalRequests ?? 0) }, providerTelemetry };
}

/** Deletes a user and every account-owned TokenForge record, retaining only non-reversible hashed identity tombstones. */
export async function deleteAccountPermanently(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("TokenForge database is unavailable");
  return db.transaction(async tx => {
    const user = (await tx.select().from(users).where(eq(users.id, userId)).limit(1))[0];
    if (!user) return false;
    const identities = await tx.select({ provider: oauthIdentities.provider, providerUserId: oauthIdentities.providerUserId }).from(oauthIdentities).where(eq(oauthIdentities.userId, userId));
    const tombstones = [
      { kind: "open_id", identifierHash: hashDeletedIdentity("open_id", user.openId) },
      ...(user.email ? [{ kind: "email", identifierHash: hashDeletedIdentity("email", normalizeEmail(user.email)) }] : []),
      ...identities.map(identity => ({ kind: identity.provider, identifierHash: hashDeletedIdentity(identity.provider, identity.providerUserId) })),
    ];
    await tx.insert(deletedIdentityTombstones).values(tombstones).onDuplicateKeyUpdate({ set: { deletedAt: new Date() } });
    await tx.delete(auditEvents).where(or(eq(auditEvents.actorUserId, userId), eq(auditEvents.targetUserId, userId)));
    const deleted = await tx.delete(users).where(eq(users.id, userId));
    return deleted[0].affectedRows > 0;
  });
}

export type AdminAuditRecord = {
  id: number;
  action: string;
  entityType: string;
  entityId: string | null;
  createdAt: Date;
};

/** Returns only operational audit fields—never credentials, key material, email, names, or metadata. */
export async function listAdminAuditEvents(limit = 40): Promise<AdminAuditRecord[]> {
  const db = await getDb();
  if (!db) return [];
  const boundedLimit = Math.min(500, Math.max(1, Math.trunc(limit)));
  return db.select({
    id: auditEvents.id,
    action: auditEvents.action,
    entityType: auditEvents.entityType,
    entityId: auditEvents.entityId,
    createdAt: auditEvents.createdAt,
  }).from(auditEvents).orderBy(desc(auditEvents.createdAt), desc(auditEvents.id)).limit(boundedLimit);
}

/** Produces a bounded, identity-minimized audit export suitable for local CSV download. */
export async function getAdminAuditExport() {
  const events = await listAdminAuditEvents(500);
  return {
    generatedAt: new Date(),
    columns: ["timestamp_utc", "action", "entity_type", "entity_id"],
    rows: events.map(event => [event.createdAt.toISOString(), event.action, event.entityType, event.entityId ?? ""]),
  };
}

export async function setModelEnabled(modelId: string, enabled: boolean) {
  const db = await getDb();
  if (!db) return false;
  const result = await db.update(modelConfigs).set({ enabled }).where(eq(modelConfigs.modelId, modelId));
  return result[0].affectedRows > 0;
}

export async function setProviderEnabled(slug: string, enabled: boolean) {
  const db = await getDb();
  if (!db) return { updated: false, disabledModels: 0 };
  return db.transaction(async tx => {
    const providerResult = await tx.update(providerConfigs).set({ enabled }).where(eq(providerConfigs.slug, slug));
    if (!providerResult[0].affectedRows) return { updated: false, disabledModels: 0 };
    if (enabled) return { updated: true, disabledModels: 0 };

    const modelResult = await tx.update(modelConfigs)
      .set({ enabled: false })
      .where(and(eq(modelConfigs.providerSlug, slug), eq(modelConfigs.enabled, true)));
    return { updated: true, disabledModels: modelResult[0].affectedRows };
  });
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
