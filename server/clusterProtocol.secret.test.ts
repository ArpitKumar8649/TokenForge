import { describe, expect, it } from "vitest";

describe("Cluster Protocol provider configuration", () => {
  it("authenticates the server-only credential against the OpenAI-compatible model catalogue", async () => {
    const baseUrl = process.env.CLUSTER_PROTOCOL_BASE_URL?.replace(/\/$/, "");
    const apiKey = process.env.CLUSTER_PROTOCOL_API_KEY;

    expect(baseUrl).toBeTruthy();
    expect(apiKey).toBeTruthy();

    const response = await fetch(`${baseUrl}/v1/models`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(15_000),
    });

    expect(response.status, `Cluster Protocol rejected the server credential with HTTP ${response.status}`).not.toBe(401);
    expect(response.ok, `Cluster Protocol model catalogue request failed with HTTP ${response.status}`).toBe(true);
  }, 20_000);
});
