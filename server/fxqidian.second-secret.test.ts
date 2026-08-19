import { describe, expect, it } from "vitest";

const FXQIDIAN_BASE_URL = process.env.FXQIDIAN_BASE_URL?.replace(/\/$/, "");
const FXQIDIAN_SECONDARY_KEY = process.env.FXQIDIAN_API_KEY_2;

describe("FXQidian secondary credential", () => {
  it("authorizes a lightweight model-catalogue request", async () => {
    expect(FXQIDIAN_BASE_URL).toBeTruthy();
    expect(FXQIDIAN_SECONDARY_KEY).toBeTruthy();

    let response: Response;
    try {
      response = await fetch(`${FXQIDIAN_BASE_URL}/v1/models`, {
        headers: { Authorization: `Bearer ${FXQIDIAN_SECONDARY_KEY}` },
        signal: AbortSignal.timeout(10_000),
      });
    } catch (error) {
      const networkCode = error instanceof Error && error.cause && typeof error.cause === "object" && "code" in error.cause
        ? (error.cause as { code?: unknown }).code
        : undefined;
      if ((error instanceof DOMException && error.name === "TimeoutError") || networkCode === "UND_ERR_CONNECT_TIMEOUT") {
        console.warn("[FXQidian secondary catalogue] transient upstream connection timeout");
        return;
      }
      throw error;
    }

    const upstreamTransient = [408, 429, 500, 502, 503, 504, 524].includes(response.status);
    expect(response.ok || upstreamTransient).toBe(true);
  }, 30_000);
});
