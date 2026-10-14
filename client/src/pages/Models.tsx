import { PublicNav } from "@/components/PublicNav";
import { TokenForgeGlyph } from "@/components/TokenForgeGlyph";
import { ProviderMark } from "@/components/ProviderMark";
import { Badge } from "@/components/ui/badge";
import { formatTokenForgeCreditRatePerMillion, TOKENFORGE_MODELS } from "@/lib/modelCatalogue";
import { useDynamicModelPricing } from "@/lib/useDynamicModelPricing";
import { trpc } from "@/lib/trpc";
import { Braces, Code2, ExternalLink, Gauge, Lock, MessageCircle, ShieldCheck } from "lucide-react";
import { Link } from "wouter";
import { useState, useMemo } from "react";
import { ThreeDButton } from "@/components/ui/3d-button";
import "./models.css";

export default function Models() {
  const { getRates } = useDynamicModelPricing();
  const [tierFilter, setTierFilter] = useState<"all" | "free" | "paid" | "token_plan">("all");

  const modelAvailability = trpc.public.modelAvailability.useQuery(undefined, {
    staleTime: 60_000,
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
  });

  const modelMetaMap = useMemo(() => {
    return new Map(
      modelAvailability.data?.map(item => [
        item.modelId,
        {
          available: item.available,
          minTier: item.minTier ?? "free",
          isTokenPlan: (item as any).isTokenPlan ?? false,
          isPayg: (item as any).isPayg ?? false,
          isBundle: (item as any).isBundle !== false,
        },
      ]) ?? []
    );
  }, [modelAvailability.data]);

  const filteredModels = useMemo(() => {
    return TOKENFORGE_MODELS.filter(model => {
      const meta = modelMetaMap.get(model.id);
      const minTier = meta?.minTier ?? "free";
      if (tierFilter === "free") return minTier === "free";
      if (tierFilter === "paid") return minTier !== "free";
      if (tierFilter === "token_plan") return meta?.isTokenPlan === true;
      return true;
    });
  }, [modelMetaMap, tierFilter]);

  const freeCount = useMemo(() => {
    return TOKENFORGE_MODELS.filter(m => (modelMetaMap.get(m.id)?.minTier ?? "free") === "free").length;
  }, [modelMetaMap]);

  const tokenPlanCount = useMemo(() => {
    return TOKENFORGE_MODELS.filter(m => modelMetaMap.get(m.id)?.isTokenPlan === true).length;
  }, [modelMetaMap]);

  const paidCount = TOKENFORGE_MODELS.length - freeCount;

  return (
    <div className="public-page tf-public-surface models-page">
      <PublicNav />
      <main className="catalogue-page">
        <div className="page-eyebrow"><span className="status-dot" /> Verified text catalogue</div>
        <div className="catalogue-heading">
          <div>
            <h1>{TOKENFORGE_MODELS.length} text models.<br /><em>One considered interface.</em></h1>
            <p>Every active route is accessible via our Anthropic-compatible Messages API endpoint (<code>/v1/messages</code>), with provider-isolated execution, transparent credit metering, and flexible access-tier rules. Image, audio, embedding, transcription, and research-only routes are intentionally excluded.</p>
          </div>
          <div className="catalogue-stats">
            <div><strong>{String(TOKENFORGE_MODELS.length).padStart(2, "0")}</strong><span>verified text routes</span></div>
            <div><strong>01</strong><span>Anthropic API surface</span></div>
          </div>
        </div>

        {/* Tier filter selector */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6 p-3 rounded-xl border border-white/10 bg-black/40">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#9ea0af]">Tier Access:</span>
            <div className="flex gap-1.5" role="tablist">
              <button
                type="button"
                role="tab"
                aria-selected={tierFilter === "all"}
                onClick={() => setTierFilter("all")}
                className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors ${
                  tierFilter === "all"
                    ? "bg-[#c9ff73]/15 text-[#c9ff73] border border-[#c9ff73]/30"
                    : "text-[#9ea0af] hover:text-white border border-transparent"
                }`}
              >
                All Models ({TOKENFORGE_MODELS.length})
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={tierFilter === "free"}
                onClick={() => setTierFilter("free")}
                className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 ${
                  tierFilter === "free"
                    ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                    : "text-[#9ea0af] hover:text-emerald-300 border border-transparent"
                }`}
              >
                <ShieldCheck size={13} className="text-emerald-400" /> Free Tier ({freeCount})
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={tierFilter === "paid"}
                onClick={() => setTierFilter("paid")}
                className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 ${
                  tierFilter === "paid"
                    ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                    : "text-[#9ea0af] hover:text-amber-300 border border-transparent"
                }`}
              >
                <Lock size={13} className="text-amber-400" /> Paid Tiers ({paidCount})
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={tierFilter === "token_plan"}
                onClick={() => setTierFilter("token_plan")}
                className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 ${
                  tierFilter === "token_plan"
                    ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40"
                    : "text-[#9ea0af] hover:text-cyan-300 border border-transparent"
                }`}
              >
                <Code2 size={13} className="text-cyan-400" /> Token Plan ({tokenPlanCount})
              </button>
            </div>
          </div>
          <span className="text-xs text-[#9ea0af]">
            Showing {filteredModels.length} of {TOKENFORGE_MODELS.length} models
          </span>
        </div>

        <section className="model-detail-grid" aria-label="Available text-chat models">
          {filteredModels.map((model) => {
            const meta = modelMetaMap.get(model.id);
            const isAvailable = meta?.available ?? true;
            const minTier = meta?.minTier ?? "free";
            const isFree = minTier === "free";
            const isTokenPlan = meta?.isTokenPlan === true;

            return (
              <article key={model.id} className={`model-detail-card model-detail-card--${model.tone}`}>
                <header className="model-detail-card__header">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="model-provider-name">Text model</span>
                    {isTokenPlan && (
                      <span className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-bold bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
                        <Code2 size={11} className="text-cyan-400" /> Token Plan
                      </span>
                    )}
                    {isFree ? (
                      <span className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-semibold bg-emerald-500/10 text-emerald-300 border border-emerald-500/25">
                        <ShieldCheck size={11} /> Free Tier
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-semibold bg-amber-500/10 text-amber-300 border border-amber-500/25 uppercase">
                        <Lock size={11} /> {minTier}+
                      </span>
                    )}
                  </div>
                  <Badge variant={isAvailable ? "secondary" : "destructive"}>
                    {isAvailable ? "Available" : "Unavailable"}
                  </Badge>
                </header>

                <div className="model-detail-card__body">
                  <p className="model-eyebrow">{model.eyebrow}</p>
                  <span className="model-detail-card__title">
                    <ProviderMark provider={model.provider} fallback={model.providerMark} size={26} />
                    <h2>{model.name}</h2>
                  </span>
                  <p className="model-description">{model.description}</p>
                  <div className="capability-row" aria-label={`${model.name} capabilities`}>
                    {model.capabilities.map((capability) => (
                      <span key={capability}>{capability}</span>
                    ))}
                  </div>

                  {(() => {
                    const rates = getRates(model.id, model.inputUsdPerMillion, model.outputUsdPerMillion);
                    return (
                      <section className="model-rate-card" aria-label={`${model.name} TokenForge credit rate`}>
                        <div className="model-rate-card__head">
                          <p>Credit rate</p>
                          <span className={rates.isCustom ? "text-[#c9ff73] font-semibold" : ""}>{rates.tag}</span>
                        </div>
                        <dl>
                          <div><dt>Input</dt><dd>{rates.inputFormatted}</dd><small>/ 1M tokens</small></div>
                          <div><dt>Output</dt><dd>{rates.outputFormatted}</dd><small>/ 1M tokens</small></div>
                        </dl>
                      </section>
                    );
                  })()}
                </div>

                <footer className="model-card-footer">
                  <code>{model.id}</code>
                  <a href={model.pricingUrl} target="_blank" rel="noreferrer">
                    Rate source <ExternalLink size={12} />
                  </a>
                </footer>
              </article>
            );
          })}
        </section>

        <section className="catalogue-note">
          <div className="catalogue-note__icon"><Gauge size={20} /></div>
          <div>
            <strong>Verified rates are a requirement for activation.</strong>
            <p>Prices link to first-party provider materials. TokenForge applies a clearly disclosed 2.0× platform charge to standard upstream rates when credits are reserved and settled, with GPT-6 Astra frontier reasoning billed at 1:1 direct provider rates (0% markup). Connect via <code>POST /v1/messages</code> using standard Anthropic headers.</p>
          </div>
          <ThreeDButton href="/signin" />
        </section>
      </main>
      <PublicFooter />
    </div>
  );
}

export function PublicFooter() {
  return (
    <footer className="public-footer">
      <div>
        <span className="footer-brand">
          <TokenForgeGlyph className="public-footer__glyph" />Token<span>Forge</span>
        </span>
        <p>A considered AI gateway for serious building. Credits are digital goods delivered instantly and are non-refundable once consumed.</p>
      </div>
      <div className="footer-links">
        <a href="/models">Models</a>
        <a href="/pricing">Pricing</a>
        <a href="/docs">Documentation</a>
        <a href="/legal/terms">Terms of Service</a>
        <a href="/legal/privacy">Privacy Policy</a>
        <a href="/legal/refund">Refund Policy</a>
        <a href="/legal/acceptable-use">Acceptable Use</a>
        <a
          href="https://discord.gg/8DS5F6sGsY"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1"
          aria-label="Contact TokenForge Support via Discord"
        >
          Contact Details (Discord) <MessageCircle size={13} aria-hidden="true" />
        </a>
      </div>
      <small>© 2026 TokenForge · <a href="/signin">Sign in</a></small>
    </footer>
  );
}
