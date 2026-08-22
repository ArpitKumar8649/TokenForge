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

describe("managed provider request caps", () => {
  it("keeps the 82-request retirement policy only for GLM 5.3 and leaves DeepSeek V4 Pro uncapped", () => {
    expect(CAPPED_MANAGED_PROVIDER_METRIC_MODEL_IDS).toEqual(["glm-5.3"]);
    expect(MANAGED_PROVIDER_KEY_REQUEST_CAP).toBe(82);
    expect(isCappedManagedProviderMetricModel("glm-5.3")).toBe(true);
    expect(isCappedManagedProviderMetricModel("deepseek-v4-pro")).toBe(false);
    expect(isCappedManagedProviderMetricModel("claude-fable-5")).toBe(false);
    expect(isManagedProviderKeyRetired("glm-5.3", 81)).toBe(false);
    expect(isManagedProviderKeyRetired("glm-5.3", 82)).toBe(true);
    expect(isManagedProviderKeyRetired("deepseek-v4-pro", 99)).toBe(false);
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
