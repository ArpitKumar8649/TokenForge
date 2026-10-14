import type { Express, Request, Response } from "express";
import { pruneExpiredManagedProviderFailureLogs } from "./db";
import { sdk } from "./_core/sdk";

const RETENTION_PATH = "/api/scheduled/prune-managed-failure-logs";

export async function pruneManagedFailureLogsHandler(req: Request, res: Response) {
  try {
    const user = await sdk.authenticateRequest(req);
    if (!user.isCron || !user.taskUid) return res.status(403).json({ error: "cron-only" });
    const result = await pruneExpiredManagedProviderFailureLogs();
    return res.json({ ok: true, cutoff: result.cutoff.toISOString(), databaseAvailable: result.deleted });
  } catch (error) {
    return res.status(500).json({
      error: error instanceof Error ? error.message : "Managed provider failure-log retention failed",
      context: { path: RETENTION_PATH },
      timestamp: new Date().toISOString(),
    });
  }
}

export function registerManagedFailureLogRetention(app: Express) {
  app.post(RETENTION_PATH, pruneManagedFailureLogsHandler);

  // Background automated cleanup: Run prune every 2 hours to keep table compact without requiring external cron
  const PRUNE_INTERVAL_MS = 2 * 60 * 60 * 1_000;
  setInterval(() => {
    void pruneExpiredManagedProviderFailureLogs().catch(err => {
      console.warn("[automatedPrune] Failed to prune expired failure logs:", err);
    });
  }, PRUNE_INTERVAL_MS);
}

