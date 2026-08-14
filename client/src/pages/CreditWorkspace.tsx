import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { CalendarCheck, CheckCircle2, CircleDollarSign, Clock3, Filter, Loader2, WalletCards, Zap } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import "./credit-workspace.css";

const NANO_DOLLARS = 1_000_000_000;
export const formatCreditNanos = (nanos: number | string | null | undefined) => `$${(Number(nanos ?? 0) / NANO_DOLLARS).toFixed(4)}`;
export const formatCreditWhole = (nanos: number | string | null | undefined) => `$${(Number(nanos ?? 0) / NANO_DOLLARS).toFixed(2)}`;

function WalletHero({ compact = false }: { compact?: boolean }) {
  const wallet = trpc.developer.wallet.useQuery();
  if (wallet.isLoading) return <div className="dashboard-loading-panel"><Loader2 className="animate-spin" /></div>;
  if (wallet.error || !wallet.data) return <div className="dashboard-loading-panel dashboard-error-panel"><p><b>Credit balance unavailable</b><br />Please refresh the workspace to reconnect your wallet.</p></div>;
  const data = wallet.data;
  return <section className={compact ? "credit-hero credit-hero-compact" : "credit-hero"}>
    <div className="credit-hero-grid" />
    <div className="credit-hero-copy"><p><WalletCards size={13} /> TOKENFORGE PROMOTIONAL CREDIT</p><span>Available balance</span><h2>{formatCreditWhole(data?.balanceNanos)}</h2><small>Non-withdrawable platform credit. Actual successful usage is charged at the documented model rate.</small></div>
    <div className="credit-hero-meta"><div><span>Introductory balance</span><b>$50.00</b></div><div><span>Daily check-in</span><b>+$5.00</b></div></div>
  </section>;
}

export function CreditOverview() { return <WalletHero compact />; }

export function UsageLogs() {
  const [modelId, setModelId] = useState<"glm-5.2" | "grok-4.5" | "">("");
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
  const summary = useMemo(() => (logs.data ?? []).reduce((totals, log) => ({ count: totals.count + 1, tokens: totals.tokens + Number(log.totalTokens ?? 0), charges: totals.charges + Number(log.chargeNanos ?? 0) }), { count: 0, tokens: 0, charges: 0 }), [logs.data]);
  const reset = () => { setModelId(""); setSource(""); setFrom(""); setTo(""); };
  return <>
    <WalletHero />
    <section className="log-summary-grid">
      <div><span>Requests shown</span><b>{summary.count}</b></div><div><span>Tokens processed</span><b>{summary.tokens.toLocaleString()}</b></div><div><span>Recorded cost</span><b>{formatCreditNanos(summary.charges)}</b></div>
    </section>
    <section className="usage-log-panel">
      <div className="usage-log-heading"><div><p><Filter size={13} /> REQUEST ACTIVITY</p><h2>Usage logs</h2><span>Only your own gateway and Playground requests appear here.</span></div><Badge className="credit-status-badge">Live ledger view</Badge></div>
      <div className="usage-log-filters"><select aria-label="Filter by model" value={modelId} onChange={event => setModelId(event.target.value as typeof modelId)}><option value="">All models</option><option value="glm-5.2">GLM-5.2</option><option value="grok-4.5">Grok 4.5</option></select><select aria-label="Filter by source" value={source} onChange={event => setSource(event.target.value as typeof source)}><option value="">All sources</option><option value="playground">Playground</option><option value="api">API</option></select><input aria-label="From date" type="date" value={from} onChange={event => setFrom(event.target.value)} /><input aria-label="To date" type="date" value={to} onChange={event => setTo(event.target.value)} /><Button variant="outline" onClick={reset}>Reset</Button></div>
      {logs.isLoading ? <div className="dashboard-loading-panel"><Loader2 className="animate-spin" /></div> : logs.error ? <div className="dashboard-loading-panel dashboard-error-panel"><p><b>Usage logs unavailable</b><br />Please refresh the workspace to reconnect the activity ledger.</p></div> : logs.data?.length ? <div className="usage-log-table-wrap"><table className="usage-log-table"><thead><tr><th>Time</th><th>Source</th><th>Model</th><th>Mode</th><th>Tokens</th><th>Credit charge</th></tr></thead><tbody>{logs.data.map(log => <tr key={log.id}><td><b>{new Date(log.createdAt).toLocaleDateString()}</b><small>{new Date(log.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</small></td><td><span className="source-chip">{log.source === "playground" ? "Playground" : log.apiKeyLabel ?? "API"}</span><small className={log.status === "success" ? "log-success" : "log-failure"}>{log.status.replaceAll("_", " ")}</small></td><td><b>{log.modelId === "glm-5.2" ? "GLM-5.2" : "Grok 4.5"}</b></td><td><span className={log.stream ? "stream-chip stream-chip-live" : "stream-chip"}>{log.stream ? "Stream" : "Non-stream"}</span></td><td><b>{Number(log.inputTokens).toLocaleString()} / {Number(log.outputTokens).toLocaleString()}</b><small>input / output</small></td><td className="credit-charge">{log.status === "success" ? `−${formatCreditNanos(log.chargeNanos)}` : "—"}</td></tr>)}</tbody></table></div> : <div className="usage-log-empty"><Clock3 size={22} /><h3>No matching request activity</h3><p>Run a request from the Playground or an API key to create a transparent usage record.</p></div>}
    </section>
  </>;
}

export function Profile() {
  const profile = trpc.developer.profile.useQuery();
  const wallet = trpc.developer.wallet.useQuery();
  const utils = trpc.useUtils();
  const checkIn = trpc.developer.checkIn.useMutation({ onSuccess: result => { utils.developer.wallet.invalidate(); toast.success(result.claimed ? "Daily check-in complete: $5.00 credit added." : "Today’s check-in was already claimed."); }, onError: error => toast.error(error.message) });
  if (profile.isLoading || wallet.isLoading) return <div className="dashboard-loading-panel profile-loading-panel"><Loader2 className="animate-spin" /><span>Loading your credit profile…</span></div>;
  if (profile.error || wallet.error || !profile.data || !wallet.data) return <div className="dashboard-loading-panel dashboard-error-panel profile-loading-panel"><p><b>Profile unavailable</b><br />Please refresh the workspace to reconnect your profile and wallet.</p></div>;
  const checkinDays = new Set((wallet.data?.checkins ?? []).map(checkin => String(checkin.day).slice(0, 10)));
  const days = Array.from({ length: 7 }, (_, offset) => { const date = new Date(); date.setUTCDate(date.getUTCDate() - (6 - offset)); return date; });
  return <div className="profile-page">
    <div className="profile-identity"><div className="profile-avatar">{profile.data?.name?.slice(0, 1).toUpperCase() ?? "T"}</div><div><p>ACCOUNT PROFILE</p><h1>{profile.data?.name ?? "TokenForge developer"}</h1><span>{profile.data?.email ?? ""}</span></div><Badge className="credit-status-badge">{profile.data?.loginMethod ?? "password"} account</Badge></div>
    <section className="profile-grid"><div className="profile-card"><div className="profile-card-heading"><div><p><CalendarCheck size={14} /> DAILY CHECK-IN</p><h2>Keep your build moving.</h2><span>Claim once per UTC day to receive <b>$5.00</b> in non-withdrawable promotional credit.</span></div><div className="checkin-reward"><Zap size={17} /> +$5</div></div><div className="checkin-calendar">{days.map(date => { const key = date.toISOString().slice(0, 10); const claimed = checkinDays.has(key); const today = key === wallet.data?.today; return <div key={key} className={today ? "checkin-day checkin-day-today" : claimed ? "checkin-day checkin-day-claimed" : "checkin-day"}><small>{date.toLocaleDateString(undefined, { weekday: "short" }).slice(0, 2)}</small><b>{date.getUTCDate()}</b>{claimed ? <CheckCircle2 size={13} /> : <i />}</div>})}</div><Button className="checkin-button" disabled={checkIn.isPending || !wallet.data?.canCheckIn} onClick={() => checkIn.mutate()}>{checkIn.isPending ? <Loader2 className="animate-spin" size={16} /> : <CalendarCheck size={16} />}{wallet.data?.canCheckIn ? "Check in now · claim $5" : "Checked in today"}</Button></div><div className="profile-card profile-credit-card"><CircleDollarSign size={24} /><p>Promotional credit</p><h2>{formatCreditWhole(wallet.data?.balanceNanos)}</h2><span>Available to your account</span><div className="profile-credit-note">Balances are platform credit, not cash or a stored-value account. They are applied only to eligible TokenForge usage.</div></div></section>
    <section className="profile-ledger"><div><p><WalletCards size={14} /> WALLET ACTIVITY</p><h2>Recent credit ledger</h2></div><div className="profile-ledger-list">{wallet.data?.ledger?.length ? wallet.data.ledger.map(entry => <div key={entry.id}><span className={entry.amountNanos > 0 ? "ledger-icon ledger-icon-credit" : "ledger-icon"}>{entry.amountNanos > 0 ? "+" : "−"}</span><div><b>{entry.kind.replaceAll("_", " ")}</b><small>{new Date(entry.createdAt).toLocaleString()}</small></div><strong className={entry.amountNanos > 0 ? "ledger-positive" : ""}>{entry.amountNanos > 0 ? "+" : "−"}{formatCreditNanos(Math.abs(Number(entry.amountNanos)))}</strong></div>) : <p className="ledger-empty">Wallet activity appears after your introductory credit is created.</p>}</div></section>
  </div>;
}
