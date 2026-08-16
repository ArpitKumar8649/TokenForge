import { describe, expect, it } from "vitest";

const claudeOpus5BaseUrl = process.env.CLAUDE_OPUS5_BASE_URL;
const claudeOpus5ApiKey = process.env.CLAUDE_OPUS5_API_KEY;
const claudeOpus5Model = process.env.CLAUDE_OPUS5_MODEL;
const liveProviderTest = process.env.CLAUDE_OPUS5_LIVE_TEST === "1" ? it : it.skip;

describe("Claude Opus 5 provider credential", () => {
  liveProviderTest("authenticates and completes a minimal server-side request", async () => {
    expect(claudeOpus5BaseUrl).toBeTruthy();
    expect(claudeOpus5ApiKey).toBeTruthy();
    expect(claudeOpus5Model).toBeTruthy();

    const response = await fetch(`${claudeOpus5BaseUrl}/v1/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${claudeOpus5ApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: claudeOpus5Model,
        messages: [{ role: "user", content: "Reply with: ready" }],
        max_tokens: 16,
        stream: false,
      }),
      signal: AbortSignal.timeout(25_000),
    });

    expect(response.status).toBe(200);
    const payload = await response.json() as { choices?: unknown[] };
    expect(Array.isArray(payload.choices)).toBe(true);
  }, 30_000);
});
