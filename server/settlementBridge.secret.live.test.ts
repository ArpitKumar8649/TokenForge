import { describe, expect, it } from "vitest";

const settlementBridgeApiKey = process.env.SETTLEMENT_BRIDGE_API_KEY?.trim();
const settlementBridgeBaseUrl = "https://settlement-bridge-driver-scuba.trycloudflare.com/v1";

describe.runIf(Boolean(settlementBridgeApiKey))("server-only Settlement Bridge credential", () => {
  it("authenticates against the configured models endpoint without exposing credential or model content", async () => {
    const response = await fetch(`${settlementBridgeBaseUrl}/models`, {
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${settlementBridgeApiKey}`,
      },
    });

    expect(response.ok).toBe(true);
    const body = await response.json() as { data?: unknown };
    expect(Array.isArray(body.data)).toBe(true);
  }, 20_000);
});
