import { PublicNav } from "@/components/PublicNav";
import { Button } from "@/components/ui/button";
import { betaPlans } from "@/lib/tokenforgePresentation";
import { ArrowRight, Check, ShieldCheck, Sparkles } from "lucide-react";
import { Link } from "wouter";
import { PublicFooter } from "./Models";

export default function Pricing() {
  return (
    <div className="pricing-page">
      <PublicNav />
      <main className="pricing-main">
        <div className="pricing-orbit pricing-orbit--one" /><div className="pricing-orbit pricing-orbit--two" />
        <section className="pricing-heading"><div className="demo-kicker"><span /> Transparent beta access</div><h1>Start with room<br />to <em>make something real.</em></h1><p>TokenForge is currently a controlled free beta. New accounts receive promotional credit, and successful requests debit the published TokenForge credit rate: the source-linked upstream token rate plus a transparent 3.5× platform charge. No checkout or payment collection is enabled.</p></section>
        <section className="pricing-grid">{betaPlans.map(plan => { const featured = "featured" in plan && plan.featured; return <article className={`pricing-card ${featured ? "pricing-card--featured" : ""}`} key={plan.name}>{featured && <span className="pricing-popular"><Sparkles size={13} /> Planned next</span>}<p className="pricing-card__eyebrow">{plan.eyebrow}</p><h2>{plan.name}</h2><p className="pricing-card__description">{plan.description}</p><div className="pricing-price">{plan.price}{plan.price === "$0" && <span>/ beta</span>}</div><div className="pricing-divider" /><ul>{plan.features.map(feature => <li key={feature}><Check size={16} />{feature}</li>)}</ul><Link href={plan.href} className="pricing-button">{plan.action} <ArrowRight size={15} /></Link></article>; })}</section>
        <section className="pricing-note"><ShieldCheck size={20} /><p><strong>What “free beta” means.</strong> The platform enforces its published quotas, provider availability controls, and acceptable-use protections. Account access and future paid offerings are not promises of unlimited capacity.</p><Button variant="outline" asChild><Link href="/legal/acceptable-use">Read acceptable use</Link></Button></section>
      </main>
      <PublicFooter />
    </div>
  );
}
