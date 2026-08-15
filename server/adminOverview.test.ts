import { describe, expect, it } from "vitest";
import { composeAdminAccountOverview, normalizeAdminEmailProviderCounts } from "./db";

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
