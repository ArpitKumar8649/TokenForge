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

  it("authenticates every additional server-only credential against the lightweight model catalogue", async () => {
    const baseUrl = process.env.CLUSTER_PROTOCOL_BASE_URL?.replace(/\/$/, "");
    const additionalCredentials = [
      process.env.CLUSTER_PROTOCOL_API_KEY_2,
      process.env.CLUSTER_PROTOCOL_API_KEY_3,
      process.env.CLUSTER_PROTOCOL_API_KEY_4,
      process.env.CLUSTER_PROTOCOL_API_KEY_5,
      process.env.CLUSTER_PROTOCOL_API_KEY_6,
    ];
    expect(baseUrl).toBeTruthy();
    expect(additionalCredentials.every(Boolean)).toBe(true);

    const responses = await Promise.all(additionalCredentials.map(apiKey => fetch(`${baseUrl}/v1/models`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(15_000),
    })));

    responses.forEach(response => {
      expect(response.status, `Cluster Protocol rejected an additional server credential with HTTP ${response.status}`).not.toBe(401);
      expect(response.ok, `Cluster Protocol model catalogue request failed with HTTP ${response.status}`).toBe(true);
    });
  }, 20_000);
});
