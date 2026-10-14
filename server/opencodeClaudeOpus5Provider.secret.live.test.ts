import { describe, expect, it } from "vitest";

const runLive = process.env.RUN_TOKENFORGE_OPENCODE_CLAUDE_OPUS5_LIVE === "1";
const baseUrl = process.env.OPENCODE_CLAUDE_OPUS5_BASE_URL?.replace(/\/$/, "");
const model = process.env.OPENCODE_CLAUDE_OPUS5_MODEL?.trim();

const credentialSlots = [
  process.env.OPENCODE_CLAUDE_OPUS5_API_KEY,
  process.env.OPENCODE_CLAUDE_OPUS5_API_KEY_2,
  process.env.OPENCODE_CLAUDE_OPUS5_API_KEY_3,
  process.env.OPENCODE_CLAUDE_OPUS5_API_KEY_4,
  process.env.OPENCODE_CLAUDE_OPUS5_API_KEY_5,
  process.env.OPENCODE_CLAUDE_OPUS5_API_KEY_6,
  process.env.OPENCODE_CLAUDE_OPUS5_API_KEY_7,
].map((credential, index) => ({ credential: credential?.trim(), slot: index + 1 }));

const liveIt = runLive && baseUrl && model && credentialSlots.every(({ credential }) => credential) ? it : it.skip;

describe("TokenReply Claude Opus 5 provider credential contract", () => {
  const openAiEndpoint = baseUrl!.endsWith("/chat/completions")
    ? baseUrl!
    : `${baseUrl!.endsWith("/v1") ? baseUrl : `${baseUrl}/v1`}/chat/completions`;

  liveIt("accepts a lightweight OpenAI-compatible completion for every configured server-only credential slot", async () => {
    expect(credentialSlots).toHaveLength(7);

    const outcomes = await Promise.all(
      credentialSlots.map(async ({ credential, slot }) => {
        const response = await fetch(openAiEndpoint, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${credential}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          model,
          messages: [{ role: "user", content: "Reply with exactly OK." }],
          max_tokens: 8,
          stream: false,
        }),
        signal: AbortSignal.timeout(20_000),
      });

      const responseText = await response.text();
        return { hasChoices: responseText.includes("choices"), slot, status: response.status };
      }),
    );

    const retryableStatuses = new Set([408, 429, 500, 502, 503, 504, 524]);
    const failures = outcomes.filter(({ hasChoices, status }) => !((status === 200 && hasChoices) || retryableStatuses.has(status)));
    expect(failures, `TokenReply credential-slot outcomes: ${JSON.stringify(outcomes)}`).toEqual([]);
  }, 150_000);
});
