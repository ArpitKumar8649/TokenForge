import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";
import type { User } from "../drizzle/schema";
import type { AuthenticatedUser } from "./_core/sdk";

vi.mock("./db", () => ({
  authenticatePasswordUser: vi.fn(),
  clearFailedPasswordLogin: vi.fn(),
  createApiKey: vi.fn(),
  createPasswordUser: vi.fn(),
  claimDailyCheckin: vi.fn(),
  getAdminOverview: vi.fn(),
  getCreditProfile: vi.fn(),
  getEmailAllowlistConfig: vi.fn(),
  getPublicModelTokenMetrics: vi.fn(),
  getPasswordLoginThrottle: vi.fn(),
  clearLegacyAdministratorRoles: vi.fn(),
  deleteAccountPermanently: vi.fn(),
  getAuthSessionVersion: vi.fn(),
  getUsageLogs: vi.fn(),
  getQuotaStatus: vi.fn(),
  getUsageSummary: vi.fn(),
  listAdminAccounts: vi.fn(),
  listApiKeys: vi.fn(),
  listOpenFlags: vi.fn(),
  recordFailedPasswordLogin: vi.fn(),
  revokeAllTokenForgeSessions: vi.fn(),
  revokeApiKey: vi.fn(),
  rotateApiKey: vi.fn(),
  setAccountControl: vi.fn(),
  setEmailAllowlistConfig: vi.fn(),
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
  listAdminAccounts,
  listApiKeys,
  clearLegacyAdministratorRoles,
  deleteAccountPermanently,
  getAuthSessionVersion,
  recordFailedPasswordLogin,
  revokeAllTokenForgeSessions,
  setEmailAllowlistConfig,
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
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
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
  vi.mocked(clearLegacyAdministratorRoles).mockResolvedValue(true);
  vi.mocked(deleteAccountPermanently).mockResolvedValue(true);
  vi.mocked(getAuthSessionVersion).mockResolvedValue(3);
  vi.mocked(revokeAllTokenForgeSessions).mockResolvedValue(4);
  vi.mocked(verifyAdminPasscode).mockReturnValue(false);
});

describe("first-party authentication procedures", () => {
  it("returns a conflict without setting a session for a duplicate registration", async () => {
    vi.mocked(createPasswordUser).mockResolvedValue(null);
    const { ctx, cookies } = makeContext();

    await expect(appRouter.createCaller(ctx).auth.register({ email: "dev@gmail.com", password: "secure-passphrase" })).rejects.toMatchObject({ code: "CONFLICT" });
    expect(cookies).toEqual([]);
  });

  it("issues the existing signed-session cookie after a valid local registration", async () => {
    vi.mocked(createPasswordUser).mockResolvedValue(localUser);
    const { ctx, cookies } = makeContext();

    await expect(appRouter.createCaller(ctx).auth.register({ email: "dev@gmail.com", password: "secure-passphrase" })).resolves.toEqual({ user: localUser });
    expect(cookies).toHaveLength(1);
    expect(cookies[0]).toMatchObject({ name: COOKIE_NAME, value: "tf-local-session", options: { httpOnly: true } });
  });

  it("rejects an unlisted registration address before creating an account", async () => {
    const { ctx } = makeContext();

    await expect(appRouter.createCaller(ctx).auth.register({ email: "trial@custom-domain.example", password: "secure-passphrase" })).rejects.toMatchObject({ code: "BAD_REQUEST", message: expect.stringContaining("accepted mailbox provider") });
    expect(createPasswordUser).not.toHaveBeenCalled();
  });

  it("keeps disposable-address sign-in failures generic and rate-accounted", async () => {
    const { ctx } = makeContext();

    await expect(appRouter.createCaller(ctx).auth.login({ email: "trial@mailinator.com", password: "secure-passphrase" })).rejects.toMatchObject({ code: "UNAUTHORIZED", message: "Incorrect email or password" });
    expect(authenticatePasswordUser).not.toHaveBeenCalled();
    expect(recordFailedPasswordLogin).toHaveBeenCalledWith("trial@mailinator.com");
  });

  it("enforces a configured domain allowlist after the established-provider check", () => {
    const previous = process.env.TOKENFORGE_EMAIL_ALLOWLIST;
    process.env.TOKENFORGE_EMAIL_ALLOWLIST = "gmail.com, yahoo.com";
    try {
      expect(isPermanentEmailAddress("developer@gmail.com")).toBe(true);
      expect(isPermanentEmailAddress("approved@yahoo.com")).toBe(true);
      expect(isPermanentEmailAddress("developer@unlisted.test")).toBe(false);
      expect(isPermanentEmailAddress("trial@mailinator.com")).toBe(false);
    } finally {
      if (previous === undefined) delete process.env.TOKENFORGE_EMAIL_ALLOWLIST;
      else process.env.TOKENFORGE_EMAIL_ALLOWLIST = previous;
    }
  });

  it("accepts established international mailbox domains and rejects arbitrary custom domains by default", () => {
    const previous = process.env.TOKENFORGE_EMAIL_ALLOWLIST;
    delete process.env.TOKENFORGE_EMAIL_ALLOWLIST;
    try {
      for (const email of [
        "developer@qq.com",
        "developer@163.com",
        "developer@naver.com",
        "developer@yandex.com",
        "developer@gmx.de",
        "developer@web.de",
        "developer@proton.me",
        "developer@tuta.com",
        "developer@gmail.com",
        "developer@outlook.com",
      ]) {
        expect(isPermanentEmailAddress(email)).toBe(true);
      }
      expect(isPermanentEmailAddress("developer@company.example")).toBe(false);
    } finally {
      if (previous === undefined) delete process.env.TOKENFORGE_EMAIL_ALLOWLIST;
      else process.env.TOKENFORGE_EMAIL_ALLOWLIST = previous;
    }
  });

  it("applies a persisted administrator allowlist ahead of the environment fallback", async () => {
    vi.mocked(getEmailAllowlistConfig).mockResolvedValue({ entries: ["qq.com"], updatedAt: new Date(), updatedByUserId: 1 });
    vi.mocked(createPasswordUser).mockResolvedValue(localUser);
    const { ctx } = makeContext();
    await expect(appRouter.createCaller(ctx).auth.register({ email: "developer@qq.com", password: "secure-passphrase" })).resolves.toEqual({ user: localUser });
    await expect(appRouter.createCaller(ctx).auth.register({ email: "developer@gmail.com", password: "secure-passphrase" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
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

  it("issues the only administrator session and revokes all prior sessions after a verified passcode", async () => {
    vi.mocked(verifyAdminPasscode).mockReturnValue(true);
    const caller = appRouter.createCaller(makeContext(localUser).ctx);

    await expect(caller.admin.unlock({ passcode: "8649" })).resolves.toEqual({ unlocked: true, alreadyAdmin: false, sessionVersion: 4 });
    expect(clearLegacyAdministratorRoles).toHaveBeenCalledOnce();
    expect(revokeAllTokenForgeSessions).toHaveBeenCalledOnce();
    expect(clearFailedPasswordLogin).toHaveBeenCalledWith(`admin-unlock-${localUser.id}@tokenforge.internal`);
  });

  it("rejects an incorrect administrator passcode and rate-accounts the attempt without revoking sessions", async () => {
    const caller = appRouter.createCaller(makeContext(localUser).ctx);

    await expect(caller.admin.unlock({ passcode: "0000" })).rejects.toMatchObject({ code: "UNAUTHORIZED", message: "Incorrect administrator passcode" });
    expect(recordFailedPasswordLogin).toHaveBeenCalledWith(`admin-unlock-${localUser.id}@tokenforge.internal`);
    expect(revokeAllTokenForgeSessions).not.toHaveBeenCalled();
  });

  it("allows the passcode-issued administrator session to be downgraded in the current browser", async () => {
    const admin = { ...localUser, isAdminSession: true };
    const caller = appRouter.createCaller(makeContext(admin).ctx);

    await expect(caller.admin.signOut()).resolves.toEqual({ success: true });
    expect(getAuthSessionVersion).toHaveBeenCalled();
  });

  it("returns a generic unauthorized error for an incorrect password and records the failure", async () => {
    vi.mocked(authenticatePasswordUser).mockResolvedValue(null);
    const { ctx } = makeContext();

    await expect(appRouter.createCaller(ctx).auth.login({ email: "dev@example.com", password: "secure-passphrase" })).rejects.toMatchObject({ code: "UNAUTHORIZED", message: "Incorrect email or password" });
    expect(recordFailedPasswordLogin).toHaveBeenCalledWith("dev@example.com");
  });

  it("transitions consecutive failed sign-ins from generic rejection to retry guidance at the configured boundary", async () => {
    vi.mocked(authenticatePasswordUser).mockResolvedValue(null);
    const now = new Date("2026-08-14T00:00:00.000Z");
    let state: LoginAttemptState | null = null;
    vi.mocked(recordFailedPasswordLogin).mockImplementation(async () => {
      state = nextFailedLoginState(state, now);
      const retryAfter = retryAfterSeconds(state.blockedUntil, now);
      return { blocked: retryAfter > 0, retryAfterSeconds: retryAfter };
    });
    const { ctx } = makeContext();
    const caller = appRouter.createCaller(ctx);

    for (let attempt = 0; attempt < LOGIN_FAILURE_LIMIT - 1; attempt += 1) {
      await expect(caller.auth.login({ email: "dev@example.com", password: "secure-passphrase" })).rejects.toMatchObject({ code: "UNAUTHORIZED", message: "Incorrect email or password" });
    }
    await expect(caller.auth.login({ email: "dev@example.com", password: "secure-passphrase" })).rejects.toMatchObject({ code: "TOO_MANY_REQUESTS", message: "Too many sign-in attempts. Try again in 900 seconds." });
    expect(recordFailedPasswordLogin).toHaveBeenCalledTimes(LOGIN_FAILURE_LIMIT);
  });

  it("allows a signed-in local user into protected developer procedures while rejecting anonymous access", async () => {
    vi.mocked(listApiKeys).mockResolvedValue([]);
    const authenticated = makeContext(localUser);
    const anonymous = makeContext();

    await expect(appRouter.createCaller(authenticated.ctx).developer.apiKeys()).resolves.toEqual([]);
    await expect(appRouter.createCaller(anonymous.ctx).developer.apiKeys()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("returns an idempotent daily check-in result without granting the reward twice", async () => {
    vi.mocked(claimDailyCheckin)
      .mockResolvedValueOnce({ claimed: true, rewardNanos: 5_000_000_000 })
      .mockResolvedValueOnce({ claimed: false, rewardNanos: 0 });
    const { ctx } = makeContext(localUser);
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
    const { ctx } = makeContext(localUser);

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
    expect(listAdminAccounts).toHaveBeenCalledWith({ page: 2, pageSize: 10, search: "arpit", status: "active" });
  });

  it("permanently deletes another account only from a passcode-issued administrator session", async () => {
    const admin = { ...localUser, isAdminSession: true };
    await expect(appRouter.createCaller(makeContext(admin).ctx).admin.deleteAccount({ userId: 55, confirmation: "DELETE ACCOUNT 55" })).resolves.toEqual({ success: true });
    expect(deleteAccountPermanently).toHaveBeenCalledWith(55);
    await expect(appRouter.createCaller(makeContext(admin).ctx).admin.deleteAccount({ userId: 55, confirmation: "not-55" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(appRouter.createCaller(makeContext(admin).ctx).admin.deleteAccount({ userId: admin.id, confirmation: `DELETE ACCOUNT ${admin.id}` })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});
