import { describe, expect, it } from "vitest";

const baseUrl = process.env.TOKENROUTER_CLAUDE_OPUS5_BASE_URL?.replace(/\/+$/, "");
const apiKey = process.env.CLAUDE_OPUS5_API_KEY;
const model = process.env.TOKENROUTER_CLAUDE_OPUS5_MODEL;
const hasProviderConfiguration = Boolean(baseUrl && apiKey && model);

describe.skipIf(!hasProviderConfiguration)("Claude Opus 5 isolated provider credential", () => {
  it("accepts a lightweight OpenAI-compatible completion using the configured server-only credential", async () => {
    const response = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: "Reply with the single word: ready" }],
        max_tokens: 16,
        stream: false,
      }),
      signal: AbortSignal.timeout(30_000),
    });

    expect(response.status, "The Claude Opus 5 provider rejected the configured server-only credential or model.").toBe(200);
    const payload = await response.json() as { choices?: unknown[] };
    expect(Array.isArray(payload.choices)).toBe(true);
  }, 35_000);
});
