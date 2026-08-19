import { describe, expect, it } from "vitest";

const configuredBaseUrl = process.env.OPENCODE_CLAUDE_FABLE5_BASE_URL?.replace(/\/+$/, "");
const apiKey = process.env.OPENCODE_CLAUDE_FABLE5_API_KEY;
const model = process.env.OPENCODE_CLAUDE_FABLE5_MODEL;
const shouldRun = process.env.RUN_TOKENFORGE_OPENCODE_CLAUDE_FABLE5_LIVE === "1";

function chatCompletionsEndpoint(baseUrl: string) {
  if (baseUrl.endsWith("/chat/completions")) return baseUrl;
  if (baseUrl.endsWith("/v1")) return `${baseUrl}/chat/completions`;
  return `${baseUrl}/v1/chat/completions`;
}

describe.runIf(shouldRun)("OpenCode Claude Fable 5 provider credential contract", () => {
  it("accepts a lightweight OpenAI-compatible completion with the configured server-only settings", async () => {
    expect(configuredBaseUrl).toBeTruthy();
    expect(apiKey).toBeTruthy();
    expect(model).toBeTruthy();

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

    expect(response.ok).toBe(true);
    const payload = (await response.json()) as { choices?: unknown[] };
    expect(payload.choices?.length).toBeGreaterThan(0);
  }, 50_000);
});
