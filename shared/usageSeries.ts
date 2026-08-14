export type DailyUsagePoint = {
  day: string;
  requests: number;
  tokens: number;
};

/** Coalesces duplicate date buckets before a chart renders them. */
export function coalesceDailyUsage(rows: DailyUsagePoint[]): DailyUsagePoint[] {
  const byDay = new Map<string, DailyUsagePoint>();
  for (const row of rows) {
    const existing = byDay.get(row.day);
    byDay.set(row.day, existing
      ? { day: row.day, requests: existing.requests + row.requests, tokens: existing.tokens + row.tokens }
      : { ...row });
  }
  return Array.from(byDay.values()).sort((left, right) => left.day.localeCompare(right.day));
}
