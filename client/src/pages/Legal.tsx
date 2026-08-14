import { PublicNav } from "@/components/PublicNav";
import { PublicFooter } from "@/pages/Models";
import { ShieldCheck } from "lucide-react";
import { useLocation } from "wouter";

type LegalVariant = "terms" | "privacy" | "acceptable-use";

const legalContent: Record<LegalVariant, { label: string; title: string; subtitle: string; sections: Array<{ heading: string; body: string }> }> = {
  terms: {
    label: "Terms of service",
    title: "Clear terms for a careful service.",
    subtitle: "Effective 14 August 2026. These terms govern access to TokenForge’s beta API, dashboard, and related documentation.",
    sections: [
      { heading: "Service scope", body: "TokenForge provides access to a curated, quota-controlled API interface for selected artificial-intelligence models. The beta service may change, pause, or restrict access to protect users, providers, or platform integrity." },
      { heading: "Accounts and API keys", body: "You are responsible for activity performed through your account and API keys. Keep credentials confidential, use them only for your authorized applications, and revoke them promptly if you suspect exposure." },
      { heading: "Availability and model routing", body: "Model availability is not guaranteed. TokenForge will not silently substitute a different model for a requested model. Provider availability, platform safeguards, and your active quota can affect a request." },
      { heading: "Suspension", body: "We may suspend or limit access when necessary to investigate abuse, protect systems, respect applicable law, enforce these terms, or prevent unreasonable provider usage." },
    ],
  },
  privacy: {
    label: "Privacy notice",
    title: "Minimal data. Purposeful handling.",
    subtitle: "Effective 14 August 2026. This notice explains the data TokenForge needs to operate the beta service and the choices users have.",
    sections: [
      { heading: "Information we process", body: "We process account identity information supplied by the authentication provider, API-key metadata, usage totals, request identifiers, security signals, and service diagnostics. API keys are retained only as one-way hashes after creation." },
      { heading: "Prompt and completion handling", body: "Prompts and completions are transmitted to the selected model provider to fulfill a request. TokenForge is designed to retain minimal operational metadata rather than a durable prompt history. Do not submit data you are not authorized to share." },
      { heading: "Why we use information", body: "We use information to authenticate users, enforce quotas, detect misuse, secure the service, support troubleshooting, and meet legal obligations. We do not sell personal information." },
      { heading: "Retention and contact", body: "Operational records are retained only for as long as needed for security, quota enforcement, support, and legal compliance. Contact the service operator to request access, correction, or deletion where applicable." },
    ],
  },
  "acceptable-use": {
    label: "Acceptable-use policy",
    title: "Build ambitiously. Use responsibly.",
    subtitle: "Effective 14 August 2026. This policy applies to every TokenForge account, API key, application, prompt, and generated output.",
    sections: [
      { heading: "Respect people and law", body: "Do not use TokenForge to violate law, infringe rights, deceive people, harass individuals, or create content intended to cause material harm. You remain responsible for your applications and their users." },
      { heading: "Protect access and capacity", body: "Do not share, resell, scrape, reverse engineer, overload, or bypass TokenForge accounts, quotas, rate limits, security controls, or model access restrictions." },
      { heading: "No high-risk misuse", body: "Do not use the service for malicious cyber activity, unlawful surveillance, deceptive impersonation, instructions for violence, or other applications where use creates a substantial risk of serious harm." },
      { heading: "Enforcement", body: "We may investigate suspected violations, disable API keys, suspend accounts, and cooperate with lawful requests when necessary to protect users, providers, and the platform." },
    ],
  },
};

export default function Legal() {
  const [location] = useLocation();
  const variant = (location.split("/").pop() || "terms") as LegalVariant;
  const content = legalContent[variant] ?? legalContent.terms;
  return <div className="public-page"><PublicNav /><main className="legal-page"><div className="legal-hero"><div className="legal-icon"><ShieldCheck size={23} /></div><p>{content.label}</p><h1>{content.title}</h1><span>{content.subtitle}</span></div><div className="legal-grid"><aside><a className={variant === "terms" ? "active" : ""} href="/legal/terms">Terms of service</a><a className={variant === "privacy" ? "active" : ""} href="/legal/privacy">Privacy notice</a><a className={variant === "acceptable-use" ? "active" : ""} href="/legal/acceptable-use">Acceptable use</a></aside><article>{content.sections.map(section => <section key={section.heading}><h2>{section.heading}</h2><p>{section.body}</p></section>)}</article></div></main><PublicFooter /></div>;
}
