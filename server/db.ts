import { and, asc, desc, eq, gte, inArray, isNotNull, isNull, like, lt, lte, ne, notInArray, or, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { createHmac, randomBytes, randomInt } from "node:crypto";
import {
  accountControls,
  accountFlags,
  apiKeys,
  auditEvents,
  baiReasoningContinuations,
  baiProviderCircuitStates,
  bailuWebshareProxySlotMetrics,
  claudeOpus5FailureLogs,
  creditAccounts,
  creditGiveaways,
  creditGiveawayNotifications,
  creditLedger,
  dailyCheckins,
  dailyUsage,
  deletedIdentityTombstones,
  glmToolContinuationStates,
  InsertUser,
  usageEvents,
  users,
  loginAttempts,
  modelConfigs,
  oauthIdentities,
  orcaRouterCredentialSlots,
  passwordCredentials,
  platformSettings,
  preProvisionedAccounts,
  providerKeyMetrics,
  managedProviderModelUsage,
  providerConfigs,
  renderProxyEndpointMetrics,
  referralAttributions,
  referralCodes,
  specialReferralClaims,
} from "../drizzle/schema";
import { ENV } from "./_core/env";
import { hashPassword, isPermanentEmailAddress, normalizeEmail, nextFailedLoginState, normalizeEmailAllowlistEntries, retryAfterSeconds, verifyPassword } from "./localAuth";
import { DAILY_CHECKIN_CREDIT_NANOS, INTRODUCTORY_CREDIT_NANOS, NANODOLLARS_PER_DOLLAR } from "./creditPricing";
import { CLAUDE_OPUS5_PROVIDER_SLUG, CLUSTER_PROTOCOL_PROVIDER_SLUG, FXQIDIAN_PROVIDER_SLUG, getTokenForgeUpstreamModelId, TOKENHARBOR_PROVIDER_SLUG, TOKENROUTER_PROVIDER_SLUG, TOKENFORGE_MODEL_CATALOGUE, TOKENFORGE_MODEL_IDS, type TokenForgeModelId } from "./modelCatalogue";
import { getClusterProtocolCredentialPool } from "./clusterProtocolCredentials";
import { getFxqidianCredentialPool } from "./fxqidianCredentials";
import { getTokenRouterCredentialPool } from "./tokenRouterCredentials";
import { getCredentialSlotTelemetry, getProviderCredentialTelemetry, type CredentialTelemetryProvider } from "./providerCredentialTelemetry";
import { encryptOrcaRouterCredential } from "./orcaRouterCredentialVault";
import { decryptBaiReasoningContinuation, encryptBaiReasoningContinuation } from "./baiReasoningContinuationVault";
import { decryptGlmToolContinuation, encryptGlmToolContinuation, type GlmPrivateToolContinuation } from "./glmToolContinuationVault";
import { decryptProviderRuntimeConfig, encryptProviderRuntimeConfig } from "./providerRuntimeConfigVault";
import { TOKENFORGE_REFERRAL_REWARD_NANOS, isSpecialReferralCampaignCode, normalizeReferralCode } from "../shared/referrals";

let _db: ReturnType<typeof drizzle> | null = null;

export const DEFAULT_DAILY_REQUEST_LIMIT = 100;
export const DEFAULT_DAILY_TOKEN_LIMIT = 100_000;
export const DEFAULT_MAX_CONCURRENT_REQUESTS = 2;
const INTRODUCTORY_CREDIT_REFERENCE = "introductory-credit-v1";
const EMAIL_ALLOWLIST_SETTING_KEY = "email_allowlist";
const ANNOUNCEMENT_TEXT_SETTING_KEY = "announcement_text";
const SESSION_VERSION_SETTING_KEY = "auth_session_version";
const PLATFORM_MAINTENANCE_SETTING_KEY = "platform_maintenance";
const MAINTENANCE_COUNTDOWN_SETTING_KEY = "maintenance_countdown_v1";
export const PLATFORM_MAINTENANCE_ERROR_MESSAGE = "Site entered in maintainence mode due to massive request.";
const CLAUDE_FABLE5_NVIDIA_RUNTIME_SETTING_KEY = "claude_fable5_nvidia_runtime_v1";
const CLAUDE_OPUS5_TOKENREPLY_RUNTIME_SETTING_KEY = "claude_opus5_tokenreply_runtime_v1";
const GLM53_RUNTIME_SETTING_KEY = "glm53_runtime_v1";
const DEEPSEEK_V4PRO_RUNTIME_SETTING_KEY = "deepseek_v4pro_runtime_v1";
const SONNET46_RUNTIME_SETTING_KEY = "sonnet46_runtime_v1";
const QWEN38_MAX_RUNTIME_SETTING_KEY = "qwen38_max_runtime_v1";
const RENDER_NIM_PROXY_SWARM_SETTING_KEY = "render_nim_proxy_swarm_v1";
const BAILU_WEBSHARE_PROXY_POOL_SETTING_KEY = "bailu_webshare_proxy_pool_v1";
const BAI_REASONING_CONTINUATION_TTL_MS = 10 * 60 * 1_000;
const BAI_PROVIDER_CIRCUIT_COOLDOWN_MS = 60_000;
const SPECIAL_REFERRAL_CAMPAIGN_KEY = "special-referral-150-v1";
export const SPECIAL_REFERRAL_CAMPAIGN_CAP = 150;
export const SPECIAL_REFERRAL_BONUS_NANOS = 150 * NANODOLLARS_PER_DOLLAR;
export const DISCORD_UNVERIFIED_CLEANUP_NOTICE_KIND = "discord_unverified_cleanup";
const AFFILIATE_CODE_ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";
const AFFILIATE_CODE_LENGTH = 4;

export class DeletedAccountIdentityError extends Error {
  constructor() {
    super("This TokenForge account was permanently deleted");
    this.name = "DeletedAccountIdentityError";
  }
}

/** A nonblocking, non-reversible marker shown once after an administrator cleans up an unverified Discord account. */
export class DiscordUnverifiedAccountDeletedError extends Error {
  constructor() {
    super("Your previous account was not verified by Discord, so it was deleted by an administrator. You can create a new TokenForge account with this email.");
    this.name = "DiscordUnverifiedAccountDeletedError";
  }
}

export type ApiKeyRecord = typeof apiKeys.$inferSelect;
type ApiKeyLookupDatabase = Pick<NonNullable<Awaited<ReturnType<typeof getDb>>>, "select">;
type AccountDeletionDatabase = Pick<NonNullable<Awaited<ReturnType<typeof getDb>>>, "transaction">;
type CreditSettlementDatabase = Pick<NonNullable<Awaited<ReturnType<typeof getDb>>>, "select" | "transaction">;
export type EmailAllowlistConfig = { entries: string[]; updatedAt: Date; updatedByUserId: number | null };
export type OrcaRouterCredentialSlotSummary = { slot: number; fingerprintSuffix: string; lastValidatedAt: Date; updatedAt: Date; updatedByUserId: number | null };
export type AdminEmailProviderCount = { provider: string; accountCount: number };
export type UserWithDiscordVerification = typeof users.$inferSelect & { discordVerifiedAt: Date | null };
const GLM_TOOL_CONTINUATION_TTL_MS = 10 * 60 * 1_000;

const CATALOGUE_DEFINITIONS = TOKENFORGE_MODEL_CATALOGUE;
/** Standalone `users` aggregate expression; deliberately unqualified for deployed MySQL compatibility. */
export const ADMIN_EMAIL_PROVIDER_EXPRESSION = "lower(substring_index(email, '@', -1))";

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

export type PlatformMaintenanceConfig = { enabled: boolean; updatedAt: Date | null; updatedByUserId: number | null };

type StoredMaintenanceCountdown = { endsAt: number; note: string };

function parseMaintenanceCountdown(value: string | null | undefined): StoredMaintenanceCountdown | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as { endsAt?: unknown; note?: unknown };
    const endsAt = Number(parsed.endsAt);
    if (!Number.isFinite(endsAt)) return null;
    return { endsAt, note: String(parsed.note ?? "").trim().slice(0, 200) };
  } catch {
    return null;
  }
}

/** Atomically converts a completed public countdown into a global inference pause without touching model or provider flags. */
async function activateExpiredMaintenanceCountdown(database: NonNullable<Awaited<ReturnType<typeof getDb>>>) {
  const record = (await database.select({ value: platformSettings.value, updatedByUserId: platformSettings.updatedByUserId })
    .from(platformSettings).where(eq(platformSettings.settingKey, MAINTENANCE_COUNTDOWN_SETTING_KEY)).limit(1))[0];
  const countdown = parseMaintenanceCountdown(record?.value);
  if (!countdown || countdown.endsAt > Date.now()) return false;
  await database.transaction(async tx => {
    await tx.insert(platformSettings).values({ settingKey: MAINTENANCE_COUNTDOWN_SETTING_KEY, value: "", updatedByUserId: record?.updatedByUserId ?? null })
      .onDuplicateKeyUpdate({ set: { value: "", updatedByUserId: record?.updatedByUserId ?? null, updatedAt: new Date() } });
    await tx.insert(platformSettings).values({ settingKey: PLATFORM_MAINTENANCE_SETTING_KEY, value: "enabled", updatedByUserId: record?.updatedByUserId ?? null })
      .onDuplicateKeyUpdate({ set: { value: "enabled", updatedByUserId: record?.updatedByUserId ?? null, updatedAt: new Date() } });
  });
  return true;
}

/** Returns the global inference admission state. Model catalogues and administration remain available during maintenance. */
export async function getPlatformMaintenanceConfig(): Promise<PlatformMaintenanceConfig> {
  const db = await getDb();
  if (!db) return { enabled: false, updatedAt: null, updatedByUserId: null };
  await activateExpiredMaintenanceCountdown(db);
  const record = (await db.select().from(platformSettings).where(eq(platformSettings.settingKey, PLATFORM_MAINTENANCE_SETTING_KEY)).limit(1))[0];
  return { enabled: record?.value === "enabled", updatedAt: record?.updatedAt ?? null, updatedByUserId: record?.updatedByUserId ?? null };
}

/** Persists the administrator-controlled global inference admission state. */
export async function setPlatformMaintenanceConfig(enabled: boolean, updatedByUserId: number): Promise<PlatformMaintenanceConfig> {
  const db = await getDb();
  if (!db) throw new Error("TokenForge database is unavailable");
  if (!enabled) {
    const countdown = (await db.select({ value: platformSettings.value }).from(platformSettings)
      .where(eq(platformSettings.settingKey, MAINTENANCE_COUNTDOWN_SETTING_KEY)).limit(1))[0];
    const parsed = parseMaintenanceCountdown(countdown?.value);
    if (parsed && parsed.endsAt <= Date.now()) {
      await db.insert(platformSettings).values({ settingKey: MAINTENANCE_COUNTDOWN_SETTING_KEY, value: "", updatedByUserId })
        .onDuplicateKeyUpdate({ set: { value: "", updatedByUserId, updatedAt: new Date() } });
    }
  }
  await db.insert(platformSettings).values({
    settingKey: PLATFORM_MAINTENANCE_SETTING_KEY,
    value: enabled ? "enabled" : "disabled",
    updatedByUserId,
  }).onDuplicateKeyUpdate({ set: { value: enabled ? "enabled" : "disabled", updatedByUserId, updatedAt: new Date() } });
  return getPlatformMaintenanceConfig();
}

/** Clears a scheduled or elapsed countdown and restores global inference admission; individual model availability stays unchanged. */
export async function resumePlatformAfterTimedMaintenance(updatedByUserId: number): Promise<PlatformMaintenanceConfig> {
  const db = await getDb();
  if (!db) throw new Error("TokenForge database is unavailable");
  await db.transaction(async tx => {
    await tx.insert(platformSettings).values({ settingKey: MAINTENANCE_COUNTDOWN_SETTING_KEY, value: "", updatedByUserId })
      .onDuplicateKeyUpdate({ set: { value: "", updatedByUserId, updatedAt: new Date() } });
    await tx.insert(platformSettings).values({ settingKey: PLATFORM_MAINTENANCE_SETTING_KEY, value: "disabled", updatedByUserId })
      .onDuplicateKeyUpdate({ set: { value: "disabled", updatedByUserId, updatedAt: new Date() } });
  });
  return getPlatformMaintenanceConfig();
}

export type MaintenanceCountdown = { endsAt: number; note: string } | null;

/** Reads the active public maintenance countdown. Expiry durably pauses inference before the timer is unpublished. */
export async function getMaintenanceCountdown(): Promise<MaintenanceCountdown> {
  const db = await getDb();
  if (!db) return null;
  const record = (await db.select({ value: platformSettings.value }).from(platformSettings)
    .where(eq(platformSettings.settingKey, MAINTENANCE_COUNTDOWN_SETTING_KEY)).limit(1))[0];
  const countdown = parseMaintenanceCountdown(record?.value);
  if (!countdown) return null;
  if (countdown.endsAt <= Date.now()) {
    await activateExpiredMaintenanceCountdown(db);
    return null;
  }
  return countdown;
}

/** Starts a countdown from an administrator-provided duration, or clears the public timer when input is null. */
export async function setMaintenanceCountdown(input: { durationMs: number; note: string } | null, updatedByUserId: number): Promise<MaintenanceCountdown> {
  const db = await getDb();
  if (!db) throw new Error("TokenForge database is unavailable");
  const value = input === null ? "" : JSON.stringify({
    endsAt: Date.now() + Math.max(0, Math.trunc(input.durationMs)),
    note: input.note.trim().slice(0, 200),
  });
  await db.insert(platformSettings).values({ settingKey: MAINTENANCE_COUNTDOWN_SETTING_KEY, value, updatedByUserId })
    .onDuplicateKeyUpdate({ set: { value, updatedByUserId, updatedAt: new Date() } });
  return getMaintenanceCountdown();
}

async function consumeDiscordUnverifiedCleanupNotice(emailInput: string) {
  const db = await getDb();
  if (!db) return false;
  const email = normalizeEmail(emailInput);
  if (!email) return false;
  const identifierHash = hashDeletedIdentity(DISCORD_UNVERIFIED_CLEANUP_NOTICE_KIND, email);
  const notice = (await db.select({ id: deletedIdentityTombstones.id }).from(deletedIdentityTombstones)
    .where(and(eq(deletedIdentityTombstones.kind, DISCORD_UNVERIFIED_CLEANUP_NOTICE_KIND), eq(deletedIdentityTombstones.identifierHash, identifierHash))).limit(1))[0];
  if (!notice) return false;
  await db.delete(deletedIdentityTombstones).where(eq(deletedIdentityTombstones.id, notice.id));
  return true;
}

async function clearDiscordUnverifiedCleanupNotice(emailInput: string) {
  const db = await getDb();
  if (!db) return;
  const email = normalizeEmail(emailInput);
  if (!email) return;
  await db.delete(deletedIdentityTombstones).where(and(
    eq(deletedIdentityTombstones.kind, DISCORD_UNVERIFIED_CLEANUP_NOTICE_KIND),
    eq(deletedIdentityTombstones.identifierHash, hashDeletedIdentity(DISCORD_UNVERIFIED_CLEANUP_NOTICE_KIND, email)),
  ));
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

export type PreProvisionedAccountSummary = {
  id: number;
  email: string;
  introductoryCreditNanos: number;
  createdAt: Date;
  activatedAt: Date | null;
  activatedUserId: number | null;
  activatedUserName: string | null;
};

/** Creates an administrator-owned email reservation without storing an OAuth subject or credential. */
export async function preProvisionAccountEmail(input: { email: string; provisionedByUserId: number }) {
  const db = await getDb();
  if (!db) throw new Error("TokenForge database is unavailable");
  const email = normalizeEmail(input.email);
  const emailPolicy = await getEmailAllowlistConfig();
  if (!email || !isPermanentEmailAddress(email, emailPolicy?.entries)) {
    throw new Error("Enter an eligible permanent email address");
  }
  const existingUser = (await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1))[0];
  if (existingUser) return { kind: "existing_user" as const };
  const existingReservation = (await db.select({ id: preProvisionedAccounts.id }).from(preProvisionedAccounts).where(eq(preProvisionedAccounts.email, email)).limit(1))[0];
  if (existingReservation) return { kind: "already_pre_provisioned" as const, reservationId: Number(existingReservation.id) };
  try {
    const inserted = await db.insert(preProvisionedAccounts).values({
      email,
      introductoryCreditNanos: INTRODUCTORY_CREDIT_NANOS,
      provisionedByUserId: input.provisionedByUserId,
    });
    return { kind: "created" as const, reservationId: Number(inserted[0].insertId), email, introductoryCreditNanos: INTRODUCTORY_CREDIT_NANOS };
  } catch (error: any) {
    if (error?.code !== "ER_DUP_ENTRY") throw error;
    const concurrentUser = (await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1))[0];
    if (concurrentUser) return { kind: "existing_user" as const };
    const concurrentReservation = (await db.select({ id: preProvisionedAccounts.id }).from(preProvisionedAccounts).where(eq(preProvisionedAccounts.email, email)).limit(1))[0];
    if (concurrentReservation) return { kind: "already_pre_provisioned" as const, reservationId: Number(concurrentReservation.id) };
    throw error;
  }
}

/** Returns recent pending and activated reservations for the administrator account workspace. */
export async function listAdminPreProvisionedAccounts(limit = 20): Promise<PreProvisionedAccountSummary[]> {
  const db = await getDb();
  if (!db) return [];
  const boundedLimit = Math.min(Math.max(Math.floor(limit), 1), 50);
  const rows = await db
    .select({
      id: preProvisionedAccounts.id,
      email: preProvisionedAccounts.email,
      introductoryCreditNanos: preProvisionedAccounts.introductoryCreditNanos,
      createdAt: preProvisionedAccounts.createdAt,
      activatedAt: preProvisionedAccounts.activatedAt,
      activatedUserId: preProvisionedAccounts.activatedUserId,
      activatedUserName: users.name,
    })
    .from(preProvisionedAccounts)
    .leftJoin(users, eq(preProvisionedAccounts.activatedUserId, users.id))
    .orderBy(desc(preProvisionedAccounts.createdAt))
    .limit(boundedLimit);
  return rows.map(row => ({
    id: Number(row.id),
    email: row.email,
    introductoryCreditNanos: Number(row.introductoryCreditNanos),
    createdAt: row.createdAt,
    activatedAt: row.activatedAt,
    activatedUserId: row.activatedUserId ?? null,
    activatedUserName: row.activatedUserName ?? null,
  }));
}

/** Checks only the administrator-created email reservation; no OAuth identity data is stored or matched here. */
export async function hasPreProvisionedAccountEmail(input: string) {
  const db = await getDb();
  if (!db) return false;
  const email = normalizeEmail(input);
  if (!email) return false;
  const reservation = (await db.select({ id: preProvisionedAccounts.id })
    .from(preProvisionedAccounts)
    .where(eq(preProvisionedAccounts.email, email))
    .limit(1))[0];
  return Boolean(reservation);
}

/** Atomically consumes a matching reservation, grants its reserved introductory credit once, and records the administrator-approved Discord-verification exemption. */
async function activatePreProvisionedAccount(userId: number, email: string) {
  const db = await getDb();
  if (!db) return false;
  return db.transaction(async tx => {
    const reservation = (await tx.select().from(preProvisionedAccounts)
      .where(and(eq(preProvisionedAccounts.email, email), isNull(preProvisionedAccounts.activatedUserId))).limit(1))[0];
    if (!reservation) return false;
    const activatedAt = new Date();
    const claimed = await tx.update(preProvisionedAccounts)
      .set({ activatedUserId: userId, activatedAt })
      .where(and(eq(preProvisionedAccounts.id, reservation.id), isNull(preProvisionedAccounts.activatedUserId)));
    if (Number(claimed[0]?.affectedRows ?? 0) !== 1) return false;
    await tx.insert(accountControls)
      .values({ userId, discordVerifiedAt: activatedAt })
      .onDuplicateKeyUpdate({ set: { discordVerifiedAt: activatedAt } });
    const currentCreditAccount = (await tx.select().from(creditAccounts).where(eq(creditAccounts.userId, userId)).limit(1))[0];
    if (!currentCreditAccount) {
      const creditAmount = Number(reservation.introductoryCreditNanos);
      await tx.insert(creditAccounts).values({ userId, balanceNanos: creditAmount });
      await tx.insert(creditLedger).values({
        userId,
        kind: "introductory_grant",
        amountNanos: creditAmount,
        balanceAfterNanos: creditAmount,
        referenceId: `pre-provisioned-introductory:${reservation.id}`,
        note: "Administrator pre-provisioned welcome credit",
      });
    }
    return true;
  });
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

/** Reserves a campaign slot during account creation; the unique slot number enforces the 150-user cap. */
export async function reserveSpecialReferralCampaignSlot(userId: number, rawReferralCode?: string | null) {
  if (!isSpecialReferralCampaignCode(rawReferralCode)) return { reserved: false as const, reason: "not_special_link" as const };
  const db = await getDb();
  if (!db) throw new Error("TokenForge database is unavailable");
  const existing = (await db.select().from(specialReferralClaims).where(eq(specialReferralClaims.userId, userId)).limit(1))[0];
  if (existing) return { reserved: true as const, slotNumber: existing.slotNumber, alreadyReserved: true as const };
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(specialReferralClaims).where(eq(specialReferralClaims.campaignKey, SPECIAL_REFERRAL_CAMPAIGN_KEY));
    const slotNumber = Number(count) + 1;
    if (slotNumber > SPECIAL_REFERRAL_CAMPAIGN_CAP) return { reserved: false as const, reason: "campaign_full" as const };
    try {
      await db.insert(specialReferralClaims).values({ campaignKey: SPECIAL_REFERRAL_CAMPAIGN_KEY, slotNumber, userId });
      await writeAuditEvent({ actorUserId: userId, targetUserId: userId, action: "special_referral.reserved", entityType: "special_referral", entityId: String(slotNumber), metadata: { campaignKey: SPECIAL_REFERRAL_CAMPAIGN_KEY } });
      return { reserved: true as const, slotNumber, alreadyReserved: false as const };
    } catch (error: any) {
      if (error?.code !== "ER_DUP_ENTRY") throw error;
      const concurrent = (await db.select().from(specialReferralClaims).where(eq(specialReferralClaims.userId, userId)).limit(1))[0];
      if (concurrent) return { reserved: true as const, slotNumber: concurrent.slotNumber, alreadyReserved: true as const };
    }
  }
  return { reserved: false as const, reason: "reservation_busy" as const };
}

/** Awards the campaign balance exactly once after Discord verification; duplicate ledger keys keep retries safe. */
export async function settleSpecialReferralBonusAfterDiscordVerification(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("TokenForge database is unavailable");
  const now = new Date();
  try {
    return await db.transaction(async tx => {
      const claim = (await tx.select().from(specialReferralClaims).where(eq(specialReferralClaims.userId, userId)).limit(1))[0];
      if (!claim) return { awarded: false as const, reason: "not_eligible" as const };
      if (claim.awardedAt) return { awarded: false as const, reason: "already_awarded" as const, slotNumber: claim.slotNumber };
      await tx.update(specialReferralClaims).set({ verifiedAt: claim.verifiedAt ?? now }).where(eq(specialReferralClaims.id, claim.id));
      await tx.insert(creditAccounts).values({ userId, balanceNanos: 0 }).onDuplicateKeyUpdate({ set: { userId } });
      await tx.update(creditAccounts).set({ balanceNanos: sql`${creditAccounts.balanceNanos} + ${SPECIAL_REFERRAL_BONUS_NANOS}` }).where(eq(creditAccounts.userId, userId));
      const account = (await tx.select().from(creditAccounts).where(eq(creditAccounts.userId, userId)).limit(1))[0];
      await tx.insert(creditLedger).values({ userId, kind: "special_referral_bonus", amountNanos: SPECIAL_REFERRAL_BONUS_NANOS, balanceAfterNanos: account?.balanceNanos ?? SPECIAL_REFERRAL_BONUS_NANOS, referenceId: `special-referral:${claim.id}`, note: "Special referral bonus after Discord verification" });
      await tx.update(specialReferralClaims).set({ awardedAt: now, verifiedAt: claim.verifiedAt ?? now }).where(eq(specialReferralClaims.id, claim.id));
      return { awarded: true as const, slotNumber: claim.slotNumber, awardedAt: now };
    });
  } catch (error: any) {
    if (error?.code === "ER_DUP_ENTRY") return { awarded: false as const, reason: "already_awarded" as const };
    throw error;
  }
}

export async function getSpecialReferralGiftStatus(userId: number) {
  const db = await getDb();
  if (!db) return null;
  const claim = (await db.select().from(specialReferralClaims).where(eq(specialReferralClaims.userId, userId)).limit(1))[0];
  if (!claim) return null;
  return { slotNumber: claim.slotNumber, reservedAt: claim.reservedAt, verifiedAt: claim.verifiedAt, awardedAt: claim.awardedAt, giftViewedAt: claim.giftViewedAt, amountNanos: SPECIAL_REFERRAL_BONUS_NANOS };
}

/** Records visual acknowledgement only; the bonus is settled at Discord verification, not by the UI. */
export async function acknowledgeSpecialReferralGift(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("TokenForge database is unavailable");
  const claim = (await db.select().from(specialReferralClaims).where(eq(specialReferralClaims.userId, userId)).limit(1))[0];
  if (!claim?.awardedAt) return null;
  if (!claim.giftViewedAt) await db.update(specialReferralClaims).set({ giftViewedAt: new Date() }).where(eq(specialReferralClaims.id, claim.id));
  return { slotNumber: claim.slotNumber, amountNanos: SPECIAL_REFERRAL_BONUS_NANOS, awardedAt: claim.awardedAt };
}

/** Administrator-only campaign health and qualifying-account directory; excludes every secret and API-key field. */
export async function getSpecialReferralCampaignAdminOverview() {
  const db = await getDb();
  if (!db) return { cap: SPECIAL_REFERRAL_CAMPAIGN_CAP, reserved: 0, awarded: 0, remaining: SPECIAL_REFERRAL_CAMPAIGN_CAP, accounts: [] };
  const [counts, accounts] = await Promise.all([
    db.select({ reserved: sql<number>`count(*)`, awarded: sql<number>`coalesce(sum(case when ${specialReferralClaims.awardedAt} is not null then 1 else 0 end), 0)` })
      .from(specialReferralClaims)
      .where(eq(specialReferralClaims.campaignKey, SPECIAL_REFERRAL_CAMPAIGN_KEY)),
    db.select({ id: users.id, name: users.name, email: users.email, slotNumber: specialReferralClaims.slotNumber, reservedAt: specialReferralClaims.reservedAt, verifiedAt: specialReferralClaims.verifiedAt, awardedAt: specialReferralClaims.awardedAt, balanceNanos: creditAccounts.balanceNanos, discordVerifiedAt: accountControls.discordVerifiedAt })
      .from(specialReferralClaims)
      .innerJoin(users, eq(specialReferralClaims.userId, users.id))
      .leftJoin(creditAccounts, eq(users.id, creditAccounts.userId))
      .leftJoin(accountControls, eq(users.id, accountControls.userId))
      .where(eq(specialReferralClaims.campaignKey, SPECIAL_REFERRAL_CAMPAIGN_KEY))
      .orderBy(desc(specialReferralClaims.awardedAt), desc(specialReferralClaims.reservedAt), asc(specialReferralClaims.slotNumber)),
  ]);
  const reserved = Number(counts[0]?.reserved ?? 0);
  const awarded = Number(counts[0]?.awarded ?? 0);
  return {
    cap: SPECIAL_REFERRAL_CAMPAIGN_CAP,
    reserved,
    awarded,
    remaining: Math.max(0, SPECIAL_REFERRAL_CAMPAIGN_CAP - reserved),
    accounts: accounts.map(account => ({ ...account, specialReferral: true })),
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

function isMissingUserForeignKeyViolation(error: unknown) {
  let current = error;
  for (let depth = 0; current && depth < 4; depth += 1) {
    if (typeof current !== "object") return false;
    const databaseError = current as { code?: unknown; cause?: unknown };
    if (databaseError.code === "ER_NO_REFERENCED_ROW" || databaseError.code === "ER_NO_REFERENCED_ROW_2") return true;
    current = databaseError.cause;
  }
  return false;
}

/**
 * Finalizes a prior inference-credit reservation. If an administrator deletes the account while
 * the upstream model call is still in flight, the reservation has no remaining owner and is
 * deliberately treated as settled with no charge rather than recreating or mutating the account.
 */
export async function settleReservedCredit(input: { userId: number; requestId: string; reservedNanos: number; finalChargeNanos: number; releaseReason?: string }, database?: CreditSettlementDatabase) {
  const db = database ?? await getDb();
  if (!db) return { balanceNanos: 0, chargedNanos: 0 };
  const user = (await db.select({ id: users.id }).from(users).where(eq(users.id, input.userId)).limit(1))[0];
  if (!user) return { balanceNanos: 0, chargedNanos: 0 };
  const reserved = Math.max(0, Math.trunc(input.reservedNanos));
  const chargedNanos = Math.min(reserved, Math.max(0, Math.trunc(input.finalChargeNanos)));
  const refund = reserved - chargedNanos;
  if (refund === 0) {
    try {
      const account = await ensureCreditAccount(input.userId);
      return { balanceNanos: account?.balanceNanos ?? 0, chargedNanos };
    } catch (error) {
      // The account can be removed after the initial existence check and before initialization.
      if (isMissingUserForeignKeyViolation(error)) return { balanceNanos: 0, chargedNanos: 0 };
      throw error;
    }
  }
  try {
    return await db.transaction(async tx => {
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
  } catch (error) {
    // Account deletion can win the race after the check above but before the ledger insert.
    if (isMissingUserForeignKeyViolation(error)) return { balanceNanos: 0, chargedNanos: 0 };
    throw error;
  }
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

/** Store provider-produced GLM tool-call state only long enough to authenticate its next Claude Code continuation. */
export async function storeGlmToolContinuation(userId: number, toolCallId: string, continuation: GlmPrivateToolContinuation) {
  const db = await getDb();
  if (!db || !toolCallId.trim()) return;
  const encrypted = encryptGlmToolContinuation(continuation);
  const expiresAt = new Date(Date.now() + GLM_TOOL_CONTINUATION_TTL_MS);
  await db.insert(glmToolContinuationStates).values({
    userId,
    toolCallId: toolCallId.trim(),
    ciphertext: encrypted.ciphertext,
    iv: encrypted.iv,
    authTag: encrypted.authTag,
    expiresAt,
  }).onDuplicateKeyUpdate({ set: {
    ciphertext: encrypted.ciphertext,
    iv: encrypted.iv,
    authTag: encrypted.authTag,
    expiresAt,
  } });
}

/**
 * Load authentic, encrypted provider state for the owning account only. Expired or
 * unreadable records are discarded and callers safely fall back to text-only history.
 */
export async function loadGlmToolContinuations(userId: number, toolCallIds: readonly string[]) {
  const ids = Array.from(new Set(toolCallIds.map(id => id.trim()).filter(Boolean)));
  const result = new Map<string, GlmPrivateToolContinuation>();
  const db = await getDb();
  if (!db || !ids.length) return result;
  const now = new Date();
  const rows = await db.select().from(glmToolContinuationStates)
    .where(and(eq(glmToolContinuationStates.userId, userId), inArray(glmToolContinuationStates.toolCallId, ids)))
    .limit(ids.length);
  for (const row of rows) {
    if (row.expiresAt <= now) {
      await db.delete(glmToolContinuationStates).where(eq(glmToolContinuationStates.id, row.id));
      continue;
    }
    try {
      result.set(row.toolCallId, decryptGlmToolContinuation(row));
    } catch {
      await db.delete(glmToolContinuationStates).where(eq(glmToolContinuationStates.id, row.id));
    }
  }
  return result;
}

/** Encrypt provider-private b.ai reasoning for a single visible assistant turn and owning account only. */
export async function storeBaiReasoningContinuation(userId: number, modelId: "claude-opus-5" | "glm-5.3", assistantFingerprint: string, reasoningContent: string) {
  const db = await getDb();
  if (!db || !Number.isInteger(userId) || userId <= 0 || !/^[a-f0-9]{64}$/i.test(assistantFingerprint) || !reasoningContent.trim()) return;
  const encrypted = encryptBaiReasoningContinuation(reasoningContent);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + BAI_REASONING_CONTINUATION_TTL_MS);
  await db.transaction(async tx => {
    await tx.delete(baiReasoningContinuations).where(lte(baiReasoningContinuations.expiresAt, now));
    await tx.insert(baiReasoningContinuations).values({ userId, modelId, assistantFingerprint, ciphertext: encrypted.ciphertext, iv: encrypted.iv, authTag: encrypted.authTag, expiresAt })
      .onDuplicateKeyUpdate({ set: { ciphertext: encrypted.ciphertext, iv: encrypted.iv, authTag: encrypted.authTag, expiresAt } });
  });
}

/** Return a still-valid b.ai reasoning continuation only for the owning account and public model. */
export async function loadBaiReasoningContinuation(userId: number, modelId: "claude-opus-5" | "glm-5.3", assistantFingerprint: string) {
  const db = await getDb();
  if (!db || !Number.isInteger(userId) || userId <= 0 || !/^[a-f0-9]{64}$/i.test(assistantFingerprint)) return null;
  const row = (await db.select().from(baiReasoningContinuations).where(and(
    eq(baiReasoningContinuations.userId, userId),
    eq(baiReasoningContinuations.modelId, modelId),
    eq(baiReasoningContinuations.assistantFingerprint, assistantFingerprint),
  )).limit(1))[0];
  if (!row) return null;
  if (row.expiresAt <= new Date()) {
    await db.delete(baiReasoningContinuations).where(eq(baiReasoningContinuations.id, row.id));
    return null;
  }
  try {
    return decryptBaiReasoningContinuation(row);
  } catch {
    await db.delete(baiReasoningContinuations).where(eq(baiReasoningContinuations.id, row.id));
    return null;
  }
}

export type BaiProviderCircuitStatus = {
  providerGroupId: string;
  rateLimitCount: number;
  consecutiveRateLimits: number;
  cooldownUntil: Date | null;
  lastRateLimitedAt: Date | null;
  lastSuccessAt: Date | null;
  coolingDown: boolean;
};

function toBaiProviderCircuitStatus(row: typeof baiProviderCircuitStates.$inferSelect | undefined): BaiProviderCircuitStatus | null {
  if (!row) return null;
  const now = new Date();
  return {
    providerGroupId: row.providerGroupId,
    rateLimitCount: Number(row.rateLimitCount ?? 0),
    consecutiveRateLimits: Number(row.consecutiveRateLimits ?? 0),
    cooldownUntil: row.cooldownUntil ?? null,
    lastRateLimitedAt: row.lastRateLimitedAt ?? null,
    lastSuccessAt: row.lastSuccessAt ?? null,
    coolingDown: Boolean(row.cooldownUntil && row.cooldownUntil > now),
  };
}

export async function getBaiProviderCircuitStatus(providerGroupId: string): Promise<BaiProviderCircuitStatus | null> {
  const db = await getDb();
  if (!db || !providerGroupId.trim()) return null;
  const row = (await db.select().from(baiProviderCircuitStates).where(eq(baiProviderCircuitStates.providerGroupId, providerGroupId)).limit(1))[0];
  return toBaiProviderCircuitStatus(row);
}

export async function isBaiProviderCircuitEligible(providerGroupId: string) {
  return !(await getBaiProviderCircuitStatus(providerGroupId))?.coolingDown;
}

export async function recordBaiProviderRateLimit(providerGroupId: string) {
  const db = await getDb();
  if (!db || !providerGroupId.trim()) return;
  const now = new Date();
  const cooldownUntil = new Date(now.getTime() + BAI_PROVIDER_CIRCUIT_COOLDOWN_MS);
  await db.insert(baiProviderCircuitStates).values({ providerGroupId, rateLimitCount: 1, consecutiveRateLimits: 1, cooldownUntil, lastRateLimitedAt: now })
    .onDuplicateKeyUpdate({ set: {
      rateLimitCount: sql`${baiProviderCircuitStates.rateLimitCount} + 1`,
      consecutiveRateLimits: sql`${baiProviderCircuitStates.consecutiveRateLimits} + 1`,
      cooldownUntil,
      lastRateLimitedAt: now,
    } });
}

export async function recordBaiProviderSuccess(providerGroupId: string) {
  const db = await getDb();
  if (!db || !providerGroupId.trim()) return;
  const now = new Date();
  await db.insert(baiProviderCircuitStates).values({ providerGroupId, lastSuccessAt: now })
    .onDuplicateKeyUpdate({ set: { consecutiveRateLimits: 0, cooldownUntil: null, lastSuccessAt: now } });
}

export async function getBaiProviderCircuitStatuses() {
  const db = await getDb();
  if (!db) return [] as BaiProviderCircuitStatus[];
  return (await db.select().from(baiProviderCircuitStates)).map(row => toBaiProviderCircuitStatus(row)!);
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
  const result = await db
    .select({
      id: users.id,
      openId: users.openId,
      name: users.name,
      email: users.email,
      loginMethod: users.loginMethod,
      role: users.role,
      createdAt: users.createdAt,
      updatedAt: users.updatedAt,
      lastSignedIn: users.lastSignedIn,
      discordVerifiedAt: accountControls.discordVerifiedAt,
    })
    .from(users)
    .leftJoin(accountControls, eq(users.id, accountControls.userId))
    .where(eq(users.openId, openId))
    .limit(1);
  return result[0];
}

/**
 * A reserved internal identity used only to anchor the passcode-scoped
 * administrator session. It has no mailbox, password, API keys, credit
 * account, or developer-workspace access.
 */
export const ADMIN_SESSION_PRINCIPAL_OPEN_ID = "tf_internal_admin_control_plane";

export async function getOrCreateAdminSessionPrincipal() {
  await upsertUser({
    openId: ADMIN_SESSION_PRINCIPAL_OPEN_ID,
    name: "TokenForge Administrator",
    email: null,
    loginMethod: "admin_passcode",
    role: "user",
    lastSignedIn: new Date(),
  });
  const principal = await getUserByOpenId(ADMIN_SESSION_PRINCIPAL_OPEN_ID);
  if (!principal) throw new Error("Unable to establish the administrator session principal");
  return principal;
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
    await reserveSpecialReferralCampaignSlot(userId, input.referralCode);
    await clearDiscordUnverifiedCleanupNotice(email);
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
  if (!account) {
    if (await consumeDiscordUnverifiedCleanupNotice(email)) throw new DiscordUnverifiedAccountDeletedError();
    return null;
  }
  if (!(await verifyPassword(password, account.passwordHash))) return null;
  const signedInAt = new Date();
  await db.update(users).set({ lastSignedIn: signedInAt }).where(eq(users.id, account.user.id));
  return { ...account.user, lastSignedIn: signedInAt };
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

export async function listOrcaRouterCredentialSlotSummaries(): Promise<OrcaRouterCredentialSlotSummary[]> {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.select({
    slot: orcaRouterCredentialSlots.slot,
    keyFingerprint: orcaRouterCredentialSlots.keyFingerprint,
    lastValidatedAt: orcaRouterCredentialSlots.lastValidatedAt,
    updatedAt: orcaRouterCredentialSlots.updatedAt,
    updatedByUserId: orcaRouterCredentialSlots.updatedByUserId,
  }).from(orcaRouterCredentialSlots).orderBy(orcaRouterCredentialSlots.slot);
  return rows.map(row => ({
    slot: row.slot,
    fingerprintSuffix: row.keyFingerprint.slice(-6),
    lastValidatedAt: row.lastValidatedAt,
    updatedAt: row.updatedAt,
    updatedByUserId: row.updatedByUserId,
  }));
}

export async function loadOrcaRouterCredentialSlotCiphertexts() {
  const db = await getDb();
  if (!db) return [];
  return db.select({
    slot: orcaRouterCredentialSlots.slot,
    ciphertext: orcaRouterCredentialSlots.ciphertext,
    iv: orcaRouterCredentialSlots.iv,
    authTag: orcaRouterCredentialSlots.authTag,
  }).from(orcaRouterCredentialSlots).orderBy(orcaRouterCredentialSlots.slot);
}

/** Replaces the complete managed pool atomically after server-side validation has succeeded. */
export async function replaceOrcaRouterCredentialPool(credentials: readonly string[], updatedByUserId: number) {
  const db = await getDb();
  if (!db) throw new Error("TokenForge database is unavailable");
  const encrypted = credentials.map((credential, slot) => ({ slot, ...encryptOrcaRouterCredential(credential) }));
  const validatedAt = new Date();
  await db.transaction(async tx => {
    await tx.delete(orcaRouterCredentialSlots);
    for (const item of encrypted) {
      await tx.insert(orcaRouterCredentialSlots).values({
        slot: item.slot,
        ciphertext: item.ciphertext,
        iv: item.iv,
        authTag: item.authTag,
        keyFingerprint: item.keyFingerprint,
        lastValidatedAt: validatedAt,
        updatedByUserId,
      });
    }
  });
  return listOrcaRouterCredentialSlotSummaries();
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

const MAX_MANAGED_PROVIDER_API_KEYS = 50;

type ClaudeFable5RuntimePayload = { providers: ClaudeOpus5ProviderRuntime[] };
type Qwen38MaxRuntimePayload = { providers: ClaudeOpus5ProviderRuntime[] };

function claudeFable5RuntimeFromEnvironment(): ClaudeFable5RuntimePayload {
  return {
    providers: normalizeClaudeOpus5Providers([{
      id: "environment-default",
      label: "NVIDIA NIM default",
      enabled: true,
      baseUrl: process.env.NVIDIA_CLAUDE_FABLE5_BASE_URL?.trim() ?? "",
      model: process.env.NVIDIA_CLAUDE_FABLE5_MODEL?.trim() ?? "",
      apiKeys: [
        process.env.NVIDIA_CLAUDE_FABLE5_API_KEY,
        process.env.NVIDIA_CLAUDE_FABLE5_API_KEY_2,
        process.env.NVIDIA_CLAUDE_FABLE5_API_KEY_3,
        process.env.NVIDIA_CLAUDE_FABLE5_API_KEY_4,
        process.env.NVIDIA_CLAUDE_FABLE5_API_KEY_5,
      ].map(value => value?.trim() ?? ""),
    }], []),
  };
}

function maskProviderApiKey(value: string) {
  const normalized = value.trim();
  if (!normalized) return "Not configured";
  return `${normalized.slice(0, Math.min(3, normalized.length))}••••${normalized.slice(-4)}`;
}

async function readClaudeFable5RuntimeOverride() {
  const db = await getDb();
  if (!db) return null;
  const record = (await db.select().from(platformSettings).where(eq(platformSettings.settingKey, CLAUDE_FABLE5_NVIDIA_RUNTIME_SETTING_KEY)).limit(1))[0];
  if (!record) return null;
  try {
    const encoded = JSON.parse(record.value) as { ciphertext?: string; iv?: string; authTag?: string };
    const decrypted = decryptProviderRuntimeConfig({ ciphertext: String(encoded.ciphertext ?? ""), iv: String(encoded.iv ?? ""), authTag: String(encoded.authTag ?? "") });
    if (!decrypted || typeof decrypted !== "object") return null;
    const candidate = decrypted as Partial<ClaudeFable5RuntimePayload> & { baseUrl?: unknown; model?: unknown; apiKeys?: unknown };
    const legacyProvider = {
      id: "primary",
      label: "Primary provider",
      enabled: true,
      baseUrl: typeof candidate.baseUrl === "string" ? candidate.baseUrl.trim() : "",
      model: typeof candidate.model === "string" ? candidate.model.trim() : "",
      apiKeys: Array.isArray(candidate.apiKeys) ? candidate.apiKeys : [],
    };
    return {
      payload: { providers: normalizeClaudeOpus5Providers(candidate.providers, normalizeClaudeOpus5Providers([legacyProvider], [])) },
      updatedAt: record.updatedAt,
      updatedByUserId: record.updatedByUserId,
    };
  } catch {
    return null;
  }
}

export async function getClaudeFable5NvidiaRuntimeConfig(): Promise<ClaudeFable5RuntimePayload> {
  const fallback = claudeFable5RuntimeFromEnvironment();
  const override = await readClaudeFable5RuntimeOverride();
  if (!override) return fallback;
  return { providers: override.payload.providers.length ? override.payload.providers : fallback.providers };
}

export async function getClaudeFable5NvidiaProviderSettings() {
  const runtime = await getClaudeFable5NvidiaRuntimeConfig();
  const override = await readClaudeFable5RuntimeOverride();
  const primary = runtime.providers[0];
  return {
    baseUrl: primary?.baseUrl ?? "",
    model: primary?.model ?? "",
    apiKeyMasks: (primary?.apiKeys ?? []).map((key, index) => ({ slot: index + 1, value: maskProviderApiKey(key), configured: Boolean(key) })),
    providers: runtime.providers.map(provider => ({
      id: provider.id,
      label: provider.label,
      enabled: provider.enabled,
      baseUrl: provider.baseUrl,
      model: provider.model,
      apiKeyMasks: provider.apiKeys.map((key, index) => ({ slot: index + 1, value: maskProviderApiKey(key), configured: Boolean(key) })),
    })),
    source: override ? "database" as const : "environment" as const,
    updatedAt: override?.updatedAt ?? null,
    updatedByUserId: override?.updatedByUserId ?? null,
  };
}

export async function updateClaudeFable5NvidiaProviderSettings(input: { providers: Array<{ id: string; label: string; enabled?: boolean; baseUrl: string; model: string; apiKeys: string[]; removeSlots?: number[] }> } | { baseUrl?: string; model?: string; apiKeys?: string[]; removeSlots?: number[] }, updatedByUserId: number) {
  const db = await getDb();
  if (!db) throw new Error("TokenForge database is unavailable");
  const current = await getClaudeFable5NvidiaRuntimeConfig();
  const currentById = new Map(current.providers.map(provider => [provider.id, provider]));
  const legacyPrimary = current.providers[0] ?? { id: "primary", label: "Primary provider", enabled: true, baseUrl: "", model: "", apiKeys: [] };
  const submittedProviders = "providers" in input ? input.providers : [{ id: legacyPrimary.id, label: legacyPrimary.label, enabled: legacyPrimary.enabled, baseUrl: input.baseUrl ?? legacyPrimary.baseUrl, model: input.model ?? legacyPrimary.model, apiKeys: input.apiKeys ?? [], removeSlots: input.removeSlots }];
  const nextProviders = submittedProviders.map((submitted, index) => {
    const existing = currentById.get(submitted.id);
    const removedSlots = new Set(submitted.removeSlots ?? []);
    const retainedKeys = (existing?.apiKeys ?? []).filter((_, keyIndex) => !removedSlots.has(keyIndex + 1));
    const patchedExistingKeys = retainedKeys.map((key, keyIndex) => submitted.apiKeys[keyIndex]?.trim() || key);
    const appendedKeys = submitted.apiKeys.slice(retainedKeys.length).map(key => key.trim()).filter(Boolean);
    return { id: normalizeClaudeOpus5ProviderId(submitted.id, `provider-${index + 1}`), label: submitted.label.trim() || `Provider ${index + 1}`, enabled: submitted.enabled !== false, baseUrl: submitted.baseUrl.trim(), model: submitted.model.trim(), apiKeys: [...patchedExistingKeys, ...appendedKeys].filter(Boolean).slice(0, MAX_MANAGED_PROVIDER_API_KEYS) };
  });
  const ids = new Set(nextProviders.map(provider => provider.id));
  if (!nextProviders.length || nextProviders.length > MAX_CLAUDE_OPUS5_PROVIDERS || ids.size !== nextProviders.length || nextProviders.some(provider => !provider.baseUrl || !provider.model || !provider.apiKeys.length)) throw new Error("Each Claude Fable 5 provider needs a unique identifier, base URL, model ID, and at least one API key");
  const next: ClaudeFable5RuntimePayload = { providers: nextProviders };
  const encrypted = encryptProviderRuntimeConfig(next);
  await db.insert(platformSettings).values({
    settingKey: CLAUDE_FABLE5_NVIDIA_RUNTIME_SETTING_KEY,
    value: JSON.stringify(encrypted),
    updatedByUserId,
  }).onDuplicateKeyUpdate({ set: { value: JSON.stringify(encrypted), updatedByUserId, updatedAt: new Date() } });
  return getClaudeFable5NvidiaProviderSettings();
}

function qwen38MaxRuntimeFromEnvironment(): Qwen38MaxRuntimePayload {
  return {
    providers: normalizeClaudeOpus5Providers([{
      id: "environment-default",
      label: "TokenRouter default",
      enabled: true,
      baseUrl: process.env.TOKENROUTER_BASE_URL?.trim() ?? "",
      model: process.env.TOKENROUTER_MODEL?.trim() ?? "",
      apiKeys: getTokenRouterCredentialPool(),
    }], []),
  };
}

async function readQwen38MaxRuntimeOverride() {
  const db = await getDb();
  if (!db) return null;
  const record = (await db.select().from(platformSettings).where(eq(platformSettings.settingKey, QWEN38_MAX_RUNTIME_SETTING_KEY)).limit(1))[0];
  if (!record) return null;
  try {
    const encoded = JSON.parse(record.value) as { ciphertext?: string; iv?: string; authTag?: string };
    const decrypted = decryptProviderRuntimeConfig({ ciphertext: String(encoded.ciphertext ?? ""), iv: String(encoded.iv ?? ""), authTag: String(encoded.authTag ?? "") });
    if (!decrypted || typeof decrypted !== "object") return null;
    const candidate = decrypted as Partial<Qwen38MaxRuntimePayload>;
    return { payload: { providers: normalizeClaudeOpus5Providers(candidate.providers, []) }, updatedAt: record.updatedAt, updatedByUserId: record.updatedByUserId };
  } catch {
    return null;
  }
}

export async function getQwen38MaxRuntimeConfig(): Promise<Qwen38MaxRuntimePayload> {
  const fallback = qwen38MaxRuntimeFromEnvironment();
  const override = await readQwen38MaxRuntimeOverride();
  return { providers: override?.payload.providers.length ? override.payload.providers : fallback.providers };
}

export async function getQwen38MaxProviderSettings() {
  const runtime = await getQwen38MaxRuntimeConfig();
  const override = await readQwen38MaxRuntimeOverride();
  return {
    providers: runtime.providers.map(provider => ({ id: provider.id, label: provider.label, enabled: provider.enabled, baseUrl: provider.baseUrl, model: provider.model, apiKeyMasks: provider.apiKeys.map((key, index) => ({ slot: index + 1, value: maskProviderApiKey(key), configured: Boolean(key) })) })),
    source: override ? "database" as const : "environment" as const,
    updatedAt: override?.updatedAt ?? null,
    updatedByUserId: override?.updatedByUserId ?? null,
  };
}

export async function updateQwen38MaxProviderSettings(input: { providers: Array<{ id: string; label: string; enabled?: boolean; baseUrl: string; model: string; apiKeys: string[]; removeSlots?: number[] }> }, updatedByUserId: number) {
  const db = await getDb();
  if (!db) throw new Error("TokenForge database is unavailable");
  const current = await getQwen38MaxRuntimeConfig();
  const currentById = new Map(current.providers.map(provider => [provider.id, provider]));
  const nextProviders = input.providers.map((submitted, index) => {
    const existing = currentById.get(submitted.id);
    const removedSlots = new Set(submitted.removeSlots ?? []);
    const retainedKeys = (existing?.apiKeys ?? []).filter((_, keyIndex) => !removedSlots.has(keyIndex + 1));
    const patchedExistingKeys = retainedKeys.map((key, keyIndex) => submitted.apiKeys[keyIndex]?.trim() || key);
    const appendedKeys = submitted.apiKeys.slice(retainedKeys.length).map(key => key.trim()).filter(Boolean);
    return { id: normalizeClaudeOpus5ProviderId(submitted.id, `provider-${index + 1}`), label: submitted.label.trim() || `Provider ${index + 1}`, enabled: submitted.enabled !== false, baseUrl: submitted.baseUrl.trim(), model: submitted.model.trim(), apiKeys: [...patchedExistingKeys, ...appendedKeys].filter(Boolean).slice(0, MAX_MANAGED_PROVIDER_API_KEYS) };
  });
  const ids = new Set(nextProviders.map(provider => provider.id));
  if (!nextProviders.length || nextProviders.length > MAX_CLAUDE_OPUS5_PROVIDERS || ids.size !== nextProviders.length || nextProviders.some(provider => !provider.baseUrl || !provider.model || !provider.apiKeys.length)) throw new Error("Each Qwen 3.8 Max provider needs a unique identifier, base URL, model ID, and at least one API key");
  const encrypted = encryptProviderRuntimeConfig({ providers: nextProviders } satisfies Qwen38MaxRuntimePayload);
  await db.insert(platformSettings).values({ settingKey: QWEN38_MAX_RUNTIME_SETTING_KEY, value: JSON.stringify(encrypted), updatedByUserId }).onDuplicateKeyUpdate({ set: { value: JSON.stringify(encrypted), updatedByUserId, updatedAt: new Date() } });
  return getQwen38MaxProviderSettings();
}

export type ClaudeOpus5ProviderRuntime = {
  id: string;
  label: string;
  enabled: boolean;
  baseUrl: string;
  model: string;
  apiKeys: string[];
  modelPool?: ClaudeOpus5QwenModelRuntime[];
  /** Qwen-only output ceiling, persisted inside the encrypted Claude Opus runtime configuration. */
  maxOutputTokens?: number;
};

export type ClaudeOpus5QwenModelRuntime = {
  id: string;
  model: string;
  enabled: boolean;
  quotaTokens: number;
};

export type ClaudeOpus5RuntimePayload = { providers: ClaudeOpus5ProviderRuntime[] };
const MAX_CLAUDE_OPUS5_PROVIDERS = 12;
export const CLAUDE_OPUS5_QWEN_DEFAULT_MODEL_TOKEN_QUOTA = 1_000_000;
const MAX_CLAUDE_OPUS5_QWEN_MODELS = 50;
export const CLAUDE_OPUS5_QWEN_MAX_OUTPUT_TOKENS = 32_768;

export type BailuWebshareProxyRuntime = {
  id: string;
  label: string;
  host: string;
  port: number;
  username: string;
  password: string;
  enabled: boolean;
};

type BailuWebshareProxyPoolRuntime = { enabled: boolean; proxies: BailuWebshareProxyRuntime[] };
const MAX_BAILU_WEBSHARE_PROXIES = 3;
export const BAILU_WEBSHARE_PROXY_COOLDOWN_MS = 60_000;
export type BailuWebshareProxySlotFailureKind = "network" | "timeout" | "stream";
export type BailuWebshareProxySlotOutcome =
  | { kind: "success" }
  | { kind: "cancelled" }
  | { kind: "failure"; failureKind: BailuWebshareProxySlotFailureKind; cooldown?: boolean };

function normalizeBailuWebshareProxyHost(value: unknown) {
  const host = typeof value === "string" ? value.trim() : "";
  if (!/^\d{1,3}(?:\.\d{1,3}){3}$/.test(host)) return "";
  return host.split(".").every(segment => Number(segment) >= 0 && Number(segment) <= 255) ? host : "";
}

function parseBailuWebshareDirectProxyUrl(value: unknown) {
  const raw = typeof value === "string" ? value.trim() : "";
  if (!raw) return null;
  try {
    const parsed = new URL(raw);
    if (!["http:", "https:", "socks5:"].includes(parsed.protocol)) return null;
    const host = normalizeBailuWebshareProxyHost(parsed.hostname);
    const port = Number(parsed.port);
    const username = decodeURIComponent(parsed.username);
    const password = decodeURIComponent(parsed.password);
    if (!host || !Number.isInteger(port) || port < 1 || port > 65_535 || !username || !password) return null;
    return { host, port, username: username.slice(0, 512), password: password.slice(0, 512) };
  } catch {
    return null;
  }
}

function normalizeBailuWebshareProxyPool(value: unknown, fallback: BailuWebshareProxyRuntime[] = []) {
  if (!Array.isArray(value)) return fallback;
  const seen = new Set<string>();
  const proxies = value.flatMap((candidate, index) => {
    if (!candidate || typeof candidate !== "object") return [];
    const raw = candidate as Partial<BailuWebshareProxyRuntime>;
    const id = normalizeClaudeOpus5ProviderId(raw.id, `webshare-${index + 1}`);
    const host = normalizeBailuWebshareProxyHost(raw.host);
    const port = Number(raw.port);
    const username = typeof raw.username === "string" ? raw.username.trim().slice(0, 512) : "";
    const password = typeof raw.password === "string" ? raw.password.slice(0, 512) : "";
    const label = typeof raw.label === "string" && raw.label.trim() ? raw.label.trim().slice(0, 80) : `Webshare proxy ${index + 1}`;
    if (seen.has(id) || !host || !Number.isInteger(port) || port < 1 || port > 65_535 || !username || !password) return [];
    seen.add(id);
    return [{ id, label, host, port, username, password, enabled: raw.enabled !== false }];
  }).slice(0, MAX_BAILU_WEBSHARE_PROXIES);
  return proxies;
}

async function readBailuWebshareProxyPoolOverride() {
  const db = await getDb();
  if (!db) return null;
  const record = (await db.select().from(platformSettings).where(eq(platformSettings.settingKey, BAILU_WEBSHARE_PROXY_POOL_SETTING_KEY)).limit(1))[0];
  if (!record) return null;
  try {
    const encoded = JSON.parse(record.value) as { ciphertext?: string; iv?: string; authTag?: string };
    const payload = decryptProviderRuntimeConfig({ ciphertext: String(encoded.ciphertext ?? ""), iv: String(encoded.iv ?? ""), authTag: String(encoded.authTag ?? "") }) as Partial<BailuWebshareProxyPoolRuntime> | null;
    if (!payload || typeof payload !== "object") return null;
    return {
      payload: { enabled: payload.enabled === true, proxies: normalizeBailuWebshareProxyPool(payload.proxies) },
      updatedAt: record.updatedAt,
      updatedByUserId: record.updatedByUserId,
    };
  } catch {
    return null;
  }
}

export async function getBailuWebshareProxyPoolRuntimeConfig(): Promise<BailuWebshareProxyPoolRuntime> {
  return (await readBailuWebshareProxyPoolOverride())?.payload ?? { enabled: false, proxies: [] };
}

async function ensureBailuWebshareProxySlotMetricRows(proxies: BailuWebshareProxyRuntime[]) {
  const db = await getDb();
  if (!db || !proxies.length) return;
  await Promise.all(proxies.map(proxy => db.insert(bailuWebshareProxySlotMetrics).values({ proxyId: proxy.id, proxyLabel: proxy.label }).onDuplicateKeyUpdate({ set: { proxyLabel: proxy.label } })));
}

export async function getBailuWebshareProxyPoolSettings() {
  const override = await readBailuWebshareProxyPoolOverride();
  const runtime = override?.payload ?? { enabled: false, proxies: [] };
  await ensureBailuWebshareProxySlotMetricRows(runtime.proxies);
  const db = await getDb();
  const metrics = db && runtime.proxies.length
    ? await db.select().from(bailuWebshareProxySlotMetrics).where(inArray(bailuWebshareProxySlotMetrics.proxyId, runtime.proxies.map(proxy => proxy.id)))
    : [];
  const metricsById = new Map(metrics.map(metric => [metric.proxyId, metric]));
  const now = new Date();
  return {
    enabled: runtime.enabled,
    proxies: runtime.proxies.map(proxy => {
      const metric = metricsById.get(proxy.id);
      const coolingDown = Boolean(metric?.cooldownUntil && metric.cooldownUntil > now);
      const degraded = Boolean(metric?.lastFailureAt && (!metric.lastSuccessAt || metric.lastFailureAt >= metric.lastSuccessAt));
      return {
        id: proxy.id,
        label: proxy.label,
        host: proxy.host,
        port: proxy.port,
        enabled: proxy.enabled,
        usernameMask: maskProviderApiKey(proxy.username),
        passwordConfigured: Boolean(proxy.password),
        metrics: {
          activeRequests: Number(metric?.activeRequests ?? 0),
          requestCount: Number(metric?.requestCount ?? 0),
          successCount: Number(metric?.successCount ?? 0),
          failureCount: Number(metric?.failureCount ?? 0),
          timeoutCount: Number(metric?.timeoutCount ?? 0),
          cooldownUntil: metric?.cooldownUntil ?? null,
          lastRequestAt: metric?.lastRequestAt ?? null,
          lastSuccessAt: metric?.lastSuccessAt ?? null,
          lastFailureAt: metric?.lastFailureAt ?? null,
          lastFailureKind: metric?.lastFailureKind ?? null,
          health: !proxy.enabled ? "disabled" as const : coolingDown ? "cooling-down" as const : degraded ? "degraded" as const : "healthy" as const,
        },
      };
    }),
    source: override ? "database" as const : "not_configured" as const,
    updatedAt: override?.updatedAt ?? null,
  };
}

/** Atomically reserves an eligible Bailu proxy slot; slots in their cooldown window are skipped. */
export async function tryAcquireBailuWebshareProxySlot(proxy: BailuWebshareProxyRuntime) {
  const db = await getDb();
  if (!db) return true;
  await ensureBailuWebshareProxySlotMetricRows([proxy]);
  const now = new Date();
  const result = await db.update(bailuWebshareProxySlotMetrics).set({
    activeRequests: sql`${bailuWebshareProxySlotMetrics.activeRequests} + 1`,
    requestCount: sql`${bailuWebshareProxySlotMetrics.requestCount} + 1`,
    lastRequestAt: now,
  }).where(and(
    eq(bailuWebshareProxySlotMetrics.proxyId, proxy.id),
    or(isNull(bailuWebshareProxySlotMetrics.cooldownUntil), lte(bailuWebshareProxySlotMetrics.cooldownUntil, now)),
  ));
  return Number(result[0]?.affectedRows ?? 0) === 1;
}

/** Releases a Bailu proxy reservation after the full response or stream ends, pausing only transport-failing slots. */
export async function releaseBailuWebshareProxySlot(proxyId: string, outcome: BailuWebshareProxySlotOutcome) {
  const db = await getDb();
  if (!db) return;
  const now = new Date();
  const isFailure = outcome.kind === "failure";
  const timeout = isFailure && outcome.failureKind === "timeout";
  const cooldownUntil = isFailure && outcome.cooldown ? new Date(now.getTime() + BAILU_WEBSHARE_PROXY_COOLDOWN_MS) : null;
  await db.update(bailuWebshareProxySlotMetrics).set({
    activeRequests: sql`GREATEST(${bailuWebshareProxySlotMetrics.activeRequests} - 1, 0)`,
    ...(outcome.kind === "success"
      ? { successCount: sql`${bailuWebshareProxySlotMetrics.successCount} + 1`, lastSuccessAt: now, cooldownUntil: null }
      : outcome.kind === "failure" ? {
        failureCount: sql`${bailuWebshareProxySlotMetrics.failureCount} + 1`,
        lastFailureAt: now,
        lastFailureKind: outcome.failureKind,
      } : {}),
    ...(timeout ? { timeoutCount: sql`${bailuWebshareProxySlotMetrics.timeoutCount} + 1` } : {}),
    ...(cooldownUntil ? { cooldownUntil } : {}),
  }).where(eq(bailuWebshareProxySlotMetrics.proxyId, proxyId));
}

export async function updateBailuWebshareProxyPoolSettings(input: { enabled?: boolean; proxies: Array<{ id: string; label?: string; host?: string; port?: number; username?: string; password?: string; proxyUrl?: string; enabled?: boolean }> }, updatedByUserId: number) {
  const db = await getDb();
  if (!db) throw new Error("TokenForge database is unavailable");
  const current = await getBailuWebshareProxyPoolRuntimeConfig();
  const existingById = new Map(current.proxies.map(proxy => [proxy.id, proxy]));
  const proxies = normalizeBailuWebshareProxyPool(input.proxies.map((submitted, index) => {
    const existing = existingById.get(submitted.id);
    const suppliedUrl = submitted.proxyUrl?.trim() ?? "";
    const parsedUrl = suppliedUrl ? parseBailuWebshareDirectProxyUrl(suppliedUrl) : null;
    const invalidSuppliedUrl = Boolean(suppliedUrl && !parsedUrl);
    return {
      id: submitted.id,
      label: submitted.label ?? `Webshare proxy ${index + 1}`,
      host: invalidSuppliedUrl ? "" : parsedUrl?.host ?? submitted.host ?? "",
      port: invalidSuppliedUrl ? 0 : parsedUrl?.port ?? submitted.port ?? 0,
      username: invalidSuppliedUrl ? "" : parsedUrl?.username || submitted.username?.trim() || existing?.username || "",
      password: invalidSuppliedUrl ? "" : parsedUrl?.password || submitted.password || existing?.password || "",
      enabled: submitted.enabled !== false,
    };
  }));
  if (input.enabled === true && !proxies.some(proxy => proxy.enabled)) {
    throw new Error("Enable at least one complete Webshare direct proxy before enabling Bailu proxy routing");
  }
  if (input.proxies.length !== proxies.length) {
    throw new Error("Each Webshare proxy needs a unique ID, IPv4 host, port, username, and password");
  }
  const encrypted = encryptProviderRuntimeConfig({ enabled: input.enabled === true, proxies } satisfies BailuWebshareProxyPoolRuntime);
  await db.insert(platformSettings).values({ settingKey: BAILU_WEBSHARE_PROXY_POOL_SETTING_KEY, value: JSON.stringify(encrypted), updatedByUserId }).onDuplicateKeyUpdate({ set: { value: JSON.stringify(encrypted), updatedByUserId, updatedAt: new Date() } });
  await ensureBailuWebshareProxySlotMetricRows(proxies);
  return getBailuWebshareProxyPoolSettings();
}

export const RENDER_NIM_PROXY_MAX_CONCURRENT_REQUESTS = 7;
const DEFAULT_RENDER_NIM_PROXY_ENDPOINTS = [
  "https://nim-playground-proxy.onrender.com",
  "https://nim-playground-proxy-2.onrender.com",
  "https://nim-playground-proxy-3.onrender.com",
  "https://nim-playground-proxy-4.onrender.com",
  "https://nim-playground-proxy-5.onrender.com",
  "https://nim-playground-proxy-6.onrender.com",
];

export type RenderNimProxyEndpoint = { id: string; url: string; enabled: boolean };
type RenderNimProxyRuntimePayload = { enabled: boolean; model: string; endpoints: RenderNimProxyEndpoint[] };
export type RenderNimProxyFailureKind = "http" | "timeout" | "network" | "stream";
export type RenderNimProxyReleaseOutcome =
  | { kind: "success" }
  | { kind: "cancelled" }
  | { kind: "failure"; failureKind: RenderNimProxyFailureKind; httpStatus?: number; message?: string; cooldown?: boolean };

/**
 * Render diagnostic text is shown to administrators and can also inform a caller-facing gateway error.
 * Keep it useful while eliminating credentials, header values, and credential-bearing URLs before storage.
 */
export function sanitizeRenderNimProxyFailureMessage(value: unknown) {
  const raw = value instanceof Error ? value.message : typeof value === "string" ? value : "";
  const sanitized = raw
    .replace(/\bBearer\s+[A-Za-z0-9._~+/=-]{8,}/gi, "Bearer [redacted]")
    .replace(/\b(?:sk|nvapi|cp)[_-][A-Za-z0-9._~+/=-]{8,}/gi, "[redacted]")
    .replace(/\b(authorization|x-api-key|api[-_]?key|token|secret|password)\s*[:=]\s*(?:Bearer\s+)?[^\s,;"'}\]]+/gi, "$1: [redacted]")
    .replace(/https?:\/\/[^\s/@]+@/gi, "https://[redacted]@")
    .trim();
  return sanitized || "Upstream request failed.";
}

function normalizeRenderNimProxyEndpointUrl(value: unknown) {
  if (typeof value !== "string") return "";
  try {
    const url = new URL(value.trim());
    return url.protocol === "https:" ? url.toString().replace(/\/$/, "") : "";
  } catch {
    return "";
  }
}

function normalizeRenderNimProxyEndpoints(value: unknown, fallback: RenderNimProxyEndpoint[]) {
  if (!Array.isArray(value)) return fallback;
  const seen = new Set<string>();
  const endpoints = value.flatMap((candidate, index) => {
    if (!candidate || typeof candidate !== "object") return [];
    const raw = candidate as Partial<RenderNimProxyEndpoint>;
    const id = typeof raw.id === "string" && /^[a-z0-9][a-z0-9_-]{0,63}$/i.test(raw.id.trim()) ? raw.id.trim().toLowerCase() : `render-${index + 1}`;
    const url = normalizeRenderNimProxyEndpointUrl(raw.url);
    if (!url || seen.has(id)) return [];
    seen.add(id);
    return [{ id, url, enabled: raw.enabled !== false }];
  }).slice(0, DEFAULT_RENDER_NIM_PROXY_ENDPOINTS.length);
  return endpoints.length ? endpoints : fallback;
}

function renderNimProxyRuntimeFromEnvironment(): RenderNimProxyRuntimePayload {
  return {
    enabled: Boolean(process.env.RENDER_NIM_PROXY_API_KEY?.trim() && process.env.RENDER_NIM_PROXY_MODEL?.trim()),
    model: process.env.RENDER_NIM_PROXY_MODEL?.trim() ?? "",
    endpoints: DEFAULT_RENDER_NIM_PROXY_ENDPOINTS.map((url, index) => ({ id: `render-${index + 1}`, url, enabled: true })),
  };
}

async function readRenderNimProxyRuntimeOverride() {
  const db = await getDb();
  if (!db) return null;
  const record = (await db.select().from(platformSettings).where(eq(platformSettings.settingKey, RENDER_NIM_PROXY_SWARM_SETTING_KEY)).limit(1))[0];
  if (!record) return null;
  try {
    const encoded = JSON.parse(record.value) as { ciphertext?: string; iv?: string; authTag?: string };
    const payload = decryptProviderRuntimeConfig({ ciphertext: String(encoded.ciphertext ?? ""), iv: String(encoded.iv ?? ""), authTag: String(encoded.authTag ?? "") }) as Partial<RenderNimProxyRuntimePayload> | null;
    if (!payload || typeof payload !== "object") return null;
    const fallback = renderNimProxyRuntimeFromEnvironment();
    return {
      payload: {
        enabled: payload.enabled !== false,
        model: typeof payload.model === "string" && payload.model.trim() ? payload.model.trim() : fallback.model,
        endpoints: normalizeRenderNimProxyEndpoints(payload.endpoints, fallback.endpoints),
      },
      updatedAt: record.updatedAt,
      updatedByUserId: record.updatedByUserId,
    };
  } catch {
    return null;
  }
}

export async function getRenderNimProxyRuntimeConfig(): Promise<RenderNimProxyRuntimePayload & { apiKey: string }> {
  const fallback = renderNimProxyRuntimeFromEnvironment();
  const override = await readRenderNimProxyRuntimeOverride();
  const payload = override?.payload ?? fallback;
  return { ...payload, apiKey: process.env.RENDER_NIM_PROXY_API_KEY?.trim() ?? "" };
}

async function ensureRenderNimProxyMetricRows(endpoints: RenderNimProxyEndpoint[]) {
  const db = await getDb();
  if (!db) return;
  await Promise.all(endpoints.map(endpoint => db.insert(renderProxyEndpointMetrics).values({ endpointId: endpoint.id, endpointUrl: endpoint.url }).onDuplicateKeyUpdate({ set: { endpointUrl: endpoint.url } })));
}

export async function getRenderNimProxySwarmSettings() {
  const runtime = await getRenderNimProxyRuntimeConfig();
  const override = await readRenderNimProxyRuntimeOverride();
  await ensureRenderNimProxyMetricRows(runtime.endpoints);
  const db = await getDb();
  const metrics = db ? await db.select().from(renderProxyEndpointMetrics).where(inArray(renderProxyEndpointMetrics.endpointId, runtime.endpoints.map(endpoint => endpoint.id))) : [];
  const metricsById = new Map(metrics.map(metric => [metric.endpointId, metric]));
  return {
    enabled: runtime.enabled,
    model: runtime.model,
    apiKeyConfigured: Boolean(runtime.apiKey),
    maxConcurrentRequests: RENDER_NIM_PROXY_MAX_CONCURRENT_REQUESTS,
    endpoints: runtime.endpoints.map(endpoint => {
      const metric = metricsById.get(endpoint.id);
      return {
        ...endpoint,
        activeRequests: Number(metric?.activeRequests ?? 0),
        availableSlots: Math.max(0, RENDER_NIM_PROXY_MAX_CONCURRENT_REQUESTS - Number(metric?.activeRequests ?? 0)),
        peakActiveRequests: Number(metric?.peakActiveRequests ?? 0),
        requestCount: Number(metric?.requestCount ?? 0),
        successCount: Number(metric?.successCount ?? 0),
        failureCount: Number(metric?.failureCount ?? 0),
        timeoutCount: Number(metric?.timeoutCount ?? 0),
        cooldownUntil: metric?.cooldownUntil ?? null,
        lastRequestAt: metric?.lastRequestAt ?? null,
        lastSuccessAt: metric?.lastSuccessAt ?? null,
        lastFailureAt: metric?.lastFailureAt ?? null,
        lastHttpStatus: metric?.lastHttpStatus ?? null,
        lastFailureKind: metric?.lastFailureKind ?? null,
        lastFailureMessage: metric?.lastFailureMessage ?? null,
      };
    }),
    source: override ? "database" as const : "environment" as const,
    updatedAt: override?.updatedAt ?? null,
  };
}

export async function updateRenderNimProxySwarmSettings(input: { enabled?: boolean; model: string; endpoints: RenderNimProxyEndpoint[] }, updatedByUserId: number) {
  const db = await getDb();
  if (!db) throw new Error("TokenForge database is unavailable");
  const endpoints = normalizeRenderNimProxyEndpoints(input.endpoints, []);
  const model = input.model.trim();
  if (!model || !endpoints.length) throw new Error("A Render proxy model ID and at least one HTTPS endpoint are required");
  const payload: RenderNimProxyRuntimePayload = { enabled: input.enabled !== false, model, endpoints };
  const encrypted = encryptProviderRuntimeConfig(payload);
  await db.insert(platformSettings).values({ settingKey: RENDER_NIM_PROXY_SWARM_SETTING_KEY, value: JSON.stringify(encrypted), updatedByUserId }).onDuplicateKeyUpdate({ set: { value: JSON.stringify(encrypted), updatedByUserId, updatedAt: new Date() } });
  await ensureRenderNimProxyMetricRows(endpoints);
  return getRenderNimProxySwarmSettings();
}

export async function tryAcquireRenderNimProxyEndpoint(endpoint: RenderNimProxyEndpoint) {
  const db = await getDb();
  if (!db) return false;
  await ensureRenderNimProxyMetricRows([endpoint]);
  const now = new Date();
  const result = await db.update(renderProxyEndpointMetrics).set({
    activeRequests: sql`${renderProxyEndpointMetrics.activeRequests} + 1`,
    peakActiveRequests: sql`GREATEST(${renderProxyEndpointMetrics.peakActiveRequests}, ${renderProxyEndpointMetrics.activeRequests} + 1)`,
    requestCount: sql`${renderProxyEndpointMetrics.requestCount} + 1`,
    lastRequestAt: now,
  }).where(and(
    eq(renderProxyEndpointMetrics.endpointId, endpoint.id),
    lt(renderProxyEndpointMetrics.activeRequests, RENDER_NIM_PROXY_MAX_CONCURRENT_REQUESTS),
    or(isNull(renderProxyEndpointMetrics.cooldownUntil), lte(renderProxyEndpointMetrics.cooldownUntil, now)),
  ));
  return Number(result[0]?.affectedRows ?? 0) === 1;
}

export async function releaseRenderNimProxyEndpoint(endpointId: string, outcome: RenderNimProxyReleaseOutcome) {
  const db = await getDb();
  if (!db) return;
  const now = new Date();
  const isFailure = outcome.kind === "failure";
  const timeout = isFailure && outcome.failureKind === "timeout";
  const cooldownUntil = isFailure && outcome.cooldown ? new Date(now.getTime() + 60_000) : null;
  const httpStatus = isFailure && Number.isInteger(outcome.httpStatus) && outcome.httpStatus! >= 100 && outcome.httpStatus! <= 599
    ? outcome.httpStatus!
    : null;
  await db.update(renderProxyEndpointMetrics).set({
    activeRequests: sql`GREATEST(${renderProxyEndpointMetrics.activeRequests} - 1, 0)`,
    ...(outcome.kind === "success"
      ? { successCount: sql`${renderProxyEndpointMetrics.successCount} + 1`, lastSuccessAt: now }
      : isFailure
        ? {
          failureCount: sql`${renderProxyEndpointMetrics.failureCount} + 1`,
          lastFailureAt: now,
          lastHttpStatus: httpStatus,
          lastFailureKind: outcome.failureKind,
          lastFailureMessage: sanitizeRenderNimProxyFailureMessage(outcome.message),
        }
        : {}),
    ...(timeout ? { timeoutCount: sql`${renderProxyEndpointMetrics.timeoutCount} + 1` } : {}),
    ...(cooldownUntil ? { cooldownUntil } : {}),
  }).where(eq(renderProxyEndpointMetrics.endpointId, endpointId));
  if (isFailure) {
    await recordClaudeOpus5FailureLog({
      sourceType: "render",
      sourceId: endpointId,
      sourceLabel: `Render endpoint ${endpointId}`,
      httpStatus: outcome.httpStatus,
      failureKind: outcome.failureKind,
      retryable: Boolean(outcome.cooldown),
      callerMessage: outcome.message,
    });
  }
}

export type ManagedProviderFailureLogInput = {
  sourceType: "provider" | "render";
  sourceId: string;
  sourceLabel: string;
  httpStatus?: number;
  failureKind: "http" | "timeout" | "network" | "stream" | "empty_output";
  retryable: boolean;
  callerMessage?: string;
};

type ManagedProviderFailureLogModel = "claude-opus-5" | "claude-fable-5" | "glm-5.3" | "claude-sonnet-4.6" | "deepseek-v4-pro" | "qwen3.8-max";

/**
 * Stores a raw credential-redacted managed-model upstream failure attempt.
 * The record intentionally excludes request content, user identity, headers, and API-key material.
 */
async function recordManagedProviderFailureLog(modelId: ManagedProviderFailureLogModel, input: ManagedProviderFailureLogInput) {
  const db = await getDb();
  if (!db) return;
  const httpStatus = Number.isInteger(input.httpStatus) && input.httpStatus! >= 100 && input.httpStatus! <= 599
    ? input.httpStatus!
    : null;
  await db.insert(claudeOpus5FailureLogs).values({
    modelId,
    sourceType: input.sourceType,
    sourceId: input.sourceId.trim().slice(0, 96) || "unknown",
    sourceLabel: sanitizeRenderNimProxyFailureMessage(input.sourceLabel).slice(0, 128),
    httpStatus,
    failureKind: input.failureKind,
    retryable: input.retryable,
    callerMessage: sanitizeRenderNimProxyFailureMessage(input.callerMessage),
  });
}

export async function recordClaudeOpus5FailureLog(input: ManagedProviderFailureLogInput) {
  return recordManagedProviderFailureLog("claude-opus-5", input);
}

export async function recordDeepseekV4ProFailureLog(input: ManagedProviderFailureLogInput) {
  return recordManagedProviderFailureLog("deepseek-v4-pro", input);
}

export async function recordClaudeFable5FailureLog(input: ManagedProviderFailureLogInput) {
  return recordManagedProviderFailureLog("claude-fable-5", input);
}

export async function recordGlm53FailureLog(input: ManagedProviderFailureLogInput) {
  return recordManagedProviderFailureLog("glm-5.3", input);
}

export async function recordSonnet46FailureLog(input: ManagedProviderFailureLogInput) {
  return recordManagedProviderFailureLog("claude-sonnet-4.6", input);
}

export async function recordQwen38MaxFailureLog(input: ManagedProviderFailureLogInput) {
  return recordManagedProviderFailureLog("qwen3.8-max", input);
}

export async function getRecentClaudeOpus5FailureLogs(limit = 100) {
  return getRecentManagedProviderFailureLogs("claude-opus-5", limit);
}

export async function getRecentDeepseekV4ProFailureLogs(limit = 100) {
  return getRecentManagedProviderFailureLogs("deepseek-v4-pro", limit);
}

export async function getRecentClaudeFable5FailureLogs(limit = 100) {
  return getRecentManagedProviderFailureLogs("claude-fable-5", limit);
}

export async function getRecentGlm53FailureLogs(limit = 100) {
  return getRecentManagedProviderFailureLogs("glm-5.3", limit);
}

export async function getRecentSonnet46FailureLogs(limit = 100) {
  return getRecentManagedProviderFailureLogs("claude-sonnet-4.6", limit);
}

export async function getRecentQwen38MaxFailureLogs(limit = 100) {
  return getRecentManagedProviderFailureLogs("qwen3.8-max", limit);
}

export const MANAGED_PROVIDER_FAILURE_LOG_RETENTION_MS = 28 * 60 * 60 * 1_000;

/** Removes credential-redacted provider diagnostics after their 28-hour administrator retention window. */
export async function pruneExpiredManagedProviderFailureLogs(now = new Date()) {
  const db = await getDb();
  const cutoff = new Date(now.getTime() - MANAGED_PROVIDER_FAILURE_LOG_RETENTION_MS);
  if (!db) return { cutoff, deleted: false };
  await db.delete(claudeOpus5FailureLogs).where(lt(claudeOpus5FailureLogs.occurredAt, cutoff));
  return { cutoff, deleted: true };
}

/** The administrator history is bounded by record count while preserving each credential-redacted raw response body. */
async function getRecentManagedProviderFailureLogs(modelId: ManagedProviderFailureLogModel, limit = 100) {
  const db = await getDb();
  if (!db) return [];
  const boundedLimit = Math.min(200, Math.max(1, Math.trunc(limit)));
  return db.select().from(claudeOpus5FailureLogs).where(eq(claudeOpus5FailureLogs.modelId, modelId)).orderBy(desc(claudeOpus5FailureLogs.occurredAt), desc(claudeOpus5FailureLogs.id)).limit(boundedLimit);
}

function normalizeClaudeOpus5ProviderId(value: unknown, fallback: string) {
  const normalized = typeof value === "string" ? value.trim().toLowerCase() : "";
  return /^[a-z0-9][a-z0-9_-]{0,63}$/.test(normalized) ? normalized : fallback;
}

function isClaudeOpus5QwenProvider(label: string) {
  return label.trim().toLowerCase() === "qwen";
}

function normalizeClaudeOpus5QwenModelPool(value: unknown) {
  if (!Array.isArray(value)) return [] as ClaudeOpus5QwenModelRuntime[];
  const seen = new Set<string>();
  return value.flatMap((candidate, index) => {
    if (!candidate || typeof candidate !== "object") return [];
    const raw = candidate as Partial<ClaudeOpus5QwenModelRuntime>;
    const id = normalizeClaudeOpus5ProviderId(raw.id, `qwen-model-${index + 1}`);
    const model = typeof raw.model === "string" ? raw.model.trim().slice(0, 256) : "";
    const quotaCandidate = Number(raw.quotaTokens);
    const quotaTokens = Number.isFinite(quotaCandidate)
      ? Math.min(100_000_000, Math.max(1_000, Math.trunc(quotaCandidate)))
      : CLAUDE_OPUS5_QWEN_DEFAULT_MODEL_TOKEN_QUOTA;
    if (!model || seen.has(id)) return [];
    seen.add(id);
    return [{ id, model, enabled: raw.enabled !== false, quotaTokens }];
  }).slice(0, MAX_CLAUDE_OPUS5_QWEN_MODELS);
}

function normalizeClaudeOpus5QwenMaxOutputTokens(value: unknown) {
  const candidate = Number(value);
  if (!Number.isFinite(candidate)) return CLAUDE_OPUS5_QWEN_MAX_OUTPUT_TOKENS;
  return Math.min(CLAUDE_OPUS5_QWEN_MAX_OUTPUT_TOKENS, Math.max(1, Math.trunc(candidate)));
}

function normalizeClaudeOpus5Providers(value: unknown, fallback: ClaudeOpus5ProviderRuntime[]) {
  if (!Array.isArray(value)) return fallback;
  const seen = new Set<string>();
  const providers = value.flatMap((candidate, index) => {
    if (!candidate || typeof candidate !== "object") return [];
    const raw = candidate as Partial<ClaudeOpus5ProviderRuntime>;
    const id = normalizeClaudeOpus5ProviderId(raw.id, `provider-${index + 1}`);
    if (seen.has(id)) return [];
    seen.add(id);
    const apiKeys = Array.isArray(raw.apiKeys)
      ? raw.apiKeys.map(key => typeof key === "string" ? key.trim() : "").filter(Boolean).slice(0, MAX_MANAGED_PROVIDER_API_KEYS)
      : [];
    const baseUrl = typeof raw.baseUrl === "string" ? raw.baseUrl.trim() : "";
    const label = typeof raw.label === "string" && raw.label.trim() ? raw.label.trim().slice(0, 80) : `Provider ${index + 1}`;
    const isQwenProvider = isClaudeOpus5QwenProvider(label);
    const modelPool = isQwenProvider ? normalizeClaudeOpus5QwenModelPool(raw.modelPool) : [];
    const maxOutputTokens = isQwenProvider ? normalizeClaudeOpus5QwenMaxOutputTokens(raw.maxOutputTokens) : undefined;
    const model = (typeof raw.model === "string" ? raw.model.trim() : "") || modelPool[0]?.model || "";
    if (!baseUrl || !model || !apiKeys.length) return [];
    return [{
      id,
      label,
      enabled: raw.enabled !== false,
      baseUrl,
      model,
      apiKeys,
      ...(modelPool.length ? { modelPool } : {}),
      ...(isQwenProvider ? { maxOutputTokens } : {}),
    }];
  }).slice(0, MAX_CLAUDE_OPUS5_PROVIDERS);
  return providers.length ? providers : fallback;
}

export function removeClaudeOpus5QwenModelFromRuntime(runtime: ClaudeOpus5RuntimePayload, providerId: string, modelEntryId: string): ClaudeOpus5RuntimePayload {
  const provider = runtime.providers.find(candidate => candidate.id === providerId && isClaudeOpus5QwenProvider(candidate.label));
  if (!provider) throw new Error("Qwen provider configuration was not found");
  const pool = provider.modelPool ?? [];
  if (!pool.some(entry => entry.id === modelEntryId)) throw new Error("Qwen model entry was not found");
  if (pool.length <= 1) throw new Error("Keep at least one Qwen model ID in the pool");
  const nextPool = pool.filter(entry => entry.id !== modelEntryId);
  return { providers: runtime.providers.map(candidate => candidate.id === provider.id ? {
    ...candidate,
    model: nextPool[0]!.model,
    modelPool: nextPool,
  } : candidate) };
}

export function removeClaudeOpus5QwenApiKeyFromRuntime(runtime: ClaudeOpus5RuntimePayload, providerId: string, slot: number): { runtime: ClaudeOpus5RuntimePayload; removedApiKey: string } {
  const provider = runtime.providers.find(candidate => candidate.id === providerId && isClaudeOpus5QwenProvider(candidate.label));
  if (!provider) throw new Error("Qwen provider configuration was not found");
  const keyIndex = Math.trunc(slot) - 1;
  const removedApiKey = provider.apiKeys[keyIndex];
  if (!removedApiKey) throw new Error("Qwen API-key slot was not found");
  if (provider.apiKeys.length <= 2) throw new Error("Keep at least two active Qwen API keys");
  return {
    removedApiKey,
    runtime: { providers: runtime.providers.map(candidate => candidate.id === provider.id ? {
      ...candidate,
      apiKeys: candidate.apiKeys.filter((_, index) => index !== keyIndex),
    } : candidate) },
  };
}

type ClaudeOpus5QwenModelUsage = {
  modelEntryId: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  requestCount: number;
  lastUsedAt: Date | null;
  retiredAt: Date | null;
};

export async function getClaudeOpus5QwenModelUsage(providerGroupId: string) {
  const db = await getDb();
  if (!db) return new Map<string, ClaudeOpus5QwenModelUsage>();
  const rows = await db.select().from(managedProviderModelUsage).where(and(
    eq(managedProviderModelUsage.providerModelId, "claude-opus-5"),
    eq(managedProviderModelUsage.providerGroupId, providerGroupId),
  ));
  return new Map(rows.map(row => [row.modelEntryId, {
    modelEntryId: row.modelEntryId,
    inputTokens: Number(row.inputTokens),
    outputTokens: Number(row.outputTokens),
    totalTokens: Number(row.totalTokens),
    requestCount: Number(row.requestCount),
    lastUsedAt: row.lastUsedAt ?? null,
    retiredAt: row.retiredAt ?? null,
  }]));
}

/** Returns only eligible encrypted Qwen model entries; this server-only helper is never exposed to callers. */
export async function getEligibleClaudeOpus5QwenModels(provider: ClaudeOpus5ProviderRuntime) {
  const pool = provider.modelPool ?? [];
  const usage = await getClaudeOpus5QwenModelUsage(provider.id);
  return pool.filter(entry => entry.enabled && (usage.get(entry.id)?.totalTokens ?? 0) < entry.quotaTokens);
}

/** Adds actual upstream billable tokens and marks an internal Qwen model entry retired once its configured quota is reached. */
export async function recordClaudeOpus5QwenModelUsage(input: { providerGroupId: string; modelEntryId: string; inputTokens: number; outputTokens: number; totalTokens: number; quotaTokens: number; occurredAt?: Date }) {
  const db = await getDb();
  if (!db) return;
  const inputTokens = Math.max(0, Math.trunc(input.inputTokens));
  const outputTokens = Math.max(0, Math.trunc(input.outputTokens));
  const totalTokens = Math.max(inputTokens + outputTokens, Math.trunc(input.totalTokens));
  if (!input.providerGroupId || !input.modelEntryId || !totalTokens) return;
  const occurredAt = input.occurredAt ?? new Date();
  await db.insert(managedProviderModelUsage).values({
    providerModelId: "claude-opus-5",
    providerGroupId: input.providerGroupId,
    modelEntryId: input.modelEntryId,
    inputTokens,
    outputTokens,
    totalTokens,
    requestCount: 1,
    lastUsedAt: occurredAt,
  }).onDuplicateKeyUpdate({ set: {
    inputTokens: sql`${managedProviderModelUsage.inputTokens} + ${inputTokens}`,
    outputTokens: sql`${managedProviderModelUsage.outputTokens} + ${outputTokens}`,
    totalTokens: sql`${managedProviderModelUsage.totalTokens} + ${totalTokens}`,
    requestCount: sql`${managedProviderModelUsage.requestCount} + 1`,
    lastUsedAt: occurredAt,
  } });
  await db.update(managedProviderModelUsage).set({ retiredAt: occurredAt }).where(and(
    eq(managedProviderModelUsage.providerModelId, "claude-opus-5"),
    eq(managedProviderModelUsage.providerGroupId, input.providerGroupId),
    eq(managedProviderModelUsage.modelEntryId, input.modelEntryId),
    gte(managedProviderModelUsage.totalTokens, Math.max(1_000, Math.trunc(input.quotaTokens))),
    isNull(managedProviderModelUsage.retiredAt),
  ));
}

function claudeOpus5RuntimeFromEnvironment(): ClaudeOpus5RuntimePayload {
  return {
    providers: normalizeClaudeOpus5Providers([{
      id: "environment-default",
      label: "Environment default",
      enabled: true,
      baseUrl: process.env.OPENCODE_CLAUDE_OPUS5_BASE_URL?.trim() ?? "",
      model: process.env.OPENCODE_CLAUDE_OPUS5_MODEL?.trim() ?? "",
      apiKeys: [
        process.env.OPENCODE_CLAUDE_OPUS5_API_KEY,
        process.env.OPENCODE_CLAUDE_OPUS5_API_KEY_2,
        process.env.OPENCODE_CLAUDE_OPUS5_API_KEY_3,
        process.env.OPENCODE_CLAUDE_OPUS5_API_KEY_4,
        process.env.OPENCODE_CLAUDE_OPUS5_API_KEY_5,
        process.env.OPENCODE_CLAUDE_OPUS5_API_KEY_6,
        process.env.OPENCODE_CLAUDE_OPUS5_API_KEY_7,
      ].map(value => value?.trim() ?? ""),
    }], []),
  };
}

async function readClaudeOpus5RuntimeOverride() {
  const db = await getDb();
  if (!db) return null;
  const record = (await db.select().from(platformSettings).where(eq(platformSettings.settingKey, CLAUDE_OPUS5_TOKENREPLY_RUNTIME_SETTING_KEY)).limit(1))[0];
  if (!record) return null;
  try {
    const encoded = JSON.parse(record.value) as { ciphertext?: string; iv?: string; authTag?: string };
    const decrypted = decryptProviderRuntimeConfig({ ciphertext: String(encoded.ciphertext ?? ""), iv: String(encoded.iv ?? ""), authTag: String(encoded.authTag ?? "") });
    if (!decrypted || typeof decrypted !== "object") return null;
    const candidate = decrypted as Partial<ClaudeOpus5RuntimePayload> & { baseUrl?: unknown; model?: unknown; apiKeys?: unknown };
    const legacyProvider = {
      id: "primary",
      label: "Primary provider",
      enabled: candidate.providers?.[0]?.enabled !== false,
      baseUrl: typeof candidate.baseUrl === "string" ? candidate.baseUrl.trim() : "",
      model: typeof candidate.model === "string" ? candidate.model.trim() : "",
      apiKeys: Array.isArray(candidate.apiKeys) ? candidate.apiKeys : [],
    };
    return {
      payload: { providers: normalizeClaudeOpus5Providers(candidate.providers, normalizeClaudeOpus5Providers([legacyProvider], [])) },
      updatedAt: record.updatedAt,
      updatedByUserId: record.updatedByUserId,
    };
  } catch {
    return null;
  }
}

export async function getClaudeOpus5RuntimeConfig(): Promise<ClaudeOpus5RuntimePayload> {
  const fallback = claudeOpus5RuntimeFromEnvironment();
  const override = await readClaudeOpus5RuntimeOverride();
  if (!override) return fallback;
  return { providers: override.payload.providers.length ? override.payload.providers : fallback.providers };
}

export async function getClaudeOpus5ProviderSettings() {
  const runtime = await getClaudeOpus5RuntimeConfig();
  const override = await readClaudeOpus5RuntimeOverride();
  const usageByProvider = new Map(await Promise.all(runtime.providers.filter(provider => isClaudeOpus5QwenProvider(provider.label)).map(async provider => [provider.id, await getClaudeOpus5QwenModelUsage(provider.id)] as const)));
  const baiCircuitByProvider = new Map((await getBaiProviderCircuitStatuses()).map(status => [status.providerGroupId, status] as const));
  return {
    providers: runtime.providers.map(provider => {
      const usage = usageByProvider.get(provider.id);
      return {
        id: provider.id,
        label: provider.label,
        enabled: provider.enabled,
        baseUrl: provider.baseUrl,
        model: provider.model,
        apiKeyMasks: provider.apiKeys.map((key, index) => ({ slot: index + 1, value: maskProviderApiKey(key), configured: Boolean(key) })),
        ...(isClaudeOpus5QwenProvider(provider.label) ? {
          maxOutputTokens: provider.maxOutputTokens ?? CLAUDE_OPUS5_QWEN_MAX_OUTPUT_TOKENS,
          modelPool: (provider.modelPool ?? []).map(entry => {
            const totals = usage?.get(entry.id);
            const totalTokens = totals?.totalTokens ?? 0;
            return {
              id: entry.id,
              model: entry.model,
              enabled: entry.enabled,
              quotaTokens: entry.quotaTokens,
              inputTokens: totals?.inputTokens ?? 0,
              outputTokens: totals?.outputTokens ?? 0,
              totalTokens,
              requestCount: totals?.requestCount ?? 0,
              retired: totalTokens >= entry.quotaTokens,
              retiredAt: totals?.retiredAt ?? null,
              lastUsedAt: totals?.lastUsedAt ?? null,
            };
          }),
        } : {}),
        ...(provider.label.trim().toLowerCase() === "b.ai" ? {
          baiCircuit: baiCircuitByProvider.get(provider.id) ?? {
            providerGroupId: provider.id,
            rateLimitCount: 0,
            consecutiveRateLimits: 0,
            cooldownUntil: null,
            lastRateLimitedAt: null,
            lastSuccessAt: null,
            coolingDown: false,
          },
        } : {}),
      };
    }),
    source: override ? "database" as const : "environment" as const,
    updatedAt: override?.updatedAt ?? null,
    updatedByUserId: override?.updatedByUserId ?? null,
  };
}

export async function updateClaudeOpus5ProviderSettings(input: { providers: Array<{ id: string; label: string; enabled?: boolean; baseUrl: string; model: string; apiKeys: string[]; removeSlots?: number[]; modelPool?: Array<{ id: string; model: string; enabled?: boolean; quotaTokens?: number }>; maxOutputTokens?: number }> }, updatedByUserId: number) {
  const db = await getDb();
  if (!db) throw new Error("TokenForge database is unavailable");
  const current = await getClaudeOpus5RuntimeConfig();
  const currentById = new Map(current.providers.map(provider => [provider.id, provider]));
  const nextProviders = input.providers.map((submitted, index) => {
    const existing = currentById.get(submitted.id);
    const removedSlots = new Set(submitted.removeSlots ?? []);
    const retainedKeys = (existing?.apiKeys ?? []).filter((_, keyIndex) => !removedSlots.has(keyIndex + 1));
    const patchedExistingKeys = retainedKeys.map((key, keyIndex) => submitted.apiKeys[keyIndex]?.trim() || key);
    const appendedKeys = submitted.apiKeys.slice(retainedKeys.length).map(key => key.trim()).filter(Boolean);
    const id = normalizeClaudeOpus5ProviderId(submitted.id, `provider-${index + 1}`);
    const label = submitted.label.trim() || `Provider ${index + 1}`;
    const submittedPool = submitted.modelPool === undefined ? existing?.modelPool : submitted.modelPool;
    const qwenPool = isClaudeOpus5QwenProvider(label)
      ? normalizeClaudeOpus5QwenModelPool(submittedPool?.length ? submittedPool : [{ id: "qwen-model-1", model: submitted.model, enabled: true, quotaTokens: CLAUDE_OPUS5_QWEN_DEFAULT_MODEL_TOKEN_QUOTA }])
      : [];
    const maxOutputTokens = isClaudeOpus5QwenProvider(label)
      ? normalizeClaudeOpus5QwenMaxOutputTokens(submitted.maxOutputTokens ?? existing?.maxOutputTokens)
      : undefined;
    return {
      id,
      label,
      enabled: submitted.enabled !== false,
      baseUrl: submitted.baseUrl.trim(),
      model: submitted.model.trim() || qwenPool[0]?.model || "",
      apiKeys: [...patchedExistingKeys, ...appendedKeys].filter(Boolean).slice(0, MAX_MANAGED_PROVIDER_API_KEYS),
      ...(qwenPool.length ? { modelPool: qwenPool } : {}),
      ...(maxOutputTokens !== undefined ? { maxOutputTokens } : {}),
    };
  });
  const submittedProviderIds = new Set(nextProviders.map(provider => provider.id));
  for (const provider of current.providers) {
    if (isClaudeOpus5QwenProvider(provider.label) && !submittedProviderIds.has(provider.id)) nextProviders.push(provider);
  }
  const ids = new Set(nextProviders.map(provider => provider.id));
  if (!nextProviders.length || nextProviders.length > MAX_CLAUDE_OPUS5_PROVIDERS || ids.size !== nextProviders.length || nextProviders.some(provider => !provider.baseUrl || !provider.model || !provider.apiKeys.length || (isClaudeOpus5QwenProvider(provider.label) && provider.apiKeys.length < 2))) {
    throw new Error("Each Claude Opus 5 provider needs a unique identifier, base URL, model ID, and at least one API key");
  }
  const next: ClaudeOpus5RuntimePayload = { providers: nextProviders };
  const encrypted = encryptProviderRuntimeConfig(next);
  await db.insert(platformSettings).values({
    settingKey: CLAUDE_OPUS5_TOKENREPLY_RUNTIME_SETTING_KEY,
    value: JSON.stringify(encrypted),
    updatedByUserId,
  }).onDuplicateKeyUpdate({ set: { value: JSON.stringify(encrypted), updatedByUserId, updatedAt: new Date() } });
  return getClaudeOpus5ProviderSettings();
}

export async function deleteClaudeOpus5QwenModel(input: { providerId: string; modelEntryId: string }, updatedByUserId: number) {
  const db = await getDb();
  if (!db) throw new Error("TokenForge database is unavailable");
  const current = await getClaudeOpus5RuntimeConfig();
  const next = removeClaudeOpus5QwenModelFromRuntime(current, input.providerId, input.modelEntryId);
  const encrypted = encryptProviderRuntimeConfig(next);
  await db.transaction(async tx => {
    await tx.insert(platformSettings).values({
      settingKey: CLAUDE_OPUS5_TOKENREPLY_RUNTIME_SETTING_KEY,
      value: JSON.stringify(encrypted),
      updatedByUserId,
    }).onDuplicateKeyUpdate({ set: { value: JSON.stringify(encrypted), updatedByUserId, updatedAt: new Date() } });
    await tx.delete(managedProviderModelUsage).where(and(
      eq(managedProviderModelUsage.providerModelId, "claude-opus-5"),
      eq(managedProviderModelUsage.providerGroupId, input.providerId),
      eq(managedProviderModelUsage.modelEntryId, input.modelEntryId),
    ));
    await tx.delete(claudeOpus5FailureLogs).where(and(
      eq(claudeOpus5FailureLogs.modelId, "claude-opus-5"),
      eq(claudeOpus5FailureLogs.sourceId, `qwen:${input.modelEntryId}`),
    ));
  });
  return getClaudeOpus5ProviderSettings();
}

export async function deleteClaudeOpus5QwenApiKey(input: { providerId: string; slot: number }, updatedByUserId: number) {
  const db = await getDb();
  if (!db) throw new Error("TokenForge database is unavailable");
  const current = await getClaudeOpus5RuntimeConfig();
  const { runtime, removedApiKey } = removeClaudeOpus5QwenApiKeyFromRuntime(current, input.providerId, input.slot);
  const encrypted = encryptProviderRuntimeConfig(runtime);
  const fingerprint = managedProviderCredentialFingerprint("claude-opus-5", removedApiKey, input.providerId);
  await db.transaction(async tx => {
    await tx.insert(platformSettings).values({
      settingKey: CLAUDE_OPUS5_TOKENREPLY_RUNTIME_SETTING_KEY,
      value: JSON.stringify(encrypted),
      updatedByUserId,
    }).onDuplicateKeyUpdate({ set: { value: JSON.stringify(encrypted), updatedByUserId, updatedAt: new Date() } });
    await tx.delete(providerKeyMetrics).where(and(
      eq(providerKeyMetrics.providerModelId, "claude-opus-5"),
      eq(providerKeyMetrics.credentialFingerprint, fingerprint),
    ));
  });
  return getClaudeOpus5ProviderSettings();
}

type Glm53RuntimePayload = { baseUrl: string; model: string; apiKeys: string[] };

function glm53RuntimeFromEnvironment(): Glm53RuntimePayload {
  return {
    baseUrl: process.env.TOKENROUTER_BASE_URL?.trim() ?? "",
    model: process.env.TOKENROUTER_GLM53_MODEL?.trim() ?? "",
    apiKeys: getTokenRouterCredentialPool(),
  };
}

async function readGlm53RuntimeOverride() {
  const db = await getDb();
  if (!db) return null;
  const record = (await db.select().from(platformSettings).where(eq(platformSettings.settingKey, GLM53_RUNTIME_SETTING_KEY)).limit(1))[0];
  if (!record) return null;
  try {
    const encoded = JSON.parse(record.value) as { ciphertext?: string; iv?: string; authTag?: string };
    const decrypted = decryptProviderRuntimeConfig({ ciphertext: String(encoded.ciphertext ?? ""), iv: String(encoded.iv ?? ""), authTag: String(encoded.authTag ?? "") });
    if (!decrypted || typeof decrypted !== "object") return null;
    const candidate = decrypted as Partial<Glm53RuntimePayload>;
    const configuredKeys = Array.isArray(candidate.apiKeys)
      ? candidate.apiKeys.map(value => typeof value === "string" ? value.trim() : "").filter(Boolean).slice(0, MAX_MANAGED_PROVIDER_API_KEYS)
      : [];
    return {
      payload: {
        baseUrl: typeof candidate.baseUrl === "string" ? candidate.baseUrl.trim() : "",
        model: typeof candidate.model === "string" ? candidate.model.trim() : "",
        apiKeys: configuredKeys,
      },
      updatedAt: record.updatedAt,
      updatedByUserId: record.updatedByUserId,
    };
  } catch {
    return null;
  }
}

export async function getGlm53RuntimeConfig(): Promise<Glm53RuntimePayload> {
  const fallback = glm53RuntimeFromEnvironment();
  const override = await readGlm53RuntimeOverride();
  if (!override) return fallback;
  return {
    baseUrl: override.payload.baseUrl || fallback.baseUrl,
    model: override.payload.model || fallback.model,
    apiKeys: override.payload.apiKeys.length ? override.payload.apiKeys : fallback.apiKeys.filter(Boolean),
  };
}

export async function getGlm53ProviderSettings() {
  const runtime = await getGlm53RuntimeConfig();
  const override = await readGlm53RuntimeOverride();
  return {
    baseUrl: runtime.baseUrl,
    model: runtime.model,
    apiKeyMasks: runtime.apiKeys.map((key, index) => ({ slot: index + 1, value: maskProviderApiKey(key), configured: Boolean(key) })),
    source: override ? "database" as const : "environment" as const,
    updatedAt: override?.updatedAt ?? null,
    updatedByUserId: override?.updatedByUserId ?? null,
  };
}

export async function updateGlm53ProviderSettings(input: { baseUrl?: string; model?: string; apiKeys?: string[]; removeSlots?: number[] }, updatedByUserId: number) {
  const db = await getDb();
  if (!db) throw new Error("TokenForge database is unavailable");
  const current = await getGlm53RuntimeConfig();
  const removedSlots = new Set(input.removeSlots ?? []);
  const retainedKeys = current.apiKeys.filter((_, index) => !removedSlots.has(index + 1));
  const submittedKeys = input.apiKeys ?? [];
  const patchedExistingKeys = retainedKeys.map((key, index) => submittedKeys[index]?.trim() || key);
  const appendedKeys = submittedKeys.slice(retainedKeys.length).map(key => key.trim()).filter(Boolean);
  const next: Glm53RuntimePayload = {
    baseUrl: input.baseUrl?.trim() || current.baseUrl,
    model: input.model?.trim() || current.model,
    apiKeys: [...patchedExistingKeys, ...appendedKeys].filter(Boolean).slice(0, MAX_MANAGED_PROVIDER_API_KEYS),
  };
  if (!next.baseUrl || !next.model || !next.apiKeys.some(Boolean)) throw new Error("A base URL, model ID, and at least one API key are required for GLM 5.3");
  const encrypted = encryptProviderRuntimeConfig(next);
  await db.insert(platformSettings).values({
    settingKey: GLM53_RUNTIME_SETTING_KEY,
    value: JSON.stringify(encrypted),
    updatedByUserId,
  }).onDuplicateKeyUpdate({ set: { value: JSON.stringify(encrypted), updatedByUserId, updatedAt: new Date() } });
  return getGlm53ProviderSettings();
}

export type DeepseekV4ProProviderRuntime = ClaudeOpus5ProviderRuntime;
type DeepseekV4ProRuntimePayload = { providers: DeepseekV4ProProviderRuntime[] };
const MAX_DEEPSEEK_V4PRO_PROVIDERS = 12;

function normalizeDeepseekV4ProProviders(value: unknown, fallback: DeepseekV4ProProviderRuntime[]) {
  return normalizeClaudeOpus5Providers(value, fallback).slice(0, MAX_DEEPSEEK_V4PRO_PROVIDERS);
}

function deepseekV4ProRuntimeFromEnvironment(): DeepseekV4ProRuntimePayload {
  return {
    providers: normalizeDeepseekV4ProProviders([{
      id: "environment-default",
      label: "Environment default",
      enabled: true,
      baseUrl: process.env.TOKENHARBOR_BASE_URL?.trim() ?? "",
      model: getTokenForgeUpstreamModelId("deepseek-v4-pro") ?? "",
      apiKeys: [process.env.TOKENHARBOR_API_KEY?.trim() ?? ""],
    }], []),
  };
}

async function readDeepseekV4ProRuntimeOverride() {
  const db = await getDb();
  if (!db) return null;
  const record = (await db.select().from(platformSettings).where(eq(platformSettings.settingKey, DEEPSEEK_V4PRO_RUNTIME_SETTING_KEY)).limit(1))[0];
  if (!record) return null;
  try {
    const encoded = JSON.parse(record.value) as { ciphertext?: string; iv?: string; authTag?: string };
    const decrypted = decryptProviderRuntimeConfig({ ciphertext: String(encoded.ciphertext ?? ""), iv: String(encoded.iv ?? ""), authTag: String(encoded.authTag ?? "") });
    if (!decrypted || typeof decrypted !== "object") return null;
    const candidate = decrypted as Partial<DeepseekV4ProRuntimePayload> & { baseUrl?: unknown; model?: unknown; apiKeys?: unknown };
    const legacyProvider = {
      id: "primary",
      label: "Primary provider",
      enabled: candidate.providers?.[0]?.enabled !== false,
      baseUrl: typeof candidate.baseUrl === "string" ? candidate.baseUrl.trim() : "",
      model: typeof candidate.model === "string" ? candidate.model.trim() : "",
      apiKeys: Array.isArray(candidate.apiKeys) ? candidate.apiKeys : [],
    };
    return {
      payload: { providers: normalizeDeepseekV4ProProviders(candidate.providers, normalizeDeepseekV4ProProviders([legacyProvider], [])) },
      updatedAt: record.updatedAt,
      updatedByUserId: record.updatedByUserId,
    };
  } catch {
    return null;
  }
}

export async function getDeepseekV4ProRuntimeConfig(): Promise<DeepseekV4ProRuntimePayload> {
  const fallback = deepseekV4ProRuntimeFromEnvironment();
  const override = await readDeepseekV4ProRuntimeOverride();
  if (!override) return fallback;
  return { providers: override.payload.providers.length ? override.payload.providers : fallback.providers };
}

export async function getDeepseekV4ProProviderSettings() {
  const runtime = await getDeepseekV4ProRuntimeConfig();
  const override = await readDeepseekV4ProRuntimeOverride();
  const primary = runtime.providers[0];
  return {
    providers: runtime.providers.map(provider => ({
      id: provider.id,
      label: provider.label,
      enabled: provider.enabled,
      baseUrl: provider.baseUrl,
      model: provider.model,
      apiKeyMasks: provider.apiKeys.map((key, index) => ({ slot: index + 1, value: maskProviderApiKey(key), configured: Boolean(key) })),
    })),
    /** Compatibility fields retain a read-only view for callers on the legacy setting shape. */
    baseUrl: primary?.baseUrl ?? "",
    model: primary?.model ?? "",
    apiKeyMasks: primary?.apiKeys.map((key, index) => ({ slot: index + 1, value: maskProviderApiKey(key), configured: Boolean(key) })) ?? [],
    source: override ? "database" as const : "environment" as const,
    updatedAt: override?.updatedAt ?? null,
    updatedByUserId: override?.updatedByUserId ?? null,
  };
}

type DeepseekV4ProProviderUpdate = { id: string; label: string; enabled?: boolean; baseUrl: string; model: string; apiKeys: string[]; removeSlots?: number[] };
type DeepseekV4ProLegacyUpdate = { baseUrl?: string; model?: string; apiKeys?: string[]; removeSlots?: number[] };

export async function updateDeepseekV4ProProviderSettings(input: { providers: DeepseekV4ProProviderUpdate[] } | DeepseekV4ProLegacyUpdate, updatedByUserId: number) {
  const db = await getDb();
  if (!db) throw new Error("TokenForge database is unavailable");
  const current = await getDeepseekV4ProRuntimeConfig();
  const currentById = new Map(current.providers.map(provider => [provider.id, provider]));
  const legacyPrimary = current.providers[0] ?? { id: "primary", label: "Primary provider", enabled: true, baseUrl: "", model: "", apiKeys: [] };
  const submittedProviders: DeepseekV4ProProviderUpdate[] = "providers" in input
    ? input.providers
    : [{
      id: legacyPrimary.id,
      label: legacyPrimary.label,
      enabled: legacyPrimary.enabled,
      baseUrl: input.baseUrl?.trim() || legacyPrimary.baseUrl,
      model: input.model?.trim() || legacyPrimary.model,
      apiKeys: input.apiKeys ?? legacyPrimary.apiKeys.map(() => ""),
      removeSlots: input.removeSlots,
    }];
  const nextProviders = submittedProviders.map((submitted, index) => {
    const existing = currentById.get(submitted.id);
    const removedSlots = new Set(submitted.removeSlots ?? []);
    const retainedKeys = (existing?.apiKeys ?? []).filter((_, keyIndex) => !removedSlots.has(keyIndex + 1));
    const patchedExistingKeys = retainedKeys.map((key, keyIndex) => submitted.apiKeys[keyIndex]?.trim() || key);
    const appendedKeys = submitted.apiKeys.slice(retainedKeys.length).map(key => key.trim()).filter(Boolean);
    return {
      id: normalizeClaudeOpus5ProviderId(submitted.id, `provider-${index + 1}`),
      label: submitted.label.trim() || `Provider ${index + 1}`,
      enabled: submitted.enabled !== false,
      baseUrl: submitted.baseUrl.trim(),
      model: submitted.model.trim(),
      apiKeys: [...patchedExistingKeys, ...appendedKeys].filter(Boolean).slice(0, MAX_MANAGED_PROVIDER_API_KEYS),
    };
  });
  const ids = new Set(nextProviders.map(provider => provider.id));
  if (!nextProviders.length || nextProviders.length > MAX_DEEPSEEK_V4PRO_PROVIDERS || ids.size !== nextProviders.length || nextProviders.some(provider => !provider.baseUrl || !provider.model || !provider.apiKeys.length)) {
    throw new Error("Each DeepSeek V4 Pro provider needs a unique identifier, base URL, model ID, and at least one API key");
  }
  const encrypted = encryptProviderRuntimeConfig({ providers: nextProviders } satisfies DeepseekV4ProRuntimePayload);
  await db.insert(platformSettings).values({
    settingKey: DEEPSEEK_V4PRO_RUNTIME_SETTING_KEY,
    value: JSON.stringify(encrypted),
    updatedByUserId,
  }).onDuplicateKeyUpdate({ set: { value: JSON.stringify(encrypted), updatedByUserId, updatedAt: new Date() } });
  return getDeepseekV4ProProviderSettings();
}

export type Sonnet46ProviderRuntime = ClaudeOpus5ProviderRuntime;
type Sonnet46RuntimePayload = { providers: Sonnet46ProviderRuntime[] };
const MAX_SONNET46_PROVIDERS = 12;
type Sonnet46ProviderUpdate = { id: string; label: string; enabled?: boolean; baseUrl: string; model: string; apiKeys: string[]; removeSlots?: number[] };

function normalizeSonnet46Providers(value: unknown, fallback: Sonnet46ProviderRuntime[]) {
  return normalizeClaudeOpus5Providers(value, fallback).slice(0, MAX_SONNET46_PROVIDERS);
}

async function readSonnet46RuntimeOverride() {
  const db = await getDb();
  if (!db) return null;
  const record = (await db.select().from(platformSettings).where(eq(platformSettings.settingKey, SONNET46_RUNTIME_SETTING_KEY)).limit(1))[0];
  if (!record) return null;
  try {
    const encoded = JSON.parse(record.value) as { ciphertext?: string; iv?: string; authTag?: string };
    const decrypted = decryptProviderRuntimeConfig({ ciphertext: String(encoded.ciphertext ?? ""), iv: String(encoded.iv ?? ""), authTag: String(encoded.authTag ?? "") });
    if (!decrypted || typeof decrypted !== "object") return null;
    const candidate = decrypted as Partial<Sonnet46RuntimePayload>;
    return { payload: { providers: normalizeSonnet46Providers(candidate.providers, []) }, updatedAt: record.updatedAt, updatedByUserId: record.updatedByUserId };
  } catch {
    return null;
  }
}

export async function getSonnet46RuntimeConfig(): Promise<Sonnet46RuntimePayload> {
  const override = await readSonnet46RuntimeOverride();
  return { providers: override?.payload.providers ?? [] };
}

export async function getSonnet46ProviderSettings() {
  const runtime = await getSonnet46RuntimeConfig();
  const override = await readSonnet46RuntimeOverride();
  const primary = runtime.providers[0];
  return {
    providers: runtime.providers.map(provider => ({
      id: provider.id,
      label: provider.label,
      enabled: provider.enabled,
      baseUrl: provider.baseUrl,
      model: provider.model,
      apiKeyMasks: provider.apiKeys.map((key, index) => ({ slot: index + 1, value: maskProviderApiKey(key), configured: Boolean(key) })),
    })),
    baseUrl: primary?.baseUrl ?? "",
    model: primary?.model ?? "",
    apiKeyMasks: primary?.apiKeys.map((key, index) => ({ slot: index + 1, value: maskProviderApiKey(key), configured: Boolean(key) })) ?? [],
    source: override ? "database" as const : "environment" as const,
    updatedAt: override?.updatedAt ?? null,
    updatedByUserId: override?.updatedByUserId ?? null,
  };
}

export async function updateSonnet46ProviderSettings(input: { providers: Sonnet46ProviderUpdate[] }, updatedByUserId: number) {
  const db = await getDb();
  if (!db) throw new Error("TokenForge database is unavailable");
  const current = await getSonnet46RuntimeConfig();
  const currentById = new Map(current.providers.map(provider => [provider.id, provider]));
  const nextProviders = input.providers.map((submitted, index) => {
    const existing = currentById.get(submitted.id);
    const removedSlots = new Set(submitted.removeSlots ?? []);
    const retainedKeys = (existing?.apiKeys ?? []).filter((_, keyIndex) => !removedSlots.has(keyIndex + 1));
    const patchedExistingKeys = retainedKeys.map((key, keyIndex) => submitted.apiKeys[keyIndex]?.trim() || key);
    const appendedKeys = submitted.apiKeys.slice(retainedKeys.length).map(key => key.trim()).filter(Boolean);
    return {
      id: normalizeClaudeOpus5ProviderId(submitted.id, `provider-${index + 1}`),
      label: submitted.label.trim() || `Provider ${index + 1}`,
      enabled: submitted.enabled !== false,
      baseUrl: submitted.baseUrl.trim(),
      model: submitted.model.trim(),
      apiKeys: [...patchedExistingKeys, ...appendedKeys].filter(Boolean).slice(0, MAX_MANAGED_PROVIDER_API_KEYS),
    };
  });
  const ids = new Set(nextProviders.map(provider => provider.id));
  if (!nextProviders.length || nextProviders.length > MAX_SONNET46_PROVIDERS || ids.size !== nextProviders.length || nextProviders.some(provider => !provider.baseUrl || !provider.model || !provider.apiKeys.length)) {
    throw new Error("Each Claude Sonnet 4.6 provider needs a unique identifier, base URL, model ID, and at least one API key");
  }
  const encrypted = encryptProviderRuntimeConfig({ providers: nextProviders } satisfies Sonnet46RuntimePayload);
  await db.insert(platformSettings).values({
    settingKey: SONNET46_RUNTIME_SETTING_KEY,
    value: JSON.stringify(encrypted),
    updatedByUserId,
  }).onDuplicateKeyUpdate({ set: { value: JSON.stringify(encrypted), updatedByUserId, updatedAt: new Date() } });
  return getSonnet46ProviderSettings();
}

export const MANAGED_PROVIDER_METRIC_MODEL_IDS = ["claude-fable-5", "claude-opus-5", "glm-5.3", "claude-sonnet-4.6", "deepseek-v4-pro", "qwen3.8-max"] as const;
export type ManagedProviderMetricModel = typeof MANAGED_PROVIDER_METRIC_MODEL_IDS[number];

export function managedProviderCredentialFingerprint(modelId: ManagedProviderMetricModel, credential: string, providerGroupId?: string) {
  const secret = process.env.JWT_SECRET?.trim();
  if (!secret) throw new Error("TokenForge provider metric vault is unavailable");
  const groupScope = (modelId === "claude-opus-5" || modelId === "claude-sonnet-4.6" || modelId === "deepseek-v4-pro" || modelId === "claude-fable-5" || modelId === "qwen3.8-max") && providerGroupId && providerGroupId !== "primary" ? `\u0000provider:${providerGroupId}` : "";
  return createHmac("sha256", secret).update(`TokenForge:ProviderKeyMetrics:v1\u0000${modelId}${groupScope}\u0000${credential}`).digest("hex");
}

/** Records a per-key aggregate without storing key material, masks, or upstream identifiers in the database. */
export async function recordManagedProviderKeyOutcome(modelId: ManagedProviderMetricModel, credential: string, healthy: boolean, occurredAt = new Date(), countRequest = true, providerGroupId?: string) {
  const db = await getDb();
  if (!db || !credential.trim()) return;
  const credentialFingerprint = managedProviderCredentialFingerprint(modelId, credential, providerGroupId);
  const increments = {
    requestCount: countRequest ? sql`${providerKeyMetrics.requestCount} + 1` : sql`${providerKeyMetrics.requestCount}`,
    successCount: healthy ? sql`${providerKeyMetrics.successCount} + 1` : sql`${providerKeyMetrics.successCount}`,
    failureCount: healthy ? sql`${providerKeyMetrics.failureCount}` : sql`${providerKeyMetrics.failureCount} + 1`,
    lastRequestAt: occurredAt,
    lastSuccessAt: healthy ? occurredAt : sql`${providerKeyMetrics.lastSuccessAt}`,
    lastFailureAt: healthy ? sql`${providerKeyMetrics.lastFailureAt}` : occurredAt,
  };
  await db.insert(providerKeyMetrics).values({
    providerModelId: modelId,
    credentialFingerprint,
    requestCount: countRequest ? 1 : 0,
    successCount: healthy ? 1 : 0,
    failureCount: healthy ? 0 : 1,
    lastRequestAt: occurredAt,
    lastSuccessAt: healthy ? occurredAt : null,
    lastFailureAt: healthy ? null : occurredAt,
  }).onDuplicateKeyUpdate({ set: increments });
}

async function getManagedProviderMetricRuntime(modelId: ManagedProviderMetricModel): Promise<{ apiKeys: string[] }> {
  if (modelId === "claude-fable-5") {
    const runtime = await getClaudeFable5NvidiaRuntimeConfig();
    return { apiKeys: runtime.providers.flatMap(provider => provider.apiKeys) };
  }
  if (modelId === "claude-opus-5") {
    const runtime = await getClaudeOpus5RuntimeConfig();
    return { apiKeys: runtime.providers.flatMap(provider => provider.apiKeys) };
  }
  if (modelId === "qwen3.8-max") {
    const runtime = await getQwen38MaxRuntimeConfig();
    return { apiKeys: runtime.providers.flatMap(provider => provider.apiKeys) };
  }
  if (modelId === "claude-sonnet-4.6") {
    const runtime = await getSonnet46RuntimeConfig();
    return { apiKeys: runtime.providers.flatMap(provider => provider.apiKeys) };
  }
  if (modelId === "glm-5.3") return getGlm53RuntimeConfig();
  const runtime = await getDeepseekV4ProRuntimeConfig();
  return { apiKeys: runtime.providers.flatMap(provider => provider.apiKeys) };
}

/** Administrator-only view model: keeps fingerprints and raw credentials server-side, returning only current masks and aggregated counts. */
export async function getManagedProviderKeyMetrics() {
  const db = await getDb();
  const runtimes = await Promise.all(MANAGED_PROVIDER_METRIC_MODEL_IDS.filter(modelId => modelId !== "claude-opus-5" && modelId !== "claude-sonnet-4.6" && modelId !== "deepseek-v4-pro" && modelId !== "qwen3.8-max").map(async modelId => ({ modelId, runtime: await getManagedProviderMetricRuntime(modelId) })));
  const opusRuntime = await getClaudeOpus5RuntimeConfig();
  const sonnetRuntime = await getSonnet46RuntimeConfig();
  const deepseekRuntime = await getDeepseekV4ProRuntimeConfig();
  const qwenRuntime = await getQwen38MaxRuntimeConfig();
  const rows = db
    ? await db.select().from(providerKeyMetrics).where(inArray(providerKeyMetrics.providerModelId, [...MANAGED_PROVIDER_METRIC_MODEL_IDS]))
    : [];
  const metricsByKey = new Map(rows.map(row => [`${row.providerModelId}:${row.credentialFingerprint}`, row]));
  const liveTelemetry = getProviderCredentialTelemetry(Object.fromEntries(runtimes.map(({ modelId, runtime }) => [modelId, runtime.apiKeys.length])));

  const standardMetrics = runtimes.map(({ modelId, runtime }) => {
    const liveProvider = liveTelemetry.find(item => item.providerSlug === modelId);
    return {
      modelId,
      slots: runtime.apiKeys.map((credential, index) => {
        const metric = metricsByKey.get(`${modelId}:${managedProviderCredentialFingerprint(modelId, credential)}`);
        const liveSlot = liveProvider?.slots[index];
        const requestCount = Number(metric?.requestCount ?? 0);
        return {
          slot: index + 1,
          keyMask: maskProviderApiKey(credential),
          requestCount,
          successCount: Number(metric?.successCount ?? 0),
          failureCount: Number(metric?.failureCount ?? 0),
          health: liveSlot?.health ?? "unknown",
          cooldownUntil: liveSlot?.cooldownUntil ?? null,
          lastRequestAt: metric?.lastRequestAt ?? null,
          lastSuccessAt: metric?.lastSuccessAt ?? null,
          lastFailureAt: metric?.lastFailureAt ?? null,
        };
      }),
    };
  });
  const opusProviders = opusRuntime.providers.map(provider => ({
    id: provider.id,
    label: provider.label,
    slots: provider.apiKeys.map((credential, index) => {
      const metric = metricsByKey.get(`claude-opus-5:${managedProviderCredentialFingerprint("claude-opus-5", credential, provider.id)}`);
      const liveSlot = getCredentialSlotTelemetry(`claude-opus-5:${provider.id}`, index);
      return {
        slot: index + 1,
        keyMask: maskProviderApiKey(credential),
        requestCount: Number(metric?.requestCount ?? 0),
        successCount: Number(metric?.successCount ?? 0),
        failureCount: Number(metric?.failureCount ?? 0),
        health: liveSlot.health,
        cooldownUntil: liveSlot.cooldownUntil,
        lastRequestAt: metric?.lastRequestAt ?? null,
        lastSuccessAt: metric?.lastSuccessAt ?? null,
        lastFailureAt: metric?.lastFailureAt ?? null,
        requestCap: null,
        retired: false,
      };
    }),
  }));
  const deepseekProviders = deepseekRuntime.providers.map(provider => ({
    id: provider.id,
    label: provider.label,
    slots: provider.apiKeys.map((credential, index) => {
      const metric = metricsByKey.get(`deepseek-v4-pro:${managedProviderCredentialFingerprint("deepseek-v4-pro", credential, provider.id)}`);
      const liveSlot = getCredentialSlotTelemetry(`deepseek-v4-pro:${provider.id}`, index);
      return {
        slot: index + 1,
        keyMask: maskProviderApiKey(credential),
        requestCount: Number(metric?.requestCount ?? 0),
        successCount: Number(metric?.successCount ?? 0),
        failureCount: Number(metric?.failureCount ?? 0),
        health: liveSlot.health,
        cooldownUntil: liveSlot.cooldownUntil,
        lastRequestAt: metric?.lastRequestAt ?? null,
        lastSuccessAt: metric?.lastSuccessAt ?? null,
        lastFailureAt: metric?.lastFailureAt ?? null,
        requestCap: null,
        retired: false,
      };
    }),
  }));
  const sonnetProviders = sonnetRuntime.providers.map(provider => ({
    id: provider.id,
    label: provider.label,
    slots: provider.apiKeys.map((credential, index) => {
      const metric = metricsByKey.get(`claude-sonnet-4.6:${managedProviderCredentialFingerprint("claude-sonnet-4.6", credential, provider.id)}`);
      const liveSlot = getCredentialSlotTelemetry(`claude-sonnet-4.6:${provider.id}` as CredentialTelemetryProvider, index);
      return {
        slot: index + 1,
        keyMask: maskProviderApiKey(credential),
        requestCount: Number(metric?.requestCount ?? 0),
        successCount: Number(metric?.successCount ?? 0),
        failureCount: Number(metric?.failureCount ?? 0),
        health: liveSlot.health,
        cooldownUntil: liveSlot.cooldownUntil,
        lastRequestAt: metric?.lastRequestAt ?? null,
        lastSuccessAt: metric?.lastSuccessAt ?? null,
        lastFailureAt: metric?.lastFailureAt ?? null,
        requestCap: null,
        retired: false,
      };
    }),
  }));
  const qwenProviders = qwenRuntime.providers.map(provider => ({
    id: provider.id,
    label: provider.label,
    slots: provider.apiKeys.map((credential, index) => {
      const metric = metricsByKey.get(`qwen3.8-max:${managedProviderCredentialFingerprint("qwen3.8-max", credential, provider.id)}`);
      const liveSlot = getCredentialSlotTelemetry(`qwen3.8-max:${provider.id}`, index);
      return {
        slot: index + 1,
        keyMask: maskProviderApiKey(credential),
        requestCount: Number(metric?.requestCount ?? 0),
        successCount: Number(metric?.successCount ?? 0),
        failureCount: Number(metric?.failureCount ?? 0),
        health: liveSlot.health,
        cooldownUntil: liveSlot.cooldownUntil,
        lastRequestAt: metric?.lastRequestAt ?? null,
        lastSuccessAt: metric?.lastSuccessAt ?? null,
        lastFailureAt: metric?.lastFailureAt ?? null,
        requestCap: null,
        retired: false,
      };
    }),
  }));
  return [...standardMetrics, { modelId: "claude-opus-5", slots: [], providers: opusProviders }, { modelId: "claude-sonnet-4.6", slots: [], providers: sonnetProviders }, { modelId: "deepseek-v4-pro", slots: [], providers: deepseekProviders }, { modelId: "qwen3.8-max", slots: [], providers: qwenProviders }];
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

/**
 * Records the successful guild-membership check without retaining a Discord
 * user ID, OAuth access token, refresh token, or profile data.
 */
export async function markDiscordVerified(userId: number) {
  const db = await getDb();
  const controls = await ensureAccountControl(userId);
  if (!db || !controls) throw new Error("TokenForge account controls are unavailable");

  const verifiedAt = new Date();
  await db.update(accountControls)
    .set({ discordVerifiedAt: verifiedAt })
    .where(eq(accountControls.userId, userId));
  await writeAuditEvent({
    actorUserId: userId,
    targetUserId: userId,
    action: "discord.membership_verified",
    entityType: "account",
    entityId: String(userId),
  });
  await settleSpecialReferralBonusAfterDiscordVerification(userId);
  return verifiedAt;
}

export async function isDiscordVerified(userId: number) {
  const db = await getDb();
  if (!db) return false;
  const record = (await db.select({ discordVerifiedAt: accountControls.discordVerifiedAt })
    .from(accountControls)
    .where(eq(accountControls.userId, userId))
    .limit(1))[0];
  return Boolean(record?.discordVerifiedAt);
}

/** Clears the privacy-minimizing verification timestamp so the member must re-complete the existing OAuth membership check. */
export async function resetDiscordVerification(userId: number) {
  const db = await getDb();
  if (!db) return null;

  const account = (await db.select({ id: users.id }).from(users).where(eq(users.id, userId)).limit(1))[0];
  if (!account) return null;

  const controls = await ensureAccountControl(userId);
  if (!controls) throw new Error("TokenForge account controls are unavailable");
  const wasVerified = Boolean(controls.discordVerifiedAt);
  await db.update(accountControls)
    .set({ discordVerifiedAt: null })
    .where(eq(accountControls.userId, userId));
  return { reset: wasVerified };
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

export async function findActiveApiKey(plainTextKey: string, database?: ApiKeyLookupDatabase | null) {
  const db = database ?? await getDb();
  if (!db) return null;
  const hash = hashApiKey(plainTextKey);
  const rows = await db
    .select({ apiKey: apiKeys })
    .from(apiKeys)
    .innerJoin(users, eq(apiKeys.userId, users.id))
    .where(and(eq(apiKeys.keyHash, hash), eq(apiKeys.status, "active")))
    .limit(1);
  return rows[0]?.apiKey ?? null;
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
    const claudeOpus5BaseUrl = process.env.CLAUDE_OPUS5_BASE_URL ?? "https://ai.kscsnkli.site";
    const tokenRouterBaseUrl = process.env.TOKENROUTER_BASE_URL ?? "https://api.tokenrouter.com";
    await db.insert(providerConfigs).values([
      { slug: FXQIDIAN_PROVIDER_SLUG, displayName: "Selected hosted inference", baseUrl },
      { slug: CLUSTER_PROTOCOL_PROVIDER_SLUG, displayName: "Cluster Protocol", baseUrl: clusterBaseUrl },
      { slug: TOKENHARBOR_PROVIDER_SLUG, displayName: "TokenHarbor", baseUrl: tokenHarborBaseUrl },
      { slug: CLAUDE_OPUS5_PROVIDER_SLUG, displayName: "Claude Opus 5 custom upstream", baseUrl: claudeOpus5BaseUrl },
      { slug: TOKENROUTER_PROVIDER_SLUG, displayName: "TokenRouter", baseUrl: tokenRouterBaseUrl },
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
  discordVerifiedAt: Date | null;
  specialReferralSlot?: number | null;
  specialReferralAwardedAt?: Date | null;
  referralCount?: number | null;
};

export type AdminAccountUsage = {
  userId: number;
  requestCount: number | null;
  totalTokens: number | null;
  lifetimeSpendNanos?: number | null;
  lastActivityAt: Date | string | null;
};

export type AdminAccountDirectoryInput = {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: "all" | "active" | "suspended" | "flagged";
  sort?: "latestJoin" | "mostTokens" | "discordVerified" | "mostCredit" | "mostReferrals" | "specialReferral";
};

export function normalizeAdminAccountDirectoryInput(input: AdminAccountDirectoryInput = {}) {
  const sort = input.sort === "mostTokens" || input.sort === "discordVerified" || input.sort === "mostCredit" || input.sort === "mostReferrals" || input.sort === "specialReferral" || input.sort === "latestJoin"
    ? input.sort
    : "latestJoin";
  return {
    page: Math.max(1, Math.trunc(input.page ?? 1)),
    pageSize: Math.min(50, Math.max(5, Math.trunc(input.pageSize ?? 10))),
    search: input.search?.trim().slice(0, 120) ?? "",
    status: input.status ?? "all",
    sort,
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
      lifetimeSpendNanos: Number(usage?.lifetimeSpendNanos ?? 0),
      referralCount: Number(account.referralCount ?? 0),
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
  // Sort before pagination using each account's full, successful processed-token history.
  // A correlated aggregate avoids the unreliable derived-table ordering previously used here.
  const successfulLifetimeTokens = sql<number>`coalesce((
    select sum(${usageEvents.totalTokens})
    from ${usageEvents}
    where ${usageEvents.userId} = ${users.id}
      and ${usageEvents.status} = ${"success"}
  ), 0)`;
  const referralCount = sql<number>`coalesce((
    select count(${referralAttributions.id})
    from ${referralAttributions}
    where ${referralAttributions.referrerUserId} = ${users.id}
  ), 0)`;
  const sortOrder = query.sort === "mostTokens"
    ? [desc(successfulLifetimeTokens), desc(users.createdAt), desc(users.id)]
    : query.sort === "discordVerified"
      ? [desc(accountControls.discordVerifiedAt), desc(users.createdAt), desc(users.id)]
      : query.sort === "mostCredit"
        ? [desc(creditAccounts.balanceNanos), desc(users.createdAt), desc(users.id)]
        : query.sort === "mostReferrals"
          ? [desc(referralCount), desc(users.createdAt), desc(users.id)]
        : query.sort === "specialReferral"
          ? [desc(specialReferralClaims.awardedAt), desc(specialReferralClaims.reservedAt), desc(users.createdAt), desc(users.id)]
        : [desc(users.createdAt), desc(users.id)];
  const accounts = await db
    .select({ id: users.id, name: users.name, email: users.email, createdAt: users.createdAt, lastSignedIn: users.lastSignedIn, suspended: accountControls.isSuspended, suspicious: accountControls.isSuspicious, requestLimit: accountControls.dailyRequestLimit, tokenLimit: accountControls.dailyTokenLimit, balanceNanos: creditAccounts.balanceNanos, discordVerifiedAt: accountControls.discordVerifiedAt, specialReferralSlot: specialReferralClaims.slotNumber, specialReferralAwardedAt: specialReferralClaims.awardedAt, referralCount })
    .from(users)
    .leftJoin(accountControls, eq(users.id, accountControls.userId))
    .leftJoin(creditAccounts, eq(users.id, creditAccounts.userId))
    .leftJoin(specialReferralClaims, and(eq(users.id, specialReferralClaims.userId), eq(specialReferralClaims.campaignKey, SPECIAL_REFERRAL_CAMPAIGN_KEY)))
    .where(whereClause)
    .orderBy(...sortOrder)
    .limit(query.pageSize)
    .offset((page - 1) * query.pageSize);
  const userIds = accounts.map(account => account.id);
  const usageRows = userIds.length
    ? await db.select({ userId: usageEvents.userId, requestCount: sql<number>`coalesce(count(${usageEvents.id}), 0)`, totalTokens: sql<number>`coalesce(sum(${usageEvents.totalTokens}), 0)`, lifetimeSpendNanos: sql<number>`coalesce(sum(${usageEvents.chargeNanos}), 0)`, lastActivityAt: sql<Date | null>`max(${usageEvents.createdAt})` }).from(usageEvents).where(and(inArray(usageEvents.userId, userIds), eq(usageEvents.status, "success"))).groupBy(usageEvents.userId)
    : [];

  return { items: composeAdminAccountOverview(accounts, usageRows), total: Number(total), page, pageSize: query.pageSize, pageCount };
}

export type AdminAccountModelUsageRow = {
  userId: number;
  modelId: string;
  requestCount: number;
  totalTokens: number;
};

export type AdminGlobalModelUsageRow = {
  modelId: string;
  accountCount: number;
  requestCount: number;
  totalTokens: number;
};

/** Normalizes aggregate-only activity rows without returning prompts, API keys, or message content. */
export function normalizeAdminAccountModelUsage(rows: AdminAccountModelUsageRow[]) {
  return rows
    .filter(row => Number.isInteger(row.userId) && row.userId > 0 && Boolean(row.modelId) && Number(row.requestCount) > 0)
    .map(row => ({ userId: row.userId, modelId: row.modelId, requestCount: Math.max(0, Number(row.requestCount) || 0), totalTokens: Math.max(0, Number(row.totalTokens) || 0) }))
    .sort((left, right) => left.userId - right.userId || right.requestCount - left.requestCount || right.totalTokens - left.totalTokens || left.modelId.localeCompare(right.modelId));
}

/** Normalizes aggregate-only all-account model activity without returning account, prompt, or credential data. */
export function normalizeAdminGlobalModelUsage(rows: AdminGlobalModelUsageRow[]) {
  return rows
    .filter(row => Boolean(row.modelId) && Number(row.accountCount) > 0 && Number(row.requestCount) > 0)
    .map(row => ({
      modelId: row.modelId,
      accountCount: Math.max(0, Number(row.accountCount) || 0),
      requestCount: Math.max(0, Number(row.requestCount) || 0),
      totalTokens: Math.max(0, Number(row.totalTokens) || 0),
    }))
    .sort((left, right) => right.requestCount - left.requestCount || right.totalTokens - left.totalTokens || left.modelId.localeCompare(right.modelId));
}

/** Returns successful, aggregate model activity only for the bounded visible administrator account page. */
export async function getAdminAccountModelUsage(userIds: number[]) {
  const normalizedUserIds = Array.from(new Set(userIds.filter(userId => Number.isInteger(userId) && userId > 0))).slice(0, 10);
  if (!normalizedUserIds.length) return [];
  const db = await getDb();
  if (!db) return [];
  const rows = await db
    .select({
      userId: usageEvents.userId,
      modelId: usageEvents.modelId,
      requestCount: sql<number>`coalesce(count(${usageEvents.id}), 0)`,
      totalTokens: sql<number>`coalesce(sum(${usageEvents.totalTokens}), 0)`,
    })
    .from(usageEvents)
    .where(and(inArray(usageEvents.userId, normalizedUserIds), eq(usageEvents.status, "success")))
    .groupBy(usageEvents.userId, usageEvents.modelId);
  return normalizeAdminAccountModelUsage(rows);
}

export type GitHubIdentityInput = { providerUserId: string; email: string; name: string | null; referralCode?: string };

/** Resolves GitHub by immutable provider subject, securely linking a legacy local account only after GitHub returns the same verified email. */
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
  const existingEmail = (await db.select().from(users).where(eq(users.email, email)).limit(1))[0];
  if (existingEmail) {
    try {
      const linkedUser = await db.transaction(async tx => {
        const existingGitHubIdentity = (await tx.select().from(oauthIdentities).where(and(eq(oauthIdentities.userId, existingEmail.id), eq(oauthIdentities.provider, provider))).limit(1))[0];
        if (existingGitHubIdentity && existingGitHubIdentity.providerUserId !== input.providerUserId) return null;
        if (!existingGitHubIdentity) await tx.insert(oauthIdentities).values({ userId: existingEmail.id, provider, providerUserId: input.providerUserId });
        const lastSignedIn = new Date();
        await tx.update(users).set({ loginMethod: "github", lastSignedIn }).where(eq(users.id, existingEmail.id));
        return { ...existingEmail, loginMethod: "github", lastSignedIn };
      });
      if (linkedUser) return { kind: "resolved" as const, user: linkedUser };
      return { kind: "link_required" as const };
    } catch (error: any) {
      if (error?.code !== "ER_DUP_ENTRY") throw error;
      const concurrentIdentity = (await db.select({ user: users }).from(oauthIdentities).innerJoin(users, eq(oauthIdentities.userId, users.id)).where(and(eq(oauthIdentities.provider, provider), eq(oauthIdentities.providerUserId, input.providerUserId))).limit(1))[0]?.user;
      if (concurrentIdentity) return { kind: "resolved" as const, user: concurrentIdentity };
      return { kind: "link_required" as const };
    }
  }

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
    const preProvisionedActivation = await activatePreProvisionedAccount(userId, email);
    await Promise.all([
      ensureAccountControl(userId),
      preProvisionedActivation ? Promise.resolve() : ensureCreditAccount(userId),
      getOrCreateReferralCode(userId),
    ]);
    await awardReferralForNewUser(userId, input.referralCode);
    await reserveSpecialReferralCampaignSlot(userId, input.referralCode);
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
  if (!db) return { models: [], providers: [], accounts: [], usage: [], emailProviders: [], allAccountModelUsage: [], totals: { totalTokens: 0, totalRequests: 0 }, providerTelemetry: getProviderCredentialTelemetry({}), managedProviderKeyMetrics: [] };
  // This aggregate queries only `users`; keep this expression unqualified so the SELECT,
  // GROUP BY, and ORDER BY clauses remain byte-for-byte compatible on the deployed MySQL dialect.
  const emailProvider = sql<string>`${sql.raw(ADMIN_EMAIL_PROVIDER_EXPRESSION)}`;
  const [models, providers, accounts, usage, accountUsage, totals, emailProviderRows, allAccountModelUsageRows] = await Promise.all([
    db.select().from(modelConfigs).orderBy(modelConfigs.displayName),
    db.select().from(providerConfigs).orderBy(providerConfigs.displayName),
    db.select({ id: users.id, name: users.name, email: users.email, createdAt: users.createdAt, lastSignedIn: users.lastSignedIn, suspended: accountControls.isSuspended, suspicious: accountControls.isSuspicious, requestLimit: accountControls.dailyRequestLimit, tokenLimit: accountControls.dailyTokenLimit, balanceNanos: creditAccounts.balanceNanos, discordVerifiedAt: accountControls.discordVerifiedAt }).from(users).leftJoin(accountControls, eq(users.id, accountControls.userId)).leftJoin(creditAccounts, eq(users.id, creditAccounts.userId)).orderBy(desc(users.lastSignedIn)).limit(100),
    db.select({ day: dailyUsage.usageDate, requests: sql<number>`coalesce(sum(${dailyUsage.requestCount}), 0)`, tokens: sql<number>`coalesce(sum(${dailyUsage.totalTokens}), 0)` }).from(dailyUsage).where(gte(dailyUsage.usageDate, utcUsageDate(new Date(Date.now() - 13 * 86_400_000)))).groupBy(dailyUsage.usageDate).orderBy(dailyUsage.usageDate),
    db.select({ userId: usageEvents.userId, requestCount: sql<number>`coalesce(count(${usageEvents.id}), 0)`, totalTokens: sql<number>`coalesce(sum(${usageEvents.totalTokens}), 0)`, lastActivityAt: sql<Date | null>`max(${usageEvents.createdAt})` }).from(usageEvents).groupBy(usageEvents.userId),
    db.select({ totalTokens: sql<number>`coalesce(sum(${usageEvents.totalTokens}), 0)`, totalRequests: sql<number>`coalesce(count(${usageEvents.id}), 0)` }).from(usageEvents),
    db.select({ provider: emailProvider, accountCount: sql<number>`count(id)` }).from(users).where(sql`${users.email} is not null and ${users.email} like '%@%'`).groupBy(emailProvider).orderBy(desc(sql`count(id)`), emailProvider),
    db.select({ modelId: usageEvents.modelId, accountCount: sql<number>`count(distinct ${usageEvents.userId})`, requestCount: sql<number>`coalesce(count(${usageEvents.id}), 0)`, totalTokens: sql<number>`coalesce(sum(${usageEvents.totalTokens}), 0)` }).from(usageEvents).where(eq(usageEvents.status, "success")).groupBy(usageEvents.modelId).orderBy(desc(sql`count(${usageEvents.id})`), desc(sql`sum(${usageEvents.totalTokens})`), usageEvents.modelId),
  ]);
  const providerTelemetry = getProviderCredentialTelemetry({
    [FXQIDIAN_PROVIDER_SLUG]: getFxqidianCredentialPool().length,
    [CLUSTER_PROTOCOL_PROVIDER_SLUG]: getClusterProtocolCredentialPool().length,
    [TOKENHARBOR_PROVIDER_SLUG]: process.env.TOKENHARBOR_API_KEY?.trim() ? 1 : 0,
    [CLAUDE_OPUS5_PROVIDER_SLUG]: process.env.CLAUDE_OPUS5_API_KEY?.trim() ? 1 : 0,
    [TOKENROUTER_PROVIDER_SLUG]: getTokenRouterCredentialPool().length,
  });
  const managedProviderKeyMetrics = await getManagedProviderKeyMetrics();
  return { models, providers, accounts: composeAdminAccountOverview(accounts, accountUsage), usage: usage.map(row => ({ day: new Date(row.day).toISOString().slice(0, 10), requests: Number(row.requests), tokens: Number(row.tokens) })), emailProviders: normalizeAdminEmailProviderCounts(emailProviderRows), allAccountModelUsage: normalizeAdminGlobalModelUsage(allAccountModelUsageRows), totals: { totalTokens: Number(totals[0]?.totalTokens ?? 0), totalRequests: Number(totals[0]?.totalRequests ?? 0) }, providerTelemetry, managedProviderKeyMetrics };
}

/** Deletes a user and every account-owned TokenForge record, retaining only non-reversible hashed identity tombstones. */
export async function deleteAccountPermanently(userId: number, database?: AccountDeletionDatabase | null) {
  const db = database ?? await getDb();
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
    await tx.delete(preProvisionedAccounts).where(eq(preProvisionedAccounts.activatedUserId, userId));
    await tx.delete(apiKeys).where(eq(apiKeys.userId, userId));
    const deleted = await tx.delete(users).where(eq(users.id, userId));
    return deleted[0].affectedRows > 0;
  });
}

/** Counts regular user accounts that have not completed the Discord membership check. */
export async function countDiscordUnverifiedAccounts() {
  const db = await getDb();
  if (!db) return 0;
  const row = (await db.select({ count: sql<number>`count(${users.id})` })
    .from(users)
    .leftJoin(accountControls, eq(users.id, accountControls.userId))
    .where(and(ne(users.openId, ADMIN_SESSION_PRINCIPAL_OPEN_ID), isNull(accountControls.discordVerifiedAt))))[0];
  return Math.max(0, Number(row?.count ?? 0));
}

/**
 * Permanently removes all currently Discord-unverified regular accounts without retaining a recreation block.
 * Only a one-time HMAC notice marker remains for local-sign-in feedback; it is removed on display or fresh signup.
 */
export async function deleteDiscordUnverifiedAccounts() {
  const db = await getDb();
  if (!db) throw new Error("TokenForge database is unavailable");
  return db.transaction(async tx => {
    const accounts = await tx.select({ id: users.id, email: users.email }).from(users)
      .leftJoin(accountControls, eq(users.id, accountControls.userId))
      .where(and(ne(users.openId, ADMIN_SESSION_PRINCIPAL_OPEN_ID), isNull(accountControls.discordVerifiedAt)));
    if (!accounts.length) return { deletedCount: 0 };
    const userIds = accounts.map(account => account.id);
    const notices = accounts
      .filter((account): account is { id: number; email: string } => typeof account.email === "string" && Boolean(account.email.trim()))
      .map(account => ({ kind: DISCORD_UNVERIFIED_CLEANUP_NOTICE_KIND, identifierHash: hashDeletedIdentity(DISCORD_UNVERIFIED_CLEANUP_NOTICE_KIND, normalizeEmail(account.email)) }));
    if (notices.length) await tx.insert(deletedIdentityTombstones).values(notices).onDuplicateKeyUpdate({ set: { deletedAt: new Date() } });
    await tx.delete(auditEvents).where(or(inArray(auditEvents.actorUserId, userIds), inArray(auditEvents.targetUserId, userIds)));
    const deleted = await tx.delete(users).where(inArray(users.id, userIds));
    return { deletedCount: Number(deleted[0].affectedRows ?? 0) };
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

/** Converts a bounded USD credit grant into exact nanodollars without trusting client-side arithmetic. */
export function normalizeAdminCreditGrantAmount(amountUsd: number) {
  if (!Number.isFinite(amountUsd) || amountUsd <= 0 || amountUsd > 100_000) return null;
  const amountNanos = Math.round(amountUsd * NANODOLLARS_PER_DOLLAR);
  return amountNanos > 0 ? amountNanos : null;
}

/** Counts regular accounts that have completed TokenForge's Discord membership verification. */
export async function countDiscordVerifiedAccounts() {
  const db = await getDb();
  if (!db) return 0;
  const row = (await db.select({ count: sql<number>`count(${users.id})` })
    .from(users)
    .innerJoin(accountControls, eq(users.id, accountControls.userId))
    .where(and(ne(users.openId, ADMIN_SESSION_PRINCIPAL_OPEN_ID), isNotNull(accountControls.discordVerifiedAt))))[0];
  return Math.max(0, Number(row?.count ?? 0));
}

/**
 * Atomically applies one administrator giveaway to every currently Discord-verified regular account.
 * Each recipient receives an immutable wallet-ledger entry; the caller records one aggregate audit event.
 */
export async function grantDiscordVerifiedAccountGiveaway(input: { actorUserId: number; amountNanos: number; expectedRecipientCount: number; announcementNote?: string }) {
  const db = await getDb();
  if (!db) throw new Error("TokenForge database is unavailable");
  const amountNanos = Math.max(0, Math.trunc(input.amountNanos));
  if (!amountNanos) throw new Error("Giveaway amount must be positive");
  const expectedRecipientCount = Math.max(0, Math.trunc(input.expectedRecipientCount));
  const announcementNote = input.announcementNote?.trim() || null;
  return db.transaction(async tx => {
    const recipients = await tx.select({ userId: users.id })
      .from(users)
      .innerJoin(accountControls, eq(users.id, accountControls.userId))
      .where(and(ne(users.openId, ADMIN_SESSION_PRINCIPAL_OPEN_ID), isNotNull(accountControls.discordVerifiedAt)));
    if (recipients.length !== expectedRecipientCount) {
      return { applied: false as const, recipientCount: recipients.length, amountNanos, totalAmountNanos: 0 };
    }
    if (!recipients.length) return { applied: true as const, recipientCount: 0, amountNanos, totalAmountNanos: 0 };

    const userIds = recipients.map(recipient => recipient.userId);
    await tx.insert(creditAccounts)
      .values(userIds.map(userId => ({ userId, balanceNanos: 0 })))
      // Keep an existing wallet unchanged.  The typed column reference is
      // essential here: raw `user_id` does not exist in TokenForge's camelCase
      // production schema and caused large giveaways to fail before the
      // transaction could credit or ledger any recipient.
      .onDuplicateKeyUpdate({ set: { balanceNanos: sql`${creditAccounts.balanceNanos}` } });
    await tx.update(creditAccounts)
      .set({ balanceNanos: sql`${creditAccounts.balanceNanos} + ${amountNanos}` })
      .where(inArray(creditAccounts.userId, userIds));
    const balances = await tx.select({ userId: creditAccounts.userId, balanceNanos: creditAccounts.balanceNanos })
      .from(creditAccounts)
      .where(inArray(creditAccounts.userId, userIds));
    const giveawayId = randomBytes(12).toString("hex");
    await tx.insert(creditLedger).values(balances.map(account => ({
      userId: account.userId,
      kind: "manual_adjustment" as const,
      amountNanos,
      balanceAfterNanos: account.balanceNanos,
      referenceId: `discord-giveaway:${giveawayId}:${account.userId}`,
      note: announcementNote ?? "Discord-verified account giveaway",
    })));
    await tx.insert(creditGiveaways).values({
      id: giveawayId,
      actorUserId: input.actorUserId,
      amountNanos,
      recipientCount: balances.length,
      totalAmountNanos: amountNanos * balances.length,
      announcementNote,
    });
    await tx.insert(creditGiveawayNotifications).values(balances.map(account => ({
      giveawayId,
      userId: account.userId,
    })));
    return {
      applied: true as const,
      id: giveawayId,
      recipientCount: balances.length,
      amountNanos,
      totalAmountNanos: amountNanos * balances.length,
    };
  });
}

/** Returns completed giveaway records for the administrator-only operational history. */
export async function listCreditGiveawayHistory(limit = 40) {
  const db = await getDb();
  if (!db) return [];
  const boundedLimit = Math.max(1, Math.min(100, Math.trunc(limit)));
  return db.select().from(creditGiveaways).orderBy(desc(creditGiveaways.createdAt)).limit(boundedLimit);
}

/** Returns personal, unread giveaway announcements. No other recipient's data is exposed. */
export async function listUnreadCreditGiveawayNotifications(userId: number, limit = 3) {
  const db = await getDb();
  if (!db) return [];
  const boundedLimit = Math.max(1, Math.min(5, Math.trunc(limit)));
  return db.select({
    id: creditGiveawayNotifications.id,
    giveawayId: creditGiveaways.id,
    amountNanos: creditGiveaways.amountNanos,
    announcementNote: creditGiveaways.announcementNote,
    createdAt: creditGiveawayNotifications.createdAt,
  })
    .from(creditGiveawayNotifications)
    .innerJoin(creditGiveaways, eq(creditGiveawayNotifications.giveawayId, creditGiveaways.id))
    .where(and(eq(creditGiveawayNotifications.userId, userId), isNull(creditGiveawayNotifications.dismissedAt)))
    .orderBy(desc(creditGiveawayNotifications.createdAt))
    .limit(boundedLimit);
}

/** Dismisses one recipient's own giveaway notice without changing the underlying wallet credit. */
export async function dismissCreditGiveawayNotification(input: { userId: number; notificationId: number }) {
  const db = await getDb();
  if (!db) throw new Error("TokenForge database is unavailable");
  const result = await db.update(creditGiveawayNotifications)
    .set({ dismissedAt: new Date() })
    .where(and(
      eq(creditGiveawayNotifications.id, input.notificationId),
      eq(creditGiveawayNotifications.userId, input.userId),
      isNull(creditGiveawayNotifications.dismissedAt),
    ));
  return Number(result[0].affectedRows ?? 0) > 0;
}

/** Adds a positive administrator credit grant and immutable wallet-ledger record for an existing account. */
export async function grantAdminAccountCredit(input: { userId: number; amountNanos: number; actorUserId: number }) {
  const db = await getDb();
  if (!db) throw new Error("TokenForge database is unavailable");
  const amountNanos = Math.max(0, Math.trunc(input.amountNanos));
  if (!amountNanos) throw new Error("Credit grant amount must be positive");
  const user = (await db.select({ id: users.id }).from(users).where(eq(users.id, input.userId)).limit(1))[0];
  if (!user) return null;
  await ensureCreditAccount(input.userId);
  return db.transaction(async tx => {
    const giveawayId = randomBytes(12).toString("hex");
    const announcementNote = "An administrator added credits to your TokenForge account.";
    await tx.update(creditAccounts).set({ balanceNanos: sql`${creditAccounts.balanceNanos} + ${amountNanos}` }).where(eq(creditAccounts.userId, input.userId));
    const account = (await tx.select({ balanceNanos: creditAccounts.balanceNanos }).from(creditAccounts).where(eq(creditAccounts.userId, input.userId)).limit(1))[0];
    const balanceNanos = account?.balanceNanos ?? amountNanos;
    await tx.insert(creditLedger).values({
      userId: input.userId,
      kind: "manual_adjustment",
      amountNanos,
      balanceAfterNanos: balanceNanos,
      referenceId: `admin-credit:${giveawayId}:${input.userId}`,
      note: announcementNote,
    });
    await tx.insert(creditGiveaways).values({
      id: giveawayId,
      actorUserId: input.actorUserId,
      amountNanos,
      recipientCount: 1,
      totalAmountNanos: amountNanos,
      announcementNote,
    });
    await tx.insert(creditGiveawayNotifications).values({ giveawayId, userId: input.userId });
    return { amountNanos, balanceNanos };
  });
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
