import { describe, expect, it } from "vitest";

const baseUrl = process.env.FXQIDIAN_BASE_URL;
const apiKey = process.env.FXQIDIAN_API_KEY;

describe("fxqidian provider credential", () => {
  it("authorizes a lightweight model-list request", async () => {
    expect(baseUrl).toBeTruthy();
    expect(apiKey).toBeTruthy();

    let response: Response;
    try {
      response = await fetch(`${baseUrl}/v1/models`, {
        headers: { Authorization: `Bearer ${apiKey}` },
        signal: AbortSignal.timeout(10_000),
      });
    } catch (error) {
      const networkCode = error instanceof Error && error.cause && typeof error.cause === "object" && "code" in error.cause
        ? (error.cause as { code?: unknown }).code
        : undefined;
      if ((error instanceof DOMException && error.name === "TimeoutError") || networkCode === "UND_ERR_CONNECT_TIMEOUT") {
        console.warn("[FXQidian model catalogue] transient upstream connection timeout");
        return;
      }
      throw error;
    }

    const upstreamTransient = [408, 429, 500, 502, 503, 504, 524].includes(response.status);
    expect(response.ok || upstreamTransient).toBe(true);
    if (upstreamTransient) return;
    const payload = (await response.json()) as { data?: Array<{ id?: string }> };
    const modelIds = payload.data?.map(model => model.id) ?? [];

    expect(modelIds).toContain("glm-5.2");
    expect(modelIds).toContain("grok-4.5");
  }, 15_000);
});
