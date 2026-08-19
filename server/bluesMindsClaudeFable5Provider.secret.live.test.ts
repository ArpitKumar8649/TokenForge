import { describe, expect, it } from "vitest";

const configuredBaseUrl = process.env.BLUESMINDS_CLAUDE_FABLE5_BASE_URL?.replace(/\/+$/, "");
const apiKeys = [
  process.env.BLUESMINDS_CLAUDE_FABLE5_API_KEY?.trim(),
  process.env.BLUESMINDS_CLAUDE_FABLE5_API_KEY_2?.trim(),
];
const model = process.env.BLUESMINDS_CLAUDE_FABLE5_MODEL;
const shouldRun = process.env.RUN_TOKENFORGE_BLUESMINDS_CLAUDE_FABLE5_LIVE === "1";

function chatCompletionsEndpoint(baseUrl: string) {
  if (baseUrl.endsWith("/chat/completions")) return baseUrl;
  if (baseUrl.endsWith("/v1")) return `${baseUrl}/chat/completions`;
  return `${baseUrl}/v1/chat/completions`;
}

describe.runIf(shouldRun)("BluesMinds Claude Fable 5 provider credential contract", () => {
  it("accepts a lightweight OpenAI-compatible completion with both configured server-only credential slots", async () => {
    expect(configuredBaseUrl).toBeTruthy();
    expect(model).toBeTruthy();
    expect(apiKeys).toHaveLength(2);

    for (const [slot, apiKey] of apiKeys.entries()) {
      expect(apiKey, `BluesMinds credential slot ${slot + 1} is missing.`).toBeTruthy();
      const response = await fetch(chatCompletionsEndpoint(configuredBaseUrl!), {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          messages: [{ role: "user", content: "Reply with the word ready." }],
          reasoning_effort: "xhigh",
          max_tokens: 8,
          stream: false,
        }),
        signal: AbortSignal.timeout(45_000),
      });

      expect(response.ok, `BluesMinds credential slot ${slot + 1} returned HTTP ${response.status}.`).toBe(true);
      const payload = (await response.json()) as { choices?: unknown[] };
      expect(payload.choices?.length).toBeGreaterThan(0);
    }
  }, 95_000);
});
