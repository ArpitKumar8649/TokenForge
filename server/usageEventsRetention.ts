import type { Express, Request, Response } from "express";
import { pruneExpiredUsageEvents } from "./db";
import { sdk } from "./_core/sdk";

const RETENTION_PATH = "/api/scheduled/prune-usage-events";

export async function pruneUsageEventsHandler(req: Request, res: Response) {
  try {
    const user = await sdk.authenticateRequest(req);
    if (!user.isCron && !user.isAdminSession) {
      return res.status(403).json({ error: "cron-or-admin-only" });
    }
    const result = await pruneExpiredUsageEvents();
    return res.json({
      ok: true,
      cutoff: result.cutoff.toISOString(),
      deletedCount: result.deletedCount,
    });
  } catch (error) {
    return res.status(500).json({
      error: error instanceof Error ? error.message : "Usage events retention failed",
      context: { path: RETENTION_PATH },
      timestamp: new Date().toISOString(),
    });
  }
}

export function registerUsageEventsRetention(app: Express) {
  app.post(RETENTION_PATH, pruneUsageEventsHandler);

  // Background automated cleanup: Run prune once every 24 hours as requested
  const PRUNE_INTERVAL_MS = 24 * 60 * 60 * 1_000; // 24 hours

  // Immediate initial cleanup on server startup (deferred by 5s to allow DB connection to warm up)
  setTimeout(() => {
    void pruneExpiredUsageEvents().catch(err => {
      console.warn("[usageEventsRetention] Startup 48h prune notice:", err);
    });
  }, 5_000);

  // Periodic 24-hour cleanup
  setInterval(() => {
    void pruneExpiredUsageEvents().catch(err => {
      console.warn("[usageEventsRetention] 24h periodic prune notice:", err);
    });
  }, PRUNE_INTERVAL_MS);
}
