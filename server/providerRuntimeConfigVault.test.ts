import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { decryptProviderRuntimeConfig, encryptProviderRuntimeConfig } from "./providerRuntimeConfigVault";

describe("provider runtime configuration vault", () => {
  const originalSecret = process.env.JWT_SECRET;

  beforeEach(() => {
    process.env.JWT_SECRET = "provider-runtime-vault-test-secret";
  });

  afterEach(() => {
    process.env.JWT_SECRET = originalSecret;
  });

  it("encrypts complete provider settings without retaining plaintext and round-trips only server-side", () => {
    const settings = {
      baseUrl: "https://integrate.api.nvidia.com",
      model: "z-ai/glm-5.2",
      apiKeys: ["sk-test-runtime-provider-key-1", "sk-test-runtime-provider-key-2"],
    };
    const encrypted = encryptProviderRuntimeConfig(settings);

    expect(JSON.stringify(encrypted)).not.toContain(settings.apiKeys[0]);
    expect(JSON.stringify(encrypted)).not.toContain(settings.baseUrl);
    expect(decryptProviderRuntimeConfig(encrypted)).toEqual(settings);
  });

  it("uses authenticated encryption with a fresh nonce for each write", () => {
    const settings = { baseUrl: "https://provider.example", model: "example-model", apiKeys: ["sk-example"] };
    const first = encryptProviderRuntimeConfig(settings);
    const second = encryptProviderRuntimeConfig(settings);

    expect(first.iv).not.toBe(second.iv);
    expect(first.ciphertext).not.toBe(second.ciphertext);
  });
});
