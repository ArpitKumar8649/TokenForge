import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const projectRoot = path.resolve(import.meta.dirname, "..");
const source = readFileSync(path.join(projectRoot, "client/src/pages/AdminDashboard.tsx"), "utf8");
const qwenSource = readFileSync(path.join(projectRoot, "client/src/pages/Qwen38MaxProviderSettings.tsx"), "utf8");

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
    expect(source).toContain('option.value = "qwen3.8-max"');
    expect(source).toContain('window.location.assign("/admin/qwen3.8-max")');
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
    expect(qwenSource).toContain('item.modelId === "qwen3.8-max"');
  });

  it("gives DeepSeek V4 Pro equal-share provider-group controls without an 82-request retirement policy", () => {
    expect(source).toContain("DeepSeek V4 Pro multi-provider load balancer");
    expect(source).toContain("DeepSeek V4 Pro has no TokenForge 82-request lifetime retirement");
    expect(source).toContain("DeepSeek request counters remain informational rather than admission caps");
  });

  it("gives Claude Fable 5 grouped-provider parity and keeps Fable, GLM, and DeepSeek failure details administrator-only", () => {
    expect(source).toContain("function ClaudeFable5ProviderBalancerPanel");
    expect(source).toContain('providerName="Claude Fable 5"');
    expect(source).toContain("function ManagedModelFailureHistory");
    expect(source).toContain('model="claude-fable-5" title="Claude Fable 5"');
    expect(source).toContain('model="glm-5.3" title="GLM 5.3"');
    expect(source).toContain('model="deepseek-v4-pro" title="DeepSeek V4 Pro"');
    expect(source).toContain("Caller-visible TokenForge message");
    expect(source).toContain("Credential-redacted upstream diagnostic");
    expect(source).toContain("Occurred:");
  });

  it("adds Qwen 3.8 Max as a protected equal-share provider editor with administrator-only history", () => {
    expect(source).toContain("function Qwen38MaxProviderBalancerPanel");
    expect(source).toContain('providerName="Qwen 3.8 Max"');
    expect(source).toContain('model="qwen3.8-max" title="Qwen 3.8 Max"');
    expect(qwenSource).toContain("Administrator access required");
    expect(qwenSource).toContain("Back to provider settings");
  });

  it("uses named keyboard-accessible provider tabs instead of requiring long vertical group scrolling", () => {
    expect(source).toContain('tabList.setAttribute("role", "tablist")');
    expect(source).toContain('button.setAttribute("role", "tab")');
    expect(source).toContain('cards[index]?.setAttribute("role", "tabpanel")');
    expect(source).toContain('event.key !== "ArrowLeft" && event.key !== "ArrowRight"');
    expect(source).toContain("provider groups");
  });

  it("adds an administrator-only Qwen model pool to Claude Opus with editable quotas and live retirement progress", () => {
    expect(source).toContain("function ClaudeOpus5QwenModelPoolPanel");
    expect(source).toContain("Claude Opus 5 · Qwen model-pool provider");
    expect(source).toContain("Rotating model IDs");
    expect(source).toContain("Retired at quota");
    expect(source).toContain("Save Qwen model pool");
    expect(source).toContain("Two active server-side API keys are required");
    expect(source).toContain("never returned by Playground, OpenAI-compatible, or Anthropic-compatible responses");
  });

  it("lays overview metrics out as compact boxes on narrow screens rather than a single vertical list", () => {
    expect(source).toContain('grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5');
    expect(source).toContain('dashboard-card min-w-0 p-3 sm:p-4');
  });

  it("keeps a locally deleted DeepSeek provider key removed after the successful save response", () => {
    expect(source).toContain("setInitialized(true);");
    expect(source).not.toContain("setInitialized(false);");
    expect(source).toContain("removedSlots: saved?.apiKeyMasks[keyIndex]?.slot");
  });
});
