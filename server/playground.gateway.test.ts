import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./db", () => ({
  findActiveApiKey: vi.fn(),
  getQuotaStatus: vi.fn(),
  getRecentRequestCounts: vi.fn(),
  isModelAvailable: vi.fn(),
  recordUsage: vi.fn(),
  touchApiKey: vi.fn(),
}));

vi.mock("./operationalAlerts", () => ({ raiseOperationalAlert: vi.fn() }));

import { getQuotaStatus, getRecentRequestCounts, isModelAvailable, recordUsage } from "./db";
import { raiseOperationalAlert } from "./operationalAlerts";
import { runPlaygroundCompletion, TokenForgePlaygroundError } from "./openaiGateway";

const availableQuota = {
  day: "2026-08-14",
  suspended: false,
  suspicious: false,
  requestLimit: 100,
  tokenLimit: 100_000,
  maxConcurrentRequests: 2,
  usedRequests: 2,
  usedTokens: 40,
  remainingRequests: 98,
  remainingTokens: 99_960,
};

beforeEach(() => {
  vi.clearAllMocks();
  process.env.FXQIDIAN_BASE_URL = "https://provider.example";
  process.env.FXQIDIAN_API_KEY = "server-only-provider-secret";
  vi.mocked(isModelAvailable).mockResolvedValue(true);
  vi.mocked(getQuotaStatus).mockResolvedValue(availableQuota);
  vi.mocked(getRecentRequestCounts).mockResolvedValue({ account: 0, ip: 0 });
  vi.mocked(recordUsage).mockResolvedValue(undefined);
});

afterEach(() => vi.unstubAllGlobals());

describe("TokenForge Playground gateway", () => {
  it("forwards the approved model only from the server and records metered usage without an API key", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      choices: [{ message: { content: "A safe implementation keeps upstream credentials on the server." } }],
      usage: { prompt_tokens: 12, completion_tokens: 18, total_tokens: 30 },
    }), { status: 200, headers: { "content-type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await runPlaygroundCompletion({
      userId: 42,
      model: "glm-5.2",
      messages: [{ role: "user", content: "How should I protect an upstream credential?" }],
      sourceIpHash: "hashed-source-ip",
    });

    expect(result).toMatchObject({ model: "glm-5.2", usage: { totalTokens: 30 }, quota: { remainingRequests: 97, remainingTokens: 99_930 } });
    expect(fetchMock).toHaveBeenCalledWith("https://provider.example/v1/chat/completions", expect.objectContaining({
      headers: expect.objectContaining({ Authorization: "Bearer server-only-provider-secret" }),
      body: expect.stringContaining('"model":"glm-5.2"'),
    }));
    const forwardedPayload = JSON.parse(vi.mocked(fetchMock).mock.calls[0][1].body as string);
    expect(forwardedPayload.messages[0]).toMatchObject({ role: "system" });
    expect(forwardedPayload.messages[0].content).toContain("selected TokenForge model: glm-5.2");
    expect(forwardedPayload.messages[0].content).toContain("do not claim to be Google Gemini");
    expect(forwardedPayload.messages[0].content).toContain("Do not invent a knowledge cutoff");
    expect(recordUsage).toHaveBeenCalledWith(expect.objectContaining({ userId: 42, modelId: "glm-5.2", status: "success", inputTokens: 12, outputTokens: 18, sourceIpHash: "hashed-source-ip" }));
    expect(vi.mocked(recordUsage).mock.calls[0][0]).not.toHaveProperty("apiKeyId");
  });

  it("stops before provider execution when the account quota is exhausted", async () => {
    vi.mocked(getQuotaStatus).mockResolvedValue({ ...availableQuota, remainingRequests: 0 });
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(runPlaygroundCompletion({
      userId: 42,
      model: "grok-4.5",
      messages: [{ role: "user", content: "Hello" }],
      sourceIpHash: "hashed-source-ip",
    })).rejects.toMatchObject<TokenForgePlaygroundError>({ code: "quota_exceeded" });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(raiseOperationalAlert).toHaveBeenCalledWith("quota_exceeded", expect.objectContaining({ userId: 42 }));
  });
});
