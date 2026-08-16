import { describe, expect, it } from "vitest";

const runLiveProbe = process.env.RUN_KIMI_K3_LIVE_PROBE === "true";
const liveIt = runLiveProbe ? it : it.skip;
const runToolProbe = process.env.RUN_KIMI_K3_TOOL_PROBE === "true";
const toolIt = runToolProbe ? it : it.skip;
const runReasoningProbe = process.env.RUN_KIMI_K3_REASONING_PROBE === "true";
const reasoningIt = runReasoningProbe ? it : it.skip;
const runMaxReasoningProbe = process.env.RUN_KIMI_K3_REASONING_MAX_PROBE === "true";
const maxReasoningIt = runMaxReasoningProbe ? it : it.skip;

describe("Cluster Protocol Kimi K3 completion authorization", () => {
  liveIt("accepts a minimal Kimi K3 completion for every configured credential slot", async () => {
    const baseUrl = process.env.CLUSTER_PROTOCOL_BASE_URL?.replace(/\/$/, "");
    const credentials = [
      process.env.CLUSTER_PROTOCOL_API_KEY,
      process.env.CLUSTER_PROTOCOL_API_KEY_2,
      process.env.CLUSTER_PROTOCOL_API_KEY_3,
    ];

    expect(baseUrl).toBeTruthy();
    expect(credentials.every(Boolean)).toBe(true);

    const responses = await Promise.all(credentials.map(async credential => {
      try {
        const response = await fetch(`${baseUrl}/v1/chat/completions`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${credential}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "kimi-k3",
            messages: [{ role: "user", content: "Reply with OK." }],
            max_tokens: 4,
            stream: false,
          }),
          signal: AbortSignal.timeout(100_000),
        });
        return { status: response.status, ok: response.ok, outcome: "response" as const };
      } catch (error) {
        return { status: null, ok: false, outcome: error instanceof Error ? error.name : "unknown_error" };
      }
    }));

    responses.forEach((result, index) => {
      expect(result.ok, `Kimi K3 completion failed for Cluster Protocol credential slot ${index + 1}: ${result.outcome}${result.status === null ? "" : ` HTTP ${result.status}`}`).toBe(true);
    });
  }, 115_000);

  toolIt("accepts a Claude Code-style tool-capable request without unsupported roles", async () => {
    const baseUrl = process.env.CLUSTER_PROTOCOL_BASE_URL?.replace(/\/$/, "");
    const apiKey = process.env.CLUSTER_PROTOCOL_API_KEY;
    expect(baseUrl).toBeTruthy();
    expect(apiKey).toBeTruthy();

    const response = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "kimi-k3",
        messages: [
          { role: "user", content: "[System context]\nYou are a coding assistant.\n\nSay hello." },
        ],
        tools: [{
          type: "function",
          function: {
            name: "read_file",
            description: "Read a file.",
            parameters: { type: "object", properties: { path: { type: "string" } }, required: ["path"] },
          },
        }],
        max_tokens: 32,
        stream: false,
      }),
      signal: AbortSignal.timeout(100_000),
    });

    expect(response.ok, `Kimi K3 rejected a tool-capable request with HTTP ${response.status}`).toBe(true);
  }, 115_000);

  reasoningIt("reports whether the OpenAI-style high reasoning effort control is accepted", async () => {
    const baseUrl = process.env.CLUSTER_PROTOCOL_BASE_URL?.replace(/\/$/, "");
    const apiKey = process.env.CLUSTER_PROTOCOL_API_KEY;
    expect(baseUrl).toBeTruthy();
    expect(apiKey).toBeTruthy();

    const response = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "kimi-k3",
        messages: [{ role: "user", content: "Reply with OK." }],
        reasoning_effort: "high",
        max_tokens: 8,
        stream: false,
      }),
      signal: AbortSignal.timeout(100_000),
    });

    expect(response.ok, `Kimi K3 rejected reasoning_effort=high with HTTP ${response.status}`).toBe(true);

    const payload = await response.json() as {
      choices?: Array<{ message?: { reasoning_content?: unknown } }>;
    };
    const reasoningContent = payload.choices?.[0]?.message?.reasoning_content;
    console.info("[Kimi K3 reasoning probe]", {
      parameter: "reasoning_effort",
      value: "high",
      status: response.status,
      reasoningMetadataPresent: typeof reasoningContent === "string",
    });
    expect(typeof reasoningContent === "string" || reasoningContent === undefined).toBe(true);
  }, 115_000);

  maxReasoningIt("reports whether the exact max reasoning effort control is accepted", async () => {
    const baseUrl = process.env.CLUSTER_PROTOCOL_BASE_URL?.replace(/\/$/, "");
    const apiKey = process.env.CLUSTER_PROTOCOL_API_KEY;
    expect(baseUrl).toBeTruthy();
    expect(apiKey).toBeTruthy();

    const response = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "kimi-k3",
        messages: [{ role: "user", content: "Reply with OK." }],
        reasoning_effort: "max",
        max_tokens: 8,
        stream: false,
      }),
      signal: AbortSignal.timeout(100_000),
    });

    expect(response.ok, `Kimi K3 rejected reasoning_effort=max with HTTP ${response.status}`).toBe(true);

    const payload = await response.json() as {
      choices?: Array<{ message?: { reasoning_content?: unknown } }>;
    };
    const reasoningContent = payload.choices?.[0]?.message?.reasoning_content;
    console.info("[Kimi K3 max reasoning probe]", {
      parameter: "reasoning_effort",
      value: "max",
      status: response.status,
      reasoningMetadataPresent: typeof reasoningContent === "string",
    });
    expect(typeof reasoningContent === "string" || reasoningContent === undefined).toBe(true);
  }, 115_000);
});
