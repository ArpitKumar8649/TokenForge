import { PublicNav } from "@/components/PublicNav";
import { TokenForgeGlyph } from "@/components/TokenForgeGlyph";
import { ProviderMark } from "@/components/ProviderMark";
import { ArrowRight, Braces, KeyRound, ShieldCheck, Activity, Lock, Cpu, Server } from "lucide-react";
import { Link } from "wouter";
import { PublicFooter } from "./Models";
import { TOKENFORGE_MODELS } from "@/lib/modelCatalogue";
import { trpc } from "@/lib/trpc";
import { useEffect, useRef, useState } from "react";
import { ThreeDButton } from "@/components/ui/3d-button";
import VapourAccent from "@/components/ui/vapour-accent";
import { WallOfLove } from "@/components/WallOfLove";
import "./landing-metrics.css";
import "./landing-contrast-fix.css";
import "./vapour-fixes.css";
import "./startup-trust.css";

/**
 * Enterprise & B2B Production Landing Surface
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

/**
 * Dynamically formats and animates the live total tokens in billions.
 * E.g. 16,064,979,959 -> 16.1 Billion tokens.
 * As the live server count increases, this number automatically increases in real-time.
 */
function DynamicBillionTokenText({ value }: { value?: number }) {
  const baseValue = value && value > 0 ? value : 16_064_979_959;
  const [displayValue, setDisplayValue] = useState<number>(baseValue);
  const prevValueRef = useRef<number>(baseValue);

  useEffect(() => {
    if (!value || value <= 0) return;
    const startVal = prevValueRef.current;
    const targetVal = value;
    prevValueRef.current = targetVal;

    if (Math.abs(targetVal - startVal) < 1) {
      setDisplayValue(targetVal);
      return;
    }

    const duration = 900;
    const startTime = performance.now();
    let frameId = 0;

    const step = (now: number) => {
      const progress = Math.min(1, (now - startTime) / duration);
      const ease = 1 - Math.pow(1 - progress, 3);
      setDisplayValue(startVal + (targetVal - startVal) * ease);
      if (progress < 1) {
        frameId = requestAnimationFrame(step);
      }
    };

    frameId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frameId);
  }, [value]);

  const billions = (displayValue / 1_000_000_000).toLocaleString(undefined, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });

  return (
    <strong className="aurora-dynamic-billion-text" title={`${Math.round(displayValue).toLocaleString()} total tokens routed`}>
      {billions} Billion tokens
    </strong>
  );
}

export default function Home() {
  const metrics = trpc.public.modelTokenMetrics.useQuery(undefined, { staleTime: 10_000, refetchInterval: 20_000, refetchOnWindowFocus: true });
  return (
    <div className="aurora-home">
      <PublicNav />
      <main>
        {/* HERO SECTION */}
        <section className="aurora-hero">
          <div className="aurora-hero__copy">
            <div className="aurora-kicker"><span /> ENTERPRISE LLM GATEWAY · 99.9% UPTIME</div>
            <h1>Build with a<VapourAccent texts={["clearer signal.", "verified speed.", "honest routing."]} color="#ffcf8d" /></h1>
            <p>TokenForge brings verified text-chat models to one considered Anthropic-compatible Messages surface, so your requests, quotas, rates, and credentials stay understandable as you build.</p>
            
            <div className="aurora-actions">
              <ThreeDButton href="/signin" />
              <Link href="/docs" className="aurora-link">Read the API reference <ArrowRight size={15} /></Link>
            </div>

            {/* Social Proof Banner dynamically driven by live network metrics */}
            <div className="aurora-hero-proof-banner">
              <span className="aurora-hero-proof-banner__dot" />
              <p>
                <em className="aurora-hero-proof-banner__serif">
                  Trusted by developers to route over
                </em>{" "}
                <DynamicBillionTokenText value={metrics.data?.totalTokens} />
              </p>
            </div>

            <div className="aurora-points">
              <span>99.9% API Uptime</span>
              <span>Secure First-Party Keys</span>
              <span>Real-time Latency Monitoring</span>
            </div>
          </div>

          <div className="aurora-hero__visual">
            <div className="aurora-blur" />
            <TokenForgeGlyph className="aurora-hero__glyph" />
            <div className="aurora-request">
              <div className="aurora-request__top">
                <span>request surface</span>
                <i />
              </div>
              <pre><span className="orange">POST</span> /v1/chat/completions{`\n`}model: <span className="ice">"glm-5.2"</span>{`\n`}stream: true{`\n`}status: 200</pre>
            </div>
          </div>
        </section>

        {/* ABOVE-THE-FOLD LIVE NETWORK METRICS */}
        <section className="aurora-hero-metrics-strip" aria-label="Live TokenForge Network Statistics">
          <div className="aurora-network-metrics" aria-live="polite">
            <article className="aurora-network-metrics__total">
              <span><i /> LIVE TOKENFORGE NETWORK</span>
              <strong><AnimatedTokenCount value={metrics.data?.totalTokens ?? 0} /></strong>
              <b>total tokens processed</b>
              <small>Successful provider-reported tokens · refreshes every 20 seconds</small>
            </article>
            <article>
              <span>Verified routes</span>
              <strong>{TOKENFORGE_MODELS.length}</strong>
              <small>text-chat models</small>
            </article>
            <article>
              <span>Request surface</span>
              <strong>01</strong>
              <small>Anthropic Messages API</small>
            </article>
          </div>
        </section>

        {/* ENTERPRISE TRUST SIGNALS BAR */}
        <section className="aurora-trust-bar" aria-label="Enterprise Guarantees">
          <div className="aurora-trust-bar__inner">
            <div className="aurora-trust-item">
              <div className="aurora-trust-item__icon">
                <Activity size={22} />
              </div>
              <div className="aurora-trust-item__content">
                <strong>99.9% API Uptime</strong>
                <p>Automated circuit breaking and instant fallback routing ensure your queries never hit provider dead-ends.</p>
              </div>
            </div>

            <div className="aurora-trust-item">
              <div className="aurora-trust-item__icon">
                <Lock size={22} />
              </div>
              <div className="aurora-trust-item__content">
                <strong>Secure First-Party Keys</strong>
                <p>All credentials encrypted at rest and in transit. Your secret API tokens are masked and stored with zero log exposure.</p>
              </div>
            </div>

            <div className="aurora-trust-item">
              <div className="aurora-trust-item__icon">
                <Cpu size={22} />
              </div>
              <div className="aurora-trust-item__content">
                <strong>Real-time Latency Monitoring</strong>
                <p>Continuous provider benchmarking with sub-second health probes and live stream throughput telemetry.</p>
              </div>
            </div>
          </div>
        </section>

        <section className="aurora-statement">
          <div>
            <p>Developer infrastructure, made <em>legible.</em></p>
            <span>Built for deliberate shipping</span>
          </div>
        </section>

        <section className="aurora-features">
          <div className="aurora-section-head">
            <div>
              <div className="aurora-kicker"><span /> THE WORKING SURFACE</div>
              <h2>Keep the signal.<br /><em>Lose the noise.</em></h2>
            </div>
            <Link href="/pricing">Explore plans <ArrowRight size={15} /></Link>
          </div>
          <div className="aurora-feature-grid">
            <article className="aurora-feature">
              <Braces size={21} />
              <span>01 / familiar contracts</span>
              <h3>Keep your client.</h3>
              <p>Use the Anthropic-compatible Messages shape you already know (<code>/v1/messages</code>), with predictable request IDs and streaming support.</p>
            </article>
            <article className="aurora-feature">
              <KeyRound size={21} />
              <span>02 / honest credentialing</span>
              <h3>Keys stay private.</h3>
              <p>Secrets appear once and remain protected after creation, with rotation and revocation in your workspace.</p>
            </article>
            <article className="aurora-feature">
              <ShieldCheck size={21} />
              <span>03 / visible capacity</span>
              <h3>Limits are legible.</h3>
              <p>Quota, rate, and provider conditions surface clearly instead of becoming invisible product friction.</p>
            </article>
          </div>
        </section>

        {/* MODEL CATALOGUE RIBBON BAND */}
        <section className="aurora-model-band">
          <div className="aurora-model-band__inner">
            <div className="aurora-model-band__head">
              <div>
                <div className="aurora-kicker"><span /> Curated by verification</div>
                <h2>One surface.<br /><em>Many thinking styles.</em></h2>
                <p className="aurora-model-intro">Text-chat routes from trusted publishers, verified for a consistent request surface.</p>
              </div>
              <Link href="/models" className="aurora-link">Browse all {TOKENFORGE_MODELS.length} models <ArrowRight size={15} /></Link>
            </div>
            <div className="aurora-provider-ribbon" aria-label="Available model publishers">
              <div className="aurora-provider-ribbon__track">
                {[...TOKENFORGE_MODELS, ...TOKENFORGE_MODELS].map((model, index) => (
                  <div className="aurora-provider-ribbon__item" key={`${model.id}-${index}`}>
                    <span className={`aurora-provider-ribbon__mark aurora-provider-ribbon__mark--${model.tone}`}>
                      <ProviderMark provider={model.provider} fallback={model.providerMark} size={22} />
                    </span>
                    <span>{model.name}</span>
                    <small>{model.provider}</small>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* WALL OF LOVE / TESTIMONIALS */}
        <WallOfLove />

        {/* CLOSING CALL TO ACTION */}
        <section className="aurora-close">
          <p className="aurora-close__kicker"><span /> MISSION-CRITICAL INFRASTRUCTURE · 99.9% UPTIME</p>
          <h2>Bring your next build<br /><em>into focus.</em></h2>
          <ThreeDButton href="/signin" />
        </section>
      </main>
      <PublicFooter />
    </div>
  );
}
