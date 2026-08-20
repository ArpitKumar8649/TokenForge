import { PublicNav } from "@/components/PublicNav";
import { TokenForgeGlyph } from "@/components/TokenForgeGlyph";
import { ProviderMark } from "@/components/ProviderMark";
import { ArrowRight, Braces, KeyRound, ShieldCheck } from "lucide-react";
import { Link } from "wouter";
import { PublicFooter } from "./Models";
import { TOKENFORGE_MODELS } from "@/lib/modelCatalogue";
import { trpc } from "@/lib/trpc";
import { useEffect, useRef, useState } from "react";
import "./landing-metrics.css";
import "./landing-contrast-fix.css";

/**
 * All content in this page are only for example, replace with your own feature implementation
 * When building pages, remember your instructions in Frontend Workflow, Frontend Best Practices, Design Guide and Common Pitfalls
 */
const formatTokens = (value: number) => new Intl.NumberFormat(undefined, { notation: "compact", maximumFractionDigits: 1 }).format(value);

function AnimatedTokenCount({ value }: { value: number }) {
  const element = useRef<HTMLSpanElement>(null);
  const [visible, setVisible] = useState(false);
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    const node = element.current;
    if (!node) return;
    const observer = new IntersectionObserver(([entry]) => { if (entry.isIntersecting) setVisible(true); }, { threshold: 0.2 });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (!visible) return;
    const started = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const progress = Math.min(1, (now - started) / 820);
      const eased = 1 - Math.pow(1 - progress, 4);
      setDisplay(Math.round(value * eased));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, visible]);
  return <span ref={element}>{formatTokens(display)}</span>;
}

export default function Home() {
  const metrics = trpc.public.modelTokenMetrics.useQuery(undefined, { staleTime: 10_000, refetchInterval: 20_000, refetchOnWindowFocus: true });
  return (
    <div className="aurora-home">
      <PublicNav />
      <main>
        <section className="aurora-hero"><div className="aurora-hero__copy"><div className="aurora-kicker"><span /> VERIFIED MODELS · ACCOUNTABLE ROUTING</div><h1>Build with a<br /><em>clearer signal.</em></h1><p>TokenForge brings verified text-chat models to one considered OpenAI-compatible surface, so your requests, quotas, rates, and credentials stay understandable as you build.</p><div className="aurora-actions"><Link href="/signup" className="aurora-button">Create your account <ArrowRight size={16} /></Link><Link href="/docs" className="aurora-link">Read the API reference <ArrowRight size={15} /></Link></div><div className="aurora-points"><span>OpenAI-compatible</span><span>First-party rates</span><span>Clear allowance</span></div></div><div className="aurora-hero__visual"><div className="aurora-blur" /><TokenForgeGlyph className="aurora-hero__glyph" /><div className="aurora-request"><div className="aurora-request__top"><span>request surface</span><i /></div><pre><span className="orange">POST</span> /v1/chat/completions{`\n`}model: <span className="ice">"glm-5.2"</span>{`\n`}stream: true{`\n`}status: 200</pre></div></div></section>
        <section className="aurora-statement"><div><p>Developer infrastructure, made <em>legible.</em></p><span>Built for deliberate shipping</span></div></section>
        <section className="aurora-features"><div className="aurora-section-head"><div><div className="aurora-kicker"><span /> THE WORKING SURFACE</div><h2>Keep the signal.<br /><em>Lose the noise.</em></h2></div><Link href="/pricing">See beta access <ArrowRight size={15} /></Link></div><div className="aurora-feature-grid"><article className="aurora-feature"><Braces size={21} /><span>01 / familiar contracts</span><h3>Keep your client.</h3><p>Use the OpenAI-compatible chat-completions shape you already know, with predictable request IDs and streaming support.</p></article><article className="aurora-feature"><KeyRound size={21} /><span>02 / honest credentialing</span><h3>Keys stay private.</h3><p>Secrets appear once and remain protected after creation, with rotation and revocation in your workspace.</p></article><article className="aurora-feature"><ShieldCheck size={21} /><span>03 / visible capacity</span><h3>Limits are legible.</h3><p>Quota, rate, and provider conditions surface clearly instead of becoming invisible product friction.</p></article></div></section>
        <section className="aurora-model-band">
          <div className="aurora-model-band__inner">
            <div className="aurora-model-band__head"><div><div className="aurora-kicker"><span /> Curated by verification</div><h2>One surface.<br /><em>Many thinking styles.</em></h2><p className="aurora-model-intro">Text-chat routes from trusted publishers, verified for a consistent request surface.</p></div><Link href="/models" className="aurora-link">Browse all {TOKENFORGE_MODELS.length} models <ArrowRight size={15} /></Link></div>
            <div className="aurora-provider-ribbon" aria-label="Available model publishers"><div className="aurora-provider-ribbon__track">{[...TOKENFORGE_MODELS, ...TOKENFORGE_MODELS].map((model, index) => <div className="aurora-provider-ribbon__item" key={`${model.id}-${index}`}><span className={`aurora-provider-ribbon__mark aurora-provider-ribbon__mark--${model.tone}`}><ProviderMark provider={model.provider} fallback={model.providerMark} size={22} /></span><span>{model.name}</span><small>{model.provider}</small></div>)}</div></div>
            <div className="aurora-network-metrics" aria-live="polite"><article className="aurora-network-metrics__total"><span><i /> LIVE TOKENFORGE NETWORK</span><strong><AnimatedTokenCount value={metrics.data?.totalTokens ?? 0} /></strong><b>total tokens processed</b><small>Successful provider-reported tokens · refreshes every 20 seconds</small></article><article><span>Verified routes</span><strong>{TOKENFORGE_MODELS.length}</strong><small>text-chat models</small></article><article><span>Request surface</span><strong>01</strong><small>OpenAI-compatible API</small></article></div>
          </div>
        </section>
        <section className="aurora-close"><p>Free beta · controlled capacity</p><h2>Bring your next build<br /><em>into focus.</em></h2><Link href="/signup" className="aurora-button">Create an account <ArrowRight size={16} /></Link></section>
      </main>
      <PublicFooter />
    </div>
  );
}
