import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ProviderMark } from "@/components/ProviderMark";
import { TOKENFORGE_MODELS } from "@/lib/modelCatalogue";
import { calculateSettledUsagePricingBreakdownNanos } from "@shared/usagePricing";
import { trpc } from "@/lib/trpc";
import { Link } from "wouter";
import { ArrowDownLeft, ArrowUpRight, CalendarCheck, CalendarDays, CheckCircle2, ChevronDown, CircleDollarSign, Clock3, Code2, Coins, Filter, KeyRound, Loader2, Percent, ReceiptText, RotateCcw, ShieldCheck, Sparkles, WalletCards, Zap } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { SolanaPayButton } from "@/components/SolanaPayButton";
import { UserTierBadge } from "@/components/UserTierBadge";
import { PaygPaymentModal } from "@/components/PaygPaymentModal";
import { CheckoutModal } from "@/components/CheckoutModal";
import { useAuth } from "@/_core/hooks/useAuth";
import "./credit-workspace.css";
import "./credit-pricing-breakdown.css";

export function useIsCreditsEnabled(walletCreditsEnabled?: boolean) {
  const { user } = useAuth();
  const emailLower = (user?.email ?? "").trim().toLowerCase();
  const isWhitelistedUser = emailLower === "konchoor@gmail.com" || emailLower === "kumaryush18@gmail.com";
  if (isWhitelistedUser) return true;

  if (typeof walletCreditsEnabled === "boolean") {
    return walletCreditsEnabled;
  }
  return Boolean((user as any)?.creditsEnabled);
}

const NANO_DOLLARS = 1_000_000_000;

export const formatCreditNanos = (nanos: number | string | null | undefined) => `$${(Number(nanos ?? 0) / NANO_DOLLARS).toFixed(4)}`;
export const formatCreditWhole = (nanos: number | string | null | undefined) => `$${(Number(nanos ?? 0) / NANO_DOLLARS).toFixed(2)}`;

export function PaygHero({ compact = false }: { compact?: boolean }) {
  const wallet = trpc.developer.wallet.useQuery();
  const utils = trpc.useUtils();
  const [paygModalOpen, setPaygModalOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [checkoutRail, setCheckoutRail] = useState<"card" | "upi" | "crypto">("upi");
  const [checkoutAmount, setCheckoutAmount] = useState<number>(25);

  if (wallet.isLoading || wallet.error || !wallet.data) return null;

  const data = wallet.data;
  const paygBalanceNanos = (data as any).paygBalanceNanos ?? 0;
  const paygAmount = formatCreditWhole(paygBalanceNanos);

  const handleSelectPaygMethod = (method: "card" | "upi" | "crypto", amountUsd: number) => {
    setPaygModalOpen(false);
    setCheckoutRail(method);
    setCheckoutAmount(amountUsd);
    setCheckoutOpen(true);
  };

  const handleCheckoutSuccess = () => {
    utils.developer.wallet.invalidate();
    toast.success("PAYG deposit verified! Funds have been added to your balance.");
  };

  return (
    <>
      <section
        className="relative overflow-hidden rounded-3xl border border-rose-500/30 bg-gradient-to-br from-rose-950/30 via-[#100d12] to-black/80 p-5 sm:p-6 shadow-xl text-white flex flex-col justify-between transition-all duration-200 hover:border-rose-500/40"
        aria-label="Pay-As-You-Go Wallet"
      >
        <div className="absolute top-0 right-0 h-36 w-36 rounded-full bg-rose-500/10 blur-3xl pointer-events-none" />

        <div className="relative z-10 space-y-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="flex h-2 w-2 rounded-full bg-rose-500 animate-pulse" />
              <span className="text-[11px] font-bold uppercase tracking-wider text-rose-300 font-mono">
                Tier 1: PAYG Compute
              </span>
            </div>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 border border-rose-500/30 text-rose-200 font-mono">
              +100% Bonus (2x)
            </span>
          </div>

          <div>
            <div className="flex items-baseline gap-2">
              <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white font-mono">
                {paygAmount}
              </h2>
              <span className="text-xs text-neutral-400 font-mono">USD</span>
            </div>
            <p className="text-xs text-neutral-300 mt-1.5 leading-relaxed">
              Zero-markup official provider rates · Funds never expire
            </p>
          </div>
        </div>

        <div className="relative z-10 pt-4 mt-2 border-t border-white/10 flex items-center gap-2 flex-wrap">
          <Button
            type="button"
            onClick={() => setPaygModalOpen(true)}
            className="flex-1 min-w-[120px] inline-flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold bg-rose-500 hover:bg-rose-600 text-white shadow-lg shadow-rose-500/20 transition-all cursor-pointer h-auto"
          >
            <Zap size={14} />
            <span>Top Up Balance</span>
          </Button>

          <Link href="/dashboard/pricing" className="shrink-0">
            <span className="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-semibold text-neutral-300 hover:text-white bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 transition-all cursor-pointer">
              <span>Rates</span>
              <ArrowUpRight size={13} />
            </span>
          </Link>
        </div>
      </section>

      <PaygPaymentModal
        isOpen={paygModalOpen}
        onClose={() => setPaygModalOpen(false)}
        onSelectPaymentMethod={handleSelectPaygMethod}
        initialAmountUsd={checkoutAmount}
      />

      <CheckoutModal
        isOpen={checkoutOpen}
        onClose={() => setCheckoutOpen(false)}
        initialRail={checkoutRail}
        initialPackageUsd={checkoutAmount}
        isPayg={true}
        userId={(data as any).userId}
        onSuccess={handleCheckoutSuccess}
      />
    </>
  );
}

export function CodingTokensHero({ compact = false }: { compact?: boolean }) {
  const wallet = trpc.developer.wallet.useQuery();
  if (wallet.isLoading || wallet.error || !wallet.data) return null;

  const data = wallet.data;
  const codingPlanTokens = Number((data as any)?.codingPlanTokens ?? 0);
  const formattedTokens = codingPlanTokens >= 1_000_000
    ? `${(codingPlanTokens / 1_000_000).toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 2 })}M`
    : codingPlanTokens.toLocaleString();

  return (
    <section
      className="relative overflow-hidden rounded-3xl border border-cyan-500/30 bg-gradient-to-br from-cyan-950/30 via-[#0a1118] to-black/80 p-5 sm:p-6 shadow-xl text-white flex flex-col justify-between transition-all duration-200 hover:border-cyan-500/40"
      aria-label="Dedicated Coding Plan Tokens"
    >
      <div className="absolute top-0 right-0 h-36 w-36 rounded-full bg-cyan-500/10 blur-3xl pointer-events-none" />

      <div className="relative z-10 space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="flex h-2 w-2 rounded-full bg-cyan-400 animate-pulse" />
            <span className="text-[11px] font-bold uppercase tracking-wider text-cyan-300 font-mono flex items-center gap-1.5">
              <Code2 size={13} className="text-cyan-400" />
              <span>Tier 2: Coding Tokens</span>
            </span>
          </div>
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-cyan-500/20 border border-cyan-500/30 text-cyan-200 font-mono">
            10M / $1
          </span>
        </div>

        <div>
          <div className="flex items-baseline gap-2">
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white font-mono">
              {formattedTokens}
            </h2>
            <span className="text-xs font-mono text-cyan-400 font-semibold uppercase tracking-wider">
              {codingPlanTokens >= 1_000_000 ? "Tokens Quota" : "Tokens"}
            </span>
          </div>
          <p className="text-xs text-neutral-300 mt-1.5 leading-relaxed">
            Claude Opus 5 & GLM 5.3 dedicated allocation · Instant settlement
          </p>
        </div>
      </div>

      <div className="relative z-10 pt-4 mt-2 border-t border-white/10 flex items-center gap-2 flex-wrap">
        <Link href="/dashboard/pricing" className="flex-1">
          <Button
            type="button"
            className="w-full inline-flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold text-black bg-gradient-to-r from-cyan-400 to-teal-400 hover:from-cyan-300 hover:to-teal-300 shadow-lg shadow-cyan-500/20 transition-all cursor-pointer h-auto"
          >
            <Code2 size={14} />
            <span>Get Coding Tokens</span>
            <ArrowUpRight size={13} />
          </Button>
        </Link>
      </div>
    </section>
  );
}

export function WalletHero({ compact = false }: { compact?: boolean }) {
  const wallet = trpc.developer.wallet.useQuery();
  const creditsEnabled = useIsCreditsEnabled(wallet.data?.creditsEnabled);

  if (wallet.isLoading || !creditsEnabled || wallet.error || !wallet.data) return null;

  const data = wallet.data;
  return (
    <section
      className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-[#121c10]/40 via-[#0e120d] to-black/80 p-5 sm:p-6 shadow-xl text-white flex flex-col justify-between transition-all duration-200 hover:border-white/20"
      aria-label="TokenForge promotional credit balance"
    >
      <div className="absolute top-0 right-0 h-36 w-36 rounded-full bg-[#befe6c]/10 blur-3xl pointer-events-none" />

      <div className="relative z-10 space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="flex h-2 w-2 rounded-full bg-[#c8ff74] animate-pulse" />
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#c8ff74] font-mono flex items-center gap-1.5">
              <WalletCards size={13} />
              <span>Tier 3: Credit Wallet</span>
            </span>
          </div>
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#c8ff74]/15 border border-[#c8ff74]/30 text-[#c8ff74] font-mono">
            Fixed Bundles
          </span>
        </div>

        <div>
          <div className="flex items-baseline gap-2">
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white font-mono">
              {formatCreditWhole(data.balanceNanos)}
            </h2>
            <span className="text-xs text-neutral-400 font-mono">USD</span>
          </div>
          <p className="text-xs text-neutral-300 mt-1.5 leading-relaxed">
            Platform compute credits · Settle from usage at standard rates
          </p>
        </div>
      </div>

      <div className="relative z-10 pt-4 mt-2 border-t border-white/10 flex items-center gap-2 flex-wrap">
        <Link href="/dashboard/pricing" className="flex-1">
          <Button
            type="button"
            className="w-full inline-flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold text-black bg-[#c8ff74] hover:bg-[#d8ff91] shadow-lg shadow-[#c8ff74]/20 transition-all cursor-pointer h-auto"
          >
            <Zap size={14} className="text-black" />
            <span>Buy Credits & Plans</span>
            <ArrowUpRight size={13} className="text-black" />
          </Button>
        </Link>
      </div>
    </section>
  );
}

export function CreditOverview() {
  const wallet = trpc.developer.wallet.useQuery();
  const creditsEnabled = useIsCreditsEnabled(wallet.data?.creditsEnabled);

  return (
    <div className={`grid grid-cols-1 ${creditsEnabled ? "md:grid-cols-2 lg:grid-cols-3" : "md:grid-cols-2"} gap-4 mb-6`}>
      {/* Tier 1: Pay-As-You-Go */}
      <PaygHero compact />
      {/* Tier 2: Dedicated Coding Plan Tokens */}
      <CodingTokensHero compact />
      {/* Tier 3: Promotional Credits Wallet (when enabled) */}
      {creditsEnabled && <WalletHero compact />}
    </div>
  );
}

function displayModel(modelId: string) {
  return TOKENFORGE_MODELS.find(model => model.id === modelId)?.name ?? modelId;
}

function formatLogDate(value: Date | string) {
  const date = new Date(value);
  return {
    date: date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }),
    time: date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
  };
}

export function calculateUsagePricingBreakdown(modelId: string, inputTokens: number | string | null | undefined, outputTokens: number | string | null | undefined, chargeNanos: number | string | null | undefined) {
  const model = TOKENFORGE_MODELS.find(candidate => candidate.id === modelId);
  if (!model) return null;
  return calculateSettledUsagePricingBreakdownNanos({
    inputTokens: Number(inputTokens ?? 0),
    outputTokens: Number(outputTokens ?? 0),
    upstreamInputUsdPerMillion: model.inputUsdPerMillion / 3.5,
    upstreamOutputUsdPerMillion: model.outputUsdPerMillion / 3.5,
    finalCreditDeductionNanos: Number(chargeNanos ?? 0),
  });
}

function ledgerDescriptor(kind: string) {
  if (kind === "introductory_grant") return { title: "Welcome credit", detail: "Initial TokenForge build credit", icon: Sparkles };
  if (kind === "daily_checkin") return { title: "Daily check-in", detail: "UTC build reward", icon: CalendarCheck };
  if (kind === "usage_debit") return { title: "Usage settled", detail: "Successful model request", icon: ArrowUpRight };
  return { title: "Wallet adjustment", detail: "Account credit activity", icon: RotateCcw };
}

export function UsageLogs() {
  const [modelId, setModelId] = useState<string>("");
  const [source, setSource] = useState<"api" | "playground" | "">("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const wallet = trpc.developer.wallet.useQuery();
  const creditsEnabled = useIsCreditsEnabled(wallet.data?.creditsEnabled);

  const input = useMemo(() => ({
    modelId: modelId || undefined,
    source: source || undefined,
    from: from ? new Date(`${from}T00:00:00.000Z`).toISOString() : undefined,
    to: to ? new Date(`${to}T23:59:59.999Z`).toISOString() : undefined,
    limit: 100,
  }), [from, modelId, source, to]);
  const logs = trpc.developer.usageLogs.useQuery(input);
  const summary = useMemo(() => (logs.data ?? []).reduce((totals, log) => ({
    count: totals.count + 1,
    tokens: totals.tokens + Number(log.totalTokens ?? 0),
    charges: totals.charges + Number(log.chargeNanos ?? 0),
  }), { count: 0, tokens: 0, charges: 0 }), [logs.data]);
  const activeFilters = [modelId, source, from, to].filter(Boolean).length;
  const reset = () => { setModelId(""); setSource(""); setFrom(""); setTo(""); };

  return (
    <div className="credit-workspace usage-workspace">
      {creditsEnabled ? <WalletHero /> : <PaygHero />}
      <section className="usage-metrics" aria-label="Usage log summary">
        <article><span className="usage-metric__icon"><ReceiptText size={16} /></span><div><p>Requests shown</p><b>{summary.count}</b><small>matching this view</small></div></article>
        <article><span className="usage-metric__icon usage-metric__icon--cyan"><Coins size={16} /></span><div><p>Tokens processed</p><b>{summary.tokens.toLocaleString()}</b><small>input + output</small></div></article>
        <article><span className="usage-metric__icon usage-metric__icon--warm"><CircleDollarSign size={16} /></span><div><p>Recorded charge</p><b>{formatCreditNanos(summary.charges)}</b><small>successful requests</small></div></article>
      </section>
      <section className="usage-log-panel">
        <header className="usage-log-panel__heading">
          <div>
            <p className="credit-kicker"><Filter size={13} /> Request activity</p>
            <h2>Usage, in full view.</h2>
            <span>Every Playground and API request is recorded with its source, usage, and final credit settlement.</span>
          </div>
          <Badge className="credit-status-badge"><span className="credit-status-badge__dot" /> Live ledger</Badge>
        </header>
        <div className="usage-log-filter-shell">
          <div className="usage-log-filter-meta"><span>Refine activity</span>{activeFilters ? <b>{activeFilters} active filter{activeFilters === 1 ? "" : "s"}</b> : <small>Last 100 requests</small>}</div>
          <div className="usage-log-filters">
            <label><span>Model</span><select aria-label="Filter by model" value={modelId} onChange={event => setModelId(event.target.value)}><option value="">All models</option>{TOKENFORGE_MODELS.map(model => <option key={model.id} value={model.id}>{model.name} · {model.provider}</option>)}</select></label>
            <label><span>Source</span><select aria-label="Filter by source" value={source} onChange={event => setSource(event.target.value as typeof source)}><option value="">All sources</option><option value="playground">Playground</option><option value="api">API key</option></select></label>
            <label><span>From</span><input aria-label="From date" type="date" value={from} onChange={event => setFrom(event.target.value)} /></label>
            <label><span>To</span><input aria-label="To date" type="date" value={to} onChange={event => setTo(event.target.value)} /></label>
            <Button className="usage-filter-reset" variant="outline" onClick={reset} disabled={!activeFilters}><RotateCcw size={14} /> Reset</Button>
          </div>
        </div>
        {logs.isLoading ? <div className="dashboard-loading-panel credit-loading-panel"><Loader2 className="animate-spin" /><span>Reading your activity ledger…</span></div> : logs.error ? <div className="dashboard-loading-panel dashboard-error-panel credit-loading-panel"><p><b>Usage logs unavailable</b><br />Please refresh the workspace to reconnect the activity ledger.</p></div> : logs.data?.length ? (
          <div className="usage-log-list" role="list" aria-label="Request activity records">
            {logs.data.map(log => {
              const created = formatLogDate(log.createdAt);
              const successful = log.status === "success";
              const pricing = successful ? calculateUsagePricingBreakdown(log.modelId, log.inputTokens, log.outputTokens, log.chargeNanos) : null;
              return <article key={log.id} className="usage-log-card" role="listitem">
                <div className="usage-log-card__topline">
                  <div className="usage-log-card__model"><span className="model-signal">{(() => { const model = TOKENFORGE_MODELS.find(candidate => candidate.id === log.modelId); return model ? <ProviderMark provider={model.provider} fallback={model.providerMark} size={17} /> : "TF"; })()}</span><div><b>{displayModel(log.modelId)}</b><small>{created.date} · {created.time}</small></div></div>
                  <div className="usage-log-card__status">
                    <span className={successful ? "request-status request-status--success" : "request-status"}>
                      {log.outcome ? log.outcome.replaceAll("_", " ") : successful ? "Settled" : log.status.replaceAll("_", " ")}
                    </span>
                    {log.stopReason && log.stopReason !== "none" && (
                      <span className="font-mono text-[9px] px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-[#a9aab8]" title="Finish / Stop Reason">
                        {log.stopReason}
                      </span>
                    )}
                    <span className={log.stream ? "stream-chip stream-chip--live" : "stream-chip"}>{log.stream ? "Stream" : "Standard"}</span>
                  </div>
                </div>
                <div className="usage-log-card__details">
                  <div><span>Route</span><b className="usage-source"><KeyRound size={12} />{log.source === "playground" ? "Playground" : log.apiKeyLabel ?? "API key"}</b></div>
                  <div><span>Input / Output</span><b>{Number(log.inputTokens).toLocaleString()} / {Number(log.outputTokens).toLocaleString()}</b></div>
                  <div>
                    <span>Latency / TTFT</span>
                    <b>
                      {log.durationMs ?? log.latencyMs ? `${Math.round((log.durationMs ?? log.latencyMs)!)}ms` : "—"}
                      {typeof log.ttftMs === "number" && log.ttftMs > 0 ? ` · TTFT ${Math.round(log.ttftMs)}ms` : ""}
                    </b>
                  </div>
                  <div className="usage-log-card__charge"><span>Credit charge</span><b>{successful ? `−${formatCreditNanos(log.chargeNanos)}` : "No debit"}</b></div>
                </div>
                {successful && <details className="usage-pricing-breakdown">
                  <summary>See request pricing <ChevronDown size={14} aria-hidden="true" /></summary>
                  {pricing ? <div className="usage-pricing-breakdown__rows">
                    <div><span>Provider base cost</span><b>{formatCreditNanos(pricing.providerBaseNanos)}</b></div>
                    <div><span>Platform charge <small>(3.5× rate)</small></span><b>{formatCreditNanos(pricing.platformChargeNanos)}</b></div>
                    <div><span>Final credit deduction</span><b>−{formatCreditNanos(pricing.finalCreditDeductionNanos)}</b></div>
                  </div> : <p className="usage-pricing-breakdown__unavailable">Pricing details are unavailable for this historical model route.</p>}
                </details>}
              </article>;
            })}
          </div>
        ) : <div className="usage-log-empty"><div className="usage-log-empty__icon"><Clock3 size={22} /></div><h3>No matching request activity</h3><p>Run a request from the Playground or with an API key to start a transparent usage record.</p></div>}
      </section>
    </div>
  );
}

export function Profile() {
  const profile = trpc.developer.profile.useQuery();
  const wallet = trpc.developer.wallet.useQuery();
  const utils = trpc.useUtils();
  const creditsEnabled = useIsCreditsEnabled(wallet.data?.creditsEnabled);
  const checkIn = trpc.developer.checkIn.useMutation({
    onSuccess: result => {
      utils.developer.wallet.invalidate();
      toast.success(
        result.claimed
          ? `🎉 Daily check-in complete: ${(result as any).rewardFormatted ?? `$${((result.rewardNanos ?? 0) / 1_000_000_000).toFixed(2)}`} PAYG credit added to your balance! Try your luck again tomorrow.`
          : "Today’s check-in was already claimed. Resets at 00:00 UTC."
      );
    },
    onError: error => toast.error(error.message),
  });

  if (profile.isLoading || wallet.isLoading) return <div className="dashboard-loading-panel profile-loading-panel"><Loader2 className="animate-spin" /><span>Loading your account workspace…</span></div>;
  if (profile.error || wallet.error || !profile.data || !wallet.data) return <div className="dashboard-loading-panel dashboard-error-panel profile-loading-panel"><p><b>Profile unavailable</b><br />Please refresh the workspace to reconnect your profile and wallet.</p></div>;

  const checkinDays = new Set(wallet.data.checkins.map(checkin => String(checkin.day).slice(0, 10)));
  const days = Array.from({ length: 7 }, (_, offset) => {
    const date = new Date();
    date.setUTCDate(date.getUTCDate() - (6 - offset));
    return date;
  });
  const initial = profile.data.name?.trim().slice(0, 1).toUpperCase() ?? "T";

  return (
    <div className="profile-page credit-workspace">
      <section className="profile-identity-panel">
        <div className="profile-identity-panel__glow" aria-hidden="true" />
        <div className="profile-avatar" aria-hidden="true">{initial}</div>
        <div className="profile-identity-panel__copy"><p className="credit-kicker"><ShieldCheck size={13} /> Account profile</p><h2>{profile.data.name ?? "TokenForge developer"}</h2><span>{profile.data.email ?? "No email address available"}</span></div>
        <div className="profile-identity-panel__meta">
          <UserTierBadge tier={(profile.data as any).tier} showTag size="sm" />
          <Badge className="credit-status-badge">{profile.data.loginMethod ?? "password"} account</Badge><small>Member since {new Date(profile.data.createdAt).toLocaleDateString(undefined, { month: "short", year: "numeric" })}</small></div>
      </section>
      <section className="profile-grid">
        <article className="checkin-card">
          <div className="checkin-card__heading">
            <div>
              <p className="credit-kicker"><CalendarDays size={13} /> Daily build ritual</p>
              <h2>Daily Check-in · Up to $2.00</h2>
              <span>Check in once per UTC day to claim a random PAYG bonus up to $2.00 (Try your luck!). Added directly to your PAYG balance.</span>
            </div>
            <div className="checkin-reward">
              <Zap size={16} />
              <b>Up to $2</b>
              <small>Try your luck</small>
            </div>
          </div>
          <div className="checkin-calendar" aria-label="Seven day check-in calendar">
            {days.map(date => {
              const key = date.toISOString().slice(0, 10);
              const claimed = checkinDays.has(key);
              const today = key === wallet.data.today;
              return (
                <div key={key} className={`checkin-day${today ? " checkin-day--today" : ""}${claimed ? " checkin-day--claimed" : ""}`}>
                  <small>{date.toLocaleDateString(undefined, { weekday: "short", timeZone: "UTC" }).slice(0, 2)}</small>
                  <b>{date.getUTCDate()}</b>
                  <span>{claimed ? <CheckCircle2 size={13} /> : today ? "Today" : ""}</span>
                </div>
              );
            })}
          </div>
          <div className="checkin-card__action">
            <div>
              <span>{wallet.data.canCheckIn ? "Ready for today’s random reward" : "Today’s reward is already secured"}</span>
              <small>Resets at 00:00 UTC</small>
            </div>
            <Button className="checkin-button" disabled={checkIn.isPending || !wallet.data.canCheckIn} onClick={() => checkIn.mutate()}>
              {checkIn.isPending ? <Loader2 className="animate-spin" size={16} /> : <CalendarCheck size={16} />}
              {wallet.data.canCheckIn ? "Check in now" : "Checked in"}
            </Button>
          </div>
        </article>

        {creditsEnabled ? (
          <article className="profile-credit-card">
            <div className="profile-credit-card__top"><span className="profile-credit-card__icon"><CircleDollarSign size={19} /></span><Badge className="credit-status-badge">Available now</Badge></div>
            <p>Promotional credit</p><h2>{formatCreditWhole(wallet.data.balanceNanos)}</h2><span className="profile-credit-card__label">Ready for eligible model usage</span>
            <div className="profile-credit-card__facts"><div><span>Daily Check-in</span><b>Up to $2.00</b></div><div><span>Starting credit</span><b>$50.00</b></div></div>
            <p className="profile-credit-card__note">Credit is not cash or a stored-value balance. It cannot be withdrawn, transferred, or exchanged.</p>
          </article>
        ) : (
          <article className="profile-credit-card border-rose-500/30">
            <div className="profile-credit-card__top"><span className="profile-credit-card__icon text-rose-400"><CircleDollarSign size={19} /></span><Badge className="border-0 bg-rose-500/20 text-rose-300">Tier 1 PAYG</Badge></div>
            <p>Available PAYG Balance</p><h2 className="text-white">{formatCreditWhole((wallet.data as any)?.paygBalanceNanos ?? 0)}</h2><span className="profile-credit-card__label text-neutral-400">Available for all model inferences</span>
            <div className="profile-credit-card__facts"><div><span>Daily Check-in</span><b className="text-emerald-400">Up to $2.00</b></div><div><span>Deposit Bonus</span><b className="text-emerald-400">+100% (2x)</b></div></div>
            <p className="profile-credit-card__note">Pay-As-You-Go funds never expire and deduct strictly at official provider token rates.</p>
          </article>
        )}
      </section>
      <section className="profile-ledger">
        <header className="profile-ledger__heading"><div><p className="credit-kicker"><WalletCards size={13} /> Wallet activity</p><h2>A clear credit trail.</h2><span>Every grant, reward, and usage settlement attached to this account.</span></div><Badge className="credit-status-badge">Immutable ledger</Badge></header>
        <div className="profile-ledger-list">{wallet.data.ledger.length ? wallet.data.ledger.map(entry => {
          const amount = Number(entry.amountNanos);
          const descriptor = ledgerDescriptor(entry.kind);
          const Icon = descriptor.icon;
          return <article key={entry.id} className={`ledger-row${amount > 0 ? " ledger-row--credit" : ""}`}><span className="ledger-row__icon"><Icon size={16} /></span><div className="ledger-row__copy"><b>{descriptor.title}</b><small>{entry.note ?? descriptor.detail} · {new Date(entry.createdAt).toLocaleString()}</small></div><strong>{amount > 0 ? "+" : "−"}{formatCreditNanos(Math.abs(amount))}</strong></article>;
        }) : <div className="ledger-empty"><ArrowDownLeft size={19} /><div><b>Your wallet is ready.</b><span>Introductory credit will appear here the first time the wallet is initialized.</span></div></div>}</div>
      </section>
    </div>
  );
}
