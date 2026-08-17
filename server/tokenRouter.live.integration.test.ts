import { describe, expect, it } from "vitest";

const configured = process.env.RUN_TOKENROUTER_LIVE === "1" && Boolean(
  process.env.TOKENROUTER_BASE_URL?.trim()
    && process.env.TOKENROUTER_API_KEY?.trim()
    && process.env.TOKENROUTER_API_KEY_2?.trim()
    && process.env.TOKENROUTER_API_KEY_3?.trim()
    && process.env.TOKENROUTER_API_KEY_4?.trim()
    && process.env.TOKENROUTER_MODEL?.trim(),
);
const claudeFableConfigured = configured && Boolean(process.env.TOKENROUTER_CLAUDE_FABLE5_MODEL?.trim());
const claudeOpus5Configured = Boolean(
  process.env.TOKENROUTER_CLAUDE_OPUS5_BASE_URL?.trim()
    && process.env.TOKENROUTER_CLAUDE_OPUS5_MODEL?.trim()
    && process.env.TOKENROUTER_API_KEY?.trim(),
);

describe.runIf(configured)("TokenRouter Qwen 3.8 Max credential-pool probe", () => {
  it("accepts each configured credential with the provider’s highest supported reasoning-effort request", async () => {
    const baseUrl = process.env.TOKENROUTER_BASE_URL!.replace(/\/$/, "");
    const credentials = [
      process.env.TOKENROUTER_API_KEY!,
      process.env.TOKENROUTER_API_KEY_2!,
      process.env.TOKENROUTER_API_KEY_3!,
      process.env.TOKENROUTER_API_KEY_4!,
    ];

    for (const credential of credentials) {
      const response = await fetch(`${baseUrl}/v1/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${credential}`,
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
    }
  }, 35_000);
});

describe.runIf(claudeFableConfigured)("TokenRouter Claude Fable 5 model probe", () => {
  it("accepts the configured server-only upstream model identifier", async () => {
    const baseUrl = process.env.TOKENROUTER_BASE_URL!.replace(/\/$/, "");
    const response = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.TOKENROUTER_API_KEY!}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.TOKENROUTER_CLAUDE_FABLE5_MODEL,
        messages: [{ role: "user", content: "Reply with exactly: ok" }],
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

describe.runIf(claudeOpus5Configured)("TokenRouter Claude Opus 5 route configuration probe", () => {
  it("accepts the supplied server-only base URL and upstream model identifier", async () => {
    const baseUrl = process.env.TOKENROUTER_CLAUDE_OPUS5_BASE_URL!.replace(/\/$/, "");
    const response = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.TOKENROUTER_API_KEY!}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.TOKENROUTER_CLAUDE_OPUS5_MODEL,
        messages: [
          { role: "system", content: "You are an AI assistant available through TokenForge using the configured Claude Opus 5 route. Be concise." },
          { role: "user", content: "Reply with exactly: ok" },
        ],
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
