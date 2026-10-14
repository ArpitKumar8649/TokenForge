import { useAuth } from "@/_core/hooks/useAuth";
import React, { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { formatCreditWhole } from "@/pages/CreditWorkspace";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { CheckoutModal } from "@/components/CheckoutModal";
import { PaygPaymentModal } from "@/components/PaygPaymentModal";
import { ModelPricingTable } from "@/components/ModelPricingTable";
import { ShaderCanvas } from "@/components/ui/animated-glassy-pricing";
import { toast } from "sonner";
import {
  AlertCircle,
  ArrowRight,
  ArrowUpRight,
  Check,
  CheckCircle2,
  Code2,
  Coins,
  CreditCard,
  Percent,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Terminal,
  Wallet,
  Zap,
} from "lucide-react";
import { CODING_PLAN_TIERS, type CodingPlanTier } from "@shared/paymentTiers";

interface PricingPlan {
  id: string;
  name: string;
  badge?: string;
  popular?: boolean;
  price: string;
  usdEquivalent: number;
  credits: string;
  creditsNum: number;
  description: string;
  features: string[];
}

const DODO_PLANS: PricingPlan[] = [
  {
    id: "starter",
    name: "Starter Pack",
    price: "$10",
    usdEquivalent: 10.0,
    credits: "3,000 Credits",
    creditsNum: 3000,
    description: "Ideal for testing, local scripts, and lightweight prototyping.",
    features: [
      "3,000 Inference Credits",
      "Claude Opus 5 access",
      "Visa, Mastercard, Amex, Apple & Google Pay",
      "Global card checkout with instant settlement",
      "Instant automated ledger credit",
      "Credits never expire",
    ],
  },
  {
    id: "pro",
    name: "Pro Plan",
    badge: "MOST POPULAR",
    popular: true,
    price: "$25",
    usdEquivalent: 25.0,
    credits: "8,500 Credits",
    creditsNum: 8500,
    description: "Best balance for active developers, agents, and daily coding tasks.",
    features: [
      "8,500 Inference Credits",
      "Claude Opus 5 & Sonnet 4.6 included",
      "Visa, Mastercard, Amex, Apple & Google Pay",
      "Priority inference routing & failover",
      "Instant automated ledger credit",
      "Credits never expire",
    ],
  },
  {
    id: "max",
    name: "Max Plan",
    badge: "BEST VALUE",
    price: "$50",
    usdEquivalent: 50.0,
    credits: "18,000 Credits",
    creditsNum: 18000,
    description: "Enterprise scale inference for high-demand clusters and teams.",
    features: [
      "18,000 Inference Credits",
      "GPT-6 Astra & Claude Opus 5 included",
      "Dedicated rate multiplier buffers",
      "Visa, Mastercard, Amex, Apple & Google Pay",
      "High-concurrency parallel stream dispatch",
      "Credits never expire",
    ],
  },
  {
    id: "power",
    name: "Power Plan",
    price: "$100",
    usdEquivalent: 100.0,
    credits: "40,000 Credits",
    creditsNum: 40000,
    description: "Heavy reasoning pipelines and continuous multi-agent clusters.",
    features: [
      "40,000 Inference Credits",
      "High concurrency parallel stream dispatch",
      "GPT-6 Astra, Claude Opus 5 & Grok 4.5",
      "Visa, Mastercard, Amex, Apple & Google Pay",
      "Dedicated rate multiplier buffers",
      "Credits never expire",
    ],
  },
  {
    id: "ultra",
    name: "Ultra Plan",
    price: "$200",
    usdEquivalent: 200.0,
    credits: "100,000 Credits",
    creditsNum: 100000,
    description: "Maximum enterprise throughput, agent swarms & dedicated compute.",
    features: [
      "100,000 Inference Credits",
      "Maximum allocation queue priority",
      "Full TokenForge model routing matrix",
      "Visa, Mastercard, Amex, Apple & Google Pay",
      "Direct developer channel support",
      "Credits never expire",
    ],
  },
];

const UPI_PLANS: PricingPlan[] = [
  {
    id: "upi-starter",
    name: "Starter Pack",
    price: "$10",
    usdEquivalent: 10.0,
    credits: "3,000 Credits",
    creditsNum: 3000,
    description: "Ideal for testing, local scripts, and lightweight prototyping (~₹960).",
    features: [
      "3,000 Inference Credits",
      "Access to 25+ LLMs",
      "Claude Opus 5 access",
      "Domestic UPI QR & VPA scan",
      "Automated UTR verification",
      "Credits never expire",
    ],
  },
  {
    id: "upi-dev",
    name: "Pro Plan",
    badge: "MOST POPULAR",
    popular: true,
    price: "$25",
    usdEquivalent: 25.0,
    credits: "8,500 Credits",
    creditsNum: 8500,
    description: "Best balance for active developers, agents, and daily coding tasks (~₹2,400).",
    features: [
      "8,500 Inference Credits (Best Value)",
      "Claude Opus 5, Grok 4.5 & Sonnet 4.6",
      "Zero gateway deduction (100% credit)",
      "Instant automated ledger credit",
      "Uncapped concurrency limit",
      "Credits never expire",
    ],
  },
  {
    id: "upi-scale",
    name: "Max Plan",
    badge: "BEST VALUE",
    price: "$50",
    usdEquivalent: 50.0,
    credits: "18,000 Credits",
    creditsNum: 18000,
    description: "Enterprise scale inference for high-demand clusters and teams (~₹4,800).",
    features: [
      "18,000 Inference Credits",
      "GPT-6 Astra & Claude Opus 5 included",
      "Dedicated multi-region pool routing",
      "Zero payment processing fees",
      "Instant automated verification",
      "Credits never expire",
    ],
  },
  {
    id: "upi-power",
    name: "Power Plan",
    price: "$100",
    usdEquivalent: 100.0,
    credits: "40,000 Credits",
    creditsNum: 40000,
    description: "Heavy reasoning pipelines and continuous multi-agent clusters (~₹9,600).",
    features: [
      "40,000 Inference Credits",
      "GPT-6 Astra, Opus 5, Grok 4.5",
      "Zero payment processing fees",
      "Instant automated UTR verification",
      "Uncapped concurrency limit",
      "Credits never expire",
    ],
  },
  {
    id: "upi-ultra",
    name: "Ultra Plan",
    price: "$200",
    usdEquivalent: 200.0,
    credits: "100,000 Credits",
    creditsNum: 100000,
    description: "Maximum enterprise throughput and dedicated compute allocation (~₹19,200).",
    features: [
      "100,000 Inference Credits",
      "Maximum allocation queue priority",
      "Full TokenForge model routing matrix",
      "Zero gateway deduction (100% credit)",
      "Dedicated VIP developer support",
      "Credits never expire",
    ],
  },
];

const SOLANA_PLANS: PricingPlan[] = [
  {
    id: "crypto-starter",
    name: "Starter Pack",
    price: "$10",
    usdEquivalent: 10.0,
    credits: "3,000 Credits",
    creditsNum: 3000,
    description: "Entry-tier allocation for prototyping and lightweight testing.",
    features: [
      "3,000 Inference Credits",
      "Direct Solana Pay QR Code settlement",
      "Claude Opus 5 access",
      "Phantom, Solflare & Backpack support",
      "Zero platform markup on base compute",
      "Credits never expire",
    ],
  },
  {
    id: "crypto-pro",
    name: "Pro Plan",
    badge: "MOST POPULAR",
    popular: true,
    price: "$25",
    usdEquivalent: 25.0,
    credits: "8,500 Credits",
    creditsNum: 8500,
    description: "Ideal for active agents, streaming queries, and full pipeline testing.",
    features: [
      "8,500 Inference Credits",
      "Direct Solana Pay QR Code settlement",
      "Claude Opus 5, Grok 4.5 & Sonnet 4.6",
      "Priority inference routing & failover",
      "Zero platform markup on base compute",
      "Credits never expire",
    ],
  },
  {
    id: "crypto-max",
    name: "Max Plan",
    badge: "BEST VALUE",
    price: "$50",
    usdEquivalent: 50.0,
    credits: "18,000 Credits",
    creditsNum: 18000,
    description: "High-volume cluster allocations and multi-agent production runs.",
    features: [
      "18,000 Inference Credits",
      "Direct Solana Pay QR Code settlement",
      "GPT-6 Astra & Claude Opus 5 included",
      "Dedicated rate multiplier buffers",
      "High-concurrency parallel stream dispatch",
      "Credits never expire",
    ],
  },
  {
    id: "crypto-power",
    name: "Power Plan",
    price: "$100",
    usdEquivalent: 100.0,
    credits: "40,000 Credits",
    creditsNum: 40000,
    description: "Heavy reasoning pipelines and continuous agent swarms.",
    features: [
      "40,000 Inference Credits",
      "Direct Solana Pay QR Code settlement",
      "GPT-6 Astra, Claude Opus 5 & Grok 4.5",
      "High-concurrency parallel stream dispatch",
      "Dedicated rate multiplier buffers",
      "Credits never expire",
    ],
  },
  {
    id: "crypto-ultra",
    name: "Ultra Plan",
    price: "$200",
    usdEquivalent: 200.0,
    credits: "100,000 Credits",
    creditsNum: 100000,
    description: "Maximum throughput tier for power users and enterprise agents.",
    features: [
      "100,000 Inference Credits",
      "Maximum allocation queue priority",
      "Full TokenForge model routing matrix",
      "Zero platform markup on base compute",
      "Direct developer channel support",
      "Credits never expire",
    ],
  },
];

const PAYG_PRESETS = [10, 25, 50, 100, 200];

export function DashboardPricingSection() {
  const [pricingTier, setPricingTier] = useState<"payg" | "coding" | "bundles">("payg");
  const [activeRail, setActiveRail] = useState<"card" | "upi" | "crypto">("upi");
  const [codingRail, setCodingRail] = useState<"upi" | "crypto">("upi");
  const [selectedPaygAmount, setSelectedPaygAmount] = useState<number>(25);

  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [isPaygModalOpen, setIsPaygModalOpen] = useState(false);
  const [authAlertOpen, setAuthAlertOpen] = useState(false);

  const [checkoutRail, setCheckoutRail] = useState<"card" | "upi" | "crypto">("upi");
  const [checkoutAmount, setCheckoutAmount] = useState<number>(25);
  const [isCheckoutPayg, setIsCheckoutPayg] = useState(false);
  const [isCheckoutCodingPlan, setIsCheckoutCodingPlan] = useState(false);
  const [selectedCodingTierId, setSelectedCodingTierId] = useState<string | undefined>(undefined);

  const _auth = useAuth();
  const user = _auth.user;
  const wallet = trpc.developer.wallet.useQuery();
  const utils = trpc.useUtils();

  const emailLower = (user?.email ?? "").trim().toLowerCase();
  const isWhitelistedUser = emailLower === "konchoor@gmail.com" || emailLower === "kumaryush18@gmail.com";
  const creditsEnabled = isWhitelistedUser || Boolean((user as any)?.creditsEnabled ?? (wallet.data as any)?.creditsEnabled);

  React.useEffect(() => {
    if (!creditsEnabled && pricingTier === "bundles") {
      setPricingTier("payg");
    }
  }, [creditsEnabled, pricingTier]);

  const bundlePlans =
    activeRail === "card"
      ? DODO_PLANS
      : activeRail === "upi"
      ? UPI_PLANS
      : SOLANA_PLANS;

  const handleSelectPaygMethod = (method: "card" | "upi" | "crypto", amountUsd: number) => {
    setIsPaygModalOpen(false);
    if (!user) {
      setAuthAlertOpen(true);
      return;
    }
    if (method === "card") {
      toast.error("Card payments are temporarily under maintenance. Please use Domestic UPI or Solana Pay.");
      setCheckoutRail("upi");
    } else {
      setCheckoutRail(method);
    }
    setCheckoutAmount(amountUsd);
    setIsCheckoutPayg(true);
    setIsCheckoutCodingPlan(false);
    setSelectedCodingTierId(undefined);
    setIsCheckoutOpen(true);
  };

  const handleBuyBundle = async (plan: PricingPlan) => {
    if (!user) {
      setAuthAlertOpen(true);
      return;
    }
    if (activeRail === "card") {
      toast.error("Card payments are temporarily under maintenance. Please choose Domestic UPI or Solana Pay.");
      setActiveRail("upi");
      return;
    }
    setCheckoutRail(activeRail);
    setCheckoutAmount(plan.usdEquivalent);
    setIsCheckoutPayg(false);
    setIsCheckoutCodingPlan(false);
    setSelectedCodingTierId(undefined);
    setIsCheckoutOpen(true);
  };

  const handleBuyCodingPlan = (tier: CodingPlanTier) => {
    if (!user) {
      setAuthAlertOpen(true);
      return;
    }
    setCheckoutRail(codingRail);
    setCheckoutAmount(tier.amountUsd);
    setSelectedCodingTierId(tier.id);
    setIsCheckoutCodingPlan(true);
    setIsCheckoutPayg(false);
    setIsCheckoutOpen(true);
  };

  const handleCheckoutSuccess = () => {
    utils.developer.wallet.invalidate();
    if (isCheckoutCodingPlan) {
      toast.success("Payment verified! Your Coding Plan tokens have been credited.");
    } else if (isCheckoutPayg) {
      toast.success(`Payment verified! $${checkoutAmount}.00 USD deposited into your PAYG balance.`);
    } else {
      toast.success("Payment verified! Your TokenForge credits have been added.");
    }
  };

  const paygBalanceNanos = (wallet.data as any)?.paygBalanceNanos ?? 0;
  const bundleBalanceNanos = wallet.data?.balanceNanos ?? 0;
  const codingPlanTokens = Number((wallet.data as any)?.codingPlanTokens ?? 0);

  return (
    <div className="relative min-w-0 rounded-3xl border border-white/10 bg-[#09090b]/80 backdrop-blur-3xl overflow-hidden p-4 sm:p-7 md:p-8 shadow-2xl">
      {/* Dynamic Animated Glassy Shader Background */}
      <ShaderCanvas className="absolute inset-0 w-full h-full block z-0 pointer-events-none opacity-40" />

      {/* Layered Glass Ambient Orbs */}
      <div className="absolute -top-32 -left-32 w-96 h-96 bg-rose-500/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-1/3 -right-32 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 left-1/3 w-96 h-96 bg-[#befe6c]/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10 space-y-8">
        {/* Top Header & Balances Status Bar */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5 border-b border-white/10 pb-6">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#befe6c]">
              <Sparkles size={14} />
              <span>Pricing & Wallet Top-Up</span>
            </div>
            <h1 className="mt-2 text-2xl sm:text-3xl font-bold tracking-tight text-white">
              TokenForge Model Pricing & Plans
            </h1>
            <p className="mt-1 max-w-2xl text-xs sm:text-sm text-neutral-400">
              Choose between Tier 1 Pay-As-You-Go with +100% recharge bonus, Tier 2 Dedicated Coding Token Plans (10M / $1), or Tier 3 fixed credit bundles.
            </p>
          </div>

          {/* Triple Balances Pill Box */}
          <div className="flex flex-wrap items-center gap-3">
            {/* PAYG Balance Pill */}
            <div className="flex items-center gap-3 bg-gradient-to-br from-rose-950/40 via-white/[0.05] to-black/40 border border-rose-500/30 rounded-2xl p-3 px-4 shadow-lg backdrop-blur-xl shrink-0">
              <div className="w-10 h-10 rounded-xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400">
                <Percent size={18} />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-rose-300">
                    PAYG Balance
                  </span>
                  <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-500/15 text-emerald-400 font-semibold border border-emerald-500/20">
                    +100% BONUS
                  </span>
                </div>
                <span className="text-lg sm:text-xl font-bold font-mono text-white">
                  {formatCreditWhole(paygBalanceNanos)}
                </span>
              </div>
            </div>

            {/* Coding Tokens Pill */}
            <div className="flex items-center gap-3 bg-gradient-to-br from-cyan-950/40 via-white/[0.05] to-black/40 border border-cyan-500/30 rounded-2xl p-3 px-4 shadow-lg backdrop-blur-xl shrink-0">
              <div className="w-10 h-10 rounded-xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                <Code2 size={18} />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-cyan-300">
                    Coding Tokens
                  </span>
                  <span className="text-[9px] px-1.5 py-0.2 rounded bg-cyan-500/15 text-cyan-300 font-semibold border border-cyan-500/20">
                    10M / $1
                  </span>
                </div>
                <span className="text-lg sm:text-xl font-bold font-mono text-white">
                  {codingPlanTokens >= 1_000_000
                    ? `${(codingPlanTokens / 1_000_000).toLocaleString(undefined, { maximumFractionDigits: 1 })}M`
                    : codingPlanTokens.toLocaleString()}
                </span>
              </div>
            </div>

            {/* Bundle Credits Pill - Only shown when credit bundles enabled */}
            {creditsEnabled && (
              <div className="flex items-center gap-3 bg-white/[0.04] border border-white/10 rounded-2xl p-3 px-4 shadow-lg backdrop-blur-xl shrink-0">
                <div className="w-10 h-10 rounded-xl bg-[#befe6c]/10 border border-[#befe6c]/20 flex items-center justify-center text-[#befe6c]">
                  <Wallet size={18} />
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold tracking-wider text-neutral-400 block">
                    Credits Wallet
                  </span>
                  <span className="text-lg sm:text-xl font-bold font-mono text-white">
                    {formatCreditWhole(bundleBalanceNanos)}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

      {/* Multi-Tier Pricing System Switcher */}
      <div className="flex justify-center">
        <div className="p-1.5 rounded-2xl bg-white/[0.04] border border-white/10 backdrop-blur-xl inline-flex items-center gap-1.5 shadow-2xl flex-wrap justify-center">
          <button
            type="button"
            onClick={() => setPricingTier("payg")}
            className={`relative flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
              pricingTier === "payg"
                ? "bg-gradient-to-r from-rose-500/20 via-pink-500/20 to-rose-500/10 text-white border border-rose-500/40 shadow-lg shadow-rose-500/10 font-bold"
                : "text-neutral-400 hover:text-white hover:bg-white/[0.04] border border-transparent"
            }`}
          >
            <Zap
              size={16}
              className={pricingTier === "payg" ? "text-rose-400 animate-pulse" : "text-neutral-400"}
            />
            <span>Tier 1: Pay-As-You-Go</span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30 font-mono">
              +100% Bonus (2x)
            </span>
          </button>

          <button
            type="button"
            onClick={() => setPricingTier("coding")}
            className={`relative flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
              pricingTier === "coding"
                ? "bg-gradient-to-r from-cyan-500/20 via-teal-500/20 to-cyan-500/10 text-cyan-200 border border-cyan-500/40 shadow-lg shadow-cyan-500/10 font-bold"
                : "text-neutral-400 hover:text-white hover:bg-white/[0.04] border border-transparent"
            }`}
          >
            <Code2
              size={16}
              className={pricingTier === "coding" ? "text-cyan-400 animate-pulse" : "text-neutral-400"}
            />
            <span>Tier 2: Coding Token Plans</span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 font-mono">
              10M / $1
            </span>
          </button>

          {creditsEnabled && (
            <button
              type="button"
              onClick={() => setPricingTier("bundles")}
              className={`relative flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
                pricingTier === "bundles"
                  ? "bg-white/10 text-white border border-white/20 shadow-lg"
                  : "text-neutral-400 hover:text-white hover:bg-white/[0.04] border border-transparent"
              }`}
            >
              <Coins
                size={16}
                className={pricingTier === "bundles" ? "text-amber-300" : "text-neutral-400"}
              />
              <span>Tier 3: Credit Bundles</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-white/10 text-neutral-300 border border-white/10">
                Fixed Packages
              </span>
            </button>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* TIER 1: PAY-AS-YOU-GO VIEW (50% Flat Discount Active)                     */}
      {/* ========================================================================= */}
      {pricingTier === "payg" && (
        <div className="space-y-8 animate-in fade-in-50 duration-200">
          {/* PAYG Section Intro */}
          <div className="text-center max-w-2xl mx-auto">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider bg-rose-500/10 text-rose-300 border border-rose-500/20 mb-3">
              <Sparkles size={13} className="text-rose-400" />
              <span>+100% Bonus Credit on Every Deposit · 2x Balance</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extralight text-white font-display">
              Pay As You Go with <span className="text-rose-400 font-normal">100% Bonus Credit</span>
            </h2>
            <p className="mt-2 text-xs sm:text-sm text-neutral-300 leading-relaxed">
              Deposit any amount and receive an instant 100% bonus credit grant (2x purchasing balance). Model token consumption automatically deducts at transparent official provider rates.
            </p>
          </div>

          {/* Dedicated Glassy Pay-As-You-Go Plan Card (Exact Landing Page Design) */}
          <div className="w-full max-w-2xl mx-auto">
            <div className="relative backdrop-blur-[20px] bg-gradient-to-br from-white/10 via-black/50 to-black/40 border-2 border-rose-500/40 rounded-3xl p-6 sm:p-8 shadow-2xl shadow-rose-950/40 overflow-hidden">
              {/* Ambient Glow */}
              <div className="absolute top-0 right-0 -mt-8 -mr-8 w-48 h-48 bg-rose-500/20 rounded-full blur-3xl pointer-events-none" />

              {/* Top Badges */}
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-rose-500 text-white shadow-lg shadow-rose-500/30">
                  <Sparkles className="w-3.5 h-3.5" />
                  +100% Bonus Credit (2x Grant)
                </div>
                <span className="text-xs font-mono text-emerald-400 font-semibold flex items-center gap-1">
                  <Percent className="w-3.5 h-3.5" />
                  Official Provider Rates
                </span>
              </div>

              {/* Card Title & Description */}
              <div className="mb-5">
                <span className="text-xs uppercase tracking-widest text-neutral-400 font-semibold block">
                  Tier 1 • Developer On-Demand
                </span>
                <h3 className="text-2xl sm:text-3xl font-extralight text-white font-display mt-1">
                  Pay-As-You-Go Plan
                </h3>
                <p className="text-xs sm:text-sm text-neutral-300 mt-2 leading-relaxed">
                  Fund your balance on demand. Every deposit receives an unconditional 100% bonus credit grant (deposit $50 → get $100 balance) while models are charged at transparent official rates.
                </p>
              </div>

              {/* Deposit Amount Selector Pills */}
              <div className="mb-5">
                <label className="text-xs font-semibold uppercase text-neutral-400 tracking-wider mb-2.5 block">
                  Select Deposit Amount
                </label>
                <div className="grid grid-cols-5 gap-2">
                  {PAYG_PRESETS.map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => setSelectedPaygAmount(amt)}
                      className={`relative py-3 px-2 rounded-xl text-center border text-xs font-bold transition-all cursor-pointer ${
                        selectedPaygAmount === amt
                          ? "bg-gradient-to-b from-rose-500/20 to-rose-950/40 border-rose-500 text-white shadow-[0_0_20px_rgba(244,63,94,0.2)] ring-1 ring-rose-500/40"
                          : "bg-black/40 border-white/[0.08] text-neutral-400 hover:border-white/20 hover:text-white"
                      }`}
                    >
                      {amt === 25 && (
                        <span className="absolute -top-2 left-1/2 -translate-x-1/2 text-[8px] bg-gradient-to-r from-rose-500 to-pink-500 text-white font-mono px-1.5 py-0.2 rounded-full whitespace-nowrap font-bold shadow-sm">
                          POPULAR
                        </span>
                      )}
                      <div className="text-base font-bold text-white font-mono">${amt}</div>
                      <div className="text-[10px] text-rose-300/90 font-medium">Get ${amt * 2}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Rate Display Callout */}
              <div className="p-4 rounded-2xl bg-black/50 border border-white/10 mb-6 flex items-center justify-between flex-wrap gap-3">
                <div>
                  <span className="text-xs text-neutral-400 block uppercase font-medium">
                    Recharge Bonus
                  </span>
                  <div className="flex items-baseline gap-2 mt-0.5">
                    <span className="text-3xl font-extralight text-rose-400 font-display">
                      +100% BONUS
                    </span>
                    <span className="text-xs text-neutral-400 font-sans">2x Usable Balance</span>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-xs text-neutral-400 block uppercase font-medium">
                    Model Rates
                  </span>
                  <span className="text-2xl font-light text-emerald-400 font-display">Official Rates</span>
                  <span className="text-xs text-neutral-400 block">Zero platform markup</span>
                </div>
              </div>

              {/* Feature Checklist */}
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6 text-xs text-neutral-200">
                <li className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <span>Instant 100% bonus credit grant on every recharge (2x balance)</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <span>Pay strictly for consumed input & output tokens at official rates</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <span>Deposited balance never expires; top up anytime</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <span>Unthrottled tokens/sec with automated failover</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <span>Dedicated PAYG API keys route strictly to PAYG-tagged models</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <span>Instant support for Solana, Domestic UPI, and Global Cards</span>
                </li>
              </ul>

              {/* Proceed Button */}
              <button
                type="button"
                onClick={() => setIsPaygModalOpen(true)}
                className="w-full py-4 rounded-xl font-bold text-sm bg-gradient-to-r from-rose-500 via-rose-600 to-pink-500 hover:from-rose-400 hover:to-pink-400 text-white shadow-xl shadow-rose-500/25 transition-all flex items-center justify-center gap-2 cursor-pointer group active:scale-[0.99]"
              >
                <span>Proceed to Add Balance (Deposit ${selectedPaygAmount} → Get ${selectedPaygAmount * 2} Credit)</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </button>
              <p className="text-[11px] text-center text-neutral-400 mt-2.5">
                Choose between Solana Pay ($), Domestic UPI (₹), or Card Payment ($) in the next step.
              </p>
            </div>
          </div>

          {/* Model Pricing Comparison Table (Dynamically fetches official pricing from admin and displays official rates) */}
          <div className="pt-4">
            <ModelPricingTable onOpenTopUpModal={() => setIsPaygModalOpen(true)} />
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TIER 2: DEDICATED CODING TOKEN PLANS VIEW                                 */}
      {/* ========================================================================= */}
      {pricingTier === "coding" && (
        <div className="space-y-6 animate-in fade-in-50 duration-200">
          {/* Rail Selector Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Code2 size={18} className="text-cyan-400" />
                <span>Dedicated Coding Token Plans</span>
              </h2>
              <p className="text-xs text-neutral-400">
                10 Million tokens per $1 USD · Dedicated quotas for Claude Opus 5, Sonnet 4.6 & GLM 5.3.
              </p>
            </div>

            {/* Tri-Rail Switcher */}
            <div className="inline-flex flex-wrap p-1 rounded-2xl bg-[#121215] border border-white/10 gap-1">
              <button
                type="button"
                onClick={() => setCodingRail("upi")}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  codingRail === "upi"
                    ? "bg-cyan-500 text-black shadow-md font-bold"
                    : "text-neutral-400 hover:text-white"
                }`}
              >
                <Smartphone size={15} />
                <span>Domestic UPI (₹ INR)</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-black/20 text-emerald-950 font-bold">
                  Zero Fees
                </span>
              </button>

              <button
                type="button"
                onClick={() => setCodingRail("crypto")}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  codingRail === "crypto"
                    ? "bg-cyan-500 text-black shadow-md font-bold"
                    : "text-neutral-400 hover:text-white"
                }`}
              >
                <Wallet size={15} />
                <span>Solana Pay (Crypto)</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-black/20 text-purple-950 font-bold">
                  Instant
                </span>
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs text-neutral-400">
            <Sparkles size={16} className="text-cyan-400" />
            <span>Dedicated token capacity • Uncapped tokens/sec • Purchased tokens never expire</span>
          </div>

          {/* Pricing Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-5">
            {CODING_PLAN_TIERS.map((plan) => (
              <div
                key={plan.id}
                className={`relative rounded-3xl p-6 flex flex-col justify-between transition-all duration-300 border backdrop-blur-2xl ${
                  plan.popular
                    ? "bg-gradient-to-b from-cyan-950/40 via-white/[0.04] to-black/60 border-cyan-400/50 shadow-2xl shadow-cyan-950/40 ring-1 ring-cyan-400/30 hover:border-cyan-300"
                    : "bg-gradient-to-b from-white/[0.07] to-white/[0.02] border-white/10 hover:border-white/20 shadow-xl"
                }`}
              >
                {/* Optional Badge */}
                {plan.badge && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-gradient-to-r from-cyan-400 to-teal-400 text-black shadow-md">
                      {plan.badge}
                    </span>
                  </div>
                )}

                <div>
                  {/* Header */}
                  <div>
                    <h3 className="text-lg font-bold text-white">{plan.name}</h3>
                    <p className="mt-1 text-xs text-neutral-400 min-h-[36px] leading-relaxed">
                      {plan.description}
                    </p>
                  </div>

                  {/* Price & Credit Value */}
                  <div className="mt-4 pt-4 border-t border-white/10">
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-3xl font-extrabold tracking-tight text-white font-mono">
                        ${plan.amountUsd}
                      </span>
                      <span className="text-xs text-neutral-500 font-sans">
                        / ₹{plan.amountInr.toLocaleString()} INR
                      </span>
                    </div>
                    <div className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-cyan-500/10 text-cyan-300 text-xs font-semibold border border-cyan-500/20">
                      <Sparkles size={13} className="text-cyan-400" />
                      <span>{plan.tokensMillions}M Tokens</span>
                    </div>
                  </div>

                  {/* Feature Checklist */}
                  <ul className="mt-5 space-y-2.5 text-xs text-neutral-300">
                    {plan.features.map((feat, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <Check size={14} className="text-cyan-400 shrink-0 mt-0.5" />
                        <span className="leading-snug">{feat}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Buy Button */}
                <div className="mt-6 pt-4 border-t border-white/10">
                  <button
                    type="button"
                    onClick={() => handleBuyCodingPlan(plan)}
                    className={`w-full py-3 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer ${
                      plan.popular
                        ? "bg-gradient-to-r from-cyan-400 to-teal-400 hover:from-cyan-300 hover:to-teal-300 text-black shadow-lg shadow-cyan-500/25"
                        : "bg-white/10 hover:bg-white/15 text-white border border-white/10"
                    }`}
                  >
                    {codingRail === "upi" ? (
                      <Smartphone size={14} />
                    ) : (
                      <Wallet size={14} />
                    )}
                    <span>
                      {codingRail === "upi"
                        ? `Get ${plan.tokensMillions}M Tokens (₹${plan.amountInr.toLocaleString()})`
                        : `Pay $${plan.amountUsd} with Solana`}
                    </span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TIER 3: PREPAID CREDIT BUNDLES VIEW                                       */}
      {/* ========================================================================= */}
      {pricingTier === "bundles" && (
        <div className="space-y-6 animate-in fade-in-50 duration-200">
          {/* Rail Selector Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-white">Select Payment Rail</h2>
              <p className="text-xs text-neutral-400">
                Choose your preferred payment method for prepaid credit bundles.
              </p>
            </div>

            {/* Tri-Rail Switcher */}
            <div className="inline-flex flex-wrap p-1 rounded-2xl bg-[#121215] border border-white/10 gap-1">
              <button
                type="button"
                onClick={() => setActiveRail("card")}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activeRail === "card"
                    ? "bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-md"
                    : "text-neutral-400 hover:text-white"
                }`}
              >
                <CreditCard size={15} className={activeRail === "card" ? "text-amber-400" : "text-neutral-400"} />
                <span>Card Payment</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  Maintenance
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveRail("upi")}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activeRail === "upi"
                    ? "bg-[#09090b] text-white shadow-md border border-white/15"
                    : "text-neutral-400 hover:text-white"
                }`}
              >
                <Smartphone size={15} className={activeRail === "upi" ? "text-emerald-400" : ""} />
                <span>Domestic UPI (₹ INR)</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                  Active · Zero Fees
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveRail("crypto")}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activeRail === "crypto"
                    ? "bg-[#09090b] text-white shadow-md border border-white/15"
                    : "text-neutral-400 hover:text-white"
                }`}
              >
                <Wallet size={15} className={activeRail === "crypto" ? "text-rose-400" : ""} />
                <span>Solana Pay (Crypto)</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/15 text-purple-400 border border-purple-500/30">
                  Active · On-Chain
                </span>
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs text-neutral-400">
            <ShieldCheck size={16} className="text-[#befe6c]" />
            <span>Prepaid inference packages • Dual-rail settlement • Credits never expire</span>
          </div>

          {activeRail === "card" && (
            <div className="p-4 rounded-2xl bg-amber-950/30 border border-amber-500/40 text-amber-200 text-xs flex items-center justify-between gap-4">
              <div className="flex items-center gap-2 font-medium">
                <AlertCircle size={16} className="text-amber-400 shrink-0" />
                <span>Card payments are temporarily under maintenance. Please select Domestic UPI or Solana Pay to recharge.</span>
              </div>
              <button
                type="button"
                onClick={() => setActiveRail("upi")}
                className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs whitespace-nowrap cursor-pointer transition-colors"
              >
                Switch to UPI
              </button>
            </div>
          )}

          {/* Pricing Cards Grid (Matching Glassy Landing Page Design) */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-5">
            {bundlePlans.map((plan) => (
              <div
                key={plan.id}
                className={`relative rounded-3xl p-6 flex flex-col justify-between transition-all duration-300 border backdrop-blur-2xl ${
                  plan.popular && activeRail !== "card"
                    ? "bg-gradient-to-b from-rose-500/[0.12] via-white/[0.05] to-white/[0.02] border-rose-500/50 shadow-2xl shadow-rose-950/40 ring-1 ring-rose-500/30 hover:border-rose-400 hover:shadow-rose-900/30"
                    : "bg-gradient-to-b from-white/[0.07] to-white/[0.02] border-white/10 hover:border-white/20 shadow-xl hover:shadow-[0_8px_32px_0_rgba(255,255,255,0.06)]"
                }`}
              >
                {/* Optional Badge */}
                {plan.badge && activeRail !== "card" && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-gradient-to-r from-rose-500 to-pink-500 text-white shadow-md">
                      {plan.badge}
                    </span>
                  </div>
                )}

                <div>
                  {/* Header */}
                  <div>
                    <h3 className="text-lg font-bold text-white">{plan.name}</h3>
                    <p className="mt-1 text-xs text-neutral-400 min-h-[36px] leading-relaxed">
                      {plan.description}
                    </p>
                  </div>

                  {/* Price & Credit Value */}
                  <div className="mt-4 pt-4 border-t border-white/10">
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-3xl font-extrabold tracking-tight text-white font-mono">
                        {plan.price}
                      </span>
                      <span className="text-xs text-neutral-500 font-sans">
                        {activeRail === "card"
                          ? "/ one-time"
                          : activeRail === "upi"
                          ? "/ one-time (INR)"
                          : "/ one-time (SOL)"}
                      </span>
                    </div>
                    <div className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-rose-500/10 text-rose-300 text-xs font-semibold border border-rose-500/20">
                      <Zap size={13} className="text-rose-400" />
                      <span>{plan.credits}</span>
                    </div>
                  </div>

                  {/* Feature Checklist */}
                  <ul className="mt-5 space-y-2.5 text-xs text-neutral-300">
                    {plan.features.map((feat, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <Check size={14} className="text-rose-400 shrink-0 mt-0.5" />
                        <span className="leading-snug">{feat}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Buy Button */}
                <div className="mt-6 pt-4 border-t border-white/10">
                  <button
                    type="button"
                    onClick={() => handleBuyBundle(plan)}
                    disabled={activeRail === "card"}
                    className={`w-full py-3 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-2 ${
                      activeRail === "card"
                        ? "bg-neutral-800 text-neutral-400 border border-white/5 cursor-not-allowed opacity-75"
                        : plan.popular
                        ? "bg-rose-500 hover:bg-rose-600 text-white shadow-lg shadow-rose-500/25 cursor-pointer"
                        : "bg-white/10 hover:bg-white/15 text-white border border-white/10 cursor-pointer"
                    }`}
                  >
                    {activeRail === "card" ? (
                      <AlertCircle size={14} className="text-amber-400" />
                    ) : activeRail === "upi" ? (
                      <Smartphone size={14} />
                    ) : (
                      <Wallet size={14} />
                    )}
                    <span>
                      {activeRail === "card"
                        ? "Under Maintenance"
                        : activeRail === "upi"
                        ? `Buy with UPI (${plan.price})`
                        : `Buy with Solana (${plan.price})`}
                    </span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Authentication Required Dialog */}
      <AlertDialog open={authAlertOpen} onOpenChange={setAuthAlertOpen}>
        <AlertDialogContent className="bg-[#09090b] border-white/10 text-white">
          <AlertDialogHeader>
            <AlertDialogTitle>Authentication Required</AlertDialogTitle>
            <AlertDialogDescription className="text-neutral-400">
              Please sign in to your account first to proceed with the payment.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-transparent border-white/10 hover:bg-white/5 text-white cursor-pointer">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => (window.location.href = "/signin")}
              className="bg-rose-500 text-white hover:bg-rose-600 cursor-pointer"
            >
              Sign In
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* PAYG Payment Rail Selection Modal (Solana, UPI, Card) */}
      <PaygPaymentModal
        isOpen={isPaygModalOpen}
        onClose={() => setIsPaygModalOpen(false)}
        onSelectPaymentMethod={handleSelectPaygMethod}
        initialAmountUsd={selectedPaygAmount}
      />

        {/* Direct Settlement Checkout Modal (Handles Card, UPI, and Solana with isPayg and isCodingPlan awareness) */}
        <CheckoutModal
          isOpen={isCheckoutOpen}
          onClose={() => {
            setIsCheckoutOpen(false);
            setIsCheckoutCodingPlan(false);
            setSelectedCodingTierId(undefined);
          }}
          initialRail={checkoutRail}
          initialPackageUsd={checkoutAmount}
          isPayg={isCheckoutPayg}
          isCodingPlan={isCheckoutCodingPlan}
          codingPlanTierId={selectedCodingTierId}
          codingTokens={CODING_PLAN_TIERS.find((t) => t.id === selectedCodingTierId)?.tokens}
          userId={user?.id}
          onSuccess={handleCheckoutSuccess}
        />
      </div>
    </div>
  );
}

export default DashboardPricingSection;
