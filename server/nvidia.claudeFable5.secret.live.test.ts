import { describe, expect, it } from "vitest";

const NVIDIA_CLAUDE_FABLE5_BASE_URL = process.env.NVIDIA_CLAUDE_FABLE5_BASE_URL?.replace(/\/$/, "");
const NVIDIA_CLAUDE_FABLE5_API_KEY = process.env.NVIDIA_CLAUDE_FABLE5_API_KEY;
const NVIDIA_CLAUDE_FABLE5_MODEL = process.env.NVIDIA_CLAUDE_FABLE5_MODEL?.trim();

describe("NVIDIA Claude Fable 5 credential", () => {
  it("authorizes a minimal OpenAI-compatible completion for the configured Fable model", async () => {
    expect(NVIDIA_CLAUDE_FABLE5_BASE_URL).toBeTruthy();
    expect(NVIDIA_CLAUDE_FABLE5_API_KEY).toBeTruthy();
    expect(NVIDIA_CLAUDE_FABLE5_MODEL).toBeTruthy();

    const response = await fetch(`${NVIDIA_CLAUDE_FABLE5_BASE_URL}/v1/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${NVIDIA_CLAUDE_FABLE5_API_KEY}`,
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

    console.info("[NVIDIA Claude Fable 5 lightweight completion]", { status: response.status, accepted: response.ok });
    expect(response.ok).toBe(true);
  }, 35_000);
});
