import React, { useState, useEffect, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, AlertTriangle, Copy, Check } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { ClaudeOpus5FailureLog, ClaudeOpus5SettingsData, ClaudeOpus5ProviderSettingsData } from "../types";
import { SectionHeader } from "../common/AdminCommon";

export function ProviderFailureLogEntry({ entry }: { entry: ClaudeOpus5FailureLog }) {
  const [copied, setCopied] = useState(false);

  const formattedCallerMessage = useMemo(() => {
    if (!entry.callerMessage) return "";
    try {
      const parsed = JSON.parse(entry.callerMessage);
      return JSON.stringify(parsed, null, 2);
    } catch {
      return entry.callerMessage;
    }
  }, [entry.callerMessage]);

  const handleCopy = () => {
    void navigator.clipboard.writeText(formattedCallerMessage || entry.callerMessage || "");
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="rounded-xl border border-white/8 bg-black/15 p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge className="border border-violet-300/20 bg-violet-300/10 text-[9px] text-violet-100">
              Provider group
            </Badge>
            <p className="font-mono text-[10px] font-semibold text-[#e6e6ee]">{entry.sourceLabel}</p>
            {entry.credentialSlot ? (
              <Badge className="border border-amber-300/25 bg-amber-300/10 text-[9px] text-amber-100">
                Key {entry.credentialSlot}
              </Badge>
            ) : null}
            {entry.httpStatus ? (
              <Badge
                className={`border text-[9px] ${
                  entry.httpStatus >= 500
                    ? "border-red-400/30 bg-red-400/10 text-red-200"
                    : entry.httpStatus === 429
                    ? "border-orange-400/30 bg-orange-400/10 text-orange-200"
                    : "border-amber-400/30 bg-amber-400/10 text-amber-200"
                }`}
              >
                HTTP {entry.httpStatus}
              </Badge>
            ) : null}
          </div>
          <div className="mt-2 grid gap-2 lg:grid-cols-2">
            <div className="relative">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[9px] font-bold uppercase tracking-[.11em] text-amber-200">
                  Credential-redacted upstream diagnostic
                </p>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleCopy}
                  className="h-5 px-1.5 text-[9px] text-amber-200/80 hover:bg-amber-300/10 hover:text-amber-100"
                  title="Copy upstream diagnostic"
                >
                  {copied ? (
                    <>
                      <Check size={11} className="mr-1 text-[#c9ff73]" /> Copied
                    </>
                  ) : (
                    <>
                      <Copy size={11} className="mr-1" /> Copy error
                    </>
                  )}
                </Button>
              </div>
              <pre className="mt-1 max-h-72 overflow-auto whitespace-pre-wrap break-words rounded bg-black/30 p-2 font-mono text-[9px] leading-4 text-amber-100">
                {formattedCallerMessage}
              </pre>
            </div>
            <div>
              <p className="text-[9px] font-bold uppercase tracking-[.11em] text-[#c9ff73]">
                Caller-visible TokenForge message
              </p>
              <p className="mt-1 rounded-lg border border-[#c9ff73]/20 bg-[#c9ff73]/[.055] p-2 font-mono text-[10px] leading-4 text-[#e6f7c5]">
                {entry.publicMessage ?? "The selected model is temporarily unavailable. Please retry shortly."}
              </p>
            </div>
          </div>
        </div>
        <div className="shrink-0 text-right">
          <p className="font-mono text-[10px] font-semibold text-amber-200">
            {entry.httpStatus ? `HTTP ${entry.httpStatus}` : entry.failureKind}
          </p>
          <p className="mt-1 text-[9px] text-[#858697]">{entry.retryable ? "Failover eligible" : "No retry"}</p>
          <time className="mt-1 block text-[9px] text-[#858697]" dateTime={new Date(entry.occurredAt).toISOString()}>
            Occurred: {new Date(entry.occurredAt).toLocaleString()}
          </time>
        </div>
      </div>
    </div>
  );
}

export type ProviderScopedFailureModel =
  | "claude-opus-5"
  | "claude-fable-5.1"
  | "glm-5.3"
  | "claude-sonnet-4.6"
  | "deepseek-v4-pro"
  | "qwen3.8-max"
  | "gpt-6-astra"
  | "kimi-k3"
  | (string & {});

export function ProviderScopedFailureHistory({
  model,
  title,
  customProviders,
  metrics,
}: {
  model: ProviderScopedFailureModel;
  title: string;
  customProviders?: Array<{ id: string; label: string; enabled?: boolean }>;
  metrics?: { providers?: Array<{ id: string; label: string; slots?: Array<{ failureCount?: number; lastFailureAt?: string | Date | null }> }> };
}) {
  const dynamicModelLogs = trpc.admin.modelFailureLogs.useQuery(
    { modelId: model },
    {
      refetchInterval: 5_000,
      refetchIntervalInBackground: false,
    }
  );

  const opus = trpc.admin.claudeOpus5FailureLogs.useQuery(undefined, {
    refetchInterval: 5_000,
    refetchIntervalInBackground: false,
    enabled: model === "claude-opus-5",
  });
  const fable = trpc.admin.claudeFable5FailureLogs.useQuery(undefined, {
    refetchInterval: 5_000,
    refetchIntervalInBackground: false,
    enabled: model === "claude-fable-5.1",
  });
  const glm = trpc.admin.glm53FailureLogs.useQuery(undefined, {
    refetchInterval: 5_000,
    refetchIntervalInBackground: false,
    enabled: model === "glm-5.3",
  });
  const sonnet = trpc.admin.sonnet46FailureLogs.useQuery(undefined, {
    refetchInterval: 5_000,
    refetchIntervalInBackground: false,
    enabled: model === "claude-sonnet-4.6",
  });
  const deepseek = trpc.admin.deepseekV4ProFailureLogs.useQuery(undefined, {
    refetchInterval: 5_000,
    refetchIntervalInBackground: false,
    enabled: model === "deepseek-v4-pro",
  });
  const qwen = trpc.admin.qwen38MaxFailureLogs.useQuery(undefined, {
    refetchInterval: 5_000,
    refetchIntervalInBackground: false,
    enabled: model === "qwen3.8-max",
  });
  const gpt6Astra = trpc.admin.gpt6AstraFailureLogs.useQuery(undefined, {
    refetchInterval: 5_000,
    refetchIntervalInBackground: false,
    enabled: model === "gpt-6-astra",
  });
  const kimi = trpc.admin.kimiK3FailureLogs.useQuery(undefined, {
    refetchInterval: 5_000,
    refetchIntervalInBackground: false,
    enabled: model === "kimi-k3",
  });

  const opusSettings = trpc.admin.claudeOpus5ProviderSettings.useQuery(undefined, {
    refetchInterval: 5_000,
    refetchIntervalInBackground: false,
  });
  const fableSettings = trpc.admin.claudeFable5ProviderSettings.useQuery(undefined, {
    refetchInterval: 5_000,
    refetchIntervalInBackground: false,
  });
  const glmSettings = trpc.admin.glm53ProviderSettings.useQuery(undefined, {
    refetchInterval: 5_000,
    refetchIntervalInBackground: false,
  });
  const sonnetSettings = trpc.admin.sonnet46ProviderSettings.useQuery(undefined, {
    refetchInterval: 5_000,
    refetchIntervalInBackground: false,
  });
  const deepseekSettings = trpc.admin.deepseekV4ProProviderSettings.useQuery(undefined, {
    refetchInterval: 5_000,
    refetchIntervalInBackground: false,
  });
  const qwenSettings = trpc.admin.qwen38MaxProviderSettings.useQuery(undefined, {
    refetchInterval: 5_000,
    refetchIntervalInBackground: false,
  });
  const gpt6AstraSettings = trpc.admin.gpt6AstraProviderSettings.useQuery(undefined, {
    refetchInterval: 5_000,
    refetchIntervalInBackground: false,
  });
  const kimiSettings = trpc.admin.kimiK3ProviderSettings.useQuery(undefined, {
    refetchInterval: 5_000,
    refetchIntervalInBackground: false,
  });

  const isDedicatedModel =
    model === "claude-opus-5" ||
    model === "claude-fable-5.1" ||
    model === "glm-5.3" ||
    model === "claude-sonnet-4.6" ||
    model === "qwen3.8-max" ||
    model === "gpt-6-astra" ||
    model === "kimi-k3" ||
    model === "deepseek-v4-pro";

  const universalSettings = trpc.admin.universalModelProviderSettings.useQuery(
    { modelId: model },
    {
      refetchInterval: 5_000,
      refetchIntervalInBackground: false,
    }
  );

  const query =
    model === "claude-opus-5"
      ? opus
      : model === "claude-fable-5.1"
      ? fable
      : model === "glm-5.3"
      ? glm
      : model === "claude-sonnet-4.6"
      ? sonnet
      : model === "qwen3.8-max"
      ? qwen
      : model === "gpt-6-astra"
      ? gpt6Astra
      : model === "kimi-k3"
      ? kimi
      : deepseek;

  const entries = useMemo(() => {
    if (Array.isArray(dynamicModelLogs.data)) {
      return dynamicModelLogs.data as ClaudeOpus5FailureLog[];
    }
    return (query.data ?? []) as ClaudeOpus5FailureLog[];
  }, [dynamicModelLogs.data, query.data]);

  const settings = useMemo(() => {
    // If universalSettings has providers configured in DB, prefer it
    if (universalSettings.data?.providers && universalSettings.data.providers.length > 0) {
      return universalSettings.data;
    }
    return model === "claude-opus-5"
      ? opusSettings.data
      : model === "claude-fable-5.1"
      ? fableSettings.data
      : model === "glm-5.3"
      ? glmSettings.data
      : model === "claude-sonnet-4.6"
      ? sonnetSettings.data
      : model === "qwen3.8-max"
      ? qwenSettings.data
      : model === "gpt-6-astra"
      ? gpt6AstraSettings.data
      : model === "kimi-k3"
      ? kimiSettings.data
      : model === "deepseek-v4-pro"
      ? deepseekSettings.data
      : universalSettings.data;
  }, [
    universalSettings.data,
    model,
    opusSettings.data,
    fableSettings.data,
    glmSettings.data,
    sonnetSettings.data,
    qwenSettings.data,
    gpt6AstraSettings.data,
    kimiSettings.data,
    deepseekSettings.data,
  ]);

  const configuredProviders = useMemo(() => {
    if (customProviders && customProviders.length > 0) {
      return customProviders.map((p) => ({
        id: p.id,
        label: p.label,
        enabled: p.enabled !== false,
        configured: true,
      }));
    }
    const sourceProviders = ((settings as ClaudeOpus5SettingsData | undefined)?.providers ??
      []) as ClaudeOpus5ProviderSettingsData[];
    return sourceProviders.map((p) => ({
      id: p.id,
      label: p.label,
      enabled: p.enabled !== false,
      configured: true,
    }));
  }, [customProviders, settings]);

  const specificTabs = configuredProviders.length
    ? configuredProviders.map((provider) => ({
        id: provider.id,
        label: provider.label,
        enabled: provider.enabled,
        configured: true,
      }))
    : Array.from(new Set(entries.map((entry) => entry.sourceLabel)))
        .sort((left, right) => left.localeCompare(right))
        .map((label) => ({ id: label, label, enabled: true, configured: false }));

  const isEntryForProvider = (
    entry: ClaudeOpus5FailureLog,
    provider: { id: string; label: string; configured: boolean }
  ) => {
    if (provider.id === "all") return true;
    if (provider.id.startsWith("removed_")) {
      const sLabel = (entry.sourceLabel ?? "").toLowerCase().trim();
      const targetLabel = provider.label.replace(/\s*\(Removed\)$/i, "").toLowerCase().trim();
      return sLabel === targetLabel || sLabel.startsWith(targetLabel) || targetLabel.startsWith(sLabel);
    }
    if (!provider.configured) {
      return entry.sourceLabel === provider.id;
    }
    if (entry.sourceType !== "provider") return false;
    const sourceId = (entry.sourceId ?? "").toLowerCase();
    const sourceLabel = (entry.sourceLabel ?? "").toLowerCase().trim();
    const targetId = provider.id.toLowerCase();
    const targetLabel = provider.label.toLowerCase().trim();

    // Direct ID exact match or prefix
    if (sourceId === targetId || sourceId.startsWith(`${targetId}:`) || sourceId.startsWith(`${targetId}-`)) {
      return true;
    }

    // Direct label match
    if (sourceLabel === targetLabel || sourceLabel.startsWith(`${targetLabel} `) || sourceLabel.startsWith(`${targetLabel}·`) || sourceLabel.startsWith(`${targetLabel}:`)) {
      return true;
    }

    // Normalized label match (stripping version numbers like _5.5, -5.5, spaces, underscores)
    const normSource = sourceLabel.replace(/[_\s-]+(v?\d+(\.\d+)?)$/i, "").replace(/[_\s-]+/g, " ").trim();
    const normTarget = targetLabel.replace(/[_\s-]+(v?\d+(\.\d+)?)$/i, "").replace(/[_\s-]+/g, " ").trim();
    if (normSource && normTarget && (normSource === normTarget || normSource.includes(normTarget) || normTarget.includes(normSource))) {
      return true;
    }

    return false;
  };

  // Identify distinct removed providers that have recorded logs but aren't currently configured
  const removedTabs = useMemo(() => {
    if (!configuredProviders.length) return [];
    const list: Array<{ id: string; label: string; enabled: boolean; configured: boolean }> = [];
    const seenLabels = new Set<string>();
    for (const entry of entries) {
      const isMatched = configuredProviders.some((p) => isEntryForProvider(entry, p));
      if (!isMatched && entry.sourceLabel) {
        const cleanLabel = entry.sourceLabel.trim();
        const key = cleanLabel.toLowerCase();
        if (!seenLabels.has(key)) {
          seenLabels.add(key);
          list.push({
            id: `removed_${key.replace(/[^a-z0-9_-]/g, "_")}`,
            label: `${cleanLabel} (Removed)`,
            enabled: false,
            configured: false,
          });
        }
      }
    }
    return list;
  }, [entries, configuredProviders]);

  const providerTabs = [
    { id: "all", label: "All providers", enabled: true, configured: false },
    ...specificTabs,
    ...removedTabs,
  ];

  const [activeProviderId, setActiveProviderId] = useState("all");

  useEffect(() => {
    if (!providerTabs.length) {
      if (activeProviderId) setActiveProviderId("");
      return;
    }
    if (!providerTabs.some((provider) => provider.id === activeProviderId)) {
      setActiveProviderId("all");
    }
  }, [activeProviderId, providerTabs.map((provider) => `${provider.id}:${provider.enabled}`).join("\u0000")]);

  const activeProvider = providerTabs.find((provider) => provider.id === activeProviderId);

  const visibleEntries = activeProvider
    ? entries.filter((entry) => isEntryForProvider(entry, activeProvider))
    : [];

  const activeProviderSlotFailures = useMemo(() => {
    if (!metrics?.providers || !activeProvider || activeProvider.id === "all") return 0;
    const targetNorm = activeProvider.label.toLowerCase().replace(/[_\s-]+(v?\d+(\.\d+)?)$/i, "").replace(/[_\s-]+/g, " ").trim();
    const found = metrics.providers.find((p) => {
      if (p.id === activeProvider.id) return true;
      const pNorm = p.label.toLowerCase().replace(/[_\s-]+(v?\d+(\.\d+)?)$/i, "").replace(/[_\s-]+/g, " ").trim();
      return pNorm === targetNorm;
    });
    if (!found?.slots) return 0;
    return found.slots.reduce((acc, slot) => acc + (slot.failureCount ?? 0), 0);
  }, [metrics, activeProvider]);

  return (
    <section className="dashboard-card">
      <SectionHeader
        icon={<AlertTriangle size={17} />}
        title={`${title} provider diagnostics`}
        detail="Every saved and active provider has its own live tab. Redacted upstream details remain administrator-only beside the exact neutral caller message."
      />
      <div className="mt-4 rounded-xl border border-amber-300/15 bg-amber-300/5 px-3 py-2 text-[10px] leading-5 text-amber-100">
        Recovered attempts remain visible in the provider that failed before failover. Caller responses never contain
        these diagnostics.
      </div>
      {dynamicModelLogs.isLoading && !entries.length ? (
        <div className="grid min-h-40 place-items-center">
          <Loader2 className="animate-spin text-[#c9ff73]" size={18} />
        </div>
      ) : providerTabs.length ? (
        <>
          <div
            className="mt-4 flex gap-2 overflow-x-auto border-b border-white/10 pb-2"
            role="tablist"
            aria-label={`${title} failure providers`}
          >
            {providerTabs.map((provider) => {
              const count = entries.filter((entry) => isEntryForProvider(entry, provider)).length;
              const selected = activeProviderId === provider.id;
              const muted = !provider.enabled;
              return (
                <Button
                  key={provider.id}
                  type="button"
                  size="sm"
                  variant="ghost"
                  role="tab"
                  aria-selected={selected}
                  onClick={() => setActiveProviderId(provider.id)}
                  className={
                    muted
                      ? "shrink-0 text-[#6f7181] hover:bg-white/5 hover:text-[#9a9baa]"
                      : selected
                      ? "shrink-0 bg-[#c9ff73]/15 text-[#d8ff91] hover:bg-[#c9ff73]/20 hover:text-[#e5ffb5]"
                      : "shrink-0 text-[#a8a9b8] hover:bg-white/8 hover:text-white"
                  }
                >
                  {provider.label}{" "}
                  <span
                    className={`ml-1 rounded bg-black/25 px-1.5 py-0.5 font-mono text-[9px] ${
                      muted ? "text-[#6f7181]" : ""
                    }`}
                  >
                    {count}
                  </span>
                  {muted ? <span className="ml-1 text-[9px]">Disabled</span> : null}
                </Button>
              );
            })}
          </div>
          <div className="mt-4 h-[32rem] space-y-2 overflow-y-auto overscroll-contain pr-2">
            {visibleEntries.length ? (
              visibleEntries.map((entry) => <ProviderFailureLogEntry key={entry.id} entry={entry} />)
            ) : activeProviderSlotFailures > 0 ? (
              <div className="rounded-xl border border-amber-500/25 bg-amber-500/5 p-5 text-center">
                <div className="mx-auto flex h-9 w-9 items-center justify-center rounded-full bg-amber-400/10 text-amber-300">
                  <AlertTriangle size={18} />
                </div>
                <h4 className="mt-2 text-xs font-semibold text-amber-200">
                  {activeProviderSlotFailures} Failures Recorded in Provider Key Pool
                </h4>
                <p className="mt-1 text-[11px] text-[#a9aab8]">
                  Upstream requests to {activeProvider?.label ?? "this provider"} failed during load balancer rotation or stream completion.
                </p>
                <p className="mt-2 text-[10px] text-[#858697]">
                  Detailed HTTP payloads appear here as raw responses are captured. The provider key pool maintains real-time health, request counters, and circuit cooldowns above.
                </p>
              </div>
            ) : (
              <div className="grid min-h-28 place-items-center rounded-xl border border-dashed border-white/10 px-5 text-center text-[10px] text-[#858697]">
                No credential-redacted failures have been recorded for this provider.
              </div>
            )}
          </div>
        </>
      ) : (
        <div className="mt-4 grid min-h-32 place-items-center rounded-xl border border-dashed border-white/10 px-5 text-center text-[10px] text-[#858697]">
          No saved provider groups are configured yet.
        </div>
      )}
      <p className="mt-4 border-t border-white/8 pt-4 text-[10px] text-[#858697]">
        The latest 200 records refresh every five seconds. API keys, authorization values, and credential-bearing URLs
        are redacted before storage and display.
      </p>
    </section>
  );
}

export function BaiDiagnosticViewer() {
  const opus = trpc.admin.claudeOpus5FailureLogs.useQuery(undefined, {
    refetchInterval: 5_000,
    refetchIntervalInBackground: false,
  });
  const fable = trpc.admin.claudeFable5FailureLogs.useQuery(undefined, {
    refetchInterval: 5_000,
    refetchIntervalInBackground: false,
  });
  const glm = trpc.admin.glm53FailureLogs.useQuery(undefined, {
    refetchInterval: 5_000,
    refetchIntervalInBackground: false,
  });
  const sonnet = trpc.admin.sonnet46FailureLogs.useQuery(undefined, {
    refetchInterval: 5_000,
    refetchIntervalInBackground: false,
  });
  const deepseek = trpc.admin.deepseekV4ProFailureLogs.useQuery(undefined, {
    refetchInterval: 5_000,
    refetchIntervalInBackground: false,
  });
  const qwen = trpc.admin.qwen38MaxFailureLogs.useQuery(undefined, {
    refetchInterval: 5_000,
    refetchIntervalInBackground: false,
  });

  const entries = (
    [
      ...(opus.data ?? []),
      ...(fable.data ?? []),
      ...(glm.data ?? []),
      ...(sonnet.data ?? []),
      ...(deepseek.data ?? []),
      ...(qwen.data ?? []),
    ] as ClaudeOpus5FailureLog[]
  ).filter((entry) => /\bb\.?ai\b/i.test(entry.sourceLabel));

  return (
    <section className="dashboard-card">
      <SectionHeader
        icon={<AlertTriangle size={17} />}
        title="b.ai diagnostic viewer"
        detail="Administrator-only, credential-redacted failures from provider groups named b.ai. End users receive only TokenForge’s neutral provider-unavailable message."
      />
      <div className="mt-4 h-72 space-y-2 overflow-y-auto overscroll-contain pr-2">
        {entries.length ? (
          entries.map((entry) => (
            <ProviderFailureLogEntry
              key={`${entry.id}-${entry.sourceLabel}-${new Date(entry.occurredAt).getTime()}`}
              entry={entry}
            />
          ))
        ) : (
          <div className="grid min-h-28 place-items-center rounded-xl border border-dashed border-white/10 px-5 text-center text-[10px] text-[#858697]">
            No b.ai-labelled provider diagnostics have been recorded. Name the configured provider group “b.ai” to route
            its redacted errors into this viewer.
          </div>
        )}
      </div>
    </section>
  );
}

export function ClaudeOpus5FailureHistory({
  logs: _logs,
  loading: _loading,
}: {
  logs?: ClaudeOpus5FailureLog[];
  loading: boolean;
}) {
  return (
    <>
      <ProviderScopedFailureHistory model="claude-opus-5" title="Claude Opus 5" />
      <BaiDiagnosticViewer />
    </>
  );
}

export function ClaudeOpus5QwenFailureHistory() {
  const failureLogs = trpc.admin.claudeOpus5FailureLogs.useQuery(undefined, {
    refetchInterval: 5_000,
    refetchIntervalInBackground: false,
  });
  const entries = ((failureLogs.data ?? []) as ClaudeOpus5FailureLog[]).filter(
    (entry) => entry.sourceId.startsWith("qwen:") || entry.sourceLabel.startsWith("Qwen ·")
  );

  return (
    <section className="dashboard-card">
      <SectionHeader
        icon={<AlertTriangle size={17} />}
        title="Claude Opus 5 · Qwen live error history"
        detail="Refreshes every five seconds. This administrator-only log includes Qwen zero-output outcomes, upstream failures, the failing internal model ID, and the neutral message shown to callers."
      />
      <div className="mt-4 h-[24rem] space-y-2 overflow-y-auto overscroll-contain pr-2">
        {failureLogs.isLoading ? (
          <div className="grid min-h-32 place-items-center">
            <Loader2 className="animate-spin text-[#c9ff73]" size={18} />
          </div>
        ) : entries.length ? (
          entries.map((entry) => {
            const failingModelId = entry.sourceLabel.startsWith("Qwen ·")
              ? entry.sourceLabel.slice("Qwen ·".length).trim()
              : entry.sourceId.replace(/^qwen:/, "");
            return (
              <article key={entry.id} className="rounded-xl border border-amber-300/15 bg-amber-300/[.035] p-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge className="border border-violet-300/20 bg-violet-300/10 text-[9px] text-violet-100">
                        Qwen model failure
                      </Badge>
                      <Badge className="border border-amber-300/20 bg-amber-300/10 text-[9px] text-amber-100">
                        {entry.failureKind === "empty_output" ? "Zero output" : entry.failureKind}
                      </Badge>
                    </div>
                    <p className="mt-2 text-[9px] font-bold uppercase tracking-[.11em] text-[#858697]">
                      Failing internal model ID
                    </p>
                    <p className="mt-1 break-all font-mono text-[11px] text-[#e8e9f0]">
                      {failingModelId || "Unavailable"}
                    </p>
                    <div className="mt-3 grid gap-2 lg:grid-cols-2">
                      <div>
                        <p className="text-[9px] font-bold uppercase tracking-[.11em] text-amber-200">
                          Credential-redacted upstream diagnostic
                        </p>
                        <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap break-words font-mono text-[9px] leading-4 text-amber-100">
                          {entry.callerMessage}
                        </pre>
                      </div>
                      <div className="rounded-lg border border-[#c9ff73]/20 bg-[#c9ff73]/[.055] p-2">
                        <p className="text-[9px] font-bold uppercase tracking-[.11em] text-[#c9ff73]">
                          Caller-visible TokenForge message
                        </p>
                        <p className="mt-1 font-mono text-[10px] leading-4 text-[#e6f7c5]">
                          {entry.publicMessage ?? "The selected model is temporarily unavailable. Please retry shortly."}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="font-mono text-[10px] font-semibold text-amber-200">
                      {entry.httpStatus ? `HTTP ${entry.httpStatus}` : entry.failureKind}
                    </p>
                    <p className="mt-1 text-[9px] text-[#858697]">{entry.retryable ? "Failover eligible" : "No retry"}</p>
                    <time
                      className="mt-1 block text-[9px] text-[#858697]"
                      dateTime={new Date(entry.occurredAt).toISOString()}
                    >
                      Occurred: {new Date(entry.occurredAt).toLocaleString()}
                    </time>
                  </div>
                </div>
              </article>
            );
          })
        ) : (
          <div className="grid min-h-32 place-items-center rounded-xl border border-dashed border-white/10 px-5 text-center text-[10px] text-[#858697]">
            No Qwen zero-output or upstream failures recorded yet.
          </div>
        )}
      </div>
    </section>
  );
}

export function ManagedModelFailureHistory({
  model,
  title,
}: {
  model: ProviderScopedFailureModel;
  title: string;
}) {
  return <ProviderScopedFailureHistory model={model} title={title} />;
}

export function ClaudeFable5FailureHistory({
  logs: _logs,
  loading: _loading,
}: {
  logs?: ClaudeOpus5FailureLog[];
  loading?: boolean;
} = {}) {
  return <ProviderScopedFailureHistory model="claude-fable-5.1" title="Claude Fable 5.1" />;
}

