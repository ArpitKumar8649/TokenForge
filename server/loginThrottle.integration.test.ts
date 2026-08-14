import { afterEach, describe, expect, it } from "vitest";
import type { TrpcContext } from "./_core/context";
import { clearFailedPasswordLogin, getPasswordLoginThrottle } from "./db";
import { LOGIN_FAILURE_LIMIT } from "./localAuth";
import { appRouter } from "./routers";

const email = `throttle-${process.pid}@tokenforge.invalid`;
const password = "not-the-real-password";

function anonymousContext(): TrpcContext {
  return {
    user: null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { cookie: () => undefined, clearCookie: () => undefined } as TrpcContext["res"],
  };
}

afterEach(async () => {
  await clearFailedPasswordLogin(email);
});

describe("persisted first-party sign-in throttle", () => {
  it("moves real stored failures from generic rejection to a retry-guidance response at the configured boundary", async () => {
    await clearFailedPasswordLogin(email);
    const caller = appRouter.createCaller(anonymousContext());

    for (let attempt = 0; attempt < LOGIN_FAILURE_LIMIT - 1; attempt += 1) {
      await expect(caller.auth.login({ email, password })).rejects.toMatchObject({ code: "UNAUTHORIZED", message: "Incorrect email or password" });
    }

    await expect(caller.auth.login({ email, password })).rejects.toMatchObject({
      code: "TOO_MANY_REQUESTS",
      message: expect.stringMatching(/^Too many sign-in attempts\. Try again in \d+ seconds\.$/),
    });
    await expect(getPasswordLoginThrottle(email)).resolves.toMatchObject({ blocked: true });
  }, 20_000);
});
