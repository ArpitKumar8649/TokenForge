import React, { useState, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import {
  DollarSign,
  Search,
  RotateCcw,
  Check,
  AlertCircle,
  Sparkles,
  SlidersHorizontal,
  Loader2,
  TrendingUp,
} from "lucide-react";

export function AdminPricingSection() {
  const utils = trpc.useUtils();
  const [selectedTier, setSelectedTier] = useState<"payg" | "bundle">("payg");

  const pricingQuery = trpc.admin.modelPricingTable.useQuery(
    { tier: selectedTier },
    {
      refetchInterval: 10_000,
    }
  );

  const [search, setSearch] = useState("");
  const [filterCustomOnly, setFilterCustomOnly] = useState(false);
  const [editValues, setEditValues] = useState<
    Record<string, { inputUsd: string; outputUsd: string }>
  >({});
  const [savingModelId, setSavingModelId] = useState<string | null>(null);

  const handleTierChange = (tier: "payg" | "bundle") => {
    setSelectedTier(tier);
    setEditValues({});
  };

  const updateMutation = trpc.admin.updateModelPricing.useMutation({
    onSuccess: (data, variables) => {
      toast.success(
        `Pricing (${variables.tier?.toUpperCase() ?? "PAYG"}) updated for ${variables.modelId}`
      );
      utils.admin.modelPricingTable.invalidate();
      utils.public.modelPricing.invalidate();
      setSavingModelId(null);
    },
    onError: (err) => {
      toast.error(err.message || "Failed to update pricing");
      setSavingModelId(null);
    },
  });

  const resetMutation = trpc.admin.resetModelPricing.useMutation({
    onSuccess: (data, variables) => {
      toast.success(
        `Pricing (${variables.tier?.toUpperCase() ?? "PAYG"}) reset to default for ${variables.modelId}`
      );
      utils.admin.modelPricingTable.invalidate();
      utils.public.modelPricing.invalidate();
      setEditValues((prev) => {
        const next = { ...prev };
        delete next[variables.modelId];
        return next;
      });
      setSavingModelId(null);
    },
    onError: (err) => {
      toast.error(err.message || "Failed to reset pricing");
      setSavingModelId(null);
    },
  });

  const models = pricingQuery.data ?? [];

  const filteredModels = useMemo(() => {
    return models.filter((m) => {
      if (filterCustomOnly && !m.isCustom) return false;
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        m.id.toLowerCase().includes(q) ||
        m.displayName.toLowerCase().includes(q) ||
        m.providerName.toLowerCase().includes(q)
      );
    });
  }, [models, search, filterCustomOnly]);

  const handleInputChange = (
    modelId: string,
    field: "inputUsd" | "outputUsd",
    value: string
  ) => {
    setEditValues((prev) => {
      const existing = prev[modelId] || {
        inputUsd: "",
        outputUsd: "",
      };
      return {
        ...prev,
        [modelId]: {
          ...existing,
          [field]: value,
        },
      };
    });
  };

  const getEffectiveFormValues = (model: (typeof models)[0]) => {
    const edit = editValues[model.id];
    return {
      inputUsd:
        edit?.inputUsd !== undefined
          ? edit.inputUsd
          : String(model.effectiveInputUsdPerMillion),
      outputUsd:
        edit?.outputUsd !== undefined
          ? edit.outputUsd
          : String(model.effectiveOutputUsdPerMillion),
    };
  };

  const handleSave = (model: (typeof models)[0]) => {
    const { inputUsd, outputUsd } = getEffectiveFormValues(model);
    const inVal = parseFloat(inputUsd);
    const outVal = parseFloat(outputUsd);

    if (isNaN(inVal) || inVal < 0) {
      toast.error("Please enter a valid positive input price / 1M tokens");
      return;
    }
    if (isNaN(outVal) || outVal < 0) {
      toast.error("Please enter a valid positive output price / 1M tokens");
      return;
    }

    setSavingModelId(model.id);
    updateMutation.mutate({
      modelId: model.id,
      inputUsdPerMillion: inVal,
      outputUsdPerMillion: outVal,
      tier: selectedTier,
    });
  };

  const handleReset = (modelId: string) => {
    setSavingModelId(modelId);
    resetMutation.mutate({ modelId, tier: selectedTier });
  };

  const customCount = models.filter((m) => m.isCustom).length;

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="rounded-xl border border-[#c9ff73]/20 bg-[#12160d] p-5 shadow-lg">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#c9ff73]/10 text-[#c9ff73]">
                <DollarSign className="h-5 w-5" />
              </div>
              <h2 className="text-xl font-bold tracking-tight text-white">
                Dynamic Model Pricing Overrides
              </h2>
            </div>
            <p className="mt-1 text-sm text-[#a1a1aa]">
              Configure model pricing overrides independently for{" "}
              <strong className="text-rose-400">Tier 1 (Pay-As-You-Go)</strong> and{" "}
              <strong className="text-emerald-400">Tier 2 (Credit Bundles)</strong>.
              The price you set is the <strong className="text-[#c9ff73]">real direct price</strong> with{" "}
              <strong className="text-white">0% platform markup</strong>. PAYG API requests deduct at
              the PAYG rates set here, while Credit Bundle accounts deduct at bundle rates.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {/* Pricing Tier Selector Dropdown */}
            <div className="flex flex-col gap-1 rounded-xl border border-white/10 bg-black/40 p-2.5">
              <label className="text-[10px] font-bold uppercase tracking-wider text-[#a1a1aa]">
                Pricing Tier To Configure
              </label>
              <div className="flex items-center gap-2">
                <select
                  value={selectedTier}
                  onChange={(e) => handleTierChange(e.target.value as "payg" | "bundle")}
                  className={`h-9 cursor-pointer rounded-lg border px-3 text-xs font-bold transition-all focus:outline-none ${
                    selectedTier === "payg"
                      ? "border-rose-500/50 bg-rose-500/15 text-rose-300 focus:border-rose-400"
                      : "border-emerald-500/50 bg-emerald-500/15 text-emerald-300 focus:border-emerald-400"
                  }`}
                >
                  <option value="payg" className="bg-[#12160d] text-rose-300">
                    Tier 1: Pay-As-You-Go (PAYG)
                  </option>
                  <option value="bundle" className="bg-[#12160d] text-emerald-300">
                    Tier 2: Credit Bundles
                  </option>
                </select>
                <span
                  className={`inline-flex items-center rounded-md px-2 py-1 text-[10px] font-bold uppercase tracking-wider ${
                    selectedTier === "payg"
                      ? "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                      : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                  }`}
                >
                  {selectedTier === "payg" ? "PAYG Tier Active" : "Bundle Tier Active"}
                </span>
              </div>
            </div>

            <div className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-center">
              <div className="text-xs font-semibold uppercase tracking-wider text-[#a1a1aa]">
                Custom Overrides ({selectedTier.toUpperCase()})
              </div>
              <div className="text-lg font-bold text-[#c9ff73]">
                {customCount} / {models.length}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Controls / Filter Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 items-center gap-3">
          <div className="relative max-w-sm flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#71717a]" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search model by name, ID, or provider..."
              className="border-white/10 bg-black/40 pl-9 text-white placeholder:text-[#71717a] focus:border-[#c9ff73]"
            />
          </div>
          {/* Quick toggle pill */}
          <div className="hidden items-center gap-1 rounded-lg border border-white/10 bg-black/30 p-1 md:flex">
            <button
              type="button"
              onClick={() => handleTierChange("payg")}
              className={`rounded px-2.5 py-1 text-xs font-semibold transition-colors ${
                selectedTier === "payg"
                  ? "bg-rose-500/25 text-rose-300 border border-rose-500/40"
                  : "text-[#858697] hover:text-white"
              }`}
            >
              PAYG Pricing
            </button>
            <button
              type="button"
              onClick={() => handleTierChange("bundle")}
              className={`rounded px-2.5 py-1 text-xs font-semibold transition-colors ${
                selectedTier === "bundle"
                  ? "bg-emerald-500/25 text-emerald-300 border border-emerald-500/40"
                  : "text-[#858697] hover:text-white"
              }`}
            >
              Bundles Pricing
            </button>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant={filterCustomOnly ? "default" : "outline"}
            onClick={() => setFilterCustomOnly(!filterCustomOnly)}
            className={
              filterCustomOnly
                ? "bg-[#c9ff73] text-[#12160d] hover:bg-[#d8ff91]"
                : "border-white/10 bg-transparent text-[#a1a1aa] hover:bg-white/5 hover:text-white"
            }
          >
            <SlidersHorizontal className="mr-1.5 h-3.5 w-3.5" />
            {filterCustomOnly ? "Showing Custom Only" : "Show Custom Only"}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              pricingQuery.refetch();
              toast.info("Pricing table refreshed");
            }}
            disabled={pricingQuery.isFetching}
            className="border-white/10 bg-transparent text-[#a1a1aa] hover:bg-white/5 hover:text-white"
          >
            {pricingQuery.isFetching ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RotateCcw className="h-3.5 w-3.5" />
            )}
          </Button>
        </div>
      </div>

      {/* Pricing Table */}
      <div className="overflow-hidden rounded-xl border border-white/10 bg-[#0d0f14]">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-white/10 bg-white/[0.02] text-xs font-semibold uppercase tracking-wider text-[#a1a1aa]">
              <tr>
                <th className="px-4 py-3.5">Model</th>
                <th className="px-4 py-3.5">Provider</th>
                <th className="px-4 py-3.5">Default Rate (1M)</th>
                <th className="px-4 py-3.5">Active Real Price ({selectedTier.toUpperCase()})</th>
                <th className="px-4 py-3.5">Set Input Price ($/1M)</th>
                <th className="px-4 py-3.5">Set Output Price ($/1M)</th>
                <th className="px-4 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-white">
              {filteredModels.map((model) => {
                const { inputUsd, outputUsd } = getEffectiveFormValues(model);
                const isSaving = savingModelId === model.id;
                const hasPendingChanges =
                  parseFloat(inputUsd) !== model.effectiveInputUsdPerMillion ||
                  parseFloat(outputUsd) !== model.effectiveOutputUsdPerMillion;

                return (
                  <tr
                    key={model.id}
                    className={`transition-colors hover:bg-white/[0.02] ${
                      model.isCustom ? (selectedTier === "payg" ? "bg-rose-500/[0.03]" : "bg-emerald-500/[0.03]") : ""
                    }`}
                  >
                    {/* Model Details */}
                    <td className="px-4 py-3.5">
                      <div className="flex flex-col">
                        <span className="font-medium text-white">{model.displayName}</span>
                        <span className="font-mono text-xs text-[#71717a]">{model.id}</span>
                      </div>
                    </td>

                    {/* Provider */}
                    <td className="px-4 py-3.5">
                      <span className="rounded bg-white/5 px-2 py-0.5 text-xs text-[#a1a1aa]">
                        {model.providerName}
                      </span>
                    </td>

                    {/* Default Rate */}
                    <td className="px-4 py-3.5 text-xs text-[#71717a]">
                      <div>
                        In: ${model.defaultInputUsdPerMillion.toFixed(2)}
                      </div>
                      <div>
                        Out: ${model.defaultOutputUsdPerMillion.toFixed(2)}
                      </div>
                    </td>

                    {/* Active Real Price & Status */}
                    <td className="px-4 py-3.5">
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5 font-mono text-xs">
                          <span className="text-[#a1a1aa]">In:</span>
                          <span className="font-semibold text-white">
                            ${model.effectiveInputUsdPerMillion.toFixed(2)}
                          </span>
                          <span className="text-[#a1a1aa]">/ Out:</span>
                          <span className="font-semibold text-white">
                            ${model.effectiveOutputUsdPerMillion.toFixed(2)}
                          </span>
                        </div>
                        {model.isCustom ? (
                          <Badge className={selectedTier === "payg" ? "bg-rose-500/20 text-rose-300 border-rose-500/30 text-[10px] font-medium" : "bg-emerald-500/20 text-emerald-300 border-emerald-500/30 text-[10px] font-medium"}>
                            <Sparkles className="mr-1 h-2.5 w-2.5" />
                            {selectedTier.toUpperCase()} Real Price · 0% Markup
                          </Badge>
                        ) : (
                          <span className="text-[11px] text-[#71717a]">
                            Platform Standard
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Editable Input Price */}
                    <td className="px-4 py-3.5">
                      <div className="relative w-28">
                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-[#71717a]">
                          $
                        </span>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          value={inputUsd}
                          onChange={(e) =>
                            handleInputChange(model.id, "inputUsd", e.target.value)
                          }
                          className="h-8 border-white/10 bg-black/60 pl-6 text-xs text-white focus:border-[#c9ff73]"
                        />
                      </div>
                    </td>

                    {/* Editable Output Price */}
                    <td className="px-4 py-3.5">
                      <div className="relative w-28">
                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-[#71717a]">
                          $
                        </span>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          value={outputUsd}
                          onChange={(e) =>
                            handleInputChange(model.id, "outputUsd", e.target.value)
                          }
                          className="h-8 border-white/10 bg-black/60 pl-6 text-xs text-white focus:border-[#c9ff73]"
                        />
                      </div>
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          size="sm"
                          disabled={isSaving}
                          onClick={() => handleSave(model)}
                          className={
                            hasPendingChanges
                              ? "h-8 bg-[#c9ff73] px-3 text-xs font-semibold text-[#12160d] hover:bg-[#d8ff91]"
                              : "h-8 border border-white/10 bg-white/5 px-3 text-xs text-white hover:bg-white/10"
                          }
                        >
                          {isSaving ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <>
                              <Check className="mr-1 h-3 w-3" />
                              Save
                            </>
                          )}
                        </Button>
                        {model.isCustom && (
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={isSaving}
                            onClick={() => handleReset(model.id)}
                            className="h-8 px-2 text-xs text-[#f87171] hover:bg-[#f87171]/10 hover:text-[#f87171]"
                            title="Reset to default catalogue rate"
                          >
                            <RotateCcw className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filteredModels.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-sm text-[#71717a]">
                    No models match the current filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
