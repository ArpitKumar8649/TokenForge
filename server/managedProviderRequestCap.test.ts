import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  CAPPED_MANAGED_PROVIDER_METRIC_MODEL_IDS,
  MANAGED_PROVIDER_KEY_REQUEST_CAP,
  isCappedManagedProviderMetricModel,
  isManagedProviderKeyRetired,
} from "./db";

const dbSource = readFileSync(new URL("./db.ts", import.meta.url), "utf8");
const gatewaySource = readFileSync(new URL("./openaiGateway.ts", import.meta.url), "utf8");

describe("managed GLM and DeepSeek provider request cap", () => {
  it("caps only GLM 5.3 and DeepSeek V4 Pro at exactly 82 requests per credential", () => {
    expect(CAPPED_MANAGED_PROVIDER_METRIC_MODEL_IDS).toEqual(["glm-5.3", "deepseek-v4-pro"]);
    expect(MANAGED_PROVIDER_KEY_REQUEST_CAP).toBe(82);
    expect(isCappedManagedProviderMetricModel("glm-5.3")).toBe(true);
    expect(isCappedManagedProviderMetricModel("deepseek-v4-pro")).toBe(true);
    expect(isCappedManagedProviderMetricModel("claude-fable-5")).toBe(false);
    expect(isManagedProviderKeyRetired("glm-5.3", 81)).toBe(false);
    expect(isManagedProviderKeyRetired("glm-5.3", 82)).toBe(true);
    expect(isManagedProviderKeyRetired("deepseek-v4-pro", 99)).toBe(true);
  });

  it("uses an atomic guarded increment, disables a fully capped model, and does not count its outcome twice", () => {
    const reservation = dbSource.slice(dbSource.indexOf("export async function reserveCappedManagedProviderCredentialRequest"), dbSource.indexOf("export async function getManagedProviderKeyMetrics"));
    expect(reservation).toContain("lt(providerKeyMetrics.requestCount, MANAGED_PROVIDER_KEY_REQUEST_CAP)");
    expect(reservation).toContain("activeFingerprints.every");
    expect(reservation).toContain("set({ enabled: false })");
    expect(reservation).toContain("return { allowed, exhausted }");

    const failover = gatewaySource.slice(gatewaySource.indexOf("async function forwardWithCredentialFailover"), gatewaySource.indexOf("async function forwardFxqidianRequest"));
    expect(failover).toContain("reserveCappedManagedProviderCredentialRequest");
    expect(failover).toContain('new TokenForgePlaygroundError("model_unavailable"');
    expect(failover).toContain("!isCappedManagedProviderMetricModel(managedMetricModel)");
  });
});
