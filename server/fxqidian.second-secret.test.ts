import { describe, expect, it } from "vitest";

const FXQIDIAN_BASE_URL = process.env.FXQIDIAN_BASE_URL?.replace(/\/$/, "");
const FXQIDIAN_SECONDARY_KEY = process.env.FXQIDIAN_API_KEY_2;

describe("FXQidian secondary credential", () => {
  it("authorizes a lightweight model-catalogue request", async () => {
    expect(FXQIDIAN_BASE_URL).toBeTruthy();
    expect(FXQIDIAN_SECONDARY_KEY).toBeTruthy();

    const response = await fetch(`${FXQIDIAN_BASE_URL}/v1/models`, {
      headers: { Authorization: `Bearer ${FXQIDIAN_SECONDARY_KEY}` },
    });

    expect(response.ok).toBe(true);
  }, 30_000);
});
