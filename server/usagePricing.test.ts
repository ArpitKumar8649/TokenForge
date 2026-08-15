import { calculateCreditChargeNanos, TOKENFORGE_CREDIT_PRICING } from "./creditPricing";
import { calculateSettledUsagePricingBreakdownNanos } from "../shared/usagePricing";
import { describe, expect, it } from "vitest";

describe("settled usage pricing transparency", () => {
  it("separates the GLM provider cost from TokenForge's exact 1.5× markup", () => {
    const pricing = TOKENFORGE_CREDIT_PRICING["glm-5.2"];
    const finalCreditDeductionNanos = calculateCreditChargeNanos("glm-5.2", 1_000, 500);
    expect(calculateSettledUsagePricingBreakdownNanos({ inputTokens: 1_000, outputTokens: 500, upstreamInputUsdPerMillion: pricing.upstreamInputUsdPerMillion, upstreamOutputUsdPerMillion: pricing.upstreamOutputUsdPerMillion, finalCreditDeductionNanos })).toEqual({ providerBaseNanos: 3_600_000, platformChargeNanos: 1_800_000, finalCreditDeductionNanos: 5_400_000 });
  });

  it("uses integer nanodollars and never produces a negative platform-charge line", () => {
    const pricing = TOKENFORGE_CREDIT_PRICING["deepseek-v4-flash"];
    expect(calculateSettledUsagePricingBreakdownNanos({ inputTokens: 1_000, outputTokens: 500, upstreamInputUsdPerMillion: pricing.upstreamInputUsdPerMillion, upstreamOutputUsdPerMillion: pricing.upstreamOutputUsdPerMillion, finalCreditDeductionNanos: 420_000 })).toEqual({ providerBaseNanos: 280_000, platformChargeNanos: 140_000, finalCreditDeductionNanos: 420_000 });
    expect(calculateSettledUsagePricingBreakdownNanos({ inputTokens: -1, outputTokens: 1.9, upstreamInputUsdPerMillion: 1, upstreamOutputUsdPerMillion: 1, finalCreditDeductionNanos: -9 })).toEqual({ providerBaseNanos: 1_000, platformChargeNanos: 0, finalCreditDeductionNanos: 0 });
  });
});
