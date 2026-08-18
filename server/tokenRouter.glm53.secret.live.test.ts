import { describe, expect, it } from "vitest";
import { getTokenRouterCredentialPool } from "./tokenRouterCredentials";

const TOKENROUTER_BASE_URL = process.env.TOKENROUTER_BASE_URL?.replace(/\/$/, "");
const TOKENROUTER_GLM53_MODEL = process.env.TOKENROUTER_GLM53_MODEL?.trim();

describe("TokenRouter GLM 5.3 model configuration", () => {
  it("accepts a lightweight completion for the configured server-only upstream model through the available credential pool", async () => {
    expect(TOKENROUTER_BASE_URL).toBeTruthy();
    expect(TOKENROUTER_GLM53_MODEL).toBeTruthy();
    const credentials = getTokenRouterCredentialPool();
    expect(credentials.length).toBeGreaterThan(0);

    const statuses: number[] = [];
    for (const [slot, credential] of credentials.entries()) {
      const response = await fetch(`${TOKENROUTER_BASE_URL}/v1/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${credential}`,
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: TOKENROUTER_GLM53_MODEL,
          messages: [{ role: "user", content: "Reply with exactly OK." }],
          max_tokens: 8,
          stream: false,
        }),
        signal: AbortSignal.timeout(30_000),
      });
      statuses.push(response.status);
      console.info("[TokenRouter GLM 5.3 lightweight completion]", { slot: slot + 1, status: response.status, accepted: response.ok });
      if (response.ok) return;
    }

    throw new Error(`The configured GLM 5.3 upstream model was not accepted by any TokenRouter credential slot (HTTP ${statuses.join(", ")}).`);
  }, 275_000);
});
