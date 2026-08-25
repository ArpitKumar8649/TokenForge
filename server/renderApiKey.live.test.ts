import { describe, expect, it } from "vitest";

describe("RENDER_API_KEY server-side access", () => {
  it("authenticates to Render's lightweight owners endpoint without exposing credential or account data", async () => {
    const apiKey = process.env.RENDER_API_KEY;
    expect(apiKey).toBeTruthy();

    const response = await fetch("https://api.render.com/v1/owners", {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: "application/json",
      },
    });

    expect(response.status).toBe(200);
    const owners = await response.json();
    expect(Array.isArray(owners)).toBe(true);
  }, 30_000);
});
