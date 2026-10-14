import { describe, expect, it } from "vitest";
import { markApiKeyRevoked, prependCreatedApiKey } from "../shared/apiKeyListCache";

describe("prependCreatedApiKey", () => {
  it("shows a created key immediately and removes a stale duplicate", () => {
    const prior = [
      { id: 7, label: "existing" },
      { id: 11, label: "stale version" },
    ];
    const created = { id: 11, label: "production" };

    expect(prependCreatedApiKey(prior, created)).toEqual([
      created,
      { id: 7, label: "existing" },
    ]);
  });

  it("creates the first visible list entry when there is no cached list", () => {
    const created = { id: 11, label: "production" };
    expect(prependCreatedApiKey(undefined, created)).toEqual([created]);
  });

  it("marks only the targeted key revoked without a refetch", () => {
    const revokedAt = new Date("2026-08-15T00:00:00.000Z");
    const current = [
      { id: 7, status: "active" as const, revokedAt: null },
      { id: 11, status: "active" as const, revokedAt: null },
    ];

    expect(markApiKeyRevoked(current, 11, revokedAt)).toEqual([
      { id: 7, status: "active", revokedAt: null },
      { id: 11, status: "revoked", revokedAt },
    ]);
  });
});
