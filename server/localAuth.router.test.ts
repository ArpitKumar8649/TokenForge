import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";
import type { User } from "../drizzle/schema";

vi.mock("./db", () => ({
  authenticatePasswordUser: vi.fn(),
  clearFailedPasswordLogin: vi.fn(),
  createApiKey: vi.fn(),
  createPasswordUser: vi.fn(),
  getAdminOverview: vi.fn(),
  getPasswordLoginThrottle: vi.fn(),
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
  clearFailedPasswordLogin,
  createPasswordUser,
  getPasswordLoginThrottle,
  listApiKeys,
  recordFailedPasswordLogin,
} from "./db";
import { appRouter } from "./routers";
import { COOKIE_NAME } from "../shared/const";
import { LOGIN_FAILURE_LIMIT, nextFailedLoginState, retryAfterSeconds, type LoginAttemptState } from "./localAuth";

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
});
