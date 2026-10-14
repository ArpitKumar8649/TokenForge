import React, { useState, useMemo } from "react";
import { TOKENFORGE_MODELS, type CatalogueModel } from "@/lib/modelCatalogue";
import { useDynamicModelPricing } from "@/lib/useDynamicModelPricing";
import { Search, Sparkles, Percent, ArrowUpRight, Check, Zap, HelpCircle } from "lucide-react";
import { Link } from "wouter";

interface ModelPricingTableProps {
  onOpenTopUpModal?: () => void;
}

const PROVIDER_FILTERS = [
  { id: "all", label: "All Models" },
  { id: "Claude", label: "Anthropic / Claude" },
  { id: "OpenAI", label: "OpenAI" },
  { id: "DeepSeek", label: "DeepSeek" },
  { id: "Google", label: "Google Gemini" },
  { id: "Qwen", label: "Qwen / Alibaba" },
  { id: "Z.AI", label: "Z.AI & xAI" },
];

function formatPrice(val: number): string {
  if (val < 0.1) {
    return `$${val.toFixed(3)}`;
  }
  return `$${val.toFixed(2)}`;
}

export function ModelPricingTable({ onOpenTopUpModal }: ModelPricingTableProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedProvider, setSelectedProvider] = useState("all");
  const { pricingMap } = useDynamicModelPricing();

  const filteredModels = useMemo(() => {
    return TOKENFORGE_MODELS.filter((model) => {
      // Provider filter
      if (selectedProvider !== "all") {
        if (selectedProvider === "Claude") {
          if (model.provider !== "Claude" && model.provider !== "Anthropic") return false;
        } else if (selectedProvider === "Qwen") {
          if (model.provider !== "Qwen" && model.provider !== "Alibaba Cloud") return false;
        } else if (selectedProvider === "Z.AI") {
          if (model.provider !== "Z.AI" && model.provider !== "xAI") return false;
        } else if (model.provider !== selectedProvider) {
          return false;
        }
      }

      // Search query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesName = model.name.toLowerCase().includes(query);
        const matchesId = model.id.toLowerCase().includes(query);
        const matchesProvider = model.provider.toLowerCase().includes(query);
        const matchesEyebrow = model.eyebrow.toLowerCase().includes(query);
        if (!matchesName && !matchesId && !matchesProvider && !matchesEyebrow) return false;
      }

      return true;
    });
  }, [searchQuery, selectedProvider]);

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 py-12">
      {/* Section Header */}
      <div className="text-center max-w-3xl mx-auto mb-10">
        <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full text-xs font-semibold uppercase tracking-wider bg-rose-500/10 text-rose-300 border border-rose-500/20 mb-3">
          <Sparkles className="w-3.5 h-3.5 text-rose-400" />
          100% Bonus Credit on Every Deposit (2x Grant)
        </div>
        <h2 className="text-3xl sm:text-4xl font-extralight text-white font-display tracking-tight">
          Official Model <span className="text-rose-400 font-normal">Pricing & Rates</span>
        </h2>
        <p className="mt-3 text-sm text-slate-300 font-sans leading-relaxed">
          Standard official rates configured per model. Every top-up deposits <span className="text-rose-300 font-semibold">double the credit (2x grant)</span> to your balance, giving you 2x more tokens for the exact same dollar amount.
        </p>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 mb-6">
        {/* Provider Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto p-1.5 rounded-2xl bg-black/40 border border-white/10 backdrop-blur-xl scrollbar-none">
          {PROVIDER_FILTERS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setSelectedProvider(tab.id)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-all cursor-pointer ${
                selectedProvider === tab.id
                  ? "bg-rose-500 text-white shadow-md shadow-rose-500/30 font-semibold"
                  : "text-slate-400 hover:text-white hover:bg-white/5"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div className="relative w-full md:w-72">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search model or provider..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-xl text-xs bg-black/40 border border-white/10 text-white placeholder-slate-400 focus:outline-none focus:border-rose-400/60 transition-colors backdrop-blur-xl"
          />
        </div>
      </div>

      {/* Model Table */}
      <div className="rounded-2xl border border-white/10 bg-black/40 backdrop-blur-2xl overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="border-b border-white/10 bg-white/[0.03] text-xs font-semibold uppercase tracking-wider text-slate-400">
                <th scope="col" className="py-4 px-5 sm:px-6">Model & Provider</th>
                <th scope="col" className="py-4 px-4">Capabilities</th>
                <th scope="col" className="py-4 px-4 text-right">
                  Input Price
                  <span className="block text-[10px] text-slate-500 font-normal lowercase">per 1M input tokens</span>
                </th>
                <th scope="col" className="py-4 px-4 text-right">
                  Output Price
                  <span className="block text-[10px] text-slate-500 font-normal lowercase">per 1M output tokens</span>
                </th>
                <th scope="col" className="py-4 px-4 text-center">
                  Deposit Advantage
                  <span className="block text-[10px] text-emerald-400 font-normal lowercase">100% bonus balance</span>
                </th>
                <th scope="col" className="py-4 px-4 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filteredModels.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    No models found matching "{searchQuery}".
                  </td>
                </tr>
              ) : (
                filteredModels.map((model) => {
                  const dynamic = pricingMap.get(model.id);
                  const officialInput = dynamic ? dynamic.inputRate : model.inputUsdPerMillion;
                  const officialOutput = dynamic ? dynamic.outputRate : model.outputUsdPerMillion;
                  const isCustomPrice = Boolean(dynamic?.isCustom);

                  return (
                    <tr
                      key={model.id}
                      className="hover:bg-white/[0.02] transition-colors group"
                    >
                      {/* Column 1: Model & Provider */}
                      <td className="py-4 px-5 sm:px-6">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-xs font-bold text-slate-200 shrink-0 font-mono">
                            {model.providerMark || model.name.charAt(0)}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-white group-hover:text-rose-300 transition-colors">
                                {model.name}
                              </span>
                              {model.isPremium && (
                                <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-400/10 text-amber-300 border border-amber-400/20">
                                  Frontier
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-400">
                              <span>{model.provider}</span>
                              <span className="text-slate-600">•</span>
                              <span className="font-mono text-[11px] text-slate-500">{model.id}</span>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Column 2: Capabilities */}
                      <td className="py-4 px-4">
                        <div className="flex flex-wrap gap-1 max-w-[170px]">
                          {model.capabilities.slice(0, 3).map((cap, idx) => (
                            <span
                              key={idx}
                              className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 text-slate-300 border border-white/5 whitespace-nowrap"
                            >
                              {cap}
                            </span>
                          ))}
                        </div>
                      </td>

                      {/* Column 3: Input Price */}
                      <td className="py-4 px-4 text-right">
                        <div className="font-mono text-sm font-semibold text-white">
                          {formatPrice(officialInput)}
                        </div>
                        <span className="text-[10px] text-slate-500 block mt-0.5">
                          {isCustomPrice ? (
                            <span className="text-emerald-400 font-medium">Admin live rate</span>
                          ) : (
                            "Official list rate"
                          )}
                        </span>
                      </td>

                      {/* Column 4: Output Price */}
                      <td className="py-4 px-4 text-right">
                        <div className="font-mono text-sm font-semibold text-white">
                          {formatPrice(officialOutput)}
                        </div>
                        <span className="text-[10px] text-slate-500 block mt-0.5">
                          / 1,000,000 tokens
                        </span>
                      </td>

                      {/* Column 5: Deposit Advantage */}
                      <td className="py-4 px-4 text-center">
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                          <Check className="w-3 h-3 text-emerald-400" />
                          2x Credit Power
                        </span>
                      </td>

                      {/* Column 6: Action */}
                      <td className="py-4 px-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <Link
                            href={`/playground?model=${model.id}`}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-white/5 hover:bg-white/10 text-slate-200 hover:text-white border border-white/10 transition-colors"
                          >
                            <span>Test</span>
                            <ArrowUpRight className="w-3 h-3" />
                          </Link>
                          {onOpenTopUpModal && (
                            <button
                              type="button"
                              onClick={onOpenTopUpModal}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-rose-500/20 hover:bg-rose-500 text-rose-300 hover:text-white border border-rose-500/30 transition-all cursor-pointer"
                            >
                              <Zap className="w-3 h-3" />
                              <span>Recharge</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Table Footer Callout */}
        <div className="p-4 sm:p-5 bg-white/[0.02] border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-rose-400 shrink-0" />
            <span>
              All models feature continuous health probing, zero rate-limit queue stalls, and automatic upstream failover.
            </span>
          </div>
          {onOpenTopUpModal && (
            <button
              type="button"
              onClick={onOpenTopUpModal}
              className="text-rose-400 hover:text-rose-300 font-semibold cursor-pointer shrink-0 underline decoration-rose-400/40 hover:decoration-rose-400"
            >
              Get started with PAYG balance &rarr;
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
