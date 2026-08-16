import { describe, expect, it } from "vitest";
import {
  DAILY_CHECKIN_CREDIT_NANOS,
  INTRODUCTORY_CREDIT_NANOS,
  NANODOLLARS_PER_DOLLAR,
  TOKENFORGE_CREDIT_PRICING,
  TOKENFORGE_PLATFORM_CHARGE_MULTIPLIER,
  calculateCreditChargeNanos,
  normalizedBillableMaxOutputTokens,
} from "./creditPricing";

describe("TokenForge promotional credit pricing", () => {
  it("keeps introductory and daily rewards as exact non-floating dollar amounts", () => {
    expect(INTRODUCTORY_CREDIT_NANOS).toBe(50 * NANODOLLARS_PER_DOLLAR);
    expect(DAILY_CHECKIN_CREDIT_NANOS).toBe(5 * NANODOLLARS_PER_DOLLAR);
  });

  it("applies the 1.5× platform charge to model-specific input and output settlement in integer nanodollars", () => {
    expect(TOKENFORGE_PLATFORM_CHARGE_MULTIPLIER).toBe(1.5);
    expect(calculateCreditChargeNanos("glm-5.2", 1_000, 500)).toBe(5_400_000);
    expect(calculateCreditChargeNanos("grok-4.5", 1_000, 500)).toBe(7_500_000);
    expect(calculateCreditChargeNanos("deepseek-v4-flash", 1_000, 500)).toBe(420_000);
    expect(calculateCreditChargeNanos("deepseek-v4-pro", 1_000, 500)).toBe(420_000);
    expect(calculateCreditChargeNanos("glm-5.2", -10, 1.9)).toBe(6_600);
  });

  it("publishes final TokenForge credit rates alongside their upstream sources", () => {
    expect(TOKENFORGE_CREDIT_PRICING["glm-5.2"]).toMatchObject({ upstreamInputUsdPerMillion: 1.4, upstreamOutputUsdPerMillion: 4.4, inputUsdPerMillion: 2.1, outputUsdPerMillion: 6.6 });
    expect(TOKENFORGE_CREDIT_PRICING["grok-4.5"]).toMatchObject({ upstreamInputUsdPerMillion: 2, upstreamOutputUsdPerMillion: 6, inputUsdPerMillion: 3, outputUsdPerMillion: 9 });
    expect(TOKENFORGE_CREDIT_PRICING["deepseek-v4-flash"]).toMatchObject({ upstreamInputUsdPerMillion: 0.14, upstreamOutputUsdPerMillion: 0.28, inputUsdPerMillion: 0.21, outputUsdPerMillion: 0.42 });
    expect(TOKENFORGE_CREDIT_PRICING["deepseek-v4-pro"]).toMatchObject({ upstreamInputUsdPerMillion: 0.14, upstreamOutputUsdPerMillion: 0.28, inputUsdPerMillion: 0.21, outputUsdPerMillion: 0.42 });
    expect(TOKENFORGE_CREDIT_PRICING["qwen3.8-27b"]).toMatchObject({ upstreamInputUsdPerMillion: 0.45, upstreamOutputUsdPerMillion: 3.2, inputUsdPerMillion: 0.675, outputUsdPerMillion: 4.8 });
  });

  it("reserves a requested positive safe maximum without imposing a local upper ceiling", () => {
    expect(normalizedBillableMaxOutputTokens()).toBe(1_024);
    expect(normalizedBillableMaxOutputTokens(2_000_000)).toBe(2_000_000);
    expect(normalizedBillableMaxOutputTokens(-1)).toBe(1_024);
    expect(normalizedBillableMaxOutputTokens(Number.MAX_SAFE_INTEGER + 1)).toBe(1_024);
  });
});
