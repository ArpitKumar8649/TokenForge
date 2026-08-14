import { ArrowRight, Braces, CheckCircle2, ChevronLeft, CircleDollarSign, Cpu, ExternalLink, Play, Radio, Route } from "lucide-react";
import { Link } from "wouter";
import { ProviderMark } from "@/components/ProviderMark";
import { formatUsdPerMillion, TOKENFORGE_MODELS, type CatalogueModel } from "@/lib/modelCatalogue";
import "./dashboard-models.css";
import "./dashboard-model-marks.css";

const FEATURED_PROVIDER_MARKS: Record<string, string> = {
  "glm-5.2": "/manus-storage/zai-mark_d665cf0c.png",
  "grok-4.5": "/manus-storage/grok-mark-source_3ee41dfe.png",
};

function ModelBadge({ model }: { model: CatalogueModel }) {
  const image = FEATURED_PROVIDER_MARKS[model.id];
  return <div className={`dashboard-model-mark dashboard-model-mark--${model.tone}`} aria-label={`${model.provider} provider mark`}>
    {image ? <img src={image} alt={`${model.provider} mark`} /> : <ProviderMark provider={model.provider} fallback={model.providerMark} size={28} />}
  </div>;
}

export function DashboardModels({ modelId }: { modelId?: string }) {
  const model = TOKENFORGE_MODELS.find(entry => entry.id === modelId);
  if (modelId && !model) return <section className="dashboard-models-page"><Link href="/dashboard/models" className="dashboard-model-back"><ChevronLeft size={15} /> Back to models</Link><div className="dashboard-model-not-found"><Cpu size={22} /><h1>Model not found</h1><p>Choose an active text-chat model from the verified TokenForge catalogue.</p></div></section>;
  if (model) return <ModelDetail model={model} />;
  return <ModelList />;
}

function ModelList() {
  return <section className="dashboard-models-page"><header className="dashboard-models-head"><div><p>VERIFIED TEXT CATALOGUE</p><h1>Models, kept clear.</h1><span>Every active route has a compatible chat-completions surface and an exact, source-linked first-party token rate.</span></div><Link href="/dashboard/playground" className="dashboard-models-primary"><Play size={14} /> Open Playground</Link></header><div className="dashboard-models-live"><i /><span>ACTIVE ROUTES</span><b>{TOKENFORGE_MODELS.length} models · one OpenAI-compatible surface</b><small>Image, audio, embedding, transcription, and other modality-specific models remain excluded.</small></div><div className="dashboard-model-list">{TOKENFORGE_MODELS.map(model => <Link key={model.id} href={`/dashboard/models/${model.id}`} className="dashboard-model-row"><ModelBadge model={model} /><div className="dashboard-model-row__main"><div><p>{model.eyebrow}</p><h2>{model.name}</h2></div><span className="dashboard-model-state"><i /> Available</span><p>{model.description}</p><div className="dashboard-model-tags">{model.capabilities.map(capability => <span key={capability}>{capability}</span>)}</div></div><dl><div><dt>Input</dt><dd>{formatUsdPerMillion(model.inputUsdPerMillion)}<small>/ 1M</small></dd></div><div><dt>Output</dt><dd>{formatUsdPerMillion(model.outputUsdPerMillion)}<small>/ 1M</small></dd></div></dl><span className="dashboard-model-row__action">View model <ArrowRight size={14} /></span></Link>)}</div></section>;
}

function ModelDetail({ model }: { model: CatalogueModel }) {
  return <section className="dashboard-models-page dashboard-model-detail"><Link href="/dashboard/models" className="dashboard-model-back"><ChevronLeft size={15} /> Back to models</Link><header className="dashboard-model-detail__hero"><ModelBadge model={model} /><div><div className="dashboard-model-detail__name"><h1>{model.name}</h1><span><i /> Available</span></div><code>{model.id}</code><p>{model.description}</p></div></header><div className="dashboard-model-detail__actions"><Link href="/dashboard/playground" className="dashboard-models-primary"><Play size={14} /> Chat in Playground</Link><Link href="/docs" className="dashboard-models-secondary"><Braces size={14} /> API request</Link></div><section className="dashboard-model-detail__grid"><article><div className="dashboard-model-detail__icon"><CircleDollarSign size={17} /></div><p>TokenForge credit rate</p><h2>Transparent usage pricing</h2><dl><div><dt>Input</dt><dd>{formatUsdPerMillion(model.inputUsdPerMillion)} <small>per 1M tokens</small></dd></div><div><dt>Output</dt><dd>{formatUsdPerMillion(model.outputUsdPerMillion)} <small>per 1M tokens</small></dd></div></dl><small>Applied to successful requests from provider-reported input and output token counts.</small><a className="dashboard-model-pricing-source" href={model.pricingUrl} target="_blank" rel="noreferrer">{model.pricingSource} <ExternalLink size={12} /></a></article><article><div className="dashboard-model-detail__icon"><CheckCircle2 size={17} /></div><p>Request surface</p><h2>OpenAI-compatible</h2><span>Use the familiar chat-completions shape with the explicit model identifier below.</span><code>model: "{model.id}"</code></article><article><div className="dashboard-model-detail__icon"><Radio size={17} /></div><p>Response behavior</p><h2>Streaming ready</h2><span>Use streaming in the Playground or set <code>stream: true</code> through the public API. Completed requests are metered and logged.</span></article><article><div className="dashboard-model-detail__icon"><Route size={17} /></div><p>Capabilities</p><h2>Designed for building</h2><div className="dashboard-model-tags">{model.capabilities.map(capability => <span key={capability}>{capability}</span>)}</div><Link href="/dashboard/usage">Inspect your usage <ArrowRight size={14} /></Link></article></section></section>;
}
