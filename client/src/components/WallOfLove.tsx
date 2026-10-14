import { Star, ShieldCheck, Zap, Server } from "lucide-react";

interface Testimonial {
  name: string;
  role: string;
  company: string;
  initials: string;
  quote: string;
  highlight: string;
}

const TESTIMONIALS: Testimonial[] = [
  {
    name: "Aakash Mehta",
    role: "Founding Engineer",
    company: "ScribeAgent AI",
    initials: "AM",
    quote:
      "TokenForge eliminated our routing headaches. We cut out random mid-stream drops and now push hundreds of thousands of tokens per minute across Claude and GLM flawlessly.",
    highlight: "140M+ tokens routed",
  },
  {
    name: "Elena Rostova",
    role: "Lead Platform Architect",
    company: "Nexus Labs",
    initials: "ER",
    quote:
      "Having first-party keys and transparent rate limits transformed our production reliability. When one upstream provider degrades, TokenForge automatically absorbs the shock.",
    highlight: "99.9% measured uptime",
  },
  {
    name: "Vikram Sen",
    role: "CTO & Co-Founder",
    company: "AutoPrompt Technologies",
    initials: "VS",
    quote:
      "The Anthropic Messages standard drop-in let our team switch our entire multi-agent workforce in less than 5 minutes. The latency monitoring and quota visibility are best-in-class.",
    highlight: "Instant client drop-in",
  },
  {
    name: "Chloe Dupont",
    role: "Senior AI Ops Lead",
    company: "VividStack",
    initials: "CD",
    quote:
      "Routing through TokenForge gives our enterprise customers the reassurance of strict API accountability. Truly production-ready infrastructure for serious teams.",
    highlight: "Production certified",
  },
  {
    name: "Marcus Vance",
    role: "Principal Infrastructure Engineer",
    company: "HyperLogic",
    initials: "MV",
    quote:
      "We tested over five LLM gateways. TokenForge is the only one that actually delivered real-time latency inspection and verified token counts without hidden markups.",
    highlight: "Verified token delivery",
  },
  {
    name: "Devang Patel",
    role: "Head of Engineering",
    company: "Kredence Finance",
    initials: "DP",
    quote:
      "With instant UPI settlement and rock-solid failover, our analytics pipeline has maintained uninterrupted 24/7 uptime through peak quarterly loads.",
    highlight: "Zero downtime operations",
  },
];

export function WallOfLove() {
  return (
    <section className="aurora-wall-of-love" id="testimonials" aria-label="Wall of Love: Customer Stories">
      <div className="aurora-wall-head">
        <div className="aurora-kicker">
          <span /> WALL OF LOVE
        </div>
        <h2>
          Loved by builders.<br />
          <em>Trusted at enterprise scale.</em>
        </h2>
        <p>
          See how engineering teams and autonomous agent systems rely on TokenForge for high-volume, mission-critical model routing.
        </p>
      </div>

      <div className="aurora-wall-grid">
        {TESTIMONIALS.map((item, idx) => (
          <article className="aurora-wall-card" key={idx}>
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-1 text-[#c9ff73]">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} size={14} fill="currentColor" />
                  ))}
                </div>
                <span className="text-[10px] font-mono text-[#c9ff73] bg-[#c9ff73]/10 border border-[#c9ff73]/20 px-2 py-0.5 rounded-full">
                  {item.highlight}
                </span>
              </div>
              <p className="aurora-wall-card__quote">“{item.quote}”</p>
            </div>

            <div className="aurora-wall-card__author">
              <div className="aurora-wall-avatar" aria-hidden="true">
                {item.initials}
              </div>
              <div className="aurora-wall-meta">
                <strong>{item.name}</strong>
                <span>
                  {item.role} · {item.company}
                </span>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
