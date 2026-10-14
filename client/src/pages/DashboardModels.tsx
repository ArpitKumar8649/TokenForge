import { ArrowRight, Braces, CheckCircle2, ChevronLeft, CircleDollarSign, Code2, Cpu, ExternalLink, Lock, Play, Radio, Route, ShieldCheck } from "lucide-react";
import { Link } from "wouter";
import { useMemo, useState } from "react";
import { PUBLIC_ORIGIN } from "@shared/const";
import { ProviderMark } from "@/components/ProviderMark";
import { formatTokenForgeCreditRatePerMillion, TOKENFORGE_MODELS, type CatalogueModel } from "@/lib/modelCatalogue";
import { useDynamicModelPricing } from "@/lib/useDynamicModelPricing";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import "./dashboard-models.css";

const TIER_ORDER: Record<string, number> = {
  free: 0,
  starter: 1,
  pro: 2,
  max: 3,
  power: 4,
  ultra: 5,
};

export function DashboardModels({ modelId }: { modelId?: string }) {
  const { user } = useAuth();
  const userTier = (user as any)?.tier ?? "free";
  const modelAvailability = trpc.developer.modelAvailability.useQuery(undefined, {
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
          minTier: (item as any).minTier ?? "free",
          isTokenPlan: (item as any).isTokenPlan ?? false,
          isPayg: (item as any).isPayg ?? false,
          isBundle: (item as any).isBundle !== false,
        },
      ]) ?? []
    );
  }, [modelAvailability.data]);

  const model = TOKENFORGE_MODELS.find(entry => entry.id === modelId);
  if (modelId && !model) return <section className="dashboard-models-page"><Link href="/dashboard/models" className="dashboard-model-back"><ChevronLeft size={15} /> Back to models</Link><div className="dashboard-model-not-found"><Cpu size={22} /><h1>Model not found</h1><p>Choose an active text-chat model from the verified TokenForge catalogue.</p></div></section>;
  if (model) return <ModelDetail model={model} meta={modelMetaMap.get(model.id)} userTier={userTier} />;
  return <ModelList modelMetaMap={modelMetaMap} userTier={userTier} />;
}

function ModelList({ modelMetaMap, userTier }: { modelMetaMap: Map<string, { available: boolean; minTier: string; isTokenPlan?: boolean }>; userTier: string }) {
  const { getRates } = useDynamicModelPricing();
  const [filter, setFilter] = useState<"all" | "free" | "paid" | "token_plan" | "accessible">("all");

  const userRank = TIER_ORDER[userTier] ?? 0;
  const activeCount = TOKENFORGE_MODELS.filter(model => modelMetaMap.get(model.id)?.available === true).length;

  const filteredModels = useMemo(() => {
    return TOKENFORGE_MODELS.filter(model => {
      const meta = modelMetaMap.get(model.id);
      const minTier = meta?.minTier ?? "free";
      const modelRank = TIER_ORDER[minTier] ?? 0;
      if (filter === "free") return minTier === "free";
      if (filter === "paid") return minTier !== "free";
      if (filter === "token_plan") return meta?.isTokenPlan === true;
      if (filter === "accessible") return userRank >= modelRank;
      return true;
    });
  }, [modelMetaMap, filter, userRank]);

  const freeCount = TOKENFORGE_MODELS.filter(m => (modelMetaMap.get(m.id)?.minTier ?? "free") === "free").length;
  const tokenPlanCount = TOKENFORGE_MODELS.filter(m => modelMetaMap.get(m.id)?.isTokenPlan === true).length;
  const accessibleCount = TOKENFORGE_MODELS.filter(m => userRank >= (TIER_ORDER[modelMetaMap.get(m.id)?.minTier ?? "free"] ?? 0)).length;

  return (
    <section className="dashboard-models-page">
      <header className="dashboard-models-head">
        <div>
          <p>VERIFIED TEXT CATALOGUE</p>
          <h1>Models, kept clear.</h1>
          <span>Every configured route has an Anthropic-compatible Messages surface (<code>/v1/messages</code>) and a published TokenForge credit rate.</span>
        </div>
        <Link href="/dashboard/playground" className="dashboard-models-primary"><Play size={14} /> Open Playground</Link>
      </header>

      <div className="dashboard-models-live">
        <i />
        <span>LIVE AVAILABILITY & TIER ACCESS</span>
        <b>{activeCount} of {TOKENFORGE_MODELS.length} routes currently available</b>
        <small>Your account tier: <strong className="uppercase text-[#c9ff73]">{userTier}</strong> ({accessibleCount} models unlocked). Upgraded tiers unlock frontier models.</small>
      </div>

      {/* Filter tab bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 my-4 p-2.5 rounded-xl border border-white/10 bg-[#09090b]">
        <div className="flex flex-wrap items-center gap-1.5" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={filter === "all"}
            onClick={() => setFilter("all")}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
              filter === "all"
                ? "bg-[#c9ff73]/15 text-[#c9ff73] border border-[#c9ff73]/30"
                : "text-[#9ea0af] hover:text-white border border-transparent"
            }`}
          >
            All Models ({TOKENFORGE_MODELS.length})
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={filter === "accessible"}
            onClick={() => setFilter("accessible")}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 ${
              filter === "accessible"
                ? "bg-blue-500/20 text-blue-300 border border-blue-500/40"
                : "text-[#9ea0af] hover:text-blue-300 border border-transparent"
            }`}
          >
            Unlocked for You ({accessibleCount})
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={filter === "free"}
            onClick={() => setFilter("free")}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 ${
              filter === "free"
                ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                : "text-[#9ea0af] hover:text-emerald-300 border border-transparent"
            }`}
          >
            <ShieldCheck size={13} className="text-emerald-400" /> Free Tier ({freeCount})
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={filter === "paid"}
            onClick={() => setFilter("paid")}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 ${
              filter === "paid"
                ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                : "text-[#9ea0af] hover:text-amber-300 border border-transparent"
            }`}
          >
            <Lock size={13} className="text-amber-400" /> Paid Tiers ({TOKENFORGE_MODELS.length - freeCount})
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={filter === "token_plan"}
            onClick={() => setFilter("token_plan")}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 ${
              filter === "token_plan"
                ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40"
                : "text-[#9ea0af] hover:text-cyan-300 border border-transparent"
            }`}
          >
            <Code2 size={13} className="text-cyan-400" /> Token Plan ({tokenPlanCount})
          </button>
        </div>
        <span className="text-xs text-[#9ea0af]">Showing {filteredModels.length} models</span>
      </div>

      <div className="dashboard-model-list">
        {filteredModels.map(model => {
          const meta = modelMetaMap.get(model.id);
          const available = meta?.available;
          const minTier = meta?.minTier ?? "free";
          const modelRank = TIER_ORDER[minTier] ?? 0;
          const isUnlocked = userRank >= modelRank;
          const isFree = minTier === "free";
          const isTokenPlan = meta?.isTokenPlan === true;

          const label = available === undefined ? "Checking" : available ? "Available" : "Temporarily unavailable";
          const offlineStyle = available === false ? { background: "rgba(250,169,92,.10)", color: "#ffc477" } : undefined;
          const offlineDotStyle = available === false ? { background: "#f2a45b", boxShadow: "0 0 0 5px rgba(242,164,91,.08)" } : undefined;
          const rates = getRates(model.id, model.inputUsdPerMillion, model.outputUsdPerMillion);

          return (
            <Link key={model.id} href={`/dashboard/models/${model.id}`} className="dashboard-model-row">
              <span className={`dashboard-model-mark dashboard-model-mark--${model.tone}`}>
                <ProviderMark provider={model.provider} fallback={model.providerMark} size={28} />
              </span>
              <div className="dashboard-model-row__main">
                <div className="flex flex-wrap items-center gap-2">
                  <p>{model.eyebrow}</p>
                  {isTokenPlan && (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
                      <Code2 size={11} className="text-cyan-400" /> Token Plan
                    </span>
                  )}
                  {isFree ? (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                      <ShieldCheck size={11} /> Free Tier
                    </span>
                  ) : isUnlocked ? (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-blue-500/15 text-blue-300 border border-blue-500/30 uppercase">
                      <ShieldCheck size={11} /> {minTier}+ (Unlocked)
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/30 uppercase">
                      <Lock size={11} /> Requires {minTier}+
                    </span>
                  )}
                </div>
                <h2>{model.name}</h2>
                <span className="dashboard-model-state" style={offlineStyle}>
                  <i style={offlineDotStyle} /> {label}
                </span>
                <p>{model.description}</p>
                <div className="dashboard-model-tags">
                  {model.capabilities.map(capability => <span key={capability}>{capability}</span>)}
                </div>
              </div>
              <dl>
                <div><dt>Input</dt><dd>{rates.inputFormatted}<small>/ 1M</small></dd></div>
                <div><dt>Output</dt><dd>{rates.outputFormatted}<small>/ 1M</small></dd></div>
              </dl>
              <span className="dashboard-model-row__action">View model <ArrowRight size={14} /></span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

function ModelDetail({ model, meta, userTier }: { model: CatalogueModel; meta?: { available: boolean; minTier: string; isTokenPlan?: boolean }; userTier: string }) {
  const { getRates } = useDynamicModelPricing();
  const available = meta?.available;
  const minTier = meta?.minTier ?? "free";
  const userRank = TIER_ORDER[userTier] ?? 0;
  const modelRank = TIER_ORDER[minTier] ?? 0;
  const isUnlocked = userRank >= modelRank;
  const isTokenPlan = meta?.isTokenPlan === true;

  if (model.id === "glm-5.3") return <Glm53ModelDetail model={model} available={available} minTier={minTier} isUnlocked={isUnlocked} userTier={userTier} />;
  
  const statusLabel = available === undefined ? "Checking" : available ? "Available" : "Temporarily unavailable";
  const offlineStyle = available === false ? { background: "rgba(250,169,92,.10)", color: "#ffc477" } : undefined;
  const offlineDotStyle = available === false ? { background: "#f2a45b", boxShadow: "0 0 0 5px rgba(242,164,91,.08)" } : undefined;
  const rates = getRates(model.id, model.inputUsdPerMillion, model.outputUsdPerMillion);

  return (
    <section className="dashboard-models-page dashboard-model-detail">
      <Link href="/dashboard/models" className="dashboard-model-back"><ChevronLeft size={15} /> Back to models</Link>
      <header className="dashboard-model-detail__hero">
        <div className="dashboard-model-detail__hero-copy">
          <div className="dashboard-model-detail__name flex-wrap gap-2">
            <h1>{model.name}</h1>
            <span style={offlineStyle}><i style={offlineDotStyle} /> {statusLabel}</span>
            {isTokenPlan && (
              <span className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-bold bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
                <Code2 size={13} className="text-cyan-400" /> Token Plan Enabled
              </span>
            )}
            {minTier === "free" ? (
              <span className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                <ShieldCheck size={13} /> Free Tier
              </span>
            ) : isUnlocked ? (
              <span className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-semibold bg-blue-500/15 text-blue-300 border border-blue-500/30 uppercase">
                <ShieldCheck size={13} /> {minTier}+ (Unlocked)
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/30 uppercase">
                <Lock size={13} /> Requires {minTier}+ Tier
              </span>
            )}
          </div>
          <code>{model.id}</code>
          <p>{available === false ? "This model has been temporarily disabled by TokenForge administrators. Playground and API requests will return a temporary-unavailability response until it is enabled again." : model.description}</p>
        </div>
      </header>

      <div className="dashboard-model-detail__actions">
        {available === false ? (
          <span className="dashboard-models-primary opacity-55" aria-disabled="true"><Play size={14} /> Temporarily unavailable</span>
        ) : !isUnlocked ? (
          <Link href="/dashboard/pricing" className="dashboard-models-primary bg-amber-500 hover:bg-amber-400 text-black">
            <Lock size={14} /> Upgrade to {minTier.toUpperCase()} to Access
          </Link>
        ) : (
          <Link href="/dashboard/playground" className="dashboard-models-primary"><Play size={14} /> Chat in Playground</Link>
        )}
        <Link href="/docs" className="dashboard-models-secondary"><Braces size={14} /> API request</Link>
      </div>

      <section className="dashboard-model-detail__grid">
        <article>
          <div className="dashboard-model-detail__icon"><CircleDollarSign size={17} /></div>
          <p>{rates.isCustom ? "TokenForge credit rate · Custom direct rate (0% markup)" : model.id === "gpt-6-astra" ? "TokenForge credit rate · 1:1 direct provider rate (0% markup)" : "TokenForge credit rate · 2.0× platform charge included"}</p>
          <h2>Transparent usage pricing</h2>
          <dl>
            <div><dt>Input</dt><dd>{rates.inputFormatted} <small>per 1M tokens</small></dd></div>
            <div><dt>Output</dt><dd>{rates.outputFormatted} <small>per 1M tokens</small></dd></div>
          </dl>
          <small>Applied to successful requests from provider-reported input and output token counts.</small>
          <a className="dashboard-model-pricing-source" href={model.pricingUrl} target="_blank" rel="noreferrer">{model.pricingSource} <ExternalLink size={12} /></a>
        </article>

        <article>
          <div className="dashboard-model-detail__icon"><CheckCircle2 size={17} /></div>
          <p>Request surface</p>
          <h2>Anthropic Messages API</h2>
          <span>Use <code>POST /v1/messages</code> with Anthropic headers and the model identifier below.</span>
          <code>model: "{model.id}"</code>
        </article>

        <article>
          <div className="dashboard-model-detail__icon"><Radio size={17} /></div>
          <p>Tier access requirement</p>
          <h2>{minTier === "free" ? "Free Tier & Above" : `${minTier.toUpperCase()}+ Plan Required`}</h2>
          <span>Your current tier is <strong className="uppercase text-[#c9ff73]">{userTier}</strong>. {isUnlocked ? "This model is unlocked for your account." : `Upgrade your plan to ${minTier.toUpperCase()} or higher to access this model.`}</span>
        </article>

        <article>
          <div className="dashboard-model-detail__icon"><Route size={17} /></div>
          <p>Capabilities</p>
          <h2>Designed for building</h2>
          <div className="dashboard-model-tags">{model.capabilities.map(capability => <span key={capability}>{capability}</span>)}</div>
          <Link href="/dashboard/usage">Inspect your usage <ArrowRight size={14} /></Link>
        </article>
      </section>
    </section>
  );
}

const GLM53_EXAMPLES = [
  { id: "architect", label: "Architecture review", prompt: "Review this service architecture for reliability, security, and scalability. State the highest-impact risks first, then give a staged remediation plan.", detail: "Turn a broad engineering brief into a prioritised review." },
  { id: "code", label: "Code analysis", prompt: "Review this TypeScript function for correctness, edge cases, and maintainability. Return a corrected implementation followed by concise reasoning.", detail: "Use a focused technical request with an explicit output structure." },
  { id: "research", label: "Structured briefing", prompt: "Create a concise decision brief on this topic. Include the objective, assumptions, options, trade-offs, recommendation criteria, and next steps.", detail: "Generate a clear, structured first draft for a decision." },
] as const;

type Glm53Snippet = "curl" | "javascript" | "python";

function Glm53ModelDetail({
  model,
  available,
  minTier = "free",
  isUnlocked = true,
  userTier = "free",
}: {
  model: CatalogueModel;
  available: boolean | undefined;
  minTier?: string;
  isUnlocked?: boolean;
  userTier?: string;
}) {
  const [activeExampleId, setActiveExampleId] = useState<(typeof GLM53_EXAMPLES)[number]["id"]>("architect");
  const [activeSnippet, setActiveSnippet] = useState<Glm53Snippet>("curl");
  const [copied, setCopied] = useState<string | null>(null);
  const activeExample = GLM53_EXAMPLES.find(example => example.id === activeExampleId) ?? GLM53_EXAMPLES[0];
  const statusLabel = available === undefined ? "Checking" : available ? "Available" : "Temporarily unavailable";
  const offlineStyle = available === false ? { background: "rgba(250,169,92,.10)", color: "#ffc477" } : undefined;
  const offlineDotStyle = available === false ? { background: "#f2a45b", boxShadow: "0 0 0 5px rgba(242,164,91,.08)" } : undefined;
  
  const baseUrl = `${PUBLIC_ORIGIN}/v1/messages`;
  const payload = JSON.stringify({
    model: model.id,
    max_tokens: 1024,
    messages: [{ role: "user", content: activeExample.prompt }],
  }, null, 2);

  const snippets: Record<Glm53Snippet, string> = {
    curl: `curl ${baseUrl} \\\n  -H "x-api-key: $TOKENFORGE_API_KEY" \\\n  -H "anthropic-version: 2023-06-01" \\\n  -H "Content-Type: application/json" \\\n  -d '${payload}'`,
    javascript: `import Anthropic from "@anthropic-ai/sdk";\n\nconst client = new Anthropic({\n  apiKey: process.env.TOKENFORGE_API_KEY,\n  baseURL: "${PUBLIC_ORIGIN}",\n});\n\nconst message = await client.messages.create({\n  model: "${model.id}",\n  max_tokens: 1024,\n  messages: [{ role: "user", content: ${JSON.stringify(activeExample.prompt)} }],\n});\n\nconsole.log(message.content[0]?.text);`,
    python: `import anthropic\n\nclient = anthropic.Anthropic(\n    api_key=os.environ["TOKENFORGE_API_KEY"],\n    base_url="${PUBLIC_ORIGIN}",\n)\n\nmessage = client.messages.create(\n    model="${model.id}",\n    max_tokens=1024,\n    messages=[{"role": "user", "content": ${JSON.stringify(activeExample.prompt)}}],\n)\nprint(message.content[0].text)`,
  };

  const copy = async (value: string, key: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(key);
      window.setTimeout(() => setCopied(current => current === key ? null : current), 1_800);
    } catch {
      setCopied(null);
    }
  };

  const { getRates } = useDynamicModelPricing();
  const rates = getRates(model.id, model.inputUsdPerMillion, model.outputUsdPerMillion);

  return (
    <section className="dashboard-models-page dashboard-model-detail glm53-detail">
      <Link href="/dashboard/models" className="dashboard-model-back"><ChevronLeft size={15} /> Back to models</Link>
      <header className="dashboard-model-detail__hero glm53-detail__hero">
        <div className="dashboard-model-detail__hero-copy">
          <div className="dashboard-model-detail__name">
            <h1>{model.name}</h1>
            <span style={offlineStyle}><i style={offlineDotStyle} /> {statusLabel}</span>
            {minTier === "free" ? (
              <span className="ml-2 inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                <ShieldCheck size={13} /> Free Tier
              </span>
            ) : isUnlocked ? (
              <span className="ml-2 inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-semibold bg-blue-500/15 text-blue-300 border border-blue-500/30 uppercase">
                <ShieldCheck size={13} /> {minTier}+ (Unlocked)
              </span>
            ) : (
              <span className="ml-2 inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/30 uppercase">
                <Lock size={13} /> Requires {minTier}+ Tier
              </span>
            )}
          </div>
          <code>{model.id}</code>
          <p>{available === false ? "This model is temporarily disabled by TokenForge administrators. API and Playground requests will return a temporary-unavailability response until it is enabled again." : "A configurable TokenRouter-backed reasoning model for structured analysis, code review, and technical drafting through TokenForge’s Anthropic-compatible Messages API."}</p>
        </div>
      </header>

      <div className="dashboard-model-detail__actions">
        {available === false ? (
          <span className="dashboard-models-primary opacity-55" aria-disabled="true"><Play size={14} /> Temporarily unavailable</span>
        ) : !isUnlocked ? (
          <Link href="/dashboard/pricing" className="dashboard-models-primary bg-amber-500 hover:bg-amber-400 text-black">
            <Lock size={14} /> Upgrade to {minTier.toUpperCase()} to Access
          </Link>
        ) : (
          <Link href="/dashboard/playground" className="dashboard-models-primary"><Play size={14} /> Open GLM 5.3 in Playground</Link>
        )}
        <Link href="/docs" className="dashboard-models-secondary"><Braces size={14} /> API reference</Link>
      </div>

      <section className="glm53-detail__overview">
        <article>
          <p>{rates.isCustom ? "TokenForge credit rate · Custom direct rate (0% markup)" : "TokenForge credit rate"}</p>
          <h2>Configured-route pricing</h2>
          <dl>
            <div><dt>Input</dt><dd>{rates.inputFormatted} <small>per 1M tokens</small></dd></div>
            <div><dt>Output</dt><dd>{rates.outputFormatted} <small>per 1M tokens</small></dd></div>
          </dl>
          <small>{rates.isCustom ? "Direct administrator price applied without platform charge." : "Includes TokenForge’s standard platform charge."}</small>
        </article>
        <article>
          <p>Request surface</p>
          <h2>Anthropic Messages API</h2>
          <span>Use <code>{model.id}</code> at the TokenForge <code>POST /v1/messages</code> endpoint with standard Anthropic SDK or headers.</span>
        </article>
      </section>

      <section className="glm53-detail__examples" aria-labelledby="glm53-examples-title">
        <div className="glm53-detail__section-head">
          <div>
            <p>INTERACTIVE STARTERS</p>
            <h2 id="glm53-examples-title">Shape the request before you send it.</h2>
            <span>Select an example to preview its prompt and update every snippet below.</span>
          </div>
        </div>
        <div className="glm53-detail__example-tabs" role="tablist" aria-label="GLM 5.3 usage examples">
          {GLM53_EXAMPLES.map(example => (
            <button key={example.id} type="button" role="tab" aria-selected={activeExample.id === example.id} className={activeExample.id === example.id ? "is-active" : ""} onClick={() => setActiveExampleId(example.id)}>
              <b>{example.label}</b>
              <span>{example.detail}</span>
            </button>
          ))}
        </div>
        <div className="glm53-detail__prompt">
          <div>
            <p>Selected prompt</p>
            <span>{activeExample.detail}</span>
          </div>
          <pre>{activeExample.prompt}</pre>
          <button type="button" onClick={() => void copy(activeExample.prompt, "prompt")}>{copied === "prompt" ? "Copied" : "Copy prompt"}</button>
        </div>
      </section>

      <section className="glm53-detail__snippets" aria-labelledby="glm53-snippets-title">
        <div className="glm53-detail__section-head">
          <div>
            <p>CODE SNIPPETS</p>
            <h2 id="glm53-snippets-title">Call GLM 5.3 from your stack.</h2>
            <span>Connect via the Anthropic Messages endpoint using standard Anthropic headers. Keep your TokenForge API key secure.</span>
          </div>
        </div>
        <div className="glm53-detail__snippet-tabs" role="tablist" aria-label="GLM 5.3 code examples">
          {(["curl", "javascript", "python"] as Glm53Snippet[]).map(language => (
            <button key={language} type="button" role="tab" aria-selected={activeSnippet === language} className={activeSnippet === language ? "is-active" : ""} onClick={() => setActiveSnippet(language)}>
              {language === "javascript" ? "JavaScript (@anthropic-ai/sdk)" : language === "curl" ? "cURL" : "Python (anthropic)"}
            </button>
          ))}
        </div>
        <div className="glm53-detail__code">
          <pre><code>{snippets[activeSnippet]}</code></pre>
          <button type="button" onClick={() => void copy(snippets[activeSnippet], activeSnippet)}>{copied === activeSnippet ? "Copied" : "Copy code"}</button>
        </div>
      </section>
    </section>
  );
}
