import { describe, expect, it } from "vitest";
import {
  removeClaudeOpus5QwenApiKeyFromRuntime,
  removeClaudeOpus5QwenModelFromRuntime,
  type ClaudeOpus5RuntimePayload,
} from "./db";

function qwenRuntime(): ClaudeOpus5RuntimePayload {
  return {
    providers: [{
      id: "qwen",
      label: "Qwen",
      enabled: true,
      baseUrl: "https://provider.example/v1",
      model: "internal-model-a",
      apiKeys: ["test-key-a", "test-key-b", "test-key-c"],
      modelPool: [
        { id: "qwen-model-a", model: "internal-model-a", enabled: true, quotaTokens: 1_000_000 },
        { id: "qwen-model-b", model: "internal-model-b", enabled: true, quotaTokens: 1_000_000 },
      ],
    }],
  };
}

describe("durable Claude Opus Qwen configuration deletions", () => {
  it("removes a saved model entry from the persisted runtime shape and selects a remaining model", () => {
    const next = removeClaudeOpus5QwenModelFromRuntime(qwenRuntime(), "qwen", "qwen-model-a");
    const provider = next.providers[0]!;

    expect(provider.model).toBe("internal-model-b");
    expect(provider.modelPool?.map(entry => entry.id)).toEqual(["qwen-model-b"]);
    expect(JSON.stringify(next)).not.toContain("qwen-model-a");
  });

  it("refuses to remove the final saved Qwen model entry", () => {
    const runtime = qwenRuntime();
    runtime.providers[0]!.modelPool = [runtime.providers[0]!.modelPool![0]!];

    expect(() => removeClaudeOpus5QwenModelFromRuntime(runtime, "qwen", "qwen-model-a")).toThrow("Keep at least one Qwen model ID");
  });

  it("removes the selected saved key slot from the persisted runtime shape while keeping two active keys", () => {
    const result = removeClaudeOpus5QwenApiKeyFromRuntime(qwenRuntime(), "qwen", 2);

    expect(result.removedApiKey).toBe("test-key-b");
    expect(result.runtime.providers[0]!.apiKeys).toEqual(["test-key-a", "test-key-c"]);
    expect(JSON.stringify(result.runtime)).not.toContain("test-key-b");
  });

  it("refuses to delete below Qwen's required two active API keys", () => {
    const runtime = qwenRuntime();
    runtime.providers[0]!.apiKeys = ["test-key-a", "test-key-b"];

    expect(() => removeClaudeOpus5QwenApiKeyFromRuntime(runtime, "qwen", 1)).toThrow("Keep at least two active Qwen API keys");
  });
});
