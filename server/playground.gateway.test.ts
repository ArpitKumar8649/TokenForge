import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./db", () => ({
  findActiveApiKey: vi.fn(),
  getQuotaStatus: vi.fn(),
  getRecentRequestCounts: vi.fn(),
  isModelAvailable: vi.fn(),
  recordUsage: vi.fn(),
  reserveCredit: vi.fn(),
  settleReservedCredit: vi.fn(),
  touchApiKey: vi.fn(),
}));

vi.mock("./operationalAlerts", () => ({ raiseOperationalAlert: vi.fn() }));

import { getQuotaStatus, getRecentRequestCounts, isModelAvailable, recordUsage, reserveCredit, settleReservedCredit } from "./db";
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
  process.env.CLUSTER_PROTOCOL_BASE_URL = "https://cluster.example";
  process.env.CLUSTER_PROTOCOL_API_KEY = "server-only-cluster-secret";
  process.env.TOKENHARBOR_BASE_URL = "https://tokenharbor.example";
  process.env.TOKENHARBOR_API_KEY = "server-only-tokenharbor-secret";
  vi.mocked(isModelAvailable).mockResolvedValue(true);
  vi.mocked(getQuotaStatus).mockResolvedValue(availableQuota);
  vi.mocked(getRecentRequestCounts).mockResolvedValue({ account: 0, ip: 0 });
  vi.mocked(recordUsage).mockResolvedValue(undefined);
  vi.mocked(reserveCredit).mockResolvedValue({ authorized: true, balanceNanos: 49_990_000_000 });
  vi.mocked(settleReservedCredit).mockResolvedValue({ chargedNanos: 96_000, balanceNanos: 49_999_904_000 });
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

    expect(result).toMatchObject({ model: "glm-5.2", usage: { totalTokens: 30 }, credit: { chargeNanos: 96_000, balanceNanos: 49_999_904_000 } });
    expect(fetchMock).toHaveBeenCalledWith("https://provider.example/v1/chat/completions", expect.objectContaining({
      headers: expect.objectContaining({ Authorization: "Bearer server-only-provider-secret" }),
      body: expect.stringContaining('"model":"glm-5.2"'),
    }));
    const forwardedPayload = JSON.parse(vi.mocked(fetchMock).mock.calls[0][1].body as string);
    expect(forwardedPayload.messages[0]).toMatchObject({ role: "system" });
    expect(forwardedPayload.messages[0].content).toContain("selected TokenForge model: glm-5.2");
    expect(forwardedPayload.messages[0].content).toContain("do not claim to be Google Gemini");
    expect(forwardedPayload.messages[0].content).toContain("Do not invent a knowledge cutoff");
    expect(reserveCredit).toHaveBeenCalledWith(42, expect.any(Number), expect.stringMatching(/^tf_pg_/));
    expect(settleReservedCredit).toHaveBeenCalledWith(expect.objectContaining({ userId: 42, finalChargeNanos: 96_000 }));
    expect(recordUsage).toHaveBeenCalledWith(expect.objectContaining({ userId: 42, modelId: "glm-5.2", status: "success", inputTokens: 12, outputTokens: 18, chargeNanos: 96_000, sourceIpHash: "hashed-source-ip" }));
    expect(vi.mocked(recordUsage).mock.calls[0][0]).not.toHaveProperty("apiKeyId");
  });

  it("forwards bounded max output and temperature only through the protected provider path", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      choices: [{ message: { content: "Configured response" } }],
      usage: { prompt_tokens: 8, completion_tokens: 16, total_tokens: 24 },
    }), { status: 200, headers: { "content-type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);

    await runPlaygroundCompletion({
      userId: 42,
      model: "grok-4.5",
      messages: [{ role: "user", content: "Give a concise answer." }],
      maxOutputTokens: 2048,
      temperature: 0.3,
      sourceIpHash: "hashed-source-ip",
    });

    const forwardedPayload = JSON.parse(vi.mocked(fetchMock).mock.calls[0][1].body as string);
    expect(forwardedPayload).toMatchObject({ model: "grok-4.5", stream: false, max_tokens: 2048, temperature: 0.3 });
    expect(reserveCredit).toHaveBeenCalledWith(42, expect.any(Number), expect.stringMatching(/^tf_pg_/));
  });

  it("routes a verified Cluster Protocol model through its server-only credential and preserves metering", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      choices: [{ message: { content: "Cluster-routed completion" } }],
      usage: { input_tokens: 10, output_tokens: 20, total_tokens: 30 },
    }), { status: 200, headers: { "content-type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await runPlaygroundCompletion({
      userId: 42,
      model: "kimi-k3",
      messages: [{ role: "user", content: "Explain server-only gateway routing." }],
      sourceIpHash: "hashed-source-ip",
    });

    expect(result).toMatchObject({ model: "kimi-k3", usage: { totalTokens: 30 } });
    expect(fetchMock).toHaveBeenCalledWith("https://cluster.example/v1/chat/completions", expect.objectContaining({
      headers: expect.objectContaining({ Authorization: "Bearer server-only-cluster-secret" }),
      body: expect.stringContaining('"model":"kimi-k3"'),
    }));
    expect(JSON.stringify(fetchMock.mock.calls[0][1].headers)).not.toContain("server-only-provider-secret");
    expect(settleReservedCredit).toHaveBeenCalledWith(expect.objectContaining({ userId: 42, finalChargeNanos: 330_000 }));
    expect(recordUsage).toHaveBeenCalledWith(expect.objectContaining({ modelId: "kimi-k3", status: "success", inputTokens: 10, outputTokens: 20, chargeNanos: 96_000 }));
  });

  it("routes both DeepSeek aliases through TokenHarbor while translating only the upstream model identifier", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      choices: [{ message: { content: "TokenHarbor-routed completion" } }],
      usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 },
    }), { status: 200, headers: { "content-type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await runPlaygroundCompletion({
      userId: 42,
      model: "deepseek-v4-pro",
      messages: [{ role: "user", content: "Explain safe model alias routing." }],
      sourceIpHash: "hashed-source-ip",
    });

    expect(result).toMatchObject({ model: "deepseek-v4-pro", usage: { totalTokens: 30 } });
    expect(fetchMock).toHaveBeenCalledWith("https://tokenharbor.example/v1/chat/completions", expect.objectContaining({
      headers: expect.objectContaining({ Authorization: "Bearer server-only-tokenharbor-secret" }),
      body: expect.stringContaining('"model":"deepseek-v4-flash:free"'),
    }));
    const forwardedPayload = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(forwardedPayload.model).toBe("deepseek-v4-flash:free");
    expect(forwardedPayload.messages[0].content).toContain("selected TokenForge model: deepseek-v4-pro");
    expect(JSON.stringify(fetchMock.mock.calls[0][1])).not.toContain("server-only-provider-secret");
    expect(JSON.stringify(fetchMock.mock.calls[0][1])).not.toContain("server-only-cluster-secret");
    expect(reserveCredit).toHaveBeenCalledWith(42, 0, expect.stringMatching(/^tf_pg_/));
    expect(recordUsage).toHaveBeenCalledWith(expect.objectContaining({ modelId: "deepseek-v4-pro", status: "success", inputTokens: 10, outputTokens: 20 }));
  });

  it("stops before provider execution when the promotional credit reservation is denied", async () => {
    vi.mocked(reserveCredit).mockResolvedValue({ authorized: false, balanceNanos: 0 });
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(runPlaygroundCompletion({
      userId: 42,
      model: "grok-4.5",
      messages: [{ role: "user", content: "Hello" }],
      sourceIpHash: "hashed-source-ip",
    })).rejects.toMatchObject<TokenForgePlaygroundError>({ code: "insufficient_credits" });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(settleReservedCredit).not.toHaveBeenCalled();
  });
});
