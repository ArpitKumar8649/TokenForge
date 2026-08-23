import { describe, expect, it } from "vitest";
import {
  AnthropicBridgeError,
  anthropicApiKey,
  isNativeTokenRouterMessagesRequest,
  providerResponseStartTimeoutMs,
  translateAnthropicRequest,
  translateOpenAiMessageResponse,
} from "./anthropicGateway";
import { publicProviderFailureStatus } from "./openaiGateway";

describe("TokenForge Anthropic Messages bridge", () => {
  it("prefers Claude-style x-api-key authentication and supports Bearer fallback", () => {
    const xApiKeyRequest = { header: (name: string) => name === "x-api-key" ? "tf_live_x" : "Bearer tf_live_y" };
    const bearerRequest = { header: (name: string) => name === "authorization" ? "Bearer tf_live_y" : undefined };
    expect(anthropicApiKey(xApiKeyRequest as never)).toBe("tf_live_x");
    expect(anthropicApiKey(bearerRequest as never)).toBe("tf_live_y");
  });

  it("translates system content, text blocks, tool calls, and tool results without forwarding a tool role for a system-role-capable model", () => {
    const translated = translateAnthropicRequest({
      model: "gpt-5",
      system: [{ type: "text", text: "Act carefully." }],
      messages: [
        { role: "user", content: [{ type: "text", text: "Inspect the repository." }] },
        { role: "assistant", content: [{ type: "tool_use", id: "tool_1", name: "read_file", input: { path: "README.md" } }] },
        { role: "user", content: [{ type: "tool_result", tool_use_id: "tool_1", content: "file contents" }] },
      ],
      tools: [{ name: "read_file", description: "Read a file", input_schema: { type: "object", properties: { path: { type: "string" } } } }],
      stream: true,
      max_tokens: 2048,
    });

    expect(translated.messages).toEqual([
      { role: "system", content: "Act carefully." },
      { role: "user", content: "Inspect the repository." },
      expect.objectContaining({ role: "assistant", tool_calls: [expect.objectContaining({ id: "tool_1", function: expect.objectContaining({ name: "read_file" }) })] }),
      { role: "user", content: "[Tool Result for tool_1]:\nfile contents" },
    ]);
    expect(translated.messages?.some(message => message.role === "tool")).toBe(false);
    expect(translated.tools).toEqual([expect.objectContaining({ type: "function", function: expect.objectContaining({ name: "read_file" }) })]);
    expect(translated.stream).toBe(true);
    expect(translated.max_tokens).toBe(2048);
  });

  it("enforces model-scoped reasoning internally without trusting caller-supplied controls", () => {
    const translated = translateAnthropicRequest({
      model: "kimi-k3",
      messages: [{ role: "user", content: "Reply with OK." }],
      max_tokens: 8,
      reasoning_effort: "low",
    } as Parameters<typeof translateAnthropicRequest>[0] & { reasoning_effort: "low" });

    expect(translated.reasoning_effort).toBe("max");
    expect(translateAnthropicRequest({ model: "claude-fable-5", messages: [{ role: "user", content: "Reply with OK." }], reasoning_effort: "low" } as Parameters<typeof translateAnthropicRequest>[0] & { reasoning_effort: "low" }).reasoning_effort).toBe("xhigh");
    expect(translateAnthropicRequest({ model: "gpt-5", messages: [{ role: "user", content: "Reply with OK." }] }).reasoning_effort).toBeUndefined();
  });

  it("uses the same two-minute response-start handling for every model route", () => {
    expect(providerResponseStartTimeoutMs("claude-opus-5")).toBe(120_000);
    expect(providerResponseStartTimeoutMs("claude-fable-5")).toBe(120_000);
    expect(providerResponseStartTimeoutMs("qwen-3.8-max")).toBe(120_000);
  });

  it("normalizes Claude Code tool and instruction turns for Kimi K3 into supported user and assistant roles", () => {
    const translated = translateAnthropicRequest({
      model: "kimi-k3",
      system: "Use repository-safe commands.",
      messages: [
        { role: "user", content: "Inspect the repository." },
        { role: "tool", content: "README.md exists." },
        { role: "developer", content: "Return a concise summary." },
      ],
    });

    expect(translated.messages).toEqual([
      { role: "user", content: "[System context]\nUse repository-safe commands.\n\nReturn a concise summary.\n\nInspect the repository." },
      { role: "user", content: "[Tool result]\nREADME.md exists." },
    ]);
    expect(translated.messages?.every(message => message.role === "user" || message.role === "assistant")).toBe(true);
  });

  it("translates the supported Claude, GLM 5.3, and DeepSeek V4 Pro models through their compatible Chat Completions routes", () => {
    expect(isNativeTokenRouterMessagesRequest({ model: "claude-opus-5", system: "Be concise.", messages: [{ role: "user", content: "Hello" }] })).toBe(false);
    expect(isNativeTokenRouterMessagesRequest({ model: "claude-fable-5", system: "Be concise.", messages: [{ role: "user", content: "Hello" }] })).toBe(false);
    expect(translateAnthropicRequest({ model: "claude-opus-5", messages: [{ role: "user", content: "Hello" }] })).toMatchObject({ model: "claude-opus-5" });
    expect(translateAnthropicRequest({ model: "claude-fable-5", messages: [{ role: "user", content: "Hello" }] })).toMatchObject({ model: "claude-fable-5", reasoning_effort: "xhigh" });
    expect(translateAnthropicRequest({ model: "glm-5.3", messages: [{ role: "user", content: "Hello" }] })).toMatchObject({ model: "glm-5.3" });
    expect(translateAnthropicRequest({ model: "deepseek-v4-pro", messages: [{ role: "user", content: "Hello" }] })).toMatchObject({ model: "deepseek-v4-pro" });
    expect(translateAnthropicRequest({ model: "qwen3.8-27b", messages: [{ role: "user", content: "Hello" }] })).toMatchObject({ model: "qwen3.8-27b" });
    expect(translateAnthropicRequest({ model: "qwen3.8-max", messages: [{ role: "user", content: "Hello" }] })).toMatchObject({ model: "qwen3.8-max" });
    expect(() => translateAnthropicRequest({ model: "glm-5.2", messages: [{ role: "user", content: "Hello" }] })).toThrow(AnthropicBridgeError);
    expect(() => translateAnthropicRequest({ model: "kimi-k3", messages: [{ role: "user", content: [{ type: "image", source: {} }] }] })).toThrow("text and tool blocks only");
  });

  it("accepts any positive safe Claude Opus 5 max_tokens value without a TokenForge ceiling", () => {
    expect(translateAnthropicRequest({ model: "claude-opus-5", messages: [{ role: "user", content: "Hello" }], max_tokens: 2_000_000 })).toMatchObject({ max_tokens: 2_000_000 });
    expect(() => translateAnthropicRequest({ model: "claude-opus-5", messages: [{ role: "user", content: "Hello" }], max_tokens: 0 })).toThrow("positive safe integer");
    expect(() => translateAnthropicRequest({ model: "claude-opus-5", messages: [{ role: "user", content: "Hello" }], max_tokens: Number.MAX_SAFE_INTEGER + 1 })).toThrow("positive safe integer");
  });

  it("translates Claude Code content and tools for Claude Fable 5 through the compatible TokenRouter Chat Completions route", () => {
    const translated = translateAnthropicRequest({
      model: "claude-fable-5",
      system: [{ type: "text", text: "Use safe repository operations." }],
      messages: [{ role: "user", content: [{ type: "text", text: "Inspect README.md" }] }],
      tools: [{ name: "read_file", input_schema: { type: "object", properties: { path: { type: "string" } } } }],
      max_tokens: 2048,
      stream: true,
    });

    expect(translated.messages).toEqual([
      { role: "system", content: "Use safe repository operations." },
      { role: "user", content: "Inspect README.md" },
    ]);
    expect(translated.tools).toEqual([expect.objectContaining({ type: "function", function: expect.objectContaining({ name: "read_file" }) })]);
    expect(translated).toMatchObject({ model: "claude-fable-5", stream: true, max_tokens: 2048, reasoning_effort: "xhigh" });
  });

  it("collapses the real Claude Code top-level and mid-conversation system instructions into one TokenRouter-compatible turn", () => {
    const translated = translateAnthropicRequest({
      model: "claude-opus-5",
      system: [
        { type: "text", text: "Project instruction." },
        { type: "text", text: "Safety instruction." },
        { type: "text", text: "Long Claude Code instruction block." },
      ],
      messages: [
        { role: "user", content: [{ type: "text", text: "Inspect the repository." }] },
        { role: "system", content: [{ type: "text", text: "Additional Claude Code context." }] },
      ],
      tools: [{ name: "Read", input_schema: { type: "object", properties: { path: { type: "string" } } } }],
      stream: true,
      max_tokens: 64_000,
    });

    const systemMessages = translated.messages?.filter(message => message.role === "system") ?? [];
    expect(systemMessages).toHaveLength(1);
    expect(systemMessages[0]?.content).toContain("Project instruction.");
    expect(systemMessages[0]?.content).toContain("Additional Claude Code context.");
    expect(translated.messages?.at(-1)).toEqual({ role: "user", content: "Inspect the repository." });
    expect(translated).toMatchObject({ model: "claude-opus-5", stream: true, max_tokens: 64_000 });
  });

  it("drops unverifiable Claude Code thinking history while preserving safe Claude Opus 5 conversation turns through translation", () => {
    const translated = translateAnthropicRequest({
      model: "claude-opus-5",
      messages: [
        { role: "user", content: "Inspect the repository." },
        { role: "assistant", content: [{ type: "thinking", thinking: "private reasoning", signature: "opaque" }, { type: "text", text: "I will inspect it." }] },
        { role: "user", content: "Continue." },
      ],
    });
    expect(translated.messages).toHaveLength(3);
    expect(JSON.stringify(translated.messages)).not.toContain("private reasoning");
    expect(translated.messages?.[1]).toMatchObject({ role: "assistant", content: "I will inspect it." });
  });

  it("preserves Claude Code tool-result linkage through Claude Opus 5 translation", () => {
    const translated = translateAnthropicRequest({
      model: "claude-opus-5",
      messages: [
        { role: "user", content: "Inspect the repository." },
        { role: "assistant", content: [{ type: "tool_use", id: "tool_1", name: "read_file", input: { path: "README.md" } }] },
        { role: "user", content: [{ type: "tool_result", tool_use_id: "tool_1", content: "file contents" }] },
      ],
      tools: [{ name: "read_file", input_schema: { type: "object", properties: { path: { type: "string" } } } }],
    });

    expect(translated.messages).toEqual([
      { role: "user", content: "Inspect the repository." },
      { role: "assistant", content: null, tool_calls: [{ id: "tool_1", type: "function", function: { name: "read_file", arguments: "{\"path\":\"README.md\"}" } }] },
      { role: "tool", tool_call_id: "tool_1", content: "file contents" },
    ]);
  });

  it("normalizes GLM 5.3 Claude Code tool history without a provider-private reasoning requirement", () => {
    const translated = translateAnthropicRequest({
      model: "glm-5.3",
      messages: [
        { role: "user", content: "Inspect the repository." },
        { role: "assistant", content: [{ type: "tool_use", id: "tool_1", name: "List", input: { path: "." } }] },
        { role: "user", content: [{ type: "tool_result", tool_use_id: "tool_1", content: "README.md\npackage.json" }] },
      ],
      tools: [{ name: "List", input_schema: { type: "object", properties: { path: { type: "string" } } } }],
    });

    expect(translated.messages).toEqual([
      { role: "user", content: "Inspect the repository." },
      { role: "assistant", content: "[Tool call: List]\n{\"path\":\".\"}" },
      { role: "user", content: "[Tool Result for tool_1]:\nREADME.md\npackage.json" },
    ]);
    expect(translated.messages?.some(message => message.role === "tool" || "tool_calls" in message)).toBe(false);
  });

  it("forwards a 300-entry Claude history without compaction or a raw-entry refusal", () => {
    const translated = translateAnthropicRequest({
      model: "claude-opus-5",
      messages: Array.from({ length: 300 }, (_, index) => ({ role: index % 2 ? "assistant" : "user", content: `turn-${index}` })),
    });

    expect(translated.messages).toHaveLength(300);
    expect(translated.messages?.at(-1)).toEqual({ role: "assistant", content: "turn-299" });
    expect(translated.messages?.some(message => typeof message.content === "string" && message.content.includes("compacted by TokenForge"))).toBe(false);
  });

  it("converts an OpenAI-style Cluster tool call into an Anthropic Messages response", () => {
    expect(translateOpenAiMessageResponse("kimi-k3", {
      id: "chat_1",
      choices: [{ finish_reason: "tool_calls", message: { content: null, tool_calls: [{ id: "call_1", function: { name: "read_file", arguments: "{\"path\":\"README.md\"}" } }] } }],
      usage: { prompt_tokens: 11, completion_tokens: 7 },
    })).toMatchObject({
      id: "chat_1",
      model: "kimi-k3",
      stop_reason: "tool_use",
      usage: { input_tokens: 11, output_tokens: 7 },
      content: [{ type: "tool_use", id: "call_1", name: "read_file", input: { path: "README.md" } }],
    });
  });

  it("does not misrepresent exhausted upstream 401 and 403 responses as caller authentication failures", () => {
    expect(publicProviderFailureStatus(401)).toBe(503);
    expect(publicProviderFailureStatus(403)).toBe(503);
    expect(publicProviderFailureStatus(429)).toBe(429);
    expect(publicProviderFailureStatus(400)).toBe(400);
  });
});
