import React, { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Clock, Plus, Trash2 } from "lucide-react";
import { ManagedKeyMask, ManagedProviderKeyMetricGroup, ManagedProviderKeyMetric } from "../types";
import { Toggle } from "../common/AdminCommon";

export function useRemainingSeconds(cooldownUntil: string | Date | null | undefined): number {
  const getDiff = () => {
    if (!cooldownUntil) return 0;
    const diff = new Date(cooldownUntil).getTime() - Date.now();
    return diff > 0 ? Math.ceil(diff / 1000) : 0;
  };

  const [remaining, setRemaining] = useState<number>(getDiff);

  useEffect(() => {
    setRemaining(getDiff());
    if (!cooldownUntil) return;
    const interval = setInterval(() => {
      const next = getDiff();
      setRemaining(next);
      if (next <= 0) clearInterval(interval);
    }, 1000);
    return () => clearInterval(interval);
  }, [cooldownUntil]);

  return remaining;
}

function KeyRowCooldownBadge({ cooldownUntil }: { cooldownUntil?: Date | string | null }) {
  const remaining = useRemainingSeconds(cooldownUntil);
  if (remaining <= 0) return null;
  return (
    <span className="inline-flex items-center gap-1 rounded border border-amber-400/40 bg-amber-400/15 px-2 py-0.5 font-mono text-[9px] font-bold text-amber-200">
      <span className="relative flex h-1.5 w-1.5">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-amber-500" />
      </span>
      ⏳ {remaining}s CD
    </span>
  );
}

export function DynamicProviderKeyPool({
  providerName,
  values,
  masks,
  enabledStates,
  keyMetrics,
  onChange,
  onEnabledChange,
  onRemove,
  onAdd,
  disabled,
  minKeys = 1,
}: {
  providerName: string;
  values: string[];
  masks: ManagedKeyMask[];
  enabledStates?: boolean[];
  keyMetrics?: ManagedProviderKeyMetric[];
  onChange: (index: number, value: string) => void;
  onEnabledChange?: (index: number, enabled: boolean) => void;
  onRemove: (index: number) => void;
  onAdd: () => void;
  disabled?: boolean;
  minKeys?: number;
}) {
  const requiredKeyCount = providerName === "Claude Opus Qwen" ? Math.max(2, minKeys) : minKeys;
  const canRemove = values.length > 0;
  const isUnorouter = providerName.toLowerCase().includes("unorouter");
  const [localEnabledStates, setLocalEnabledStates] = useState<boolean[]>(() =>
    masks.map((item) => item.enabled !== false)
  );

  const keyIsEnabled = (index: number) =>
    enabledStates?.[index] ?? localEnabledStates[index] ?? masks[index]?.enabled !== false;

  const enabledCount = values.filter((_, index) => keyIsEnabled(index)).length;

  const updateEnabled = (index: number, enabled: boolean) => {
    onEnabledChange?.(index, enabled);
    setLocalEnabledStates((current) =>
      values.map((_, slot) =>
        slot === index ? enabled : current[slot] ?? masks[slot]?.enabled !== false
      )
    );
    window.dispatchEvent(
      new CustomEvent("tokenforge-key-routing-state", { detail: { providerName, index, enabled } })
    );
  };

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <p className="text-xs font-semibold text-[#dedfe7]">API keys</p>
            {isUnorouter && (
              <Badge className="border border-amber-400/40 bg-amber-400/15 text-[9px] text-amber-200">
                1 req / 1 min per key
              </Badge>
            )}
          </div>
          <p className="mt-1 text-[10px] leading-5 text-[#858697]">
            {isUnorouter
              ? "Each API key handles at most 1 in-flight request. When a request completes, a 60-second cooldown timer is applied before it becomes eligible again."
              : "Enabled keys rotate in round-robin. Turn off a key to preserve it securely while excluding it from new calls and failover; use the bin only to permanently remove it."}
          </p>
        </div>
        <Badge className="border-0 bg-[#c9ff73]/10 text-[10px] text-[#c9ff73]">
          {enabledCount}/{values.length} enabled
        </Badge>
      </div>

      {isUnorouter && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-[11px] text-amber-200">
          <div className="flex items-center gap-2">
            <Clock size={14} className="text-amber-300 shrink-0" />
            <span className="font-semibold text-amber-300">1 Request / 1 Minute Per-Key Rule Active</span>
          </div>
          <span className="font-mono text-[10px] text-amber-200/80">
            60s cooldown applied per key on request completion
          </span>
        </div>
      )}

      <div className="mt-3 grid gap-2">
        {values.map((value, index) => {
          const enabled = keyIsEnabled(index);
          const capacity = masks[index]?.maxActiveRequests;
          const slotMetric = keyMetrics?.find((m) => m.slot === index + 1);
          return (
            <div
              key={`${masks[index]?.slot ?? "new"}-${index}`}
              className={`grid gap-2 rounded-lg border p-2 sm:grid-cols-[5.5rem_minmax(0,1fr)_auto_6.5rem_4.75rem_2.25rem] sm:items-center ${
                enabled ? "border-white/8 bg-black/10" : "border-white/5 bg-black/25 opacity-75"
              }`}
            >
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-bold uppercase tracking-[.12em] text-[#858697]">
                  Key {index + 1}
                </span>
              </div>
              <Input
                type="password"
                value={value}
                onChange={(event) => onChange(index, event.target.value)}
                placeholder={masks[index]?.value ?? "Enter a new server-only API key"}
                className="border-white/10 bg-black/15 font-mono text-xs placeholder:text-[#9b9dac]"
                autoComplete="new-password"
                disabled={disabled}
              />
              <div className="flex items-center">
                <KeyRowCooldownBadge cooldownUntil={slotMetric?.cooldownUntil} />
              </div>
              {capacity ? (
                <div className="rounded-md border border-sky-300/15 bg-sky-300/[.045] px-2 py-1 font-mono text-[9px] leading-4 text-sky-100">
                  <p>
                    {masks[index]?.activeRequests ?? 0}/{capacity} active
                  </p>
                  <p className="text-sky-200/70">{masks[index]?.remainingRequests ?? capacity} left</p>
                </div>
              ) : <div />}
              <Toggle
                label={`${providerName} API key ${index + 1}`}
                enabled={enabled}
                pending={disabled}
                onChange={(next) => updateEnabled(index, next)}
              />
              <Button
                type="button"
                size="icon"
                variant="outline"
                className="h-9 border-red-300/20 text-red-200 hover:bg-red-400/10 hover:text-red-100"
                aria-label={`Remove ${providerName} API key ${index + 1}`}
                title={
                  canRemove
                    ? `Remove key ${index + 1}`
                    : `No keys to remove`
                }
                onClick={() => {
                  onRemove(index);
                  window.dispatchEvent(
                    new CustomEvent("tokenforge-key-routing-state", {
                      detail: { providerName, index, action: "remove" },
                    })
                  );
                }}
                disabled={disabled || !canRemove}
              >
                <Trash2 size={14} />
              </Button>
            </div>
          );
        })}
      </div>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="mt-3 border-[#c9ff73]/25 text-[#c9ff73] hover:bg-[#c9ff73]/10 hover:text-[#d8ff91]"
        onClick={onAdd}
        disabled={disabled || values.length >= 100}
      >
        <Plus size={14} /> Add API key
      </Button>
      <p className="mt-3 text-[10px] leading-5 text-[#858697]">
        Key changes, including enablement, take effect only after you save this provider configuration.
      </p>
    </div>
  );
}

function SlotMetricCard({
  item,
  providerName,
  maxRequests,
  healthStyle,
  isUnorouter,
}: {
  item: ManagedProviderKeyMetric;
  providerName: string;
  maxRequests: number;
  healthStyle: Record<string, string>;
  isUnorouter: boolean;
}) {
  const remaining = useRemainingSeconds(item.cooldownUntil);

  return (
    <div key={`${providerName}-${item.slot}`} className="rounded-lg border border-white/8 bg-black/10 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-mono text-[10px] font-semibold text-[#e6e6ee]">
          Key {item.slot} · {item.keyMask}
        </p>
        <Badge
          className={`border text-[9px] font-mono ${
            remaining > 0
              ? "border-amber-400/40 bg-amber-400/15 text-amber-200"
              : healthStyle[item.health] ?? healthStyle.unknown
          }`}
        >
          {remaining > 0 ? (
            <span className="flex items-center gap-1">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-amber-500" />
              </span>
              ⏳ Cooldown: {remaining}s
            </span>
          ) : item.health === "cooling-down" ? (
            "Cooling down"
          ) : item.health === "healthy" ? (
            "Healthy"
          ) : item.health === "unverified" ? (
            "Awaiting first request"
          ) : (
            "Unknown"
          )}
        </Badge>
      </div>

      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/8" aria-hidden="true">
        <div
          className="h-full min-w-1 rounded-full bg-gradient-to-r from-[#4c7e22] to-[#c9ff73]"
          style={{ width: `${Math.max(2, (item.requestCount / maxRequests) * 100)}%` }}
        />
      </div>

      <div className="mt-2 grid grid-cols-3 gap-2 font-mono text-[9px] tabular-nums">
        <p className="text-[#d6d7e0]">
          {item.requestCount.toLocaleString()} <span className="text-[#858697]">requests</span>
        </p>
        <p className="text-[#c9ff73]">
          {item.successCount.toLocaleString()} <span className="text-[#858697]">healthy</span>
        </p>
        <p className={item.failureCount ? "text-amber-200" : "text-[#a9aab8]"}>
          {item.failureCount.toLocaleString()} <span className="text-[#858697]">failures</span>
        </p>
      </div>

      {(item.avgLatencyMs != null || item.avgTtftMs != null || item.avgTokensPerSec != null || (item.activeRequests ?? 0) > 0) ? (
        <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md border border-white/5 bg-white/[0.02] px-2.5 py-1.5 font-mono text-[9px] text-[#b4b6c4]">
          {item.activeRequests ? (
            <span className="text-sky-300 font-medium">
              ⚡ {item.activeRequests} active
            </span>
          ) : null}
          {item.avgLatencyMs != null ? (
            <span>
              Latency: <span className="text-[#dedfe7]">{Math.round(item.avgLatencyMs)}ms</span>
              {item.lastLatencyMs != null ? <span className="text-[#858697]"> ({Math.round(item.lastLatencyMs)}ms last)</span> : null}
            </span>
          ) : null}
          {item.avgTtftMs != null ? (
            <span>
              TTFT: <span className="text-[#c9ff73]">{Math.round(item.avgTtftMs)}ms</span>
            </span>
          ) : null}
          {item.avgTokensPerSec != null ? (
            <span>
              Speed: <span className="text-sky-200">{Math.round(item.avgTokensPerSec)} t/s</span>
            </span>
          ) : null}
        </div>
      ) : null}

      {remaining > 0 ? (
        <div className="mt-2.5 flex items-center justify-between rounded-lg border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-[10px] text-amber-200">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-500" />
            </span>
            <span className="font-semibold text-amber-300">
              {isUnorouter ? "1 req/1 min rule · 60s cooldown active" : "Cooldown active"}
            </span>
          </div>
          <div className="font-mono font-bold text-amber-100">
            <span className="text-amber-200">{remaining}s</span> remaining
            {item.cooldownUntil ? (
              <span className="ml-1.5 font-normal text-amber-300/75">
                (resumes {new Date(item.cooldownUntil).toLocaleTimeString()})
              </span>
            ) : null}
          </div>
        </div>
      ) : isUnorouter ? (
        <div className="mt-2.5 flex items-center justify-between rounded-lg border border-[#c9ff73]/20 bg-[#c9ff73]/5 px-3 py-1.5 text-[10px] text-[#c9ff73]">
          <div className="flex items-center gap-1.5 font-medium">
            <span className="h-1.5 w-1.5 rounded-full bg-[#c9ff73]" />
            <span>1 req/1 min rule: Ready for next request</span>
          </div>
          <span className="font-mono text-[9px] text-[#858697]">Next completion initiates 60s cooldown</span>
        </div>
      ) : item.cooldownUntil ? (
        <p className="mt-2 text-[9px] text-amber-200">
          Retry eligibility resumes {new Date(item.cooldownUntil).toLocaleTimeString()}.
        </p>
      ) : null}
    </div>
  );
}

export function ManagedProviderKeyMetrics({
  providerName,
  metrics,
}: {
  providerName: string;
  metrics?: ManagedProviderKeyMetricGroup;
}) {
  if (metrics?.providers?.length) {
    return (
      <div className="mt-5 space-y-4 border-t border-white/8 pt-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[.13em] text-[#858697]">
            Provider & key metrics
          </p>
          <p className="mt-1 text-[10px] leading-5 text-[#858697]">
            Each provider retains an independent encrypted key pool, request counters, success/failure health, and
            cooldown state.
          </p>
        </div>
        {metrics.providers.map((provider) => (
          <div key={provider.id} className="rounded-xl border border-white/8 bg-black/10 p-3">
            <div className="mb-1 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <p className="text-xs font-semibold text-[#dedfe7]">{provider.label}</p>
                {provider.label.toLowerCase().includes("unorouter") && (
                  <Badge className="border border-amber-400/40 bg-amber-400/15 text-[9px] text-amber-200">
                    1 req / 1 min
                  </Badge>
                )}
              </div>
              <Badge className="border-0 bg-white/6 font-mono text-[9px] text-[#d5d6df]">
                {provider.slots.reduce((total, item) => total + item.requestCount, 0).toLocaleString()} requests
              </Badge>
            </div>
            <ManagedProviderKeyMetrics
              providerName={`${providerName} ${provider.label}`}
              metrics={{ modelId: metrics.modelId, slots: provider.slots }}
            />
          </div>
        ))}
      </div>
    );
  }

  const slots = metrics?.slots ?? [];
  if (!slots.length) {
    return (
      <div className="mt-5 border-t border-white/8 pt-4 text-[10px] leading-5 text-[#858697]">
        Per-key metrics appear after the active server-side key pool is loaded.
      </div>
    );
  }

  const maxRequests = Math.max(1, ...slots.map((item) => item.requestCount));
  const healthStyle = {
    healthy: "border-[#c9ff73]/20 bg-[#c9ff73]/10 text-[#c9ff73]",
    "cooling-down": "border-amber-300/20 bg-amber-300/10 text-amber-200",
    unverified: "border-white/10 bg-white/5 text-[#a9aab8]",
    unknown: "border-white/10 bg-white/5 text-[#a9aab8]",
  } as const;

  const isUnorouter = providerName.toLowerCase().includes("unorouter");

  return (
    <div className="mt-5 border-t border-white/8 pt-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <p className="text-[10px] font-bold uppercase tracking-[.13em] text-[#858697]">
              Per-key request & health
            </p>
            {isUnorouter && (
              <Badge className="border border-amber-400/40 bg-amber-400/15 text-[9px] text-amber-200">
                1 req / 1 min per key
              </Badge>
            )}
          </div>
          <p className="mt-1 text-[10px] leading-5 text-[#858697]">
            {isUnorouter
              ? "Unorouter enforces 1 request per minute per key. Completed requests immediately trigger a 60-second cooldown timer visible below."
              : "Durable request counts are matched server-side by non-reversible fingerprints. Raw API keys never leave the server."}
          </p>
        </div>
        <Badge className="border-0 bg-white/6 text-[9px] text-[#d5d6df]">
          {slots.reduce((total, item) => total + item.requestCount, 0).toLocaleString()} requests
        </Badge>
      </div>
      <div className="mt-4 space-y-3" aria-label={`${providerName} per-key request and health metrics`}>
        {slots.map((item) => (
          <SlotMetricCard
            key={`${providerName}-${item.slot}`}
            item={item}
            providerName={providerName}
            maxRequests={maxRequests}
            healthStyle={healthStyle}
            isUnorouter={isUnorouter}
          />
        ))}
      </div>
    </div>
  );
}

