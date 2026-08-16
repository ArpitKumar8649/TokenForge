import { PublicNav } from "@/components/PublicNav";
import { TokenForgeGlyph } from "@/components/TokenForgeGlyph";
import { Badge } from "@/components/ui/badge";
import { formatTokenForgeCreditRatePerMillion, TOKENFORGE_MODELS } from "@/lib/modelCatalogue";
import { Braces, ExternalLink, Gauge, MessageCircle } from "lucide-react";
import { Link } from "wouter";
import "./models.css";

export default function Models() {
  return (
    <div className="public-page tf-public-surface models-page">
      <PublicNav />
      <main className="catalogue-page">
        <div className="page-eyebrow"><span className="status-dot" /> Verified text catalogue</div>
        <div className="catalogue-heading">
          <div>
            <h1>{TOKENFORGE_MODELS.length} text models.<br /><em>One considered interface.</em></h1>
            <p>Every active route supports OpenAI-compatible chat completions, provider-isolated execution, and a published TokenForge credit rate that includes the 1.5× platform charge. Image, audio, embedding, transcription, and research-only routes are intentionally excluded.</p>
          </div>
          <div className="catalogue-stats">
            <div><strong>{String(TOKENFORGE_MODELS.length).padStart(2, "0")}</strong><span>verified text routes</span></div>
            <div><strong>01</strong><span>consistent API surface</span></div>
          </div>
        </div>

        <section className="model-detail-grid" aria-label="Available text-chat models">
          {TOKENFORGE_MODELS.map((model) => (
            <article key={model.id} className={`model-detail-card model-detail-card--${model.tone}`}>
              <header className="model-detail-card__header">
                <span className="model-provider-name">Text model</span>
                <Badge variant="secondary">Available</Badge>
              </header>

              <div className="model-detail-card__body">
                <p className="model-eyebrow">{model.eyebrow}</p>
                <h2>{model.name}</h2>
                <p className="model-description">{model.description}</p>
                <div className="capability-row" aria-label={`${model.name} capabilities`}>
                  {model.capabilities.map((capability) => <span key={capability}>{capability}</span>)}
                </div>

                <section className="model-rate-card" aria-label={`${model.name} TokenForge credit rate`}>
                  <div className="model-rate-card__head">
                    <p>Credit rate</p>
                    <span>1.5× included</span>
                  </div>
                  <dl>
                    <div><dt>Input</dt><dd>{formatTokenForgeCreditRatePerMillion(model.inputUsdPerMillion)}</dd><small>/ 1M tokens</small></div>
                    <div><dt>Output</dt><dd>{formatTokenForgeCreditRatePerMillion(model.outputUsdPerMillion)}</dd><small>/ 1M tokens</small></div>
                  </dl>
                </section>
              </div>

              <footer className="model-card-footer">
                <code>{model.id}</code>
                <a href={model.pricingUrl} target="_blank" rel="noreferrer">
                  Rate source <ExternalLink size={12} />
                </a>
              </footer>
            </article>
          ))}
        </section>

        <section className="catalogue-note">
          <div className="catalogue-note__icon"><Gauge size={20} /></div>
          <div>
            <strong>Verified rates are a requirement for activation.</strong>
            <p>Prices link to first-party provider materials. TokenForge applies a clearly disclosed 1.5× platform charge to upstream rates when credits are reserved and settled. Availability is checked when a request begins; TokenForge never silently switches a selected model.</p>
          </div>
          <Link href="/signup" className="models-cta">Create an account <Braces size={16} /></Link>
        </section>
      </main>
      <PublicFooter />
    </div>
  );
}

export function PublicFooter() {
  return <footer className="public-footer"><div><span className="footer-brand"><TokenForgeGlyph className="public-footer__glyph" />Token<span>Forge</span></span><p>A considered AI gateway for serious building.</p></div><div className="footer-links"><a href="/models">Models</a><a href="/pricing">Pricing</a><a href="/docs">Documentation</a><a href="/legal/terms">Terms</a><a href="/legal/privacy">Privacy</a><a href="/legal/acceptable-use">Acceptable use</a><a href="https://discord.gg/pnsWamDbe" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1" aria-label="Join the TokenForge Discord community">Discord <MessageCircle size={13} aria-hidden="true" /></a></div><small>© 2026 TokenForge · <a href="/signin">Sign in</a></small></footer>;
}
