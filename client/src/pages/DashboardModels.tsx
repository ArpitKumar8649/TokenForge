import { TokenForgeGlyph } from "@/components/TokenForgeGlyph";
import { ArrowRight, Braces, CheckCircle2, ChevronLeft, CircleDollarSign, Cpu, Play, Radio, Route } from "lucide-react";
import { Link } from "wouter";
import "./dashboard-models.css";

const DASHBOARD_MODELS = [
  { id: "glm-5.2", name: "GLM-5.2", provider: "Z.AI", status: "Available", eyebrow: "Long-horizon intelligence", description: "A focused option for complex engineering, coding, and extended-context work where careful reasoning matters.", input: "$1.40", output: "$4.40", capabilities: ["Reasoning", "Long context", "Streaming", "Coding"] },
  { id: "grok-4.5", name: "Grok 4.5", provider: "xAI", status: "Available", eyebrow: "Fast engineering reasoning", description: "A reasoning-forward option for code, agentic workflows, and practical knowledge work in the same dependable request surface.", input: "$2.00", output: "$6.00", capabilities: ["Reasoning", "Agentic", "Streaming", "Coding"] },
] as const;

function ModelBadge({ model }: { model: typeof DASHBOARD_MODELS[number] }) {
  return <div className={`dashboard-model-mark dashboard-model-mark--${model.id === "glm-5.2" ? "lime" : "cyan"}`}><TokenForgeGlyph className="size-7" label={`${model.name} in TokenForge`} /></div>;
}

export function DashboardModels({ modelId }: { modelId?: string }) {
  const model = DASHBOARD_MODELS.find(entry => entry.id === modelId);
  if (modelId && !model) return <section className="dashboard-models-page"><Link href="/dashboard/models" className="dashboard-model-back"><ChevronLeft size={15} /> Back to models</Link><div className="dashboard-model-not-found"><Cpu size={22} /><h1>Model not found</h1><p>Choose one of the two models in the active TokenForge catalogue.</p></div></section>;
  if (model) return <ModelDetail model={model} />;
  return <ModelList />;
}

function ModelList() {
  return <section className="dashboard-models-page"><header className="dashboard-models-head"><div><p>CURATED CATALOGUE</p><h1>Models, kept clear.</h1><span>Inspect the two active routes, then move directly into an authenticated test session.</span></div><Link href="/dashboard/playground" className="dashboard-models-primary"><Play size={14} /> Open Playground</Link></header><div className="dashboard-models-live"><i /><span>ACTIVE ROUTES</span><b>Two models · one OpenAI-compatible surface</b><small>Availability is confirmed again when a request begins.</small></div><div className="dashboard-model-list">{DASHBOARD_MODELS.map(model => <Link key={model.id} href={`/dashboard/models/${model.id}`} className="dashboard-model-row"><ModelBadge model={model} /><div className="dashboard-model-row__main"><div><p>{model.eyebrow}</p><h2>{model.name}</h2></div><span className="dashboard-model-state"><i /> {model.status}</span><p>{model.description}</p><div className="dashboard-model-tags">{model.capabilities.map(capability => <span key={capability}>{capability}</span>)}</div></div><dl><div><dt>Input</dt><dd>{model.input}<small>/ 1M</small></dd></div><div><dt>Output</dt><dd>{model.output}<small>/ 1M</small></dd></div></dl><span className="dashboard-model-row__action">View model <ArrowRight size={14} /></span></Link>)}</div></section>;
}

function ModelDetail({ model }: { model: typeof DASHBOARD_MODELS[number] }) {
  return <section className="dashboard-models-page dashboard-model-detail"><Link href="/dashboard/models" className="dashboard-model-back"><ChevronLeft size={15} /> Back to models</Link><header className="dashboard-model-detail__hero"><ModelBadge model={model} /><div><div className="dashboard-model-detail__name"><h1>{model.name}</h1><span><i /> {model.status}</span></div><code>{model.id}</code><p>{model.description}</p></div></header><div className="dashboard-model-detail__actions"><Link href="/dashboard/playground" className="dashboard-models-primary"><Play size={14} /> Chat in Playground</Link><Link href="/docs" className="dashboard-models-secondary"><Braces size={14} /> API request</Link></div><section className="dashboard-model-detail__grid"><article><div className="dashboard-model-detail__icon"><CircleDollarSign size={17} /></div><p>TokenForge credit rate</p><h2>Transparent usage pricing</h2><dl><div><dt>Input</dt><dd>{model.input} <small>per 1M tokens</small></dd></div><div><dt>Output</dt><dd>{model.output} <small>per 1M tokens</small></dd></div></dl><small>Applied to successful requests using the provider-reported input and output token counts.</small></article><article><div className="dashboard-model-detail__icon"><CheckCircle2 size={17} /></div><p>Request surface</p><h2>OpenAI-compatible</h2><span>Use the same familiar chat-completions shape with the explicit model identifier below.</span><code>model: "{model.id}"</code></article><article><div className="dashboard-model-detail__icon"><Radio size={17} /></div><p>Response behavior</p><h2>Streaming ready</h2><span>Use streaming in the Playground or set <code>stream: true</code> through the public API. Completed requests are metered and logged.</span></article><article><div className="dashboard-model-detail__icon"><Route size={17} /></div><p>Capabilities</p><h2>Designed for building</h2><div className="dashboard-model-tags">{model.capabilities.map(capability => <span key={capability}>{capability}</span>)}</div><Link href="/dashboard/usage">Inspect your usage <ArrowRight size={14} /></Link></article></section></section>;
}
