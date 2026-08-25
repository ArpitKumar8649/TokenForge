import { describe, expect, it } from "vitest";
import { getClaudeOpus5ProviderSettings, getRecentClaudeOpus5FailureLogs } from "./db";

describe("Bailu Claude Opus 5 provider inspection", () => {
  it("reports the configured Bailu label and accessible administrator failure-history count without exposing credentials", async () => {
    const settings = await getClaudeOpus5ProviderSettings();
    const labels = settings.providers.map(provider => `${provider.id}:${provider.label}`);
    const hasBailu = labels.some(label => label.toLowerCase().includes("bailu"));
    const failures = await getRecentClaudeOpus5FailureLogs(100);

    console.info(JSON.stringify({ providerSource: settings.source, providerLabels: labels, hasBailu, administratorFailureLogCount: failures.length }));
    expect(settings.providers.length).toBeGreaterThan(0);
    expect(hasBailu).toBe(true);
    expect(Array.isArray(failures)).toBe(true);
  });
});
