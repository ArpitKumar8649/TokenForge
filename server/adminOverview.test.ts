import { describe, expect, it } from "vitest";
import { ADMIN_EMAIL_PROVIDER_EXPRESSION, composeAdminAccountOverview, normalizeAdminAccountModelUsage, normalizeAdminEmailProviderCounts, normalizeAdminGlobalModelUsage } from "./db";

describe("composeAdminAccountOverview", () => {
  it("attaches live credit and usage aggregates without returning API-key material", () => {
    const accounts = composeAdminAccountOverview([
      {
        id: 7,
        name: "Amina",
        email: "amina@example.org",
        role: "user",
        createdAt: new Date("2026-01-01T00:00:00Z"),
        lastSignedIn: new Date("2026-01-02T00:00:00Z"),
        suspended: false,
        suspicious: false,
        requestLimit: 100,
        tokenLimit: 100_000,
        balanceNanos: 48_500_000_000,
      },
    ], [{ userId: 7, requestCount: 12, totalTokens: 45_600, lastActivityAt: "2026-01-03T12:00:00Z" }]);

    expect(accounts[0]).toMatchObject({ id: 7, balanceNanos: 48_500_000_000, requestCount: 12, totalTokens: 45_600 });
    expect(accounts[0]?.lastActivityAt?.toISOString()).toBe("2026-01-03T12:00:00.000Z");
    expect(accounts[0]).not.toHaveProperty("keyHash");
    expect(accounts[0]).not.toHaveProperty("keyPrefix");
  });

  it("uses readable zero values for accounts that have no metered requests yet", () => {
    const accounts = composeAdminAccountOverview([
      {
        id: 8,
        name: null,
        email: null,
        role: "user",
        createdAt: new Date("2026-01-01T00:00:00Z"),
        lastSignedIn: new Date("2026-01-01T00:00:00Z"),
        suspended: null,
        suspicious: null,
        requestLimit: null,
        tokenLimit: null,
        balanceNanos: null,
      },
    ], []);

    expect(accounts[0]).toMatchObject({ balanceNanos: 0, requestCount: 0, totalTokens: 0, lastActivityAt: null });
  });
});

describe("normalizeAdminEmailProviderCounts", () => {
  it("uses the deployed MySQL-compatible standalone users expression", () => {
    expect(ADMIN_EMAIL_PROVIDER_EXPRESSION).toBe("lower(substring_index(email, '@', -1))");
    expect(ADMIN_EMAIL_PROVIDER_EXPRESSION).not.toContain("users.email");
  });

  it("groups and sorts normalized provider-only counts without exposing mailbox identities", () => {
    const distribution = normalizeAdminEmailProviderCounts([
      { provider: "GMAIL.COM", accountCount: 2 },
      { provider: "gmail.com", accountCount: "3" },
      { provider: "outlook.com", accountCount: 4 },
      { provider: "person@example.com", accountCount: 99 },
      { provider: null, accountCount: 1 },
    ]);

    expect(distribution).toEqual([
      { provider: "gmail.com", accountCount: 5 },
      { provider: "outlook.com", accountCount: 4 },
    ]);
    expect(JSON.stringify(distribution)).not.toContain("person@example.com");
  });

  it("includes a newly observed mailbox provider as its own bar-ready aggregate", () => {
    const distribution = normalizeAdminEmailProviderCounts([
      { provider: "gmail.com", accountCount: 1 },
      { provider: "proton.me", accountCount: 1 },
    ]);

    expect(distribution).toContainEqual({ provider: "proton.me", accountCount: 1 });
  });
});

describe("normalizeAdminAccountModelUsage", () => {
  it("returns only bar-ready aggregate rows with no prompts, API keys, or private message content", () => {
    const usage = normalizeAdminAccountModelUsage([
      { userId: 41, modelId: "kimi-k3", requestCount: 4, totalTokens: 12_340 },
      { userId: 41, modelId: "qwen3.7-max", requestCount: 1, totalTokens: 800 },
      { userId: 41, modelId: "unused-model", requestCount: 0, totalTokens: 0 },
    ]);

    expect(usage).toEqual([
      { userId: 41, modelId: "kimi-k3", requestCount: 4, totalTokens: 12_340 },
      { userId: 41, modelId: "qwen3.7-max", requestCount: 1, totalTokens: 800 },
    ]);
    expect(JSON.stringify(usage)).not.toContain("prompt");
    expect(JSON.stringify(usage)).not.toContain("keyHash");
  });

  it("orders each account's model bars by request count and then processed tokens", () => {
    const usage = normalizeAdminAccountModelUsage([
      { userId: 8, modelId: "model-b", requestCount: 2, totalTokens: 50 },
      { userId: 8, modelId: "model-a", requestCount: 2, totalTokens: 75 },
      { userId: 8, modelId: "model-c", requestCount: 4, totalTokens: 2 },
    ]);

    expect(usage.map(row => row.modelId)).toEqual(["model-c", "model-a", "model-b"]);
  });
});

describe("normalizeAdminGlobalModelUsage", () => {
  it("returns comparative all-account model aggregates without account identities or request content", () => {
    const usage = normalizeAdminGlobalModelUsage([
      { modelId: "kimi-k3", accountCount: 3, requestCount: 9, totalTokens: 18_000 },
      { modelId: "qwen3.7-max", accountCount: 1, requestCount: 2, totalTokens: 600 },
      { modelId: "unused-model", accountCount: 0, requestCount: 0, totalTokens: 0 },
    ]);

    expect(usage).toEqual([
      { modelId: "kimi-k3", accountCount: 3, requestCount: 9, totalTokens: 18_000 },
      { modelId: "qwen3.7-max", accountCount: 1, requestCount: 2, totalTokens: 600 },
    ]);
    expect(JSON.stringify(usage)).not.toContain("userId");
    expect(JSON.stringify(usage)).not.toContain("prompt");
  });

  it("orders all-account model bars by request count, then processed tokens", () => {
    const usage = normalizeAdminGlobalModelUsage([
      { modelId: "model-b", accountCount: 1, requestCount: 2, totalTokens: 50 },
      { modelId: "model-a", accountCount: 1, requestCount: 2, totalTokens: 75 },
      { modelId: "model-c", accountCount: 1, requestCount: 4, totalTokens: 2 },
    ]);

    expect(usage.map(row => row.modelId)).toEqual(["model-c", "model-a", "model-b"]);
  });
});
