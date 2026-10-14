import { describe, expect, it } from "vitest";
import {
  MAX_DEEPSEEK_V4PRO_PROVIDERS,
  MAX_SONNET46_PROVIDERS,
  setAllUsersCreditBalance,
  isTestExecutionEnvironment,
} from "./db";

describe("Provider Limits and Bulk Credit Safety", () => {
  it("should have provider cap constants set to 100", () => {
    expect(MAX_DEEPSEEK_V4PRO_PROVIDERS).toBe(100);
    expect(MAX_SONNET46_PROVIDERS).toBe(100);
  });

  it("should detect test execution environment", () => {
    expect(isTestExecutionEnvironment()).toBe(true);
  });

  it("should permanently block setAllUsersCreditBalance from executing during tests to protect user balances", async () => {
    // Calling setAllUsersCreditBalance during any test run must immediately throw
    // a security lock error and never mutate user credit accounts.
    await expect(
      setAllUsersCreditBalance({
        targetAmountNanos: 75_500_000_000,
        actorUserId: 1,
        note: "Bulk test credit set",
      })
    ).rejects.toThrow("SECURITY_LOCK_TRIGGERED");
  });
});


