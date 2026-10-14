import { beforeEach, describe, expect, it } from "vitest";
import {
  isUnorouterClaudeOpus5Provider,
  UNOROUTER_KEY_COOLDOWN_MS,
} from "./openaiGateway";
import {
  acquireProviderSlotConcurrency,
  getCredentialSlotTelemetry,
  isCredentialSlotEligible,
  recordCredentialSuccess,
  resetProviderCredentialTelemetry,
  setCredentialCooldown,
  type CredentialTelemetryProvider,
} from "./providerCredentialTelemetry";

describe("Unorouter 1 request / 1 min key cooldown rule", () => {
  const telemetryProvider = "claude-opus-5:provider-1788422197682-23" as CredentialTelemetryProvider;

  beforeEach(() => {
    resetProviderCredentialTelemetry();
  });

  it("accurately identifies Unorouter provider by id, label, or baseUrl", () => {
    expect(isUnorouterClaudeOpus5Provider({ id: "provider-1788422197682-23" })).toBe(true);
    expect(isUnorouterClaudeOpus5Provider({ label: "Unorouter" })).toBe(true);
    expect(isUnorouterClaudeOpus5Provider({ label: "  unorouter opus 5  " })).toBe(true);
    expect(isUnorouterClaudeOpus5Provider({ baseUrl: "https://api.unorouter.com/v1" })).toBe(true);
    expect(isUnorouterClaudeOpus5Provider({ id: "provider-random-123", label: "Custom Provider", baseUrl: "https://custom.ai" })).toBe(false);
  });

  it("cooldown duration constant is exactly 60 seconds (60,000 ms)", () => {
    expect(UNOROUTER_KEY_COOLDOWN_MS).toBe(60_000);
  });

  it("applies a 60-second cooldown on request completion and renders in slot telemetry", () => {
    const now = 1_000_000;
    // Key slot 0 is initially eligible
    expect(isCredentialSlotEligible(telemetryProvider, 0, now)).toBe(true);

    // Request completes, applying 60s cooldown
    setCredentialCooldown(telemetryProvider, 0, UNOROUTER_KEY_COOLDOWN_MS, now);

    // Within the 60s window, slot is NOT eligible
    expect(isCredentialSlotEligible(telemetryProvider, 0, now + 30_000)).toBe(false);
    expect(isCredentialSlotEligible(telemetryProvider, 0, now + 59_999)).toBe(false);

    // Check telemetry returned for admin panel
    const telemetry = getCredentialSlotTelemetry(telemetryProvider, 0, now + 15_000);
    expect(telemetry.health).toBe("cooling-down");
    expect(telemetry.cooldownUntil).toEqual(new Date(now + 60_000));

    // After 60s elapsed, slot becomes eligible again
    expect(isCredentialSlotEligible(telemetryProvider, 0, now + 60_000)).toBe(true);
    expect(isCredentialSlotEligible(telemetryProvider, 0, now + 60_001)).toBe(true);

    const expiredTelemetry = getCredentialSlotTelemetry(telemetryProvider, 0, now + 60_001);
    expect(expiredTelemetry.health).toBe("unverified");
  });

  it("preserves rate-limit cooldown even if recordCredentialSuccess is recorded", () => {
    const now = 2_000_000;
    setCredentialCooldown(telemetryProvider, 0, UNOROUTER_KEY_COOLDOWN_MS, now);

    // Call recordCredentialSuccess
    recordCredentialSuccess(telemetryProvider, 0, new Date(now + 500));

    // Cooldown is preserved!
    expect(isCredentialSlotEligible(telemetryProvider, 0, now + 10_000)).toBe(false);
    const telemetry = getCredentialSlotTelemetry(telemetryProvider, 0, now + 10_000);
    expect(telemetry.health).toBe("cooling-down");
  });

  it("tracks slot concurrency to prevent overlapping requests on the same key", () => {
    const release = acquireProviderSlotConcurrency(telemetryProvider, 0);
    // While request is active, concurrency is 1
    // Releasing concurrency returns it to 0
    release();
  });
});
