import { ArrowRight, Braces, CheckCircle2, ChevronLeft, CircleDollarSign, Cpu, ExternalLink, Play, Radio, Route } from "lucide-react";
import { Link } from "wouter";
import { useMemo, useState } from "react";
import { formatTokenForgeCreditRatePerMillion, TOKENFORGE_MODELS, type CatalogueModel } from "@/lib/modelCatalogue";
import { trpc } from "@/lib/trpc";
import "./dashboard-models.css";

export function DashboardModels({ modelId }: { modelId?: string }) {
  const modelAvailability = trpc.developer.modelAvailability.useQuery(undefined, { refetchInterval: 5_000, refetchIntervalInBackground: true });
  const availabilityByModelId = useMemo(() => new Map(modelAvailability.data?.map(item => [item.modelId, item.available]) ?? []), [modelAvailability.data]);
  const model = TOKENFORGE_MODELS.find(entry => entry.id === modelId);
  if (modelId && !model) return <section className="dashboard-models-page"><Link href="/dashboard/models" className="dashboard-model-back"><ChevronLeft size={15} /> Back to models</Link><div className="dashboard-model-not-found"><Cpu size={22} /><h1>Model not found</h1><p>Choose an active text-chat model from the verified TokenForge catalogue.</p></div></section>;
  if (model) return <ModelDetail model={model} available={availabilityByModelId.get(model.id)} />;
  return <ModelList availabilityByModelId={availabilityByModelId} />;
}

function ModelList({ availabilityByModelId }: { availabilityByModelId: Map<string, boolean> }) {
  const activeCount = TOKENFORGE_MODELS.filter(model => availabilityByModelId.get(model.id) === true).length;
  return <section className="dashboard-models-page"><header className="dashboard-models-head"><div><p>VERIFIED TEXT CATALOGUE</p><h1>Models, kept clear.</h1><span>Every configured route has a compatible chat-completions surface and a published TokenForge credit rate including the 3.5× platform charge.</span></div><Link href="/dashboard/playground" className="dashboard-models-primary"><Play size={14} /> Open Playground</Link></header><div className="dashboard-models-live"><i /><span>LIVE AVAILABILITY</span><b>{activeCount} of {TOKENFORGE_MODELS.length} routes currently available</b><small>Availability refreshes automatically. Disabled models cannot accept Playground or API requests.</small></div><div className="dashboard-model-list">{TOKENFORGE_MODELS.map(model => {
    const available = availabilityByModelId.get(model.id);
    const label = available === undefined ? "Checking" : available ? "Available" : "Temporarily unavailable";
    const offlineStyle = available === false ? { background: "rgba(250,169,92,.10)", color: "#ffc477" } : undefined;
    const offlineDotStyle = available === false ? { background: "#f2a45b", boxShadow: "0 0 0 5px rgba(242,164,91,.08)" } : undefined;
    return <Link key={model.id} href={`/dashboard/models/${model.id}`} className="dashboard-model-row"><div className="dashboard-model-row__main"><div><p>{model.eyebrow}</p><h2>{model.name}</h2></div><span className="dashboard-model-state" style={offlineStyle}><i style={offlineDotStyle} /> {label}</span><p>{model.description}</p><div className="dashboard-model-tags">{model.capabilities.map(capability => <span key={capability}>{capability}</span>)}</div></div><dl><div><dt>Input</dt><dd>{formatTokenForgeCreditRatePerMillion(model.inputUsdPerMillion)}<small>/ 1M</small></dd></div><div><dt>Output</dt><dd>{formatTokenForgeCreditRatePerMillion(model.outputUsdPerMillion)}<small>/ 1M</small></dd></div></dl><span className="dashboard-model-row__action">View model <ArrowRight size={14} /></span></Link>;
  })}</div></section>;
}

function ModelDetail({ model, available }: { model: CatalogueModel; available: boolean | undefined }) {
  if (model.id === "glm-5.3") return <Glm53ModelDetail model={model} available={available} />;
  const statusLabel = available === undefined ? "Checking" : available ? "Available" : "Temporarily unavailable";
  const offlineStyle = available === false ? { background: "rgba(250,169,92,.10)", color: "#ffc477" } : undefined;
  const offlineDotStyle = available === false ? { background: "#f2a45b", boxShadow: "0 0 0 5px rgba(242,164,91,.08)" } : undefined;
  return <section className="dashboard-models-page dashboard-model-detail"><Link href="/dashboard/models" className="dashboard-model-back"><ChevronLeft size={15} /> Back to models</Link><header className="dashboard-model-detail__hero"><div className="dashboard-model-detail__hero-copy"><div className="dashboard-model-detail__name"><h1>{model.name}</h1><span style={offlineStyle}><i style={offlineDotStyle} /> {statusLabel}</span></div><code>{model.id}</code><p>{available === false ? "This model has been temporarily disabled by TokenForge administrators. Playground and API requests will return a temporary-unavailability response until it is enabled again." : model.description}</p></div></header><div className="dashboard-model-detail__actions">{available === false ? <span className="dashboard-models-primary opacity-55" aria-disabled="true"><Play size={14} /> Temporarily unavailable</span> : <Link href="/dashboard/playground" className="dashboard-models-primary"><Play size={14} /> Chat in Playground</Link>}<Link href="/docs" className="dashboard-models-secondary"><Braces size={14} /> API request</Link></div><section className="dashboard-model-detail__grid"><article><div className="dashboard-model-detail__icon"><CircleDollarSign size={17} /></div><p>TokenForge credit rate · 3.5× platform charge included</p><h2>Transparent usage pricing</h2><dl><div><dt>Input</dt><dd>{formatTokenForgeCreditRatePerMillion(model.inputUsdPerMillion)} <small>per 1M tokens</small></dd></div><div><dt>Output</dt><dd>{formatTokenForgeCreditRatePerMillion(model.outputUsdPerMillion)} <small>per 1M tokens</small></dd></div></dl><small>Applied to successful requests from provider-reported input and output token counts.</small><a className="dashboard-model-pricing-source" href={model.pricingUrl} target="_blank" rel="noreferrer">{model.pricingSource} <ExternalLink size={12} /></a></article><article><div className="dashboard-model-detail__icon"><CheckCircle2 size={17} /></div><p>Request surface</p><h2>OpenAI-compatible</h2><span>Use the familiar chat-completions shape with the explicit model identifier below.</span><code>model: "{model.id}"</code></article><article><div className="dashboard-model-detail__icon"><Radio size={17} /></div><p>Response behavior</p><h2>Streaming ready</h2><span>Use streaming in the Playground or set <code>stream: true</code> through the public API. Completed requests are metered and logged.</span></article><article><div className="dashboard-model-detail__icon"><Route size={17} /></div><p>Capabilities</p><h2>Designed for building</h2><div className="dashboard-model-tags">{model.capabilities.map(capability => <span key={capability}>{capability}</span>)}</div><Link href="/dashboard/usage">Inspect your usage <ArrowRight size={14} /></Link></article></section></section>;
}

const GLM53_EXAMPLES = [
  { id: "architect", label: "Architecture review", prompt: "Review this service architecture for reliability, security, and scalability. State the highest-impact risks first, then give a staged remediation plan.", detail: "Turn a broad engineering brief into a prioritised review." },
  { id: "code", label: "Code analysis", prompt: "Review this TypeScript function for correctness, edge cases, and maintainability. Return a corrected implementation followed by concise reasoning.", detail: "Use a focused technical request with an explicit output structure." },
  { id: "research", label: "Structured briefing", prompt: "Create a concise decision brief on this topic. Include the objective, assumptions, options, trade-offs, recommendation criteria, and next steps.", detail: "Generate a clear, structured first draft for a decision." },
] as const;

type Glm53Snippet = "curl" | "javascript" | "python";

function Glm53ModelDetail({ model, available }: { model: CatalogueModel; available: boolean | undefined }) {
  const [activeExampleId, setActiveExampleId] = useState<(typeof GLM53_EXAMPLES)[number]["id"]>("architect");
  const [activeSnippet, setActiveSnippet] = useState<Glm53Snippet>("curl");
  const [copied, setCopied] = useState<string | null>(null);
  const activeExample = GLM53_EXAMPLES.find(example => example.id === activeExampleId) ?? GLM53_EXAMPLES[0];
  const statusLabel = available === undefined ? "Checking" : available ? "Available" : "Temporarily unavailable";
  const offlineStyle = available === false ? { background: "rgba(250,169,92,.10)", color: "#ffc477" } : undefined;
  const offlineDotStyle = available === false ? { background: "#f2a45b", boxShadow: "0 0 0 5px rgba(242,164,91,.08)" } : undefined;
  const baseUrl = "https://tokengate-cqt9ivzs.manus.space/v1/chat/completions";
  const payload = JSON.stringify({ model: model.id, messages: [{ role: "user", content: activeExample.prompt }], stream: false }, null, 2);
  const snippets: Record<Glm53Snippet, string> = {
    curl: `curl ${baseUrl} \\\n+  -H "Authorization: Bearer $TOKENFORGE_API_KEY" \\\n+  -H "Content-Type: application/json" \\\n+  -d '${payload}'`,
    javascript: `const response = await fetch("${baseUrl}", {\n  method: "POST",\n  headers: {\n    Authorization: "Bearer " + process.env.TOKENFORGE_API_KEY,\n    "Content-Type": "application/json",\n  },\n  body: JSON.stringify(${payload}),\n});\n\nconsole.log(await response.json());`,
    python: `import os\nimport requests\n\nresponse = requests.post(\n    "${baseUrl}",\n    headers={\n        "Authorization": f"Bearer {os.environ['TOKENFORGE_API_KEY']}",\n        "Content-Type": "application/json",\n    },\n    json=${payload},\n    timeout=110,\n)\nprint(response.json())`,
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

  return <section className="dashboard-models-page dashboard-model-detail glm53-detail">
    <Link href="/dashboard/models" className="dashboard-model-back"><ChevronLeft size={15} /> Back to models</Link>
    <header className="dashboard-model-detail__hero glm53-detail__hero"><div className="dashboard-model-detail__hero-copy"><div className="dashboard-model-detail__name"><h1>{model.name}</h1><span style={offlineStyle}><i style={offlineDotStyle} /> {statusLabel}</span></div><code>{model.id}</code><p>{available === false ? "This model is temporarily disabled by TokenForge administrators. API and Playground requests will return a temporary-unavailability response until it is enabled again." : "A configurable TokenRouter-backed reasoning model for structured analysis, code review, and technical drafting through TokenForge’s OpenAI-compatible API."}</p></div></header>
    <div className="dashboard-model-detail__actions">{available === false ? <span className="dashboard-models-primary opacity-55" aria-disabled="true"><Play size={14} /> Temporarily unavailable</span> : <Link href="/dashboard/playground" className="dashboard-models-primary"><Play size={14} /> Open GLM 5.3 in Playground</Link>}<Link href="/docs" className="dashboard-models-secondary"><Braces size={14} /> API reference</Link></div>
    <section className="glm53-detail__overview"><article><p>TokenForge credit rate</p><h2>Configured-route pricing</h2><dl><div><dt>Input</dt><dd>{formatTokenForgeCreditRatePerMillion(model.inputUsdPerMillion)} <small>per 1M tokens</small></dd></div><div><dt>Output</dt><dd>{formatTokenForgeCreditRatePerMillion(model.outputUsdPerMillion)} <small>per 1M tokens</small></dd></div></dl><small>Includes TokenForge’s 3.5× platform charge. The provider has not yet published a GLM 5.3-specific public rate.</small></article><article><p>Request surface</p><h2>OpenAI-compatible</h2><span>Use <code>{model.id}</code> at the TokenForge chat-completions endpoint. Streaming is supported with <code>stream: true</code>.</span></article></section>
    <section className="glm53-detail__examples" aria-labelledby="glm53-examples-title"><div className="glm53-detail__section-head"><div><p>INTERACTIVE STARTERS</p><h2 id="glm53-examples-title">Shape the request before you send it.</h2><span>Select an example to preview its prompt and update every snippet below.</span></div></div><div className="glm53-detail__example-tabs" role="tablist" aria-label="GLM 5.3 usage examples">{GLM53_EXAMPLES.map(example => <button key={example.id} type="button" role="tab" aria-selected={activeExample.id === example.id} className={activeExample.id === example.id ? "is-active" : ""} onClick={() => setActiveExampleId(example.id)}><b>{example.label}</b><span>{example.detail}</span></button>)}</div><div className="glm53-detail__prompt"><div><p>Selected prompt</p><span>{activeExample.detail}</span></div><pre>{activeExample.prompt}</pre><button type="button" onClick={() => void copy(activeExample.prompt, "prompt")}>{copied === "prompt" ? "Copied" : "Copy prompt"}</button></div></section>
    <section className="glm53-detail__snippets" aria-labelledby="glm53-snippets-title"><div className="glm53-detail__section-head"><div><p>CODE SNIPPETS</p><h2 id="glm53-snippets-title">Call GLM 5.3 from your stack.</h2><span>Keep your TokenForge API key in an environment variable; never put it in browser code.</span></div></div><div className="glm53-detail__snippet-tabs" role="tablist" aria-label="GLM 5.3 code examples">{(["curl", "javascript", "python"] as Glm53Snippet[]).map(language => <button type="button" key={language} role="tab" aria-selected={activeSnippet === language} className={activeSnippet === language ? "is-active" : ""} onClick={() => setActiveSnippet(language)}>{language === "javascript" ? "JavaScript" : language === "curl" ? "cURL" : "Python"}</button>)}</div><div className="glm53-detail__code"><pre><code>{snippets[activeSnippet]}</code></pre><button type="button" onClick={() => void copy(snippets[activeSnippet], activeSnippet)}>{copied === activeSnippet ? "Copied" : "Copy code"}</button></div></section>
  </section>;
}
