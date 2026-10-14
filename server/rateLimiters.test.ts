import { describe, expect, it, beforeEach } from "vitest";
import { checkAccountRateLimit, resetAccountRateLimit } from "./rateLimiters";
import { findActiveApiKey, clearApiKeyCache } from "./db";

describe("Rate Limiters & API Key Cache Safeguards", () => {
  beforeEach(() => {
    resetAccountRateLimit();
    clearApiKeyCache();
  });

  it("permits requests within the account limit and throttles when limit is exceeded", () => {
    const testUserId = 9999;
    const testLimit = 5;

    for (let i = 0; i < testLimit; i++) {
      const check = checkAccountRateLimit(testUserId, testLimit);
      expect(check.allowed).toBe(true);
      expect(check.remaining).toBe(testLimit - i - 1);
    }

    // Next request should be blocked
    const throttled = checkAccountRateLimit(testUserId, testLimit);
    expect(throttled.allowed).toBe(false);
    expect(throttled.remaining).toBe(0);
    expect(throttled.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("isolates rate limit tracking between distinct user accounts", () => {
    const userA = 1001;
    const userB = 1002;
    const testLimit = 3;

    for (let i = 0; i < testLimit; i++) {
      expect(checkAccountRateLimit(userA, testLimit).allowed).toBe(true);
    }

    // userA is now throttled
    expect(checkAccountRateLimit(userA, testLimit).allowed).toBe(false);

    // userB should still be completely unthrottled
    expect(checkAccountRateLimit(userB, testLimit).allowed).toBe(true);
  });

  it("handles empty or invalid API keys quickly without error", async () => {
    await expect(findActiveApiKey("")).resolves.toBeNull();
    await expect(findActiveApiKey("   ")).resolves.toBeNull();
    await expect(findActiveApiKey(null as any)).resolves.toBeNull();
  });
});
