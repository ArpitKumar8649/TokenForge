import { describe, expect, it } from "vitest";

const configured = process.env.RUN_TOKENROUTER_LIVE === "1" && Boolean(
  process.env.TOKENROUTER_BASE_URL?.trim()
    && process.env.TOKENROUTER_API_KEY?.trim()
    && process.env.TOKENROUTER_MODEL?.trim(),
);

describe.runIf(configured)("TokenRouter Qwen 3.8 Max live credential probe", () => {
  it("accepts the configured credential and the provider’s highest supported reasoning-effort request", async () => {
    const baseUrl = process.env.TOKENROUTER_BASE_URL!.replace(/\/$/, "");
    const response = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.TOKENROUTER_API_KEY!}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.TOKENROUTER_MODEL,
        messages: [{ role: "user", content: "Reply with exactly: ok" }],
        reasoning_effort: "xhigh",
        max_tokens: 32,
        stream: false,
      }),
      signal: AbortSignal.timeout(30_000),
    });

    const payload = await response.json().catch(() => null) as { choices?: unknown[] } | null;
    expect(response.status).toBe(200);
    expect(Array.isArray(payload?.choices)).toBe(true);
  }, 35_000);
});
