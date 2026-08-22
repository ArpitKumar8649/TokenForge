import { describe, expect, it } from "vitest";

const proxyCredential = process.env.RENDER_NIM_PROXY_API_KEY;
const proxyModel = process.env.RENDER_NIM_PROXY_MODEL;
const runLiveCredentialCheck = process.env.RUN_RENDER_NIM_PROXY_LIVE_TESTS === "1";

describe.runIf(runLiveCredentialCheck && Boolean(proxyCredential) && Boolean(proxyModel))("authorized Render NIM proxy configuration", () => {
  it("accepts the stored credential and underlying model at the first configured Render proxy endpoint", async () => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 90_000);

    try {
      const response = await fetch("https://nim-playground-proxy.onrender.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${proxyCredential}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          model: proxyModel,
          stream: false,
          max_tokens: 1,
          messages: [{ role: "user", content: "Reply with OK." }],
        }),
        signal: controller.signal,
      });

      expect(response.status, "the proxy credential must not be rejected").not.toBe(401);
      expect(response.status, "the proxy credential must not be rejected").not.toBe(403);
      expect(response.ok, "the configured endpoint must accept the stored credential and model").toBe(true);
    } finally {
      clearTimeout(timeout);
    }
  }, 95_000);
});
