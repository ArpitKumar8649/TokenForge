import { describe, expect, it } from "vitest";
import {
  AnthropicBridgeError,
  anthropicApiKey,
  translateAnthropicRequest,
  translateOpenAiMessageResponse,
} from "./anthropicGateway";

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

  it("rejects non-Cluster models and unsupported image content before upstream routing", () => {
    expect(() => translateAnthropicRequest({ model: "glm-5.2", messages: [{ role: "user", content: "Hello" }] })).toThrow(AnthropicBridgeError);
    expect(() => translateAnthropicRequest({ model: "kimi-k3", messages: [{ role: "user", content: [{ type: "image", source: {} }] }] })).toThrow("text and tool blocks only");
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
});
