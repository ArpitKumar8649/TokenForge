import { PublicNav } from "@/components/PublicNav";
import { TokenForgeGlyph } from "@/components/TokenForgeGlyph";
import { ArrowRight, Braces, KeyRound, ShieldCheck } from "lucide-react";
import { Link } from "wouter";
import { PublicFooter } from "./Models";
import { trpc } from "@/lib/trpc";
import "./landing-metrics.css";

/**
 * All content in this page are only for example, replace with your own feature implementation
 * When building pages, remember your instructions in Frontend Workflow, Frontend Best Practices, Design Guide and Common Pitfalls
 */
export default function Home() {
  const metrics = trpc.public.modelTokenMetrics.useQuery(undefined, { staleTime: 10_000, refetchInterval: 20_000, refetchOnWindowFocus: true });
  const formatTokens = (value: number) => new Intl.NumberFormat(undefined, { notation: "compact", maximumFractionDigits: 1 }).format(value);
  return (
    <div className="aurora-home">
      <PublicNav />
      <main>
        <section className="aurora-hero"><div className="aurora-hero__copy"><div className="aurora-kicker"><span /> CURATED MODELS · ACCOUNTABLE ROUTING</div><h1>Build with a<br /><em>clearer signal.</em></h1><p>TokenForge gives two carefully selected models one considered OpenAI-compatible surface, so your requests, quotas, and credentials stay understandable as you build.</p><div className="aurora-actions"><Link href="/signup" className="aurora-button">Create your account <ArrowRight size={16} /></Link><Link href="/docs" className="aurora-link">Read the API reference <ArrowRight size={15} /></Link></div><div className="aurora-points"><span>OpenAI-compatible</span><span>Keys shown once</span><span>Clear allowance</span></div></div><div className="aurora-hero__visual"><div className="aurora-blur" /><TokenForgeGlyph className="aurora-hero__glyph" /><div className="aurora-request"><div className="aurora-request__top"><span>request surface</span><i /></div><pre><span className="orange">POST</span> /v1/chat/completions{`\n`}model: <span className="ice">"glm-5.2"</span>{`\n`}stream: true{`\n`}status: 200</pre></div></div></section>
        <section className="aurora-statement"><div><p>Developer infrastructure, made <em>legible.</em></p><span>Built for deliberate shipping</span></div></section>
        <section className="aurora-features"><div className="aurora-section-head"><div><div className="aurora-kicker"><span /> THE WORKING SURFACE</div><h2>Keep the signal.<br /><em>Lose the noise.</em></h2></div><Link href="/pricing">See beta access <ArrowRight size={15} /></Link></div><div className="aurora-feature-grid"><article className="aurora-feature"><Braces size={21} /><span>01 / familiar contracts</span><h3>Keep your client.</h3><p>Use the OpenAI-compatible chat-completions shape you already know, with predictable request IDs and streaming support.</p></article><article className="aurora-feature"><KeyRound size={21} /><span>02 / honest credentialing</span><h3>Keys stay private.</h3><p>Secrets appear once and remain protected after creation, with rotation and revocation in your workspace.</p></article><article className="aurora-feature"><ShieldCheck size={21} /><span>03 / visible capacity</span><h3>Limits are legible.</h3><p>Quota, rate, and provider conditions surface clearly instead of becoming invisible product friction.</p></article></div></section>
        <section className="aurora-model-band"><div className="aurora-model-band__inner"><div><div className="aurora-kicker"><span /> Curated by intent</div><h2>Two sharp<br /><em>ways to think.</em></h2></div><div className="aurora-model-list"><article><span>01 / glm-5.2</span><h3>GLM-5.2</h3><p>Long-horizon reasoning with a deliberate, streaming-ready interface.</p><strong>{formatTokens(metrics.data?.byModel["glm-5.2"] ?? 0)} <small>tokens processed</small></strong></article><article><span>02 / grok-4.5</span><h3>Grok 4.5</h3><p>Fast engineering-oriented reasoning in the same dependable request shape.</p><strong>{formatTokens(metrics.data?.byModel["grok-4.5"] ?? 0)} <small>tokens processed</small></strong></article></div><div className="aurora-model-metric" aria-live="polite"><i /><span>Network total</span><b>{formatTokens(metrics.data?.totalTokens ?? 0)} tokens</b><small>Successful provider-reported tokens · refreshes every 20 seconds</small></div></div></section>
        <section className="aurora-close"><p>Free beta · controlled capacity</p><h2>Bring your next build<br /><em>into focus.</em></h2><Link href="/signup" className="aurora-button">Create an account <ArrowRight size={16} /></Link></section>
      </main>
      <PublicFooter />
    </div>
  );
}
