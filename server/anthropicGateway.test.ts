import { describe, expect, it } from "vitest";
import {
  AnthropicBridgeError,
  anthropicApiKey,
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

  it("enforces maximum reasoning internally for Kimi K3 without trusting a caller-supplied control", () => {
    const translated = translateAnthropicRequest({
      model: "kimi-k3",
      messages: [{ role: "user", content: "Reply with OK." }],
      max_tokens: 8,
      reasoning_effort: "low",
    } as Parameters<typeof translateAnthropicRequest>[0] & { reasoning_effort: "low" });

    expect(translated.reasoning_effort).toBe("max");
    expect(translateAnthropicRequest({ model: "gpt-5", messages: [{ role: "user", content: "Reply with OK." }] }).reasoning_effort).toBeUndefined();
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

  it("allows all OrcaRouter-backed Messages models while rejecting unsupported routes and image-content requests", () => {
    expect(translateAnthropicRequest({ model: "claude-opus-5", system: "Be concise.", messages: [{ role: "user", content: "Hello" }] })).toMatchObject({ model: "claude-opus-5" });
    expect(translateAnthropicRequest({ model: "qwen3.8-27b", messages: [{ role: "user", content: "Hello" }] })).toMatchObject({ model: "qwen3.8-27b" });
    expect(() => translateAnthropicRequest({ model: "glm-5.2", messages: [{ role: "user", content: "Hello" }] })).toThrow(AnthropicBridgeError);
    expect(() => translateAnthropicRequest({ model: "kimi-k3", messages: [{ role: "user", content: [{ type: "image", source: {} }] }] })).toThrow("text and tool blocks only");
  });

  it("accepts any positive safe max_tokens value without a TokenForge ceiling", () => {
    expect(translateAnthropicRequest({ model: "claude-opus-5", messages: [{ role: "user", content: "Hello" }], max_tokens: 2_000_000 })).toMatchObject({ max_tokens: 2_000_000 });
    expect(() => translateAnthropicRequest({ model: "claude-opus-5", messages: [{ role: "user", content: "Hello" }], max_tokens: 0 })).toThrow("positive safe integer");
    expect(() => translateAnthropicRequest({ model: "claude-opus-5", messages: [{ role: "user", content: "Hello" }], max_tokens: Number.MAX_SAFE_INTEGER + 1 })).toThrow("positive safe integer");
  });

  it("accepts Claude Code thinking history without forwarding private reasoning as assistant text", () => {
    const translated = translateAnthropicRequest({
      model: "claude-opus-5",
      messages: [
        { role: "user", content: "Inspect the repository." },
        { role: "assistant", content: [{ type: "thinking", thinking: "private reasoning", signature: "opaque" }, { type: "text", text: "I will inspect it." }] },
        { role: "user", content: "Continue." },
      ],
    });
    expect(translated.messages).toEqual([
      { role: "user", content: "Inspect the repository." },
      { role: "assistant", content: "I will inspect it." },
      { role: "user", content: "Continue." },
    ]);
    expect(JSON.stringify(translated.messages)).not.toContain("private reasoning");
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
