import { describe, expect, it } from "vitest";

const baseUrl = process.env.OPENCODE_CLAUDE_OPUS5_BASE_URL?.replace(/\/+$/, "");
const apiKey = process.env.OPENCODE_CLAUDE_OPUS5_API_KEY;
const model = process.env.OPENCODE_CLAUDE_OPUS5_MODEL;
const hasProviderConfiguration = Boolean(baseUrl && apiKey && model);

describe.skipIf(!hasProviderConfiguration || process.env.RUN_TOKENFORGE_OPENCODE_CLAUDE_OPUS5_LIVE !== "1")("Claude Opus 5 isolated OpenCode provider credential", () => {
  it("accepts a lightweight OpenAI-compatible completion using the configured server-only credential", async () => {
    let response: Response;
    try {
      response = await fetch(baseUrl!.endsWith("/chat/completions")
        ? baseUrl!
        : `${baseUrl!.endsWith("/v1") ? baseUrl : `${baseUrl}/v1`}/chat/completions`, {
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
      const networkCode = error instanceof Error && error.cause && typeof error.cause === "object" && "code" in error.cause
        ? (error.cause as { code?: unknown }).code
        : undefined;
      if ((error instanceof DOMException && error.name === "TimeoutError") || networkCode === "UND_ERR_CONNECT_TIMEOUT") {
        console.warn("[Claude Opus 5 lightweight completion] upstream response timed out before validation completed");
        return;
      }
      throw error;
    }

    const upstreamTransient = [408, 429, 500, 502, 503, 504, 524].includes(response.status);
    const responseSummary = await response.text().then(body => body.slice(0, 1_000)).catch(() => "");
    console.info("[Claude Opus 5 lightweight completion]", { status: response.status, accepted: response.ok, upstreamTransient, responseSummary });
    expect(response.ok || upstreamTransient, "The Claude Opus 5 provider rejected the configured server-only credential or model.").toBe(true);
    if (upstreamTransient) return;
  }, 35_000);
});
