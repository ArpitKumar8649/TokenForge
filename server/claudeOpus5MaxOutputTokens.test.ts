import { describe, expect, it } from "vitest";
import { applyProviderMaxOutputTokens } from "./openaiGateway";
import { normalizeMaxOutputTokens } from "./db";

describe("Claude Opus 5 Provider Max Output Tokens", () => {
  it("normalizes maxOutputTokens correctly", () => {
    expect(normalizeMaxOutputTokens(undefined)).toBeUndefined();
    expect(normalizeMaxOutputTokens(null)).toBeUndefined();
    expect(normalizeMaxOutputTokens("")).toBeUndefined();
    expect(normalizeMaxOutputTokens(0)).toBeUndefined();
    expect(normalizeMaxOutputTokens(-100)).toBeUndefined();
    expect(normalizeMaxOutputTokens(4096)).toBe(4096);
    expect(normalizeMaxOutputTokens("8192")).toBe(8192);
    expect(normalizeMaxOutputTokens(20_000_000)).toBe(10_000_000);
  });

  it("applies provider maxOutputTokens when set and overrides higher requested max_tokens", () => {
    const providerWithCap = { maxOutputTokens: 4096 };
    const inputWithHighTokens = {
      model: "claude-opus-5",
      messages: [{ role: "user" as const, content: "hello" }],
      max_tokens: 8192,
    };

    const capped = applyProviderMaxOutputTokens(inputWithHighTokens, providerWithCap);
    expect(capped.max_tokens).toBe(4096);
  });

  it("overrides lower requested max_tokens (including client default 64) with provider maxOutputTokens", () => {
    const providerWithCap = { maxOutputTokens: 64000 };
    const inputWithLowTokens = {
      model: "claude-opus-5",
      messages: [{ role: "user" as const, content: "hello" }],
      max_tokens: 64,
    };

    const capped = applyProviderMaxOutputTokens(inputWithLowTokens, providerWithCap);
    expect(capped.max_tokens).toBe(64000);
  });

  it("overrides max_completion_tokens from client and removes it", () => {
    const providerWithCap = { maxOutputTokens: 64000 };
    const inputWithCompletionTokens = {
      model: "claude-opus-5",
      messages: [{ role: "user" as const, content: "hello" }],
      max_completion_tokens: 64,
    } as any;

    const capped = applyProviderMaxOutputTokens(inputWithCompletionTokens, providerWithCap);
    expect(capped.max_tokens).toBe(64000);
    expect((capped as any).max_completion_tokens).toBeUndefined();
  });

  it("sets max_tokens when requested max_tokens is undefined and provider has cap", () => {
    const providerWithCap = { maxOutputTokens: 2048 };
    const inputWithoutTokens = {
      model: "claude-opus-5",
      messages: [{ role: "user" as const, content: "hello" }],
    };

    const capped = applyProviderMaxOutputTokens(inputWithoutTokens, providerWithCap);
    expect(capped.max_tokens).toBe(2048);
  });

  it("does not modify input if provider has no maxOutputTokens set (blank / normal)", () => {
    const providerWithoutCap = { maxOutputTokens: undefined };
    const inputWithTokens = {
      model: "claude-opus-5",
      messages: [{ role: "user" as const, content: "hello" }],
      max_tokens: 8192,
    };

    const result = applyProviderMaxOutputTokens(inputWithTokens, providerWithoutCap);
    expect(result.max_tokens).toBe(8192);
    expect(result).toBe(inputWithTokens);
  });
});
