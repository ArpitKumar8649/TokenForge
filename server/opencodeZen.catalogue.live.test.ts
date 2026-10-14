import { describe, expect, it } from "vitest";

const baseUrl = "https://opencode.ai/zen/v1";
const apiKey = process.env.OPENCODE_ZEN_API_KEY;

describe.skipIf(!apiKey)("OpenCode Zen catalogue credential", () => {
  it("authorizes a lightweight server-side models catalogue request", async () => {
    const response = await fetch(`${baseUrl}/models`, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(20_000),
    });

    expect(response.ok, `OpenCode Zen rejected the configured server-only credential with HTTP ${response.status}.`).toBe(true);
    const payload = await response.json() as { data?: unknown };
    expect(Array.isArray(payload.data)).toBe(true);
  }, 25_000);
});
