import { PublicNav } from "@/components/PublicNav";
import { TokenForgeGlyph } from "@/components/TokenForgeGlyph";
import { ArrowRight, Braces, KeyRound, ShieldCheck, Sparkles } from "lucide-react";
import { Link } from "wouter";
import { PublicFooter } from "./Models";

/**
 * All content in this page are only for example, replace with your own feature implementation
 * When building pages, remember your instructions in Frontend Workflow, Frontend Best Practices, Design Guide and Common Pitfalls
 */
export default function Home() {
  return (
    <div className="aurora-home">
      <PublicNav />
      <main>
        <section className="aurora-hero"><div className="aurora-hero__copy"><div className="aurora-kicker"><span /> Two models. One clean surface.</div><h1>Open models.<br /><em>Uncommon velocity.</em></h1><p>TokenForge turns two distinct model capabilities into one deliberate API surface—built around familiar OpenAI-compatible calls, visible limits, and a developer experience with a pulse.</p><div className="aurora-actions"><Link href="/demo" className="aurora-button">Explore the demo <ArrowRight size={16} /></Link><Link href="/docs" className="aurora-link">Read the API reference <ArrowRight size={15} /></Link></div><div className="aurora-points"><span>OpenAI-compatible</span><span>Key-safe by design</span><span>Readable limits</span></div></div><div className="aurora-hero__visual"><div className="aurora-blur" /><TokenForgeGlyph className="aurora-hero__glyph" /><div className="aurora-request"><div className="aurora-request__top"><span>tf.request</span><i /></div><pre><span className="orange">POST</span> /v1/chat/completions{`\n`}model: <span className="ice">"grok-4.5"</span>{`\n`}stream: true{`\n`}status: 200</pre></div></div></section>
        <section className="aurora-statement"><div><p>Infrastructure can be precise <em>and</em> alive.</p><span>Designed for intentional building</span></div></section>
        <section className="aurora-features"><div className="aurora-section-head"><div><div className="aurora-kicker"><span /> The working surface</div><h2>Less gateway theatre.<br /><em>More useful signal.</em></h2></div><Link href="/pricing">See beta access <ArrowRight size={15} /></Link></div><div className="aurora-feature-grid"><article className="aurora-feature"><Braces size={21} /><span>01 / familiar contracts</span><h3>Keep your client.</h3><p>Use the OpenAI-compatible chat-completions shape you already know, with predictable request IDs and streaming support.</p></article><article className="aurora-feature"><KeyRound size={21} /><span>02 / honest credentialing</span><h3>Keys stay private.</h3><p>Secrets appear once and are protected after creation, with rotation and revocation controls in the workspace.</p></article><article className="aurora-feature"><ShieldCheck size={21} /><span>03 / capacity with edges</span><h3>Limits are legible.</h3><p>Quota, rate, and provider conditions surface clearly instead of becoming invisible product friction.</p></article></div></section>
        <section className="aurora-model-band"><div className="aurora-model-band__inner"><div><div className="aurora-kicker"><span /> Curated by intent</div><h2>Two sharp<br /><em>ways to think.</em></h2></div><div className="aurora-model-list"><article><span>01 / glm-5.2</span><h3>GLM-5.2</h3><p>Long-horizon reasoning with a deliberate, streaming-ready interface.</p></article><article><span>02 / grok-4.5</span><h3>Grok 4.5</h3><p>Fast engineering-oriented reasoning in the same dependable request shape.</p></article></div></div></section>
        <section className="aurora-close"><p>Free beta · controlled capacity</p><h2>See the API<br /><em>from the inside.</em></h2><Link href="/demo" className="aurora-button">Open the safe demo <ArrowRight size={16} /></Link></section>
      </main>
      <PublicFooter />
    </div>
  );
}
