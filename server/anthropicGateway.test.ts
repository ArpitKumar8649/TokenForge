import { describe, expect, it } from "vitest";
import {
  AnthropicBridgeError,
  anthropicApiKey,
  estimateFullAnthropicInputTokens,
  estimateSingleImageTokens,
  tryExtractImageDimensions,
  isNativeTokenRouterMessagesRequest,
  providerResponseStartTimeoutMs,
  translateAnthropicRequest,
  translateOpenAiMessageResponse,
  scaleUsageProportionally,
  isClaudeCodeRequest,
  CLAUDE_CODE_REPORTED_COMPACT_TOTAL,
  estimateAnthropicCacheBreakdown,
} from "./anthropicGateway";
import { parseContextTokens } from "./db";
import {
  PUBLIC_PROVIDER_ERROR_MESSAGE,
  publicProviderErrorMessage,
  publicProviderFailureStatus,
  sanitizeUpstreamChatInput,
} from "./openaiGateway";

describe("TokenForge Anthropic Messages bridge", () => {
  it("uses the shared neutral error envelope for caller-facing managed-provider failures", () => {
    expect(publicProviderErrorMessage(400)).toBe(PUBLIC_PROVIDER_ERROR_MESSAGE);
    expect(publicProviderErrorMessage(503)).toBe(PUBLIC_PROVIDER_ERROR_MESSAGE);
  });

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
    expect(translateAnthropicRequest({ model: "claude-fable-5.1", messages: [{ role: "user", content: "Reply with OK." }], reasoning_effort: "low" } as Parameters<typeof translateAnthropicRequest>[0] & { reasoning_effort: "low" }).reasoning_effort).toBe("xhigh");
    expect(translateAnthropicRequest({ model: "gpt-5", messages: [{ role: "user", content: "Reply with OK." }] }).reasoning_effort).toBeUndefined();
  });

  it("uses the same two-minute response-start handling for every model route", () => {
    expect(providerResponseStartTimeoutMs("claude-opus-5")).toBe(120_000);
    expect(providerResponseStartTimeoutMs("claude-fable-5.1")).toBe(120_000);
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
      {
        role: "user",
        content: "[System context]\nUse repository-safe commands.\n\nInspect the repository.\n\n[Tool result]\nREADME.md exists.\n\n<system-reminder>\nReturn a concise summary.\n</system-reminder>",
      },
    ]);
    expect(translated.messages?.every(message => message.role === "user" || message.role === "assistant")).toBe(true);
  });

  it("translates the supported Claude, GLM 5.3, DeepSeek V4 Pro, and GPT-6 Astra models through their compatible Chat Completions routes", () => {
    expect(isNativeTokenRouterMessagesRequest({ model: "claude-opus-5", system: "Be concise.", messages: [{ role: "user", content: "Hello" }] })).toBe(false);
    expect(isNativeTokenRouterMessagesRequest({ model: "claude-fable-5.1", system: "Be concise.", messages: [{ role: "user", content: "Hello" }] })).toBe(false);
    expect(translateAnthropicRequest({ model: "claude-opus-5", messages: [{ role: "user", content: "Hello" }] })).toMatchObject({ model: "claude-opus-5" });
    expect(translateAnthropicRequest({ model: "gpt-6-astra", messages: [{ role: "user", content: "Hello" }] })).toMatchObject({ model: "gpt-6-astra" });
    expect(translateAnthropicRequest({ model: "claude-fable-5.1", messages: [{ role: "user", content: "Hello" }] })).toMatchObject({ model: "claude-fable-5.1", reasoning_effort: "xhigh" });
    expect(translateAnthropicRequest({ model: "glm-5.3", messages: [{ role: "user", content: "Hello" }] })).toMatchObject({ model: "glm-5.3" });
    expect(translateAnthropicRequest({ model: "deepseek-v4-pro", messages: [{ role: "user", content: "Hello" }] })).toMatchObject({ model: "deepseek-v4-pro" });
    expect(translateAnthropicRequest({ model: "qwen3.8-27b", messages: [{ role: "user", content: "Hello" }] })).toMatchObject({ model: "qwen3.8-27b" });
    expect(translateAnthropicRequest({ model: "qwen3.8-max", messages: [{ role: "user", content: "Hello" }] })).toMatchObject({ model: "qwen3.8-max" });
    expect(() => translateAnthropicRequest({ model: "glm-5.2", messages: [{ role: "user", content: "Hello" }] })).toThrow(AnthropicBridgeError);
    expect(() => translateAnthropicRequest({ model: "kimi-k3", messages: [{ role: "user", content: [{ type: "image", source: {} }] }] })).toThrow("requires valid base64 data or URL");
    const imageTranslated = translateAnthropicRequest({
      model: "claude-sonnet-4.6",
      messages: [{
        role: "user",
        content: [
          { type: "text", text: "What is this?" },
          { type: "image", source: { type: "base64", media_type: "image/png", data: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==" } }
        ]
      }]
    });
    expect(imageTranslated.messages?.[0]?.content).toEqual([
      { type: "text", text: "What is this?" },
      { type: "image_url", image_url: { url: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==" } },
    ]);
  });

  it("accepts any positive safe Claude Opus 5 max_tokens value without a TokenForge ceiling", () => {
    expect(translateAnthropicRequest({ model: "claude-opus-5", messages: [{ role: "user", content: "Hello" }], max_tokens: 2_000_000 })).toMatchObject({ max_tokens: 2_000_000 });
    expect(() => translateAnthropicRequest({ model: "claude-opus-5", messages: [{ role: "user", content: "Hello" }], max_tokens: 0 })).toThrow("positive safe integer");
    expect(() => translateAnthropicRequest({ model: "claude-opus-5", messages: [{ role: "user", content: "Hello" }], max_tokens: Number.MAX_SAFE_INTEGER + 1 })).toThrow("positive safe integer");
  });

  it("translates Claude Code content and tools for Claude Fable 5.1 through the compatible TokenRouter Chat Completions route", () => {
    const translated = translateAnthropicRequest({
      model: "claude-fable-5.1",
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
    expect(translated).toMatchObject({ model: "claude-fable-5.1", stream: true, max_tokens: 2048, reasoning_effort: "xhigh" });
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
    expect(translated.messages?.at(-1)?.content).toContain("Additional Claude Code context.");
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

  it("preserves GLM 5.3 Claude Code tool history with native OpenAI tool-result linkage", () => {
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
      { role: "assistant", content: null, tool_calls: [{ id: "tool_1", type: "function", function: { name: "List", arguments: "{\"path\":\".\"}" } }] },
      { role: "tool", tool_call_id: "tool_1", content: "README.md\npackage.json" },
    ]);
  });

  it("replays GLM 5.3 private reasoning continuation when present in the continuation cache", () => {
    const continuations = new Map([
      ["tool_1", {
        role: "assistant" as const,
        content: null,
        reasoning_content: "thinking deeply about files",
        tool_calls: [{ id: "tool_1", type: "function" as const, function: { name: "List", arguments: "{\"path\":\".\"}" } }],
      }],
    ]);
    const translated = translateAnthropicRequest({
      model: "glm-5.3",
      messages: [
        { role: "user", content: "Inspect the repository." },
        { role: "assistant", content: [{ type: "tool_use", id: "tool_1", name: "List", input: { path: "." } }] },
        { role: "user", content: [{ type: "tool_result", tool_use_id: "tool_1", content: "README.md" }] },
      ],
      tools: [{ name: "List", input_schema: { type: "object", properties: { path: { type: "string" } } } }],
    }, continuations);

    expect(translated.messages).toEqual([
      { role: "user", content: "Inspect the repository." },
      { role: "assistant", content: null, reasoning_content: "thinking deeply about files", tool_calls: [{ id: "tool_1", type: "function", function: { name: "List", arguments: "{\"path\":\".\"}" } }] },
      { role: "tool", tool_call_id: "tool_1", content: "README.md" },
    ]);
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

  it("does not misrepresent exhausted upstream 401 and 403 responses as caller authentication failures, and masks upstream 400 as 503", () => {
    expect(publicProviderFailureStatus(401)).toBe(503);
    expect(publicProviderFailureStatus(403)).toBe(503);
    expect(publicProviderFailureStatus(429)).toBe(429);
    expect(publicProviderFailureStatus(400)).toBe(503);
  });

  it("normalizes and sanitizes chat input parameters for upstream providers", () => {
    const inputWithMaxCompletionTokens = {
      model: "claude-opus-5",
      messages: [{ role: "user", content: "Hello" }],
      max_completion_tokens: 4096,
      anthropic_beta: "tools-2024-04-04",
      thinking: { type: "enabled" },
    } as any;

    const sanitized = sanitizeUpstreamChatInput(inputWithMaxCompletionTokens);
    expect(sanitized.max_tokens).toBe(4096);
    expect((sanitized as any).max_completion_tokens).toBeUndefined();
    expect((sanitized as any).anthropic_beta).toBeUndefined();
    expect((sanitized as any).thinking).toBeUndefined();
  });

  it("routes gpt-6-astra through translateAnthropicRequest like Claude Opus 5", () => {
    const translated = translateAnthropicRequest({
      model: "gpt-6-astra",
      messages: [
        { role: "user", content: "Write a high-performance function." },
      ],
      system: "You are an expert engineer.",
      max_tokens: 8192,
      stream: true,
    });
    expect(translated.model).toBe("gpt-6-astra");
    expect(translated.stream).toBe(true);
    expect(translated.max_tokens).toBe(8192);
    expect(translated.messages).toEqual([
      { role: "system", content: "You are an expert engineer." },
      { role: "user", content: "Write a high-performance function." },
    ]);
  });

  it("safely estimates input tokens including system, tools, text and capped images without base64 inflation", () => {
    const fake400KbBase64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==".repeat(4000);
    const estimated = estimateFullAnthropicInputTokens({
      system: "You are Claude, an AI software engineer. ".repeat(100),
      tools: [
        {
          name: "bash",
          description: "Execute bash commands",
          input_schema: { type: "object", properties: { command: { type: "string" } }, required: ["command"] },
        },
      ],
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: "Please inspect this code and screenshot. ".repeat(400) },
            { type: "image", source: { type: "base64", media_type: "image/png", data: fake400KbBase64 } },
          ],
        },
      ],
    });

    // Should be in realistic 5k-8k range, definitely not inflated to 300k+ by base64 chars
    expect(estimated).toBeGreaterThan(4000);
    expect(estimated).toBeLessThan(10000);
  });

  it("translates OpenAI upstream usage with prompt cache mapping to Anthropic format", () => {
    const mockPayload = {
      id: "chatcmpl_abc123",
      choices: [{ finish_reason: "stop", message: { role: "assistant", content: "Done!" } }],
      usage: {
        prompt_tokens: 15000,
        completion_tokens: 120,
        total_tokens: 15120,
        prompt_tokens_details: {
          cached_tokens: 12000,
        },
      },
    };

    const translated = translateOpenAiMessageResponse("claude-opus-5", mockPayload, 5000);
    expect(translated.usage).toEqual({
      input_tokens: 3000, // 15000 - 12000 cached
      output_tokens: 120,
      cache_read_input_tokens: 12000,
    });
  });

  it("extracts image dimensions and calculates (width * height) / 750 capped at 1600 tokens", () => {
    // 1x1 1-pixel PNG
    const png1x1 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
    const dims1x1 = tryExtractImageDimensions(png1x1);
    expect(dims1x1).toEqual({ width: 1, height: 1 });
    // (1 * 1) / 750 = 1 token
    expect(estimateSingleImageTokens(png1x1)).toBe(1);

    // Synthesize 1200x800 PNG header (8 bytes magic, 4 bytes len, 'IHDR', 4 bytes width, 4 bytes height)
    const pngBuf1200x800 = Buffer.alloc(24);
    pngBuf1200x800.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
    pngBuf1200x800.writeUInt32BE(13, 8);
    pngBuf1200x800.write("IHDR", 12, "ascii");
    pngBuf1200x800.writeUInt32BE(1200, 16);
    pngBuf1200x800.writeUInt32BE(800, 20);
    const b64_1200x800 = pngBuf1200x800.toString("base64");

    const dims1200x800 = tryExtractImageDimensions(b64_1200x800);
    expect(dims1200x800).toEqual({ width: 1200, height: 800 });
    // (1200 * 800) / 750 = 960000 / 750 = 1280 tokens
    expect(estimateSingleImageTokens(b64_1200x800)).toBe(1280);

    // Synthesize 4000x3000 PNG header -> (4000 * 3000) / 750 = 16000 -> must cap at 1600
    const pngBuf4000x3000 = Buffer.alloc(24);
    pngBuf4000x3000.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
    pngBuf4000x3000.writeUInt32BE(13, 8);
    pngBuf4000x3000.write("IHDR", 12, "ascii");
    pngBuf4000x3000.writeUInt32BE(4000, 16);
    pngBuf4000x3000.writeUInt32BE(3000, 20);
    const b64_4000x3000 = pngBuf4000x3000.toString("base64");

    expect(tryExtractImageDimensions(b64_4000x3000)).toEqual({ width: 4000, height: 3000 });
    expect(estimateSingleImageTokens(b64_4000x3000)).toBe(1600);

    // Fallback when dimensions cannot be obtained (e.g. unparseable string or remote URL)
    expect(estimateSingleImageTokens("https://example.com/screenshot.png")).toBe(1600);
  });

  it("handles DeepSeek and SiliconFlow style prompt_cache_hit_tokens correctly", () => {
    const deepSeekPayload = {
      id: "chatcmpl_ds123",
      choices: [{ finish_reason: "stop", message: { role: "assistant", content: "DeepSeek response" } }],
      usage: {
        prompt_tokens: 8000,
        completion_tokens: 250,
        prompt_cache_hit_tokens: 6500,
        prompt_cache_miss_tokens: 1500,
      },
    };

    const translated = translateOpenAiMessageResponse("claude-opus-5", deepSeekPayload, 2000);
    expect(translated.usage).toEqual({
      input_tokens: 1500, // 8000 - 6500 cached
      output_tokens: 250,
      cache_read_input_tokens: 6500,
      cache_creation_input_tokens: 1500,
    });
  });

  it("promotes reasoning to content when OpenAI content is empty and reasoning_content is present", () => {
    const reasoningPayload = {
      id: "chatcmpl_reasoning_1",
      choices: [{
        finish_reason: "stop",
        message: {
          role: "assistant",
          content: "",
          reasoning_content: "Thought process: The user is asking about quantum computing.",
        },
      }],
      usage: {
        prompt_tokens: 100,
        completion_tokens: 50,
      },
    };

    const translated = translateOpenAiMessageResponse("claude-opus-5", reasoningPayload, 100);
    expect(translated.content).toEqual([
      { type: "text", text: "Thought process: The user is asking about quantum computing." },
    ]);
  });

  describe("Claude Code Auto Compact Scaling (500k -> 980k trigger)", () => {
    it("scales usage proportionally to exactly 980,000 total tokens", () => {
      // 100k input, 350k cache read, 50k cache creation = 500k total
      const scaled = scaleUsageProportionally(100_000, 350_000, 50_000, 980_000);
      expect(scaled.inputTokens + scaled.cacheRead + scaled.cacheCreation).toBe(980_000);
      expect(scaled.inputTokens).toBe(196_000); // 100/500 * 980k = 196k
      expect(scaled.cacheRead).toBe(686_000);   // 350/500 * 980k = 686k
      expect(scaled.cacheCreation).toBe(98_000); // 50/500 * 980k = 98k
    });

    it("handles zero cache tokens by attributing all 980,000 to inputTokens", () => {
      const scaled = scaleUsageProportionally(500_000, 0, 0, 980_000);
      expect(scaled.inputTokens).toBe(980_000);
      expect(scaled.cacheRead).toBe(0);
      expect(scaled.cacheCreation).toBe(0);
      expect(scaled.inputTokens + scaled.cacheRead + scaled.cacheCreation).toBe(980_000);
    });

    it("handles zero total tokens safely", () => {
      const scaled = scaleUsageProportionally(0, 0, 0, 980_000);
      expect(scaled.inputTokens).toBe(980_000);
      expect(scaled.cacheRead).toBe(0);
      expect(scaled.cacheCreation).toBe(0);
    });

    it("identifies Claude Code requests via User-Agent and headers", () => {
      expect(isClaudeCodeRequest({ headers: { "user-agent": "claude-cli/1.0.5 (darwin-arm64)" } } as any)).toBe(true);
      expect(isClaudeCodeRequest({ headers: { "user-agent": "@anthropic-ai/claude-code/0.2.29" } } as any)).toBe(true);
      expect(isClaudeCodeRequest({ headers: { "user-agent": "Anthropic/TypeScript 0.39.0 claude-code/0.2.29" } } as any)).toBe(true);
      expect(isClaudeCodeRequest({ headers: { "user-agent": "Mozilla/5.0", "anthropic-beta": "claude-code-20240229" } } as any)).toBe(true);

      // Rejects non-Claude Code clients
      expect(isClaudeCodeRequest({ headers: { "user-agent": "curl/7.68.0" } } as any)).toBe(false);
      expect(isClaudeCodeRequest({ headers: { "user-agent": "python-requests/2.28.1" } } as any)).toBe(false);
      expect(isClaudeCodeRequest({ headers: { "user-agent": "OpenWebUI/1.0" } } as any)).toBe(false);
      expect(isClaudeCodeRequest({ headers: {} } as any)).toBe(false);
    });

    it("parses context tokens strings like 450k, 500k, 150k, and numbers", () => {
      expect(parseContextTokens("500k")).toBe(500_000);
      expect(parseContextTokens("450k")).toBe(450_000);
      expect(parseContextTokens("150k")).toBe(150_000);
      expect(parseContextTokens("1M")).toBe(1_000_000);
      expect(parseContextTokens("0.5m")).toBe(500_000);
      expect(parseContextTokens("500000")).toBe(500_000);
      expect(parseContextTokens(450000)).toBe(450_000);
      expect(parseContextTokens("invalid")).toBe(500_000); // default
    });

    it("estimates cache breakdown accurately from Claude Code prompts", () => {
      const promptWithCache = {
        system: [{ type: "text", text: "System instructions", cache_control: { type: "ephemeral" } }],
        tools: [{ name: "search", description: "Search", cache_control: { type: "ephemeral" } }],
        messages: [
          { role: "user", content: "Hello" },
        ],
      };
      const breakdown = estimateAnthropicCacheBreakdown(promptWithCache);
      expect(breakdown.cacheReadTokens).toBeGreaterThan(0);
      expect(breakdown.inputTokens).toBeGreaterThan(0);
      expect(breakdown.totalTokens).toBe(breakdown.cacheReadTokens + breakdown.inputTokens);
    });
  });
});
