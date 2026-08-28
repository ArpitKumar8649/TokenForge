import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";
import type { User } from "../drizzle/schema";
import type { AuthenticatedUser } from "./_core/sdk";

vi.mock("./db", () => ({
  DiscordUnverifiedAccountDeletedError: class DiscordUnverifiedAccountDeletedError extends Error {
    constructor() {
      super("Your previous account was not verified by Discord, so it was deleted by an administrator. You can create a new TokenForge account with this email.");
      this.name = "DiscordUnverifiedAccountDeletedError";
    }
  },
  authenticatePasswordUser: vi.fn(),
  clearFailedPasswordLogin: vi.fn(),
  createApiKey: vi.fn(),
  createPasswordUser: vi.fn(),
  claimDailyCheckin: vi.fn(),
  getAdminOverview: vi.fn(),
  getAdminAccountModelUsage: vi.fn(),
  getCreditProfile: vi.fn(),
  getEmailAllowlistConfig: vi.fn(),
  getPublicModelTokenMetrics: vi.fn(),
  getPasswordLoginThrottle: vi.fn(),
  clearLegacyAdministratorRoles: vi.fn(),
  deleteAccountPermanently: vi.fn(),
  grantAdminAccountCredit: vi.fn(),
  grantDiscordVerifiedAccountGiveaway: vi.fn(),
  listCreditGiveawayHistory: vi.fn(),
  listUnreadCreditGiveawayNotifications: vi.fn(),
  dismissCreditGiveawayNotification: vi.fn(),
  countDiscordVerifiedAccounts: vi.fn(),
  getAuthSessionVersion: vi.fn(),
  getPlatformMaintenanceConfig: vi.fn(),
  getPlaygroundMaintenanceConfig: vi.fn(),
  getMaintenanceCountdown: vi.fn(),
  countDiscordUnverifiedAccounts: vi.fn(),
  deleteDiscordUnverifiedAccounts: vi.fn(),
  getUsageLogs: vi.fn(),
  getQuotaStatus: vi.fn(),
  getUsageSummary: vi.fn(),
  listAdminAccounts: vi.fn(),
  listApiKeys: vi.fn(),
  listOpenFlags: vi.fn(),
  recordFailedPasswordLogin: vi.fn(),
  revokeAllTokenForgeSessions: vi.fn(),
  revokeApiKey: vi.fn(),
  resetDiscordVerification: vi.fn(),
  getOrCreateAdminSessionPrincipal: vi.fn(),
  rotateApiKey: vi.fn(),
  setAccountControl: vi.fn(),
  setEmailAllowlistConfig: vi.fn(),
  setPlatformMaintenanceConfig: vi.fn(),
  setPlaygroundMaintenanceConfig: vi.fn(),
  setMaintenanceCountdown: vi.fn(),
  setModelEnabled: vi.fn(),
  setProviderEnabled: vi.fn(),
  writeAuditEvent: vi.fn(),
}));

vi.mock("./_core/sdk", () => ({
  sdk: {
    createSessionToken: vi.fn().mockResolvedValue("tf-local-session"),
  },
}));

vi.mock("./adminPasscode", () => ({
  verifyAdminPasscode: vi.fn(),
}));

import {
  authenticatePasswordUser,
  claimDailyCheckin,
  clearFailedPasswordLogin,
  createPasswordUser,
  getUsageLogs,
  getPasswordLoginThrottle,
  getPublicModelTokenMetrics,
  getEmailAllowlistConfig,
  getAdminAccountModelUsage,
  listAdminAccounts,
  listApiKeys,
  clearLegacyAdministratorRoles,
  deleteAccountPermanently,
  grantAdminAccountCredit,
  grantDiscordVerifiedAccountGiveaway,
  listCreditGiveawayHistory,
  listUnreadCreditGiveawayNotifications,
  dismissCreditGiveawayNotification,
  countDiscordVerifiedAccounts,
  getAuthSessionVersion,
  getPlatformMaintenanceConfig,
  getPlaygroundMaintenanceConfig,
  getMaintenanceCountdown,
  countDiscordUnverifiedAccounts,
  deleteDiscordUnverifiedAccounts,
  DiscordUnverifiedAccountDeletedError,
  recordFailedPasswordLogin,
  revokeAllTokenForgeSessions,
  resetDiscordVerification,
  getOrCreateAdminSessionPrincipal,
  setEmailAllowlistConfig,
  setPlatformMaintenanceConfig,
  setPlaygroundMaintenanceConfig,
  setMaintenanceCountdown,
  setProviderEnabled,
  writeAuditEvent,
} from "./db";
import { verifyAdminPasscode } from "./adminPasscode";
import { appRouter } from "./routers";
import { COOKIE_NAME } from "../shared/const";
import { isPermanentEmailAddress, LOGIN_FAILURE_LIMIT, nextFailedLoginState, retryAfterSeconds, type LoginAttemptState } from "./localAuth";

const localUser: User = {
  id: 42,
  openId: "tf_local_test-user",
  email: "dev@gmail.com",
  name: "TokenForge Developer",
  loginMethod: "password",
  role: "user",
  createdAt: new Date("2026-08-14T00:00:00.000Z"),
  updatedAt: new Date("2026-08-14T00:00:00.000Z"),
  lastSignedIn: new Date("2026-08-14T00:00:00.000Z"),
};

function makeContext(user: AuthenticatedUser | null = null) {
  const cookies: Array<{ name: string; value: string; options: Record<string, unknown> }> = [];
  const ctx: TrpcContext = {
    user,
    req: { protocol: "https", headers: {}, header: vi.fn().mockReturnValue(undefined), ip: "127.0.0.1" } as TrpcContext["req"],
    res: {
      cookie: (name: string, value: string, options: Record<string, unknown>) => cookies.push({ name, value, options }),
      clearCookie: vi.fn(),
    } as TrpcContext["res"],
  };
  return { ctx, cookies };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getPasswordLoginThrottle).mockResolvedValue({ blocked: false, retryAfterSeconds: 0 });
  vi.mocked(recordFailedPasswordLogin).mockResolvedValue({ blocked: false, retryAfterSeconds: 0 });
  vi.mocked(clearFailedPasswordLogin).mockResolvedValue(undefined);
  vi.mocked(getEmailAllowlistConfig).mockResolvedValue(null);
  vi.mocked(getAdminAccountModelUsage).mockResolvedValue([]);
  vi.mocked(clearLegacyAdministratorRoles).mockResolvedValue(true);
  vi.mocked(deleteAccountPermanently).mockResolvedValue(true);
  vi.mocked(countDiscordVerifiedAccounts).mockResolvedValue(2);
  vi.mocked(grantDiscordVerifiedAccountGiveaway).mockResolvedValue({ applied: true, recipientCount: 2, amountNanos: 5_000_000_000, totalAmountNanos: 10_000_000_000 });
  vi.mocked(listCreditGiveawayHistory).mockResolvedValue([]);
  vi.mocked(listUnreadCreditGiveawayNotifications).mockResolvedValue([]);
  vi.mocked(dismissCreditGiveawayNotification).mockResolvedValue(true);
  vi.mocked(getAuthSessionVersion).mockResolvedValue(3);
  vi.mocked(getPlatformMaintenanceConfig).mockResolvedValue({ enabled: false, updatedAt: null });
  vi.mocked(setPlatformMaintenanceConfig).mockResolvedValue({ enabled: false, updatedAt: null });
  vi.mocked(getPlaygroundMaintenanceConfig).mockResolvedValue({ enabled: false, updatedAt: null });
  vi.mocked(setPlaygroundMaintenanceConfig).mockResolvedValue({ enabled: false, updatedAt: null });
  vi.mocked(getMaintenanceCountdown).mockResolvedValue(null);
  vi.mocked(setMaintenanceCountdown).mockResolvedValue(null);
  vi.mocked(countDiscordUnverifiedAccounts).mockResolvedValue(3);
  vi.mocked(deleteDiscordUnverifiedAccounts).mockResolvedValue({ deletedCount: 3 });
  vi.mocked(revokeAllTokenForgeSessions).mockResolvedValue(4);
  vi.mocked(resetDiscordVerification).mockResolvedValue({ reset: true });
  vi.mocked(getOrCreateAdminSessionPrincipal).mockResolvedValue({ ...localUser, id: 7, openId: "tf_internal_admin_control_plane", name: "TokenForge Administrator", email: null, loginMethod: "admin_passcode" });
  vi.mocked(verifyAdminPasscode).mockReturnValue(false);
});

describe("GitHub-only authentication and developer protections", () => {
  it("does not expose manual password registration or login procedures", () => {
    const procedures = Object.keys(appRouter._def.procedures);
    expect(procedures).not.toContain("auth.register");
    expect(procedures).not.toContain("auth.login");
    expect(procedures).toContain("auth.logout");
  });

  it("records the provider-wide model cascade when an administrator pauses a provider", async () => {
    vi.mocked(setProviderEnabled).mockResolvedValue({ updated: true, disabledModels: 28 });
    const admin = { ...localUser, id: 1, isAdminSession: true };

    await expect(appRouter.createCaller(makeContext(admin).ctx).admin.setProviderEnabled({ slug: "cluster-protocol", enabled: false })).resolves.toEqual({ success: true, disabledModels: 28 });
    expect(writeAuditEvent).toHaveBeenCalledWith(expect.objectContaining({ action: "provider.disabled", entityId: "cluster-protocol", metadata: { disabledModels: 28 } }));
  });

  it("allows only administrators to view and update the persisted email allowlist", async () => {
    const admin = { ...localUser, id: 1, isAdminSession: true };
    const saved = { entries: ["company.com"], updatedAt: new Date(), updatedByUserId: 1 };
    vi.mocked(getEmailAllowlistConfig).mockResolvedValue(saved);
    vi.mocked(setEmailAllowlistConfig).mockResolvedValue(saved);
    const adminCaller = appRouter.createCaller(makeContext(admin).ctx);
    await expect(adminCaller.admin.emailAllowlist()).resolves.toMatchObject({ entries: ["company.com"], source: "database" });
    await expect(adminCaller.admin.setEmailAllowlist({ entries: ["company.com"] })).resolves.toEqual(saved);
    await expect(appRouter.createCaller(makeContext(localUser).ctx).admin.emailAllowlist()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("issues the only administrator session from a valid passcode without a developer-account session", async () => {
    vi.mocked(verifyAdminPasscode).mockReturnValue(true);
    const caller = appRouter.createCaller(makeContext().ctx);

    await expect(caller.admin.unlock({ passcode: "8649" })).resolves.toEqual({ unlocked: true, alreadyAdmin: false, sessionVersion: 4 });
    expect(clearLegacyAdministratorRoles).toHaveBeenCalledOnce();
    expect(revokeAllTokenForgeSessions).toHaveBeenCalledOnce();
    expect(getOrCreateAdminSessionPrincipal).toHaveBeenCalledOnce();
    expect(clearFailedPasswordLogin).toHaveBeenCalledWith(expect.stringMatching(/^admin-unlock-ip-[a-f0-9]{64}@tokenforge\.internal$/));
    expect(writeAuditEvent).toHaveBeenCalledWith(expect.objectContaining({ actorUserId: 7, action: "admin.passcode.unlocked", entityType: "administrator_session", metadata: { entry: "passcode_only" } }));
  });

  it("rejects an incorrect administrator passcode and rate-accounts the attempt without revoking sessions", async () => {
    const caller = appRouter.createCaller(makeContext().ctx);

    await expect(caller.admin.unlock({ passcode: "0000" })).rejects.toMatchObject({ code: "UNAUTHORIZED", message: "Incorrect administrator passcode" });
    expect(recordFailedPasswordLogin).toHaveBeenCalledWith(expect.stringMatching(/^admin-unlock-ip-[a-f0-9]{64}@tokenforge\.internal$/));
    expect(revokeAllTokenForgeSessions).not.toHaveBeenCalled();
  });

  it("allows the passcode-issued administrator session to be downgraded in the current browser", async () => {
    const admin = { ...localUser, isAdminSession: true };
    const { ctx } = makeContext(admin);
    const caller = appRouter.createCaller(ctx);

    await expect(caller.admin.signOut()).resolves.toEqual({ success: true });
    expect(ctx.res.clearCookie).toHaveBeenCalledWith(COOKIE_NAME, expect.objectContaining({ httpOnly: true, path: "/" }));
  });

  it("requires Discord verification for developer data while preserving the administrator recovery bypass", async () => {
    vi.mocked(listApiKeys).mockResolvedValue([]);
    const unverified = makeContext(localUser);
    const verified = makeContext({ ...localUser, discordVerifiedAt: new Date("2026-08-16T00:00:00.000Z") });
    const administrator = makeContext({ ...localUser, isAdminSession: true });
    const anonymous = makeContext();

    await expect(appRouter.createCaller(unverified.ctx).developer.apiKeys()).rejects.toMatchObject({ code: "FORBIDDEN", message: expect.stringContaining("Discord membership verification") });
    await expect(appRouter.createCaller(verified.ctx).developer.apiKeys()).resolves.toEqual([]);
    await expect(appRouter.createCaller(administrator.ctx).developer.apiKeys()).resolves.toEqual([]);
    await expect(appRouter.createCaller(anonymous.ctx).developer.apiKeys()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("returns and dismisses Giveaway notices only for the signed-in verified recipient", async () => {
    const verified = { ...localUser, discordVerifiedAt: new Date("2026-08-16T00:00:00.000Z") };
    const notice = { id: 88, giveawayId: "gift123", amountNanos: 20_000_000_000, announcementNote: "Thank you for building with TokenForge.", createdAt: new Date("2026-08-17T12:00:00.000Z") };
    vi.mocked(listUnreadCreditGiveawayNotifications).mockResolvedValue([notice]);

    await expect(appRouter.createCaller(makeContext(localUser).ctx).developer.unreadGiveawayNotifications()).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(appRouter.createCaller(makeContext(verified).ctx).developer.unreadGiveawayNotifications()).resolves.toEqual([notice]);
    await expect(appRouter.createCaller(makeContext(verified).ctx).developer.dismissGiveawayNotification({ notificationId: 88 })).resolves.toBe(true);
    expect(listUnreadCreditGiveawayNotifications).toHaveBeenCalledWith(localUser.id);
    expect(dismissCreditGiveawayNotification).toHaveBeenCalledWith({ userId: localUser.id, notificationId: 88 });
  });

  it("returns a Discord verification state without disclosing any Discord account identity", async () => {
    const unverified = await appRouter.createCaller(makeContext(localUser).ctx).developer.discordVerificationStatus();
    const verified = await appRouter.createCaller(makeContext({ ...localUser, discordVerifiedAt: new Date("2026-08-16T00:00:00.000Z") }).ctx).developer.discordVerificationStatus();
    const administrator = await appRouter.createCaller(makeContext({ ...localUser, isAdminSession: true }).ctx).developer.discordVerificationStatus();

    expect(unverified).toEqual({ verified: false, administratorBypass: false, discordInviteUrl: "https://discord.gg/pnsWamDbe" });
    expect(verified).toEqual({ verified: true, administratorBypass: false, discordInviteUrl: "https://discord.gg/pnsWamDbe" });
    expect(administrator).toEqual({ verified: true, administratorBypass: true, discordInviteUrl: "https://discord.gg/pnsWamDbe" });
    expect(Object.keys(verified)).not.toContain("discordUserId");
  });

  it("returns an idempotent daily check-in result without granting the reward twice", async () => {
    vi.mocked(claimDailyCheckin)
      .mockResolvedValueOnce({ claimed: true, rewardNanos: 5_000_000_000 })
      .mockResolvedValueOnce({ claimed: false, rewardNanos: 0 });
    const { ctx } = makeContext({ ...localUser, discordVerifiedAt: new Date("2026-08-16T00:00:00.000Z") });
    const caller = appRouter.createCaller(ctx);

    await expect(caller.developer.checkIn()).resolves.toEqual({ claimed: true, rewardNanos: 5_000_000_000 });
    await expect(caller.developer.checkIn()).resolves.toEqual({ claimed: false, rewardNanos: 0 });
    expect(claimDailyCheckin).toHaveBeenCalledTimes(2);
    expect(claimDailyCheckin).toHaveBeenNthCalledWith(1, localUser.id);
    expect(claimDailyCheckin).toHaveBeenNthCalledWith(2, localUser.id);
  });

  it("returns only the caller's filtered detailed request logs with credit metadata", async () => {
    const createdAt = new Date("2026-08-14T10:30:00.000Z");
    const log = {
      id: 9,
      requestId: "req_credit_test",
      createdAt,
      source: "playground" as const,
      stream: false,
      status: "completed",
      modelId: "glm-5.2" as const,
      inputTokens: 120,
      outputTokens: 80,
      totalTokens: 200,
      chargeNanos: 520_000,
      apiKeyLabel: null,
    };
    vi.mocked(getUsageLogs).mockResolvedValue([log]);
    const { ctx } = makeContext({ ...localUser, discordVerifiedAt: new Date("2026-08-16T00:00:00.000Z") });

    await expect(appRouter.createCaller(ctx).developer.usageLogs({
      modelId: "glm-5.2",
      source: "playground",
      from: "2026-08-14T00:00:00.000Z",
      to: "2026-08-14T23:59:59.999Z",
      limit: 25,
    })).resolves.toEqual([log]);
    expect(getUsageLogs).toHaveBeenCalledWith({
      userId: localUser.id,
      modelId: "glm-5.2",
      source: "playground",
      from: new Date("2026-08-14T00:00:00.000Z"),
      to: new Date("2026-08-14T23:59:59.999Z"),
      limit: 25,
    });
  });

  it("returns only grouped token totals for the public live model metric", async () => {
    vi.mocked(getPublicModelTokenMetrics).mockResolvedValue({ totalTokens: 4560, byModel: { "glm-5.2": 1234, "grok-4.5": 3326 } });
    const { ctx } = makeContext();

    await expect(appRouter.createCaller(ctx).public.modelTokenMetrics()).resolves.toEqual({ totalTokens: 4560, byModel: { "glm-5.2": 1234, "grok-4.5": 3326 } });
  });
});

describe("protected administrator account directory", () => {
  it("requires an administrator and forwards bounded account search filters to the server directory", async () => {
    const page = { items: [], total: 12, page: 2, pageSize: 10, pageCount: 2 };
    vi.mocked(listAdminAccounts).mockResolvedValue(page);
    const admin = { ...localUser, isAdminSession: true };

    await expect(appRouter.createCaller(makeContext(localUser).ctx).admin.accounts({ page: 2, pageSize: 10, search: "arpit", status: "active" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(appRouter.createCaller(makeContext(admin).ctx).admin.accounts({ page: 2, pageSize: 10, search: "arpit", status: "active" })).resolves.toEqual(page);
    expect(listAdminAccounts).toHaveBeenCalledWith({ page: 2, pageSize: 10, search: "arpit", status: "active", sort: "latestJoin" });
  });

  it("returns aggregate-only model bars for selected accounts exclusively to a passcode-issued administrator session", async () => {
    const usage = [{ userId: 42, modelId: "kimi-k3", requestCount: 3, totalTokens: 12_345 }];
    vi.mocked(getAdminAccountModelUsage).mockResolvedValue(usage);
    const admin = { ...localUser, isAdminSession: true };

    await expect(appRouter.createCaller(makeContext(localUser).ctx).admin.accountModelUsage({ userIds: [42, 77] })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(appRouter.createCaller(makeContext(admin).ctx).admin.accountModelUsage({ userIds: [42, 77] })).resolves.toEqual(usage);
    expect(getAdminAccountModelUsage).toHaveBeenCalledWith([42, 77]);
  });

  it("permanently deletes another account with one explicit administrator action", async () => {
    const admin = { ...localUser, isAdminSession: true };
    await expect(appRouter.createCaller(makeContext(admin).ctx).admin.deleteAccount({ userId: 55 })).resolves.toEqual({ success: true });
    expect(deleteAccountPermanently).toHaveBeenCalledWith(55);
    await expect(appRouter.createCaller(makeContext(admin).ctx).admin.deleteAccount({ userId: admin.id })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("adds a positive audited USD credit grant to another account only from a passcode-issued administrator session", async () => {
    const admin = { ...localUser, id: 1, isAdminSession: true };
    vi.mocked(grantAdminAccountCredit).mockResolvedValue({ amountNanos: 50_000_000_000, balanceNanos: 60_000_000_000 });

    await expect(appRouter.createCaller(makeContext(localUser).ctx).admin.addAccountCredit({ userId: 55, amountUsd: 50 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(appRouter.createCaller(makeContext(admin).ctx).admin.addAccountCredit({ userId: admin.id, amountUsd: 50 })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(appRouter.createCaller(makeContext(admin).ctx).admin.addAccountCredit({ userId: 55, amountUsd: 50 })).resolves.toEqual({ amountNanos: 50_000_000_000, balanceNanos: 60_000_000_000 });
    expect(grantAdminAccountCredit).toHaveBeenCalledWith({ actorUserId: 1, userId: 55, amountNanos: 50_000_000_000 });
    expect(writeAuditEvent).toHaveBeenCalledWith(expect.objectContaining({ actorUserId: 1, targetUserId: 55, action: "account.credit_granted", entityType: "account", entityId: "55", metadata: { amountNanos: 50_000_000_000 } }));
  });

  it("credits only the reviewed Discord-verified recipient set from a passcode-issued administrator session and records one aggregate audit event", async () => {
    const admin = { ...localUser, id: 1, isAdminSession: true };
    const input = { amountUsd: 5, announcementNote: "Thank you for verifying your TokenForge Discord membership.", expectedRecipientCount: 2, confirmation: "GIVE $5.00 TO 2 VERIFIED ACCOUNTS" };

    await expect(appRouter.createCaller(makeContext(localUser).ctx).admin.giveDiscordVerifiedAccountsCredit(input)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(appRouter.createCaller(makeContext(admin).ctx).admin.giveDiscordVerifiedAccountsCredit(input)).resolves.toEqual({ applied: true, recipientCount: 2, amountNanos: 5_000_000_000, totalAmountNanos: 10_000_000_000 });
    expect(grantDiscordVerifiedAccountGiveaway).toHaveBeenCalledWith({ actorUserId: 1, amountNanos: 5_000_000_000, announcementNote: "Thank you for verifying your TokenForge Discord membership.", expectedRecipientCount: 2 });
    expect(writeAuditEvent).toHaveBeenCalledWith(expect.objectContaining({ actorUserId: 1, action: "account.discord_verified.giveaway_credited", entityType: "credit_giveaway", entityId: "discord_verified", metadata: { amountNanos: 5_000_000_000, recipientCount: 2, totalAmountNanos: 10_000_000_000, hasAnnouncementNote: true } }));
  });

  it("exposes completed giveaway history only to a passcode-issued administrator", async () => {
    const admin = { ...localUser, id: 1, isAdminSession: true };
    const record = { id: "gift123", actorUserId: 1, amountNanos: 5_000_000_000, recipientCount: 2, totalAmountNanos: 10_000_000_000, announcementNote: "Member appreciation", createdAt: new Date("2026-08-17T12:00:00.000Z") };
    vi.mocked(listCreditGiveawayHistory).mockResolvedValue([record]);

    await expect(appRouter.createCaller(makeContext(localUser).ctx).admin.giveawayHistory()).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(appRouter.createCaller(makeContext(admin).ctx).admin.giveawayHistory()).resolves.toEqual([record]);
  });

  it("redacts giveaway persistence failures rather than exposing raw database details to an administrator browser", async () => {
    const admin = { ...localUser, id: 1, isAdminSession: true };
    const input = { amountUsd: 20, expectedRecipientCount: 149, confirmation: "GIVE $20.00 TO 149 VERIFIED ACCOUNTS" };
    vi.mocked(grantDiscordVerifiedAccountGiveaway).mockRejectedValue(new Error("Failed query: insert into credit_accounts ... on duplicate key update userId = user_id"));

    await expect(appRouter.createCaller(makeContext(admin).ctx).admin.giveDiscordVerifiedAccountsCredit(input)).rejects.toMatchObject({
      code: "INTERNAL_SERVER_ERROR",
      message: "The giveaway could not be completed. No giveaway credit was applied; review the recipient count and try again.",
    });
    expect(writeAuditEvent).not.toHaveBeenCalled();
  });

  it("lets only a passcode-issued administrator deliberately reset another account's Discord verification and records the action", async () => {
    const admin = { ...localUser, id: 1, isAdminSession: true };
    const input = { userId: 55, confirmation: "RESET DISCORD VERIFICATION 55" };

    await expect(appRouter.createCaller(makeContext(localUser).ctx).admin.resetDiscordVerification(input)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(appRouter.createCaller(makeContext(admin).ctx).admin.resetDiscordVerification({ ...input, confirmation: "reset" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(appRouter.createCaller(makeContext(admin).ctx).admin.resetDiscordVerification(input)).resolves.toEqual({ success: true, reset: true });
    expect(resetDiscordVerification).toHaveBeenCalledWith(55);
    expect(writeAuditEvent).toHaveBeenCalledWith(expect.objectContaining({ actorUserId: 1, targetUserId: 55, action: "account.discord_verification.reset", entityType: "account", entityId: "55", metadata: { verificationWasPresent: true } }));
    await expect(appRouter.createCaller(makeContext(admin).ctx).admin.resetDiscordVerification({ userId: admin.id, confirmation: `RESET DISCORD VERIFICATION ${admin.id}` })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("lets an administrator pause only the Playground and records the scoped action", async () => {
    const admin = { ...localUser, id: 1, isAdminSession: true };
    vi.mocked(setPlaygroundMaintenanceConfig).mockResolvedValueOnce({ enabled: true, updatedAt: new Date("2026-08-28T00:00:00.000Z"), updatedByUserId: 1 });
    await expect(appRouter.createCaller(makeContext(admin).ctx).admin.setPlaygroundMaintenance({ enabled: true })).resolves.toMatchObject({ enabled: true });
    expect(writeAuditEvent).toHaveBeenCalledWith(expect.objectContaining({ actorUserId: 1, action: "playground.maintenance.enabled", entityType: "platform_setting", entityId: "playground_maintenance" }));
  });

  it("lets an administrator enable global inference maintenance and records the action", async () => {
    const admin = { ...localUser, id: 1, isAdminSession: true };
    vi.mocked(setPlatformMaintenanceConfig).mockResolvedValueOnce({ enabled: true, updatedAt: new Date("2026-08-17T00:00:00.000Z") });
    vi.mocked(getPlatformMaintenanceConfig).mockResolvedValueOnce({ enabled: true, updatedAt: new Date("2026-08-17T00:00:00.000Z") });
    await expect(appRouter.createCaller(makeContext(admin).ctx).admin.setPlatformMaintenance({ enabled: true })).resolves.toMatchObject({ enabled: true });
    expect(writeAuditEvent).toHaveBeenCalledWith(expect.objectContaining({ actorUserId: 1, action: "platform.maintenance.enabled", entityType: "platform_setting" }));
  });

  it("exposes, starts, validates, and clears a public maintenance countdown through administrator-only controls", async () => {
    const admin = { ...localUser, id: 1, isAdminSession: true };
    const active = { endsAt: Date.now() + 16 * 60 * 60 * 1_000, note: "Site under maintenance" };
    vi.mocked(getMaintenanceCountdown).mockResolvedValue(active);
    vi.mocked(setMaintenanceCountdown).mockResolvedValueOnce(active).mockResolvedValueOnce(null);

    await expect(appRouter.createCaller(makeContext().ctx).public.maintenanceCountdown()).resolves.toEqual(active);
    await expect(appRouter.createCaller(makeContext(admin).ctx).admin.setMaintenanceCountdown({ durationMs: 16 * 60 * 60 * 1_000, note: "  Site under maintenance  " })).resolves.toEqual(active);
    expect(setMaintenanceCountdown).toHaveBeenCalledWith({ durationMs: 16 * 60 * 60 * 1_000, note: "Site under maintenance" }, 1);
    expect(writeAuditEvent).toHaveBeenCalledWith(expect.objectContaining({ actorUserId: 1, action: "platform.maintenance_countdown.started", entityId: "maintenance_countdown_v1", metadata: { durationMs: 16 * 60 * 60 * 1_000 } }));
    await expect(appRouter.createCaller(makeContext(admin).ctx).admin.setMaintenanceCountdown(null)).resolves.toBeNull();
    expect(setMaintenanceCountdown).toHaveBeenLastCalledWith(null, 1);
    expect(writeAuditEvent).toHaveBeenCalledWith(expect.objectContaining({ actorUserId: 1, action: "platform.maintenance_countdown.cleared", entityId: "maintenance_countdown_v1" }));
    await expect(appRouter.createCaller(makeContext(admin).ctx).admin.setMaintenanceCountdown({ durationMs: 0, note: "Invalid" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(appRouter.createCaller(makeContext(localUser).ctx).admin.setMaintenanceCountdown({ durationMs: 60_000, note: "Forbidden" })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("requires the reviewed current count and typed phrase before bulk-deleting Discord-unverified accounts", async () => {
    const admin = { ...localUser, id: 1, isAdminSession: true };
    const caller = appRouter.createCaller(makeContext(admin).ctx);
    await expect(caller.admin.deleteDiscordUnverifiedAccounts({ expectedCount: 3, confirmation: "DELETE 3 UNVERIFIED DISCORD ACCOUNTS" })).resolves.toEqual({ deletedCount: 3 });
    expect(deleteDiscordUnverifiedAccounts).toHaveBeenCalledTimes(1);
    expect(writeAuditEvent).toHaveBeenCalledWith(expect.objectContaining({ actorUserId: 1, action: "account.discord_unverified.bulk_deleted", metadata: { deletedCount: 3 } }));
    await expect(caller.admin.deleteDiscordUnverifiedAccounts({ expectedCount: 3, confirmation: "DELETE ALL" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});
