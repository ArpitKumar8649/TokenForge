import { describe, expect, it } from "vitest";
import {
  hashPassword,
  LOGIN_BLOCK_MS,
  LOGIN_FAILURE_LIMIT,
  nextFailedLoginState,
  normalizeEmail,
  PASSWORD_MIN_LENGTH,
  retryAfterSeconds,
  verifyPassword,
} from "./localAuth";

describe("local password authentication", () => {
  it("normalizes account emails before lookup", () => {
    expect(normalizeEmail("  Ada@Example.COM ")).toBe("ada@example.com");
  });

  it("stores a salted one-way scrypt derivation and verifies only the matching password", async () => {
    const password = "forge-a-secure-password";
    const first = await hashPassword(password);
    const second = await hashPassword(password);

    expect(first).toMatch(/^scrypt\$16384\$8\$1\$/);
    expect(first).not.toContain(password);
    expect(first).not.toBe(second);
    await expect(verifyPassword(password, first)).resolves.toBe(true);
    await expect(verifyPassword("not-the-password", first)).resolves.toBe(false);
  });

  it("rejects malformed stored credential strings and documents the minimum password length", async () => {
    expect(PASSWORD_MIN_LENGTH).toBe(12);
    await expect(verifyPassword("anything", "not-a-password-record")).resolves.toBe(false);
  });

  it("blocks repeated failed sign-ins in a bounded time window without retaining the password", () => {
    const now = new Date("2026-08-14T00:00:00.000Z");
    let state = null;
    for (let attempt = 0; attempt < LOGIN_FAILURE_LIMIT; attempt += 1) {
      state = nextFailedLoginState(state, now);
    }

    expect(state?.failureCount).toBe(LOGIN_FAILURE_LIMIT);
    expect(state?.blockedUntil?.getTime()).toBe(now.getTime() + LOGIN_BLOCK_MS);
    expect(retryAfterSeconds(state?.blockedUntil ?? null, now)).toBe(LOGIN_BLOCK_MS / 1000);
  });
});
