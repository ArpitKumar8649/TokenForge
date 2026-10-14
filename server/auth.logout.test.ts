import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import { COOKIE_NAME } from "../shared/const";
import { TOKENFORGE_POST_LOGOUT_PATH } from "../shared/authNavigation";
import type { TrpcContext } from "./_core/context";
import { extractSessionTokenFromRequest, isSessionTokenRevoked, sdk } from "./_core/sdk";
import { createContext } from "./_core/context";
import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";

type CookieCall = {
  name: string;
  options: Record<string, unknown>;
};

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(options: {
  cookieHeader?: string;
  authHeader?: string;
} = {}): { ctx: TrpcContext; clearedCookies: CookieCall[] } {
  const clearedCookies: CookieCall[] = [];

  const user: AuthenticatedUser = {
    id: 1,
    openId: "sample-user",
    email: "sample@example.com",
    name: "Sample User",
    loginMethod: "manus",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  const headers: Record<string, string> = {};
  if (options.cookieHeader) {
    headers["cookie"] = options.cookieHeader;
  }
  if (options.authHeader) {
    headers["authorization"] = options.authHeader;
  }

  const ctx: TrpcContext = {
    user,
    req: {
      protocol: "https",
      headers,
    } as unknown as TrpcContext["req"],
    res: {
      clearCookie: (name: string, options: Record<string, unknown>) => {
        clearedCookies.push({ name, options });
      },
    } as unknown as TrpcContext["res"],
  };

  return { ctx, clearedCookies };
}

describe("auth.logout", () => {
  it("uses the public landing page as the client post-logout destination", () => {
    expect(TOKENFORGE_POST_LOGOUT_PATH).toBe("/");
  });

  it("clears the session cookie and reports success with exact matching options", async () => {
    const { ctx, clearedCookies } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.auth.logout();

    expect(result).toEqual({ success: true });
    expect(clearedCookies).toHaveLength(1);
    expect(clearedCookies[0]?.name).toBe(COOKIE_NAME);
    expect(clearedCookies[0]?.options).toMatchObject({
      maxAge: -1,
      secure: true,
      sameSite: "lax",
      httpOnly: true,
      path: "/",
    });
  });

  it("extracts and revokes session token from cookie during logout, and fails authentication immediately", async () => {
    const validToken = await sdk.createSessionToken("user-revoke-cookie-test", {
      name: "Revoke Cookie Test User",
    });

    const cookieHeader = `${COOKIE_NAME}=${validToken}`;
    const { ctx, clearedCookies } = createAuthContext({ cookieHeader });
    const caller = appRouter.createCaller(ctx);

    expect(isSessionTokenRevoked(validToken)).toBe(false);

    // Call logout
    const result = await caller.auth.logout();
    expect(result).toEqual({ success: true });

    // Token must be immediately revoked in server memory
    expect(isSessionTokenRevoked(validToken)).toBe(true);

    // Any subsequent request attempting to authenticate with this old token in cookie fails immediately
    const mockReq = {
      protocol: "https",
      headers: { cookie: cookieHeader },
    } as unknown as CreateExpressContextOptions["req"];
    const mockRes = { clearCookie: () => {} } as unknown as CreateExpressContextOptions["res"];

    const subsequentContext = await createContext({ req: mockReq, res: mockRes });
    expect(subsequentContext.user).toBeNull();

    // Calling auth.me with the revoked token returns null (or 401 if calling protected procedure)
    const subsequentCaller = appRouter.createCaller(subsequentContext);
    const meResult = await subsequentCaller.auth.me();
    expect(meResult).toBeNull();
  });

  it("extracts and revokes session token from Authorization: Bearer header during logout", async () => {
    const validToken = await sdk.createSessionToken("user-revoke-bearer-test", {
      name: "Revoke Bearer Test User",
    });

    const authHeader = `Bearer ${validToken}`;
    const { ctx } = createAuthContext({ authHeader });
    const caller = appRouter.createCaller(ctx);

    expect(isSessionTokenRevoked(validToken)).toBe(false);

    // Call logout
    const result = await caller.auth.logout();
    expect(result).toEqual({ success: true });

    // Token must be immediately revoked
    expect(isSessionTokenRevoked(validToken)).toBe(true);

    // Calling createContext with this old token in Authorization header fails immediately
    const mockReq = {
      protocol: "https",
      headers: { authorization: authHeader },
    } as unknown as CreateExpressContextOptions["req"];
    const mockRes = { clearCookie: () => {} } as unknown as CreateExpressContextOptions["res"];

    const subsequentContext = await createContext({ req: mockReq, res: mockRes });
    expect(subsequentContext.user).toBeNull();

    const subsequentCaller = appRouter.createCaller(subsequentContext);
    const meResult = await subsequentCaller.auth.me();
    expect(meResult).toBeNull();
  });

  it("extractSessionTokenFromRequest extracts cookie first then Authorization header", () => {
    const req1 = {
      headers: {
        cookie: `${COOKIE_NAME}=token-from-cookie`,
        authorization: "Bearer token-from-header",
      },
    } as any;
    expect(extractSessionTokenFromRequest(req1)).toBe("token-from-cookie");

    const req2 = {
      headers: {
        authorization: "Bearer token-from-header",
      },
    } as any;
    expect(extractSessionTokenFromRequest(req2)).toBe("token-from-header");
  });
});

