import { describe, expect, it } from "vitest";
import {
  getKimiK3ProviderSettings,
  updateKimiK3ProviderSettings,
  getManagedProviderKeyMetrics,
  setUserMessageLoggingEnabled,
  isUserMessageLoggingEnabled,
  recordUserInteractionLog,
  listUserInteractionLogs,
  recordKimiK3FailureLog,
  getRecentKimiK3FailureLogs,
  getOrCreateUserByEmail,
} from "./db";

describe("Kimi K3 Provider Settings & Admin Message Logging", () => {
  it("allows querying and updating Kimi K3 provider settings with key masking", async () => {
    const admin = await getOrCreateUserByEmail("admin@gmail.com", "Admin User");
    const initial = await getKimiK3ProviderSettings();
    expect(initial).toBeDefined();
    expect(Array.isArray(initial.providers)).toBe(true);

    const updated = await updateKimiK3ProviderSettings({
      providers: [
        {
          id: "kimi-primary",
          label: "Moonshot Kimi K3 Primary",
          enabled: true,
          baseUrl: "https://api.moonshot.cn/v1",
          model: "kimi-k3",
          apiKeys: ["sk-moonshot-test-key-1234567890"],
          pinnedUserEmails: ["admin@gmail.com"],
        },
      ],
    }, admin.id);

    expect(updated.providers).toHaveLength(1);
    expect(updated.providers[0]?.id).toBe("kimi-primary");
    expect(updated.providers[0]?.label).toBe("Moonshot Kimi K3 Primary");
    expect(updated.providers[0]?.baseUrl).toBe("https://api.moonshot.cn/v1");
    expect(updated.providers[0]?.model).toBe("kimi-k3");
    expect(updated.providers[0]?.apiKeyMasks[0]?.value).toContain("7890");
    expect(updated.providers[0]?.pinnedUserEmails).toContain("admin@gmail.com");
  });

  it("includes kimi-k3 in managed provider key metrics", async () => {
    const metrics = await getManagedProviderKeyMetrics();
    const kimiMetric = metrics.find((m) => m.modelId === "kimi-k3");
    expect(kimiMetric).toBeDefined();
    expect(kimiMetric?.providers).toBeDefined();
  });

  it("records and retrieves Kimi K3 failure logs", async () => {
    await recordKimiK3FailureLog({
      sourceType: "provider",
      sourceId: "kimi-primary",
      sourceLabel: "Moonshot Kimi K3 Primary",
      credentialSlot: 1,
      failureKind: "http",
      httpStatus: 500,
      retryable: true,
      callerMessage: "HTTP 500 — Upstream error",
    });

    const logs = await getRecentKimiK3FailureLogs(10);
    expect(logs.length).toBeGreaterThan(0);
    expect(logs[0]?.sourceLabel).toBe("Moonshot Kimi K3 Primary");
  });

  it("enables message logging for admin@gmail.com and records inspection logs", async () => {
    const admin = await getOrCreateUserByEmail("admin@gmail.com", "Admin User");

    // Enable inspect/message logging for admin
    await setUserMessageLoggingEnabled(admin.id, true);
    const isEnabled = await isUserMessageLoggingEnabled(admin.id);
    expect(isEnabled).toBe(true);

    // Record interaction log from API
    await recordUserInteractionLog({
      userId: admin.id,
      model: "kimi-k3",
      provider: "Moonshot Kimi K3 Primary",
      source: "api",
      userInput: "[user] Hello Kimi K3 from admin api key",
      outputResponse: "Hello Admin! Kimi K3 is ready to assist you.",
      ipAddress: "127.0.0.1",
    });

    // Record interaction log from Playground
    await recordUserInteractionLog({
      userId: admin.id,
      model: "claude-opus-5",
      provider: "b.ai Primary",
      source: "playground",
      userInput: "[user] Test playground streaming log",
      outputResponse: "Streamed response received in playground.",
      ipAddress: "127.0.0.1",
    });

    const logs = await listUserInteractionLogs({ userId: admin.id, limit: 10 });
    expect(logs.total).toBeGreaterThanOrEqual(2);
    expect(logs.logs.some((e) => e.model === "kimi-k3" && e.source === "api" && e.provider === "Moonshot Kimi K3 Primary")).toBe(true);
    expect(logs.logs.some((e) => e.model === "claude-opus-5" && e.source === "playground" && e.provider === "b.ai Primary")).toBe(true);
  });
});
