import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const projectRoot = path.resolve(import.meta.dirname, "..");
const source = readFileSync(path.join(projectRoot, "client/src/pages/AdminDashboard.tsx"), "utf8");

describe("dynamic managed provider API-key pool controls", () => {
  it("provides masked add and remove controls for all managed provider pools", () => {
    expect(source).toContain("function DynamicProviderKeyPool");
    expect(source).toContain("function ManagedProviderSettingsPanel");
    expect(source).toContain("function ClaudeOpus5ProviderBalancerPanel");
    expect(source).toContain("Add provider");
    expect(source).toContain("Save load balancer");
    expect(source).toContain("enabled provider groups");
    expect(source).toContain("excluded from new calls and failover");
    expect(source).toContain("enabled: provider.enabled");
    expect(source).toContain("enabled: true, baseUrl");
    expect(source).toContain('providerName="Claude Fable 5"');
    expect(source).toContain('providerName="GLM 5.3"');
    expect(source).toContain('providerName="DeepSeek V4 Pro"');
    expect(source).toContain("onRemove={index =>");
    expect(source).toContain("removedSlots: saved?.apiKeyMasks[keyIndex]?.slot");
    expect(source).toContain("removeSlots: fableRemovedSlots");
    expect(source).toContain("removeSlots: glm53RemovedSlots");
    expect(source).toContain("removeSlots: deepseekV4ProRemovedSlots");
  });

  it("uses a one-model-at-a-time selector instead of rendering the legacy paired panels", () => {
    expect(source).toContain('id="managed-provider-selector"');
    expect(source).toContain('value={selectedProvider}');
    expect(source).toContain('selectedProvider === "claude-fable-5"');
    expect(source).toContain('selectedProvider === "claude-opus-5"');
    expect(source).toContain('selectedProvider === "glm-5.3"');
    expect(source).toContain('selectedProvider === "deepseek-v4-pro"');
    expect(source).toContain('{section === "providers" && managedProviderSettingsSection}');
  });

  it("shows only masked, model-specific per-key request and health metrics in the selected panel", () => {
    expect(source).toContain("function ManagedProviderKeyMetrics");
    expect(source).toContain("Provider & key metrics");
    expect(source).toContain("Provider and credential observability");
    expect(source).toContain("Per-key request & health");
    expect(source).toContain("Raw API keys never leave the server");
    expect(source).toContain("managedProviderKeyMetrics.find(item => item.modelId === \"claude-fable-5\")");
    expect(source).toContain("managedProviderKeyMetrics.find(item => item.modelId === \"claude-opus-5\")");
    expect(source).toContain("managedProviderKeyMetrics.find(item => item.modelId === \"glm-5.3\")");
    expect(source).toContain("managedProviderKeyMetrics.find(item => item.modelId === \"deepseek-v4-pro\")");
  });

  it("gives DeepSeek V4 Pro equal-share provider-group controls without an 82-request retirement policy", () => {
    expect(source).toContain("DeepSeek V4 Pro multi-provider load balancer");
    expect(source).toContain("DeepSeek V4 Pro has no TokenForge 82-request lifetime retirement");
    expect(source).toContain("DeepSeek request counters remain informational rather than admission caps");
  });
});
