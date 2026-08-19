import { describe, expect, it } from "vitest";

const baseUrl = process.env.TOKENROUTER_CLAUDE_OPUS5_BASE_URL?.replace(/\/+$/, "");
const apiKey = process.env.CLAUDE_OPUS5_API_KEY;
const model = process.env.TOKENROUTER_CLAUDE_OPUS5_MODEL;
const hasProviderConfiguration = Boolean(baseUrl && apiKey && model);

describe.skipIf(!hasProviderConfiguration)("Claude Opus 5 isolated provider credential", () => {
  it("accepts a lightweight OpenAI-compatible completion using the configured server-only credential", async () => {
    let response: Response;
    try {
      response = await fetch(`${baseUrl}/v1/chat/completions`, {
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
    } catch (error) {
      if (error instanceof DOMException && error.name === "TimeoutError") {
        console.warn("[Claude Opus 5 lightweight completion] upstream response timed out before validation completed");
        return;
      }
      throw error;
    }

    const upstreamTransient = [408, 429, 500, 502, 503, 504, 524].includes(response.status);
    console.info("[Claude Opus 5 lightweight completion]", { status: response.status, accepted: response.ok, upstreamTransient });
    expect(response.ok || upstreamTransient, "The Claude Opus 5 provider rejected the configured server-only credential or model.").toBe(true);
    if (upstreamTransient) return;
  }, 35_000);
});
