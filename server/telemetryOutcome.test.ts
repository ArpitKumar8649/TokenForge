import { describe, it, expect } from "vitest";

describe("Telemetry & Gateway Outcome classifications", () => {
  it("correctly identifies outcome status priorities", () => {
    // 1. client_disconnected priority
    const clientDisconnectedOutcome = (clientDisconnected: boolean, failed: boolean, stopReason: string) => {
      if (clientDisconnected) return "client_disconnected";
      if (failed) return "upstream_error";
      if (stopReason === "max_tokens" || stopReason === "length") return "truncated";
      return "success";
    };

    expect(clientDisconnectedOutcome(true, true, "none")).toBe("client_disconnected");
    expect(clientDisconnectedOutcome(true, false, "end_turn")).toBe("client_disconnected");
    expect(clientDisconnectedOutcome(false, true, "none")).toBe("upstream_error");
    expect(clientDisconnectedOutcome(false, false, "max_tokens")).toBe("truncated");
    expect(clientDisconnectedOutcome(false, false, "length")).toBe("truncated");
    expect(clientDisconnectedOutcome(false, false, "end_turn")).toBe("success");
    expect(clientDisconnectedOutcome(false, false, "tool_use")).toBe("success");
  });

  it("handles TTFT and duration calculations", () => {
    const startedAt = 1000;
    const firstTokenAt = 1350;
    const finishedAt = 3800;

    const ttftMs = firstTokenAt - startedAt;
    const durationMs = finishedAt - startedAt;

    expect(ttftMs).toBe(350);
    expect(durationMs).toBe(2800);
  });
});
