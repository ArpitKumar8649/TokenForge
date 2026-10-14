import { describe, expect, it } from "vitest";
import { coalesceDailyUsage } from "../shared/usageSeries";

describe("daily usage chart series", () => {
  it("coalesces repeated day buckets so chart rendering receives unique date keys", () => {
    expect(coalesceDailyUsage([
      { day: "2026-08-13", requests: 1, tokens: 25 },
      { day: "2026-08-14", requests: 2, tokens: 50 },
      { day: "2026-08-14", requests: 3, tokens: 75 },
    ])).toEqual([
      { day: "2026-08-13", requests: 1, tokens: 25 },
      { day: "2026-08-14", requests: 5, tokens: 125 },
    ]);
  });
});
