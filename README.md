<div align="center">

# ⚡ TokenForge

### Enterprise-Grade Universal AI Gateway, Model Orchestration & High-Precision Settlement Platform

[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-blue.svg?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-22.x-green.svg?style=flat-square&logo=node.js)](https://nodejs.org/)
[![React](https://img.shields.io/badge/React-19-61dafb.svg?style=flat-square&logo=react)](https://react.dev/)
[![Tailwind CSS](https://img.shields.io/badge/TailwindCSS-v4-38bdf8.svg?style=flat-square&logo=tailwind-css)](https://tailwindcss.com/)
[![Drizzle ORM](https://img.shields.io/badge/Drizzle-ORM-C5F74F.svg?style=flat-square)](https://orm.drizzle.team/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)

*A unified, ultra-low latency AI proxy bridging OpenAI and Anthropic SDK protocols with intelligent multi-provider routing, cryptographic tool-state preservation, zero-drift nanodollar billing, and decentralized payment rails.*

[Live Architecture](#-system-architecture) • [Key Capabilities](#-key-capabilities) • [API Specification](#-api-specification) • [Settlement Engine](#-nanodollar-settlement-engine) • [Quick Start](#-quick-start)

---

</div>

## 📌 Executive Summary

Modern AI application stacks suffer from fragmented vendor APIs, erratic provider rate limits, lack of deterministic failover, and inaccurate token accounting. **TokenForge** solves these bottlenecks with an enterprise-grade API gateway and model orchestration engine.

It exposes unified **OpenAI-compatible (`/v1/chat/completions`)** and **Anthropic-compatible (`/v1/messages`)** interfaces while transparently handling dynamic upstream key pooling, automated circuit-breaking, tool-call state hydration, and real-time Server-Sent Events (SSE) telemetry.

---

## 🏛 System Architecture

```
                                      ┌────────────────────────────────────────────────────────┐
                                      │                      CLIENT TIER                       │
                                      │  OpenAI SDK • Anthropic SDK • LangChain • Claude Code  │
                                      └───────────────────────────┬────────────────────────────┘
                                                                  │
                                                HTTP Bearer Token / Streaming SSE
                                                                  ▼
┌─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                                 TOKENFORGE EDGE GATEWAY                                                 │
│                                                                                                                         │
│  ┌───────────────────────────┐      ┌───────────────────────────┐      ┌─────────────────────────────────────────────┐  │
│  │   Authentication & AuthZ  │ ───► │  Rate Limiting & Safety   │ ───► │        Universal Protocol Transformer       │  │
│  │  • One-Time Key Validation│      │  • Leaky-Bucket Circuit   │      │  • OpenAI ↔ Anthropic Schema Normalization  │  │
│  │  • SHA-256 Digest Match   │      │  • Content Redaction Rules│      │  • Streaming SSE Chunk Synthesis            │  │
│  └───────────────────────────┘      └───────────────────────────┘      └──────────────────────┬──────────────────────┘  │
│                                                                                               │                         │
│                                     ┌─────────────────────────────────────────────────────────┘                         │
│                                     ▼                                                                                   │
│  ┌──────────────────────────────────────────────────────────────┐      ┌─────────────────────────────────────────────┐  │
│  │               Dynamic Model Orchestrator                     │      │        Nanodollar Settlement Engine         │  │
│  │  • Tiered Priority Health Scoring & Auto-Failover           │ ◄──► │  • 2-Phase Lock: Reserve -> Meter -> Settle │  │
│  │  • AES-256-GCM Tool Continuation Vault (GLM / b.ai)         │      │  • 10^-9 USD Precision (Zero Float Drift)   │  │
│  │  • Concurrency Leases & Provider Quota Pools                │      │  • Dual-Bucket: PAYG vs Promotional Credits │  │
│  └──────────────────────────────┬───────────────────────────────┘      └─────────────────────────────────────────────┘  │
└─────────────────────────────────┼───────────────────────────────────────────────────────────────────────────────────────┘
                                  │
         ┌────────────────────────┼────────────────────────┬────────────────────────┐
         ▼                        ▼                        ▼                        ▼
┌─────────────────┐      ┌─────────────────┐      ┌─────────────────┐      ┌─────────────────┐
│ OpenAI / Azure  │      │ Anthropic Opus  │      │ DeepSeek / Qwen │      │ GLM / OpenCode  │
│ Upstream Pool   │      │ Upstream Pool   │      │ Upstream Pool   │      │ Upstream Pool   │
└─────────────────┘      └─────────────────┘      └─────────────────┘      └─────────────────┘
```

---

## 🚀 Key Capabilities

### 1. Universal Cross-SDK Compatibility
- **Drop-in Interchangeability**: Developers point existing `OpenAI()` or `Anthropic()` client libraries to TokenForge simply by overriding `baseURL`.
- **Bidirectional Streaming**: Translates disparate upstream chunk events into strict OpenAI `data: {"choices": [...]}` and Anthropic `event: content_block_delta` formats on the fly.
- **Identity & Safety Sanitization**: Dynamically transforms model responses with brand and origin protection filters.

### 2. Intelligent Provider Routing & Circuit Breakers
- **Multi-Credential Slot Management**: Transparently load-balances requests across segregated credential slots per model family.
- **Durable Circuit States**: Automatically tracks consecutive HTTP 429s/503s with exponential backoff cooldowns, preventing cascading system degradation.
- **Encrypted Session Continuations**: Persists provider-private reasoning and tool continuations in secure encrypted vaults (AES-256-GCM) with automated TTL eviction.

### 3. High-Precision Nanodollar Settlement Engine
- **Fixed-Point Arithmetic**: Replaces standard IEEE 754 floating-point operations with $10^{-9}$ USD integer nanos (`bigint`), eliminating compounding sub-cent truncation errors.
- **Two-Phase Commit Settlement**:
  1. **Pre-Flight Reservation**: Calculates worst-case token allocation and reserves balances before invocation.
  2. **Post-Flight Settlement**: Exact prompt + completion token usage is calculated, and unspent balances are released atomically.
- **Dual Wallet Architecture**: Segregates Tier 1 Pay-As-You-Go (PAYG) on-demand balances from Tier 2 promotional bundle credits.

### 4. Multi-Modal Decentralized & Real-Time Payments
- **Solana Pay**: Zero-gateway-fee, direct on-chain settlement with merchant wallet transaction verification and instant balance recharge.
- **UPI QR Microservice**: Instant QR generation and webhook verification for seamless domestic payment flows.
- **Credit Card / International Rails**: Unified billing via secure webhooks and audited ledger entries.

### 5. Enterprise Telemetry & Live Ops
- **Real-Time SSE Request Bus**: Live operational streaming of active requests, token throughput, latency percentiles, and provider error codes.
- **Hardware-Level Push Notifications**: Background Service Worker integrated with Web App Manifest and vibration patterns for immediate alerts when critical requests fail.
- **Role-Based Admin Console**: Comprehensive user directory, per-user credit toggles, audit logs, credential rotation, and prompt abuse safety inspection.

---

## 💻 Tech Stack

| Domain | Technologies |
| :--- | :--- |
| **Backend Core** | Node.js 22, Express, TypeScript, tRPC v11, Zod |
| **Microservices** | Python 3.11, FastAPI, Uvicorn (Solana & UPI Gateways) |
| **Database & ORM** | MySQL / Cloud SQL, Drizzle ORM, Firebase Firestore |
| **Frontend SPA** | React 19, Vite, Tailwind CSS v4, Radix UI, TanStack Query |
| **Data Viz & Telemetry** | Cytoscape.js, Mermaid.js, Lucide Icons |
| **Security & Auth** | PBKDF2 / Argon2id, AES-256-GCM, Discord OAuth 2.0, GitHub OAuth |

---

## ⚡ API Specification

TokenForge supports any standard LLM client with zero code changes.

### Calling with OpenAI SDK (Python)

```python
from openai import OpenAI

client = OpenAI(
    api_key="tf_live_xxxxxxxxxxxxxxxxxxxx",
    base_url="https://tokenforge.ai.studio/v1"
)

response = client.chat.completions.create(
    model="claude-3-7-sonnet",
    messages=[{"role": "user", "content": "Explain zero-drift financial ledgers in one paragraph."}],
    stream=True
)

for chunk in response:
    content = chunk.choices[0].delta.content or ""
    print(content, end="", flush=True)
```

### Calling with Anthropic SDK (TypeScript / Node.js)

```typescript
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({
  apiKey: "tf_live_xxxxxxxxxxxxxxxxxxxx",
  baseURL: "https://tokenforge.ai.studio/v1",
});

const message = await anthropic.messages.create({
  model: "claude-3-7-sonnet",
  max_tokens: 1024,
  messages: [{ role: "user", content: "Analyze distributed circuit breakers." }],
});

console.log(message.content[0].text);
```

### Direct cURL Request

```bash
curl -X POST https://tokenforge.ai.studio/v1/chat/completions \
  -H "Authorization: Bearer tf_live_your_api_key" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "deepseek-r1",
    "messages": [{"role": "user", "content": "Hello TokenForge!"}],
    "temperature": 0.7
  }'
```

---

## 💳 Nanodollar Settlement Engine

To guarantee zero financial drift across millions of micro-transactions, TokenForge uses integer-based nanodollars:

$$\text{Charge (nanos)} = (\text{Input Tokens} \times \text{Rate}_{\text{input}}) + (\text{Output Tokens} \times \text{Rate}_{\text{output}})$$

$$\$1.00\text{ USD} = 1,000,000,000\text{ Nanos}$$

```typescript
// Atomic settlement transaction flow
await db.transaction(async (tx) => {
  // 1. Debit exact charged nanos
  await tx.update(creditAccounts)
    .set({ balanceNanos: sql`${creditAccounts.balanceNanos} - ${finalChargeNanos}` })
    .where(eq(creditAccounts.userId, userId));

  // 2. Append immutable record to audit ledger
  await tx.insert(creditLedger).values({
    userId,
    kind: "usage_debit",
    amountNanos: -finalChargeNanos,
    balanceAfterNanos: newBalance,
    referenceId: `req:${requestId}`,
  });
});
```

---

## 🛠 Project Structure

```
├── client/                     # React 19 Frontend SPA
│   ├── src/
│   │   ├── components/         # Reusable UI components & Admin tables
│   │   │   ├── admin/          # Role-Based operational administration
│   │   │   ├── dashboard/      # Telemetry graphs, keys, usage charts
│   │   │   └── payments/       # Solana Pay, UPI QR, and card interfaces
│   │   ├── pages/              # Route views (Playground, LiveLog, Models)
│   │   └── App.tsx             # Route declarations and tRPC provider
│   └── public/
│       ├── sw.js               # Service Worker for failure notifications
│       └── manifest.json       # PWA manifest
├── server/                     # High-Throughput Node.js Gateway
│   ├── _core/                  # Core runtime, telemetry bus, and TRPC
│   ├── openaiGateway.ts        # OpenAI protocol adapter & SSE engine
│   ├── anthropicGateway.ts     # Anthropic protocol adapter & parser
│   ├── db.ts                   # Ledger, circuit breakers, and key management
│   ├── routers.ts              # tRPC type-safe API router definition
│   └── solanaPayGateway.ts     # Web3 Solana settlement bridge
├── drizzle/                    # Database migrations & relational schemas
│   └── schema.ts               # Core database definitions in Drizzle
├── solana_pay_fastapi.py       # Standalone high-speed Solana settlement engine
├── upi_pay_fastapi.py          # Unified Payments Interface QR microservice
└── package.json                # Dependencies, scripts, and build tasks
```

---

## 🚀 Quick Start

### Prerequisites
- **Node.js**: `v20.x` or `v22.x`
- **Package Manager**: `npm` or `pnpm`
- **Database**: MySQL 8.0+ or Google Cloud SQL

### Installation

```bash
# 1. Clone repository
git clone https://github.com/ArpitKumar8649/tokenforge_v2.git
cd tokenforge_v2

# 2. Install dependencies
npm install

# 3. Configure environment variables
cp .env.example .env
# Edit .env with your database connection string and secret keys

# 4. Run database migrations
npm run db:push

# 5. Start development server (Client + API Gateway)
npm run dev
```

The application will be live at `http://localhost:3000`.

---

## 🛡 Security & Compliance

- **Zero-Storage Credential Policy**: Upstream provider credentials are encrypted in-memory and in secure vaults; plaintext secrets are never written to disk or audit logs.
- **One-Way Cryptographic Key Hashing**: Developer API keys (`tf_live_*`) are shown exactly once at generation and stored as salted hashes.
- **Audit Trails**: Every administrative override, giveaway, and credential pool rotation creates an immutable record in `audit_events`.

---

## 📄 License

This project is licensed under the [MIT License](LICENSE) - see the LICENSE file for details.

<div align="center">
  <sub>Engineered with precision for high-concurrency AI workloads.</sub>
</div>
