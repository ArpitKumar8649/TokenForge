import { describe, expect, it } from "vitest";
import {
  DAILY_CHECKIN_CREDIT_NANOS,
  INTRODUCTORY_CREDIT_NANOS,
  MAX_BILLABLE_OUTPUT_TOKENS,
  NANODOLLARS_PER_DOLLAR,
  calculateCreditChargeNanos,
  normalizedBillableMaxOutputTokens,
} from "./creditPricing";

describe("TokenForge promotional credit pricing", () => {
  it("keeps introductory and daily rewards as exact non-floating dollar amounts", () => {
    expect(INTRODUCTORY_CREDIT_NANOS).toBe(50 * NANODOLLARS_PER_DOLLAR);
    expect(DAILY_CHECKIN_CREDIT_NANOS).toBe(5 * NANODOLLARS_PER_DOLLAR);
  });

  it("calculates model-specific input and output charges in integer nanodollars", () => {
    expect(calculateCreditChargeNanos("glm-5.2", 1_000, 500)).toBe(3_600_000);
    expect(calculateCreditChargeNanos("grok-4.5", 1_000, 500)).toBe(5_000_000);
    expect(calculateCreditChargeNanos("glm-5.2", -10, 1.9)).toBe(4_400);
  });

  it("bounds a maximum-output reservation before a provider request is attempted", () => {
    expect(normalizedBillableMaxOutputTokens()).toBe(1_024);
    expect(normalizedBillableMaxOutputTokens(MAX_BILLABLE_OUTPUT_TOKENS + 1)).toBe(MAX_BILLABLE_OUTPUT_TOKENS);
    expect(normalizedBillableMaxOutputTokens(-1)).toBe(0);
  });
});
