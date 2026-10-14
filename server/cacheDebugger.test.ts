import { describe, it, expect, beforeEach } from "vitest";
import {
  setCacheDebugEnabled,
  clearCacheDebugEntries,
  recordCacheDebugEvent,
  getCacheDebugSummaries,
  getCacheDebugEntry,
  computeCacheDiffBetweenEntries,
  exportCacheDebugJsonl,
  sanitizePayloadForDebug,
  generateSessionId,
  isCacheDebugEnabled,
  type CacheDebugEntry,
} from "./cacheDebugger";

describe("Cache Debugger & Byte-by-Byte Diff Engine", () => {
  beforeEach(() => {
    clearCacheDebugEntries();
    setCacheDebugEnabled(true);
  });

  it("toggles cache debugger on and off", () => {
    setCacheDebugEnabled(false);
    expect(isCacheDebugEnabled()).toBe(false);

    recordCacheDebugEvent({
      sessionId: "s1",
      model: "claude-3-5-sonnet",
      providerLabel: "Primary",
      source: "api_anthropic",
      incomingBody: "{}",
      upstreamBody: "{}",
      promptTokens: 100,
      cachedTokens: 50,
      completionTokens: 20,
      totalTokens: 120,
      latencyMs: 300,
      status: 200,
    });
    expect(getCacheDebugSummaries()).toHaveLength(0);

    setCacheDebugEnabled(true);
    expect(isCacheDebugEnabled()).toBe(true);
    recordCacheDebugEvent({
      sessionId: "s1",
      model: "claude-3-5-sonnet",
      providerLabel: "Primary",
      source: "api_anthropic",
      incomingBody: "{}",
      upstreamBody: "{}",
      promptTokens: 100,
      cachedTokens: 50,
      completionTokens: 20,
      totalTokens: 120,
      latencyMs: 300,
      status: 200,
    });
    expect(getCacheDebugSummaries()).toHaveLength(1);
  });

  it("redacts sensitive keys, auth headers, and secrets", () => {
    const raw = JSON.stringify({
      apiKey: "sk-secret-key-12345",
      authorization: "Bearer secret-token-xyz",
      messages: [{ role: "user", content: "Hello TokenForge" }],
    });

    const sanitized = sanitizePayloadForDebug(raw);
    expect(sanitized).not.toContain("sk-secret-key-12345");
    expect(sanitized).not.toContain("secret-token-xyz");
    expect(sanitized).toContain("[REDACTED]");
    expect(sanitized).toContain("Hello TokenForge");
  });

  it("computes accurate cache hit percentages and stable prefix tokens", () => {
    recordCacheDebugEvent({
      id: "req_1",
      sessionId: "sess_abc",
      model: "claude-opus-5",
      providerLabel: "Primary provider",
      source: "api_anthropic",
      incomingBody: JSON.stringify({ messages: [{ role: "user", content: "Turn 1" }] }),
      upstreamBody: JSON.stringify({
        system: "You are an expert software engineer.",
        messages: [{ role: "user", content: "Turn 1" }],
      }),
      promptTokens: 1000,
      cachedTokens: 0,
      completionTokens: 150,
      totalTokens: 1150,
      latencyMs: 500,
      status: 200,
    });

    recordCacheDebugEvent({
      id: "req_2",
      sessionId: "sess_abc",
      model: "claude-opus-5",
      providerLabel: "Primary provider",
      source: "api_anthropic",
      incomingBody: JSON.stringify({
        messages: [
          { role: "user", content: "Turn 1" },
          { role: "assistant", content: "Answer 1" },
          { role: "user", content: "Turn 2" },
        ],
      }),
      upstreamBody: JSON.stringify({
        system: "You are an expert software engineer.",
        messages: [
          { role: "user", content: "Turn 1" },
          { role: "assistant", content: "Answer 1" },
          { role: "user", content: "Turn 2" },
        ],
      }),
      promptTokens: 1300,
      cachedTokens: 1000,
      completionTokens: 200,
      totalTokens: 1500,
      latencyMs: 250,
      status: 200,
    });

    const entry1 = getCacheDebugEntry("req_1")!;
    const entry2 = getCacheDebugEntry("req_2")!;

    expect(entry1).toBeDefined();
    expect(entry2).toBeDefined();
    expect(entry1.cachePercent).toBe(0);
    expect(entry2.cachePercent).toBe(76.9);

    const diff = computeCacheDiffBetweenEntries(entry1, entry2, "upstream_body");
    expect(diff.isFullPrefixStable).toBe(true);
    expect(diff.diffExplanation).toContain("100% stable");
  });

  it("pinpoints character breakpoints and shows 150 character snippets when prefix mutates", () => {
    const entryA: CacheDebugEntry = {
      id: "turn_a",
      timestamp: new Date().toISOString(),
      createdAt: Date.now() - 5000,
      sessionId: "session_x",
      model: "gpt-6-astra",
      providerLabel: "Astra Engine",
      source: "api_openai",
      incomingBody: JSON.stringify({ messages: [{ role: "user", content: "Original query" }] }),
      upstreamBody: JSON.stringify({
        system: "STATIC_SYSTEM_PREFIX_BLOCK_ABC",
        messages: [{ role: "user", content: "Explain quantum mechanics in depth." }],
      }),
      promptTokens: 500,
      cachedTokens: 0,
      completionTokens: 100,
      totalTokens: 600,
      cachePercent: 0,
      latencyMs: 400,
      status: 200,
    };

    const entryB: CacheDebugEntry = {
      id: "turn_b",
      timestamp: new Date().toISOString(),
      createdAt: Date.now(),
      sessionId: "session_x",
      model: "gpt-6-astra",
      providerLabel: "Astra Engine",
      source: "api_openai",
      incomingBody: JSON.stringify({ messages: [{ role: "user", content: "Modified query" }] }),
      upstreamBody: JSON.stringify({
        system: "STATIC_SYSTEM_PREFIX_BLOCK_ABC",
        messages: [{ role: "user", content: "Explain relativity mechanics in depth." }],
      }),
      promptTokens: 500,
      cachedTokens: 0,
      completionTokens: 100,
      totalTokens: 600,
      cachePercent: 0,
      latencyMs: 420,
      status: 200,
    };

    const diff = computeCacheDiffBetweenEntries(entryA, entryB, "upstream_body");
    expect(diff.isFullPrefixStable).toBe(false);
    expect(diff.differingPartName).toBe("messages[0] (role: user)");
    expect(diff.diffExplanation).toContain('Cache broke inside "messages[0] (role: user)"');
    expect(diff.snippetBefore).toContain("Explain ");
    expect(diff.snippetAfterA).toContain("quantum");
    expect(diff.snippetAfterB).toContain("relativity");
  });

  it("exports JSONL with upstream bodies formatted as ndjson", () => {
    recordCacheDebugEvent({
      id: "req_jsonl",
      sessionId: "sess_jsonl",
      model: "universal-hub",
      providerLabel: "Hub provider",
      source: "api_openai",
      incomingBody: "{\"foo\": 1}",
      upstreamBody: "{\"foo\": 1, \"system\": \"ok\"}",
      promptTokens: 200,
      cachedTokens: 150,
      completionTokens: 50,
      totalTokens: 250,
      latencyMs: 180,
      status: 200,
    });

    const jsonl = exportCacheDebugJsonl();
    expect(jsonl).toContain("req_jsonl");
    expect(jsonl).toContain("upstream_body");
  });

  it("inlines mid-conversation system reminders without mutating messages[0] or creating adjacent user turns", async () => {
    const { translateAnthropicRequest } = await import("./anthropicGateway");
    const raw = {
      model: "claude-opus-5.5",
      system: "Original client system prompt",
      messages: [
        { role: "user", content: "List files" },
        {
          role: "assistant",
          content: [
            { type: "tool_use", id: "call_1", name: "list_dir", input: { path: "." } },
          ],
        },
        {
          role: "user",
          content: [
            { type: "tool_result", tool_use_id: "call_1", content: "file1.txt, file2.txt" },
          ],
        },
        { role: "system", content: "<total_tokens>14729817 tokens left</total_tokens>" },
        { role: "user", content: "Now read file1.txt" },
      ],
    };

    const translated = translateAnthropicRequest(raw as any);

    // messages[0] must be exactly the client system prompt
    expect(translated.messages[0].role).toBe("system");
    expect(translated.messages[0].content).toBe("Original client system prompt");

    // All subsequent messages must never have two consecutive user turns
    for (let i = 1; i < translated.messages.length; i++) {
      if (translated.messages[i].role === "user") {
        expect(translated.messages[i - 1].role).not.toBe("user");
      }
    }

    // The system reminder was merged with the user turn
    const lastUserTurn = translated.messages[translated.messages.length - 1];
    expect(lastUserTurn.role).toBe("user");
    expect(lastUserTurn.content).toContain("<system-reminder>");
    expect(lastUserTurn.content).toContain("14729817 tokens left");
    expect(lastUserTurn.content).toContain("Now read file1.txt");
  });
});
