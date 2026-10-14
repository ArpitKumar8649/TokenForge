import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import { upsertUser, getUserByEmail, preProvisionAccountEmail } from "./db";
import { COOKIE_NAME } from "@shared/const";

describe("auth.verifyEmailLogin router endpoint", () => {
  it("authenticates existing user and creates session token", async () => {
    const testEmail = `test_existing_dev_login_${Date.now()}@gmail.com`;
    await upsertUser({
      openId: `tf_gh_test_email_verify_${Date.now()}`,
      email: testEmail,
      name: "Existing Verified Dev",
      loginMethod: "github",
      role: "user",
      lastSignedIn: new Date(),
    });

    let setCookieName = "";
    let setCookieVal = "";

    const caller = appRouter.createCaller({
      user: null,
      req: { protocol: "https", headers: {}, hostname: "localhost" } as any,
      res: {
        cookie: (name: string, val: string) => {
          setCookieName = name;
          setCookieVal = val;
        },
        clearCookie: () => {},
      } as any,
    });

    const result = await caller.auth.verifyEmailLogin({ email: testEmail });
    expect(result.success).toBe(true);
    expect(result.sessionToken).toBeTruthy();
    expect(result.user.email).toBe(testEmail);
    expect(setCookieName).toBe(COOKIE_NAME);
    expect(setCookieVal).toBe(result.sessionToken);
  });

  it("rejects unregistered email when not authorized by admin", async () => {
    const unregisteredEmail = `unregistered_dev_${Date.now()}@gmail.com`;

    const caller = appRouter.createCaller({
      user: null,
      req: { protocol: "https", headers: {}, hostname: "localhost" } as any,
      res: {
        cookie: () => {},
        clearCookie: () => {},
      } as any,
    });

    await expect(
      caller.auth.verifyEmailLogin({ email: unregisteredEmail })
    ).rejects.toThrow("Email not registered. Please contact administrator to get access.");

    const userInDb = await getUserByEmail(unregisteredEmail);
    expect(userInDb).toBeUndefined();
  });

  it("grants access to an email that was authorized / pre-provisioned by an administrator", async () => {
    const adminEmail = `admin_tester_${Date.now()}@gmail.com`;
    const adminOpenId = `admin_tester_${Date.now()}`;
    await upsertUser({
      openId: adminOpenId,
      email: adminEmail,
      name: "Admin Tester",
      loginMethod: "email",
      role: "admin",
      lastSignedIn: new Date(),
    });

    const adminUser = await getUserByEmail(adminEmail);
    expect(adminUser).toBeDefined();

    const authorizedEmail = `admin_authorized_${Date.now()}@gmail.com`;
    
    // Admin pre-provisions / authorizes the email
    await preProvisionAccountEmail({
      email: authorizedEmail,
      provisionedByUserId: adminUser!.id,
    });

    let setCookieName = "";
    let setCookieVal = "";

    const caller = appRouter.createCaller({
      user: null,
      req: { protocol: "https", headers: {}, hostname: "localhost" } as any,
      res: {
        cookie: (name: string, val: string) => {
          setCookieName = name;
          setCookieVal = val;
        },
        clearCookie: () => {},
      } as any,
    });

    // User types their email in the verify box -> gets access!
    const result = await caller.auth.verifyEmailLogin({ email: authorizedEmail });
    expect(result.success).toBe(true);
    expect(result.sessionToken).toBeTruthy();
    expect(result.user.email).toBe(authorizedEmail);
    expect(setCookieName).toBe(COOKIE_NAME);
    expect(setCookieVal).toBe(result.sessionToken);

    const userInDb = await getUserByEmail(authorizedEmail);
    expect(userInDb).toBeDefined();
    expect(userInDb?.email).toBe(authorizedEmail);
  });

  describe("auth.sendOtp smart direct-access vs OTP routing", () => {
    it("gives direct access without OTP for users already in the database", async () => {
      const existingEmail = `existing_dev_${Date.now()}@gmail.com`;
      await upsertUser({
        openId: `tf_existing_${Date.now()}`,
        email: existingEmail,
        name: "Existing TokenForge Dev",
        loginMethod: "email_otp",
        role: "user",
        lastSignedIn: new Date(),
      });

      let setCookieName = "";
      let setCookieVal = "";

      const caller = appRouter.createCaller({
        user: null,
        req: { protocol: "https", headers: {}, hostname: "localhost" } as any,
        res: {
          cookie: (name: string, val: string) => {
            setCookieName = name;
            setCookieVal = val;
          },
          clearCookie: () => {},
        } as any,
      });

      const result = await caller.auth.sendOtp({ email: existingEmail });
      expect(result.directLogin).toBe(true);
      if (result.directLogin) {
        expect(result.sessionToken).toBeTruthy();
        expect(result.user.email).toBe(existingEmail);
        expect(setCookieName).toBe(COOKIE_NAME);
        expect(setCookieVal).toBe(result.sessionToken);
      }
    });
  });
});
