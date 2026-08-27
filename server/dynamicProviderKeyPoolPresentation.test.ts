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

  it("provides protected per-key enablement controls that keep disabled credentials out of routing", () => {
    expect(source).toContain("Turn off a key to preserve it securely while excluding it from new calls and failover");
    expect(source).toContain("enabledStates={keyStates}");
    expect(source).toContain("apiKeyEnabled: keyStates.map");
    expect(source).toContain("apiKeyEnabled: props.apiKeys.map");
    expect(source).toContain("Claude Opus Qwen");
    expect(source).toContain("tokenforge-key-routing-state");
  });

  it("uses a one-model-at-a-time selector instead of rendering the legacy paired panels", () => {
    expect(source).toContain('id="managed-provider-selector"');
    expect(source).toContain('value={selectedProvider}');
    expect(source).toContain('selectedProvider === "claude-fable-5"');
    expect(source).toContain('selectedProvider === "claude-opus-5"');
    expect(source).toContain('selectedProvider === "glm-5.3"');
    expect(source).toContain('selectedProvider === "deepseek-v4-pro"');
    expect(source).toContain('<option value="qwen3.8-max">Qwen 3.8 Max</option>');
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
    expect(source).toContain("return [...mergedSaved, ...unsavedDrafts]");
    expect(source).toContain('filter(provider => provider.label.trim().toLowerCase() !== "qwen")');
    expect(source).toContain('className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/8"');
    expect(source).toContain("Add model ID");
    expect(source).toContain("function ClaudeOpus5QwenFailureHistory");
    expect(source).toContain("Qwen live error history");
    expect(source).toContain("Failing internal model ID");
    expect(source).toContain("Qwen zero-output outcomes");
    expect(source).toContain('entry.sourceId.startsWith("qwen:")');
    expect(source).toContain("Maximum output tokens");
    expect(source).toContain("Current saved limit:");
    expect(source).toContain('id="opus-qwen-max-output-tokens"');
    expect(source).toContain("Maximum permitted value: 32,768");
  });

  it("preserves intentional Qwen model deletions and newly added Claude Opus providers through live settings refreshes", () => {
    expect(source).toContain("const [removedModelIds, setRemovedModelIds] = useState<string[]>([]);");
    expect(source).toContain("const removedIds = new Set(removedModelIds);");
    expect(source).toContain("livePool.filter(live => !removedIds.has(live.id))");
    expect(source).toContain("const removeModel = (id: string) => {");
    expect(source).toContain("setRemovedModelIds(current => current.includes(id) ? current : [...current, id]);");
    expect(source).toContain("const [opusProviderDraftsInitialized, setOpusProviderDraftsInitialized] = useState(false);");
    expect(source).toContain("const [removedOpusProviderIds, setRemovedOpusProviderIds] = useState<string[]>([]);");
    expect(source).toContain("const unsavedDrafts = previous.filter(draft => !removedIds.has(draft.id) && !liveProviders.some(provider => provider.id === draft.id));");
    expect(source).toContain("onAddProvider: (id: string) => void");
    expect(source).toContain("setActiveProviderId(id);");
    expect(source).toContain("onAddProvider={id => setOpusProviderDrafts");
  });

  it("routes saved Qwen trash actions through direct durable-deletion mutations", () => {
    expect(source).toContain("trpc.admin.deleteClaudeOpus5QwenModel.useMutation");
    expect(source).toContain("trpc.admin.deleteClaudeOpus5QwenApiKey.useMutation");
    expect(source).toContain("Qwen model ID permanently deleted");
    expect(source).toContain("Qwen API key permanently deleted");
    expect(source).toContain("const requiredKeyCount = providerName === \"Claude Opus Qwen\" ? Math.max(2, minKeys) : minKeys;");
    expect(source).toContain("deleteSavedModel.mutate({ providerId: provider.id, modelEntryId: id })");
    expect(source).toContain("deleteSavedApiKey.mutate({ providerId: provider.id, slot });");
  });

  it("adds Claude Sonnet 4.6 managed multi-provider controls, metrics, and timestamped administrator-only diagnostics", () => {
    expect(source).toContain('window.location.assign("/admin/sonnet4.6")');
    expect(source).toContain('<option value="claude-sonnet-4.6">Claude Sonnet 4.6</option>');
    expect(source).toContain('<Sonnet46ProviderBalancerPanel metrics={managedProviderKeyMetrics.find(item => item.modelId === "claude-sonnet-4.6")} />');
    expect(source).toContain('model="claude-sonnet-4.6" title="Claude Sonnet 4.6"');
    expect(source).toContain("sonnet46FailureLogs.useQuery");
  });

  it("provides a Bailu-only administrator-managed Webshare direct-proxy pool without browser-visible credentials", () => {
    expect(source).toContain("function BailuWebshareProxyPoolPanel");
    expect(source).toContain("function BailuWebshareProxyUrlImporter");
    expect(source).toContain("Add Bailu Direct proxy by URL");
    expect(source).toContain("Complete Direct proxy URL");
    expect(source).toContain("Parse & add proxy");
    expect(source).toContain("proxyUrl: directProxyUrl");
    expect(source).toContain("Bailu Webshare egress pool");
    expect(source).toContain("trpc.admin.bailuWebshareProxyPoolSettings.useQuery");
    expect(source).toContain("updateBailuWebshareProxyPoolSettings.useMutation");
    expect(source).toContain("Only the Claude Opus provider group named Bailu can use this pool");
    expect(source).toContain("no user IP header is sent upstream");
    expect(source).toContain("Saved passwords remain masked");
    expect(source).toContain("drafts.length >= 3");
    expect(source).toContain("Paused automatically until");
    expect(source).toContain("Metrics refresh every five seconds");
  });

  it("lays overview metrics out as compact boxes on narrow screens rather than a single vertical list", () => {
    expect(source).toContain('grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5');
    expect(source).toContain('dashboard-card min-w-0 p-3 sm:p-4');
  });

  it("shows each protected account’s referral count and supports most-referrals sorting", () => {
    expect(source).toContain("Referrals made");
    expect(source).toContain("account.referralCount.toLocaleString()");
    expect(source).toContain('value="mostReferrals">Most referrals made</option>');
  });

  it("keeps a locally deleted DeepSeek provider key removed after the successful save response", () => {
    expect(source).toContain("setInitialized(true);");
    expect(source).not.toContain("setInitialized(false);");
    expect(source).toContain("removedSlots: saved?.apiKeyMasks[keyIndex]?.slot");
  });

  it("separates every managed model’s error history into configured provider-name tabs and exposes b.ai diagnostics only to administrators", () => {
    expect(source).toContain("function ProviderScopedFailureHistory");
    expect(source).toContain("const configuredProviders = ((settings as ClaudeOpus5SettingsData | undefined)?.providers ?? [])");
    expect(source).toContain("const providerTabs = configuredProviders.length");
    expect(source).toContain('role="tablist"');
    expect(source).toContain("`${title} failure providers`");
    expect(source).toContain('entry.sourceType === "provider" && entry.sourceId === activeProvider.id');
    expect(source).toContain("Every saved provider has its own live tab");
    expect(source).toContain("No credential-redacted failures have been recorded for this provider.");
    expect(source).toContain('muted ? "shrink-0 text-[#6f7181]');
    expect(source).toContain("Disabled</span>");
    expect(source).toContain("function ProviderFailureLogEntry");
    expect(source).toContain("function BaiDiagnosticViewer");
    expect(source).toContain("b.ai diagnostic viewer");
    expect(source).toContain("Name the configured provider group “b.ai”");
    expect(source).toContain('<ProviderScopedFailureHistory model="claude-opus-5" title="Claude Opus 5" />');
    expect(source).toContain('<ProviderScopedFailureHistory model={model} title={title} />');
  });

  it("shows durable b.ai provider-group 429 circuit telemetry only in the protected Claude Opus administrator view", () => {
    expect(source).toContain("function BaiProviderCircuitHealth");
    expect(source).toContain("function BaiProviderCircuitPanel");
    expect(source).toContain("b.ai provider circuit");
    expect(source).toContain("Only upstream HTTP 429 responses open this provider-group circuit for one minute");
    expect(source).toContain('trpc.admin.claudeOpus5ProviderSettings.useQuery(undefined, { refetchInterval: 5_000');
    expect(source).toContain("New b.ai attempts resume automatically");
    expect(source).toContain("<BaiProviderCircuitPanel />");
  });
});
