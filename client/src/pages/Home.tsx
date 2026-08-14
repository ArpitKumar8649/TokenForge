import { PublicNav } from "@/components/PublicNav";
import { Button } from "@/components/ui/button";
import { startLogin } from "@/const";
import { ArrowRight, Braces, Check, Code2, Copy, Gauge, Layers3, Loader2, LockKeyhole, Orbit, ShieldCheck, Sparkles, Terminal } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Link } from "wouter";

const apiExample = `from openai import OpenAI

client = OpenAI(
  base_url="https://api.tokenforge.dev/v1",
  api_key="tf_live_your_key"
)

stream = client.chat.completions.create(
  model="glm-5.2",
  messages=[{"role": "user", "content": "Design a calmer onboarding flow."}],
  stream=True,
)`;

/**
 * All content in this page are only for example, replace with your own feature implementation
 * When building pages, remember your instructions in Frontend Workflow, Frontend Best Practices, Design Guide and Common Pitfalls
 */
export default function Home() {
  const [copied, setCopied] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const copyCode = async () => {
    await navigator.clipboard.writeText(apiExample);
    setCopied(true);
    toast.success("Quick-start copied");
    window.setTimeout(() => setCopied(false), 1500);
  };
  const begin = () => {
    setIsStarting(true);
    window.setTimeout(() => startLogin(), 250);
  };

  return (
    <div className="public-page home-page">
      <PublicNav />
      <main>
        <section className="hero-section">
          <div className="hero-orbit hero-orbit--one" />
          <div className="hero-orbit hero-orbit--two" />
          <div className="hero-copy">
            <div className="page-eyebrow hero-eyebrow"><span className="status-dot" /> Purposefully small, ready to scale</div>
            <h1>API infrastructure<br />with <em>more signal.</em></h1>
            <p className="hero-description">A refined gateway for two exceptional models. Familiar OpenAI-compatible requests, accountable quotas, and a developer experience that stays out of your way.</p>
            <div className="hero-actions">
              <Button className="hero-primary" onClick={begin} disabled={isStarting}>{isStarting ? <><Loader2 className="animate-spin" size={16} /> Preparing workspace</> : <>Create your workspace <ArrowRight size={16} /></>}</Button>
              <Link href="/docs" className="hero-secondary"><Terminal size={16} /> Read the docs</Link>
            </div>
            <div className="trust-row"><span><Check size={14} /> OpenAI-compatible</span><span><Check size={14} /> Server-side protection</span><span><Check size={14} /> Transparent limits</span></div>
          </div>
          <div className="hero-console" aria-label="TokenForge live request example">
            <div className="console-topbar"><div className="console-lights"><i /><i /><i /></div><span>request — live</span><span className="console-status"><i /> ready</span></div>
            <div className="console-body">
              <div className="console-line"><span className="line-dim">POST</span><span>/v1/chat/completions</span></div>
              <div className="console-request"><span className="code-key">model</span><span>: </span><span className="code-string">"glm-5.2"</span><br /><span className="code-key">stream</span><span>: </span><span className="code-value">true</span><br /><span className="code-key">messages</span><span>: [</span><br /><span className="indent"><span className="code-key">role</span>: <span className="code-string">"user"</span>,</span><br /><span className="indent"><span className="code-key">content</span>: <span className="code-string">"Map the tradeoffs…"</span></span><br />]</div>
              <div className="console-divider" />
              <div className="console-response"><span className="response-label">200 · streaming response</span><p>Clear interfaces invite<br /><strong>more thoughtful systems.</strong><span className="cursor" /></p></div>
            </div>
            <div className="console-metrics"><span><Gauge size={14} /> request metered</span><span>tf_req_8Q2…</span></div>
          </div>
        </section>
        <section className="proof-strip"><p>Designed for the parts of AI infrastructure that should feel obvious.</p><div><span><LockKeyhole size={17} /> Key security</span><span><Layers3 size={17} /> Explicit routing</span><span><Sparkles size={17} /> Quietly elegant</span></div></section>
        <section className="feature-section"><div className="section-intro"><div><div className="page-eyebrow"><span className="status-dot" /> A considered foundation</div><h2>Built for product teams<br />with taste <em>and standards.</em></h2></div></div><div className="feature-grid"><article className="feature-card feature-card--wide"><div className="feature-icon"><Braces size={19} /></div><p className="feature-number">01</p><h3>Familiar by default.</h3><p>Plug into a clean OpenAI-compatible surface with streaming responses, stable error objects, and request IDs that make every interaction traceable.</p><div className="mini-code">client.chat.completions.create(…)</div></article><article className="feature-card"><div className="feature-icon"><ShieldCheck size={19} /></div><p className="feature-number">02</p><h3>Security with restraint.</h3><p>API keys appear once, are hashed immediately, and can be rotated or revoked without a support ticket.</p></article><article className="feature-card"><div className="feature-icon"><Gauge size={19} /></div><p className="feature-number">03</p><h3>Limits you can trust.</h3><p>Clearly surfaced request and token allowances make capacity feel understandable, not arbitrary.</p></article></div></section>
        <section className="models-section"><div className="models-section__head"><div><div className="page-eyebrow"><span className="status-dot" /> Curated, not crowded</div><h2>A smaller catalogue.<br /><em>A sharper point of view.</em></h2></div><Link href="/models" className="text-link">Explore model notes <ArrowRight size={15} /></Link></div><div className="model-preview-grid"><article><div className="model-preview__top"><span className="model-sigil model-sigil--violet"><Orbit size={20} /></span><span>01</span></div><p>Long-horizon intelligence</p><h3>GLM-5.2</h3><span className="model-id">glm-5.2</span><div className="preview-tags"><span>Reasoning</span><span>Long context</span><span>Streaming</span></div></article><article><div className="model-preview__top"><span className="model-sigil model-sigil--cyan"><Code2 size={20} /></span><span>02</span></div><p>Fast engineering reasoning</p><h3>Grok 4.5</h3><span className="model-id">grok-4.5</span><div className="preview-tags"><span>Agentic</span><span>Coding</span><span>Streaming</span></div></article></div></section>
        <section className="quickstart-section"><div className="quickstart-copy"><div className="page-eyebrow"><span className="status-dot" /> First request, refined</div><h2>Good defaults make<br />fast starts feel <em>calm.</em></h2><p>Create one key. Choose one model. Keep your existing client. The integration should take minutes, not a migration plan.</p><Button variant="outline" onClick={begin}>Get a key <ArrowRight size={15} /></Button></div><div className="code-panel home-code"><div className="code-panel__bar"><span>Python</span><button onClick={copyCode}>{copied ? "Copied" : "Copy"} <Copy size={14} /></button></div><pre><code>{apiExample}</code></pre></div></section>
        <section className="closing-section"><div className="closing-pulse"><span /><span /><span /></div><p>TokenForge is in a deliberately controlled beta.</p><h2>Build something<br /><em>considered.</em></h2><Button onClick={begin} disabled={isStarting}>{isStarting ? <Loader2 className="animate-spin" size={16} /> : "Request access"} <ArrowRight size={16} /></Button></section>
      </main>
      <footer className="public-footer"><div><span className="footer-brand">Token<span>Forge</span></span><p>A quieter kind of API gateway.</p></div><div className="footer-links"><a href="/docs">Documentation</a><a href="/legal/terms">Terms</a><a href="/legal/privacy">Privacy</a><a href="/legal/acceptable-use">Acceptable use</a></div><small>© 2026 TokenForge</small></footer>
    </div>
  );
}
