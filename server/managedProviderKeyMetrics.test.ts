import { afterEach, describe, expect, it } from "vitest";
import { MANAGED_PROVIDER_METRIC_MODEL_IDS, managedProviderCredentialFingerprint } from "./db";

describe("managed provider key metrics", () => {
  const originalJwtSecret = process.env.JWT_SECRET;

  afterEach(() => {
    if (originalJwtSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = originalJwtSecret;
  });

  it("uses a stable non-reversible model-scoped credential fingerprint", () => {
    process.env.JWT_SECRET = "test-metrics-vault-secret";
    const credential = "example-server-only-credential";
    const fableFingerprint = managedProviderCredentialFingerprint("claude-fable-5", credential);
    expect(fableFingerprint).toMatch(/^[a-f0-9]{64}$/);
    expect(fableFingerprint).toBe(managedProviderCredentialFingerprint("claude-fable-5", credential));
    expect(fableFingerprint).not.toBe(managedProviderCredentialFingerprint("glm-5.3", credential));
    expect(fableFingerprint).not.toContain(credential);
    expect(MANAGED_PROVIDER_METRIC_MODEL_IDS).toEqual(["claude-fable-5", "claude-opus-5", "glm-5.3", "deepseek-v4-pro"]);
  });
});
