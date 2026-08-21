import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const projectRoot = path.resolve(import.meta.dirname, "..");
const source = readFileSync(path.join(projectRoot, "client/src/pages/AdminDashboard.tsx"), "utf8");

describe("dynamic managed provider API-key pool controls", () => {
  it("provides masked add and remove controls for all managed provider pools", () => {
    expect(source).toContain("function DynamicProviderKeyPool");
    expect(source).toContain("function ManagedProviderSettingsPanel");
    expect(source).toContain('providerName="Claude Opus 5"');
    expect(source).toContain('providerName="Claude Fable 5"');
    expect(source).toContain('providerName="GLM 5.3"');
    expect(source).toContain('providerName="DeepSeek V4 Pro"');
    expect(source).toContain("onRemove={index =>");
    expect(source).toContain("removeSlots: opusRemovedSlots");
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
});
