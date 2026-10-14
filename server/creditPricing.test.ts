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
    expect(DAILY_CHECKIN_CREDIT_NANOS).toBe(2 * NANODOLLARS_PER_DOLLAR);
  });

  it("applies the 2.0× platform charge to model-specific input and output settlement in integer nanodollars", () => {
    expect(TOKENFORGE_PLATFORM_CHARGE_MULTIPLIER).toBe(2.0);
    expect(calculateCreditChargeNanos("glm-5.2", 1_000, 500)).toBe(7_200_000);
    expect(calculateCreditChargeNanos("grok-4.5", 1_000, 500)).toBe(10_000_000);
    expect(calculateCreditChargeNanos("deepseek-v4-flash", 1_000, 500)).toBe(560_000);
    expect(calculateCreditChargeNanos("deepseek-v4-pro", 1_000, 500)).toBe(560_000);
    expect(calculateCreditChargeNanos("glm-5.2", -10, 1.9)).toBe(8_800);
  });

  it("publishes final TokenForge credit rates alongside their upstream sources", () => {
    expect(TOKENFORGE_CREDIT_PRICING["glm-5.2"]).toMatchObject({ upstreamInputUsdPerMillion: 1.4, upstreamOutputUsdPerMillion: 4.4, inputUsdPerMillion: 2.8, outputUsdPerMillion: 8.8 });
    expect(TOKENFORGE_CREDIT_PRICING["grok-4.5"]).toMatchObject({ upstreamInputUsdPerMillion: 2, upstreamOutputUsdPerMillion: 6, inputUsdPerMillion: 4, outputUsdPerMillion: 12 });
    expect(TOKENFORGE_CREDIT_PRICING["deepseek-v4-flash"]).toMatchObject({ upstreamInputUsdPerMillion: 0.14, upstreamOutputUsdPerMillion: 0.28, inputUsdPerMillion: 0.28, outputUsdPerMillion: 0.56 });
    expect(TOKENFORGE_CREDIT_PRICING["deepseek-v4-pro"]).toMatchObject({ upstreamInputUsdPerMillion: 0.14, upstreamOutputUsdPerMillion: 0.28, inputUsdPerMillion: 0.28, outputUsdPerMillion: 0.56 });
    expect(TOKENFORGE_CREDIT_PRICING["qwen3.8-27b"]).toMatchObject({ upstreamInputUsdPerMillion: 0.45, upstreamOutputUsdPerMillion: 3.2, inputUsdPerMillion: 0.9, outputUsdPerMillion: 6.4 });
    expect(TOKENFORGE_CREDIT_PRICING["claude-fable-5.1"]).toMatchObject({ upstreamInputUsdPerMillion: 10, upstreamOutputUsdPerMillion: 50, inputUsdPerMillion: 20, outputUsdPerMillion: 100 });
    expect(TOKENFORGE_CREDIT_PRICING["gpt-6-astra"]).toMatchObject({ upstreamInputUsdPerMillion: 15, upstreamOutputUsdPerMillion: 75, inputUsdPerMillion: 15, outputUsdPerMillion: 75 });
    expect(TOKENFORGE_CREDIT_PRICING["claude-opus-5"]).toMatchObject({ upstreamInputUsdPerMillion: 15, upstreamOutputUsdPerMillion: 75, inputUsdPerMillion: 15, outputUsdPerMillion: 75 });
    for (const model of ["claude-opus-4.5", "claude-opus-4.6", "claude-opus-4.7"] as const) {
      expect(TOKENFORGE_CREDIT_PRICING[model]).toMatchObject({ upstreamInputUsdPerMillion: 5, upstreamOutputUsdPerMillion: 25, inputUsdPerMillion: 10, outputUsdPerMillion: 50 });
    }
  });

  it("applies administrator dynamic pricing overrides with exact real rates and 0% platform charge", async () => {
    const { setActivePricingOverrides, getEffectiveModelPricing, calculateCreditChargeNanos } = await import("./creditPricing");
    
    // Set custom rate: $3.50 input / 1M, $12.00 output / 1M (no multiplier)
    setActivePricingOverrides({
      "deepseek-v4-flash": { inputUsdPerMillion: 3.5, outputUsdPerMillion: 12.0 },
    });

    const effective = getEffectiveModelPricing("deepseek-v4-flash");
    expect(effective.isCustom).toBe(true);
    expect(effective.inputUsdPerMillion).toBe(3.5);
    expect(effective.outputUsdPerMillion).toBe(12.0);
    expect(effective.inputNanosPerToken).toBe(3_500);
    expect(effective.outputNanosPerToken).toBe(12_000);

    // Deduction: 1,000 input tokens * 3,500 nanos + 500 output tokens * 12,000 nanos
    // = 3,500,000 + 6,000,000 = 9,500,000 nanos
    const charge = calculateCreditChargeNanos("deepseek-v4-flash", 1_000, 500);
    expect(charge).toBe(9_500_000);

    // Clean up
    setActivePricingOverrides({});
    const restored = getEffectiveModelPricing("deepseek-v4-flash");
    expect(restored.isCustom).toBe(false);
  });

  it("reserves a requested positive safe maximum without imposing a local upper ceiling", () => {
    expect(normalizedBillableMaxOutputTokens()).toBe(1_024);
    expect(normalizedBillableMaxOutputTokens(2_000_000)).toBe(2_000_000);
    expect(normalizedBillableMaxOutputTokens(-1)).toBe(1_024);
    expect(normalizedBillableMaxOutputTokens(Number.MAX_SAFE_INTEGER + 1)).toBe(1_024);
  });
});
