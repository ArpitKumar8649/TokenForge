import { describe, expect, it } from "vitest";
import {
  getUniversalModelRuntimeConfig,
  getUniversalModelProviderSettings,
  updateUniversalModelProviderSettings,
  getUniversalModelKeyMetricGroup,
  listUniversalConfiguredModels,
} from "./universalModelProviders";
import { recordManagedProviderKeyOutcome } from "./db";

describe("Universal Model Providers & Credential Observability", () => {
  it("generates default runtime config for any model ID", async () => {
    const config = await getUniversalModelRuntimeConfig("custom-test-model-v1");
    expect(config.modelId).toBe("custom-test-model-v1");
    expect(config.providers.length).toBeGreaterThanOrEqual(1);
    expect(config.providers[0].baseUrl).toBeDefined();
  });

  it("updates and retrieves universal model provider settings", async () => {
    const modelId = "test-llama-4-pro";
    const updated = await updateUniversalModelProviderSettings(
      {
        modelId,
        providers: [
          {
            id: "provider-alpha",
            label: "Alpha Primary",
            enabled: true,
            baseUrl: "https://api.openai.com/v1",
            model: "llama-4-pro",
            apiKeys: ["sk-testkey1234567890abcdef"],
            apiKeyEnabled: [true],
            maxInputTokens: 128000,
            maxOutputTokens: 8192,
            supportsVision: true,
            supportsDocuments: true,
          },
        ],
      },
      1
    );

    expect(updated.modelId).toBe(modelId);
    expect(updated.providers.length).toBe(1);
    expect(updated.providers[0].label).toBe("Alpha Primary");
    expect(updated.providers[0].apiKeyMasks[0].value).toContain("sk-");
  });

  it("provides comprehensive Provider and Credential Observability metrics matching Claude Opus 5 architecture", async () => {
    const modelId = "test-llama-4-pro";
    const metricGroup = await getUniversalModelKeyMetricGroup(modelId);

    expect(metricGroup.modelId).toBe(modelId);
    expect(metricGroup.providers).toBeDefined();
    expect(metricGroup.providers!.length).toBe(1);
    expect(metricGroup.providers![0].slots.length).toBe(1);

    const slot = metricGroup.providers![0].slots[0];
    expect(slot.slot).toBe(1);
    expect(slot.keyMask).toBeDefined();
    expect(typeof slot.requestCount).toBe("number");
    expect(typeof slot.successCount).toBe("number");
    expect(typeof slot.failureCount).toBe("number");
    expect(slot.health).toBeDefined();
  });

  it("lists configured universal models in the catalogue", async () => {
    const models = await listUniversalConfiguredModels();
    expect(Array.isArray(models)).toBe(true);
    expect(models.length).toBeGreaterThan(0);
    const configured = models.find(m => m.modelId === "test-llama-4-pro");
    expect(configured?.configured).toBe(true);
  });
});
