import React, { useState, useEffect, useRef } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Activity, Gauge, KeyRound, Loader2, Plus, ServerCog, ShieldAlert, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import {
  BailuWebshareProxyDraft,
  BailuWebshareProxySettingsData,
  BaiProviderCircuitStatus,
  ClaudeOpus5ProviderDraft,
  ClaudeOpus5ProviderSettingsData,
  ClaudeOpus5QwenModelSetting,
  ClaudeOpus5SettingsData,
  DeepseekV4ProSettingsData,
  ManagedKeyMask,
  ManagedProviderKeyMetricGroup,
  ManagedProviderSettingsData,
  RenderNimProxySwarmSettingsData,
} from "../types";
import { formatTokens, SectionHeader, Toggle } from "../common/AdminCommon";
import { ModelCompactScalingBar } from "../overview/OperationsSections";
import { DynamicProviderKeyPool, ManagedProviderKeyMetrics } from "./DynamicProviderKeyPool";
import {
  ClaudeOpus5FailureHistory,
  ClaudeOpus5QwenFailureHistory,
  ManagedModelFailureHistory,
} from "../diagnostics/FailureHistory";

export function BaiProviderCircuitHealth({
  status,
  isPriority,
}: {
  status?: BaiProviderCircuitStatus;
  isPriority?: boolean;
}) {
  if (!status) return null;
  return (
    <div className="mt-4 rounded-xl border border-[#c9ff73]/15 bg-[#c9ff73]/[.035] p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[.13em] text-[#858697]">b.ai provider routing</p>
          <p className="mt-1 text-[10px] leading-5 text-[#858697]">
            {isPriority
              ? "Priority routing enabled: 1st and primary requests route to b.ai. Automatic fallback if consecutive failures exceed 3."
              : "Standard round-robin rotation across active providers. Circuit breaker cooldown disabled."}
          </p>
        </div>
        <Badge
          className={`border text-[9px] ${
            isPriority
              ? "border-[#c9ff73]/20 bg-[#c9ff73]/10 text-[#c9ff73]"
              : "border-white/10 bg-white/5 text-[#a9aab8]"
          }`}
        >
          {isPriority ? "Priority Route" : "Eligible"}
        </Badge>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 font-mono text-[9px] tabular-nums sm:grid-cols-3">
        <p className="text-[#d6d7e0]">
          {status.rateLimitCount.toLocaleString()} <span className="text-[#858697]">429s</span>
        </p>
        <p className={status.consecutiveRateLimits ? "text-amber-200" : "text-[#c9ff73]"}>
          {status.consecutiveRateLimits.toLocaleString()} <span className="text-[#858697]">consecutive fails</span>
        </p>
        <p className="text-[#a9aab8]">
          {status.lastSuccessAt ? new Date(status.lastSuccessAt).toLocaleTimeString() : "—"}{" "}
          <span className="text-[#858697]">last success</span>
        </p>
      </div>
      {status.lastRateLimitedAt ? (
        <p className="mt-3 text-[9px] leading-4 text-[#858697]">
          Most recent HTTP 429: {new Date(status.lastRateLimitedAt).toLocaleString()}.
        </p>
      ) : (
        <p className="mt-3 text-[9px] leading-4 text-[#858697]">No b.ai HTTP 429 has been recorded.</p>
      )}
    </div>
  );
}

export function PinnedUsersInput({
  draftId,
  emails,
  disabled,
  onChange,
}: {
  draftId: string;
  emails: string[];
  disabled?: boolean;
  onChange: (emails: string[]) => void;
}) {
  const [inputText, setInputText] = useState("");

  const addEmails = (newEmails: string[]) => {
    const clean = newEmails
      .map((e) => e.trim().toLowerCase())
      .filter((e) => e.length > 0 && e.includes("@"));
    if (!clean.length) return;
    const current = new Set(emails);
    clean.forEach((e) => current.add(e));
    onChange(Array.from(current));
  };

  const removeEmail = (target: string) => {
    onChange(emails.filter((e) => e !== target));
  };

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const val = event.target.value;
    // If the input contains a delimiter (comma, semicolon, newline, or multiple spaces):
    if (val.includes(",") || val.includes(";") || val.includes("\n")) {
      const parts = val.split(/[,\s;\n]+/);
      const toAdd = parts.slice(0, -1).filter(Boolean);
      const remainder = parts[parts.length - 1] || "";
      if (toAdd.length > 0) {
        addEmails(toAdd);
      }
      setInputText(remainder);
    } else {
      setInputText(val);
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter" || event.key === "," || event.key === "Tab") {
      event.preventDefault();
      if (inputText.trim()) {
        const parts = inputText.split(/[,\s;\n]+/).filter(Boolean);
        addEmails(parts);
        setInputText("");
      }
    } else if (event.key === "Backspace" && !inputText && emails.length > 0) {
      removeEmail(emails[emails.length - 1]);
    }
  };

  const handleBlur = () => {
    if (inputText.trim()) {
      const parts = inputText.split(/[,\s;\n]+/).filter(Boolean);
      addEmails(parts);
      setInputText("");
    }
  };

  const handleAddClick = () => {
    if (inputText.trim()) {
      const parts = inputText.split(/[,\s;\n]+/).filter(Boolean);
      addEmails(parts);
      setInputText("");
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Input
          id={`${draftId}-pinned-users`}
          placeholder="Type email and press Enter, comma, or click Add..."
          value={inputText}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          className="border-white/10 bg-black/15 font-mono text-xs placeholder:text-[#656678]"
          disabled={disabled}
        />
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={handleAddClick}
          disabled={disabled || !inputText.trim()}
          className="shrink-0 border-white/10 bg-white/5 text-xs text-[#dedfe7] hover:bg-white/10 hover:text-white"
        >
          <Plus size={13} className="mr-1" /> Add
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
        <span className="text-[10px] text-[#858697]">Quick add:</span>
        <button
          type="button"
          onClick={() => addEmails(["admin@gmail.com"])}
          disabled={disabled || emails.includes("admin@gmail.com")}
          className={`inline-flex items-center gap-1 rounded border px-2 py-0.5 font-mono text-[10px] transition-colors ${
            emails.includes("admin@gmail.com")
              ? "border-white/5 bg-white/[0.02] text-[#606170] cursor-default"
              : "border-[#c9ff73]/30 bg-[#c9ff73]/10 text-[#c9ff73] hover:bg-[#c9ff73]/20 cursor-pointer"
          }`}
          title="Add default admin email"
        >
          + admin@gmail.com
        </button>
        {emails.length > 0 && (
          <button
            type="button"
            onClick={() => onChange([])}
            disabled={disabled}
            className="ml-auto text-[10px] text-rose-400/70 hover:text-rose-300 cursor-pointer transition-colors"
          >
            Clear all ({emails.length})
          </button>
        )}
      </div>

      {emails.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-1.5">
          {emails.map((email) => {
            const isAdmin = email === "admin@gmail.com";
            return (
              <span
                key={email}
                className={`inline-flex items-center gap-1.5 rounded border px-2 py-0.5 font-mono text-[10px] font-medium ${
                  isAdmin
                    ? "border-[#c9ff73]/30 bg-[#c9ff73]/15 text-[#c9ff73]"
                    : "border-white/10 bg-white/5 text-[#dedfe7]"
                }`}
              >
                <span>{email}</span>
                {isAdmin && (
                  <span className="rounded bg-[#c9ff73]/20 px-1 py-0.1 text-[8px] font-bold uppercase tracking-wider text-[#c9ff73]">
                    Admin
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => removeEmail(email)}
                  disabled={disabled}
                  className="ml-0.5 text-[#858697] hover:text-rose-400 cursor-pointer font-bold text-xs"
                  title={`Unpin ${email}`}
                >
                  ×
                </button>
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function ClaudeOpus5ProviderBalancerPanel({
  providerName = "Claude Opus 5",
  modelId,
  drafts,
  settings,
  metrics,
  loading,
  saving,
  onChange,
  onAddProvider,
  onRemoveProvider,
  onSave,
  onInstantSave,
}: {
  providerName?: string;
  modelId?: string;
  drafts: ClaudeOpus5ProviderDraft[];
  settings?: ClaudeOpus5SettingsData;
  metrics?: ManagedProviderKeyMetricGroup;
  loading: boolean;
  saving: boolean;
  onChange: (id: string, update: (draft: ClaudeOpus5ProviderDraft) => ClaudeOpus5ProviderDraft) => void;
  onAddProvider: (id: string) => void;
  onRemoveProvider: (id: string) => void;
  onSave: () => void;
  onInstantSave?: (drafts: ClaudeOpus5ProviderDraft[]) => void;
}) {
  const utils = trpc.useUtils();
  const configured = new Map((settings?.providers ?? []).map((provider) => [provider.id, provider]));
  const disabled = loading || saving;
  const [activeProviderId, setActiveProviderId] = useState("");

  const effectiveModelId = modelId || (
    providerName.toLowerCase().includes("opus 5.5") ? "claude-opus-5.5" :
    providerName.toLowerCase().includes("opus 5") || providerName.toLowerCase() === "claude opus" ? "claude-opus-5" :
    providerName.toLowerCase().includes("astra") ? "gpt-6-astra" :
    providerName.toLowerCase().includes("fable") ? "claude-fable-5.1" :
    providerName.toLowerCase().includes("sonnet") ? "claude-sonnet-4.6" :
    providerName.toLowerCase().includes("deepseek") ? "deepseek-v4-pro" :
    providerName.toLowerCase().includes("glm") ? "glm-5.3" :
    providerName.toLowerCase().includes("qwen") ? "qwen3.8-max" :
    providerName.toLowerCase().includes("kimi") ? "kimi-k3" :
    undefined
  );

  const compactScalingQuery = trpc.admin.modelCompactScaling.useQuery(
    { modelId: effectiveModelId! },
    {
      enabled: Boolean(effectiveModelId),
      refetchInterval: 10_000,
    }
  );

  const toggleCompactScaling = trpc.admin.setModelCompactScaling.useMutation({
    onSuccess: (res) => {
      if (effectiveModelId) {
        utils.admin.modelCompactScaling.invalidate({ modelId: effectiveModelId });
      }
      utils.admin.overview.invalidate();
      toast.success(
        `Compact scaling for ${effectiveModelId || providerName} is now ${res.enabled ? "ENABLED" : "DISABLED"}`
      );
    },
    onError: (error) => toast.error(error.message),
  });

  const isClaudeOpus = providerName.toLowerCase().includes("opus") || providerName.toLowerCase().includes("claude opus 5");
  const isBaiPriority = settings?.baiPriority === true;

  const setBaiPriority = trpc.admin.setClaudeOpus5BaiPriority.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.admin.claudeOpus5ProviderSettings.invalidate(),
        utils.admin.overview.invalidate(),
      ]);
      toast.success("b.ai priority routing updated");
    },
    onError: (error) => toast.error(error.message),
  });

  useEffect(() => {
    if (!drafts.length) return;
    if (!drafts.some((draft) => draft.id === activeProviderId)) setActiveProviderId(drafts[0]!.id);
  }, [activeProviderId, drafts]);

  const canSave =
    drafts.length > 0 &&
    drafts.every((draft) =>
      Boolean(
        draft.label.trim() &&
          draft.baseUrl.trim() &&
          draft.model.trim() &&
          (configured.get(draft.id)?.apiKeyMasks.length || draft.apiKeys.some((key) => key.trim()))
      )
    );

  const addProvider = () => {
    const id = `provider-${Date.now()}-${drafts.length + 1}`;
    setActiveProviderId(id);
    onAddProvider(id);
  };

  const selectedDraft = drafts.find((draft) => draft.id === activeProviderId) || drafts[0];

  return (
    <section className="dashboard-card">
      <SectionHeader
        icon={<KeyRound size={17} />}
        title={`${providerName} multi-provider load balancer`}
        detail="Every new request rotates evenly across enabled provider groups, then across eligible keys within the selected group. A failed provider is skipped before a response starts."
      />

      {effectiveModelId && (
        <div className="mt-3">
          <ModelCompactScalingBar
            model={{
              modelId: effectiveModelId,
              displayName: providerName,
              providerSlug: "managed",
              enabled: true,
              enableCompactScaling: compactScalingQuery.data?.enabled,
              compactTriggerTokens: compactScalingQuery.data?.triggerTokens,
            }}
            pending={toggleCompactScaling.isPending}
            onToggle={(mid, enabled, triggerTokens) => {
              toggleCompactScaling.mutate({ modelId: mid, enabled, triggerTokens });
            }}
          />
        </div>
      )}
      
      {isClaudeOpus && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#c9ff73]/25 bg-[#c9ff73]/[0.05] p-3.5">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#c9ff73]/15 text-[#c9ff73]">
              <Activity size={16} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <p className="text-xs font-bold text-white">b.ai Priority Routing</p>
                <Badge
                  className={`border text-[9px] ${
                    isBaiPriority
                      ? "border-[#c9ff73]/30 bg-[#c9ff73]/15 text-[#c9ff73]"
                      : "border-white/10 bg-white/5 text-[#858697]"
                  }`}
                >
                  {isBaiPriority ? "ENABLED (1st Priority)" : "DISABLED (Round-Robin)"}
                </Badge>
              </div>
              <p className="mt-0.5 text-[10px] text-[#a9abbc]">
                {isBaiPriority
                  ? "All 1st and primary Claude Opus requests route to b.ai. If b.ai fails >3 consecutive times, automatically fails over to other providers."
                  : "Round-robin equal-share rotation across all enabled providers. Circuit cooldown pause removed."}
              </p>
            </div>
          </div>
          <Toggle
            label="b.ai Priority"
            enabled={isBaiPriority}
            pending={setBaiPriority.isPending}
            onChange={(enabled) => setBaiPriority.mutate({ enabled })}
          />
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-2xl text-[10px] leading-5 text-[#858697]">
          Provider base URLs, underlying model IDs, and API keys stay server-side. Providers have equal share; no
          provider weights are applied. Turn a group off to preserve its configuration and metrics while excluding it
          from new calls and failover.
        </p>
        <Badge className="border-0 bg-[#c9ff73]/10 text-[10px] text-[#c9ff73]">
          {drafts.filter((draft) => draft.enabled).length}/{drafts.length} enabled
        </Badge>
      </div>

      {drafts.length > 0 && (
        <div className="mt-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-xs font-semibold text-[#dedfe7]">
                Configured Providers in {providerName} ({drafts.length})
              </p>
              <p className="text-[10px] text-[#858697]">
                Click any provider card below to edit its credentials, model, or routing status
              </p>
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-7 border-[#c9ff73]/25 text-[11px] text-[#c9ff73] hover:bg-[#c9ff73]/10"
              onClick={addProvider}
              disabled={disabled || drafts.length >= 100}
            >
              <Plus size={12} /> Add Provider
            </Button>
          </div>

          <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
            {drafts.map((draft, index) => {
              const isSelected = (selectedDraft?.id ?? "") === draft.id;
              const isBai = draft.label.trim().toLowerCase() === "b.ai";
              const isUnorouter =
                draft.id === "provider-1788422197682-23" ||
                draft.label.trim().toLowerCase().includes("unorouter") ||
                draft.baseUrl.toLowerCase().includes("unorouter.com");
              const saved = configured.get(draft.id);
              const keyCount = draft.apiKeys.filter((k) => k.trim()).length || saved?.apiKeyMasks.length || 0;
              const draftSlots = metrics?.providers?.find(
                (p) => p.id === draft.id || p.label.toLowerCase() === draft.label.toLowerCase()
              )?.slots;
              const activeCooldownSlot = draftSlots?.find((s) => {
                if (!s.cooldownUntil) return false;
                return new Date(s.cooldownUntil).getTime() > Date.now();
              });
              const cooldownSecondsRemaining = activeCooldownSlot?.cooldownUntil
                ? Math.max(0, Math.ceil((new Date(activeCooldownSlot.cooldownUntil).getTime() - Date.now()) / 1000))
                : 0;
              return (
                <div
                  key={draft.id}
                  onClick={() => setActiveProviderId(draft.id)}
                  className={`group relative cursor-pointer rounded-xl border p-3.5 transition-all ${
                    isSelected
                      ? "border-[#c9ff73]/60 bg-[#c9ff73]/[0.08] shadow-md shadow-[#c9ff73]/5 ring-1 ring-[#c9ff73]/40"
                      : "border-white/10 bg-black/25 hover:border-white/20 hover:bg-black/35"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="truncate text-xs font-bold text-white">
                          {draft.label.trim() || `Provider ${index + 1}`}
                        </span>
                        {isSelected && (
                          <span className="rounded bg-[#c9ff73]/25 px-1.5 py-0.2 text-[9px] font-semibold text-[#c9ff73]">
                            Selected
                          </span>
                        )}
                        {isBai && isBaiPriority && (
                          <span className="rounded bg-[#c9ff73]/20 px-1.5 py-0.2 text-[8px] font-bold uppercase tracking-wider text-[#c9ff73]">
                            Priority 1
                          </span>
                        )}
                        {isUnorouter && (
                          <span className="rounded bg-amber-400/20 px-1.5 py-0.2 text-[8px] font-bold uppercase tracking-wider text-amber-300">
                            1 req / min
                          </span>
                        )}
                        {cooldownSecondsRemaining > 0 && (
                          <span className="rounded border border-amber-400/40 bg-amber-400/20 px-1.5 py-0.2 font-mono text-[8px] font-bold text-amber-200 animate-pulse">
                            ⏳ {cooldownSecondsRemaining}s CD
                          </span>
                        )}
                        {draft.maxInputTokens && Number(draft.maxInputTokens) > 0 && (
                          <span className="rounded bg-sky-400/20 px-1.5 py-0.2 text-[8px] font-bold uppercase tracking-wider text-sky-300">
                            ≤{Number(draft.maxInputTokens) >= 1000 ? `${Math.round(Number(draft.maxInputTokens) / 1000)}k` : draft.maxInputTokens} ctx
                          </span>
                        )}
                        {draft.maxOutputTokens && Number(draft.maxOutputTokens) > 0 && (
                          <span className="rounded bg-amber-400/20 px-1.5 py-0.2 text-[8px] font-bold uppercase tracking-wider text-amber-300">
                            ={Number(draft.maxOutputTokens) >= 1000 ? `${Math.round(Number(draft.maxOutputTokens) / 1000)}k` : draft.maxOutputTokens} out override
                          </span>
                        )}
                        {draft.disableIdentityPrompt && (
                          <span className="rounded bg-rose-400/20 px-1.5 py-0.2 text-[8px] font-bold uppercase tracking-wider text-rose-300">
                            No Identity Prompt
                          </span>
                        )}
                        {draft.bypassCooldown && (
                          <span className="rounded bg-emerald-400/20 px-1.5 py-0.2 text-[8px] font-bold uppercase tracking-wider text-emerald-300">
                            Cooldown Bypassed
                          </span>
                        )}
                        {draft.supportsVision && (
                          <span className="rounded bg-purple-400/20 px-1.5 py-0.2 text-[8px] font-bold uppercase tracking-wider text-purple-300">
                            Vision / Images
                          </span>
                        )}
                        {draft.supportsDocuments && (
                          <span className="rounded bg-blue-400/20 px-1.5 py-0.2 text-[8px] font-bold uppercase tracking-wider text-blue-300">
                            Documents / PDF
                          </span>
                        )}
                        {draft.reasoningEffort && (
                          <span className="rounded bg-purple-400/20 px-1.5 py-0.2 text-[8px] font-bold uppercase tracking-wider text-purple-300 border border-purple-400/30">
                            ⚡ {draft.reasoningEffort} effort
                          </span>
                        )}
                        {(draft.pinnedUserEmails?.length ?? 0) > 0 && (
                          <span className="rounded border border-[#c9ff73]/30 bg-[#c9ff73]/15 px-1.5 py-0.2 text-[8px] font-bold uppercase tracking-wider text-[#c9ff73]">
                            📌 {draft.pinnedUserEmails!.length} Pinned User{draft.pinnedUserEmails!.length === 1 ? "" : "s"}
                          </span>
                        )}
                      </div>
                      <p className="mt-1 truncate font-mono text-[10px] text-[#b4b6c7]">
                        {draft.model || "No model set"}
                      </p>
                      <p className="truncate font-mono text-[10px] text-[#6d6e7f]">
                        {draft.baseUrl || "No endpoint set"}
                      </p>
                    </div>
                    <Badge
                      className={`shrink-0 border-0 text-[9px] ${
                        draft.enabled ? "bg-[#c9ff73]/15 text-[#c9ff73]" : "bg-white/5 text-[#858697]"
                      }`}
                    >
                      {draft.enabled ? "Enabled" : "Disabled"}
                    </Badge>
                  </div>
                  <div className="mt-2.5 flex items-center justify-between border-t border-white/5 pt-2 text-[10px] text-[#858697]">
                    <span>
                      {keyCount} key{keyCount === 1 ? "" : "s"}
                    </span>
                    <span className="font-semibold text-[#c9ff73] opacity-0 transition-opacity group-hover:opacity-100">
                      {isSelected ? "Editing below ↓" : "Click to Configure →"}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          <div
            className="flex gap-2 overflow-x-auto border-b border-white/10 pb-2 pt-1"
            role="tablist"
            aria-label={`${providerName} provider groups`}
          >
            {drafts.map((draft, index) => {
              const isSelected = (selectedDraft?.id ?? "") === draft.id;
              const isBai = draft.label.trim().toLowerCase() === "b.ai";
              return (
                <button
                  key={draft.id}
                  type="button"
                  role="tab"
                  aria-selected={isSelected}
                  aria-controls={`${draft.id}-provider-panel`}
                  onClick={() => setActiveProviderId(draft.id)}
                  className={
                    isSelected
                      ? "flex shrink-0 items-center gap-1.5 rounded-md bg-[#c9ff73]/15 px-3 py-1.5 text-xs font-semibold text-[#d8ff91]"
                      : "flex shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold text-[#a8a9b8] hover:bg-white/6 hover:text-white"
                  }
                >
                  <span>{draft.label.trim() || `Provider ${index + 1}`}</span>
                  {isBai && isBaiPriority && (
                    <span className="h-1.5 w-1.5 rounded-full bg-[#c9ff73]" title="Priority Route Active" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="mt-5 space-y-4">
        {selectedDraft && (() => {
          const draft = selectedDraft;
          const providerIndex = drafts.findIndex((d) => d.id === draft.id);
          const isBai = draft.label.trim().toLowerCase() === "b.ai";
          const saved = configured.get(draft.id);
          const keyStates =
            draft.apiKeyEnabled ?? saved?.apiKeyMasks.map((item) => item.enabled !== false) ?? draft.apiKeys.map(() => true);
          return (
            <div
              key={draft.id}
              role="tabpanel"
              id={`${draft.id}-provider-panel`}
              aria-label={draft.label.trim() || `Provider ${providerIndex + 1}`}
              className={`rounded-xl border p-4 ${
                draft.enabled ? "border-white/8 bg-black/15" : "border-white/5 bg-black/30 opacity-80"
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-xs font-semibold text-[#dedfe7]">Provider {providerIndex + 1}: {draft.label}</p>
                    {isBai && (
                      <Badge
                        className={`border text-[9px] ${
                          isBaiPriority
                            ? "border-[#c9ff73]/30 bg-[#c9ff73]/15 text-[#c9ff73]"
                            : "border-white/10 bg-white/5 text-[#858697]"
                        }`}
                      >
                        {isBaiPriority ? "Priority Mode Active" : "Standard Rotation"}
                      </Badge>
                    )}
                  </div>
                  <p className="mt-1 text-[10px] text-[#858697]">
                    {draft.enabled
                      ? "Equal-share group with an independent health-aware key pool."
                      : "Disabled — preserved but excluded from new calls and failover."}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Toggle
                    label={`${draft.label || `Provider ${providerIndex + 1}`} routing`}
                    enabled={draft.enabled}
                    pending={disabled}
                    onChange={(enabled) => {
                      onChange(draft.id, (current) => ({ ...current, enabled }));
                      if (onInstantSave) {
                        const next = drafts.map((d) => (d.id === draft.id ? { ...d, enabled } : d));
                        onInstantSave(next);
                      }
                    }}
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="border-red-300/20 text-red-200 hover:bg-red-400/10 hover:text-red-100"
                    onClick={() => onRemoveProvider(draft.id)}
                    disabled={disabled || drafts.length <= 1}
                  >
                    <Trash2 size={14} /> Remove provider
                  </Button>
                </div>
              </div>

              {isBai && isClaudeOpus && (
                <div className="mt-3.5 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#c9ff73]/25 bg-[#c9ff73]/[0.06] p-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-white">b.ai Priority Routing</span>
                      <span className="rounded bg-[#c9ff73]/20 px-1.5 py-0.5 text-[9px] font-semibold text-[#c9ff73]">
                        {isBaiPriority ? "ACTIVE (Routes 1st)" : "INACTIVE"}
                      </span>
                    </div>
                    <p className="mt-1 text-[10px] leading-relaxed text-[#b4b7c8]">
                      {isBaiPriority
                        ? "b.ai is set as top priority for Claude Opus 5 requests. If it experiences >3 consecutive failures, TokenForge automatically falls back to other providers."
                        : "Toggle on to prioritize b.ai for all incoming Claude Opus 5 calls."}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Toggle
                      label="b.ai Priority"
                      enabled={isBaiPriority}
                      pending={setBaiPriority.isPending}
                      onChange={(enabled) => setBaiPriority.mutate({ enabled })}
                    />
                  </div>
                </div>
              )}

              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <div>
                  <label className="text-xs font-semibold text-[#dedfe7]" htmlFor={`${draft.id}-label`}>
                    Provider label
                  </label>
                  <Input
                    id={`${draft.id}-label`}
                    value={draft.label}
                    onChange={(event) =>
                      onChange(draft.id, (current) => ({ ...current, label: event.target.value }))
                    }
                    className="mt-2 border-white/10 bg-black/15 text-xs"
                    disabled={disabled}
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-[#dedfe7]" htmlFor={`${draft.id}-model`}>
                    Underlying model ID
                  </label>
                  <Input
                    id={`${draft.id}-model`}
                    value={draft.model}
                    onChange={(event) =>
                      onChange(draft.id, (current) => ({ ...current, model: event.target.value }))
                    }
                    className="mt-2 border-white/10 bg-black/15 font-mono text-xs"
                    disabled={disabled}
                  />
                </div>
              </div>
              <div className="mt-3 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                <div>
                  <label className="text-xs font-semibold text-[#dedfe7]" htmlFor={`${draft.id}-base-url`}>
                    Base URL
                  </label>
                  <Input
                    id={`${draft.id}-base-url`}
                    value={draft.baseUrl}
                    onChange={(event) =>
                      onChange(draft.id, (current) => ({ ...current, baseUrl: event.target.value }))
                    }
                    className="mt-2 border-white/10 bg-black/15 font-mono text-xs"
                    disabled={disabled}
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-[#dedfe7]" htmlFor={`${draft.id}-max-input-tokens`}>
                      Max Input Tokens Limit
                    </label>
                    <span className="text-[10px] text-[#858697]">
                      {draft.maxInputTokens && Number(draft.maxInputTokens) > 0
                        ? `≤ ${Number(draft.maxInputTokens).toLocaleString()}`
                        : "Blank = normal"}
                    </span>
                  </div>
                  <Input
                    id={`${draft.id}-max-input-tokens`}
                    type="number"
                    min={1}
                    max={10000000}
                    placeholder="e.g. 120000 (blank = unlimited)"
                    value={draft.maxInputTokens ?? ""}
                    onChange={(event) =>
                      onChange(draft.id, (current) => ({
                        ...current,
                        maxInputTokens: event.target.value === "" ? "" : Number(event.target.value),
                      }))
                    }
                    className="mt-2 border-white/10 bg-black/15 font-mono text-xs"
                    disabled={disabled}
                  />
                  <p className="mt-1 text-[10px] text-[#858697]">
                    Requests with input tokens ≤ this limit route to this provider <strong>first</strong> (even above b.ai priority). Larger requests skip this provider.
                  </p>
                </div>
                <div>
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-[#dedfe7]" htmlFor={`${draft.id}-max-output-tokens`}>
                      Max Output Tokens (Override)
                    </label>
                    <span className="text-[10px] text-[#858697]">
                      {draft.maxOutputTokens && Number(draft.maxOutputTokens) > 0
                        ? `= ${Number(draft.maxOutputTokens).toLocaleString()}`
                        : "Blank = normal"}
                    </span>
                  </div>
                  <Input
                    id={`${draft.id}-max-output-tokens`}
                    type="number"
                    min={1}
                    max={10000000}
                    placeholder="e.g. 64000 (blank = normal)"
                    value={draft.maxOutputTokens ?? ""}
                    onChange={(event) =>
                      onChange(draft.id, (current) => ({
                        ...current,
                        maxOutputTokens: event.target.value === "" ? "" : Number(event.target.value),
                      }))
                    }
                    className="mt-2 border-white/10 bg-black/15 font-mono text-xs"
                    disabled={disabled}
                  />
                  <p className="mt-1 text-[10px] text-[#858697]">
                    Overrides output tokens sent upstream (e.g. replaces client limits like 64). If left blank, standard model/client tokens apply.
                  </p>
                </div>
              </div>
              <div className="mt-3.5 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-white/10 bg-white/[0.03] p-3">
                <div className="max-w-xl">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-[#dedfe7]">Disable TokenForge Identity Injection</span>
                    <Badge
                      className={`border text-[9px] ${
                        draft.disableIdentityPrompt
                          ? "border-amber-400/30 bg-amber-400/15 text-amber-300"
                          : "border-white/10 bg-white/5 text-[#858697]"
                      }`}
                    >
                      {draft.disableIdentityPrompt ? "DISABLED (Raw Upstream Prompt)" : "STANDARD (Identity Enforced)"}
                    </Badge>
                  </div>
                  <p className="mt-1 text-[10px] text-[#858697]">
                    When enabled, TokenForge omits system identity prompts and context mandates for this provider, preventing models (such as Claude on 9router) from rejecting requests due to deceptive identity instructions.
                  </p>
                </div>
                <Toggle
                  label="Disable Identity Prompt"
                  enabled={draft.disableIdentityPrompt ?? false}
                  pending={disabled}
                  onChange={(enabled) => {
                    onChange(draft.id, (current) => ({
                      ...current,
                      disableIdentityPrompt: enabled,
                    }));
                    if (onInstantSave) {
                      const next = drafts.map((d) => (d.id === draft.id ? { ...d, disableIdentityPrompt: enabled } : d));
                      onInstantSave(next);
                    }
                  }}
                />
              </div>
              <div className="mt-3.5 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-white/10 bg-white/[0.03] p-3">
                <div className="max-w-xl">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-[#dedfe7]">Bypass Provider Cooldown</span>
                    <Badge
                      className={`border text-[9px] ${
                        draft.bypassCooldown
                          ? "border-emerald-400/30 bg-emerald-400/15 text-emerald-300"
                          : "border-white/10 bg-white/5 text-[#858697]"
                      }`}
                    >
                      {draft.bypassCooldown ? "BYPASS ON (Cooldown Off)" : "STANDARD (Cooldown Enforced)"}
                    </Badge>
                  </div>
                  <p className="mt-1 text-[10px] text-[#858697]">
                    When turned on, TokenForge disables credential cooldown for this provider. Requests will never be rejected in ~100ms due to temporary rate-limit or failover cooldowns and will always be dispatched directly to upstream.
                  </p>
                </div>
                <Toggle
                  label="Bypass Provider Cooldown"
                  enabled={draft.bypassCooldown ?? false}
                  pending={disabled}
                  onChange={(enabled) => {
                    onChange(draft.id, (current) => ({
                      ...current,
                      bypassCooldown: enabled,
                    }));
                    if (onInstantSave) {
                      const next = drafts.map((d) => (d.id === draft.id ? { ...d, bypassCooldown: enabled } : d));
                      onInstantSave(next);
                    }
                  }}
                />
              </div>
              <div className="mt-3.5 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-white/10 bg-white/[0.03] p-3">
                <div className="max-w-xl">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-[#dedfe7]">Vision / Image Input Support</span>
                    <Badge
                      className={`border text-[9px] ${
                        draft.supportsVision
                          ? "border-purple-400/30 bg-purple-400/15 text-purple-300"
                          : "border-white/10 bg-white/5 text-[#858697]"
                      }`}
                    >
                      {draft.supportsVision ? "VISION ENABLED (Accepts Images)" : "TEXT ONLY (Images Filtered)"}
                    </Badge>
                  </div>
                  <p className="mt-1 text-[10px] text-[#858697]">
                    When enabled, TokenForge flags this provider as capable of processing multimodal and visual inputs (e.g. OpenRouter, Moonshot, or vision-enabled endpoints). Requests containing image attachments will be automatically routed to this provider.
                  </p>
                </div>
                <Toggle
                  label="Vision / Image Support"
                  enabled={draft.supportsVision ?? false}
                  pending={disabled}
                  onChange={(enabled) => {
                    onChange(draft.id, (current) => ({
                      ...current,
                      supportsVision: enabled,
                    }));
                    if (onInstantSave) {
                      const next = drafts.map((d) => (d.id === draft.id ? { ...d, supportsVision: enabled } : d));
                      onInstantSave(next);
                    }
                  }}
                />
              </div>
              <div className="mt-3.5 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-white/10 bg-white/[0.03] p-3">
                <div className="max-w-xl">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-[#dedfe7]">Document & PDF Input Support</span>
                    <Badge
                      className={`border text-[9px] ${
                        draft.supportsDocuments
                          ? "border-blue-400/30 bg-blue-400/15 text-blue-300"
                          : "border-white/10 bg-white/5 text-[#858697]"
                      }`}
                    >
                      {draft.supportsDocuments ? "DOCUMENTS ENABLED (Accepts PDFs / Files)" : "TEXT ONLY (Documents Filtered)"}
                    </Badge>
                  </div>
                  <p className="mt-1 text-[10px] text-[#858697]">
                    When enabled, TokenForge flags this provider as capable of processing documents, PDFs, and file attachments (e.g. Anthropic document blocks or PDF-capable endpoints). Requests containing document attachments will be automatically routed to this provider.
                  </p>
                </div>
                <Toggle
                  label="Document & PDF Support"
                  enabled={draft.supportsDocuments ?? false}
                  pending={disabled}
                  onChange={(enabled) => {
                    onChange(draft.id, (current) => ({
                      ...current,
                      supportsDocuments: enabled,
                    }));
                    if (onInstantSave) {
                      const next = drafts.map((d) => (d.id === draft.id ? { ...d, supportsDocuments: enabled } : d));
                      onInstantSave(next);
                    }
                  }}
                />
              </div>
              <div className="mt-3.5 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-white/10 bg-white/[0.03] p-3">
                <div className="max-w-xl">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-[#dedfe7]">Reasoning Effort Override</span>
                    {draft.reasoningEffort && draft.reasoningEffort !== "" ? (
                      <Badge className="border border-purple-400/30 bg-purple-400/15 text-[9px] text-purple-300 font-bold uppercase tracking-wider">
                        ⚡ {draft.reasoningEffort} effort enforced
                      </Badge>
                    ) : (
                      <Badge className="border border-white/10 bg-white/5 text-[9px] text-[#858697]">
                        Default (Client Pass-through)
                      </Badge>
                    )}
                  </div>
                  <p className="mt-1 text-[10px] text-[#858697]">
                    Select a reasoning effort to override all requests routed to this provider (<strong>low</strong>, <strong>high</strong>, <strong>xhigh</strong>, <strong>max</strong>). If set to <strong>Default</strong>, TokenForge accepts whatever Claude Code or the client sends.
                  </p>
                </div>
                <div className="w-full sm:w-64">
                  <select
                    id={`${draft.id}-reasoning-effort`}
                    value={draft.reasoningEffort || ""}
                    onChange={(event) => {
                      const val = (event.target.value || "") as any;
                      onChange(draft.id, (current) => ({
                        ...current,
                        reasoningEffort: val,
                      }));
                      if (onInstantSave) {
                        const next = drafts.map((d) => (d.id === draft.id ? { ...d, reasoningEffort: val } : d));
                        onInstantSave(next);
                      }
                    }}
                    className="h-8 w-full rounded-md border border-white/12 bg-black/40 px-2.5 text-xs text-white focus:border-[#c9ff73] focus:outline-none cursor-pointer"
                    disabled={disabled}
                  >
                    <option value="" className="bg-[#18181b] text-neutral-300">
                      Default (Client Pass-through)
                    </option>
                    <option value="low" className="bg-[#18181b] text-white">
                      low — Fast / minimal reasoning
                    </option>
                    <option value="medium" className="bg-[#18181b] text-white">
                      medium — Standard reasoning effort
                    </option>
                    <option value="high" className="bg-[#18181b] text-white">
                      high — Deep reasoning
                    </option>
                    <option value="xhigh" className="bg-[#18181b] text-white">
                      xhigh — Extra high reasoning effort
                    </option>
                    <option value="max" className="bg-[#18181b] text-white">
                      max — Maximum reasoning effort
                    </option>
                  </select>
                </div>
              </div>
              <div className="mt-3.5 rounded-lg border border-white/10 bg-white/[0.03] p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-[#dedfe7]">Pinned Users (Dedicated Routing)</span>
                    <Badge
                      className={`border text-[9px] ${
                        (draft.pinnedUserEmails?.length ?? 0) > 0
                          ? "border-[#c9ff73]/30 bg-[#c9ff73]/15 text-[#c9ff73]"
                          : "border-white/10 bg-white/5 text-[#858697]"
                      }`}
                    >
                      {(draft.pinnedUserEmails?.length ?? 0) > 0
                        ? `${draft.pinnedUserEmails!.length} Pinned User${draft.pinnedUserEmails!.length === 1 ? "" : "s"}`
                        : "No Pinned Users"}
                    </Badge>
                  </div>
                </div>
                <p className="mt-1 text-[10px] text-[#858697]">
                  Write user email addresses below (comma-separated). All requests from these users for this model will route through this provider. The global routing policy toggle above controls whether this is a <strong>Soft Preference</strong> (with failover) or <strong>Strict Lock</strong> (all other providers blacklisted).
                </p>
                <div className="mt-2.5">
                  <PinnedUsersInput
                    draftId={draft.id}
                    emails={draft.pinnedUserEmails ?? []}
                    disabled={disabled}
                    onChange={(newEmails) => {
                      onChange(draft.id, (current) => ({
                        ...current,
                        pinnedUserEmails: newEmails,
                      }));
                    }}
                  />
                </div>
              </div>
              <div className="mt-4">
                {(() => {
                  const activeMasks = (saved?.apiKeyMasks ?? []).filter((mask) => !draft.removedSlots.includes(mask.slot));
                  const providerSlotMetrics = metrics?.providers?.find(
                    (p) => p.id === draft.id || p.label.toLowerCase() === draft.label.toLowerCase()
                  )?.slots;
                  return (
                    <DynamicProviderKeyPool
                      providerName={draft.label || `Provider ${providerIndex + 1}`}
                      values={draft.apiKeys}
                      masks={activeMasks}
                      enabledStates={keyStates}
                      keyMetrics={providerSlotMetrics}
                      disabled={disabled}
                      onChange={(keyIndex, value) =>
                        onChange(draft.id, (current) => ({
                          ...current,
                          apiKeys: current.apiKeys.map((key, index) => (index === keyIndex ? value : key)),
                        }))
                      }
                      onEnabledChange={(keyIndex, enabled) =>
                        onChange(draft.id, (current) => ({
                          ...current,
                          apiKeyEnabled: keyStates.map((value, index) => (index === keyIndex ? enabled : value)),
                        }))
                      }
                      onRemove={(keyIndex) =>
                        onChange(draft.id, (current) => {
                          const removedSlot = activeMasks[keyIndex]?.slot;
                          return {
                            ...current,
                            removedSlots: removedSlot
                              ? Array.from(new Set([...current.removedSlots, removedSlot]))
                              : current.removedSlots,
                            apiKeys: current.apiKeys.filter((_, index) => index !== keyIndex),
                            apiKeyEnabled: keyStates.filter((_, index) => index !== keyIndex),
                          };
                        })
                      }
                      onAdd={() =>
                        onChange(draft.id, (current) => ({
                          ...current,
                          apiKeys: [...current.apiKeys, ""],
                          apiKeyEnabled: [...keyStates, true],
                        }))
                      }
                    />
                  );
                })()}
              </div>
            </div>
          );
        })()}
      </div>

      <div className="mt-4 flex flex-wrap gap-3">
        <Button
          type="button"
          variant="outline"
          className="border-[#c9ff73]/25 text-[#c9ff73] hover:bg-[#c9ff73]/10 hover:text-[#d8ff91]"
          onClick={addProvider}
          disabled={disabled || drafts.length >= 100}
        >
          <Plus size={14} /> Add provider
        </Button>
        <Button
          onClick={onSave}
          disabled={disabled || !canSave}
          className="bg-[#c9ff73] text-[#17210d] hover:bg-[#d8ff91]"
        >
          {saving ? (
            <>
              <Loader2 className="animate-spin" size={14} />
              Saving…
            </>
          ) : (
            "Save load balancer"
          )}
        </Button>
      </div>
      <div className="mt-5 rounded-xl border border-white/8 bg-black/15 p-4">
        <p className="text-[10px] font-bold uppercase tracking-[.13em] text-[#858697]">
          Provider and credential observability
        </p>
        <ManagedProviderKeyMetrics providerName={providerName} metrics={metrics} />
        <p className="mt-4 text-[10px] leading-5 text-[#858697]">
          Metrics are provider-group scoped and use non-reversible server-side credential fingerprints. They show
          request, success, failure, cooldown, and recent activity information without exposing API keys.
        </p>
      </div>
    </section>
  );
}

type ClaudeOpus5QwenModelDraft = {
  id: string;
  model: string;
  enabled: boolean;
  quotaTokens: number;
  totalTokens: number;
  requestCount: number;
  retired: boolean;
  retiredAt: Date | null;
  lastUsedAt: Date | null;
};

export function ClaudeOpus5ModelPoolPanel() {
  const utils = trpc.useUtils();
  const settings = trpc.admin.claudeOpus5ProviderSettings.useQuery(undefined, {
    refetchInterval: 5_000,
    refetchIntervalInBackground: false,
  });
  const label = "qwen";
  const isQwen = true;
  const [initialized, setInitialized] = useState(false);
  const [baseUrl, setBaseUrl] = useState("");
  const [maxOutputTokens, setMaxOutputTokens] = useState(32_768);
  const [apiKeys, setApiKeys] = useState<string[]>(["", ""]);
  const [apiKeyEnabled, setApiKeyEnabled] = useState<boolean[]>([true, true]);
  const [removedSlots, setRemovedSlots] = useState<number[]>([]);
  const [models, setModels] = useState<ClaudeOpus5QwenModelDraft[]>([]);
  const [removedModelIds, setRemovedModelIds] = useState<string[]>([]);

  useEffect(() => {
    const handleKeyRoutingState = (event: Event) => {
      const detail = (
        event as CustomEvent<{ providerName?: string; index?: number; enabled?: boolean; action?: "toggle" | "remove" }>
      ).detail;
      if (detail?.providerName !== "Claude Opus Qwen" || typeof detail.index !== "number") return;
      setApiKeyEnabled((current) =>
        detail.action === "remove"
          ? current.filter((_, index) => index !== detail.index)
          : current.map((value, index) => (index === detail.index ? detail.enabled !== false : value))
      );
    };
    window.addEventListener("tokenforge-key-routing-state", handleKeyRoutingState);
    return () => window.removeEventListener("tokenforge-key-routing-state", handleKeyRoutingState);
  }, []);

  const pendingQwenKeyDeletionSlots = useRef<number[]>([]);
  const provider = (settings.data?.providers as ClaudeOpus5ProviderSettingsData[] | undefined)?.find(
    (item) => item.label.trim().toLowerCase() === label
  );

  useEffect(() => {
    if (!settings.data) return;
    const current = (settings.data.providers as ClaudeOpus5ProviderSettingsData[]).find(
      (item) => item.label.trim().toLowerCase() === label
    );
    const hasPool = (current?.modelPool?.length ?? 0) > 0;
    if (initialized && (models.length > 0 || !hasPool)) return;
    setBaseUrl(current?.baseUrl ?? "");
    setMaxOutputTokens(current?.maxOutputTokens ?? 32_768);
    setApiKeys(current?.apiKeyMasks.length ? current.apiKeyMasks.map(() => "") : ["", ""]);
    setApiKeyEnabled(
      current?.apiKeyMasks.length ? current.apiKeyMasks.map((item) => item.enabled !== false) : [true, true]
    );
    const pool = current?.modelPool?.length
      ? current.modelPool
      : current?.model
      ? [
          {
            id: "qwen-model-1",
            model: current.model,
            enabled: true,
            quotaTokens: 1_000_000,
            inputTokens: 0,
            outputTokens: 0,
            totalTokens: 0,
            requestCount: 0,
            retired: false,
            retiredAt: null,
            lastUsedAt: null,
          },
        ]
      : [];
    setModels(
      pool.map((item) => ({
        id: item.id,
        model: item.model,
        enabled: item.enabled,
        quotaTokens: item.quotaTokens,
        totalTokens: item.totalTokens,
        requestCount: item.requestCount,
        retired: item.retired,
        retiredAt: item.retiredAt,
        lastUsedAt: item.lastUsedAt,
      }))
    );
    setRemovedSlots([]);
    setRemovedModelIds([]);
    setInitialized(true);
  }, [initialized, settings.data]);

  useEffect(() => {
    if (!initialized || !settings.data) return;
    const current = (settings.data.providers as ClaudeOpus5ProviderSettingsData[]).find(
      (item) => item.label.trim().toLowerCase() === label
    );
    const livePool = current?.modelPool ?? [];
    if (!livePool.length) return;
    setModels((previous) => {
      const fromLive = (live: ClaudeOpus5QwenModelSetting): ClaudeOpus5QwenModelDraft => ({
        id: live.id,
        model: live.model,
        enabled: live.enabled,
        quotaTokens: live.quotaTokens,
        totalTokens: live.totalTokens,
        requestCount: live.requestCount,
        retired: live.retired,
        retiredAt: live.retiredAt,
        lastUsedAt: live.lastUsedAt,
      });
      const removedIds = new Set(removedModelIds);
      const mergedSaved = livePool
        .filter((live) => !removedIds.has(live.id))
        .map((live) => {
          const draft = previous.find((item) => item.id === live.id);
          return draft
            ? {
                ...draft,
                totalTokens: live.totalTokens,
                requestCount: live.requestCount,
                retired: live.retired,
                retiredAt: live.retiredAt,
                lastUsedAt: live.lastUsedAt,
              }
            : fromLive(live);
        });
      const unsavedDrafts = previous.filter(
        (draft) => !removedIds.has(draft.id) && !livePool.some((live) => live.id === draft.id)
      );
      return [...mergedSaved, ...unsavedDrafts];
    });
  }, [initialized, removedModelIds, settings.data]);

  const save = trpc.admin.updateClaudeOpus5ProviderSettings.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.admin.claudeOpus5ProviderSettings.invalidate(),
        utils.admin.overview.invalidate(),
        utils.admin.activity.invalidate(),
      ]);
      toast.success("Claude Opus 5 Qwen model pool updated");
    },
    onError: (error) => toast.error(error.message),
  });

  const deleteSavedModel = trpc.admin.deleteClaudeOpus5QwenModel.useMutation({
    onSuccess: async (_settings, input) => {
      setRemovedModelIds((current) =>
        current.includes(input.modelEntryId) ? current : [...current, input.modelEntryId]
      );
      setModels((current) => current.filter((entry) => entry.id !== input.modelEntryId));
      await Promise.all([
        utils.admin.claudeOpus5ProviderSettings.invalidate(),
        utils.admin.claudeOpus5FailureLogs.invalidate(),
        utils.admin.overview.invalidate(),
        utils.admin.activity.invalidate(),
      ]);
      toast.success("Qwen model ID permanently deleted");
    },
    onError: (error) => toast.error(error.message),
  });

  const deleteSavedApiKey = trpc.admin.deleteClaudeOpus5QwenApiKey.useMutation({
    onSuccess: async () => {
      pendingQwenKeyDeletionSlots.current = [];
      setRemovedSlots([]);
      await Promise.all([
        utils.admin.claudeOpus5ProviderSettings.invalidate(),
        utils.admin.overview.invalidate(),
        utils.admin.activity.invalidate(),
      ]);
      toast.success("Qwen API key permanently deleted");
    },
    onError: (error) => {
      pendingQwenKeyDeletionSlots.current = [];
      setRemovedSlots([]);
      toast.error(error.message);
    },
  });

  useEffect(() => {
    if (!provider || deleteSavedApiKey.isPending) return;
    const slot = removedSlots.find((candidate) => !pendingQwenKeyDeletionSlots.current.includes(candidate));
    if (!slot) return;
    pendingQwenKeyDeletionSlots.current.push(slot);
    deleteSavedApiKey.mutate({ providerId: provider.id, slot });
  }, [deleteSavedApiKey, provider, removedSlots]);

  const updateModel = (id: string, update: (current: ClaudeOpus5QwenModelDraft) => ClaudeOpus5QwenModelDraft) =>
    setModels((current) => current.map((item) => (item.id === id ? update(item) : item)));

  const configuredQwenKeyCount = Math.max(0, (provider?.apiKeyMasks.length ?? 0) - removedSlots.length);
  const valid = Boolean(
    baseUrl.trim() &&
      models.length &&
      models.every((item) => item.model.trim() && item.quotaTokens >= 1_000) &&
      configuredQwenKeyCount + apiKeys.filter(Boolean).length >= (isQwen ? 2 : 1)
  );

  const otherProviders = ((settings.data?.providers ?? []) as ClaudeOpus5ProviderSettingsData[])
    .filter((item) => item.label.trim().toLowerCase() !== label)
    .map((item) => ({
      id: item.id,
      label: item.label,
      enabled: item.enabled,
      baseUrl: item.baseUrl,
      model: item.model,
      apiKeys: item.apiKeyMasks.map(() => ""),
      apiKeyEnabled: item.apiKeyMasks.map((mask) => mask.enabled !== false),
      removeSlots: [],
    }));

  const savePool = () =>
    save.mutate({
      providers: [
        ...otherProviders,
        {
          id: provider?.id ?? `${label}-${Date.now()}`,
          label,
          enabled: provider?.enabled ?? true,
          baseUrl,
          model: models[0]?.model ?? "",
          apiKeys,
          apiKeyEnabled,
          removeSlots: removedSlots,
          ...(isQwen ? { maxOutputTokens } : {}),
          modelPool: models.map((item) => ({
            id: item.id,
            model: item.model,
            enabled: item.enabled,
            quotaTokens: item.quotaTokens,
          })),
        },
      ],
    });

  const disabled =
    settings.isLoading || save.isPending || deleteSavedModel.isPending || deleteSavedApiKey.isPending;

  const removeModel = (id: string) => {
    if (isQwen && provider?.modelPool?.some((entry) => entry.id === id)) {
      deleteSavedModel.mutate({ providerId: provider.id, modelEntryId: id });
      return;
    }
    setRemovedModelIds((current) => (current.includes(id) ? current : [...current, id]));
    setModels((current) => current.filter((entry) => entry.id !== id));
  };

  return (
    <section className="dashboard-card">
      <SectionHeader
        icon={<Gauge size={17} />}
        title={`Claude Opus 5 · ${label} model-pool provider`}
        detail="Administrator-only internal model rotation. Each enabled model receives traffic in turn."
      />
      <div className="mt-4 rounded-xl border border-[#c9ff73]/15 bg-[#c9ff73]/[.045] p-3 text-[10px] leading-5 text-[#dce9c6]">
        This panel is visible only to administrators. {label} model IDs, provider URL, and keys remain server-side and
        are never returned by Playground, OpenAI-compatible, or Anthropic-compatible responses.
      </div>
      <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(19rem,.7fr)]">
        <div className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-[#dedfe7]" htmlFor="opus-qwen-base-url">
              Provider base URL
            </label>
            <Input
              id="opus-qwen-base-url"
              value={baseUrl}
              onChange={(event) => setBaseUrl(event.target.value)}
              placeholder="https://provider.example/v1"
              className="mt-2 border-white/10 bg-black/15 font-mono text-xs"
              disabled={disabled}
            />
          </div>
          {isQwen ? (
            <div className="rounded-xl border border-white/8 bg-black/10 p-3">
              <div className="flex flex-wrap items-end justify-between gap-2">
                <div>
                  <label className="text-xs font-semibold text-[#dedfe7]" htmlFor="opus-qwen-max-output-tokens">
                    Maximum output tokens
                  </label>
                  <p className="mt-1 text-[10px] leading-5 text-[#858697]">
                    Applies only to the Qwen pool, for both upstream forwarding and Qwen-selected credit reservation.
                    Maximum permitted value: 32,768.
                  </p>
                </div>
                <p className="font-mono text-[10px] text-[#858697]">
                  Current saved limit: {(provider?.maxOutputTokens ?? 32_768).toLocaleString()}
                </p>
              </div>
              <Input
                id="opus-qwen-max-output-tokens"
                type="number"
                inputMode="numeric"
                min={1}
                max={32_768}
                step={1}
                value={maxOutputTokens}
                onChange={(event) =>
                  setMaxOutputTokens(
                    Math.min(32_768, Math.max(1, Math.trunc(Number(event.target.value) || 1)))
                  )
                }
                className="mt-3 border-white/10 bg-black/15 font-mono text-xs"
                disabled={disabled}
              />
            </div>
          ) : null}
          {(() => {
            const activeMasks = (provider?.apiKeyMasks ?? []).filter((mask) => !removedSlots.includes(mask.slot));
            return (
              <DynamicProviderKeyPool
                providerName="Claude Opus Qwen"
                values={apiKeys}
                masks={activeMasks}
                disabled={disabled}
                onChange={(index, value) =>
                  setApiKeys((current) => current.map((key, slot) => (slot === index ? value : key)))
                }
                onRemove={(index) => {
                  const removed = activeMasks[index]?.slot;
                  if (removed) setRemovedSlots((current) => (current.includes(removed) ? current : [...current, removed]));
                  setApiKeys((current) => current.filter((_, slot) => slot !== index));
                }}
                onAdd={() => setApiKeys((current) => [...current, ""])}
              />
            );
          })()}
          <p
            className={
              (provider?.apiKeyMasks.length ?? 0) + apiKeys.filter(Boolean).length >= (isQwen ? 2 : 1)
                ? "text-[10px] text-[#c9ff73]"
                : "text-[10px] text-amber-200"
            }
          >
            {isQwen
              ? "Two active server-side API keys are required for this Qwen provider."
              : "At least one active server-side API key is required for this provider."}
          </p>
        </div>
        <div className="rounded-xl border border-white/8 bg-black/15 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[.13em] text-[#858697]">Rotating model IDs</p>
              <p className="mt-1 text-[10px] leading-5 text-[#858697]">
                Usage refreshes every five seconds. Retired entries stay visible so you can add a replacement model
                ID.
              </p>
            </div>
            <Badge className="border-0 bg-white/6 text-[9px] text-[#d5d6df]">
              {models.filter((item) => item.enabled && !item.retired).length}/{models.length} eligible
            </Badge>
          </div>
          <div className="mt-4 space-y-3">
            {models.map((item, index) => {
              const percent = Math.min(100, Math.round((item.totalTokens / Math.max(1, item.quotaTokens)) * 100));
              return (
                <div
                  key={item.id}
                  className={`rounded-xl border p-3 ${
                    item.retired ? "border-rose-300/20 bg-rose-300/[.045]" : "border-white/8 bg-black/10"
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <p className="text-xs font-semibold text-[#e6e6ee]">Model {index + 1}</p>
                    <div className="flex items-center gap-2">
                      <Badge
                        className={`border text-[9px] ${
                          item.retired
                            ? "border-rose-300/20 bg-rose-300/10 text-rose-200"
                            : item.enabled
                            ? "border-[#c9ff73]/20 bg-[#c9ff73]/10 text-[#c9ff73]"
                            : "border-white/10 bg-white/5 text-[#a9aab8]"
                        }`}
                      >
                        {item.retired ? "Retired at quota" : item.enabled ? "Eligible" : "Disabled"}
                      </Badge>
                      <Button
                        type="button"
                        size="icon"
                        variant="outline"
                        className="h-8 border-red-300/20 text-red-200 hover:bg-red-400/10 hover:text-red-100"
                        disabled={disabled || models.length <= 1}
                        onClick={() => removeModel(item.id)}
                        aria-label={`Remove Qwen model ${index + 1}`}
                      >
                        <Trash2 size={13} />
                      </Button>
                    </div>
                  </div>
                  <div className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_8rem]">
                    <Input
                      value={item.model}
                      onChange={(event) =>
                        updateModel(item.id, (current) => ({ ...current, model: event.target.value }))
                      }
                      placeholder="Internal model ID"
                      className="border-white/10 bg-black/15 font-mono text-xs"
                      disabled={disabled}
                    />
                    {isQwen ? (
                      <Input
                        type="number"
                        min={1000}
                        step={1000}
                        value={item.quotaTokens}
                        onChange={(event) =>
                          updateModel(item.id, (current) => ({
                            ...current,
                            quotaTokens: Math.max(1_000, Number(event.target.value) || 1_000_000),
                          }))
                        }
                        aria-label={`Model ${index + 1} token quota`}
                        className="border-white/10 bg-black/15 font-mono text-xs"
                        disabled={disabled}
                      />
                    ) : null}
                  </div>
                  {isQwen ? (
                    <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/8">
                      <div
                        className={
                          item.retired
                            ? "h-full bg-gradient-to-r from-rose-700 to-rose-300"
                            : "h-full bg-gradient-to-r from-[#4c7e22] to-[#c9ff73]"
                        }
                        style={{ width: `${Math.max(1, percent)}%` }}
                      />
                    </div>
                  ) : null}
                  {isQwen ? (
                    <div className="mt-2 flex flex-wrap items-center justify-between gap-2 font-mono text-[9px] tabular-nums">
                      <span className={item.retired ? "text-rose-200" : "text-[#d8e8bf]"}>
                        {formatTokens(item.totalTokens)} / {formatTokens(item.quotaTokens)} tokens · {percent}%
                      </span>
                      <span className="text-[#858697]">
                        {item.requestCount.toLocaleString()} completed requests
                      </span>
                    </div>
                  ) : null}
                  <div className="mt-2">
                    <Toggle
                      label={`${label} model ${index + 1}`}
                      enabled={item.enabled}
                      pending={disabled || (isQwen && item.retired)}
                      onChange={(enabled) => updateModel(item.id, (current) => ({ ...current, enabled }))}
                    />
                  </div>
                </div>
              );
            })}
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="mt-4 border-[#c9ff73]/25 text-[#c9ff73] hover:bg-[#c9ff73]/10 hover:text-[#d8ff91]"
            onClick={() =>
              setModels((current) => [
                ...current,
                {
                  id: `qwen-model-${Date.now()}-${current.length + 1}`,
                  model: "",
                  enabled: true,
                  quotaTokens: 1_000_000,
                  totalTokens: 0,
                  requestCount: 0,
                  retired: false,
                  retiredAt: null,
                  lastUsedAt: null,
                },
              ])
            }
            disabled={disabled || models.length >= 50}
          >
            <Plus size={14} /> Add model ID
          </Button>
        </div>
      </div>
      <div className="mt-5 flex flex-wrap items-center gap-3">
        <Button
          onClick={savePool}
          disabled={disabled || !valid}
          className="bg-[#c9ff73] text-[#17210d] hover:bg-[#d8ff91]"
        >
          {save.isPending ? (
            <>
              <Loader2 className="animate-spin" size={14} />
              Saving…
            </>
          ) : (
            `Save ${label} model pool`
          )}
        </Button>
        {!valid && !settings.isLoading ? (
          <p className="text-[10px] text-amber-200">
            Add a base URL, two active API keys, and at least one valid model ID to save.
          </p>
        ) : null}
      </div>
    </section>
  );
}

export function ClaudeFable5ProviderBalancerPanel({ metrics }: { metrics?: ManagedProviderKeyMetricGroup }) {
  const utils = trpc.useUtils();
  const settings = trpc.admin.claudeFable5ProviderSettings.useQuery(undefined, {
    refetchInterval: 5_000,
    refetchIntervalInBackground: false,
  });
  const [drafts, setDrafts] = useState<ClaudeOpus5ProviderDraft[]>([]);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (!settings.data || initialized) return;
    setDrafts(
      settings.data.providers.map((provider) => ({
        id: provider.id,
        label: provider.label,
        enabled: provider.enabled,
        baseUrl: provider.baseUrl,
        model: provider.model,
        maxInputTokens: (provider as { maxInputTokens?: number }).maxInputTokens ?? "",
        maxOutputTokens: (provider as { maxOutputTokens?: number }).maxOutputTokens ?? "",
        disableIdentityPrompt: provider.disableIdentityPrompt ?? false,
        bypassCooldown: provider.bypassCooldown ?? false,
        supportsVision: provider.supportsVision ?? false,
        supportsDocuments: provider.supportsDocuments ?? false,
        pinnedUserEmails: provider.pinnedUserEmails ?? [],
        reasoningEffort: (provider as any).reasoningEffort ?? "",
        apiKeys: provider.apiKeyMasks.length ? provider.apiKeyMasks.map(() => "") : [""],
        apiKeyEnabled: provider.apiKeyMasks.length
          ? provider.apiKeyMasks.map((item) => item.enabled !== false)
          : [true],
        removedSlots: [],
      }))
    );
    setInitialized(true);
  }, [initialized, settings.data]);

  const save = trpc.admin.updateClaudeFable5ProviderSettings.useMutation({
    onSuccess: async () => {
      setInitialized(false);
      await Promise.all([
        utils.admin.claudeFable5ProviderSettings.invalidate(),
        utils.admin.overview.invalidate(),
        utils.admin.activity.invalidate(),
      ]);
      toast.success("Claude Fable 5.1 load balancer updated");
    },
    onError: (error) => toast.error(error.message),
  });

  return (
    <>
      <ClaudeOpus5ProviderBalancerPanel
        providerName="Claude Fable 5.1"
        modelId="claude-fable-5.1"
        drafts={drafts}
        settings={settings.data as ClaudeOpus5SettingsData | undefined}
        metrics={metrics}
        loading={settings.isLoading}
        saving={save.isPending}
        onChange={(id, update) => setDrafts((current) => current.map((draft) => (draft.id === id ? update(draft) : draft)))}
        onAddProvider={(id) =>
          setDrafts((current) => [
            ...current,
            { id, label: `Provider ${current.length + 1}`, enabled: true, baseUrl: "", model: "", apiKeys: [""], removedSlots: [], maxInputTokens: "", maxOutputTokens: "", disableIdentityPrompt: false, bypassCooldown: false, supportsVision: false, supportsDocuments: false, pinnedUserEmails: [], reasoningEffort: "" },
          ])
        }
        onRemoveProvider={(id) => setDrafts((current) => current.filter((draft) => draft.id !== id))}
        onInstantSave={(updatedDrafts) =>
          save.mutate({
            providers: updatedDrafts.map((draft) => ({
              ...draft,
              removeSlots: draft.removedSlots,
              maxInputTokens: draft.maxInputTokens !== undefined && draft.maxInputTokens !== "" ? Number(draft.maxInputTokens) : null,
              maxOutputTokens: draft.maxOutputTokens !== undefined && draft.maxOutputTokens !== "" ? Number(draft.maxOutputTokens) : null,
              pinnedUserEmails: draft.pinnedUserEmails ?? [],
              reasoningEffort: draft.reasoningEffort ? (draft.reasoningEffort as any) : null,
            })),
          })
        }
        onSave={() =>
          save.mutate({
            providers: drafts.map((draft) => ({
              ...draft,
              removeSlots: draft.removedSlots,
              maxInputTokens: draft.maxInputTokens !== undefined && draft.maxInputTokens !== "" ? Number(draft.maxInputTokens) : null,
              maxOutputTokens: draft.maxOutputTokens !== undefined && draft.maxOutputTokens !== "" ? Number(draft.maxOutputTokens) : null,
              pinnedUserEmails: draft.pinnedUserEmails ?? [],
              reasoningEffort: draft.reasoningEffort ? (draft.reasoningEffort as any) : null,
            })),
          })
        }
      />
      <ManagedModelFailureHistory model="claude-fable-5.1" title="Claude Fable 5.1" />
    </>
  );
}

export function Sonnet46ProviderBalancerPanel({ metrics }: { metrics?: ManagedProviderKeyMetricGroup }) {
  const utils = trpc.useUtils();
  const settings = trpc.admin.sonnet46ProviderSettings.useQuery(undefined, {
    refetchInterval: 5_000,
    refetchIntervalInBackground: false,
  });
  const [drafts, setDrafts] = useState<ClaudeOpus5ProviderDraft[]>([]);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (!settings.data || initialized) return;
    setDrafts(
      settings.data.providers.map((provider) => ({
        id: provider.id,
        label: provider.label,
        enabled: provider.enabled,
        baseUrl: provider.baseUrl,
        model: provider.model,
        maxInputTokens: (provider as { maxInputTokens?: number }).maxInputTokens ?? "",
        disableIdentityPrompt: provider.disableIdentityPrompt ?? false,
        bypassCooldown: provider.bypassCooldown ?? false,
        supportsVision: provider.supportsVision ?? false,
        supportsDocuments: provider.supportsDocuments ?? false,
        pinnedUserEmails: provider.pinnedUserEmails ?? [],
        reasoningEffort: (provider as any).reasoningEffort ?? "",
        apiKeys: provider.apiKeyMasks.length ? provider.apiKeyMasks.map(() => "") : [""],
        apiKeyEnabled: provider.apiKeyMasks.length
          ? provider.apiKeyMasks.map((item) => item.enabled !== false)
          : [true],
        removedSlots: [],
      }))
    );
    setInitialized(true);
  }, [initialized, settings.data]);

  const save = trpc.admin.updateSonnet46ProviderSettings.useMutation({
    onSuccess: async () => {
      setInitialized(false);
      await Promise.all([
        utils.admin.sonnet46ProviderSettings.invalidate(),
        utils.admin.overview.invalidate(),
        utils.admin.activity.invalidate(),
      ]);
      toast.success("Claude Sonnet 4.6 load balancer updated");
    },
    onError: (error) => toast.error(error.message),
  });

  return (
    <>
      <ClaudeOpus5ProviderBalancerPanel
        providerName="Claude Sonnet 4.6"
        modelId="claude-sonnet-4.6"
        drafts={drafts}
        settings={settings.data as ClaudeOpus5SettingsData | undefined}
        metrics={metrics}
        loading={settings.isLoading}
        saving={save.isPending}
        onChange={(id, update) => setDrafts((current) => current.map((draft) => (draft.id === id ? update(draft) : draft)))}
        onAddProvider={(id) =>
          setDrafts((current) => [
            ...current,
            { id, label: `Provider ${current.length + 1}`, enabled: true, baseUrl: "", model: "", apiKeys: [""], removedSlots: [], disableIdentityPrompt: false, bypassCooldown: false, supportsVision: false, supportsDocuments: false, pinnedUserEmails: [], reasoningEffort: "" },
          ])
        }
        onRemoveProvider={(id) => setDrafts((current) => current.filter((draft) => draft.id !== id))}
        onInstantSave={(updatedDrafts) =>
          save.mutate({
            providers: updatedDrafts.map(({ maxOutputTokens: _ignored, ...draft }) => ({
              ...draft,
              removeSlots: draft.removedSlots,
              maxInputTokens: draft.maxInputTokens !== undefined && draft.maxInputTokens !== "" ? Number(draft.maxInputTokens) : null,
              pinnedUserEmails: draft.pinnedUserEmails ?? [],
              reasoningEffort: draft.reasoningEffort ? (draft.reasoningEffort as any) : null,
            })),
          })
        }
        onSave={() =>
          save.mutate({
            providers: drafts.map(({ maxOutputTokens: _ignored, ...draft }) => ({
              ...draft,
              removeSlots: draft.removedSlots,
              maxInputTokens: draft.maxInputTokens !== undefined && draft.maxInputTokens !== "" ? Number(draft.maxInputTokens) : null,
              pinnedUserEmails: draft.pinnedUserEmails ?? [],
              reasoningEffort: draft.reasoningEffort ? (draft.reasoningEffort as any) : null,
            })),
          })
        }
      />
      <ManagedModelFailureHistory model="claude-sonnet-4.6" title="Claude Sonnet 4.6" />
    </>
  );
}

export function Qwen38MaxProviderBalancerPanel({ metrics }: { metrics?: ManagedProviderKeyMetricGroup }) {
  const utils = trpc.useUtils();
  const settings = trpc.admin.qwen38MaxProviderSettings.useQuery(undefined, {
    refetchInterval: 5_000,
    refetchIntervalInBackground: false,
  });
  const [drafts, setDrafts] = useState<ClaudeOpus5ProviderDraft[]>([]);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (!settings.data || initialized) return;
    setDrafts(
      settings.data.providers.map((provider) => ({
        id: provider.id,
        label: provider.label,
        enabled: provider.enabled,
        baseUrl: provider.baseUrl,
        model: provider.model,
        maxInputTokens: (provider as { maxInputTokens?: number }).maxInputTokens ?? "",
        maxOutputTokens: (provider as { maxOutputTokens?: number }).maxOutputTokens ?? "",
        disableIdentityPrompt: provider.disableIdentityPrompt ?? false,
        bypassCooldown: provider.bypassCooldown ?? false,
        supportsVision: provider.supportsVision ?? false,
        supportsDocuments: provider.supportsDocuments ?? false,
        pinnedUserEmails: provider.pinnedUserEmails ?? [],
        reasoningEffort: (provider as any).reasoningEffort ?? "",
        apiKeys: provider.apiKeyMasks.length ? provider.apiKeyMasks.map(() => "") : [""],
        apiKeyEnabled: provider.apiKeyMasks.length
          ? provider.apiKeyMasks.map((item) => item.enabled !== false)
          : [true],
        removedSlots: [],
      }))
    );
    setInitialized(true);
  }, [initialized, settings.data]);

  const save = trpc.admin.updateQwen38MaxProviderSettings.useMutation({
    onSuccess: async () => {
      setInitialized(false);
      await Promise.all([
        utils.admin.qwen38MaxProviderSettings.invalidate(),
        utils.admin.overview.invalidate(),
        utils.admin.activity.invalidate(),
      ]);
      toast.success("Qwen 3.8 Max load balancer updated");
    },
    onError: (error) => toast.error(error.message),
  });

  return (
    <>
      <ClaudeOpus5ProviderBalancerPanel
        providerName="Qwen 3.8 Max"
        modelId="qwen3.8-max"
        drafts={drafts}
        settings={settings.data as ClaudeOpus5SettingsData | undefined}
        metrics={metrics}
        loading={settings.isLoading}
        saving={save.isPending}
        onChange={(id, update) => setDrafts((current) => current.map((draft) => (draft.id === id ? update(draft) : draft)))}
        onAddProvider={(id) =>
          setDrafts((current) => [
            ...current,
            { id, label: `Provider ${current.length + 1}`, enabled: true, baseUrl: "", model: "", apiKeys: [""], removedSlots: [], maxInputTokens: "", maxOutputTokens: "", disableIdentityPrompt: false, bypassCooldown: false, supportsVision: false, supportsDocuments: false, pinnedUserEmails: [], reasoningEffort: "" },
          ])
        }
        onRemoveProvider={(id) => setDrafts((current) => current.filter((draft) => draft.id !== id))}
        onInstantSave={(updatedDrafts) =>
          save.mutate({
            providers: updatedDrafts.map((draft) => ({
              ...draft,
              removeSlots: draft.removedSlots,
              maxInputTokens: draft.maxInputTokens !== undefined && draft.maxInputTokens !== "" ? Number(draft.maxInputTokens) : null,
              maxOutputTokens: draft.maxOutputTokens !== undefined && draft.maxOutputTokens !== "" ? Number(draft.maxOutputTokens) : null,
              pinnedUserEmails: draft.pinnedUserEmails ?? [],
              reasoningEffort: draft.reasoningEffort ? (draft.reasoningEffort as any) : null,
            })),
          })
        }
        onSave={() =>
          save.mutate({
            providers: drafts.map((draft) => ({
              ...draft,
              removeSlots: draft.removedSlots,
              maxInputTokens: draft.maxInputTokens !== undefined && draft.maxInputTokens !== "" ? Number(draft.maxInputTokens) : null,
              maxOutputTokens: draft.maxOutputTokens !== undefined && draft.maxOutputTokens !== "" ? Number(draft.maxOutputTokens) : null,
              pinnedUserEmails: draft.pinnedUserEmails ?? [],
              reasoningEffort: draft.reasoningEffort ? (draft.reasoningEffort as any) : null,
            })),
          })
        }
      />
      <ManagedModelFailureHistory model="qwen3.8-max" title="Qwen 3.8 Max" />
    </>
  );
}

export function Gpt6AstraProviderBalancerPanel({ metrics }: { metrics?: ManagedProviderKeyMetricGroup }) {
  const utils = trpc.useUtils();
  const settings = trpc.admin.gpt6AstraProviderSettings.useQuery(undefined, {
    refetchInterval: 5_000,
    refetchIntervalInBackground: false,
  });
  const [drafts, setDrafts] = useState<ClaudeOpus5ProviderDraft[]>([]);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (!settings.data || initialized) return;
    setDrafts(
      settings.data.providers.map((provider) => ({
        id: provider.id,
        label: provider.label,
        enabled: provider.enabled,
        baseUrl: provider.baseUrl,
        model: provider.model,
        maxInputTokens: (provider as { maxInputTokens?: number }).maxInputTokens ?? "",
        maxOutputTokens: (provider as { maxOutputTokens?: number }).maxOutputTokens ?? "",
        disableIdentityPrompt: provider.disableIdentityPrompt ?? false,
        bypassCooldown: provider.bypassCooldown ?? false,
        supportsVision: provider.supportsVision ?? false,
        supportsDocuments: provider.supportsDocuments ?? false,
        pinnedUserEmails: provider.pinnedUserEmails ?? [],
        reasoningEffort: (provider as any).reasoningEffort ?? "",
        apiKeys: provider.apiKeyMasks.length ? provider.apiKeyMasks.map(() => "") : [""],
        apiKeyEnabled: provider.apiKeyMasks.length
          ? provider.apiKeyMasks.map((item) => item.enabled !== false)
          : [true],
        removedSlots: [],
      }))
    );
    setInitialized(true);
  }, [initialized, settings.data]);

  const save = trpc.admin.updateGpt6AstraProviderSettings.useMutation({
    onSuccess: async () => {
      setInitialized(false);
      await Promise.all([
        utils.admin.gpt6AstraProviderSettings.invalidate(),
        utils.admin.overview.invalidate(),
        utils.admin.activity.invalidate(),
      ]);
      toast.success("GPT-6 Astra load balancer updated");
    },
    onError: (error) => toast.error(error.message),
  });

  return (
    <>
      <ClaudeOpus5ProviderBalancerPanel
        providerName="GPT-6 Astra"
        modelId="gpt-6-astra"
        drafts={drafts}
        settings={settings.data as ClaudeOpus5SettingsData | undefined}
        metrics={metrics}
        loading={settings.isLoading}
        saving={save.isPending}
        onChange={(id, update) => setDrafts((current) => current.map((draft) => (draft.id === id ? update(draft) : draft)))}
        onAddProvider={(id) =>
          setDrafts((current) => [
            ...current,
            { id, label: `Provider ${current.length + 1}`, enabled: true, baseUrl: "", model: "", apiKeys: [""], removedSlots: [], maxInputTokens: "", maxOutputTokens: "", disableIdentityPrompt: false, bypassCooldown: false, supportsVision: false, supportsDocuments: false, pinnedUserEmails: [], reasoningEffort: "" },
          ])
        }
        onRemoveProvider={(id) => setDrafts((current) => current.filter((draft) => draft.id !== id))}
        onInstantSave={(updatedDrafts) =>
          save.mutate({
            providers: updatedDrafts.map((draft) => ({
              ...draft,
              removeSlots: draft.removedSlots,
              maxInputTokens: draft.maxInputTokens !== undefined && draft.maxInputTokens !== "" ? Number(draft.maxInputTokens) : null,
              maxOutputTokens: draft.maxOutputTokens !== undefined && draft.maxOutputTokens !== "" ? Number(draft.maxOutputTokens) : null,
              pinnedUserEmails: draft.pinnedUserEmails ?? [],
              reasoningEffort: draft.reasoningEffort ? (draft.reasoningEffort as any) : null,
            })),
          })
        }
        onSave={() =>
          save.mutate({
            providers: drafts.map((draft) => ({
              ...draft,
              removeSlots: draft.removedSlots,
              maxInputTokens: draft.maxInputTokens !== undefined && draft.maxInputTokens !== "" ? Number(draft.maxInputTokens) : null,
              maxOutputTokens: draft.maxOutputTokens !== undefined && draft.maxOutputTokens !== "" ? Number(draft.maxOutputTokens) : null,
              pinnedUserEmails: draft.pinnedUserEmails ?? [],
              reasoningEffort: draft.reasoningEffort ? (draft.reasoningEffort as any) : null,
            })),
          })
        }
      />
      <ManagedModelFailureHistory model="gpt-6-astra" title="GPT-6 Astra" />
    </>
  );
}

export function KimiK3ProviderBalancerPanel({ metrics }: { metrics?: ManagedProviderKeyMetricGroup }) {
  const utils = trpc.useUtils();
  const settings = trpc.admin.kimiK3ProviderSettings.useQuery(undefined, {
    refetchInterval: 5_000,
    refetchIntervalInBackground: false,
  });
  const [drafts, setDrafts] = useState<ClaudeOpus5ProviderDraft[]>([]);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (!settings.data || initialized) return;
    setDrafts(
      settings.data.providers.map((provider) => ({
        id: provider.id,
        label: provider.label,
        enabled: provider.enabled,
        baseUrl: provider.baseUrl,
        model: provider.model,
        maxInputTokens: (provider as { maxInputTokens?: number }).maxInputTokens ?? "",
        maxOutputTokens: (provider as { maxOutputTokens?: number }).maxOutputTokens ?? "",
        disableIdentityPrompt: provider.disableIdentityPrompt ?? false,
        bypassCooldown: provider.bypassCooldown ?? false,
        supportsVision: provider.supportsVision ?? false,
        supportsDocuments: provider.supportsDocuments ?? false,
        pinnedUserEmails: provider.pinnedUserEmails ?? [],
        reasoningEffort: (provider as any).reasoningEffort ?? "",
        apiKeys: provider.apiKeyMasks.length ? provider.apiKeyMasks.map(() => "") : [""],
        apiKeyEnabled: provider.apiKeyMasks.length
          ? provider.apiKeyMasks.map((item) => item.enabled !== false)
          : [true],
        removedSlots: [],
      }))
    );
    setInitialized(true);
  }, [initialized, settings.data]);

  const save = trpc.admin.updateKimiK3ProviderSettings.useMutation({
    onSuccess: async () => {
      setInitialized(false);
      await Promise.all([
        utils.admin.kimiK3ProviderSettings.invalidate(),
        utils.admin.overview.invalidate(),
        utils.admin.activity.invalidate(),
      ]);
      toast.success("Kimi K3 load balancer updated");
    },
    onError: (error) => toast.error(error.message),
  });

  return (
    <>
      <ClaudeOpus5ProviderBalancerPanel
        providerName="Kimi K3"
        modelId="kimi-k3"
        drafts={drafts}
        settings={settings.data as ClaudeOpus5SettingsData | undefined}
        metrics={metrics}
        loading={settings.isLoading}
        saving={save.isPending}
        onChange={(id, update) => setDrafts((current) => current.map((draft) => (draft.id === id ? update(draft) : draft)))}
        onAddProvider={(id) =>
          setDrafts((current) => [
            ...current,
            { id, label: `Provider ${current.length + 1}`, enabled: true, baseUrl: "", model: "", apiKeys: [""], removedSlots: [], maxInputTokens: "", maxOutputTokens: "", disableIdentityPrompt: false, bypassCooldown: false, supportsVision: false, supportsDocuments: false, pinnedUserEmails: [], reasoningEffort: "" },
          ])
        }
        onRemoveProvider={(id) => setDrafts((current) => current.filter((draft) => draft.id !== id))}
        onInstantSave={(updatedDrafts) =>
          save.mutate({
            providers: updatedDrafts.map((draft) => ({
              ...draft,
              removeSlots: draft.removedSlots,
              maxInputTokens: draft.maxInputTokens !== undefined && draft.maxInputTokens !== "" ? Number(draft.maxInputTokens) : null,
              maxOutputTokens: draft.maxOutputTokens !== undefined && draft.maxOutputTokens !== "" ? Number(draft.maxOutputTokens) : null,
              pinnedUserEmails: draft.pinnedUserEmails ?? [],
              reasoningEffort: draft.reasoningEffort ? (draft.reasoningEffort as any) : null,
            })),
          })
        }
        onSave={() =>
          save.mutate({
            providers: drafts.map((draft) => ({
              ...draft,
              removeSlots: draft.removedSlots,
              maxInputTokens: draft.maxInputTokens !== undefined && draft.maxInputTokens !== "" ? Number(draft.maxInputTokens) : null,
              maxOutputTokens: draft.maxOutputTokens !== undefined && draft.maxOutputTokens !== "" ? Number(draft.maxOutputTokens) : null,
              pinnedUserEmails: draft.pinnedUserEmails ?? [],
              reasoningEffort: draft.reasoningEffort ? (draft.reasoningEffort as any) : null,
            })),
          })
        }
      />
      <ManagedModelFailureHistory model="kimi-k3" title="Kimi K3" />
    </>
  );
}

export function DeepseekV4ProProviderBalancerPanel({ metrics }: { metrics?: ManagedProviderKeyMetricGroup }) {
  const utils = trpc.useUtils();
  const settings = trpc.admin.deepseekV4ProProviderSettings.useQuery(undefined, {
    refetchInterval: 5_000,
    refetchIntervalInBackground: false,
  });
  const [drafts, setDrafts] = useState<ClaudeOpus5ProviderDraft[]>([]);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (!settings.data || initialized) return;
    const providerSettings = settings.data as DeepseekV4ProSettingsData;
    setDrafts(
      providerSettings.providers.map((provider) => ({
        ...provider,
        maxInputTokens: (provider as { maxInputTokens?: number }).maxInputTokens ?? "",
        pinnedUserEmails: provider.pinnedUserEmails ?? [],
        reasoningEffort: (provider as any).reasoningEffort ?? "",
        apiKeys: provider.apiKeyMasks.length ? provider.apiKeyMasks.map(() => "") : [""],
        apiKeyEnabled: provider.apiKeyMasks.length
          ? provider.apiKeyMasks.map((item) => item.enabled !== false)
          : [true],
        removedSlots: [],
      }))
    );
    setInitialized(true);
  }, [initialized, settings.data]);

  const save = trpc.admin.updateDeepseekV4ProProviderSettings.useMutation({
    onSuccess: async () => {
      setInitialized(false);
      await Promise.all([
        utils.admin.deepseekV4ProProviderSettings.invalidate(),
        utils.admin.overview.invalidate(),
        utils.admin.activity.invalidate(),
      ]);
      toast.success("DeepSeek V4 Pro load balancer updated");
    },
    onError: (error) => toast.error(error.message),
  });

  return (
    <>
      <ClaudeOpus5ProviderBalancerPanel
        providerName="DeepSeek V4 Pro"
        modelId="deepseek-v4-pro"
        drafts={drafts}
        settings={settings.data as ClaudeOpus5SettingsData | undefined}
        metrics={metrics}
        loading={settings.isLoading}
        saving={save.isPending}
        onChange={(id, update) => setDrafts((current) => current.map((draft) => (draft.id === id ? update(draft) : draft)))}
        onAddProvider={(id) =>
          setDrafts((current) => [
            ...current,
            { id, label: `Provider ${current.length + 1}`, enabled: true, baseUrl: "", model: "", apiKeys: [""], removedSlots: [], bypassCooldown: false, supportsVision: false, supportsDocuments: false, pinnedUserEmails: [], reasoningEffort: "" },
          ])
        }
        onRemoveProvider={(id) => setDrafts((current) => current.filter((draft) => draft.id !== id))}
        onInstantSave={(updatedDrafts) =>
          save.mutate({
            providers: updatedDrafts.map(({ maxOutputTokens: _ignored, ...draft }) => ({
              ...draft,
              removeSlots: draft.removedSlots,
              maxInputTokens: draft.maxInputTokens !== undefined && draft.maxInputTokens !== "" ? Number(draft.maxInputTokens) : null,
              pinnedUserEmails: draft.pinnedUserEmails ?? [],
              reasoningEffort: draft.reasoningEffort ? (draft.reasoningEffort as any) : null,
            })),
          })
        }
        onSave={() =>
          save.mutate({
            providers: drafts.map(({ maxOutputTokens: _ignored, ...draft }) => ({
              ...draft,
              removeSlots: draft.removedSlots,
              maxInputTokens: draft.maxInputTokens !== undefined && draft.maxInputTokens !== "" ? Number(draft.maxInputTokens) : null,
              pinnedUserEmails: draft.pinnedUserEmails ?? [],
              reasoningEffort: draft.reasoningEffort ? (draft.reasoningEffort as any) : null,
            })),
          })
        }
      />
      <ManagedModelFailureHistory model="deepseek-v4-pro" title="DeepSeek V4 Pro" />
    </>
  );
}

export function BailuWebshareProxyPoolPanel({
  enabled,
  drafts,
  settings,
  loading,
  saving,
  onEnabledChange,
  onDraftsChange,
  onSave,
}: {
  enabled: boolean;
  drafts: BailuWebshareProxyDraft[];
  settings?: BailuWebshareProxySettingsData;
  loading: boolean;
  saving: boolean;
  onEnabledChange: (value: boolean) => void;
  onDraftsChange: (next: BailuWebshareProxyDraft[]) => void;
  onSave: () => void;
}) {
  const disabled = loading || saving;
  const savedById = new Map((settings?.proxies ?? []).map((proxy) => [proxy.id, proxy]));
  const hasPartialProxy = drafts.some((draft) => {
    const hasAnyValue = Boolean(draft.host.trim() || draft.port.trim() || draft.username || draft.password);
    if (!hasAnyValue) return false;
    const saved = savedById.get(draft.id);
    const sameTarget = saved?.host === draft.host.trim() && saved.port === Number(draft.port);
    return !draft.host.trim() || !Number(draft.port) || ((!draft.username || !draft.password) && !sameTarget);
  });
  const completeCount = drafts.filter((draft) =>
    Boolean(
      draft.host.trim() &&
        Number(draft.port) &&
        ((draft.username && draft.password) ||
          (savedById.get(draft.id)?.host === draft.host.trim() &&
            savedById.get(draft.id)?.port === Number(draft.port)))
    )
  ).length;
  const canSave = !hasPartialProxy && (!enabled || completeCount > 0);
  const update = (id: string, change: Partial<BailuWebshareProxyDraft>) =>
    onDraftsChange(drafts.map((draft) => (draft.id === id ? { ...draft, ...change } : draft)));

  return (
    <section className="dashboard-card">
      <SectionHeader
        icon={<ShieldAlert size={17} />}
        title="Bailu Webshare egress pool"
        detail="Only the Claude Opus provider group named Bailu can use this pool. Requests rotate across enabled direct proxies; no user IP header is sent upstream."
      />
      <div className="mt-4 flex flex-wrap items-start justify-between gap-3 rounded-xl border border-sky-300/15 bg-sky-300/[.045] p-3">
        <p className="max-w-2xl text-[10px] leading-5 text-sky-100/75">
          Use only Webshare Direct proxies with fixed addresses. Add every enabled proxy host to Bailu’s API-key
          allowlist before switching routing on. User addresses, cookies, and browser headers are never copied to
          Bailu.
        </p>
        <Toggle label="Bailu Webshare routing" enabled={enabled} pending={disabled} onChange={onEnabledChange} />
      </div>
      <div className="mt-5 space-y-3">
        {drafts.map((draft, index) => {
          const saved = savedById.get(draft.id);
          const sameTarget = saved?.host === draft.host.trim() && saved.port === Number(draft.port);
          return (
            <div
              key={draft.id}
              className={`rounded-xl border p-4 ${
                draft.enabled ? "border-white/8 bg-black/15" : "border-white/5 bg-black/30 opacity-80"
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold text-[#dedfe7]">Webshare direct proxy {index + 1}</p>
                  <p className="mt-1 text-[10px] text-[#858697]">
                    {saved?.passwordConfigured && sameTarget
                      ? "Credentials saved server-side; leave blank to retain them."
                      : "Enter all connection fields before saving this slot."}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Toggle
                    label={`Webshare proxy ${index + 1} enabled`}
                    enabled={draft.enabled}
                    pending={disabled}
                    onChange={(value) => update(draft.id, { enabled: value })}
                  />
                  <Button
                    type="button"
                    size="icon"
                    variant="outline"
                    aria-label={`Remove Webshare proxy ${index + 1}`}
                    className="h-8 border-red-300/20 text-red-200 hover:bg-red-400/10 hover:text-red-100"
                    onClick={() => onDraftsChange(drafts.filter((proxy) => proxy.id !== draft.id))}
                    disabled={disabled}
                  >
                    <Trash2 size={14} />
                  </Button>
                </div>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <label className="text-[10px] font-semibold text-[#dedfe7]">
                  Label
                  <Input
                    value={draft.label}
                    onChange={(event) => update(draft.id, { label: event.target.value })}
                    maxLength={80}
                    className="mt-2 border-white/10 bg-black/15 text-xs"
                    disabled={disabled}
                  />
                </label>
                <label className="text-[10px] font-semibold text-[#dedfe7]">
                  Proxy IPv4 address
                  <Input
                    value={draft.host}
                    onChange={(event) => update(draft.id, { host: event.target.value })}
                    inputMode="numeric"
                    placeholder="Webshare proxy host"
                    className="mt-2 border-white/10 bg-black/15 font-mono text-xs"
                    disabled={disabled}
                  />
                </label>
                <label className="text-[10px] font-semibold text-[#dedfe7]">
                  Port
                  <Input
                    value={draft.port}
                    onChange={(event) =>
                      update(draft.id, { port: event.target.value.replace(/[^0-9]/g, "") })
                    }
                    inputMode="numeric"
                    placeholder="Proxy port"
                    className="mt-2 border-white/10 bg-black/15 font-mono text-xs"
                    disabled={disabled}
                  />
                </label>
                <label className="text-[10px] font-semibold text-[#dedfe7]">
                  Username
                  <Input
                    type="password"
                    value={draft.username}
                    onChange={(event) => update(draft.id, { username: event.target.value })}
                    placeholder={saved?.usernameMask ?? "Webshare username"}
                    autoComplete="new-password"
                    className="mt-2 border-white/10 bg-black/15 font-mono text-xs placeholder:text-[#9294a4]"
                    disabled={disabled}
                  />
                </label>
                <label className="text-[10px] font-semibold text-[#dedfe7] sm:col-span-2">
                  Password
                  <Input
                    type="password"
                    value={draft.password}
                    onChange={(event) => update(draft.id, { password: event.target.value })}
                    placeholder={
                      saved?.passwordConfigured
                        ? "Saved server-side — leave blank to retain"
                        : "Webshare password"
                    }
                    autoComplete="new-password"
                    className="mt-2 border-white/10 bg-black/15 font-mono text-xs placeholder:text-[#9294a4]"
                    disabled={disabled}
                  />
                </label>
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="border-sky-300/25 text-sky-100 hover:bg-sky-300/10 hover:text-sky-50"
          onClick={() =>
            onDraftsChange([
              ...drafts,
              {
                id: `webshare-${Date.now()}-${drafts.length + 1}`,
                label: `Webshare proxy ${drafts.length + 1}`,
                host: "",
                port: "",
                username: "",
                password: "",
                enabled: true,
              },
            ])
          }
          disabled={disabled || drafts.length >= 3}
        >
          <Plus size={14} /> Add proxy
        </Button>
        <Button
          type="button"
          size="sm"
          onClick={onSave}
          disabled={disabled || !canSave}
          className="bg-[#c9ff73] text-[#17210d] hover:bg-[#d8ff91]"
        >
          {saving ? (
            <>
              <Loader2 className="animate-spin" size={14} />
              Saving…
            </>
          ) : (
            "Save Bailu proxy pool"
          )}
        </Button>
        {hasPartialProxy ? (
          <p className="text-[10px] text-amber-200">Complete or remove every partial proxy before saving.</p>
        ) : (
          <p className="text-[10px] text-[#858697]">
            {completeCount}/3 complete direct-proxy slot{completeCount === 1 ? "" : "s"}. Saved passwords remain masked.
          </p>
        )}
      </div>
      <p className="mt-4 border-t border-white/8 pt-4 text-[10px] leading-5 text-[#858697]">
        Changes are encrypted at rest and restricted to the administrator session. Disable the pool to make Bailu use
        its direct provider path again. This does not change any other provider’s network route.
      </p>
    </section>
  );
}

export function BailuWebshareProxyUrlImporter() {
  const utils = trpc.useUtils();
  const settings = trpc.admin.bailuWebshareProxyPoolSettings.useQuery();
  const [directProxyUrl, setDirectProxyUrl] = useState("");
  const importSlot = trpc.admin.updateBailuWebshareProxyPoolSettings.useMutation({
    onSuccess: async () => {
      setDirectProxyUrl("");
      await Promise.all([
        utils.admin.bailuWebshareProxyPoolSettings.invalidate(),
        utils.admin.activity.invalidate(),
      ]);
      toast.success("Bailu Direct proxy added securely");
    },
    onError: (error) => toast.error(error.message),
  });
  const existing = settings.data?.proxies ?? [];
  const disabled = settings.isLoading || importSlot.isPending;
  const canImport = Boolean(directProxyUrl.trim()) && existing.length < 3;

  return (
    <section className="dashboard-card">
      <SectionHeader
        icon={<ShieldAlert size={17} />}
        title="Add Bailu Direct proxy by URL"
        detail="Paste one complete Webshare Direct proxy URL. TokenForge parses it only in the protected server procedure and stores only encrypted connection fields."
      />
      <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
        <label className="text-[10px] font-semibold text-[#dedfe7]">
          Complete Direct proxy URL
          <Input
            type="password"
            value={directProxyUrl}
            onChange={(event) => setDirectProxyUrl(event.target.value)}
            placeholder="Paste the complete Direct proxy URL"
            autoComplete="new-password"
            className="mt-2 border-white/10 bg-black/15 font-mono text-xs placeholder:text-[#9294a4]"
            disabled={disabled}
          />
        </label>
        <Button
          type="button"
          className="self-end bg-[#c9ff73] text-[#17210d] hover:bg-[#d8ff91]"
          onClick={() =>
            importSlot.mutate({
              enabled: settings.data?.enabled ?? true,
              proxies: [
                ...existing.map((proxy) => ({
                  id: proxy.id,
                  label: proxy.label,
                  host: proxy.host,
                  port: proxy.port,
                  enabled: proxy.enabled,
                })),
                {
                  id: `webshare-${Date.now()}-${existing.length + 1}`,
                  label: `Webshare proxy ${existing.length + 1}`,
                  proxyUrl: directProxyUrl,
                  enabled: true,
                },
              ],
            })
          }
          disabled={!canImport || disabled}
        >
          {importSlot.isPending ? (
            <>
              <Loader2 className="animate-spin" size={14} />
              Adding…
            </>
          ) : (
            "Parse & add proxy"
          )}
        </Button>
      </div>
      <p className="mt-3 text-[10px] leading-5 text-[#858697]">
        The complete URL is masked while entered, is never rendered after submission, and is not written to
        browser-visible settings. You can still edit individual fields below. {existing.length}/3 slots are
        configured.
      </p>
    </section>
  );
}

export function BailuWebshareProxySlotHealth({ settings }: { settings?: BailuWebshareProxySettingsData }) {
  const slots = settings?.proxies ?? [];
  const healthClass = {
    healthy: "text-[#c9ff73]",
    degraded: "text-amber-100",
    "cooling-down": "text-amber-200",
    disabled: "text-[#858697]",
  } as const;

  return (
    <section className="dashboard-card">
      <SectionHeader
        icon={<Activity size={17} />}
        title="Bailu proxy-slot health"
        detail="Live request and cooldown state for Bailu-only egress slots. A transport, timeout, or interrupted stream pauses only the affected slot for one minute."
      />
      <div className="mt-5 grid gap-3 xl:grid-cols-3">
        {slots.length ? (
          slots.map((slot, index) => {
            const metrics = slot.metrics;
            const coolingDown = Boolean(
              metrics.cooldownUntil && new Date(metrics.cooldownUntil).getTime() > Date.now()
            );
            return (
              <article key={slot.id} className="rounded-xl border border-white/8 bg-black/15 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold text-[#dedfe7]">
                      Slot {index + 1} · {slot.label}
                    </p>
                    <p className={`mt-1 font-mono text-[10px] font-semibold ${healthClass[metrics.health]}`}>
                      {coolingDown
                        ? "Cooling down"
                        : metrics.health === "degraded"
                        ? "Degraded"
                        : metrics.health === "disabled"
                        ? "Disabled"
                        : "Healthy"}
                    </p>
                  </div>
                  <Badge className="border-0 bg-white/6 font-mono text-[9px] text-[#d6d7e0]">
                    {metrics.activeRequests} active
                  </Badge>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-2 font-mono text-[9px] tabular-nums">
                  <p className="text-[#d6d7e0]">
                    {metrics.requestCount.toLocaleString()} <span className="text-[#858697]">requests</span>
                  </p>
                  <p className="text-[#c9ff73]">
                    {metrics.successCount.toLocaleString()} <span className="text-[#858697]">success</span>
                  </p>
                  <p className={metrics.failureCount ? "text-amber-200" : "text-[#a9aab8]"}>
                    {metrics.failureCount.toLocaleString()} <span className="text-[#858697]">failures</span>
                  </p>
                  <p className={metrics.timeoutCount ? "text-amber-200" : "text-[#a9aab8]"}>
                    {metrics.timeoutCount.toLocaleString()} <span className="text-[#858697]">timeouts</span>
                  </p>
                </div>
                {coolingDown && metrics.cooldownUntil ? (
                  <p className="mt-3 rounded-lg border border-amber-300/15 bg-amber-300/5 px-2 py-1.5 text-[9px] leading-4 text-amber-100">
                    Paused automatically until {new Date(metrics.cooldownUntil).toLocaleTimeString()} after{" "}
                    {metrics.lastFailureKind ?? "transport"} failure.
                  </p>
                ) : metrics.lastFailureAt ? (
                  <p className="mt-3 text-[9px] leading-4 text-[#858697]">
                    Latest failure: {metrics.lastFailureKind ?? "transport"} ·{" "}
                    {new Date(metrics.lastFailureAt).toLocaleTimeString()}
                  </p>
                ) : (
                  <p className="mt-3 text-[9px] leading-4 text-[#858697]">No slot failure has been recorded.</p>
                )}
              </article>
            );
          })
        ) : (
          <div className="grid min-h-28 place-items-center rounded-xl border border-dashed border-white/10 px-5 text-center text-[10px] leading-5 text-[#858697]">
            Configure at least one Bailu Direct proxy slot to start slot-level health telemetry.
          </div>
        )}
      </div>
      <p className="mt-4 border-t border-white/8 pt-4 text-[10px] leading-5 text-[#858697]">
        Metrics refresh every five seconds. Stored values never include proxy credentials, upstream URLs, request
        content, or client identity.
      </p>
    </section>
  );
}

export function BailuWebshareProxyPool() {
  const utils = trpc.useUtils();
  const settings = trpc.admin.bailuWebshareProxyPoolSettings.useQuery(undefined, {
    refetchInterval: 5_000,
    refetchIntervalInBackground: false,
  });
  const [enabled, setEnabled] = useState(false);
  const [drafts, setDrafts] = useState<BailuWebshareProxyDraft[]>([]);

  useEffect(() => {
    if (!settings.data) return;
    setEnabled(settings.data.enabled);
    setDrafts(
      settings.data.proxies.map((proxy) => ({
        id: proxy.id,
        label: proxy.label,
        host: proxy.host,
        port: String(proxy.port),
        username: "",
        password: "",
        enabled: proxy.enabled,
      }))
    );
  }, [settings.data]);

  const save = trpc.admin.updateBailuWebshareProxyPoolSettings.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.admin.bailuWebshareProxyPoolSettings.invalidate(),
        utils.admin.activity.invalidate(),
      ]);
      toast.success("Bailu Webshare proxy pool updated");
    },
    onError: (error) => toast.error(error.message),
  });

  return (
    <>
      <BailuWebshareProxyPoolPanel
        enabled={enabled}
        drafts={drafts}
        settings={settings.data as BailuWebshareProxySettingsData | undefined}
        loading={settings.isLoading}
        saving={save.isPending}
        onEnabledChange={setEnabled}
        onDraftsChange={setDrafts}
        onSave={() =>
          save.mutate({
            enabled,
            proxies: drafts
              .filter((proxy) => proxy.host.trim() || proxy.port.trim() || proxy.username || proxy.password)
              .map((proxy) => ({
                id: proxy.id,
                label: proxy.label,
                host: proxy.host.trim(),
                port: Number(proxy.port),
                username: proxy.username || undefined,
                password: proxy.password || undefined,
                enabled: proxy.enabled,
              })),
          })
        }
      />
      <BailuWebshareProxySlotHealth settings={settings.data as BailuWebshareProxySettingsData | undefined} />
    </>
  );
}

export function BaiProviderCircuitPanel() {
  const utils = trpc.useUtils();
  const settings = trpc.admin.claudeOpus5ProviderSettings.useQuery(undefined, {
    refetchInterval: 5_000,
    refetchIntervalInBackground: false,
  });
  const setPriority = trpc.admin.setClaudeOpus5BaiPriority.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.admin.claudeOpus5ProviderSettings.invalidate(),
        utils.admin.overview.invalidate(),
      ]);
      toast.success("b.ai priority routing updated");
    },
    onError: (error) => toast.error(error.message),
  });

  const baiProviders =
    (settings.data?.providers as ClaudeOpus5ProviderSettingsData[] | undefined)?.filter(
      (provider) => provider.label.trim().toLowerCase() === "b.ai"
    ) ?? [];
  const isPriority = settings.data?.baiPriority === true;

  if (!baiProviders.length && !settings.data) return null;

  return (
    <section className="dashboard-card">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SectionHeader
          icon={<Activity size={17} />}
          title="b.ai Routing & Priority Control"
          detail="Give b.ai priority for Claude Opus 5 requests. If b.ai fails more than 3 consecutive times, requests automatically failover to other providers. Circuit breaker pause has been removed."
        />
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-xs font-semibold text-[#dedfe7]">b.ai Priority Routing</p>
            <p className="text-[10px] text-[#858697]">
              {isPriority ? "Priority Enabled (Routes 1st to b.ai)" : "Disabled (Normal balanced rotation)"}
            </p>
          </div>
          <Toggle
            label="b.ai Priority"
            enabled={isPriority}
            pending={setPriority.isPending}
            onChange={(enabled) => setPriority.mutate({ enabled })}
          />
        </div>
      </div>
      <div className="mt-5 grid gap-3 xl:grid-cols-2">
        {baiProviders.map((provider) => (
          <article key={provider.id} className="rounded-xl border border-white/8 bg-black/15 p-4">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-semibold text-[#dedfe7]">{provider.label}</p>
              <Badge
                className={`border text-[9px] ${
                  isPriority
                    ? "border-[#c9ff73]/20 bg-[#c9ff73]/10 text-[#c9ff73]"
                    : "border-white/10 bg-white/5 text-[#a9aab8]"
                }`}
              >
                {isPriority ? "Priority Route Active" : "Normal Rotation"}
              </Badge>
            </div>
            <BaiProviderCircuitHealth status={provider.baiCircuit} isPriority={isPriority} />
          </article>
        ))}
      </div>
      <p className="mt-4 border-t border-white/8 pt-4 text-[10px] leading-5 text-[#858697]">
        {isPriority
          ? "Priority is ON: First request and most traffic route directly to b.ai. If b.ai encounters >3 consecutive failures, TokenForge automatically falls back to secondary providers until b.ai recovers."
          : "Priority is OFF: Traffic rotates evenly across all configured and enabled Claude Opus 5 providers. Circuit breaker pause is disabled."}
      </p>
    </section>
  );
}

export function RenderNimProxySwarmPanel(props: any) {
  void props;
  const failureLogs = trpc.admin.claudeOpus5FailureLogs.useQuery(undefined, {
    refetchInterval: 5_000,
    refetchIntervalInBackground: false,
  });
  return (
    <>
      <BailuWebshareProxyUrlImporter />
      <BailuWebshareProxyPool />
      <BaiProviderCircuitPanel />
      <ClaudeOpus5ModelPoolPanel />
      <ClaudeOpus5QwenFailureHistory />
      <ClaudeOpus5FailureHistory
        logs={failureLogs.data as any}
        loading={failureLogs.isLoading}
      />
    </>
  );
}

export function ManagedProviderSettingsPanel({
  providerName,
  providerId,
  detail,
  identityNote,
  baseUrl,
  model,
  apiKeys,
  apiKeyEnabled,
  removedSlots,
  settings,
  metrics,
  loading,
  saving,
  onBaseUrlChange,
  onModelChange,
  onKeysChange,
  onApiKeyEnabledChange,
  onRemovedSlotsChange,
  onSave,
}: {
  providerName: string;
  providerId: string;
  detail: string;
  identityNote: string;
  baseUrl: string;
  model: string;
  apiKeys: string[];
  apiKeyEnabled?: boolean[];
  removedSlots: number[];
  settings?: ManagedProviderSettingsData;
  metrics?: ManagedProviderKeyMetricGroup;
  loading: boolean;
  saving: boolean;
  onBaseUrlChange: (value: string) => void;
  onModelChange: (value: string) => void;
  onKeysChange: (next: string[]) => void;
  onApiKeyEnabledChange?: (next: boolean[]) => void;
  onRemovedSlotsChange: (next: number[]) => void;
  onSave: () => void;
}) {
  const disabled = loading || saving;
  if (providerId === "fable")
    return (
      <>
        <ClaudeFable5ProviderBalancerPanel metrics={metrics} />
        <ManagedModelFailureHistory model="claude-fable-5.1" title="Claude Fable 5.1" />
      </>
    );
  if (providerId === "deepseek-v4-pro")
    return (
      <>
        <DeepseekV4ProProviderBalancerPanel metrics={metrics} />
        <ManagedModelFailureHistory model="deepseek-v4-pro" title="DeepSeek V4 Pro" />
      </>
    );

  return (
    <section className="dashboard-card">
      <SectionHeader icon={<KeyRound size={17} />} title={`${providerName} runtime settings`} detail={detail} />
      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(18rem,.8fr)]">
        <div className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-[#dedfe7]" htmlFor={`${providerId}-base-url`}>
              Base URL
            </label>
            <Input
              id={`${providerId}-base-url`}
              value={baseUrl}
              onChange={(event) => onBaseUrlChange(event.target.value)}
              className="mt-2 border-white/10 bg-black/15 font-mono text-xs"
              disabled={disabled}
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-[#dedfe7]" htmlFor={`${providerId}-model`}>
              Upstream model ID
            </label>
            <Input
              id={`${providerId}-model`}
              value={model}
              onChange={(event) => onModelChange(event.target.value)}
              className="mt-2 border-white/10 bg-black/15 font-mono text-xs"
              disabled={disabled}
            />
          </div>
          {(() => {
            const activeMasks = (settings?.apiKeyMasks ?? []).filter((mask) => !removedSlots.includes(mask.slot));
            return (
              <DynamicProviderKeyPool
                providerName={providerName}
                values={apiKeys}
                masks={activeMasks}
                enabledStates={apiKeyEnabled ?? activeMasks.map((item) => item.enabled !== false)}
                disabled={disabled}
                onChange={(index, value) =>
                  onKeysChange(apiKeys.map((key, slot) => (slot === index ? value : key)))
                }
                onEnabledChange={(index, enabled) =>
                  onApiKeyEnabledChange?.(
                    apiKeys.map((_, slot) => (slot === index ? enabled : apiKeyEnabled?.[slot] !== false))
                  )
                }
                onRemove={(index) => {
                  const removedSlot = activeMasks[index]?.slot;
                  if (removedSlot)
                    onRemovedSlotsChange(
                      removedSlots.includes(removedSlot) ? removedSlots : [...removedSlots, removedSlot]
                    );
                  onKeysChange(apiKeys.filter((_, slot) => slot !== index));
                  onApiKeyEnabledChange?.(
                    apiKeys
                      .filter((_, slot) => slot !== index)
                      .map((_, slot) => apiKeyEnabled?.[slot >= index ? slot + 1 : slot] !== false)
                  );
                }}
                onAdd={() => onKeysChange([...apiKeys, ""])}
              />
            );
          })()}
          <Button
            onClick={onSave}
            disabled={saving || !baseUrl.trim() || !model.trim()}
            className="bg-[#c9ff73] text-[#17210d] hover:bg-[#d8ff91]"
          >
            {saving ? (
              <>
                <Loader2 className="animate-spin" size={14} />
                Saving…
              </>
            ) : (
              "Save provider settings"
            )}
          </Button>
        </div>
        <div className="rounded-xl border border-white/8 bg-black/15 p-4">
          <p className="text-[10px] font-bold uppercase tracking-[.13em] text-[#858697]">
            Current backend configuration
          </p>
          <Badge className="mt-3 border-0 bg-white/6 text-[10px] text-[#d5d6df]">
            {settings?.source === "database" ? "Admin-managed override" : "Environment default"}
          </Badge>
          <dl className="mt-5 space-y-4 text-xs">
            <div>
              <dt className="text-[#858697]">Base URL</dt>
              <dd className="mt-1 break-all font-mono text-[#e6e6ee]">{settings?.baseUrl ?? "Loading…"}</dd>
            </div>
            <div>
              <dt className="text-[#858697]">Model ID</dt>
              <dd className="mt-1 break-all font-mono text-[#e6e6ee]">{settings?.model ?? "Loading…"}</dd>
            </div>
            <div>
              <dt className="text-[#858697]">Credential slots</dt>
              <dd className="mt-2 space-y-1">
                {settings?.apiKeyMasks.map((item) => (
                  <p
                    key={item.slot}
                    className={`font-mono ${item.enabled ? "text-[#c9ff73]" : "text-[#858697]"}`}
                  >
                    Key {item.slot}: {item.value} · {item.enabled ? "enabled" : "disabled"}
                  </p>
                )) ?? <p className="text-[#858697]">Loading…</p>}
              </dd>
            </div>
          </dl>
          <ManagedProviderKeyMetrics providerName={providerName} metrics={metrics} />
          <p className="mt-5 border-t border-white/8 pt-4 text-[10px] leading-5 text-[#858697]">
            Partial saves preserve untouched settings. Disable a key to retain it securely while excluding it from
            routing; removing a key permanently deletes it. {identityNote}
          </p>
        </div>
      </div>
    </section>
  );
}

export function ClaudeOpus5ProviderBalancerPanelWrapper({
  metrics,
}: {
  metrics?: ManagedProviderKeyMetricGroup;
}) {
  const utils = trpc.useUtils();
  const settings = trpc.admin.claudeOpus5ProviderSettings.useQuery(undefined, {
    refetchInterval: 5_000,
    refetchIntervalInBackground: false,
  });
  const [drafts, setDrafts] = useState<ClaudeOpus5ProviderDraft[]>([]);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (!settings.data || initialized) return;
    setDrafts(
      settings.data.providers.map((provider) => ({
        id: provider.id,
        label: provider.label,
        enabled: provider.enabled,
        baseUrl: provider.baseUrl,
        model: provider.model,
        maxInputTokens: provider.maxInputTokens ?? "",
        maxOutputTokens: (provider as { maxOutputTokens?: number }).maxOutputTokens ?? "",
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
    setInitialized(true);
  }, [initialized, settings.data]);

  const save = trpc.admin.updateClaudeOpus5ProviderSettings.useMutation({
    onSuccess: async () => {
      setInitialized(false);
      await Promise.all([
        utils.admin.claudeOpus5ProviderSettings.invalidate(),
        utils.admin.overview.invalidate(),
        utils.admin.activity.invalidate(),
      ]);
      toast.success("Claude Opus 5 load balancer updated");
    },
    onError: (error) => toast.error(error.message),
  });

  return (
    <>
      <ClaudeOpus5ProviderBalancerPanel
        providerName="Claude Opus 5"
        modelId="claude-opus-5"
        drafts={drafts}
        settings={settings.data as ClaudeOpus5SettingsData | undefined}
        metrics={metrics}
        loading={settings.isLoading}
        saving={save.isPending}
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
              baseUrl: "",
              model: "",
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
          save.mutate({
            providers: updatedDrafts.map((draft) => ({
              ...draft,
              removeSlots: draft.removedSlots,
              maxInputTokens: draft.maxInputTokens !== undefined && draft.maxInputTokens !== "" ? Number(draft.maxInputTokens) : null,
              maxOutputTokens: draft.maxOutputTokens !== undefined && draft.maxOutputTokens !== "" ? Number(draft.maxOutputTokens) : null,
              pinnedUserEmails: draft.pinnedUserEmails ?? [],
              reasoningEffort: draft.reasoningEffort ? (draft.reasoningEffort as any) : null,
            })),
          })
        }
        onSave={() =>
          save.mutate({
            providers: drafts.map((draft) => ({
              ...draft,
              removeSlots: draft.removedSlots,
              maxInputTokens: draft.maxInputTokens !== undefined && draft.maxInputTokens !== "" ? Number(draft.maxInputTokens) : null,
              maxOutputTokens: draft.maxOutputTokens !== undefined && draft.maxOutputTokens !== "" ? Number(draft.maxOutputTokens) : null,
              pinnedUserEmails: draft.pinnedUserEmails ?? [],
              reasoningEffort: draft.reasoningEffort ? (draft.reasoningEffort as any) : null,
            })),
          })
        }
      />
      <ClaudeOpus5ModelPoolPanel />
      <BaiProviderCircuitPanel />
      <BailuWebshareProxyPool />
      <ManagedModelFailureHistory model="claude-opus-5" title="Claude Opus 5" />
    </>
  );
}

export function Glm53ProviderSettingsPanel({
  metrics,
}: {
  metrics?: ManagedProviderKeyMetricGroup;
}) {
  const utils = trpc.useUtils();
  const settings = trpc.admin.glm53ProviderSettings.useQuery(undefined, {
    refetchInterval: 5_000,
    refetchIntervalInBackground: false,
  });
  const [drafts, setDrafts] = useState<ClaudeOpus5ProviderDraft[]>([]);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (!settings.data || initialized) return;
    setDrafts(
      settings.data.providers.map((provider) => ({
        id: provider.id,
        label: provider.label,
        enabled: provider.enabled,
        baseUrl: provider.baseUrl,
        model: provider.model,
        maxInputTokens: (provider as { maxInputTokens?: number }).maxInputTokens ?? "",
        maxOutputTokens: (provider as { maxOutputTokens?: number }).maxOutputTokens ?? "",
        disableIdentityPrompt: provider.disableIdentityPrompt ?? false,
        bypassCooldown: provider.bypassCooldown ?? false,
        supportsVision: provider.supportsVision ?? false,
        supportsDocuments: provider.supportsDocuments ?? false,
        pinnedUserEmails: provider.pinnedUserEmails ?? [],
        apiKeys: provider.apiKeyMasks.length ? provider.apiKeyMasks.map(() => "") : [""],
        apiKeyEnabled: provider.apiKeyMasks.length
          ? provider.apiKeyMasks.map((item) => item.enabled !== false)
          : [true],
        removedSlots: [],
      }))
    );
    setInitialized(true);
  }, [initialized, settings.data]);

  const save = trpc.admin.updateGlm53ProviderSettings.useMutation({
    onSuccess: async () => {
      setInitialized(false);
      await Promise.all([
        utils.admin.glm53ProviderSettings.invalidate(),
        utils.admin.overview.invalidate(),
        utils.admin.activity.invalidate(),
      ]);
      toast.success("GLM 5.3 load balancer updated");
    },
    onError: (error) => toast.error(error.message),
  });

  return (
    <>
      <ClaudeOpus5ProviderBalancerPanel
        providerName="GLM 5.3"
        modelId="glm-5.3"
        drafts={drafts}
        settings={settings.data as ClaudeOpus5SettingsData | undefined}
        metrics={metrics}
        loading={settings.isLoading}
        saving={save.isPending}
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
              baseUrl: "",
              model: "",
              apiKeys: [""],
              removedSlots: [],
              maxInputTokens: "",
              maxOutputTokens: "",
              disableIdentityPrompt: false,
              bypassCooldown: false,
              supportsVision: false,
              supportsDocuments: false,
              pinnedUserEmails: [],
            },
          ])
        }
        onRemoveProvider={(id) => setDrafts((current) => current.filter((draft) => draft.id !== id))}
        onInstantSave={(updatedDrafts) =>
          save.mutate({
            providers: updatedDrafts.map((draft) => ({
              ...draft,
              removeSlots: draft.removedSlots,
              maxInputTokens: draft.maxInputTokens !== undefined && draft.maxInputTokens !== "" ? Number(draft.maxInputTokens) : null,
              maxOutputTokens: draft.maxOutputTokens !== undefined && draft.maxOutputTokens !== "" ? Number(draft.maxOutputTokens) : null,
              pinnedUserEmails: draft.pinnedUserEmails ?? [],
            })),
          })
        }
        onSave={() =>
          save.mutate({
            providers: drafts.map((draft) => ({
              ...draft,
              removeSlots: draft.removedSlots,
              maxInputTokens: draft.maxInputTokens !== undefined && draft.maxInputTokens !== "" ? Number(draft.maxInputTokens) : null,
              maxOutputTokens: draft.maxOutputTokens !== undefined && draft.maxOutputTokens !== "" ? Number(draft.maxOutputTokens) : null,
              pinnedUserEmails: draft.pinnedUserEmails ?? [],
            })),
          })
        }
      />
      <ManagedModelFailureHistory model="glm-5.3" title="GLM 5.3" />
    </>
  );
}

export function AllProviderKeyMetricsOverviewPanel({
  keyMetrics,
}: {
  keyMetrics: ManagedProviderKeyMetricGroup[];
}) {
  const modelLabels: Record<string, string> = {
    "claude-opus-5": "Claude Opus 5",
    "claude-sonnet-4.6": "Claude Sonnet 4.6",
    "claude-fable-5.1": "Claude Fable 5.1",
    "deepseek-v4-pro": "DeepSeek V4 Pro",
    "glm-5.3": "GLM 5.3",
    "qwen3.8-max": "Qwen 3.8 Max",
    "qwen3.8-27b": "Qwen 3.8 27B",
    "gpt-6-astra": "GPT-6 Astra",
    "kimi-k3": "Kimi K3",
  };

  const totalSlots = keyMetrics.reduce(
    (acc, group) =>
      acc +
      (group.slots?.length ?? 0) +
      (group.providers?.reduce((pAcc, p) => pAcc + (p.slots?.length ?? 0), 0) ?? 0),
    0
  );

  const totalRequests = keyMetrics.reduce(
    (acc, group) =>
      acc +
      (group.slots?.reduce((sAcc, s) => sAcc + s.requestCount, 0) ?? 0) +
      (group.providers?.reduce(
        (pAcc, p) => pAcc + (p.slots?.reduce((psAcc, ps) => psAcc + ps.requestCount, 0) ?? 0),
        0
      ) ?? 0),
    0
  );

  const totalHealthy = keyMetrics.reduce(
    (acc, group) =>
      acc +
      (group.slots?.reduce((sAcc, s) => sAcc + s.successCount, 0) ?? 0) +
      (group.providers?.reduce(
        (pAcc, p) => pAcc + (p.slots?.reduce((psAcc, ps) => psAcc + ps.successCount, 0) ?? 0),
        0
      ) ?? 0),
    0
  );

  const totalFailures = keyMetrics.reduce(
    (acc, group) =>
      acc +
      (group.slots?.reduce((sAcc, s) => sAcc + s.failureCount, 0) ?? 0) +
      (group.providers?.reduce(
        (pAcc, p) => pAcc + (p.slots?.reduce((psAcc, ps) => psAcc + ps.failureCount, 0) ?? 0),
        0
      ) ?? 0),
    0
  );

  return (
    <div className="space-y-4">
      <section className="dashboard-card">
        <SectionHeader
          icon={<Gauge size={17} />}
          title="Provider & Key Metrics Overview"
          detail="Live per-model and per-provider credential health, durable request counters, success/failure distribution, and circuit cooldowns."
        />
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-xl border border-white/8 bg-black/20 p-3">
            <p className="text-[10px] uppercase tracking-wider text-[#858697]">Active Key Slots</p>
            <p className="mt-1 font-mono text-lg font-bold text-white">{totalSlots}</p>
          </div>
          <div className="rounded-xl border border-white/8 bg-black/20 p-3">
            <p className="text-[10px] uppercase tracking-wider text-[#858697]">Total Requests</p>
            <p className="mt-1 font-mono text-lg font-bold text-white">{totalRequests.toLocaleString()}</p>
          </div>
          <div className="rounded-xl border border-white/8 bg-black/20 p-3">
            <p className="text-[10px] uppercase tracking-wider text-[#858697]">Successful Inferences</p>
            <p className="mt-1 font-mono text-lg font-bold text-[#c9ff73]">{totalHealthy.toLocaleString()}</p>
          </div>
          <div className="rounded-xl border border-white/8 bg-black/20 p-3">
            <p className="text-[10px] uppercase tracking-wider text-[#858697]">Recorded Failures</p>
            <p className={`mt-1 font-mono text-lg font-bold ${totalFailures ? "text-amber-300" : "text-[#858697]"}`}>
              {totalFailures.toLocaleString()}
            </p>
          </div>
        </div>
      </section>

      {keyMetrics.map((group) => {
        const title = modelLabels[group.modelId] || group.modelId;
        return (
          <section key={group.modelId} className="dashboard-card">
            <div className="flex items-center justify-between border-b border-white/8 pb-3">
              <div>
                <h3 className="text-sm font-bold text-white">{title}</h3>
                <p className="font-mono text-[10px] text-[#858697]">{group.modelId}</p>
              </div>
              <Badge className="border-0 bg-[#c9ff73]/10 font-mono text-[10px] text-[#c9ff73]">
                {group.providers?.length
                  ? `${group.providers.length} provider groups`
                  : `${group.slots?.length ?? 0} credential slots`}
              </Badge>
            </div>
            <div className="mt-4">
              <ManagedProviderKeyMetrics providerName={title} metrics={group} />
            </div>
          </section>
        );
      })}
    </div>
  );
}
