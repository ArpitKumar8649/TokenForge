import { describe, expect, it } from "vitest";
import { getOrcaRouterCredentialPool, ORCA_ROUTER_CREDENTIAL_POOL_SIZE, validateOrcaRouterCredential } from "./orcaRouterCredentials";
import { forwardProviderRequest } from "./openaiGateway";

const livePoolProbe = process.env.RUN_TOKENFORGE_ORCAROUTER_POOL_PROBE === "true" ? it : it.skip;

describe("OrcaRouter managed credential pool live probe", () => {
  livePoolProbe("checks each configured slot with a minimal Claude Opus 5 completion", async () => {
    const pool = await getOrcaRouterCredentialPool();
    expect(pool).toHaveLength(ORCA_ROUTER_CREDENTIAL_POOL_SIZE);

    const results: Array<{ slot: number; status: "ready" | "rejected"; reason?: string }> = [];
    for (const credential of pool) {
      try {
        await validateOrcaRouterCredential(credential.credential);
        results.push({ slot: credential.slot, status: "ready" });
      } catch (error) {
        results.push({
          slot: credential.slot,
          status: "rejected",
          reason: error instanceof Error ? error.message : "Unknown provider validation error",
        });
      }
    }

    // Logs only slot numbers and provider result categories; secret values are never emitted.
    console.info("[OrcaRouter managed pool probe]", results);
    expect(results).toHaveLength(ORCA_ROUTER_CREDENTIAL_POOL_SIZE);
    expect(results.some(result => result.status === "ready")).toBe(true);
  }, 1_500_000);

  livePoolProbe("routes a minimal Claude Opus 5 request through the managed pool with secure failover", async () => {
    const response = await forwardProviderRequest(
      "claude-opus-5",
      { model: "claude-opus-5", messages: [{ role: "user", content: "Reply with: ready" }], max_tokens: 2, stream: false },
      new AbortController().signal,
    );

    console.info("[OrcaRouter managed routing probe]", { status: response.status, ok: response.ok });
    expect(response.ok).toBe(true);
  }, 1_500_000);
});
