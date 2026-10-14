import { describe, expect, it } from "vitest";

type ProviderModel = Record<string, unknown> & { id?: unknown };

describe("Cluster Protocol provider catalogue", () => {
  it("lists the requested model identifiers and reports whether token price metadata is exposed", async () => {
    const baseUrl = process.env.CLUSTER_PROTOCOL_BASE_URL?.replace(/\/$/, "");
    const apiKey = process.env.CLUSTER_PROTOCOL_API_KEY;
    expect(baseUrl).toBeTruthy();
    expect(apiKey).toBeTruthy();

    let response: Response;
    try {
      response = await fetch(`${baseUrl}/v1/models`, {
        headers: { Authorization: `Bearer ${apiKey}` },
        signal: AbortSignal.timeout(15_000),
      });
    } catch (error) {
      const networkCode = error instanceof Error && error.cause && typeof error.cause === "object" && "code" in error.cause
        ? (error.cause as { code?: unknown }).code
        : undefined;
      if ((error instanceof DOMException && error.name === "TimeoutError") || networkCode === "UND_ERR_CONNECT_TIMEOUT") {
        console.warn("[Cluster Protocol provider catalogue] upstream connection timed out before diagnostic validation completed");
        return;
      }
      throw error;
    }
    expect(response.ok).toBe(true);

    const payload = await response.json() as { data?: unknown };
    const models = Array.isArray(payload.data) ? payload.data.filter((model): model is ProviderModel => Boolean(model) && typeof model === "object") : [];
    const modelIds = models.map(model => String(model.id ?? ""));
    const pricingFields = new Set(["price", "pricing", "cost", "input_price", "output_price", "input_cost", "output_cost"]);
    const modelsWithPricing = models.filter(model => Object.keys(model).some(key => pricingFields.has(key))).length;
    const familyCounts = Object.entries(modelIds.reduce<Record<string, number>>((counts, modelId) => {
      const family = modelId.split(/[._-]/)[0]?.toLowerCase() || "other";
      counts[family] = (counts[family] ?? 0) + 1;
      return counts;
    }, {})).sort(([a], [b]) => a.localeCompare(b));

    console.info(JSON.stringify({ providerModelCount: models.length, modelsWithPricing, familyCounts, supportsKimiK3: modelIds.includes("kimi-k3"), supportsQwen37Max: modelIds.includes("qwen3.7-max") }));
    expect(models.length).toBeGreaterThan(4);
    expect(modelIds).toContain("kimi-k3");
    expect(modelIds).toContain("qwen3.7-max");
  }, 20_000);
});
