import React, { useState } from "react";
import { Link } from "wouter";
import {
  AlertTriangle,
  Zap,
  ArrowRight,
  CreditCard,
  Smartphone,
  Coins,
  X,
  ShieldAlert,
  Sparkles,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { CheckoutModal } from "@/components/CheckoutModal";
import { trpc } from "@/lib/trpc";
import { formatCreditWhole, useIsCreditsEnabled } from "@/pages/CreditWorkspace";

export interface LowBalanceWarningProps {
  /**
   * Threshold in integer credits below which warning triggers.
   * Defaults to 500 credits ($0.50).
   */
  thresholdCredits?: number;
  /**
   * Allow user to temporarily dismiss the banner in the current session.
   * Defaults to true.
   */
  dismissible?: boolean;
  /**
   * Optional custom class names
   */
  className?: string;
  /**
   * Variant design: "banner" (top sticky/prominent bar) or "card" (embedded dashboard block)
   */
  variant?: "banner" | "card";
  /**
   * Force show for demonstration or testing purposes regardless of actual balance
   */
  forceShow?: boolean;
}

const NANO_DOLLARS = 1_000_000_000;
const SESSION_DISMISS_KEY = "tokenforge_low_balance_dismissed_at";

export function LowBalanceWarning({
  thresholdCredits = 500,
  dismissible = true,
  className = "",
  variant = "card",
  forceShow = false,
}: LowBalanceWarningProps) {
  const wallet = trpc.developer.wallet.useQuery(undefined, {
    staleTime: 10_000,
    refetchOnWindowFocus: true,
  });
  const utils = trpc.useUtils();

  // Check URL query param ?preview_low_balance=true or ?low_balance=preview
  const isUrlPreview = typeof window !== "undefined" && (
    new URLSearchParams(window.location.search).get("preview_low_balance") === "true" ||
    new URLSearchParams(window.location.search).get("low_balance") === "preview"
  );
  const isPreview = forceShow || isUrlPreview;

  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [selectedRail, setSelectedRail] = useState<"card" | "upi" | "crypto">("upi");
  const [isDismissed, setIsDismissed] = useState(() => {
    if (isPreview) return false;
    if (!dismissible) return false;
    try {
      const dismissedTime = sessionStorage.getItem(SESSION_DISMISS_KEY);
      if (dismissedTime) {
        // Auto-re-display if dismissed more than 30 minutes ago
        const elapsed = Date.now() - parseInt(dismissedTime, 10);
        return elapsed < 30 * 60 * 1000;
      }
    } catch {
      // Ignore sessionStorage access errors
    }
    return false;
  });

  const creditsEnabled = useIsCreditsEnabled(wallet.data?.creditsEnabled);

  if ((!creditsEnabled && !isPreview) || wallet.isLoading || !wallet.data || (isDismissed && !isPreview)) {
    return null;
  }

  const rawNanos = isPreview ? 240_000_000 : Number(wallet.data.balanceNanos ?? 0); // In preview mode, simulate 240 credits ($0.24)
  // 1 credit = 1,000,000 Nanos ($0.001) -> 500 credits = $0.50
  const actualCreditCount = Math.floor(rawNanos / 1_000_000);

  // If balance is at or above threshold and not previewing, do not render
  if (actualCreditCount >= thresholdCredits && !isPreview) {
    return null;
  }

  const handleDismiss = () => {
    setIsDismissed(true);
    try {
      sessionStorage.setItem(SESSION_DISMISS_KEY, Date.now().toString());
    } catch {
      // Ignore
    }
  };

  const openTopup = (rail: "card" | "upi" | "crypto" = "upi") => {
    setSelectedRail(rail);
    setCheckoutOpen(true);
  };

  const percentageRemaining = Math.max(
    0,
    Math.min(100, Math.round((actualCreditCount / thresholdCredits) * 100))
  );

  const formattedBalanceUsd = formatCreditWhole(rawNanos);
  const isCritical = actualCreditCount <= 100;

  // Banner variant: compact, highly polished strip
  if (variant === "banner") {
    return (
      <>
        <div
          id="low-balance-banner"
          role="alert"
          aria-live="polite"
          className={`relative overflow-hidden rounded-2xl border transition-all ${
            isCritical
              ? "border-rose-500/35 bg-gradient-to-r from-rose-950/40 via-red-950/25 to-[#0e0e11] text-rose-100 shadow-lg shadow-rose-950/20"
              : "border-amber-500/30 bg-gradient-to-r from-amber-950/35 via-orange-950/20 to-[#0e0e11] text-amber-100 shadow-lg shadow-amber-950/20"
          } p-3.5 sm:p-4 mb-5 ${className}`}
        >
          {/* Subtle ambient light accents */}
          <div
            className={`pointer-events-none absolute -top-10 -left-10 h-32 w-32 rounded-full blur-2xl ${
              isCritical ? "bg-rose-500/15" : "bg-amber-500/15"
            }`}
            aria-hidden="true"
          />

          <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <div
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border ${
                  isCritical
                    ? "border-rose-500/40 bg-rose-500/15 text-rose-300"
                    : "border-amber-500/40 bg-amber-500/15 text-amber-300"
                }`}
              >
                <AlertTriangle size={18} className="animate-pulse" />
              </div>

              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span
                    className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                      isCritical
                        ? "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                        : "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                    }`}
                  >
                    {isCritical ? "Critical Balance" : "Low Credit Balance"}
                  </span>
                  <span className="font-mono text-xs font-semibold text-white">
                    {actualCreditCount.toLocaleString()} credits ({formattedBalanceUsd}) left
                  </span>
                </div>
                <p className="text-xs text-white/75 mt-0.5 truncate">
                  Inference requests may be paused soon once credits hit zero.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
              <button
                type="button"
                id="low-balance-topup-btn"
                onClick={() => openTopup("upi")}
                className="group relative h-9 px-4 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#c9ff73] to-[#aee956] text-[#12190d] text-xs font-bold shadow-[0_0_18px_rgba(201,255,115,0.3)] hover:shadow-[0_0_26px_rgba(201,255,115,0.5)] transition-all active:scale-95 overflow-hidden cursor-pointer"
              >
                <span
                  className="pointer-events-none absolute inset-0 w-1/2 -translate-x-full group-hover:translate-x-[250%] transition-transform duration-700 bg-gradient-to-r from-transparent via-white/40 to-transparent"
                  aria-hidden="true"
                />
                <Zap size={13} className="fill-[#12190d] text-[#12190d] group-hover:rotate-12 transition-transform" />
                <span>Top Up with UPI</span>
              </button>

              {dismissible && (
                <button
                  onClick={handleDismiss}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-white/50 hover:bg-white/10 hover:text-white transition-colors"
                  aria-label="Dismiss low credit warning for this session"
                >
                  <X size={15} />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Top Up Checkout Modal */}
        <CheckoutModal
          isOpen={checkoutOpen}
          onClose={() => setCheckoutOpen(false)}
          initialRail={selectedRail}
          initialPackageUsd={25}
          userId={wallet.data.userId}
          onSuccess={() => {
            utils.developer.wallet.invalidate();
            setCheckoutOpen(false);
          }}
        />
      </>
    );
  }

  // Card variant: deeply crafted, architectural, fits cleanly into overview layout
  return (
    <>
      <section
        id="low-balance-card-warning"
        aria-labelledby="low-balance-card-title"
        className={`relative overflow-hidden rounded-2xl border transition-all mb-6 ${
          isCritical
            ? "border-rose-500/30 bg-gradient-to-br from-rose-950/30 via-[#120f12] to-[#0c0d10]"
            : "border-amber-500/25 bg-gradient-to-br from-amber-950/25 via-[#14110e] to-[#0c0d10]"
        } p-4 sm:p-6 shadow-xl ${className}`}
      >
        {/* Background ambient lighting */}
        <div
          className={`pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full blur-3xl ${
            isCritical ? "bg-rose-500/10" : "bg-amber-500/10"
          }`}
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute -left-10 bottom-0 h-32 w-32 rounded-full bg-[#c9ff73]/5 blur-2xl"
          aria-hidden="true"
        />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          {/* Left Column: Icon & Descriptive Messaging */}
          <div className="flex items-start gap-4 min-w-0 max-w-2xl">
            <div
              className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border ${
                isCritical
                  ? "border-rose-500/40 bg-gradient-to-b from-rose-500/20 to-rose-950/40 text-rose-300 shadow-md shadow-rose-950/50"
                  : "border-amber-500/35 bg-gradient-to-b from-amber-500/20 to-amber-950/40 text-amber-300 shadow-md shadow-amber-950/50"
              }`}
            >
              <AlertTriangle size={22} className={isCritical ? "animate-pulse" : ""} />
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2.5 flex-wrap">
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                    isCritical
                      ? "border border-rose-500/35 bg-rose-500/15 text-rose-300"
                      : "border border-amber-500/35 bg-amber-500/15 text-amber-300"
                  }`}
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      isCritical ? "bg-rose-400 animate-ping" : "bg-amber-400"
                    }`}
                  />
                  {isCritical ? "Action Required" : "Low Balance Alert"}
                </span>

                <span className="text-xs text-white/50">•</span>

                <span className="text-xs font-mono font-medium text-[#c9ff73]">
                  Threshold: {thresholdCredits.toLocaleString()} credits
                </span>

                {isPreview && (
                  <span className="rounded-full bg-purple-500/20 border border-purple-500/40 px-2 py-0.5 text-[9px] font-bold tracking-wider text-purple-300 flex items-center gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-purple-400 animate-pulse" />
                    SIMULATION DEMO (SAMPLE 240 CREDITS)
                  </span>
                )}
              </div>

              {isPreview && (
                <div className="mt-2 text-xs bg-purple-950/40 border border-purple-500/30 rounded-lg px-3 py-1.5 text-purple-200">
                  <span className="font-semibold text-purple-100">Why 240 credits?</span> This is a mock simulation showing how the alert looks when a user is low on balance. Your actual account has{" "}
                  <span className="font-bold text-[#c9ff73]">
                    {formatCreditWhole(Number(wallet.data.balanceNanos ?? 0))}
                  </span>.
                </div>
              )}

              <h3
                id="low-balance-card-title"
                className="mt-2 text-lg sm:text-xl font-bold tracking-tight text-white"
              >
                Your available balance is down to{" "}
                <span className="font-mono text-[#fff3cf]">
                  {actualCreditCount.toLocaleString()} credits
                </span>{" "}
                <span className="text-sm font-normal text-white/60">({formattedBalanceUsd})</span>
              </h3>

              <p className="mt-1 text-xs sm:text-sm leading-relaxed text-white/70">
                Live model inference will automatically pause when your credits reach 0. Top up with
                instant settlement via Domestic UPI or Solana Pay to keep your API keys active.
              </p>

              {/* Progress gauge towards zero */}
              <div className="mt-3.5 max-w-md">
                <div className="flex items-center justify-between text-[11px] font-mono mb-1.5">
                  <span className="text-white/60">Credit level</span>
                  <span className={isCritical ? "text-rose-400 font-bold" : "text-amber-400 font-bold"}>
                    {actualCreditCount} / {thresholdCredits} ({percentageRemaining}%)
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-black/50 border border-white/10 p-0.5">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      isCritical
                        ? "bg-gradient-to-r from-rose-600 to-rose-400 shadow-[0_0_10px_rgba(244,63,94,0.6)]"
                        : "bg-gradient-to-r from-amber-600 to-amber-400 shadow-[0_0_10px_rgba(245,158,11,0.5)]"
                    }`}
                    style={{ width: `${Math.max(4, percentageRemaining)}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Quick Top Up Rails & Direct Action */}
          <div className="flex flex-col sm:flex-row lg:flex-col items-stretch sm:items-center lg:items-end gap-2.5 shrink-0 pt-2 lg:pt-0 border-t lg:border-t-0 border-white/10">
            <div className="flex items-center gap-2 w-full sm:w-auto">
              {/* Primary Instant Top Up Button with high-voltage glow & shimmer */}
              <button
                type="button"
                id="low-balance-quick-topup"
                onClick={() => openTopup("upi")}
                className="group relative flex-1 sm:flex-none h-11 px-6 inline-flex items-center justify-center gap-2.5 rounded-xl bg-gradient-to-r from-[#c9ff73] via-[#d4ff8a] to-[#bbf861] text-[#11170d] font-bold text-xs shadow-[0_0_24px_rgba(201,255,115,0.35)] hover:shadow-[0_0_32px_rgba(201,255,115,0.55)] hover:brightness-105 active:scale-95 transition-all duration-200 overflow-hidden cursor-pointer"
              >
                {/* Inner sweep light animation */}
                <span
                  className="pointer-events-none absolute inset-0 w-1/2 -translate-x-full group-hover:translate-x-[250%] transition-transform duration-700 bg-gradient-to-r from-transparent via-white/40 to-transparent"
                  aria-hidden="true"
                />
                <Zap size={14} className="fill-[#11170d] text-[#11170d] transition-transform group-hover:rotate-12 group-hover:scale-110" />
                <span className="tracking-wide">Instant Top Up (UPI)</span>
                <ArrowRight size={14} className="transition-transform group-hover:translate-x-0.5" />
              </button>

              {/* Dismiss for session */}
              {dismissible && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleDismiss}
                  title="Dismiss alert for 30 minutes"
                  className="h-10 w-10 text-white/50 hover:text-white hover:bg-white/10 rounded-xl cursor-pointer"
                >
                  <X size={16} />
                </Button>
              )}
            </div>

            {/* Micro Quick-Action Rails */}
            <div className="flex items-center gap-2 text-[11px] text-white/60">
              <span>Quick Top Up:</span>
              <button
                type="button"
                onClick={() => openTopup("upi")}
                className="inline-flex items-center gap-1 rounded-md px-2 py-1 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 transition-colors cursor-pointer"
              >
                <Smartphone size={11} className="text-emerald-400" />
                <span>UPI (Active)</span>
              </button>
              <button
                type="button"
                onClick={() => openTopup("crypto")}
                className="inline-flex items-center gap-1 rounded-md px-2 py-1 bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 border border-purple-500/30 transition-colors cursor-pointer"
              >
                <Coins size={11} className="text-purple-400" />
                <span>Solana (Active)</span>
              </button>
              <span
                className="inline-flex items-center gap-1 rounded-md px-2 py-1 bg-white/5 text-neutral-500 border border-white/5 cursor-not-allowed opacity-60"
                title="Card payments are temporarily under maintenance"
              >
                <CreditCard size={11} className="text-neutral-500" />
                <span>Card (Offline)</span>
              </span>
            </div>

            <Link
              href="/dashboard/pricing"
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#c9ff73] hover:underline mt-0.5"
            >
              <span>Explore full pricing & credit tiers</span>
              <ChevronRight size={12} />
            </Link>
          </div>
        </div>
      </section>

      {/* Integrated Modal */}
      <CheckoutModal
        isOpen={checkoutOpen}
        onClose={() => setCheckoutOpen(false)}
        initialRail={selectedRail}
        initialPackageUsd={25}
        userId={wallet.data.userId}
        onSuccess={() => {
          utils.developer.wallet.invalidate();
          setCheckoutOpen(false);
        }}
      />
    </>
  );
}
export default LowBalanceWarning;
