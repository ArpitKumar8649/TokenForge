import React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { coalesceDailyUsage } from "../../../../../shared/usageSeries";
import { TOKENFORGE_MODELS } from "@/lib/modelCatalogue";
import { AdminAccountModelUsage, AdminGlobalModelUsage } from "../types";
import { formatTokens } from "../common/AdminCommon";

const modelNameById = new Map(TOKENFORGE_MODELS.map((model) => [model.id, model.name]));

export function AccountModelUsageChart({
  usage,
  loading,
}: {
  usage: AdminAccountModelUsage[];
  loading: boolean;
}) {
  if (loading) {
    return (
      <div className="grid h-28 place-items-center" aria-label="Loading account model usage">
        <Loader2 className="animate-spin text-[#c9ff73]" size={16} />
      </div>
    );
  }
  if (!usage.length) {
    return (
      <div className="grid min-h-24 place-items-center rounded-lg border border-dashed border-white/10 px-4 text-center text-[10px] leading-5 text-[#858697]">
        No model requests have been recorded for this account. Models appear after API-key or Playground activity.
      </div>
    );
  }
  const maximum = Math.max(1, ...usage.map((item) => item.requestCount));
  return (
    <div
      className="space-y-2.5"
      role="img"
      aria-label={`Model usage: ${usage
        .map(
          (item) =>
            `${modelNameById.get(item.modelId) ?? item.modelId}, ${item.requestCount} requests, ${item.totalTokens} tokens`
        )
        .join("; ")}`}
    >
      {usage.map((item) => (
        <div
          className="grid grid-cols-[minmax(5.5rem,.7fr)_minmax(0,1.3fr)_auto] items-center gap-2 sm:grid-cols-[9rem_minmax(0,1fr)_7.25rem]"
          key={item.modelId}
        >
          <div className="min-w-0">
            <p className="truncate font-mono text-[10px] font-semibold text-[#e2e2ea]" title={item.modelId}>
              {modelNameById.get(item.modelId) ?? item.modelId}
            </p>
            <p className="truncate font-mono text-[9px] text-[#77798b]">{item.modelId}</p>
          </div>
          <div className="h-5 overflow-hidden rounded-md border border-white/8 bg-black/25" aria-hidden="true">
            <div
              className="h-full min-w-1 rounded-md bg-gradient-to-r from-[#4c7e22] via-[#82be3d] to-[#c9ff73] transition-[width] duration-200 ease-out"
              style={{ width: `${Math.max(3, (item.requestCount / maximum) * 100)}%` }}
            />
          </div>
          <p className="text-right font-mono text-[9px] font-bold leading-4 tabular-nums text-[#c9ff73]">
            {item.requestCount.toLocaleString()} req
            <br />
            <span className="font-medium text-[#a7a8b6]">{formatTokens(item.totalTokens)} tok</span>
          </p>
        </div>
      ))}
    </div>
  );
}

export function AllAccountModelUsageChart({
  usage,
  loading,
}: {
  usage: AdminGlobalModelUsage[];
  loading: boolean;
}) {
  if (loading) {
    return (
      <div className="grid h-52 place-items-center" aria-label="Loading all-account model activity">
        <Loader2 className="animate-spin text-[#c9ff73]" size={18} />
      </div>
    );
  }
  if (!usage.length) {
    return (
      <div className="grid h-52 place-items-center px-5 text-center text-xs leading-5 text-[#9091a3]">
        Model bars appear after the first successful request from any TokenForge account.
      </div>
    );
  }
  const maximum = Math.max(1, ...usage.map((item) => item.requestCount));
  return (
    <div
      className="space-y-3"
      role="img"
      aria-label={`All-account model activity: ${usage
        .map(
          (item) =>
            `${modelNameById.get(item.modelId) ?? item.modelId}, ${item.accountCount} accounts, ${item.requestCount} requests, ${item.totalTokens} tokens`
        )
        .join("; ")}`}
    >
      {usage.map((item) => (
        <div
          className="grid grid-cols-[minmax(5.25rem,.65fr)_minmax(0,1.35fr)] gap-x-2 gap-y-1.5 sm:grid-cols-[8rem_minmax(0,1fr)_auto] sm:items-center sm:gap-y-0"
          key={item.modelId}
        >
          <div className="min-w-0">
            <span className="block truncate text-[10px] font-semibold text-[#e4e4ec]" title={item.modelId}>
              {modelNameById.get(item.modelId) ?? item.modelId}
            </span>
            <span className="block truncate font-mono text-[9px] text-[#7f8193]">
              {item.accountCount} account{item.accountCount === 1 ? "" : "s"}
            </span>
          </div>
          <div className="h-6 overflow-hidden rounded-md border border-white/8 bg-black/20" aria-hidden="true">
            <div
              className="h-full min-w-1 rounded-md bg-gradient-to-r from-[#487f2d] via-[#7fc838] to-[#c9ff73] transition-[width] duration-200 ease-out"
              style={{ width: `${Math.max(3, (item.requestCount / maximum) * 100)}%` }}
            />
          </div>
          <span className="col-span-2 text-right font-mono text-[9px] font-bold tabular-nums text-[#c9ff73] sm:col-span-1 sm:text-[10px]">
            {item.requestCount.toLocaleString()} req · {formatTokens(item.totalTokens)} tok
          </span>
        </div>
      ))}
    </div>
  );
}

export function AdminUsageChart({
  usage,
  modelUsage,
  loading,
}: {
  usage: { day: string; requests: number; tokens: number }[];
  modelUsage: AdminGlobalModelUsage[];
  loading: boolean;
}) {
  const data = coalesceDailyUsage(usage);
  const max = Math.max(1, ...data.map((row) => row.requests));
  return (
    <div className="space-y-7">
      <div>
        {data.length ? (
          <div className="flex h-40 items-end gap-2">
            {data.map((row) => (
              <div className="group flex h-full flex-1 flex-col justify-end" key={row.day}>
                <div
                  className="rounded-t bg-gradient-to-t from-[#5f9f29] to-[#c9ff73]"
                  style={{ height: `${Math.max(4, (row.requests / max) * 100)}%` }}
                  title={`${row.requests} requests · ${row.tokens.toLocaleString()} tokens`}
                />
                <span className="mt-2 text-center font-mono text-[8px] text-[#77798b]">{row.day.slice(5)}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid h-40 place-items-center text-xs text-[#9091a3]">
            No metered activity has been recorded yet.
          </div>
        )}
      </div>
      <div className="border-t border-white/8 pt-5">
        <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[.13em] text-[#bfc0cb]">
              All-account model activity
            </p>
            <p className="mt-1 text-[10px] text-[#7f8190]">
              Every model used by at least one TokenForge account. Bars compare successful request totals.
            </p>
          </div>
          <p className="shrink-0 font-mono text-[9px] text-[#77798b]">Accounts · requests · tokens</p>
        </div>
        <AllAccountModelUsageChart usage={modelUsage} loading={loading} />
      </div>
    </div>
  );
}

export function EmailProviderChart({
  providers,
  loading,
}: {
  providers: { provider: string; accountCount: number }[];
  loading: boolean;
}) {
  if (loading) {
    return (
      <div className="grid h-52 place-items-center" aria-label="Loading email provider distribution">
        <Loader2 className="animate-spin text-[#c9ff73]" size={18} />
      </div>
    );
  }
  if (!providers.length) {
    return (
      <div className="grid h-52 place-items-center px-5 text-center text-xs leading-5 text-[#9091a3]">
        Email-provider counts will appear after the first account with an email address is registered.
      </div>
    );
  }
  const maximum = Math.max(1, ...providers.map((item) => item.accountCount));
  return (
    <div
      className="space-y-3"
      role="img"
      aria-label={`Email provider distribution: ${providers
        .map((item) => `${item.provider}, ${item.accountCount} accounts`)
        .join("; ")}`}
    >
      {providers.map((item) => (
        <div
          className="grid grid-cols-[minmax(5rem,.55fr)_minmax(0,1.45fr)_2.25rem] items-center gap-2 sm:grid-cols-[8rem_minmax(0,1fr)_3rem]"
          key={item.provider}
        >
          <span className="truncate font-mono text-[10px] font-semibold text-[#d9d8e1]" title={item.provider}>
            {item.provider}
          </span>
          <div className="h-6 overflow-hidden rounded-md border border-white/8 bg-black/20" aria-hidden="true">
            <div
              className="h-full min-w-1 rounded-md bg-gradient-to-r from-[#5f9f29] via-[#92d43c] to-[#c9ff73] transition-[width] duration-200 ease-out"
              style={{ width: `${Math.max(3, (item.accountCount / maximum) * 100)}%` }}
            />
          </div>
          <span className="text-right font-mono text-[10px] font-bold tabular-nums text-[#c9ff73]">
            {item.accountCount}
          </span>
        </div>
      ))}
    </div>
  );
}

export function OrcaRouterSlotUsageChart({
  usage,
  loading,
}: {
  usage: Array<{ slot: number; requestCount: number }>;
  loading: boolean;
}) {
  if (loading) {
    return (
      <div className="grid h-56 place-items-center" aria-label="Loading OrcaRouter credential-slot request totals">
        <Loader2 className="animate-spin text-[#c9ff73]" size={18} />
      </div>
    );
  }
  const slots = Array.from({ length: 15 }, (_, slot) => ({
    slot,
    requestCount: usage.find((item) => item.slot === slot)?.requestCount ?? 0,
  }));
  const totalRequests = slots.reduce((total, item) => total + item.requestCount, 0);
  if (!totalRequests) {
    return (
      <div className="grid min-h-36 place-items-center rounded-xl border border-dashed border-white/10 bg-black/10 px-5 text-center text-[11px] leading-5 text-[#9091a3]">
        No OrcaRouter requests have been routed through the active pool since the current service start or the most recent credential rotation.
      </div>
    );
  }
  const maximum = Math.max(1, ...slots.map((item) => item.requestCount));
  return (
    <div
      className="space-y-2.5"
      role="img"
      aria-label={`OrcaRouter credential-slot request totals: ${slots
        .map((item) => `slot ${item.slot + 1}, ${item.requestCount} requests`)
        .join("; ")}`}
    >
      {slots.map((item) => (
        <div
          className="grid grid-cols-[2.75rem_minmax(0,1fr)_3.25rem] items-center gap-2 sm:grid-cols-[4.5rem_minmax(0,1fr)_4.5rem]"
          key={item.slot}
        >
          <span className="font-mono text-[10px] font-semibold text-[#d9d8e1]">
            S{String(item.slot + 1).padStart(2, "0")}
          </span>
          <div className="h-5 overflow-hidden rounded-md border border-white/8 bg-black/25" aria-hidden="true">
            <div
              className="h-full min-w-1 rounded-md bg-gradient-to-r from-[#4c7e22] via-[#82be3d] to-[#c9ff73] transition-[width] duration-200 ease-out"
              style={{ width: `${Math.max(3, (item.requestCount / maximum) * 100)}%` }}
            />
          </div>
          <span className="text-right font-mono text-[10px] font-bold tabular-nums text-[#c9ff73]">
            {item.requestCount.toLocaleString()}
          </span>
        </div>
      ))}
    </div>
  );
}
