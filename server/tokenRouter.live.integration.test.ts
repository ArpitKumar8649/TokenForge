import { describe, expect, it } from "vitest";

const configured = process.env.RUN_TOKENROUTER_LIVE === "1" && Boolean(
  process.env.TOKENROUTER_BASE_URL?.trim()
    && process.env.TOKENROUTER_API_KEY?.trim()
    && process.env.TOKENROUTER_API_KEY_2?.trim()
    && process.env.TOKENROUTER_API_KEY_3?.trim()
    && process.env.TOKENROUTER_API_KEY_4?.trim()
    && process.env.TOKENROUTER_API_KEY_5?.trim()
    && process.env.TOKENROUTER_API_KEY_6?.trim()
    && process.env.TOKENROUTER_API_KEY_7?.trim()
    && process.env.TOKENROUTER_API_KEY_8?.trim()
    && process.env.TOKENROUTER_API_KEY_9?.trim()
    && process.env.TOKENROUTER_MODEL?.trim(),
);
const claudeFableConfigured = configured && Boolean(process.env.TOKENROUTER_CLAUDE_FABLE5_MODEL?.trim());
const glm53Configured = configured && Boolean(process.env.TOKENROUTER_GLM53_MODEL?.trim());
const claudeOpus5Configured = Boolean(
  process.env.TOKENROUTER_CLAUDE_OPUS5_BASE_URL?.trim()
    && process.env.TOKENROUTER_CLAUDE_OPUS5_MODEL?.trim()
    && process.env.TOKENROUTER_API_KEY?.trim(),
);

type ProbeOutcome = { slot: number; status: number; error: string | null };

async function recordDiagnosticProbe(slot: number, request: () => Promise<Response>): Promise<ProbeOutcome> {
  try {
    const response = await request();
    const payload = await response.json().catch(() => null) as { error?: { message?: unknown }; message?: unknown } | null;
    const error = typeof payload?.error?.message === "string"
      ? payload.error.message
      : typeof payload?.message === "string" ? payload.message : null;
    return { slot, status: response.status, error };
  } catch (error) {
    return { slot, status: 0, error: error instanceof Error ? error.message : "Upstream request failed" };
  }
}

describe.runIf(configured)("TokenRouter Qwen 3.8 Max credential-pool probe", () => {
  it("accepts each configured credential with the provider’s highest supported reasoning-effort request", async () => {
    const baseUrl = process.env.TOKENROUTER_BASE_URL!.replace(/\/$/, "");
    const credentials = [
      process.env.TOKENROUTER_API_KEY!,
      process.env.TOKENROUTER_API_KEY_3!,
      process.env.TOKENROUTER_API_KEY_5!,
      process.env.TOKENROUTER_API_KEY_7!,
      process.env.TOKENROUTER_API_KEY_9!,
      process.env.TOKENROUTER_API_KEY_2!,
      process.env.TOKENROUTER_API_KEY_4!,
      process.env.TOKENROUTER_API_KEY_6!,
      process.env.TOKENROUTER_API_KEY_8!,
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
  }, 90_000);
});

describe.runIf(configured)("TokenRouter newly added credential authentication probe", () => {
  it("authenticates each newly added credential against the provider model list", async () => {
    const baseUrl = process.env.TOKENROUTER_BASE_URL!.replace(/\/$/, "");
    const credentials = [
      process.env.TOKENROUTER_API_KEY_7!,
      process.env.TOKENROUTER_API_KEY_8!,
      process.env.TOKENROUTER_API_KEY_9!,
    ];

    for (const credential of credentials) {
      const response = await fetch(`${baseUrl}/v1/models`, {
        headers: { Authorization: `Bearer ${credential}` },
        signal: AbortSignal.timeout(15_000),
      });
      expect(response.status).toBe(200);
    }
  }, 50_000);
});

describe.runIf(glm53Configured)("TokenRouter GLM 5.3 configuration probe", () => {
  it("accepts the configured server-only GLM 5.3 upstream model identifier with both additional credentials", async () => {
    const baseUrl = process.env.TOKENROUTER_BASE_URL!.replace(/\/$/, "");
    for (const credential of [process.env.TOKENROUTER_API_KEY_5!, process.env.TOKENROUTER_API_KEY_6!]) {
      const response = await fetch(`${baseUrl}/v1/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${credential}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: process.env.TOKENROUTER_GLM53_MODEL,
          messages: [{ role: "user", content: "Reply with exactly: ok" }],
          max_tokens: 32,
          stream: false,
        }),
        signal: AbortSignal.timeout(30_000),
      });

      const payload = await response.json().catch(() => null) as { choices?: unknown[] } | null;
      expect(response.status).toBe(200);
      expect(Array.isArray(payload?.choices)).toBe(true);
    }
  }, 65_000);

  it("accepts a direct 300-entry conversational history without TokenForge request translation", async () => {
    const baseUrl = process.env.TOKENROUTER_BASE_URL!.replace(/\/$/, "");
    const messages = Array.from({ length: 300 }, (_, index) => ({
      role: index % 2 === 0 ? "user" : "assistant",
      content: index === 298 ? "Reply with exactly: ok" : index % 2 === 0 ? "ping" : "ack",
    }));
    const response = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.TOKENROUTER_API_KEY_5!}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.TOKENROUTER_GLM53_MODEL,
        messages,
        max_tokens: 32,
        stream: false,
      }),
      signal: AbortSignal.timeout(45_000),
    });

    const payload = await response.json().catch(() => null) as { choices?: unknown[] } | null;
    expect(response.status).toBe(200);
    expect(Array.isArray(payload?.choices)).toBe(true);
  }, 50_000);
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

  it("records the configured route's native Anthropic Messages support status without exposing credentials", async () => {
    const baseUrl = process.env.TOKENROUTER_CLAUDE_OPUS5_BASE_URL!.replace(/\/$/, "");
    const credentials = [
      process.env.TOKENROUTER_API_KEY!,
      process.env.TOKENROUTER_API_KEY_2!,
      process.env.TOKENROUTER_API_KEY_3!,
      process.env.TOKENROUTER_API_KEY_4!,
    ];
    const outcomes: ProbeOutcome[] = [];

    for (const [index, credential] of credentials.entries()) {
      outcomes.push(await recordDiagnosticProbe(index + 1, () => fetch(`${baseUrl}/v1/messages`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${credential}`,
          "Content-Type": "application/json",
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: process.env.TOKENROUTER_CLAUDE_OPUS5_MODEL,
          max_tokens: 64,
          system: [{ type: "text", text: "Be concise." }],
          messages: [{ role: "user", content: [{ type: "text", text: "Reply with exactly OK." }] }],
          tools: [{ name: "read_file", input_schema: { type: "object", properties: { path: { type: "string" } } } }],
          stream: false,
        }),
        signal: AbortSignal.timeout(30_000),
      })));
    }

    console.info("[TokenRouter Claude Opus 5 native Messages probe]", outcomes);
    expect(outcomes).toHaveLength(credentials.length);
  }, 135_000);

  it("records Claude Code-style OpenAI tool-call compatibility across the shared credential pool", async () => {
    const baseUrl = process.env.TOKENROUTER_CLAUDE_OPUS5_BASE_URL!.replace(/\/$/, "");
    const credentials = [
      process.env.TOKENROUTER_API_KEY!,
      process.env.TOKENROUTER_API_KEY_2!,
      process.env.TOKENROUTER_API_KEY_3!,
      process.env.TOKENROUTER_API_KEY_4!,
    ];
    const outcomes: ProbeOutcome[] = [];

    for (const [index, credential] of credentials.entries()) {
      outcomes.push(await recordDiagnosticProbe(index + 1, () => fetch(`${baseUrl}/v1/chat/completions`, {
        method: "POST",
        headers: { Authorization: `Bearer ${credential}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: process.env.TOKENROUTER_CLAUDE_OPUS5_MODEL,
          messages: [
            { role: "system", content: "You are an AI assistant available through TokenForge. Be concise." },
            { role: "user", content: "Reply with exactly: ok" },
          ],
          tools: [{ type: "function", function: { name: "read_file", description: "Read a file", parameters: { type: "object", properties: { path: { type: "string" } }, required: ["path"] } } }],
          max_tokens: 64,
          stream: false,
        }),
        signal: AbortSignal.timeout(30_000),
      })));
    }

    console.info("[TokenRouter Claude Opus 5 Chat Completions tools probe]", outcomes);
    expect(outcomes).toHaveLength(credentials.length);
  }, 135_000);

  it("records exact translated Claude Code payload compatibility across the shared credential pool", async () => {
    const baseUrl = process.env.TOKENROUTER_CLAUDE_OPUS5_BASE_URL!.replace(/\/$/, "");
    const credentials = [
      process.env.TOKENROUTER_API_KEY!,
      process.env.TOKENROUTER_API_KEY_2!,
      process.env.TOKENROUTER_API_KEY_3!,
      process.env.TOKENROUTER_API_KEY_4!,
    ];
    const translated = translateAnthropicRequest({
      model: "claude-opus-5",
      max_tokens: 64,
      system: [{ type: "text", text: "Be concise." }],
      messages: [{ role: "user", content: [{ type: "text", text: "Reply with exactly OK." }] }],
      tools: [{ name: "read_file", input_schema: { type: "object", properties: { path: { type: "string" } } } }],
      stream: false,
    });
    const payload = {
      ...translated,
      model: process.env.TOKENROUTER_CLAUDE_OPUS5_MODEL,
      messages: withModelScopedGuidance("claude-opus-5", translated.messages ?? []),
    };
    const outcomes: ProbeOutcome[] = [];

    for (const [index, credential] of credentials.entries()) {
      outcomes.push(await recordDiagnosticProbe(index + 1, () => fetch(`${baseUrl}/v1/chat/completions`, {
        method: "POST",
        headers: { Authorization: `Bearer ${credential}`, "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(30_000),
      })));
    }

    console.info("[TokenRouter Claude Opus 5 exact translated payload probe]", outcomes);
    expect(outcomes).toHaveLength(credentials.length);
  }, 135_000);
});
import { translateAnthropicRequest } from "./anthropicGateway";
import { withModelScopedGuidance } from "./openaiGateway";
