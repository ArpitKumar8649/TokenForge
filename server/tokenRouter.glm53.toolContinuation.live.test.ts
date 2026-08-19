import { describe, expect, it } from "vitest";
import { getTokenRouterCredentialPool } from "./tokenRouterCredentials";

const runLiveProbe = process.env.RUN_TOKENFORGE_GLM53_TOOL_PROBE === "1";
const liveIt = runLiveProbe ? it : it.skip;
const baseUrl = process.env.TOKENROUTER_BASE_URL?.replace(/\/$/, "");
const model = process.env.TOKENROUTER_GLM53_MODEL?.trim();

describe("TokenRouter GLM 5.3 tool-result continuation", () => {
  liveIt("accepts the OpenAI-compatible tool sequence emitted for a Claude Code repository operation", async () => {
    expect(baseUrl).toBeTruthy();
    expect(model).toBeTruthy();

    const payload = {
      model,
      messages: [
        { role: "system", content: "Use the provided repository tools when required." },
        { role: "user", content: "Inspect the repository root." },
        {
          role: "assistant",
          content: "I will inspect the repository root.\n\n[Tool call: List]\n{\"path\":\".\"}",
        },
        { role: "user", content: "[Tool Result for call_tokenforge_glm53_probe]:\nREADME.md\npackage.json\nserver" },
      ],
      tools: [{
        type: "function",
        function: {
          name: "List",
          description: "List a repository directory.",
          parameters: { type: "object", properties: { path: { type: "string" } }, required: ["path"] },
        },
      }],
      max_tokens: 128,
      stream: false,
    };

    const results: Array<{ slot: number; status: number; response: string }> = [];
    for (const [index, credential] of getTokenRouterCredentialPool().entries()) {
      const response = await fetch(`${baseUrl}/v1/chat/completions`, {
        method: "POST",
        headers: { Authorization: `Bearer ${credential}`, Accept: "application/json", "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(30_000),
      });
      const responseText = await response.text();
      results.push({ slot: index + 1, status: response.status, response: responseText.slice(0, 1_000) });
      if (response.ok) return;
    }

    throw new Error(`GLM 5.3 tool-result continuation was rejected by all TokenRouter slots: ${JSON.stringify(results)}`);
  }, 275_000);
});
