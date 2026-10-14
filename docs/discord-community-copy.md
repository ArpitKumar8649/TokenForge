# TokenForge Discord Community Copy

This document contains the recommended first posts for the **#welcome-and-rules** and **#announcements** channels. The copy reflects TokenForge’s current OpenAI-compatible API gateway, account-credit, API-key, and acceptable-use posture. It can be pasted into Discord as written.

---

## #welcome-and-rules — First post

# Welcome to TokenForge

TokenForge is a developer-focused gateway for selected text-chat models through one accountable, OpenAI-compatible API surface. This community is where builders can get help, share implementation feedback, report reproducible issues, and follow platform updates.

Please read these rules before posting or requesting support. Participation in this server means you agree to follow them.

## 1. Be constructive and professional

Treat every member with respect. Harassment, discrimination, threats, personal attacks, hostile language, or deliberately disruptive behaviour are not permitted. Challenge ideas and technical claims, not people.

## 2. Protect credentials and personal information

**Never share an API key, password, session token, private prompt, billing detail, or personally identifying information** in a public channel. TokenForge API keys are displayed only once when created or rotated; the team cannot recover a lost plaintext key. Revoke an exposed key immediately from the dashboard and create a replacement.

## 3. Use TokenForge responsibly

Do not use TokenForge to facilitate unlawful activity, fraud, credential theft, malware, unauthorized access, circumvention of security controls, harassment, exploitation, or the creation or distribution of harmful content. Do not attempt to bypass account limits, model controls, rate limits, credit accounting, or provider restrictions.

## 4. Do not abuse platform capacity

The service is designed for deliberate development and evaluation. Do not run uncontrolled bulk traffic, key-sharing schemes, denial-of-service activity, automated account creation, scraping that violates applicable terms, or workloads that materially impair service for other builders. Use reasonable retry behaviour and respect all returned API errors and headers.

## 5. Keep support requests reproducible and safe

For a technical issue, include the model name, approximate timestamp and timezone, request ID if available, a redacted error message, and the smallest reproducible example. Replace every secret with a placeholder such as `tf_live_...`. Do not paste real authorization headers or raw logs containing sensitive data.

## 6. Use the right channel

Use **#help** for setup, integration, and account questions; **#general** for constructive platform discussion; **#resources** for official guides and examples; and **#announcements** for staff updates. Please keep off-topic discussion in **#off-topic** so technical support remains easy to search.

## 7. No impersonation or misleading claims

Do not impersonate TokenForge staff, model providers, other community members, or third parties. Do not claim that a model, provider, feature, or integration is available, endorsed, or guaranteed unless it appears in the official TokenForge dashboard, documentation, or staff announcements.

## 8. Respect intellectual property and confidentiality

Share only material you are authorized to share. Do not upload proprietary source code, confidential prompts, private datasets, paid content, or material that infringes another party’s rights. You remain responsible for your own prompts, inputs, outputs, and integrations.

## 9. No unsolicited promotion, spam, or scams

Do not post referral links, repetitive messages, unsolicited direct messages, phishing links, misleading giveaways, token/crypto promotions, or unrelated advertising. Staff will never ask for your password or an API key through direct messages.

## 10. Report concerns privately and promptly

If you see an exposed secret, security concern, scam, abuse, or serious policy violation, do not amplify it. Report it to staff or use the appropriate Discord reporting tools. If a secret has been exposed, revoke it first; screenshots and descriptions should be redacted.

## 11. Moderation decisions protect the community

Moderators may remove content, limit access, or remove members when necessary to protect users, platform reliability, legal compliance, or the community’s constructive environment. Repeated or severe violations may result in removal without warning.

## 12. Policies and availability may evolve

TokenForge is actively developing. Available models, capacity, credit policies, rate limits, and community processes may change as the platform matures. The dashboard, official documentation, and **#announcements** are the current sources of truth.

> **Quick start:** Create an account, generate a labeled API key, copy it once, and begin with the dashboard’s cURL, JavaScript, or Python quick-start. The active hosted endpoint is `https://tokengate-cqt9ivzs.manus.space`.

Thank you for helping us keep TokenForge thoughtful, reliable, and useful for builders.

---

## #announcements — Launch announcement

# TokenForge is now open for builders

We are pleased to welcome you to **TokenForge**: a developer-focused, OpenAI-compatible API gateway for selected text-chat models. TokenForge brings model access, API-key management, transparent usage logging, credit-aware requests, and a browser-based Playground into one considered developer workspace.

## What you can do today

| Capability | What it means |
|---|---|
| OpenAI-compatible API | Use familiar chat-completions patterns with the TokenForge hosted endpoint. |
| Curated model catalogue | Browse available text-chat routes, model status, and transparent TokenForge rates. |
| Secure API-key controls | Create, rotate, and revoke labeled keys. Plaintext secrets are shown only at creation or rotation. |
| Developer quick-starts | Copy cURL, JavaScript, or Python examples directly from the **API Keys** dashboard. |
| Playground and observability | Test prompts in the dashboard and review model, token, and credit activity in Usage Logs. |
| Account credits | New accounts receive the current introductory balance, with a daily dashboard check-in when available. |

## Start here

1. Create your TokenForge account.
2. Open **Dashboard → API Keys** and create a labeled key for your project.
3. Save the plaintext key securely; it will not be shown again.
4. Copy a cURL, JavaScript, or Python quick-start and make your first request.
5. Review **Usage Logs** to understand token usage and the associated credit deduction.

> **Hosted API base URL:** `https://tokengate-cqt9ivzs.manus.space`  
> **Chat Completions:** `https://tokengate-cqt9ivzs.manus.space/v1/chat/completions`

## Important operating notes

TokenForge is a developing platform. Model availability, capacity, rate limits, and credit requirements can change, and a model may be temporarily unavailable when the platform or an upstream provider needs protection. Build defensively: respect HTTP status codes and rate-limit headers, use bounded retries with backoff, and avoid relying on any single model route for a production-critical workflow without appropriate fallback handling.

Please do not post API keys, authorization headers, passwords, or unredacted production logs in Discord. If you believe a key has been exposed, revoke it immediately in the dashboard, rotate the credential, and contact staff with redacted context if support is needed.

We welcome actionable feedback. The most helpful reports include the model name, approximate time, request ID where available, and a minimal redacted reproduction. Your feedback will help refine reliability, documentation, model discovery, and the developer experience.

Thank you for joining TokenForge. Build carefully, experiment responsibly, and let us know what would make the platform more useful.

---

## Optional #announcements — Operational update template

# TokenForge service update

**Status:** [Operational / Investigating / Monitoring / Resolved]  
**Started:** [Date and time, timezone]  
**Affected surface:** [Model route, API endpoint, dashboard feature, or provider]  
**Impact:** [Brief user-visible description]

We are [investigating / mitigating / monitoring] an issue affecting **[affected surface]**. During this period, some requests may return **[expected error or symptom]**. Account credentials and provider secrets remain protected; this update concerns service availability only.

**What you should do:** [Retry later / use an available alternative model / avoid rotating keys / no action required].

We will post the next update by **[time and timezone]**, or sooner if the issue is resolved.

---

## Optional #announcements — Resolution template

# TokenForge service update — resolved

**Resolved:** [Date and time, timezone]  
**Affected surface:** [Model route, API endpoint, dashboard feature, or provider]

The issue affecting **[affected surface]** has been resolved. We have [brief corrective action, without exposing sensitive implementation details] and are continuing to monitor the service.

If you still see an error, please share the model name, approximate timestamp, request ID where available, and a fully redacted error message in **#help**. Thank you for your patience.
