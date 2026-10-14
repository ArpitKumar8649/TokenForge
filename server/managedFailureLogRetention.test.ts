import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./db", () => ({ pruneExpiredManagedProviderFailureLogs: vi.fn() }));
vi.mock("./_core/sdk", () => ({ sdk: { authenticateRequest: vi.fn() } }));

import { pruneExpiredManagedProviderFailureLogs } from "./db";
import { sdk } from "./_core/sdk";
import { pruneManagedFailureLogsHandler } from "./managedFailureLogRetention";

function response() {
  const res = { status: vi.fn(), json: vi.fn() };
  res.status.mockReturnValue(res);
  res.json.mockReturnValue(res);
  return res;
}

describe("managed provider failure-log retention callback", () => {
  beforeEach(() => vi.clearAllMocks());

  it("accepts only authenticated cron callers and invokes the 28-hour cleanup", async () => {
    vi.mocked(sdk.authenticateRequest).mockResolvedValue({ isCron: true, taskUid: "retention-task" } as never);
    vi.mocked(pruneExpiredManagedProviderFailureLogs).mockResolvedValue({ cutoff: new Date("2026-08-25T00:00:00.000Z"), deleted: true });
    const res = response();

    await pruneManagedFailureLogsHandler({} as never, res as never);

    expect(pruneExpiredManagedProviderFailureLogs).toHaveBeenCalledOnce();
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ ok: true, cutoff: "2026-08-25T00:00:00.000Z", databaseAvailable: true }));
  });

  it("rejects non-cron callers without running the cleanup", async () => {
    vi.mocked(sdk.authenticateRequest).mockResolvedValue({ isCron: false } as never);
    const res = response();

    await pruneManagedFailureLogsHandler({} as never, res as never);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(pruneExpiredManagedProviderFailureLogs).not.toHaveBeenCalled();
  });
});
