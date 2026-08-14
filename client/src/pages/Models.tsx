import { PublicNav } from "@/components/PublicNav";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { startLogin } from "@/const";
import { ArrowRight, BrainCircuit, Braces, Code2, Gauge, Network } from "lucide-react";

const models = [
  {
    id: "glm-5.2",
    name: "GLM-5.2",
    eyebrow: "Long-horizon intelligence",
    description: "A flagship model for complex engineering, coding, and extended-context work. Built for tasks that reward careful reasoning over a sustained context.",
    badges: ["Long context", "Reasoning", "Streaming", "Coding"],
    icon: BrainCircuit,
    source: "https://docs.z.ai/guides/llm/glm-5.2",
    tone: "orchid",
  },
  {
    id: "grok-4.5",
    name: "Grok 4.5",
    eyebrow: "Fast engineering reasoning",
    description: "A high-performance reasoning model positioned for code, agentic workflows, and knowledge work with a particular emphasis on real engineering tasks.",
    badges: ["Reasoning", "Agentic", "Coding", "Streaming"],
    icon: Network,
    source: "https://x.ai/news/grok-4-5",
    tone: "blue",
  },
];

export default function Models() {
  return (
    <div className="public-page">
      <PublicNav />
      <main className="catalogue-page">
        <div className="page-eyebrow"><span className="status-dot" /> Curated catalogue</div>
        <div className="catalogue-heading">
          <div>
            <h1>Two remarkable models.<br /><em>One considered interface.</em></h1>
            <p>TokenForge makes a deliberately small model surface easy to understand, prototype against, and operate with confidence.</p>
          </div>
          <div className="catalogue-stats">
            <div><strong>02</strong><span>models, by design</span></div>
            <div><strong>01</strong><span>consistent API surface</span></div>
          </div>
        </div>
        <section className="model-detail-grid" aria-label="Available models">
          {models.map(model => {
            const Icon = model.icon;
            return (
              <article key={model.id} className={`model-detail-card model-detail-card--${model.tone}`}>
                <div className="model-card-topline">
                  <span className="model-icon"><Icon size={21} /></span>
                  <Badge variant="secondary">Available in beta</Badge>
                </div>
                <p className="model-eyebrow">{model.eyebrow}</p>
                <h2>{model.name}</h2>
                <p className="model-description">{model.description}</p>
                <div className="capability-row">
                  {model.badges.map(badge => <span key={badge}>{badge}</span>)}
                </div>
                <div className="model-card-footer">
                  <code>{model.id}</code>
                  <a href={model.source} target="_blank" rel="noreferrer">Source notes <ArrowRight size={14} /></a>
                </div>
              </article>
            );
          })}
        </section>
        <section className="catalogue-note">
          <div className="catalogue-note__icon"><Gauge size={20} /></div>
          <div>
            <strong>Capability labels are intentional, not promises.</strong>
            <p>Availability, throughput, and feature support are verified at request time. TokenForge never silently switches models or routes a request outside the selected catalogue.</p>
          </div>
          <Button variant="outline" onClick={() => startLogin()}>Get an API key <Braces size={16} /></Button>
        </section>
      </main>
      <PublicFooter />
    </div>
  );
}

export function PublicFooter() {
  return (
    <footer className="public-footer">
      <div><span className="footer-brand">Token<span>Forge</span></span><p>A quieter kind of API gateway.</p></div>
      <div className="footer-links">
        <a href="/docs">Documentation</a>
        <a href="/legal/terms">Terms</a>
        <a href="/legal/privacy">Privacy</a>
        <a href="/legal/acceptable-use">Acceptable use</a>
      </div>
      <small>© 2026 TokenForge</small>
    </footer>
  );
}
