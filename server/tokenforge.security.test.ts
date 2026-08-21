import { describe, expect, it, vi } from "vitest";
import { apiKeys, users } from "../drizzle/schema";
import { deleteAccountPermanently, DISCORD_UNVERIFIED_CLEANUP_NOTICE_KIND, findActiveApiKey, hashApiKey, publicApiKey, settleReservedCredit, utcUsageDate } from "./db";
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

  it("rejects an active key when the database join finds no owning user", async () => {
    const limit = vi.fn().mockResolvedValue([]);
    const where = vi.fn(() => ({ limit }));
    const innerJoin = vi.fn(() => ({ where }));
    const from = vi.fn(() => ({ innerJoin }));
    const database = { select: vi.fn(() => ({ from })) };

    await expect(findActiveApiKey("tf_live_deleted_owner", database as NonNullable<Parameters<typeof findActiveApiKey>[1]>)).resolves.toBeNull();
    expect(innerJoin).toHaveBeenCalledWith(users, expect.anything());
  });

  it("silently skips credit settlement when the in-flight request's user was deleted", async () => {
    const limit = vi.fn().mockResolvedValue([]);
    const where = vi.fn(() => ({ limit }));
    const from = vi.fn(() => ({ where }));
    const transaction = vi.fn();
    const database = { select: vi.fn(() => ({ from })), transaction };

    await expect(settleReservedCredit({
      userId: 55,
      requestId: "deleted-account-request",
      reservedNanos: 1_500_000_000,
      finalChargeNanos: 500_000_000,
    }, database as NonNullable<Parameters<typeof settleReservedCredit>[1]>)).resolves.toEqual({ balanceNanos: 0, chargedNanos: 0 });
    expect(transaction).not.toHaveBeenCalled();
  });

  it("treats a deletion that wins after the settlement check as a harmless no-op", async () => {
    const limit = vi.fn().mockResolvedValue([{ id: 55 }]);
    const where = vi.fn(() => ({ limit }));
    const from = vi.fn(() => ({ where }));
    const transaction = vi.fn().mockRejectedValue({ cause: { code: "ER_NO_REFERENCED_ROW_2" } });
    const database = { select: vi.fn(() => ({ from })), transaction };

    await expect(settleReservedCredit({
      userId: 55,
      requestId: "settlement-race-request",
      reservedNanos: 1_500_000_000,
      finalChargeNanos: 500_000_000,
    }, database as NonNullable<Parameters<typeof settleReservedCredit>[1]>)).resolves.toEqual({ balanceNanos: 0, chargedNanos: 0 });
    expect(transaction).toHaveBeenCalledOnce();
  });

  it("deletes active API keys before removing their owning account", async () => {
    const userLimit = vi.fn().mockResolvedValue([{ id: 55, openId: "tf_local_deleted-owner", email: "deleted-owner@example.com" }]);
    const userWhere = vi.fn(() => ({ limit: userLimit }));
    const userFrom = vi.fn(() => ({ where: userWhere }));
    const identitiesWhere = vi.fn().mockResolvedValue([]);
    const identitiesFrom = vi.fn(() => ({ where: identitiesWhere }));
    const select = vi.fn()
      .mockReturnValueOnce({ from: userFrom })
      .mockReturnValueOnce({ from: identitiesFrom });
    const onDuplicateKeyUpdate = vi.fn().mockResolvedValue(undefined);
    const values = vi.fn(() => ({ onDuplicateKeyUpdate }));
    const insert = vi.fn(() => ({ values }));
    const deleteWhere = vi.fn()
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce([{ affectedRows: 1 }]);
    const remove = vi.fn(() => ({ where: deleteWhere }));
    const transaction = vi.fn(async (callback: (tx: unknown) => unknown) => callback({ select, insert, delete: remove }));
    const database = { transaction };

    await expect(deleteAccountPermanently(55, database as NonNullable<Parameters<typeof deleteAccountPermanently>[1]>)).resolves.toBe(true);
    expect(remove).toHaveBeenNthCalledWith(3, apiKeys);
    expect(remove).toHaveBeenNthCalledWith(4, users);
  });

  it("keeps the Discord-unverified cleanup notice kind within its persisted column bound", () => {
    expect(DISCORD_UNVERIFIED_CLEANUP_NOTICE_KIND).toHaveLength(26);
    expect(DISCORD_UNVERIFIED_CLEANUP_NOTICE_KIND.length).toBeLessThanOrEqual(32);
  });

  it("normalizes metering dates to UTC midnight", () => {
    const date = utcUsageDate(new Date("2026-08-14T23:59:59.999-04:00"));
    expect(date.toISOString()).toBe("2026-08-15T00:00:00.000Z");
  });

  it("exposes the text-chat catalogue without modality-specific models or duplicate identifiers", () => {
    const ids = TOKENFORGE_CATALOGUE.map(model => model.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toEqual(expect.arrayContaining(["glm-5.3", "glm-5.2", "grok-4.5", "deepseek-v4-flash", "deepseek-v4-pro", "claude-opus-5", "qwen3.8-27b", "qwen3.8-max", "claude-fable-5", "kimi-k3", "qwen3.7-max", "claude-sonnet-4.5", "gpt-5"]));
    expect(ids).not.toEqual(expect.arrayContaining(["glm-5", "minimax-m2-5", "flux", "whisper", "gemini-embedding", "qwen3-tts"]));
  });

  it("formats quota and rate-limit responses with a compatible error object and headers", () => {
    expect(tokenForgeErrorBody(429, "Quota reached", "quota_exceeded")).toEqual({ error: { message: "Quota reached", type: "rate_limit_error", param: null, code: "quota_exceeded" } });
    expect(tokenForgeErrorBody(503, "The requested model is temporarily unavailable.", "model_unavailable")).toEqual({ error: { message: "The requested model is temporarily unavailable.", type: "server_error", param: null, code: "model_unavailable" } });
    const headers = tokenForgeRateHeaders(100, -1);
    expect(headers["x-ratelimit-limit"]).toBe(100);
    expect(headers["x-ratelimit-remaining"]).toBe(0);
    expect(headers["x-ratelimit-reset"]).toBeGreaterThan(Math.floor(Date.now() / 1000));
  });
});
