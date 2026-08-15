import { beforeEach, describe, expect, it } from "vitest";
import { getProviderCredentialTelemetry, isCredentialSlotEligible, recordCredentialFailover, recordCredentialFailure, recordCredentialSuccess, resetProviderCredentialTelemetry } from "./providerCredentialTelemetry";
import { FXQIDIAN_PROVIDER_SLUG } from "./modelCatalogue";

describe("provider credential telemetry", () => {
  beforeEach(() => resetProviderCredentialTelemetry());

  it("tracks anonymous slot health, cooldown, recovery, and failovers without retaining credentials", () => {
    const now = 1_000_000;
    expect(isCredentialSlotEligible(FXQIDIAN_PROVIDER_SLUG, 0, now)).toBe(true);
    recordCredentialFailure(FXQIDIAN_PROVIDER_SLUG, 0, now);
    recordCredentialFailover(FXQIDIAN_PROVIDER_SLUG);

    const degraded = getProviderCredentialTelemetry({ [FXQIDIAN_PROVIDER_SLUG]: 2 }, now + 1).find(item => item.providerSlug === FXQIDIAN_PROVIDER_SLUG)!;
    expect(degraded).toMatchObject({ poolSize: 2, healthySlots: 1, coolingDownSlots: 1, failoverCount: 1 });
    expect(JSON.stringify(degraded)).not.toContain("credential");

    recordCredentialSuccess(FXQIDIAN_PROVIDER_SLUG, 0, new Date(now + 2));
    expect(getProviderCredentialTelemetry({ [FXQIDIAN_PROVIDER_SLUG]: 2 }, now + 3).find(item => item.providerSlug === FXQIDIAN_PROVIDER_SLUG)).toMatchObject({ healthySlots: 2, coolingDownSlots: 0, failoverCount: 1 });
  });
});
