import { describe, expect, it } from "vitest";
import { hashApiKey, publicApiKey, utcUsageDate } from "./db";
import { TOKENFORGE_CATALOGUE, tokenForgeErrorBody, tokenForgeRateHeaders } from "./openaiGateway";

describe("TokenForge credential and gateway safeguards", () => {
  it("creates a deterministic one-way API key hash without retaining the plaintext", () => {
    const secret = "tf_live_unit_test_secret";
    const hash = hashApiKey(secret);
    expect(hash).toHaveLength(64);
    expect(hash).not.toContain(secret);
    expect(hashApiKey(secret)).toBe(hash);
  });

  it("returns only safe metadata for a persisted API key", () => {
    const safe = publicApiKey({ id: 42, userId: 1, keyPrefix: "tf_live_example…", keyHash: "this-value-must-not-leave-the-server", label: "test", status: "active", lastUsedAt: null, revokedAt: null, createdAt: new Date(), updatedAt: new Date() });
    expect(safe).toMatchObject({ id: 42, prefix: "tf_live_example…", status: "active" });
    expect(safe).not.toHaveProperty("keyHash");
    expect(safe).not.toHaveProperty("userId");
  });

  it("normalizes metering dates to UTC midnight", () => {
    const date = utcUsageDate(new Date("2026-08-14T23:59:59.999-04:00"));
    expect(date.toISOString()).toBe("2026-08-15T00:00:00.000Z");
  });

  it("exposes the verified fixed-rate text-chat catalogue without modality-specific models", () => {
    const ids = TOKENFORGE_CATALOGUE.map(model => model.id);
    expect(ids).toHaveLength(32);
    expect(ids).toEqual(expect.arrayContaining(["glm-5.2", "grok-4.5", "kimi-k3", "qwen3.7-max", "claude-sonnet-4.5", "gpt-5"]));
    expect(ids).not.toEqual(expect.arrayContaining(["flux", "whisper", "gemini-embedding", "qwen3-tts"]));
  });

  it("formats quota and rate-limit responses with a compatible error object and headers", () => {
    expect(tokenForgeErrorBody(429, "Quota reached", "quota_exceeded")).toEqual({ error: { message: "Quota reached", type: "rate_limit_error", param: null, code: "quota_exceeded" } });
    const headers = tokenForgeRateHeaders(100, -1);
    expect(headers["x-ratelimit-limit"]).toBe(100);
    expect(headers["x-ratelimit-remaining"]).toBe(0);
    expect(headers["x-ratelimit-reset"]).toBeGreaterThan(Math.floor(Date.now() / 1000));
  });
});
