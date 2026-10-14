import { beforeEach, describe, expect, it } from "vitest";
import { clearProviderCredentialTelemetryGroup, getCredentialSlotTelemetry, getProviderCredentialTelemetry, isCredentialSlotEligible, recordCredentialFailover, recordCredentialFailure, recordCredentialSuccess, resetProviderCredentialTelemetry } from "./providerCredentialTelemetry";
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
    expect(degraded.slots).toEqual(expect.arrayContaining([expect.objectContaining({ slot: 1, health: "cooling-down" }), expect.objectContaining({ slot: 2, health: "unverified" })]));
    expect(JSON.stringify(degraded)).not.toContain("credential");

    recordCredentialSuccess(FXQIDIAN_PROVIDER_SLUG, 0, new Date(now + 2));
    const recovered = getProviderCredentialTelemetry({ [FXQIDIAN_PROVIDER_SLUG]: 2 }, now + 3).find(item => item.providerSlug === FXQIDIAN_PROVIDER_SLUG)!;
    expect(recovered).toMatchObject({ healthySlots: 2, coolingDownSlots: 0, failoverCount: 1 });
    expect(recovered.slots[0]).toMatchObject({ slot: 1, health: "healthy" });
  });

  it("clears only the deleted dynamic provider group's transient slots and failovers", () => {
    const now = 2_000_000;
    recordCredentialFailure("claude-opus-5:removed-provider", 0, now);
    recordCredentialFailover("claude-opus-5:removed-provider");
    recordCredentialSuccess("claude-opus-5:remaining-provider", 0, new Date(now));

    clearProviderCredentialTelemetryGroup("claude-opus-5:removed-provider");

    expect(getCredentialSlotTelemetry("claude-opus-5:removed-provider", 0, now + 1)).toMatchObject({ health: "unverified", cooldownUntil: null, lastSuccessAt: null, lastFailureAt: null });
    expect(getCredentialSlotTelemetry("claude-opus-5:remaining-provider", 0, now + 1)).toMatchObject({ health: "healthy" });
  });
});
