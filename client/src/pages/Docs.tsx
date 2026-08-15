import { PublicNav } from "@/components/PublicNav";
import { PublicFooter } from "@/pages/Models";
import { Badge } from "@/components/ui/badge";
import { TOKENFORGE_MODELS } from "@/lib/modelCatalogue";
import { Copy, KeyRound, Terminal, Wifi } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { buildTokenForgeCurl, TOKENFORGE_API_BASE_URL } from "../../../shared/tokenforgeApi";

const example = buildTokenForgeCurl();

const errorRows = [
  ["invalid_api_key", "401", "The supplied TokenForge key is missing, invalid, or revoked."],
  ["model_not_found", "404", "The requested model is not in the active TokenForge catalogue."],
  ["model_unavailable", "503", "The selected route is disabled or overloaded. Choose an available model and retry."],
  ["insufficient_credits", "402", "Your promotional credit balance cannot cover the maximum estimated request cost."],
  ["quota_exceeded", "429", "Your daily request or token allowance has been reached."],
  ["rate_limited", "429", "Slow down briefly and retry using the supplied rate-limit headers."],
  ["provider_unavailable", "503", "The selected model is temporarily unavailable. No silent model substitution occurs."],
];

export default function Docs() {
  const [copied, setCopied] = useState(false);
  const copyExample = async () => {
    await navigator.clipboard.writeText(example);
    setCopied(true);
    toast.success("Example copied to clipboard");
    window.setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="public-page tf-public-surface docs-page">
      <PublicNav />
      <main className="docs-shell">
        <aside className="docs-sidebar">
          <p>Get started</p>
          <a href="#overview">Overview</a><a href="#authentication">Authentication</a><a href="#completions">Chat completions</a><a href="#models">Models</a><a href="#limits">Beta limits</a><a href="#errors">Errors & limits</a>
          <div className="docs-sidebar__hint"><Wifi size={15} /> OpenAI-compatible beta</div>
        </aside>
        <article className="docs-content">
          <div className="page-eyebrow"><span className="status-dot" /> Developer reference</div>
          <h1>Designed to disappear<br />into your existing stack.</h1>
          <p className="docs-lead">TokenForge uses familiar OpenAI-compatible request shapes, precise error responses, and transparent quota headers so you spend less time adapting infrastructure.</p>

          <section id="overview" className="docs-section"><h2>Overview</h2><p>The public API is versioned under <code>/v1</code>. Use <code>{TOKENFORGE_API_BASE_URL}</code> as the hosted base URL. Every response includes a <code>x-request-id</code> header so a request can be traced without retaining your prompt content in product analytics.</p></section>
          <section id="authentication" className="docs-section"><h2><KeyRound size={19} /> Authentication</h2><p>Create a TokenForge key from your dashboard and send it through the standard bearer header. The full secret appears once at creation. After that, only a non-reversible hash is retained.</p><pre><code>Authorization: Bearer tf_live_your_key</code></pre></section>
          <section id="completions" className="docs-section"><h2><Terminal size={19} /> Chat completions</h2><p><code>POST /v1/chat/completions</code> accepts messages and returns the familiar chat-completion response envelope. Set <code>stream: true</code> to receive server-sent events.</p><div className="code-panel"><div className="code-panel__bar"><span>cURL</span><button onClick={copyExample}>{copied ? "Copied" : "Copy"} <Copy size={14} /></button></div><pre><code>{example}</code></pre></div></section>
          <section id="models" className="docs-section"><h2>Models & credit rates</h2><p>Use <code>GET /v1/models</code> to discover models currently enabled for the gateway. TokenForge currently exposes {TOKENFORGE_MODELS.length} verified text-chat routes. Model pages show the final TokenForge credit rate: the source-linked upstream input/output rate multiplied by <strong>1.5</strong> for the TokenForge platform charge. Image, audio, embedding, transcription, and modality-specific routes remain excluded.</p><div className="docs-model-badges">{TOKENFORGE_MODELS.map(model => <Badge key={model.id} variant="secondary">{model.id}</Badge>)}</div><p>Credits are reserved from the maximum requested output allowance before execution, then settled from provider-reported input and output tokens only after a successful request. Failed or cancelled requests release their reservation and receive no usage debit. See the <a href="/models">model catalogue</a> for final credit rates, source-linked upstream rates, and provider details.</p></section>
          <section id="limits" className="docs-section"><h2>Public-beta limits</h2><p>New accounts receive a daily allowance of <strong>100 requests</strong> and <strong>100,000 tokens</strong>, with at most <strong>2 concurrent requests</strong>. The rolling safety circuit allows 20 requests per account and 40 requests per source IP each minute. TokenForge returns <code>429</code>, a <code>retry-after</code> hint, and the standard rate-limit headers when a limit is reached. Capacity is deliberately held in beta until the selected upstream provider’s availability and accepted-use terms are independently verified.</p></section>
          <section id="errors" className="docs-section"><h2>Errors & rate limits</h2><p>Quota and rate-limit responses include <code>x-ratelimit-limit</code>, <code>x-ratelimit-remaining</code>, <code>x-ratelimit-reset</code>, and a stable JSON error type.</p><div className="error-table"><div className="error-table__head"><span>Code</span><span>HTTP</span><span>Meaning</span></div>{errorRows.map(row => <div className="error-table__row" key={row[0]}><code>{row[0]}</code><span>{row[1]}</span><p>{row[2]}</p></div>)}</div></section>
        </article>
      </main>
      <PublicFooter />
    </div>
  );
}
