import { PublicNav } from "@/components/PublicNav";
import { PublicFooter } from "@/pages/Models";
import {
  ShieldCheck,
  FileText,
  RotateCcw,
  CheckCircle2,
  Mail,
  HelpCircle,
  ExternalLink,
  MessageCircle,
} from "lucide-react";
import { useLocation, Link } from "wouter";

export type LegalVariant = "terms" | "privacy" | "refund" | "acceptable-use";

interface LegalSection {
  heading: string;
  body: string;
  bullets?: string[];
  callout?: string;
}

interface LegalPolicy {
  label: string;
  title: string;
  subtitle: string;
  effectiveDate: string;
  icon: typeof ShieldCheck;
  sections: LegalSection[];
}

const legalContent: Record<LegalVariant, LegalPolicy> = {
  terms: {
    label: "Terms of Service",
    title: "Terms and conditions for TokenForge API Gateway.",
    subtitle:
      "Effective September 2026. These Terms of Service constitute a legally binding agreement governing your access to and use of the TokenForge developer platform, API routing infrastructure, load balancing services, and software subscription plans.",
    effectiveDate: "September 2026 (Version 2.5)",
    icon: FileText,
    sections: [
      {
        heading: "1. Acceptance of Terms and Eligibility",
        body: "By registering an account, generating API credentials, purchasing developer subscription capacity, or sending requests to TokenForge endpoints, you expressly agree to be bound by these Terms of Service, our Privacy Policy, Acceptable Use Policy, and Refund Policy. If you are entering into these Terms on behalf of an organization or enterprise, you represent and warrant that you possess full legal authority to bind that entity.",
        bullets: [
          "You must be at least 18 years of age or the age of legal majority in your jurisdiction to use TokenForge developer services.",
          "You must not be located in a jurisdiction subject to comprehensive international trade sanctions or designated on government restricted-party lists.",
          "You agree to provide accurate, complete, and current account information during registration.",
        ],
      },
      {
        heading: "2. Description of TokenForge Software Services",
        body: "TokenForge provides developer infrastructure software, including an intelligent multi-model API router, latency optimization middleware, circuit breakers, and a unified Anthropic-compatible REST API interface (POST /v1/messages). TokenForge enables software developers and teams to route model requests with automated failover, real-time latency telemetry, and unified usage observability.",
        bullets: [
          "TokenForge operates as an independent software middleware and API management layer.",
          "Compatibility & Third-Party Disclaimer: TokenForge is an independent developer tooling platform. All model trademarks and brand names (such as Anthropic, OpenAI, Meta, DeepSeek, Qwen) belong to their respective owners and are referenced solely to identify compatibility.",
          "Model Fidelity Assurance: TokenForge routes requests strictly according to your configured preferences; we never silently substitute, downgrade, or alter your chosen model specifications without your explicit instruction.",
          "Digital Software Fulfillment: Access to developer dashboards, API secret keys, and usage capacity is provisioned electronically and instantly upon completed authentication or checkout.",
        ],
      },
      {
        heading: "3. Account Security and API Key Custody",
        body: "You are solely responsible for maintaining the confidentiality of your authentication credentials, session tokens, and API secret keys. Any request signed with an active API key generated in your workspace is conclusively deemed to have been authorized by you.",
        bullets: [
          "API keys are sensitive developer credentials. Never commit secret keys to public code repositories, client-side web applications, or unencrypted storage.",
          "TokenForge displays secret keys only once upon generation; our backend stores exclusively non-reversible cryptographic hashes (SHA-256).",
          "You must immediately notify TokenForge support via our official support channels if you discover or suspect unauthorized use of your credentials.",
        ],
      },
      {
        heading: "4. Developer Plans, Pricing, and Billing",
        body: "TokenForge offers developer usage plans and compute capacity allowances. As API requests are processed through our gateway, usage is metered according to the exact input and output token counts reported by the underlying model endpoints, plus standard routing and middleware handling fees disclosed transparently on our pricing page.",
        bullets: [
          "Developer usage capacity and promotional balances are digital goods designed exclusively for consumption within the TokenForge API routing environment.",
          "Supported payment rails include major credit/debit cards, Domestic UPI rails (INR), and decentralized cryptocurrency settlements (Solana Pay / USDC).",
          "Merchant of Record & Tax Compliance: Credit and debit card transactions are processed in accordance with global tax regulations (VAT, GST, sales tax) and PCI-DSS Level 1 security standards.",
          "Taxes are calculated and applied at checkout in accordance with local statutory requirements based on your verified billing jurisdiction.",
        ],
      },
      {
        heading: "5. Intellectual Property and Content Ownership",
        body: "TokenForge does not claim any ownership rights over your proprietary inputs, prompts, application data, or generated outputs.",
        bullets: [
          "Customer Data: You retain all right, title, and interest in and to any text, code, schema, or media you submit through the API (Prompts) and any completions returned by the models (Outputs).",
          "Zero Model Training Guarantee: TokenForge strictly DOES NOT use your prompts, completions, system instructions, or application payloads to train, fine-tune, or improve any machine learning models.",
          "Platform Rights: TokenForge and its licensors retain all rights, title, and interest in and to the TokenForge software platform, routing algorithms, API protocols, documentation, and underlying infrastructure.",
        ],
      },
      {
        heading: "6. Rate Limits, Quotas, and Fair Usage",
        body: "To guarantee equitable throughput and protect platform reliability, TokenForge enforces tier-based rate limits and concurrency controls. Any attempts to circumvent, falsify, or attack these rate-limiting mechanisms are strictly prohibited.",
      },
      {
        heading: "7. Disclaimers and Service Warranties",
        body: "TokenForge is provided on an 'AS IS' and 'AS AVAILABLE' basis. To the maximum extent permitted by law, TokenForge and its affiliates, suppliers, and payment partners disclaim all warranties, whether express, implied, statutory, or otherwise, including implied warranties of merchantability, fitness for a particular purpose, and non-infringement.",
        bullets: [
          "Artificial intelligence models are probabilistic; TokenForge does not warrant the accuracy, completeness, or suitability of outputs generated by underlying model endpoints.",
          "Upstream model providers may occasionally experience latency fluctuations or maintenance windows beyond our direct control.",
        ],
      },
      {
        heading: "8. Limitation of Liability",
        body: "To the maximum extent permitted by applicable law, in no event shall TokenForge, its directors, employees, or payment partners be liable for any indirect, punitive, incidental, special, consequential, or exemplary damages, including loss of profits, goodwill, data, or business interruption.",
        callout:
          "In all circumstances, TokenForge's total aggregate liability arising out of or related to these terms shall not exceed the total fees paid by you to TokenForge in the twelve (12) months immediately preceding the event giving rise to liability.",
      },
      {
        heading: "9. Termination and Suspension",
        body: "TokenForge reserves the right to suspend or terminate your account, revoke API keys, and freeze usage balances immediately if: (a) you breach any provision of these Terms or the Acceptable Use Policy; (b) your account exhibits fraudulent activity, chargeback abuse, or malicious cyberattacks; or (c) required by applicable law, court order, or regulatory mandate.",
      },
      {
        heading: "10. Governing Law, Jurisdiction, and Dispute Resolution",
        body: "These Terms shall be governed by and construed in accordance with applicable laws, without regard to conflict of law principles. The parties agree that any disputes must be resolved on an individual basis, and you waive any right to participate in a class-action lawsuit.",
      },
      {
        heading: "11. Modifications to Terms",
        body: "We may modify these Terms periodically to reflect evolving legal standards, technical improvements, or regulatory updates. We will notify users of material modifications by updating the 'Effective Date' at the top of this page. Continued use of TokenForge after updates constitutes acceptance.",
      },
      {
        heading: "12. Contact and Legal Notices",
        body: "For questions regarding these Terms, compliance audits, or formal legal notices, please reach out via our official Discord developer support channel at https://discord.gg/8DS5F6sGsY or contact our billing desk.",
      },
    ],
  },

  privacy: {
    label: "Privacy Policy",
    title: "Privacy notice and data protection commitment.",
    subtitle:
      "Effective September 2026. This Privacy Policy details how TokenForge collects, processes, protects, and retains your personal information, API telemetry, and billing metadata in compliance with GDPR, CCPA/CPRA, and global data privacy standards.",
    effectiveDate: "September 2026 (Version 2.5)",
    icon: ShieldCheck,
    sections: [
      {
        heading: "1. Scope and Controller Information",
        body: "TokenForge operates the developer web dashboard and the TokenForge AI Gateway API. We act as the Data Controller with respect to your account identity, authentication tokens, and billing records, and as a Data Processor with respect to API payloads routed to underlying model providers on your instruction.",
      },
      {
        heading: "2. Information We Collect",
        body: "We adhere strictly to data minimization principles and collect only the data essential to authenticate users, enforce rate limits, prevent fraud, and process transactions.",
        bullets: [
          "Account Identity Data: When signing in via GitHub OAuth or Discord OAuth, we collect your verified OAuth ID, username, public profile name, and primary email address.",
          "API Key Metadata: Non-reversible cryptographic hashes (SHA-256) of your API keys, creation timestamps, custom key labels, and last-used timestamps.",
          "Payment & Transaction Metadata: Order identifiers, transaction timestamps, payment rail (Card, UPI, or Solana), purchase tier, capacity allocation amount, and masked payment tokens. Note: TokenForge NEVER stores raw credit card numbers or bank PINs.",
          "Operational Telemetry & Usage Logs: HTTP request method, endpoint path, requested model identifier, prompt and completion token counts, latency (ms), HTTP response status code, and hashed IP addresses used for anti-abuse rate limiting.",
        ],
      },
      {
        heading: "3. Zero-Training Guarantee for AI Payloads",
        body: "Our absolute core privacy commitment to developers: TokenForge DOES NOT use your prompts, completions, system instructions, or embeddings to train, fine-tune, or optimize machine learning models.",
        callout:
          "All API prompts and completions are routed ephemerally to verified enterprise inference endpoints over encrypted TLS 1.3 connections. We do not persist durable prompt logs on our database.",
      },
      {
        heading: "4. Legal Bases for Processing (GDPR Compliance)",
        body: "If you reside in the European Economic Area (EEA), the United Kingdom, or Switzerland, we process your personal data under the following legal grounds under Regulation (EU) 2016/679 (GDPR):",
        bullets: [
          "Performance of a Contract (Art. 6(1)(b)): Processing required to deliver our API gateway service, maintain your account, and allocate compute capacity.",
          "Legitimate Interests (Art. 6(1)(f)): Securing our infrastructure, preventing fraud, detecting malicious attacks, and auditing system reliability.",
          "Legal Compliance (Art. 6(1)(c)): Retaining transaction records to satisfy statutory tax, accounting, and anti-money-laundering requirements.",
        ],
      },
      {
        heading: "5. Third-Party Processors and Service Providers",
        body: "We partner with trusted, industry-standard third-party sub-processors who adhere to stringent security agreements and data privacy frameworks:",
        bullets: [
          "Payment Processors: PCI-DSS Level 1 compliant merchant payment networks and certified domestic banking switches.",
          "Hosting & Cloud Infrastructure: Google Cloud Platform (Cloud Run, Secret Manager, Cloud SQL with SOC 2 Type II certifications).",
          "Model Inference Providers: Enterprise cloud inference endpoints for Claude, DeepSeek, Qwen, and GLM models with dedicated data protection covenants.",
        ],
      },
      {
        heading: "6. Data Retention and Deletion",
        body: "We retain account identity records for the duration of your active relationship with TokenForge. Financial ledger entries and invoice records are retained for statutory tax compliance periods (typically 7 years). Short-term operational telemetry logs are automatically scrubbed or aggregated after 30 days.",
      },
      {
        heading: "7. Your Data Protection Rights",
        body: "Depending on your jurisdiction (such as GDPR in Europe or CCPA/CPRA in California), you possess specific enforceable legal rights regarding your personal information:",
        bullets: [
          "Right of Access: You may request a copy of the personal information we hold about you.",
          "Right to Rectification: You may request correction of inaccurate or incomplete personal records.",
          "Right to Erasure ('Right to be Forgotten'): You may request deletion of your account and personal data within 30 days, subject to statutory tax retention exemptions.",
          "Right to Restrict or Object: You may object to certain processing operations.",
          "Non-Discrimination: We will never discriminate against you for exercising your privacy rights.",
          "To exercise any of these rights, contact our compliance desk via our official Discord at https://discord.gg/8DS5F6sGsY.",
        ],
      },
      {
        heading: "8. Data Security and Encryption",
        body: "We implement robust organizational, technical, and physical safeguards designed to prevent unauthorized access, loss, or destruction of personal data:",
        bullets: [
          "End-to-End Encryption in Transit: All incoming and outbound traffic is encrypted via TLS 1.3.",
          "Encryption at Rest: Database volumes, secrets, and ledger states are encrypted using AES-256.",
          "Credential Protection: API keys are salted and hashed; raw keys cannot be recovered by TokenForge staff.",
        ],
      },
      {
        heading: "9. Cookies and Local Storage",
        body: "TokenForge does not use invasive cross-site advertising cookies. We use only strictly necessary session cookies and local storage tokens required for user authentication, CSRF defense, and interface theme persistence.",
      },
      {
        heading: "10. Data Protection and Inquiries",
        body: "If you have questions, concerns, or requests regarding this Privacy Policy or our data protection practices, please contact our support desk via our official Discord at https://discord.gg/8DS5F6sGsY.",
      },
    ],
  },

  refund: {
    label: "Refund Policy",
    title: "Transparent refund, cancellation & delivery policy.",
    subtitle:
      "Effective September 2026. TokenForge provides a clear, fair, and reliable refund policy designed in strict alignment with consumer protection standards and global merchant compliance guidelines.",
    effectiveDate: "September 2026 (Version 2.5)",
    icon: RotateCcw,
    sections: [
      {
        heading: "1. Our Commitment to Developer Trust",
        body: "At TokenForge, we want developers and engineering teams to build with confidence. We maintain an open, fair, and accessible refund process for all our customers, whether paying via credit/debit card, domestic UPI, or cryptocurrency. We believe in transparent billing without hidden traps.",
      },
      {
        heading: "2. Instant Digital Delivery & 30-Day Unused Refund Window",
        body: "API usage capacity is a digital software product delivered electronically and immediately to your account upon payment confirmation. In full alignment with global Merchant of Record standards and consumer protection best practices, TokenForge provides a 30-day refund window from the date of purchase for any unconsumed usage capacity balance.",
        callout:
          "Capacity is delivered instantly upon checkout and is non-refundable once consumed. If you purchase a developer package or balance top-up and have unconsumed balance remaining, you may request a 100% refund of your unused capacity balance within thirty (30) calendar days of transaction completion by reaching out on our official Discord at https://discord.gg/8DS5F6sGsY.",
      },
      {
        heading: "3. Qualifying Scenarios for Refunds",
        body: "You are entitled to a full or pro-rated refund under any of the following circumstances:",
        bullets: [
          "Unused Balance Returns: You purchased an API package or balance top-up within the last 30 days and have unused quota remaining on your account.",
          "Technical Outages or Service Failure: Documented platform outages or prolonged upstream routing failures that prevented TokenForge from fulfilling your API requests within reasonable service expectations.",
          "Duplicate or Accidental Charges: Multiple charges generated due to network latency, payment gateway timeouts, or accidental duplicate submissions.",
          "Discrepancies in Capacity Allocation: Any technical fault where the purchased developer tier was not properly credited to your account balance.",
        ],
      },
      {
        heading: "4. Non-Refundable Scenarios",
        body: "Refunds cannot be issued under the following conditions:",
        bullets: [
          "Consumed Compute: Capacity is a digital product delivered instantly and is strictly non-refundable once consumed for completed model inference requests (where tokens were successfully computed and returned).",
          "Acceptable Use Violations: Accounts suspended or terminated due to verified violations of our Acceptable Use Policy (such as abusive attacks, malware generation, automated scraping, or illegal activities).",
          "Expired Eligibility Window: Refund requests submitted more than thirty (30) calendar days after the original transaction date.",
          "Third-Party Gas/Network Fees: For cryptocurrency payments via Solana, on-chain transaction network fees (~$0.00025) paid to network validators are inherently non-recoverable.",
        ],
      },
      {
        heading: "5. Step-by-Step Refund Request Procedure",
        body: "Initiating a refund request is straightforward and hassle-free:",
        bullets: [
          "Step 1: Contact our support desk by joining our official Discord at https://discord.gg/8DS5F6sGsY or submit a ticket from the Tickets section in your Developer Dashboard.",
          "Step 2: Provide your account email, the Order ID (e.g., 'TF_...' or card payment reference), the transaction date, and a brief description of the reason for your refund request.",
          "Step 3: Our compliance and billing desk reviews all refund submissions within 24 to 48 hours (maximum 1–3 business days).",
          "Step 4: Once approved, the refund is immediately triggered to your original payment method.",
        ],
      },
      {
        heading: "6. Processing Timeframes and Payouts",
        body: "Once our desk approves a refund, the timeframe for the funds to reappear in your account depends on the payment rail utilized:",
        bullets: [
          "Credit & Debit Cards: Processed through certified merchant payment gateways. Funds typically reflect on your bank or credit card statement within 5 to 10 business days, depending on your card issuer's clearing cycle.",
          "Domestic UPI (INR): Processed directly back to the originating bank VPA or bank account via IMPS/NEFT within 24 to 48 business hours.",
          "Solana Pay (USDC): Re-deposited as USDC directly to the originating Solana wallet address within 1 business day.",
        ],
      },
      {
        heading: "7. Cardholder Inquiries and Dispute Resolution",
        body: "We strongly urge you to reach out to TokenForge Support on Discord (https://discord.gg/8DS5F6sGsY) directly before initiating a formal bank dispute. Our support team can resolve issues, verify transactions, and issue refunds significantly faster than third-party dispute arbitrations.",
      },
      {
        heading: "8. Cancellation and Subscription Policy",
        body: "TokenForge operates on a flexible on-demand and prepaid developer package model. We do NOT enforce locked monthly recurring subscription traps. You only pay when you choose to top up your balance. As there are no forced recurring subscription fees, you may cease using TokenForge at any time without incurring cancellation penalties.",
      },
      {
        heading: "9. Billing & Contact Support Information",
        body: "If you have any questions regarding your invoice, need assistance with a payment receipt, or wish to track an existing refund request, our team is standing by to help:",
        bullets: [
          "Official Discord Support Channel: https://discord.gg/8DS5F6sGsY",
          "Contact & Ticket Desk: Available on Discord for 1-on-1 assistance",
          "Community & Status Announcements: Official TokenForge Discord Community (https://discord.gg/8DS5F6sGsY)",
          "Expected Response Time: Prompt turnaround (typically within 24 hours).",
        ],
      },
    ],
  },

  "acceptable-use": {
    label: "Acceptable Use Policy",
    title: "Standards for responsible platform use.",
    subtitle:
      "Effective September 2026. This Acceptable Use Policy outlines prohibited activities, security guidelines, and safety principles that govern every TokenForge account, API call, and application built on our platform.",
    effectiveDate: "September 2026 (Version 2.5)",
    icon: CheckCircle2,
    sections: [
      {
        heading: "1. Core Philosophy",
        body: "TokenForge empowers developers and engineering teams to build ambitious software using cutting-edge artificial intelligence infrastructure. We expect all developers to employ our APIs responsibly, ethically, and in full accordance with applicable international laws.",
      },
      {
        heading: "2. Strictly Prohibited Misuse",
        body: "You must not use TokenForge, its APIs, or model outputs for any of the following prohibited purposes:",
        bullets: [
          "Illegal Activities: Generating, facilitating, or promoting illegal acts, fraud, money laundering, human trafficking, or intellectual property theft.",
          "Malicious Cyber Activity: Developing malware, ransomware, exploits, phishing schemes, automated denial-of-service tools, or unauthorized vulnerability scanners.",
          "CSAM & Exploitation: Creating, generating, or facilitating Child Sexual Abuse Material (CSAM) or any form of child exploitation (zero-tolerance policy; violations are reported immediately to law enforcement).",
          "Harassment, Defamation, & Hate Speech: Generating abusive, harassing, defamatory, or threatening content directed at individuals or protected groups.",
          "Weapons & Physical Harm: Designing weapons, chemical agents, biological hazards, explosives, or military munitions.",
          "Deceptive Impersonation: Deploying deceptive synthetic media or chatbots intended to mislead consumers by masquerading as specific real individuals or financial institutions.",
        ],
      },
      {
        heading: "3. High-Risk Domains Requiring Human Oversight",
        body: "TokenForge APIs must not be utilized for fully autonomous high-risk applications where algorithmic errors could cause severe physical injury, financial ruin, or denial of fundamental human rights without qualified human-in-the-loop review (e.g., medical diagnostics, automated credit scoring, legal sentencing).",
      },
      {
        heading: "4. System Integrity and Infrastructure Protection",
        body: "You must protect the stability and performance of the TokenForge infrastructure. You agree not to:",
        bullets: [
          "Probe, scan, or test the vulnerability of our network, APIs, or database systems without prior written authorization.",
          "Bypass, defeat, or manipulate rate limits, quota enforcement, or security throttling systems.",
          "Scrape, harvest, or bulk-extract TokenForge dashboard telemetry or system performance data.",
          "Redistribute raw TokenForge master administrative keys to unauthorized third parties.",
        ],
      },
      {
        heading: "5. Monitoring, Auditing, and Enforcement",
        body: "While TokenForge does not inspect prompt contents for machine-learning training, our automated anomaly detection and safety filters monitor operational metadata, traffic volumes, and error patterns to detect abuse.",
        bullets: [
          "Warning & Throttling: Minor or unintentional rate limit exceedances may result in temporary request throttling.",
          "Key Revocation & Account Suspension: Material violations of this policy will result in immediate API key revocation and permanent account termination.",
          "Law Enforcement Cooperation: TokenForge cooperates fully with lawful requests from law enforcement agencies regarding criminal misconduct.",
        ],
      },
      {
        heading: "6. Reporting Violations",
        body: "If you discover or suspect that an application powered by TokenForge is violating this Acceptable Use Policy, please report it immediately to our moderation team via our official Discord at https://discord.gg/8DS5F6sGsY. Our trust and safety team investigates all reports promptly.",
      },
    ],
  },
};

function parseLegalVariant(pathname: string): LegalVariant {
  const normalized = pathname.toLowerCase().replace(/^\/+|\/+$/g, "");
  const segment = normalized.split("/").pop() || "terms";
  if (segment === "terms" || segment === "tos" || segment === "terms-of-service") return "terms";
  if (segment === "privacy" || segment === "privacy-policy") return "privacy";
  if (segment === "refund" || segment === "refunds" || segment === "refund-policy" || segment === "cancellation") return "refund";
  if (segment === "acceptable-use" || segment === "acceptable_use" || segment === "aup") return "acceptable-use";
  return "terms";
}

export default function Legal() {
  const [location] = useLocation();
  const variant = parseLegalVariant(location);
  const content = legalContent[variant] ?? legalContent.terms;
  const ActiveIcon = content.icon;

  return (
    <div className="public-page tf-public-surface legal-page">
      <PublicNav />
      <main className="legal-page">
        {/* Hero Section */}
        <div className="legal-hero">
          <div className="legal-icon">
            <ActiveIcon size={24} />
          </div>
          <p className="text-xs uppercase tracking-widest text-emerald-400 font-semibold mb-2">
            {content.label}
          </p>
          <h1 className="text-3xl md:text-5xl font-extrabold text-white tracking-tight mb-4">
            {content.title}
          </h1>
          <span className="text-sm md:text-base text-slate-400 max-w-2xl mx-auto block leading-relaxed">
            {content.subtitle}
          </span>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-mono font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              {content.effectiveDate}
            </span>
            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-mono font-medium bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              Dodo Payments MoR & PCI-DSS Compliant
            </span>
            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-mono font-medium bg-white/5 text-slate-300 border border-white/10">
              Zero Model Training Policy
            </span>
          </div>
        </div>

        {/* Legal Grid Content */}
        <div className="legal-grid">
          {/* Aside Navigation */}
          <aside>
            <div className="text-[10px] uppercase font-bold text-slate-500 tracking-wider mb-2 px-3.5 hidden sm:block">
              Legal Documents
            </div>
            <Link
              href="/legal/terms"
              className={variant === "terms" ? "active" : ""}
            >
              Terms of Service
            </Link>
            <Link
              href="/legal/privacy"
              className={variant === "privacy" ? "active" : ""}
            >
              Privacy Policy
            </Link>
            <Link
              href="/legal/refund"
              className={variant === "refund" ? "active" : ""}
            >
              Refund Policy
            </Link>
            <Link
              href="/legal/acceptable-use"
              className={variant === "acceptable-use" ? "active" : ""}
            >
              Acceptable Use
            </Link>

            <div className="mt-8 pt-6 border-t border-white/10 hidden sm:block">
              <div className="text-[11px] font-semibold text-slate-300 mb-1">
                Direct Support
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed mb-3">
                Need help or have compliance inquiries?
              </p>
              <a
                href="https://discord.gg/8DS5F6sGsY"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-xs text-emerald-400 hover:text-emerald-300 font-medium"
              >
                <MessageCircle size={13} /> Discord Support
              </a>
            </div>
          </aside>

          {/* Article Sections */}
          <article>
            {content.sections.map((section, idx) => (
              <section key={section.heading} className="space-y-3">
                <h2 className="text-xl md:text-2xl font-bold text-white tracking-tight">
                  {section.heading}
                </h2>
                <p className="text-sm text-slate-300 leading-relaxed">
                  {section.body}
                </p>

                {section.bullets && section.bullets.length > 0 && (
                  <ul className="mt-3 space-y-2 pl-2">
                    {section.bullets.map((bullet, bIdx) => (
                      <li
                        key={bIdx}
                        className="flex items-start gap-2.5 text-sm text-slate-400 leading-relaxed"
                      >
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 mt-2 flex-shrink-0" />
                        <span>{bullet}</span>
                      </li>
                    ))}
                  </ul>
                )}

                {section.callout && (
                  <div className="mt-4 p-4 rounded-xl border border-emerald-500/20 bg-emerald-950/20 text-emerald-200 text-xs md:text-sm leading-relaxed">
                    <strong>Important Note: </strong>
                    {section.callout}
                  </div>
                )}
              </section>
            ))}

            {/* Support Help Banner */}
            <div className="mt-14 p-6 rounded-2xl border border-white/10 bg-[#0d120e] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-white font-semibold text-sm flex items-center gap-2">
                  <HelpCircle size={16} className="text-emerald-400" />
                  Have questions regarding our compliance or billing?
                </h3>
                <p className="text-slate-400 text-xs mt-1">
                  Our compliance desk reviews all refund, privacy, and account
                  inquiries within 24–48 hours.
                </p>
              </div>
              <div className="flex items-center gap-3">
                <a
                  href="https://discord.gg/8DS5F6sGsY"
                  target="_blank"
                  rel="noreferrer"
                  className="px-4 py-2 rounded-lg bg-emerald-400 text-black font-semibold text-xs hover:bg-emerald-300 transition-colors inline-flex items-center gap-1.5"
                >
                  <MessageCircle size={13} /> Contact Support (Discord)
                </a>
                <Link
                  href="/pricing"
                  className="px-3.5 py-2 rounded-lg border border-white/10 text-slate-300 hover:text-white text-xs font-medium transition-colors"
                >
                  View Pricing
                </Link>
              </div>
            </div>
          </article>
        </div>
      </main>
      <PublicFooter />
    </div>
  );
}
