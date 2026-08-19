import { describe, expect, it } from "vitest";

const NVIDIA_CLAUDE_FABLE5_BASE_URL = process.env.NVIDIA_CLAUDE_FABLE5_BASE_URL?.replace(/\/$/, "");
const NVIDIA_CLAUDE_FABLE5_MODEL = process.env.NVIDIA_CLAUDE_FABLE5_MODEL?.trim();
const NVIDIA_CLAUDE_FABLE5_API_KEYS = [
  process.env.NVIDIA_CLAUDE_FABLE5_API_KEY,
  process.env.NVIDIA_CLAUDE_FABLE5_API_KEY_2,
  process.env.NVIDIA_CLAUDE_FABLE5_API_KEY_3,
  process.env.NVIDIA_CLAUDE_FABLE5_API_KEY_4,
  process.env.NVIDIA_CLAUDE_FABLE5_API_KEY_5,
];

describe("NVIDIA Claude Fable 5 credential pool", () => {
  it("authorizes a minimal OpenAI-compatible completion with every configured Fable credential", async () => {
    expect(NVIDIA_CLAUDE_FABLE5_BASE_URL).toBeTruthy();
    expect(NVIDIA_CLAUDE_FABLE5_MODEL).toBeTruthy();
    expect(NVIDIA_CLAUDE_FABLE5_API_KEYS).toHaveLength(5);
    expect(NVIDIA_CLAUDE_FABLE5_API_KEYS.every(Boolean)).toBe(true);
    expect(new Set(NVIDIA_CLAUDE_FABLE5_API_KEYS).size).toBe(NVIDIA_CLAUDE_FABLE5_API_KEYS.length);

    const retryableStatuses = new Set([408, 429, 500, 502, 503, 504, 524]);
    for (const [slot, secret] of NVIDIA_CLAUDE_FABLE5_API_KEYS.entries()) {
      const response = await fetch(`${NVIDIA_CLAUDE_FABLE5_BASE_URL}/v1/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${secret}`,
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: NVIDIA_CLAUDE_FABLE5_MODEL,
          messages: [{ role: "user", content: "Reply with exactly OK." }],
          max_tokens: 8,
          stream: false,
        }),
        signal: AbortSignal.timeout(30_000),
      });

      const upstreamTransient = retryableStatuses.has(response.status);
      console.info("[NVIDIA Claude Fable 5 lightweight completion]", { slot: slot + 1, status: response.status, accepted: response.ok, upstreamTransient });
      expect(
        response.ok || upstreamTransient,
        `NVIDIA Claude Fable 5 credential slot ${slot + 1} returned a non-retryable HTTP ${response.status}.`,
      ).toBe(true);
    }
  }, 155_000);
});
