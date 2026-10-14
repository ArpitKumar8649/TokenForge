import { describe, it, expect, vi } from "vitest";
import { USAGE_EVENTS_RETENTION_MS } from "./db";

describe("usageEventsRetention", () => {
  it("uses a 48-hour retention window", () => {
    expect(USAGE_EVENTS_RETENTION_MS).toBe(48 * 60 * 60 * 1_000);
  });

  it("calculates the correct 48-hour cutoff date", () => {
    const fixedNow = new Date("2026-10-14T12:00:00.000Z");
    const cutoff = new Date(fixedNow.getTime() - USAGE_EVENTS_RETENTION_MS);
    expect(cutoff.toISOString()).toBe("2026-10-12T12:00:00.000Z");
  });
});
