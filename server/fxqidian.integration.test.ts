import { describe, expect, it } from "vitest";

const baseUrl = process.env.FXQIDIAN_BASE_URL;
const apiKey = process.env.FXQIDIAN_API_KEY;

describe("fxqidian provider credential", () => {
  it("authorizes a lightweight model-list request", async () => {
    expect(baseUrl).toBeTruthy();
    expect(apiKey).toBeTruthy();

    const response = await fetch(`${baseUrl}/v1/models`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(10_000),
    });

    expect(response.ok).toBe(true);
    const payload = (await response.json()) as { data?: Array<{ id?: string }> };
    const modelIds = payload.data?.map(model => model.id) ?? [];

    expect(modelIds).toContain("glm-5.2");
    expect(modelIds).toContain("grok-4.5");
  }, 15_000);
});
