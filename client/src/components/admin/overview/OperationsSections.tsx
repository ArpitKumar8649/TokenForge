import React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Activity, Download, Gauge, Megaphone, Search, ServerCog, UsersRound, WalletCards, Lock, ShieldCheck, Pencil, AlertTriangle, Loader2, Camera, FileText } from "lucide-react";
import { AdminAuditRecord, SpecialReferralCampaignData, ProviderTelemetryItem, ManagedModelOverviewItem, UserTier } from "../types";
import { SectionHeader, Metric, Toggle } from "../common/AdminCommon";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";



export function AuditTimeline({
  events,
  onExport,
  exporting,
}: {
  events: AdminAuditRecord[];
  onExport: () => void;
  exporting: boolean;
}) {
  return (
    <section className="dashboard-card">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <SectionHeader
          icon={<Activity size={17} />}
          title="Administrator activity"
          detail="Operational actions only. Timeline and export exclude API keys, credentials, names, emails, and audit metadata."
        />
        <Button
          size="sm"
          variant="outline"
          className="border-white/12 text-xs text-[#d9d8e1] hover:bg-white/10"
          onClick={onExport}
          disabled={exporting}
        >
          <Download size={14} />
          {exporting ? "Preparing…" : "Download CSV"}
        </Button>
      </div>
      <div className="mt-5 space-y-1">
        {events.length ? (
          events.map((event) => (
            <div
              key={event.id}
              className="flex items-center justify-between gap-3 rounded-lg border border-white/7 bg-black/10 px-3 py-2.5"
            >
              <div className="min-w-0">
                <p className="truncate text-xs font-semibold text-white">{event.action.replaceAll(".", " · ")}</p>
                <p className="mt-1 truncate font-mono text-[10px] text-[#8f90a2]">
                  {event.entityType}
                  {event.entityId ? ` · ${event.entityId}` : ""}
                </p>
              </div>
              <time
                className="shrink-0 text-right text-[10px] text-[#858697]"
                dateTime={new Date(event.createdAt).toISOString()}
              >
                {new Date(event.createdAt).toLocaleString()}
              </time>
            </div>
          ))
        ) : (
          <p className="py-10 text-center text-xs text-[#8f90a2]">No administrator activity has been recorded yet.</p>
        )}
      </div>
    </section>
  );
}

export function downloadAuditCsv(exportData: { columns: string[]; rows: string[][] }) {
  const encode = (value: string) => {
    const protectedValue = /^[=+\-@]/.test(value) ? `'${value}` : value;
    return `"${protectedValue.replaceAll('"', '""')}"`;
  };
  const csv = [exportData.columns, ...exportData.rows].map((row) => row.map(encode).join(",")).join("\n");
  const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `tokenforge-admin-audit-${new Date().toISOString().slice(0, 10)}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function AnnouncementSection({
  text,
  onChange,
  onSave,
  saving,
  loading,
}: {
  text: string;
  onChange: (value: string) => void;
  onSave: () => void;
  saving: boolean;
  loading: boolean;
}) {
  return (
    <section className="dashboard-card">
      <SectionHeader
        icon={<Megaphone size={17} />}
        title="Rolling announcement"
        detail="Publish one concise, site-wide message below the public and developer headers. Save an empty field to remove it."
      />
      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(18rem,.8fr)]">
        <div>
          <label htmlFor="announcement-text" className="text-xs font-semibold text-[#dedfe7]">
            Announcement text
          </label>
          <Textarea
            id="announcement-text"
            value={text}
            onChange={(event) => onChange(event.target.value)}
            maxLength={500}
            rows={5}
            placeholder="For example: New model capacity is now available…"
            className="mt-2 resize-y border-white/10 bg-black/15 text-sm leading-6 text-white placeholder:text-[#6f7181]"
            disabled={loading || saving}
          />
          <div className="mt-2 flex items-center justify-between gap-3">
            <p className="text-[10px] text-[#858697]">{text.length}/500 characters</p>
            <Button
              size="sm"
              onClick={onSave}
              disabled={saving || loading}
              className="bg-[#c9ff73] text-[#17210d] hover:bg-[#d8ff91]"
            >
              {saving ? "Saving…" : "Save announcement"}
            </Button>
          </div>
        </div>
        <div className="rounded-xl border border-white/8 bg-black/15 p-4">
          <p className="text-[10px] font-bold uppercase tracking-[.13em] text-[#858697]">Live preview</p>
          {text.trim() ? (
            <div className="mt-3 overflow-hidden rounded-lg border border-[#c9ff73]/15 bg-[#1b2415]">
              <div className="flex w-max min-w-[180%] items-center gap-5 px-4 py-3 font-mono text-[10px] font-bold tracking-wide text-[#dfe9d4]">
                <Megaphone size={13} className="text-[#c9ff73]" />
                <span>{text.trim()}</span>
                <span aria-hidden="true">·</span>
                <span>{text.trim()}</span>
              </div>
            </div>
          ) : (
            <div className="mt-3 grid min-h-24 place-items-center rounded-lg border border-dashed border-white/10 px-4 text-center text-xs leading-5 text-[#858697]">
              No announcement is currently published.
            </div>
          )}
          <p className="mt-3 text-[10px] leading-5 text-[#858697]">
            The live banner scrolls from left to right and respects each visitor’s reduced-motion preference.
          </p>
        </div>
      </div>
    </section>
  );
}

export function CapacitySection({
  providers,
  telemetry,
}: {
  providers: Array<{ slug: string; displayName: string; enabled: boolean }>;
  telemetry: ProviderTelemetryItem[];
}) {
  const telemetryFor = (providerSlug: string) =>
    telemetry.find((provider) => provider.providerSlug === providerSlug);

  return (
    <section className="dashboard-card">
      <SectionHeader
        icon={<Gauge size={17} />}
        title="Provider capacity & failover"
        detail="Live runtime signal from anonymous credential-pool slots. No keys, key fragments, or request content are retained or displayed."
      />
      <div className="mt-5 grid gap-3 md:grid-cols-3">
        {providers.map((provider) => {
          const t = telemetryFor(provider.slug);
          const healthy = t?.healthySlots ?? 0;
          const poolSize = t?.poolSize ?? 0;
          const cooling = t?.coolingDownSlots ?? 0;
          const tone = !provider.enabled || !poolSize ? "text-[#858697]" : cooling ? "text-[#f0c180]" : "text-[#c9ff73]";
          return (
            <div key={provider.slug} className="rounded-xl border border-white/8 bg-black/15 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-xs font-bold text-white">{provider.displayName}</p>
                  <p className="mt-1 font-mono text-[10px] text-[#858697]">{provider.slug}</p>
                </div>
                <Badge className={`border-0 bg-white/6 text-[10px] ${tone}`}>
                  {!provider.enabled
                    ? "Paused"
                    : !poolSize
                    ? "Not configured"
                    : cooling
                    ? "Failing over"
                    : "Capacity ready"}
                </Badge>
              </div>
              <div className="mt-5 flex items-end justify-between gap-3">
                <div>
                  <p className="text-[10px] uppercase tracking-[.12em] text-[#858697]">Healthy slots</p>
                  <p className={`mt-1 text-2xl font-black tabular-nums ${tone}`}>
                    {healthy}/{poolSize}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] uppercase tracking-[.12em] text-[#858697]">Failovers</p>
                  <p className="mt-1 text-lg font-bold text-white">{t?.failoverCount ?? 0}</p>
                </div>
              </div>
              <p className="mt-4 border-t border-white/8 pt-3 text-[10px] leading-5 text-[#8f90a2]">
                {cooling
                  ? `${cooling} slot${cooling === 1 ? " is" : "s are"} cooling down; eligible requests use remaining capacity.`
                  : t?.lastSuccessAt
                  ? `Last provider response: ${new Date(t.lastSuccessAt).toLocaleTimeString()}`
                  : "Awaiting the first provider response in this runtime."}
              </p>
            </div>
          );
        })}
      </div>
    </section>
  );
}

const TIER_OPTIONS: Array<{ value: UserTier; label: string; badge: string; color: string }> = [
  { value: "free", label: "Free (All Users)", badge: "Free", color: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300" },
  { value: "starter", label: "Starter+", badge: "Starter+", color: "border-sky-500/30 bg-sky-500/10 text-sky-300" },
  { value: "pro", label: "Pro+", badge: "Pro+", color: "border-indigo-500/30 bg-indigo-500/10 text-indigo-300" },
  { value: "max", label: "Max+", badge: "Max+", color: "border-purple-500/30 bg-purple-500/10 text-purple-300" },
  { value: "power", label: "Power+", badge: "Power+", color: "border-amber-500/30 bg-amber-500/10 text-amber-300" },
  { value: "ultra", label: "Ultra Only", badge: "Ultra", color: "border-rose-500/30 bg-rose-500/10 text-rose-300" },
];

export function ModelCompactScalingBar({
  model,
  onToggle,
  pending,
}: {
  model: ManagedModelOverviewItem;
  onToggle?: (modelId: string, enabled: boolean, triggerTokens: number | string) => void;
  pending?: boolean;
}) {
  const isEnabled = Boolean(model.enableCompactScaling);
  const currentTrigger = model.compactTriggerTokens ?? 500_000;
  const defaultDisplay = currentTrigger >= 1_000_000
    ? `${(currentTrigger / 1_000_000).toFixed(currentTrigger % 1_000_000 === 0 ? 0 : 1)}M`
    : `${Math.round(currentTrigger / 1_000)}k`;

  const [inputValue, setInputValue] = React.useState(defaultDisplay);
  const [isEditing, setIsEditing] = React.useState(false);

  React.useEffect(() => {
    if (!isEditing) {
      setInputValue(defaultDisplay);
    }
  }, [defaultDisplay, isEditing]);

  const handleSave = () => {
    onToggle?.(model.modelId, true, inputValue);
    setIsEditing(false);
  };

  return (
    <div className="flex w-full flex-wrap items-center justify-between gap-2 rounded border border-purple-500/20 bg-purple-950/20 px-2.5 py-1 text-[11px]">
      <div className="flex items-center gap-2">
        <label className="flex items-center gap-1.5 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={isEnabled}
            disabled={pending}
            onChange={(e) => {
              const next = e.target.checked;
              onToggle?.(model.modelId, next, inputValue);
            }}
            className="h-3.5 w-3.5 rounded border-purple-400/40 bg-[#121216] text-purple-600 focus:ring-0 focus:ring-offset-0 cursor-pointer"
          />
          <span className="font-semibold text-purple-200">enableCompactScaling</span>
        </label>
        {isEnabled ? (
          <span className="rounded bg-purple-500/20 border border-purple-400/30 px-1.5 py-0.5 text-[9px] font-bold tracking-wider text-purple-300">
            Active: {currentTrigger.toLocaleString()} tokens
          </span>
        ) : (
          <span className="text-[10px] text-neutral-400 font-mono">
            (Natural 1M context)
          </span>
        )}
      </div>

      {isEnabled ? (
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-purple-300/80">Trigger:</span>
          <input
            type="text"
            value={inputValue}
            disabled={pending}
            onFocus={() => setIsEditing(true)}
            onChange={(e) => {
              setIsEditing(true);
              setInputValue(e.target.value);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSave();
            }}
            placeholder="e.g. 450k, 500k, 150k"
            className="h-6 w-20 rounded border border-purple-500/40 bg-[#121216] px-2 text-center font-mono text-[11px] font-medium text-purple-100 placeholder:text-neutral-500 hover:border-purple-400 focus:border-purple-300 focus:outline-none"
          />
          <button
            type="button"
            disabled={pending}
            onClick={handleSave}
            className="h-6 rounded bg-purple-600 hover:bg-purple-500 active:bg-purple-700 disabled:opacity-50 px-2.5 text-[10px] font-bold text-white transition-colors cursor-pointer"
          >
            Save
          </button>
        </div>
      ) : null}
    </div>
  );
}

export function InferenceControlsSection({
  providers,
  models,
  telemetry,
  modelQuery,
  onModelQueryChange,
  onProviderToggle,
  onProviderVisionToggle,
  onProviderDocumentsToggle,
  onModelToggle,
  onModelTierChange,
  onModelPaygToggle,
  onModelBundleToggle,
  onModelTokenPlanToggle,
  onModelCompactScalingToggle,
  providerPending,
  providerVisionPending,
  providerDocumentsPending,
  modelPending,
  modelTierPending,
  modelPaygPending,
  modelBundlePending,
  modelTokenPlanPending,
  modelCompactScalingPending,
}: {
  providers: Array<{ slug: string; displayName: string; enabled: boolean; supportsVision?: boolean; supportsDocuments?: boolean }>;
  models: ManagedModelOverviewItem[];
  telemetry: ProviderTelemetryItem[];
  modelQuery: string;
  onModelQueryChange: (query: string) => void;
  onProviderToggle: (slug: string, enabled: boolean) => void;
  onProviderVisionToggle?: (slug: string, supportsVision: boolean) => void;
  onProviderDocumentsToggle?: (slug: string, supportsDocuments: boolean) => void;
  onModelToggle: (modelId: string, enabled: boolean) => void;
  onModelTierChange?: (modelId: string, minTier: UserTier) => void;
  onModelPaygToggle?: (modelId: string, isPayg: boolean) => void;
  onModelBundleToggle?: (modelId: string, isBundle: boolean) => void;
  onModelTokenPlanToggle?: (modelId: string, isTokenPlan: boolean) => void;
  onModelCompactScalingToggle?: (modelId: string, enabled: boolean, triggerTokens: number | string) => void;
  providerPending: boolean;
  providerVisionPending?: boolean;
  providerDocumentsPending?: boolean;
  modelPending: boolean;
  modelTierPending?: boolean;
  modelPaygPending?: boolean;
  modelBundlePending?: boolean;
  modelTokenPlanPending?: boolean;
  modelCompactScalingPending?: boolean;
}) {
  const [tierFilter, setTierFilter] = React.useState<"all" | "free" | "paid" | "token_plan" | "payg" | "bundle">("all");

  const telemetryFor = (providerSlug: string) =>
    telemetry.find((provider) => provider.providerSlug === providerSlug);

  const freeCount = models.filter((m) => (m.minTier || "free") === "free").length;
  const paidCount = models.length - freeCount;
  const tokenPlanCount = models.filter((m) => Boolean(m.isTokenPlan)).length;
  const paygCount = models.filter((m) => Boolean(m.isPayg)).length;
  const bundleCount = models.filter((m) => m.isBundle !== false).length;

  const visibleModels = models.filter((model) => {
    const matchesSearch = `${model.displayName} ${model.modelId}`.toLowerCase().includes(modelQuery.trim().toLowerCase());
    const isFree = (model.minTier || "free") === "free";
    if (tierFilter === "free") return matchesSearch && isFree;
    if (tierFilter === "paid") return matchesSearch && !isFree;
    if (tierFilter === "token_plan") return matchesSearch && Boolean(model.isTokenPlan);
    if (tierFilter === "payg") return matchesSearch && Boolean(model.isPayg);
    if (tierFilter === "bundle") return matchesSearch && model.isBundle !== false;
    return matchesSearch;
  });

  return (
    <section className="dashboard-card">
      <SectionHeader
        icon={<ServerCog size={17} />}
        title="Inference controls & Tier permissions"
        detail="Each labelled switch and minimum tier level takes effect immediately across the gateway. Set models to 'Free (All Users)' to allow free accounts access, restrict premium models to paid tiers, and toggle PAYG tags for Tier 1 key routing."
      />
      <div className="mt-5 grid gap-5 xl:grid-cols-[.85fr_1.15fr]">
        <div className="space-y-2">
          <div className="mb-2 flex items-center justify-between px-1">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[#858697]">Upstream Providers</p>
          </div>
          {providers.map((provider) => {
            const t = telemetryFor(provider.slug);
            return (
              <div
                key={provider.slug}
                className="flex items-center justify-between gap-3 rounded-xl border border-white/8 bg-white/[.025] p-3 transition-colors hover:border-white/14"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <p className="truncate text-xs font-bold text-white">{provider.displayName}</p>
                    <span
                      className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[9px] font-semibold border ${
                        provider.supportsVision
                          ? "border-purple-400/30 bg-purple-500/15 text-purple-300"
                          : "border-white/10 bg-white/5 text-[#858697]"
                      }`}
                      title={provider.supportsVision ? "Accepts Images & Vision" : "Images Filtered"}
                    >
                      <Camera size={10} />
                      {provider.supportsVision ? "IMG" : "TEXT"}
                    </span>
                    <span
                      className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[9px] font-semibold border ${
                        provider.supportsDocuments
                          ? "border-blue-400/30 bg-blue-500/15 text-blue-300"
                          : "border-white/10 bg-white/5 text-[#858697]"
                      }`}
                      title={provider.supportsDocuments ? "Accepts Documents & PDFs" : "Documents Filtered"}
                    >
                      <FileText size={10} />
                      {provider.supportsDocuments ? "DOCS" : "NO-DOCS"}
                    </span>
                  </div>
                  <p className="mt-0.5 truncate text-[10px] text-[#8f90a2]">
                    {provider.slug} · {t?.healthySlots ?? 0}/{t?.poolSize ?? 0} slots ready ·{" "}
                    {t?.failoverCount ?? 0} failovers
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <div className="flex flex-col items-end gap-1">
                    <Toggle
                      label={`${provider.displayName} Vision`}
                      enabled={provider.supportsVision ?? false}
                      pending={providerVisionPending}
                      onChange={(enabled) => onProviderVisionToggle?.(provider.slug, enabled)}
                    />
                    <Toggle
                      label={`${provider.displayName} Docs`}
                      enabled={provider.supportsDocuments ?? false}
                      pending={providerDocumentsPending}
                      onChange={(enabled) => onProviderDocumentsToggle?.(provider.slug, enabled)}
                    />
                  </div>
                  <Toggle
                    label={provider.displayName}
                    enabled={provider.enabled}
                    pending={providerPending}
                    onChange={(enabled) => onProviderToggle(provider.slug, enabled)}
                  />
                </div>
              </div>
            );
          })}
        </div>
        <div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-2.5 text-[#858697]" size={15} />
              <Input
                value={modelQuery}
                onChange={(event) => onModelQueryChange(event.target.value)}
                placeholder="Search active model catalogue"
                className="h-10 border-white/10 bg-black/15 pl-9 text-xs"
              />
            </div>
            <div className="flex items-center gap-1 self-start rounded-lg border border-white/8 bg-black/20 p-1 sm:self-auto">
              <button
                type="button"
                onClick={() => setTierFilter("all")}
                className={`rounded px-2.5 py-1 text-[11px] font-medium transition-colors ${
                  tierFilter === "all" ? "bg-white/15 text-white shadow-sm" : "text-[#858697] hover:text-[#d9d8e1]"
                }`}
              >
                All ({models.length})
              </button>
              <button
                type="button"
                onClick={() => setTierFilter("free")}
                className={`rounded px-2.5 py-1 text-[11px] font-medium transition-colors ${
                  tierFilter === "free" ? "bg-emerald-500/20 text-emerald-300 shadow-sm" : "text-[#858697] hover:text-emerald-400"
                }`}
              >
                Free ({freeCount})
              </button>
              <button
                type="button"
                onClick={() => setTierFilter("paid")}
                className={`rounded px-2.5 py-1 text-[11px] font-medium transition-colors ${
                  tierFilter === "paid" ? "bg-purple-500/20 text-purple-300 shadow-sm" : "text-[#858697] hover:text-purple-400"
                }`}
              >
                Paid ({paidCount})
              </button>
              <button
                type="button"
                onClick={() => setTierFilter("token_plan")}
                className={`rounded px-2.5 py-1 text-[11px] font-medium transition-colors ${
                  tierFilter === "token_plan" ? "bg-cyan-500/20 text-cyan-300 shadow-sm" : "text-[#858697] hover:text-cyan-400"
                }`}
              >
                Token Plan ({tokenPlanCount})
              </button>
              <button
                type="button"
                onClick={() => setTierFilter("payg")}
                className={`rounded px-2.5 py-1 text-[11px] font-medium transition-colors ${
                  tierFilter === "payg" ? "bg-rose-500/20 text-rose-300 shadow-sm" : "text-[#858697] hover:text-rose-400"
                }`}
              >
                PAYG ({paygCount})
              </button>
              <button
                type="button"
                onClick={() => setTierFilter("bundle")}
                className={`rounded px-2.5 py-1 text-[11px] font-medium transition-colors ${
                  tierFilter === "bundle" ? "bg-emerald-500/20 text-emerald-300 shadow-sm" : "text-[#858697] hover:text-emerald-400"
                }`}
              >
                Bundles ({bundleCount})
              </button>
            </div>
          </div>
          <div className="mt-2 max-h-[30rem] space-y-1.5 overflow-y-auto rounded-xl border border-white/8 bg-black/10 p-2">
            {visibleModels.map((model) => {
              const currentTier = model.minTier || "free";
              const tierConfig = TIER_OPTIONS.find((t) => t.value === currentTier) || TIER_OPTIONS[0];
              const isPaid = currentTier !== "free";
              const isPayg = Boolean(model.isPayg);
              const isBundle = model.isBundle !== false;
              const isTokenPlan = Boolean(model.isTokenPlan);
              return (
                <div
                  key={model.modelId}
                  className="flex flex-col gap-2 rounded-lg border border-white/5 bg-white/[.015] p-2.5 transition-colors hover:border-white/10 hover:bg-white/[.035]"
                >
                  <ModelCompactScalingBar
                    model={model}
                    onToggle={onModelCompactScalingToggle}
                    pending={modelCompactScalingPending}
                  />

                  <div className="flex flex-wrap items-center justify-between gap-2.5">
                    <div className="min-w-[140px] flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-xs font-semibold text-white">{model.displayName}</p>
                        <span className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider ${tierConfig.color}`}>
                          {isPaid && <Lock size={9} />}
                          {tierConfig.badge}
                        </span>
                        {isTokenPlan && (
                          <span className="inline-flex items-center gap-1 rounded border border-cyan-500/40 bg-cyan-500/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-cyan-300">
                            Token Plan
                          </span>
                        )}
                        {isPayg && (
                          <span className="inline-flex items-center gap-1 rounded border border-rose-500/40 bg-rose-500/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-rose-300">
                            PAYG
                          </span>
                        )}
                        {isBundle && (
                          <span className="inline-flex items-center gap-1 rounded border border-emerald-500/40 bg-emerald-500/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-emerald-300">
                            Bundle
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 truncate text-[10px] text-[#8f90a2]">
                        {model.modelId} · {model.providerSlug}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {/* Token Plan Toggle Button */}
                      <button
                        type="button"
                        onClick={() => onModelTokenPlanToggle?.(model.modelId, !isTokenPlan)}
                        disabled={modelTokenPlanPending}
                        title={isTokenPlan ? "Click to disable Token Plan access" : "Click to enable Token Plan access (Tier 2 API keys)"}
                        className={`inline-flex items-center gap-1.5 px-2 py-1 rounded text-[10px] font-semibold transition-colors cursor-pointer border ${
                          isTokenPlan
                            ? "bg-cyan-500/20 text-cyan-300 border-cyan-500/40 hover:bg-cyan-500/30"
                            : "bg-white/5 text-neutral-400 border-white/10 hover:bg-white/10 hover:text-white"
                        }`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${isTokenPlan ? "bg-cyan-400 animate-pulse" : "bg-neutral-500"}`} />
                        <span>{isTokenPlan ? "Token Plan Active" : "+ Token Plan"}</span>
                      </button>

                      {/* PAYG Toggle Button */}
                      <button
                        type="button"
                        onClick={() => onModelPaygToggle?.(model.modelId, !isPayg)}
                        disabled={modelPaygPending}
                        title={isPayg ? "Click to disable PAYG access" : "Click to enable PAYG access (Tier 1 API keys)"}
                        className={`inline-flex items-center gap-1.5 px-2 py-1 rounded text-[10px] font-semibold transition-colors cursor-pointer border ${
                          isPayg
                            ? "bg-rose-500/20 text-rose-300 border-rose-500/40 hover:bg-rose-500/30"
                            : "bg-white/5 text-neutral-400 border-white/10 hover:bg-white/10 hover:text-white"
                        }`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${isPayg ? "bg-rose-400 animate-pulse" : "bg-neutral-500"}`} />
                        <span>{isPayg ? "PAYG Active" : "+ PAYG"}</span>
                      </button>

                      {/* Bundle Toggle Button */}
                      <button
                        type="button"
                        onClick={() => onModelBundleToggle?.(model.modelId, !isBundle)}
                        disabled={modelBundlePending}
                        title={isBundle ? "Click to disable Credit Bundle access" : "Click to enable Credit Bundle access (Tier 2 API keys)"}
                        className={`inline-flex items-center gap-1.5 px-2 py-1 rounded text-[10px] font-semibold transition-colors cursor-pointer border ${
                          isBundle
                            ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40 hover:bg-emerald-500/30"
                            : "bg-white/5 text-neutral-400 border-white/10 hover:bg-white/10 hover:text-white"
                        }`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${isBundle ? "bg-emerald-400 animate-pulse" : "bg-neutral-500"}`} />
                        <span>{isBundle ? "Bundle Active" : "+ Bundle"}</span>
                      </button>

                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-medium text-[#858697]">Access:</span>
                        <select
                          aria-label={`Minimum tier for ${model.displayName}`}
                          value={currentTier}
                          onChange={(event) => onModelTierChange?.(model.modelId, event.target.value as UserTier)}
                          disabled={modelTierPending}
                          className="h-7 cursor-pointer rounded border border-white/12 bg-[#121216] px-2 py-0.5 text-[11px] font-medium text-[#e4e4e7] hover:border-white/25 focus:border-[#befe6c] focus:outline-none"
                        >
                          {TIER_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value} className="bg-[#18181b] text-white">
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <Toggle
                        label={model.displayName}
                        enabled={model.enabled}
                        pending={modelPending}
                        onChange={(enabled) => onModelToggle(model.modelId, enabled)}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
            {!visibleModels.length && (
              <p className="py-8 text-center text-xs text-[#8f90a2]">No active catalogue model matches your filter.</p>
            )}
          </div>
        </div>
      </div>

    </section>
  );
}
