import { describe, it, expect, beforeEach } from "vitest";
import {
  getBaiConsecutiveFailures,
  recordBaiFailure,
  recordBaiSuccess,
  resetBaiConsecutiveFailures,
} from "./openaiGateway";
import { isBaiProviderCircuitEligible, toBaiProviderCircuitStatus } from "./db";

describe("b.ai routing and circuit breaker removal", () => {
  beforeEach(() => {
    resetBaiConsecutiveFailures();
  });

  it("always marks b.ai provider circuit as eligible regardless of previous rate limits", async () => {
    const eligible = await isBaiProviderCircuitEligible("b-ai-test");
    expect(eligible).toBe(true);
  });

  it("tracks consecutive b.ai failures and allows fallback after threshold (>3)", () => {
    expect(getBaiConsecutiveFailures()).toBe(0);
    recordBaiFailure("bai-1");
    expect(getBaiConsecutiveFailures()).toBe(1);
    expect(getBaiConsecutiveFailures("bai-1")).toBe(1);

    recordBaiFailure("bai-1");
    recordBaiFailure("bai-1");
    expect(getBaiConsecutiveFailures()).toBe(3);
    // At 3, not exceeding 3 yet
    expect(getBaiConsecutiveFailures() > 3).toBe(false);

    recordBaiFailure("bai-1");
    expect(getBaiConsecutiveFailures()).toBe(4);
    // Exceeds 3, triggers failover
    expect(getBaiConsecutiveFailures() > 3).toBe(true);

    // On success, reset to 0
    recordBaiSuccess("bai-1");
    expect(getBaiConsecutiveFailures()).toBe(0);
    expect(getBaiConsecutiveFailures("bai-1")).toBe(0);
    expect(getBaiConsecutiveFailures() > 3).toBe(false);
  });
});
