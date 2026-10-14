import React, { useState, useEffect, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Cpu,
  Layers,
  Search,
  CheckCircle2,
  Settings2,
  Sparkles,
  RefreshCw,
  Plus,
} from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import {
  ClaudeOpus5ProviderBalancerPanel,
} from "./ProvidersSection";
import { ProviderScopedFailureHistory } from "../diagnostics/FailureHistory";
import {
  ClaudeOpus5ProviderDraft,
  ClaudeOpus5SettingsData,
  ManagedProviderKeyMetricGroup,
} from "../types";

const POPULAR_PRESET_MODELS = [
  { id: "claude-opus-5.5", label: "Claude Opus 5.5" },
  { id: "gpt-6-sol", label: "GPT 6 Sol" },
  { id: "gpt-6-astra", label: "GPT-6 Astra" },
  { id: "claude-opus-5", label: "Claude Opus 5" },
  { id: "glm-5.3", label: "GLM 5.3" },
  { id: "glm-5.2", label: "GLM-5.2" },
  { id: "grok-4.5", label: "Grok 4.5" },
  { id: "deepseek-v4-pro", label: "DeepSeek V4 Pro" },
  { id: "deepseek-v4-flash", label: "DeepSeek V4 Flash" },
  { id: "qwen3.8-max", label: "Qwen 3.8 Max" },
  { id: "claude-fable-5.1", label: "Claude Fable 5.1" },
  { id: "claude-sonnet-5.5", label: "Claude Sonnet 5.5" },
  { id: "claude-sonnet-4.6", label: "Claude Sonnet 4.6" },
  { id: "kimi-k3", label: "Kimi K3" },
];

export function UniversalModelProviderBalancer({
  metrics,
}: {
  metrics?: ManagedProviderKeyMetricGroup;
}) {
  const utils = trpc.useUtils();
  const [selectedModelId, setSelectedModelId] = useState<string>("gpt-6-astra");
  const [customModelInput, setCustomModelInput] = useState<string>("");
  const [searchFilter, setSearchFilter] = useState<string>("");

  const modelsQuery = trpc.admin.listUniversalModels.useQuery(undefined, {
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
  });

  const modelAvailabilityQuery = trpc.public.modelAvailability.useQuery(undefined, {
    staleTime: 60_000,
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
  });

  const selectedModelMeta = useMemo(() => {
    return modelAvailabilityQuery.data?.find((m) => m.modelId === selectedModelId);
  }, [modelAvailabilityQuery.data, selectedModelId]);

  const isTokenPlanActive = selectedModelMeta?.isTokenPlan === true;
  const isPaygActive = (selectedModelMeta as any)?.isPayg === true;
  const isBundleActive = (selectedModelMeta as any)?.isBundle !== false;

  const toggleTokenPlan = trpc.admin.setModelIsTokenPlan.useMutation({
    onSuccess: (res) => {
      utils.public.modelAvailability.invalidate();
      utils.admin.overview.invalidate();
      toast.success(
        `Token Plan tag for ${selectedModelId} is now ${res.isTokenPlan ? "ENABLED (Allowed)" : "DISABLED (Blocked)"}`
      );
    },
    onError: (err) => toast.error(err.message),
  });

  const togglePayg = trpc.admin.setModelIsPayg.useMutation({
    onSuccess: (res) => {
      utils.public.modelAvailability.invalidate();
      utils.admin.overview.invalidate();
      toast.success(
        `PAYG tag for ${selectedModelId} is now ${res.isPayg ? "ENABLED" : "DISABLED"}`
      );
    },
    onError: (err) => toast.error(err.message),
  });

  const toggleBundle = trpc.admin.setModelIsBundle.useMutation({
    onSuccess: (res) => {
      utils.public.modelAvailability.invalidate();
      utils.admin.overview.invalidate();
      toast.success(
        `Bundle access for ${selectedModelId} is now ${res.isBundle ? "ENABLED" : "DISABLED"}`
      );
    },
    onError: (err) => toast.error(err.message),
  });

  const settingsQuery = trpc.admin.universalModelProviderSettings.useQuery(
    { modelId: selectedModelId },
    {
      refetchInterval: 15_000,
      refetchIntervalInBackground: false,
    }
  );

  const metricsQuery = trpc.admin.universalModelKeyMetrics.useQuery(
    { modelId: selectedModelId },
    {
      refetchInterval: 15_000,
      refetchIntervalInBackground: false,
    }
  );

  const [drafts, setDrafts] = useState<ClaudeOpus5ProviderDraft[]>([]);
  const [initializedForModel, setInitializedForModel] = useState<string | null>(null);

  // Re-sync drafts when data loads or when model changes
  useEffect(() => {
    if (!settingsQuery.data) return;
    if (initializedForModel === selectedModelId) return;

    setDrafts(
      settingsQuery.data.providers.map((provider) => ({
        id: provider.id,
        label: provider.label,
        enabled: provider.enabled,
        baseUrl: provider.baseUrl,
        model: provider.model,
        maxInputTokens: provider.maxInputTokens ?? "",
        maxOutputTokens: provider.maxOutputTokens ?? "",
        disableIdentityPrompt: provider.disableIdentityPrompt ?? false,
        bypassCooldown: provider.bypassCooldown ?? false,
        supportsVision: provider.supportsVision ?? false,
        supportsDocuments: provider.supportsDocuments ?? false,
        pinnedUserEmails: provider.pinnedUserEmails ?? [],
        reasoningEffort: provider.reasoningEffort ?? "",
        apiKeys: provider.apiKeyMasks.length ? provider.apiKeyMasks.map(() => "") : [""],
        apiKeyEnabled: provider.apiKeyMasks.length
          ? provider.apiKeyMasks.map((item) => item.enabled !== false)
          : [true],
        removedSlots: [],
      }))
    );
    setInitializedForModel(selectedModelId);
  }, [selectedModelId, settingsQuery.data, initializedForModel]);

  const saveMutation = trpc.admin.updateUniversalModelProviderSettings.useMutation({
    onSuccess: async () => {
      setInitializedForModel(null);
      await Promise.all([
        utils.admin.universalModelProviderSettings.invalidate({ modelId: selectedModelId }),
        utils.admin.universalModelKeyMetrics.invalidate({ modelId: selectedModelId }),
        utils.admin.modelFailureLogs.invalidate(),
        utils.admin.universalModelFailureLogs.invalidate(),
        utils.admin.listUniversalModels.invalidate(),
        utils.admin.overview.invalidate(),
        utils.admin.activity.invalidate(),
      ]);
      toast.success(`${currentModelDisplayName} load balancer updated successfully`);
    },
    onError: (error) => toast.error(error.message),
  });

  const availableModels = useMemo(() => {
    return modelsQuery.data ?? [];
  }, [modelsQuery.data]);

  const filteredModels = useMemo(() => {
    if (!searchFilter.trim()) return availableModels;
    const q = searchFilter.toLowerCase().trim();
    return availableModels.filter(
      (m) => m.modelId.toLowerCase().includes(q) || m.displayName.toLowerCase().includes(q)
    );
  }, [availableModels, searchFilter]);

  const currentModelDef = useMemo(() => {
    return availableModels.find((m) => m.modelId === selectedModelId);
  }, [availableModels, selectedModelId]);

  const currentModelDisplayName = currentModelDef?.displayName || selectedModelId;

  const handleSelectModel = (modelId: string) => {
    if (modelId === selectedModelId) return;
    setSelectedModelId(modelId);
    setInitializedForModel(null);
  };

  const handleAddCustomModel = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = customModelInput.trim().toLowerCase();
    if (!trimmed) return;
    setSelectedModelId(trimmed);
    setInitializedForModel(null);
    setCustomModelInput("");
    toast.info(`Switched to custom model: ${trimmed}`);
  };

  return (
    <div className="space-y-6">
      {/* Universal Model Selector Header */}
      <div className="dashboard-card p-4 space-y-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="flex size-7 items-center justify-center rounded-lg bg-[#c9ff73]/10 text-[#c9ff73]">
                <Layers size={16} />
              </span>
              <h2 className="text-base font-semibold text-white">Universal Model Provider Hub</h2>
              <Badge className="border border-[#c9ff73]/30 bg-[#c9ff73]/10 text-[10px] text-[#c9ff73]">
                Claude Opus 5 Template Architecture
              </Badge>
            </div>
            <p className="text-xs text-[#8e90a2]">
              Select ANY model in TokenForge to configure multiple equal-share provider pools, health-aware API key rotation, dedicated pinned users, custom system prompt reinforcement, error masking, and per-provider failure diagnostics.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <div className="text-right text-[11px] text-[#8e90a2]">
              <span className="font-mono text-white font-semibold">{availableModels.filter(m => m.configured).length}</span> Custom Managed /{" "}
              <span className="font-mono text-white">{availableModels.length}</span> Total Models
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setInitializedForModel(null);
                void utils.admin.universalModelProviderSettings.invalidate({ modelId: selectedModelId });
                void utils.admin.listUniversalModels.invalidate();
                void utils.admin.modelCompactScaling.invalidate({ modelId: selectedModelId });
              }}
              className="border-white/10 text-white hover:bg-white/8 h-8 px-2.5"
              title="Refresh models & settings"
            >
              <RefreshCw size={13} className={settingsQuery.isFetching ? "animate-spin" : ""} />
            </Button>
          </div>
        </div>

        {/* Quick-Switch Pills */}
        <div className="space-y-2 pt-2 border-t border-white/8">
          <div className="flex items-center justify-between text-[11px] text-[#8e90a2]">
            <span className="font-medium">Quick Select Model:</span>
            <span className="text-[10px] text-[#6d6e7f]">Pick from popular models or choose from full catalogue below</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {POPULAR_PRESET_MODELS.map((item) => {
              const isSelected = selectedModelId === item.id;
              const isConfigured = availableModels.some((m) => m.modelId === item.id && m.configured);
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleSelectModel(item.id)}
                  className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition-all ${
                    isSelected
                      ? "bg-[#c9ff73] text-[#17210d] font-semibold shadow-sm"
                      : "bg-white/5 text-[#a8a9b8] hover:bg-white/10 hover:text-white"
                  }`}
                >
                  <span>{item.label}</span>
                  {isConfigured && (
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${isSelected ? "bg-[#17210d]" : "bg-[#c9ff73]"}`}
                      title="Custom Provider Override Active"
                    />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Search / Full List / Custom Model Bar */}
        <div className="grid gap-3 pt-2 md:grid-cols-12">
          <div className="relative md:col-span-6">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6d6e7f]" />
            <Input
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              placeholder="Search all catalogue models..."
              className="h-8 pl-8 text-xs bg-black/30 border-white/10 text-white placeholder:text-[#6d6e7f]"
            />
          </div>

          <form onSubmit={handleAddCustomModel} className="flex gap-2 md:col-span-6">
            <Input
              value={customModelInput}
              onChange={(e) => setCustomModelInput(e.target.value)}
              placeholder="Add or switch to custom model ID..."
              className="h-8 text-xs bg-black/30 border-white/10 text-white placeholder:text-[#6d6e7f]"
            />
            <Button
              type="submit"
              size="sm"
              disabled={!customModelInput.trim()}
              className="h-8 shrink-0 bg-white/10 text-white hover:bg-white/20 text-xs px-3"
            >
              <Plus size={13} className="mr-1" /> Configure
            </Button>
          </form>
        </div>

        {/* Filtered Model chips if searching */}
        {searchFilter.trim() && (
          <div className="flex flex-wrap gap-1.5 pt-2 max-h-36 overflow-y-auto rounded-lg bg-black/20 p-2 border border-white/5">
            {filteredModels.map((item) => (
              <button
                key={item.modelId}
                type="button"
                onClick={() => {
                  handleSelectModel(item.modelId);
                  setSearchFilter("");
                }}
                className={`flex items-center gap-1 rounded-md px-2 py-1 text-[11px] ${
                  selectedModelId === item.modelId
                    ? "bg-[#c9ff73] text-[#17210d] font-semibold"
                    : "bg-white/5 text-[#a8a9b8] hover:bg-white/10 hover:text-white"
                }`}
              >
                <span>{item.displayName}</span>
                <span className="font-mono text-[9px] opacity-70">({item.modelId})</span>
                {item.configured && <CheckCircle2 size={11} className="text-[#c9ff73]" />}
              </button>
            ))}
            {filteredModels.length === 0 && (
              <p className="text-xs text-[#8e90a2] p-1">No matching models found. You can enter any custom model ID above.</p>
            )}
          </div>
        )}
      </div>

      {/* Model Active Header Banner */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-1">
        <div className="flex items-center gap-2">
          <Settings2 size={16} className="text-[#c9ff73]" />
          <h3 className="text-sm font-semibold text-white">
            Configuring Providers for: <span className="text-[#c9ff73]">{currentModelDisplayName}</span>
          </h3>
          <code className="rounded bg-black/40 px-1.5 py-0.5 font-mono text-[10px] text-[#a8a9b8]">
            {selectedModelId}
          </code>
          {currentModelDef?.configured ? (
            <Badge className="border border-[#c9ff73]/30 bg-[#c9ff73]/15 text-[9px] text-[#c9ff73]">
              Admin Database Override Active
            </Badge>
          ) : (
            <Badge className="border border-white/10 bg-white/5 text-[9px] text-[#8e90a2]">
              Environment / Catalogue Default
            </Badge>
          )}
        </div>

        {/* Model Access Tags / Token Plan Toggle */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-medium text-[#8e90a2]">Model Tags:</span>
          {/* Token Plan Tag Toggle Button */}
          <button
            type="button"
            onClick={() => toggleTokenPlan.mutate({ modelId: selectedModelId, isTokenPlan: !isTokenPlanActive })}
            disabled={toggleTokenPlan.isPending}
            title={isTokenPlanActive ? "Click to remove Token Plan tag from this model" : "Click to add Token Plan tag to this model (allows Token Plan API keys)"}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold transition-colors cursor-pointer border ${
              isTokenPlanActive
                ? "bg-cyan-500/20 text-cyan-300 border-cyan-500/40 hover:bg-cyan-500/30"
                : "bg-white/5 text-neutral-400 border-white/10 hover:bg-white/10 hover:text-white"
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${isTokenPlanActive ? "bg-cyan-400 animate-pulse" : "bg-neutral-500"}`} />
            <span>{isTokenPlanActive ? "Token Plan Tag: ON" : "+ Token Plan Tag"}</span>
          </button>

          {/* PAYG Tag Toggle Button */}
          <button
            type="button"
            onClick={() => togglePayg.mutate({ modelId: selectedModelId, isPayg: !isPaygActive })}
            disabled={togglePayg.isPending}
            title={isPaygActive ? "Click to remove PAYG tag from this model" : "Click to add PAYG tag to this model"}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold transition-colors cursor-pointer border ${
              isPaygActive
                ? "bg-rose-500/20 text-rose-300 border-rose-500/40 hover:bg-rose-500/30"
                : "bg-white/5 text-neutral-400 border-white/10 hover:bg-white/10 hover:text-white"
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${isPaygActive ? "bg-rose-400 animate-pulse" : "bg-neutral-500"}`} />
            <span>{isPaygActive ? "PAYG: ON" : "+ PAYG Tag"}</span>
          </button>

          {/* Bundle Access Toggle Button */}
          <button
            type="button"
            onClick={() => toggleBundle.mutate({ modelId: selectedModelId, isBundle: !isBundleActive })}
            disabled={toggleBundle.isPending}
            title={isBundleActive ? "Click to disable Credit Bundle access for this model" : "Click to enable Credit Bundle access for this model"}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold transition-colors cursor-pointer border ${
              isBundleActive
                ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40 hover:bg-emerald-500/30"
                : "bg-white/5 text-neutral-400 border-white/10 hover:bg-white/10 hover:text-white"
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${isBundleActive ? "bg-emerald-400 animate-pulse" : "bg-neutral-500"}`} />
            <span>{isBundleActive ? "Bundle: ON" : "+ Bundle"}</span>
          </button>
        </div>
      </div>

      {/* Universal Provider Balancer Panel */}
      <ClaudeOpus5ProviderBalancerPanel
        providerName={currentModelDisplayName}
        modelId={selectedModelId}
        drafts={drafts}
        settings={settingsQuery.data as ClaudeOpus5SettingsData | undefined}
        metrics={metricsQuery.data || (metrics?.modelId === selectedModelId ? metrics : undefined)}
        loading={settingsQuery.isLoading}
        saving={saveMutation.isPending}
        onChange={(id, update) =>
          setDrafts((current) => current.map((draft) => (draft.id === id ? update(draft) : draft)))
        }
        onAddProvider={(id) =>
          setDrafts((current) => [
            ...current,
            {
              id,
              label: `Provider ${current.length + 1}`,
              enabled: true,
              baseUrl: "https://api.tokenrouter.io/v1",
              model: selectedModelId,
              apiKeys: [""],
              removedSlots: [],
              maxInputTokens: "",
              maxOutputTokens: "",
              disableIdentityPrompt: false,
              bypassCooldown: false,
              supportsVision: false,
              supportsDocuments: false,
              pinnedUserEmails: [],
              reasoningEffort: "",
            },
          ])
        }
        onRemoveProvider={(id) => setDrafts((current) => current.filter((draft) => draft.id !== id))}
        onInstantSave={(updatedDrafts) =>
          saveMutation.mutate({
            modelId: selectedModelId,
            providers: updatedDrafts.map((draft) => ({
              ...draft,
              removeSlots: draft.removedSlots,
              maxInputTokens:
                draft.maxInputTokens !== undefined && draft.maxInputTokens !== ""
                  ? Number(draft.maxInputTokens)
                  : null,
              maxOutputTokens:
                draft.maxOutputTokens !== undefined && draft.maxOutputTokens !== ""
                  ? Number(draft.maxOutputTokens)
                  : null,
              pinnedUserEmails: draft.pinnedUserEmails ?? [],
              reasoningEffort: draft.reasoningEffort ? (draft.reasoningEffort as any) : null,
            })),
          })
        }
        onSave={() =>
          saveMutation.mutate({
            modelId: selectedModelId,
            providers: drafts.map((draft) => ({
              ...draft,
              removeSlots: draft.removedSlots,
              maxInputTokens:
                draft.maxInputTokens !== undefined && draft.maxInputTokens !== ""
                  ? Number(draft.maxInputTokens)
                  : null,
              maxOutputTokens:
                draft.maxOutputTokens !== undefined && draft.maxOutputTokens !== ""
                  ? Number(draft.maxOutputTokens)
                  : null,
              pinnedUserEmails: draft.pinnedUserEmails ?? [],
              reasoningEffort: draft.reasoningEffort ? (draft.reasoningEffort as any) : null,
            })),
          })
        }
      />

      {/* Failure History for this Selected Model */}
      <ProviderScopedFailureHistory
        model={selectedModelId}
        title={`${currentModelDisplayName} Provider Failure Diagnostics`}
        customProviders={
          drafts.length
            ? drafts.map((d) => ({
                id: d.id,
                label: d.label,
                enabled: d.enabled,
              }))
            : undefined
        }
        metrics={metricsQuery.data}
      />
    </div>
  );
}
