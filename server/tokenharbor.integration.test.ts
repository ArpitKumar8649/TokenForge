import { describe, expect, it } from "vitest";

const tokenHarborBaseUrl = process.env.TOKENHARBOR_BASE_URL;
const tokenHarborApiKey = process.env.TOKENHARBOR_API_KEY;
const liveProviderTest = process.env.TOKENHARBOR_LIVE_TEST === "1" ? it : it.skip;

describe("TokenHarbor provider credential", () => {
  liveProviderTest("authenticates and completes a minimal request with the requested DeepSeek route", async () => {
    expect(tokenHarborBaseUrl).toBeTruthy();
    expect(tokenHarborApiKey).toBeTruthy();

    const response = await fetch(`${tokenHarborBaseUrl}/v1/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenHarborApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "deepseek-v4-flash:free",
        messages: [{ role: "user", content: "Hello!" }],
        stream: false,
      }),
      signal: AbortSignal.timeout(20_000),
    });

    expect(response.status).toBe(200);
    const payload = await response.json() as { choices?: unknown[] };
    expect(Array.isArray(payload.choices)).toBe(true);
  }, 25_000);
});
