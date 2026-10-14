import { describe, expect, it } from "vitest";
import { normalizeModelAvailability } from "./db";

describe("model availability snapshot", () => {
  it("reports a model as live only when both the model and its provider are enabled", () => {
    expect(normalizeModelAvailability([
      { modelId: "kimi-k3", enabled: true, providerEnabled: true },
      { modelId: "qwen3.7-max", enabled: true, providerEnabled: false },
      { modelId: "qwen3.8-max", enabled: true, providerEnabled: true },
      { modelId: "glm-5.2", enabled: false, providerEnabled: true },
      { modelId: "claude-haiku-4.5", enabled: true, providerEnabled: null },
    ])).toEqual([
      { modelId: "kimi-k3", available: true },
      { modelId: "qwen3.7-max", available: false },
      { modelId: "qwen3.8-max", available: true },
      { modelId: "glm-5.2", available: false },
      { modelId: "claude-haiku-4.5", available: false },
    ]);
  });
});
