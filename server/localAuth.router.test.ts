import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";
import type { User } from "../drizzle/schema";

vi.mock("./db", () => ({
  authenticatePasswordUser: vi.fn(),
  clearFailedPasswordLogin: vi.fn(),
  createApiKey: vi.fn(),
  createPasswordUser: vi.fn(),
  claimDailyCheckin: vi.fn(),
  getAdminOverview: vi.fn(),
  getCreditProfile: vi.fn(),
  getPublicModelTokenMetrics: vi.fn(),
  getPasswordLoginThrottle: vi.fn(),
  getUsageLogs: vi.fn(),
  getQuotaStatus: vi.fn(),
  getUsageSummary: vi.fn(),
  listApiKeys: vi.fn(),
  listOpenFlags: vi.fn(),
  recordFailedPasswordLogin: vi.fn(),
  revokeApiKey: vi.fn(),
  rotateApiKey: vi.fn(),
  setAccountControl: vi.fn(),
  setModelEnabled: vi.fn(),
  setProviderEnabled: vi.fn(),
  writeAuditEvent: vi.fn(),
}));

vi.mock("./_core/sdk", () => ({
  sdk: {
    createSessionToken: vi.fn().mockResolvedValue("tf-local-session"),
  },
}));

import {
  authenticatePasswordUser,
  claimDailyCheckin,
  clearFailedPasswordLogin,
  createPasswordUser,
  getUsageLogs,
  getPasswordLoginThrottle,
  getPublicModelTokenMetrics,
  listApiKeys,
  recordFailedPasswordLogin,
} from "./db";
import { appRouter } from "./routers";
import { COOKIE_NAME } from "../shared/const";
import { isPermanentEmailAddress, LOGIN_FAILURE_LIMIT, nextFailedLoginState, retryAfterSeconds, type LoginAttemptState } from "./localAuth";

const localUser: User = {
  id: 42,
  openId: "tf_local_test-user",
  email: "dev@example.com",
  name: "TokenForge Developer",
  loginMethod: "password",
  role: "user",
  createdAt: new Date("2026-08-14T00:00:00.000Z"),
  updatedAt: new Date("2026-08-14T00:00:00.000Z"),
  lastSignedIn: new Date("2026-08-14T00:00:00.000Z"),
};

function makeContext(user: User | null = null) {
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
});

describe("first-party authentication procedures", () => {
  it("returns a conflict without setting a session for a duplicate registration", async () => {
    vi.mocked(createPasswordUser).mockResolvedValue(null);
    const { ctx, cookies } = makeContext();

    await expect(appRouter.createCaller(ctx).auth.register({ email: "dev@example.com", password: "secure-passphrase" })).rejects.toMatchObject({ code: "CONFLICT" });
    expect(cookies).toEqual([]);
  });

  it("issues the existing signed-session cookie after a valid local registration", async () => {
    vi.mocked(createPasswordUser).mockResolvedValue(localUser);
    const { ctx, cookies } = makeContext();

    await expect(appRouter.createCaller(ctx).auth.register({ email: "dev@example.com", password: "secure-passphrase" })).resolves.toEqual({ user: localUser });
    expect(cookies).toHaveLength(1);
    expect(cookies[0]).toMatchObject({ name: COOKIE_NAME, value: "tf-local-session", options: { httpOnly: true } });
  });

  it("rejects a disposable registration address before creating an account", async () => {
    const { ctx } = makeContext();

    await expect(appRouter.createCaller(ctx).auth.register({ email: "trial@mailinator.com", password: "secure-passphrase" })).rejects.toMatchObject({ code: "BAD_REQUEST", message: "Use a permanent email address to create a TokenForge account." });
    expect(createPasswordUser).not.toHaveBeenCalled();
  });

  it("keeps disposable-address sign-in failures generic and rate-accounted", async () => {
    const { ctx } = makeContext();

    await expect(appRouter.createCaller(ctx).auth.login({ email: "trial@mailinator.com", password: "secure-passphrase" })).rejects.toMatchObject({ code: "UNAUTHORIZED", message: "Incorrect email or password" });
    expect(authenticatePasswordUser).not.toHaveBeenCalled();
    expect(recordFailedPasswordLogin).toHaveBeenCalledWith("trial@mailinator.com");
  });

  it("enforces a configured exact-email or domain allowlist after the disposable-domain check", () => {
    const previous = process.env.TOKENFORGE_EMAIL_ALLOWLIST;
    process.env.TOKENFORGE_EMAIL_ALLOWLIST = "gmail.com, approved@forge.test";
    try {
      expect(isPermanentEmailAddress("developer@gmail.com")).toBe(true);
      expect(isPermanentEmailAddress("approved@forge.test")).toBe(true);
      expect(isPermanentEmailAddress("developer@unlisted.test")).toBe(false);
      expect(isPermanentEmailAddress("trial@mailinator.com")).toBe(false);
    } finally {
      if (previous === undefined) delete process.env.TOKENFORGE_EMAIL_ALLOWLIST;
      else process.env.TOKENFORGE_EMAIL_ALLOWLIST = previous;
    }
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
