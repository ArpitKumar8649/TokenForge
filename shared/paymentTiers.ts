export const USD_TO_INR_RATE = 96; // 1 USD = 96 INR benchmark conversion
export const UPI_INTERNAL_SURCHARGE_USD = 1; // +$1 USD surcharge applied internally on UPI scan only
export const UPI_INTERNAL_SURCHARGE_INR = UPI_INTERNAL_SURCHARGE_USD * USD_TO_INR_RATE; // ₹96

export interface UPITier {
  id: string;
  name: string;
  amountUsd: number; // Displayed plan price ($10, $25, $50)
  amountInr: number; // Displayed INR equivalent (₹960, ₹2,400, ₹4,800)
  scanAmountUsd: number; // Scanned equivalent with internal +$1 USD ($11, $26, $51)
  scanAmountInr: number; // Scanned amount in INR (₹1,056, ₹2,496, ₹4,896)
  credits: number;
  creditsNanos: number;
  popular?: boolean;
  description: string;
}

export interface CryptoTier {
  id: string;
  name: string;
  usd: number;
  credits: number;
  creditsNanos: number;
  popular?: boolean;
}

export const UPI_TIERS: UPITier[] = [
  {
    id: "inr_starter",
    name: "Starter",
    amountUsd: 10,
    amountInr: 960, // $10 * 96 displayed above
    scanAmountUsd: 11, // $10 + $1 scanned internally
    scanAmountInr: 1056, // 11 * 96 = ₹1,056 charged on scan
    credits: 3000,
    creditsNanos: 3000 * 1_000_000_000,
    description: "Ideal for light prototyping and personal scripts ($10/mo · ₹960)",
  },
  {
    id: "inr_developer",
    name: "Pro Plan",
    amountUsd: 25,
    amountInr: 2400, // $25 * 96 displayed above
    scanAmountUsd: 26, // $25 + $1 scanned internally
    scanAmountInr: 2496, // 26 * 96 = ₹2,496 charged on scan
    credits: 8500,
    creditsNanos: 8500 * 1_000_000_000,
    popular: true,
    description: "Most popular for active builders and automated agents ($25/mo · ₹2,400)",
  },
  {
    id: "inr_power",
    name: "Max Plan",
    amountUsd: 50,
    amountInr: 4800, // $50 * 96 displayed above
    scanAmountUsd: 51, // $50 + $1 scanned internally
    scanAmountInr: 4896, // 51 * 96 = ₹4,896 charged on scan
    credits: 18000,
    creditsNanos: 18000 * 1_000_000_000,
    description: "Enterprise scale inference for high-demand clusters ($50/mo · ₹4,800)",
  },
  {
    id: "inr_power_100",
    name: "Power Plan",
    amountUsd: 100,
    amountInr: 9600, // $100 * 96 displayed above
    scanAmountUsd: 101, // $100 + $1 scanned internally
    scanAmountInr: 9696, // 101 * 96 = ₹9,696 charged on scan
    credits: 40000,
    creditsNanos: 40000 * 1_000_000_000,
    description: "Heavy reasoning pipelines and continuous multi-agent clusters ($100/mo · ₹9,600)",
  },
  {
    id: "inr_ultra_200",
    name: "Ultra Plan",
    amountUsd: 200,
    amountInr: 19200, // $200 * 96 displayed above
    scanAmountUsd: 201, // $200 + $1 scanned internally
    scanAmountInr: 19296, // 201 * 96 = ₹19,296 charged on scan
    credits: 100000,
    creditsNanos: 100000 * 1_000_000_000,
    description: "Maximum enterprise throughput and dedicated compute allocation ($200/mo · ₹19,200)",
  },
];

export const CRYPTO_TIERS: CryptoTier[] = [
  { id: "crypto_10", name: "Starter", usd: 10, credits: 3000, creditsNanos: 3000 * 1_000_000_000 },
  { id: "crypto_25", name: "Pro Plan", usd: 25, credits: 8500, creditsNanos: 8500 * 1_000_000_000, popular: true },
  { id: "crypto_50", name: "Max Plan", usd: 50, credits: 18000, creditsNanos: 18000 * 1_000_000_000 },
  { id: "crypto_100", name: "Power Plan", usd: 100, credits: 40000, creditsNanos: 40000 * 1_000_000_000 },
  { id: "crypto_200", name: "Ultra Plan", usd: 200, credits: 100000, creditsNanos: 100000 * 1_000_000_000 },
];

export interface CodingPlanTier {
  id: string;
  name: string;
  tokens: number;
  tokensMillions: number;
  amountUsd: number;
  amountInr: number;
  scanAmountUsd: number;
  scanAmountInr: number;
  popular?: boolean;
  badge?: string;
  description: string;
  features: string[];
}

export const CODING_PLAN_TIERS: CodingPlanTier[] = [
  {
    id: "coding_starter_25",
    name: "Coding Starter",
    tokens: 250_000_000,
    tokensMillions: 250,
    amountUsd: 25,
    amountInr: 2400,
    scanAmountUsd: 26,
    scanAmountInr: 2496,
    popular: true,
    badge: "MOST POPULAR",
    description: "250 Million tokens · 10M tokens / $1 · Designed for daily software engineering and agent loops",
    features: [
      "250 Million tokens dedicated quota",
      "Claude Opus 5, Sonnet 4.6 & 3.7",
      "GLM 5.3, Qwen 3.8 Max, DeepSeek V4 Pro",
      "GPT-6 Astra & Kimi K3 Coder",
      "Full tool-use & multi-file coding context",
      "Zero monthly expiry while account active",
    ],
  },
  {
    id: "coding_pro_50",
    name: "Coding Pro",
    tokens: 500_000_000,
    tokensMillions: 500,
    amountUsd: 50,
    amountInr: 4800,
    scanAmountUsd: 51,
    scanAmountInr: 4896,
    popular: false,
    badge: "BEST VALUE",
    description: "500 Million tokens · Heavy engineering, multi-repo indexing, and large contexts",
    features: [
      "500 Million tokens dedicated quota",
      "Priority upstream provider throughput",
      "All coding, reasoning & frontier models",
      "High-concurrency parallel stream dispatch",
      "Sub-10ms edge routing & load balancing",
      "Dedicated pinned provider option",
    ],
  },
  {
    id: "coding_power_100",
    name: "Coding Power",
    tokens: 1_000_000_000,
    tokensMillions: 1000,
    amountUsd: 100,
    amountInr: 9600,
    scanAmountUsd: 101,
    scanAmountInr: 9696,
    popular: false,
    badge: "TEAM SCALE",
    description: "1.0 Billion tokens · High-throughput teams, auto-refactoring, and automated CI pipelines",
    features: [
      "1,000 Million (1 Billion) tokens",
      "Maximum concurrency allocation",
      "Enterprise VIP failover routing",
      "Multi-agent swarm continuous runs",
      "Team-wide API key sharing support",
      "Zero rate limit throttling",
    ],
  },
  {
    id: "coding_ultra_200",
    name: "Coding Ultra",
    tokens: 2_200_000_000,
    tokensMillions: 2200,
    amountUsd: 200,
    amountInr: 19200,
    scanAmountUsd: 201,
    scanAmountInr: 19296,
    popular: false,
    badge: "+200M BONUS",
    description: "2.2 Billion tokens · Includes 200M bonus tokens · Maximum compute capacity for enterprises",
    features: [
      "2.2 Billion tokens (Includes 200M bonus)",
      "Maximum cluster priority & bandwidth",
      "Enterprise SLA & dedicated support",
      "Continuous autonomous agents",
      "Unlimited prompt caching support",
    ],
  },
];

export function getCodingPlanTier(idOrUsd: string | number): CodingPlanTier | undefined {
  if (typeof idOrUsd === "number") {
    return CODING_PLAN_TIERS.find((t) => t.amountUsd === idOrUsd || t.tokensMillions === idOrUsd);
  }
  const clean = String(idOrUsd || "").trim().toLowerCase();
  return CODING_PLAN_TIERS.find(
    (t) =>
      t.id.toLowerCase() === clean ||
      t.name.toLowerCase() === clean ||
      String(t.amountUsd) === clean ||
      String(t.tokensMillions) === clean
  );
}

