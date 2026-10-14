import { describe, expect, it } from "vitest";
import { normalizeAdminCreditGrantAmount } from "./db";

describe("normalizeAdminCreditGrantAmount", () => {
  it("converts whole and decimal USD grants to exact nanodollars", () => {
    expect(normalizeAdminCreditGrantAmount(50)).toBe(50_000_000_000);
    expect(normalizeAdminCreditGrantAmount(12.34)).toBe(12_340_000_000);
  });

  it("rejects invalid, zero, negative, and excessive credit grants", () => {
    expect(normalizeAdminCreditGrantAmount(0)).toBeNull();
    expect(normalizeAdminCreditGrantAmount(-5)).toBeNull();
    expect(normalizeAdminCreditGrantAmount(Number.NaN)).toBeNull();
    expect(normalizeAdminCreditGrantAmount(100_000.01)).toBeNull();
  });
});
