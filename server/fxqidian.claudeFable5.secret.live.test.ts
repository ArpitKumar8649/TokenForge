import { describe, expect, it } from "vitest";

const FXQIDIAN_CLAUDE_FABLE5_BASE_URL = process.env.FXQIDIAN_CLAUDE_FABLE5_BASE_URL?.replace(/\/$/, "");
const FXQIDIAN_CLAUDE_FABLE5_API_KEY = process.env.FXQIDIAN_CLAUDE_FABLE5_API_KEY;
const FXQIDIAN_CLAUDE_FABLE5_MODEL = process.env.FXQIDIAN_CLAUDE_FABLE5_MODEL?.trim();

describe("FXQidian Claude Fable 5 credential", () => {
  it("authorizes the configured Fable model against a lightweight model-catalogue request", async () => {
    expect(FXQIDIAN_CLAUDE_FABLE5_BASE_URL).toBeTruthy();
    expect(FXQIDIAN_CLAUDE_FABLE5_API_KEY).toBeTruthy();
    expect(FXQIDIAN_CLAUDE_FABLE5_MODEL).toBeTruthy();

    const response = await fetch(`${FXQIDIAN_CLAUDE_FABLE5_BASE_URL}/v1/models`, {
      headers: { Authorization: `Bearer ${FXQIDIAN_CLAUDE_FABLE5_API_KEY}` },
    });

    expect(response.ok).toBe(true);
    const payload = await response.json() as { data?: Array<{ id?: unknown }> };
    expect(payload.data?.some(model => model.id === FXQIDIAN_CLAUDE_FABLE5_MODEL)).toBe(true);
  }, 30_000);

  it("accepts a minimal OpenAI-compatible completion for the configured Fable model", async () => {
    expect(FXQIDIAN_CLAUDE_FABLE5_BASE_URL).toBeTruthy();
    expect(FXQIDIAN_CLAUDE_FABLE5_API_KEY).toBeTruthy();
    expect(FXQIDIAN_CLAUDE_FABLE5_MODEL).toBeTruthy();

    const response = await fetch(`${FXQIDIAN_CLAUDE_FABLE5_BASE_URL}/v1/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${FXQIDIAN_CLAUDE_FABLE5_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: FXQIDIAN_CLAUDE_FABLE5_MODEL,
        messages: [{ role: "user", content: "Reply with exactly OK." }],
        max_tokens: 8,
      }),
      signal: AbortSignal.timeout(30_000),
    });

    console.info("[FXQidian Claude Fable 5 lightweight completion]", { status: response.status, accepted: response.ok });
    expect(response.ok).toBe(true);
  }, 35_000);
});
