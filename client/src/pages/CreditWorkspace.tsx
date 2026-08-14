import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TOKENFORGE_MODELS } from "@/lib/modelCatalogue";
import { trpc } from "@/lib/trpc";
import { ArrowDownLeft, ArrowUpRight, CalendarCheck, CalendarDays, CheckCircle2, CircleDollarSign, Clock3, Coins, Filter, KeyRound, Loader2, ReceiptText, RotateCcw, ShieldCheck, Sparkles, WalletCards, Zap } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import "./credit-workspace.css";

const NANO_DOLLARS = 1_000_000_000;

export const formatCreditNanos = (nanos: number | string | null | undefined) => `$${(Number(nanos ?? 0) / NANO_DOLLARS).toFixed(4)}`;
export const formatCreditWhole = (nanos: number | string | null | undefined) => `$${(Number(nanos ?? 0) / NANO_DOLLARS).toFixed(2)}`;

function WalletHero({ compact = false }: { compact?: boolean }) {
  const wallet = trpc.developer.wallet.useQuery();

  if (wallet.isLoading) return <div className="dashboard-loading-panel credit-loading-panel"><Loader2 className="animate-spin" /><span>Opening credit wallet…</span></div>;
  if (wallet.error || !wallet.data) return <div className="dashboard-loading-panel dashboard-error-panel credit-loading-panel"><p><b>Credit balance unavailable</b><br />Please refresh the workspace to reconnect your wallet.</p></div>;

  const data = wallet.data;
  return (
    <section className={`credit-hero${compact ? " credit-hero--compact" : ""}`} aria-label="TokenForge promotional credit balance">
      <div className="credit-hero__grid" aria-hidden="true" />
      <div className="credit-hero__signal credit-hero__signal--one" aria-hidden="true" />
      <div className="credit-hero__signal credit-hero__signal--two" aria-hidden="true" />
      <div className="credit-hero__main">
        <p className="credit-kicker"><WalletCards size={13} /> Promotional credit wallet</p>
        <span className="credit-hero__label">Available to build with</span>
        <h2>{formatCreditWhole(data.balanceNanos)}</h2>
        <p className="credit-hero__description">Non-withdrawable platform credit. Successful requests settle against the published model rate after token usage is reported.</p>
      </div>
      <div className="credit-hero__stats" aria-label="Credit reward details">
        <div><span><Sparkles size={14} /> Starting credit</span><b>$50.00</b><small>for a new wallet</small></div>
        <div><span><CalendarCheck size={14} /> Daily reward</span><b>+$5.00</b><small>once per UTC day</small></div>
      </div>
    </section>
  );
}

export function CreditOverview() {
  return <WalletHero compact />;
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
      <WalletHero />
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
              return <article key={log.id} className="usage-log-card" role="listitem">
                <div className="usage-log-card__topline">
                  <div className="usage-log-card__model"><span className="model-signal">{TOKENFORGE_MODELS.find(model => model.id === log.modelId)?.providerMark ?? "TF"}</span><div><b>{displayModel(log.modelId)}</b><small>{created.date} · {created.time}</small></div></div>
                  <div className="usage-log-card__status"><span className={successful ? "request-status request-status--success" : "request-status"}>{successful ? "Settled" : log.status.replaceAll("_", " ")}</span><span className={log.stream ? "stream-chip stream-chip--live" : "stream-chip"}>{log.stream ? "Stream" : "Standard"}</span></div>
                </div>
                <div className="usage-log-card__details">
                  <div><span>Route</span><b className="usage-source"><KeyRound size={12} />{log.source === "playground" ? "Playground" : log.apiKeyLabel ?? "API key"}</b></div>
                  <div><span>Input</span><b>{Number(log.inputTokens).toLocaleString()}</b></div>
                  <div><span>Output</span><b>{Number(log.outputTokens).toLocaleString()}</b></div>
                  <div className="usage-log-card__charge"><span>Credit charge</span><b>{successful ? `−${formatCreditNanos(log.chargeNanos)}` : "No debit"}</b></div>
                </div>
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
  const checkIn = trpc.developer.checkIn.useMutation({
    onSuccess: result => {
      utils.developer.wallet.invalidate();
      toast.success(result.claimed ? "Daily check-in complete: $5.00 credit added." : "Today’s check-in was already claimed.");
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
        <div className="profile-identity-panel__meta"><Badge className="credit-status-badge">{profile.data.loginMethod ?? "password"} account</Badge><small>Member since {new Date(profile.data.createdAt).toLocaleDateString(undefined, { month: "short", year: "numeric" })}</small></div>
      </section>
      <section className="profile-grid">
        <article className="checkin-card">
          <div className="checkin-card__heading"><div><p className="credit-kicker"><CalendarDays size={13} /> Daily build ritual</p><h2>Claim your next +$5.</h2><span>Check in once per UTC day to receive non-withdrawable promotional credit for eligible TokenForge usage.</span></div><div className="checkin-reward"><Zap size={16} /><b>+$5</b><small>UTC reward</small></div></div>
          <div className="checkin-calendar" aria-label="Seven day check-in calendar">{days.map(date => { const key = date.toISOString().slice(0, 10); const claimed = checkinDays.has(key); const today = key === wallet.data.today; return <div key={key} className={`checkin-day${today ? " checkin-day--today" : ""}${claimed ? " checkin-day--claimed" : ""}`}><small>{date.toLocaleDateString(undefined, { weekday: "short", timeZone: "UTC" }).slice(0, 2)}</small><b>{date.getUTCDate()}</b><span>{claimed ? <CheckCircle2 size={13} /> : today ? "Today" : ""}</span></div>; })}</div>
          <div className="checkin-card__action"><div><span>{wallet.data.canCheckIn ? "Ready for today’s reward" : "Today’s reward is already secured"}</span><small>Resets at 00:00 UTC</small></div><Button className="checkin-button" disabled={checkIn.isPending || !wallet.data.canCheckIn} onClick={() => checkIn.mutate()}>{checkIn.isPending ? <Loader2 className="animate-spin" size={16} /> : <CalendarCheck size={16} />}{wallet.data.canCheckIn ? "Check in now" : "Checked in"}</Button></div>
        </article>
        <article className="profile-credit-card">
          <div className="profile-credit-card__top"><span className="profile-credit-card__icon"><CircleDollarSign size={19} /></span><Badge className="credit-status-badge">Available now</Badge></div>
          <p>Promotional credit</p><h2>{formatCreditWhole(wallet.data.balanceNanos)}</h2><span className="profile-credit-card__label">Ready for eligible model usage</span>
          <div className="profile-credit-card__facts"><div><span>Starting credit</span><b>$50.00</b></div><div><span>Daily reward</span><b>+$5.00</b></div></div>
          <p className="profile-credit-card__note">Credit is not cash or a stored-value balance. It cannot be withdrawn, transferred, or exchanged.</p>
        </article>
      </section>
      <section className="profile-ledger">
        <header className="profile-ledger__heading"><div><p className="credit-kicker"><WalletCards size={13} /> Wallet activity</p><h2>A clear credit trail.</h2><span>Every grant, reward, and usage settlement attached to this account.</span></div><Badge className="credit-status-badge">Immutable ledger</Badge></header>
        <div className="profile-ledger-list">{wallet.data.ledger.length ? wallet.data.ledger.map(entry => {
          const amount = Number(entry.amountNanos);
          const descriptor = ledgerDescriptor(entry.kind);
          const Icon = descriptor.icon;
          return <article key={entry.id} className={`ledger-row${amount > 0 ? " ledger-row--credit" : ""}`}><span className="ledger-row__icon"><Icon size={16} /></span><div className="ledger-row__copy"><b>{descriptor.title}</b><small>{descriptor.detail} · {new Date(entry.createdAt).toLocaleString()}</small></div><strong>{amount > 0 ? "+" : "−"}{formatCreditNanos(Math.abs(amount))}</strong></article>;
        }) : <div className="ledger-empty"><ArrowDownLeft size={19} /><div><b>Your wallet is ready.</b><span>Introductory credit will appear here the first time the wallet is initialized.</span></div></div>}</div>
      </section>
    </div>
  );
}
