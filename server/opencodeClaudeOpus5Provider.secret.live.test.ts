import { describe, expect, it } from "vitest";

const runLive = process.env.RUN_TOKENFORGE_OPENCODE_CLAUDE_OPUS5_LIVE === "1";
const baseUrl = process.env.OPENCODE_CLAUDE_OPUS5_BASE_URL?.replace(/\/$/, "");
const apiKey = process.env.OPENCODE_CLAUDE_OPUS5_API_KEY;
const model = process.env.OPENCODE_CLAUDE_OPUS5_MODEL?.trim();
const liveIt = runLive && baseUrl && apiKey && model ? it : it.skip;

describe("OpenCode Claude Opus 5 provider credential contract", () => {
  const openAiEndpoint = baseUrl!.endsWith("/chat/completions")
    ? baseUrl!
    : `${baseUrl!.endsWith("/v1") ? baseUrl : `${baseUrl}/v1`}/chat/completions`;

  liveIt("accepts a lightweight OpenAI-compatible completion with the configured server-only settings", async () => {
    const response = await fetch(openAiEndpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: "Reply with exactly OK." }],
        max_tokens: 8,
        stream: false,
      }),
      signal: AbortSignal.timeout(20_000),
    });

    const responseText = await response.text();
    expect(response.status, responseText.slice(0, 500)).toBe(200);
    expect(responseText).toContain("choices");
  }, 25_000);
});
