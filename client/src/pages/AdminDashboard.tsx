import DashboardLayout from "@/components/DashboardLayout";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/_core/hooks/useAuth";
import { TOKENFORGE_MODELS } from "@/lib/modelCatalogue";
import { trpc } from "@/lib/trpc";
import { coalesceDailyUsage } from "../../../shared/usageSeries";
import { Activity, AlertTriangle, ChartNoAxesCombined, Download, Gauge, KeyRound, Loader2, LogOut, Mail, Megaphone, Power, RefreshCw, Search, ServerCog, ShieldAlert, Trash2, UsersRound, WalletCards } from "lucide-react";
import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

type AdminAccount = {
  id: number;
  name: string | null;
  email: string | null;
  suspended: boolean | null;
  suspicious: boolean | null;
  requestLimit: number | null;
  tokenLimit: number | null;
  balanceNanos: number;
  lifetimeSpendNanos: number;
  requestCount: number;
  totalTokens: number;
  lastActivityAt: Date | null;
  discordVerifiedAt: Date | null;
};

type AdminAuditRecord = {
  id: number;
  action: string;
  entityType: string;
  entityId: string | null;
  createdAt: Date;
};

type AdminAccountModelUsage = {
  userId: number;
  modelId: string;
  requestCount: number;
  totalTokens: number;
};

type AdminGlobalModelUsage = {
  modelId: string;
  accountCount: number;
  requestCount: number;
  totalTokens: number;
};

const formatCredits = (nanos: number) => `$${(nanos / 1_000_000_000).toFixed(2)}`;
const formatTokens = (tokens: number) => tokens >= 1_000_000 ? `${(tokens / 1_000_000).toFixed(1)}M` : tokens >= 1_000 ? `${(tokens / 1_000).toFixed(1)}K` : tokens.toLocaleString();

function Toggle({ label, enabled, onChange, pending }: { label: string; enabled: boolean; onChange: (value: boolean) => void; pending?: boolean }) {
  return <div className={`flex shrink-0 items-center gap-2 rounded-xl border px-2 py-1 ${enabled ? "border-[#c9ff73]/20 bg-[#c9ff73]/[.055]" : "border-white/8 bg-black/15"}`}>
    <span className={`min-w-9 text-right text-[9px] font-bold uppercase tracking-[.12em] ${enabled ? "text-[#c9ff73]" : "text-[#828394]"}`}>{pending ? "Saving" : enabled ? "Live" : "Off"}</span>
    <Switch aria-label={`${label}: ${enabled ? "enabled" : "disabled"}`} checked={enabled} onCheckedChange={value => onChange(Boolean(value))} disabled={pending} className="h-5 w-9 border-0 data-[state=checked]:bg-[#88c637] data-[state=unchecked]:bg-[#4a4b59] [&_[data-slot=switch-thumb]]:size-4 [&_[data-slot=switch-thumb]]:data-[state=checked]:translate-x-[calc(100%-1px)]" />
  </div>;
}

function AdminUsageChart({ usage, modelUsage, loading }: { usage: { day: string; requests: number; tokens: number }[]; modelUsage: AdminGlobalModelUsage[]; loading: boolean }) {
  const data = coalesceDailyUsage(usage);
  const max = Math.max(1, ...data.map(row => row.requests));
  return <div className="space-y-7">
    <div>
      {data.length ? <div className="flex h-40 items-end gap-2">{data.map(row => <div className="group flex h-full flex-1 flex-col justify-end" key={row.day}><div className="rounded-t bg-gradient-to-t from-[#5f9f29] to-[#c9ff73]" style={{ height: `${Math.max(4, row.requests / max * 100)}%` }} title={`${row.requests} requests · ${row.tokens.toLocaleString()} tokens`} /><span className="mt-2 text-center font-mono text-[8px] text-[#77798b]">{row.day.slice(5)}</span></div>)}</div> : <div className="grid h-40 place-items-center text-xs text-[#9091a3]">No metered activity has been recorded yet.</div>}
    </div>
    <div className="border-t border-white/8 pt-5">
      <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[.13em] text-[#bfc0cb]">All-account model activity</p><p className="mt-1 text-[10px] text-[#7f8190]">Every model used by at least one TokenForge account. Bars compare successful request totals.</p></div><p className="shrink-0 font-mono text-[9px] text-[#77798b]">Accounts · requests · tokens</p></div>
      <AllAccountModelUsageChart usage={modelUsage} loading={loading} />
    </div>
  </div>;
}

function EmailProviderChart({ providers, loading }: { providers: { provider: string; accountCount: number }[]; loading: boolean }) {
  if (loading) return <div className="grid h-52 place-items-center" aria-label="Loading email provider distribution"><Loader2 className="animate-spin text-[#c9ff73]" size={18} /></div>;
  if (!providers.length) return <div className="grid h-52 place-items-center px-5 text-center text-xs leading-5 text-[#9091a3]">Email-provider counts will appear after the first account with an email address is registered.</div>;
  const maximum = Math.max(1, ...providers.map(item => item.accountCount));
  return <div className="space-y-3" role="img" aria-label={`Email provider distribution: ${providers.map(item => `${item.provider}, ${item.accountCount} accounts`).join("; ")}`}>
    {providers.map(item => <div className="grid grid-cols-[minmax(5rem,.55fr)_minmax(0,1.45fr)_2.25rem] items-center gap-2 sm:grid-cols-[8rem_minmax(0,1fr)_3rem]" key={item.provider}>
      <span className="truncate font-mono text-[10px] font-semibold text-[#d9d8e1]" title={item.provider}>{item.provider}</span>
      <div className="h-6 overflow-hidden rounded-md border border-white/8 bg-black/20" aria-hidden="true"><div className="h-full min-w-1 rounded-md bg-gradient-to-r from-[#5f9f29] via-[#92d43c] to-[#c9ff73] transition-[width] duration-200 ease-out" style={{ width: `${Math.max(3, item.accountCount / maximum * 100)}%` }} /></div>
      <span className="text-right font-mono text-[10px] font-bold tabular-nums text-[#c9ff73]">{item.accountCount}</span>
    </div>)}
  </div>;
}

const modelNameById = new Map(TOKENFORGE_MODELS.map(model => [model.id, model.name]));

function AccountModelUsageChart({ usage, loading }: { usage: AdminAccountModelUsage[]; loading: boolean }) {
  if (loading) return <div className="grid h-28 place-items-center" aria-label="Loading account model usage"><Loader2 className="animate-spin text-[#c9ff73]" size={16} /></div>;
  if (!usage.length) return <div className="grid min-h-24 place-items-center rounded-lg border border-dashed border-white/10 px-4 text-center text-[10px] leading-5 text-[#858697]">No model requests have been recorded for this account. Models appear after API-key or Playground activity.</div>;
  const maximum = Math.max(1, ...usage.map(item => item.requestCount));
  return <div className="space-y-2.5" role="img" aria-label={`Model usage: ${usage.map(item => `${modelNameById.get(item.modelId) ?? item.modelId}, ${item.requestCount} requests, ${item.totalTokens} tokens`).join("; ")}`}>
    {usage.map(item => <div className="grid grid-cols-[minmax(5.5rem,.7fr)_minmax(0,1.3fr)_auto] items-center gap-2 sm:grid-cols-[9rem_minmax(0,1fr)_7.25rem]" key={item.modelId}>
      <div className="min-w-0"><p className="truncate font-mono text-[10px] font-semibold text-[#e2e2ea]" title={item.modelId}>{modelNameById.get(item.modelId) ?? item.modelId}</p><p className="truncate font-mono text-[9px] text-[#77798b]">{item.modelId}</p></div>
      <div className="h-5 overflow-hidden rounded-md border border-white/8 bg-black/25" aria-hidden="true"><div className="h-full min-w-1 rounded-md bg-gradient-to-r from-[#4c7e22] via-[#82be3d] to-[#c9ff73] transition-[width] duration-200 ease-out" style={{ width: `${Math.max(3, item.requestCount / maximum * 100)}%` }} /></div>
      <p className="text-right font-mono text-[9px] font-bold leading-4 tabular-nums text-[#c9ff73]">{item.requestCount.toLocaleString()} req<br /><span className="font-medium text-[#a7a8b6]">{formatTokens(item.totalTokens)} tok</span></p>
    </div>)}
  </div>;
}

function AllAccountModelUsageChart({ usage, loading }: { usage: AdminGlobalModelUsage[]; loading: boolean }) {
  if (loading) return <div className="grid h-52 place-items-center" aria-label="Loading all-account model activity"><Loader2 className="animate-spin text-[#c9ff73]" size={18} /></div>;
  if (!usage.length) return <div className="grid h-52 place-items-center px-5 text-center text-xs leading-5 text-[#9091a3]">Model bars appear after the first successful request from any TokenForge account.</div>;
  const maximum = Math.max(1, ...usage.map(item => item.requestCount));
  return <div className="space-y-3" role="img" aria-label={`All-account model activity: ${usage.map(item => `${modelNameById.get(item.modelId) ?? item.modelId}, ${item.accountCount} accounts, ${item.requestCount} requests, ${item.totalTokens} tokens`).join("; ")}`}>
    {usage.map(item => <div className="grid grid-cols-[minmax(5.25rem,.65fr)_minmax(0,1.35fr)] gap-x-2 gap-y-1.5 sm:grid-cols-[8rem_minmax(0,1fr)_auto] sm:items-center sm:gap-y-0" key={item.modelId}>
      <div className="min-w-0"><span className="block truncate text-[10px] font-semibold text-[#e4e4ec]" title={item.modelId}>{modelNameById.get(item.modelId) ?? item.modelId}</span><span className="block truncate font-mono text-[9px] text-[#7f8193]">{item.accountCount} account{item.accountCount === 1 ? "" : "s"}</span></div>
      <div className="h-6 overflow-hidden rounded-md border border-white/8 bg-black/20" aria-hidden="true"><div className="h-full min-w-1 rounded-md bg-gradient-to-r from-[#487f2d] via-[#7fc838] to-[#c9ff73] transition-[width] duration-200 ease-out" style={{ width: `${Math.max(3, item.requestCount / maximum * 100)}%` }} /></div>
      <span className="col-span-2 text-right font-mono text-[9px] font-bold tabular-nums text-[#c9ff73] sm:col-span-1 sm:text-[10px]">{item.requestCount.toLocaleString()} req · {formatTokens(item.totalTokens)} tok</span>
    </div>)}
  </div>;
}

function OrcaRouterSlotUsageChart({ usage, loading }: { usage: Array<{ slot: number; requestCount: number }>; loading: boolean }) {
  if (loading) return <div className="grid h-56 place-items-center" aria-label="Loading OrcaRouter credential-slot request totals"><Loader2 className="animate-spin text-[#c9ff73]" size={18} /></div>;
  const slots = Array.from({ length: 15 }, (_, slot) => ({ slot, requestCount: usage.find(item => item.slot === slot)?.requestCount ?? 0 }));
  const totalRequests = slots.reduce((total, item) => total + item.requestCount, 0);
  if (!totalRequests) return <div className="grid min-h-36 place-items-center rounded-xl border border-dashed border-white/10 bg-black/10 px-5 text-center text-[11px] leading-5 text-[#9091a3]">No OrcaRouter requests have been routed through the active pool since the current service start or the most recent credential rotation.</div>;
  const maximum = Math.max(1, ...slots.map(item => item.requestCount));
  return <div className="space-y-2.5" role="img" aria-label={`OrcaRouter credential-slot request totals: ${slots.map(item => `slot ${item.slot + 1}, ${item.requestCount} requests`).join("; ")}`}>
    {slots.map(item => <div className="grid grid-cols-[2.75rem_minmax(0,1fr)_3.25rem] items-center gap-2 sm:grid-cols-[4.5rem_minmax(0,1fr)_4.5rem]" key={item.slot}>
      <span className="font-mono text-[10px] font-semibold text-[#d9d8e1]">S{String(item.slot + 1).padStart(2, "0")}</span>
      <div className="h-5 overflow-hidden rounded-md border border-white/8 bg-black/25" aria-hidden="true"><div className="h-full min-w-1 rounded-md bg-gradient-to-r from-[#4c7e22] via-[#82be3d] to-[#c9ff73] transition-[width] duration-200 ease-out" style={{ width: `${Math.max(3, item.requestCount / maximum * 100)}%` }} /></div>
      <span className="text-right font-mono text-[10px] font-bold tabular-nums text-[#c9ff73]">{item.requestCount.toLocaleString()}</span>
    </div>)}
  </div>;
}

function AuditTimeline({ events, onExport, exporting }: { events: AdminAuditRecord[]; onExport: () => void; exporting: boolean }) {
  return <section className="dashboard-card"><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><SectionHeader icon={<Activity size={17} />} title="Administrator activity" detail="Operational actions only. Timeline and export exclude API keys, credentials, names, emails, and audit metadata." /><Button size="sm" variant="outline" className="border-white/12 text-xs text-[#d9d8e1] hover:bg-white/10" onClick={onExport} disabled={exporting}><Download size={14} />{exporting ? "Preparing…" : "Download CSV"}</Button></div><div className="mt-5 space-y-1">{events.length ? events.map(event => <div key={event.id} className="flex items-center justify-between gap-3 rounded-lg border border-white/7 bg-black/10 px-3 py-2.5"><div className="min-w-0"><p className="truncate text-xs font-semibold text-white">{event.action.replaceAll(".", " · ")}</p><p className="mt-1 truncate font-mono text-[10px] text-[#8f90a2]">{event.entityType}{event.entityId ? ` · ${event.entityId}` : ""}</p></div><time className="shrink-0 text-right text-[10px] text-[#858697]" dateTime={new Date(event.createdAt).toISOString()}>{new Date(event.createdAt).toLocaleString()}</time></div>) : <p className="py-10 text-center text-xs text-[#8f90a2]">No administrator activity has been recorded yet.</p>}</div></section>;
}

function downloadAuditCsv(exportData: { columns: string[]; rows: string[][] }) {
  const encode = (value: string) => {
    const protectedValue = /^[=+\-@]/.test(value) ? `'${value}` : value;
    return `"${protectedValue.replaceAll('"', '""')}"`;
  };
  const csv = [exportData.columns, ...exportData.rows].map(row => row.map(encode).join(",")).join("\n");
  const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `tokenforge-admin-audit-${new Date().toISOString().slice(0, 10)}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}

function OrcaRouterCredentialPanel() {
  const utils = trpc.useUtils();
  const credentials = trpc.admin.orcaRouterCredentials.useQuery(undefined, { refetchInterval: 15_000 });
  const slotUsage = trpc.admin.orcaRouterSlotUsage.useQuery(undefined, { refetchInterval: 15_000 });
  const maintenance = trpc.admin.platformMaintenance.useQuery(undefined, { refetchInterval: 15_000 });
  const unverifiedCleanup = trpc.admin.discordUnverifiedAccountCleanup.useQuery(undefined, { refetchInterval: 15_000 });
  const slotNumbers = Array.from({ length: 15 }, (_, index) => index);
  const [values, setValues] = useState<string[]>(() => Array.from({ length: 15 }, () => ""));
  const [confirmation, setConfirmation] = useState("");
  const [confirmationOpen, setConfirmationOpen] = useState(false);
  const [cleanupOpen, setCleanupOpen] = useState(false);
  const [cleanupConfirmation, setCleanupConfirmation] = useState("");
  const phrase = "ROTATE ORCAROUTER CREDENTIALS";
  const cleanupCount = unverifiedCleanup.data?.count ?? 0;
  const cleanupPhrase = `DELETE ${cleanupCount} UNVERIFIED DISCORD ACCOUNTS`;
  const normalizedValues = values.map(value => value.trim());
  const canSubmit = normalizedValues.every(value => value.length >= 20);
  const rotate = trpc.admin.replaceOrcaRouterCredentials.useMutation({
    onSuccess: async () => {
      setValues(Array.from({ length: 15 }, () => ""));
      setConfirmation("");
      setConfirmationOpen(false);
      await Promise.all([utils.admin.orcaRouterCredentials.invalidate(), utils.admin.overview.invalidate(), utils.admin.activity.invalidate()]);
      toast.success("Fifteen OrcaRouter credential slots validated and activated");
    },
    onError: error => toast.error(error.message),
  });
  const setMaintenance = trpc.admin.setPlatformMaintenance.useMutation({
    onSuccess: async result => {
      await Promise.all([utils.admin.platformMaintenance.invalidate(), utils.admin.activity.invalidate()]);
      toast.success(result.enabled ? "Global inference maintenance is enabled" : "Global inference maintenance is disabled");
    },
    onError: error => toast.error(error.message),
  });
  const deleteUnverified = trpc.admin.deleteDiscordUnverifiedAccounts.useMutation({
    onSuccess: async result => {
      setCleanupOpen(false);
      setCleanupConfirmation("");
      await Promise.all([utils.admin.discordUnverifiedAccountCleanup.invalidate(), utils.admin.accounts.invalidate(), utils.admin.overview.invalidate(), utils.admin.activity.invalidate()]);
      toast.success(result.deletedCount ? `${result.deletedCount} Discord-unverified account${result.deletedCount === 1 ? "" : "s"} permanently deleted` : "No Discord-unverified accounts required cleanup");
    },
    onError: error => toast.error(error.message),
  });
  const slots = credentials.data?.slots ?? [];
  const source = credentials.data?.source;
  const updateValue = (slot: number, value: string) => setValues(current => current.map((item, index) => index === slot ? value : item));

  return <section className="dashboard-card"><SectionHeader icon={<KeyRound size={17} />} title="OrcaRouter credential pool" detail="Fifteen encrypted server-side slots are validated before an atomic rotation. Claude Opus 5 and Qwen3.8 27B use healthy slots in round-robin order with automatic failover." />
    <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{slotNumbers.map(slot => {
      const saved = slots.find(item => item.slot === slot);
      return <div key={slot} className="rounded-xl border border-white/8 bg-black/15 p-4"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold text-white">Credential slot {slot + 1}</p><p className="mt-1 font-mono text-[10px] text-[#858697]">{saved ? `Stored · •••${saved.fingerprintSuffix}` : source === "environment" && slot === 0 ? "Legacy environment fallback" : "Awaiting managed key"}</p></div><Badge className={`border-0 text-[10px] ${saved ? "bg-[#c9ff73]/10 text-[#c9ff73]" : "bg-white/6 text-[#9fa0ad]"}`}>{saved ? "Configured" : "Empty"}</Badge></div><label className="mt-5 block text-[10px] font-bold uppercase tracking-[.12em] text-[#9b9ca9]" htmlFor={`orca-router-key-${slot}`}>Replacement key</label><Input id={`orca-router-key-${slot}`} value={values[slot]} onChange={event => updateValue(slot, event.target.value)} type="password" autoComplete="new-password" spellCheck={false} placeholder="Paste a complete key" className="mt-2 h-10 border-white/10 bg-black/20 font-mono text-xs text-white placeholder:text-[#696b78]" disabled={rotate.isPending} /><p className="mt-2 min-h-4 text-[10px] text-[#7f8190]">{values[slot].trim() ? "Ready to validate; never displayed after save." : "All fifteen fields are required for rotation."}</p></div>;
    })}</div>
    <div className="mt-5 rounded-xl border border-white/8 bg-black/15 p-4 sm:p-5"><div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[.13em] text-[#bfc0cb]">Per-slot routed requests</p><p className="mt-1 text-[10px] leading-5 text-[#7f8190]">Anonymous current-runtime totals for the active pool. Slots show routing attempts only; no credential, account, or prompt data is retained here.</p></div><p className="shrink-0 font-mono text-[9px] text-[#77798b]">Resets on rotation or restart</p></div><OrcaRouterSlotUsageChart usage={slotUsage.data ?? []} loading={slotUsage.isLoading} /></div>
    <div className="mt-5 flex flex-col gap-4 rounded-xl border border-[#c9ff73]/15 bg-[#c9ff73]/[.045] p-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-xs font-bold text-[#e4f5c8]">Atomic fifteen-slot rotation</p><p className="mt-1 max-w-2xl text-[10px] leading-5 text-[#a7aa9a]">The server probes every submitted key before replacing the pool. If any validation fails, the current pool remains active. Plaintext keys are encrypted at rest, omitted from logs and audits, and cleared from this page after activation.</p></div><AlertDialog open={confirmationOpen} onOpenChange={setConfirmationOpen}><AlertDialogTrigger asChild><Button type="button" disabled={!canSubmit || rotate.isPending} className="shrink-0 bg-[#c9ff73] text-[#17210d] hover:bg-[#d8ff91]">{rotate.isPending ? <><Loader2 className="animate-spin" size={14} />Validating…</> : "Validate & rotate"}</Button></AlertDialogTrigger><AlertDialogContent className="border-white/10 bg-[#171820] text-white"><AlertDialogHeader><AlertDialogTitle>Activate all fifteen OrcaRouter keys?</AlertDialogTitle><AlertDialogDescription className="text-[#a1a2b2]">Each key will be checked server-side. A successful rotation replaces the managed pool atomically and starts a new round-robin cycle for Claude Opus 5 and Qwen3.8 27B.</AlertDialogDescription></AlertDialogHeader><label className="block text-xs font-semibold text-[#d9d8e1]" htmlFor="orca-credential-confirmation">Type <span className="font-mono text-[#c9ff73]">{phrase}</span> to confirm</label><Input id="orca-credential-confirmation" value={confirmation} onChange={event => setConfirmation(event.target.value)} autoComplete="off" className="border-white/10 bg-black/20 text-white" /><AlertDialogFooter><AlertDialogCancel className="border-white/12 bg-transparent text-[#d9d8e1] hover:bg-white/10 hover:text-white" disabled={rotate.isPending}>Cancel</AlertDialogCancel><AlertDialogAction disabled={confirmation !== phrase || rotate.isPending} onClick={() => rotate.mutate({ credentials: normalizedValues })} className="bg-[#c9ff73] text-[#17210d] hover:bg-[#d8ff91]">Confirm rotation</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog></div>
    <p className="mt-3 text-[10px] leading-5 text-[#858697]">Current source: <span className="font-mono text-[#c6c7d2]">{source === "database" ? "managed encrypted pool" : source === "environment" ? "legacy environment fallback" : "not configured"}</span>. Only anonymous slot status and a non-reversible fingerprint suffix are visible.</p>
    <div className="mt-6 grid gap-4 border-t border-white/8 pt-6 xl:grid-cols-2">
      <div className={`rounded-xl border p-4 ${maintenance.data?.enabled ? "border-red-300/30 bg-red-400/[.06]" : "border-white/8 bg-black/15"}`}><div className="flex items-start justify-between gap-4"><div><p className="text-xs font-bold text-white">Global inference maintenance</p><p className="mt-1 text-[10px] leading-5 text-[#9fa0ad]">Blocks every user Playground, OpenAI-compatible, and Anthropic-compatible request before quota, credits, or provider work. Administrator controls remain available.</p></div><Toggle label="Global inference maintenance" enabled={Boolean(maintenance.data?.enabled)} pending={maintenance.isLoading || setMaintenance.isPending} onChange={enabled => setMaintenance.mutate({ enabled })} /></div><p className={`mt-3 text-[10px] font-semibold ${maintenance.data?.enabled ? "text-red-300" : "text-[#c9ff73]"}`}>{maintenance.data?.enabled ? "Maintenance active — user inference is paused." : "Inference active — users can make requests."}</p></div>
      <div className="rounded-xl border border-red-400/25 bg-red-400/[.045] p-4"><p className="text-xs font-bold text-red-200">Discord-unverified account cleanup</p><p className="mt-1 text-[10px] leading-5 text-[#b9a1a8]">{cleanupCount.toLocaleString()} regular account{cleanupCount === 1 ? "" : "s"} lack Discord verification. This permanently removes their TokenForge data without blocking later fresh signup. A local sign-in shows a one-time explanation after cleanup.</p><AlertDialog open={cleanupOpen} onOpenChange={open => { setCleanupOpen(open); if (!open) setCleanupConfirmation(""); }}><AlertDialogTrigger asChild><Button type="button" size="sm" variant="outline" className="mt-4 border-red-400/30 text-red-200 hover:bg-red-400/10 hover:text-red-100" disabled={!cleanupCount || unverifiedCleanup.isLoading || deleteUnverified.isPending}>Review & delete {cleanupCount.toLocaleString()}</Button></AlertDialogTrigger><AlertDialogContent className="border-red-400/20 bg-[#171820] text-white"><AlertDialogHeader><AlertDialogTitle>Permanently delete {cleanupCount.toLocaleString()} Discord-unverified accounts?</AlertDialogTitle><AlertDialogDescription className="text-[#a1a2b2]">This removes selected account data, API keys, usage, credits, and sessions. These email addresses are not blocked, and the server rechecks the displayed count before deletion.</AlertDialogDescription></AlertDialogHeader><label className="block text-xs font-semibold text-[#d9d8e1]" htmlFor="discord-unverified-cleanup-confirmation">Type <span className="font-mono text-red-200">{cleanupPhrase}</span> to confirm</label><Input id="discord-unverified-cleanup-confirmation" value={cleanupConfirmation} onChange={event => setCleanupConfirmation(event.target.value)} autoComplete="off" className="border-red-400/20 bg-black/20 font-mono text-xs text-white" disabled={deleteUnverified.isPending} /><AlertDialogFooter><AlertDialogCancel className="border-white/12 bg-transparent text-[#d9d8e1] hover:bg-white/10 hover:text-white" disabled={deleteUnverified.isPending}>Cancel</AlertDialogCancel><AlertDialogAction disabled={cleanupConfirmation.trim() !== cleanupPhrase || deleteUnverified.isPending} onClick={() => deleteUnverified.mutate({ expectedCount: cleanupCount, confirmation: cleanupConfirmation.trim() })} className="bg-red-300 text-[#3a1219] hover:bg-red-200">Delete {cleanupCount.toLocaleString()} accounts</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog></div>
    </div>
  </section>;
}

function OperationalControls() {
  const utils = trpc.useUtils();
  const maintenance = trpc.admin.platformMaintenance.useQuery(undefined, { refetchInterval: 15_000 });
  const unverifiedCleanup = trpc.admin.discordUnverifiedAccountCleanup.useQuery(undefined, { refetchInterval: 15_000 });
  const giveawayRecipients = trpc.admin.discordVerifiedGiveawayRecipients.useQuery(undefined, { refetchInterval: 15_000 });
  const giveawayHistory = trpc.admin.giveawayHistory.useQuery();
  const [cleanupOpen, setCleanupOpen] = useState(false);
  const [cleanupConfirmation, setCleanupConfirmation] = useState("");
  const [giveawayOpen, setGiveawayOpen] = useState(false);
  const [giveawayAmount, setGiveawayAmount] = useState("");
  const [giveawayAnnouncement, setGiveawayAnnouncement] = useState("");
  const [giveawayConfirmation, setGiveawayConfirmation] = useState("");
  const cleanupCount = unverifiedCleanup.data?.count ?? 0;
  const cleanupPhrase = `DELETE ${cleanupCount} UNVERIFIED DISCORD ACCOUNTS`;
  const giveawayRecipientCount = giveawayRecipients.data?.count ?? 0;
  const parsedGiveawayAmount = Number(giveawayAmount);
  const isValidGiveawayAmount = Number.isFinite(parsedGiveawayAmount) && parsedGiveawayAmount > 0 && parsedGiveawayAmount <= 100_000 && Math.round(parsedGiveawayAmount * 100) === parsedGiveawayAmount * 100;
  const giveawayPhrase = isValidGiveawayAmount ? `GIVE $${parsedGiveawayAmount.toFixed(2)} TO ${giveawayRecipientCount} VERIFIED ACCOUNTS` : "";
  const setMaintenance = trpc.admin.setPlatformMaintenance.useMutation({
    onSuccess: async result => {
      await Promise.all([utils.admin.platformMaintenance.invalidate(), utils.admin.activity.invalidate()]);
      toast.success(result.enabled ? "Global inference maintenance is enabled" : "Global inference maintenance is disabled");
    },
    onError: error => toast.error(error.message),
  });
  const deleteUnverified = trpc.admin.deleteDiscordUnverifiedAccounts.useMutation({
    onSuccess: async result => {
      setCleanupOpen(false);
      setCleanupConfirmation("");
      await Promise.all([utils.admin.discordUnverifiedAccountCleanup.invalidate(), utils.admin.accounts.invalidate(), utils.admin.overview.invalidate(), utils.admin.activity.invalidate()]);
      toast.success(result.deletedCount ? `${result.deletedCount} Discord-unverified account${result.deletedCount === 1 ? "" : "s"} permanently deleted` : "No Discord-unverified accounts required cleanup");
    },
    onError: error => toast.error(error.message),
  });
  const runGiveaway = trpc.admin.giveDiscordVerifiedAccountsCredit.useMutation({
    onSuccess: async result => {
      setGiveawayOpen(false);
      setGiveawayAmount("");
      setGiveawayAnnouncement("");
      setGiveawayConfirmation("");
      await Promise.all([utils.admin.discordVerifiedGiveawayRecipients.invalidate(), utils.admin.giveawayHistory.invalidate(), utils.admin.accounts.invalidate(), utils.admin.overview.invalidate(), utils.admin.activity.invalidate()]);
      toast.success(`${formatCredits(result.amountNanos)} credited to ${result.recipientCount.toLocaleString()} Discord-verified account${result.recipientCount === 1 ? "" : "s"} 🎉`);
    },
    onError: error => toast.error(error.message),
  });
  return <section className="dashboard-card"><SectionHeader icon={<ShieldAlert size={17} />} title="Platform operations" detail="Global inference control, verified-member rewards, and account-safety actions. Provider credentials are managed only as encrypted server configuration and are not displayed in this console." /><div className="mt-5 grid gap-4 xl:grid-cols-3">
    <div className={`rounded-xl border p-4 ${maintenance.data?.enabled ? "border-red-300/30 bg-red-400/[.06]" : "border-white/8 bg-black/15"}`}><div className="flex items-start justify-between gap-4"><div><p className="text-xs font-bold text-white">Global inference maintenance</p><p className="mt-1 text-[10px] leading-5 text-[#9fa0ad]">Blocks every user Playground, OpenAI-compatible, and Anthropic-compatible request before quota, credits, or provider work. Administrator controls remain available.</p></div><Toggle label="Global inference maintenance" enabled={Boolean(maintenance.data?.enabled)} pending={maintenance.isLoading || setMaintenance.isPending} onChange={enabled => setMaintenance.mutate({ enabled })} /></div><p className={`mt-3 text-[10px] font-semibold ${maintenance.data?.enabled ? "text-red-300" : "text-[#c9ff73]"}`}>{maintenance.data?.enabled ? "Maintenance active — user inference is paused." : "Inference active — users can make requests."}</p></div>
    <div className="rounded-xl border border-red-400/25 bg-red-400/[.045] p-4"><p className="text-xs font-bold text-red-200">Discord-unverified account cleanup</p><p className="mt-1 text-[10px] leading-5 text-[#b9a1a8]">{cleanupCount.toLocaleString()} regular account{cleanupCount === 1 ? "" : "s"} lack Discord verification. This permanently removes their TokenForge data without blocking later fresh signup. A local sign-in shows a one-time explanation after cleanup.</p><AlertDialog open={cleanupOpen} onOpenChange={open => { setCleanupOpen(open); if (!open) setCleanupConfirmation(""); }}><AlertDialogTrigger asChild><Button type="button" size="sm" variant="outline" className="mt-4 border-red-400/30 text-red-200 hover:bg-red-400/10 hover:text-red-100" disabled={!cleanupCount || unverifiedCleanup.isLoading || deleteUnverified.isPending}>Review & delete {cleanupCount.toLocaleString()}</Button></AlertDialogTrigger><AlertDialogContent className="border-red-400/20 bg-[#171820] text-white"><AlertDialogHeader><AlertDialogTitle>Permanently delete {cleanupCount.toLocaleString()} Discord-unverified accounts?</AlertDialogTitle><AlertDialogDescription className="text-[#a1a2b2]">This removes selected account data, API keys, usage, credits, and sessions. These email addresses are not blocked, and the server rechecks the displayed count before deletion.</AlertDialogDescription></AlertDialogHeader><label className="block text-xs font-semibold text-[#d9d8e1]" htmlFor="discord-unverified-cleanup-confirmation">Type <span className="font-mono text-red-200">{cleanupPhrase}</span> to confirm</label><Input id="discord-unverified-cleanup-confirmation" value={cleanupConfirmation} onChange={event => setCleanupConfirmation(event.target.value)} autoComplete="off" className="border-red-400/20 bg-black/20 font-mono text-xs text-white" disabled={deleteUnverified.isPending} /><AlertDialogFooter><AlertDialogCancel className="border-white/12 bg-transparent text-[#d9d8e1] hover:bg-white/10 hover:text-white" disabled={deleteUnverified.isPending}>Cancel</AlertDialogCancel><AlertDialogAction disabled={cleanupConfirmation.trim() !== cleanupPhrase || deleteUnverified.isPending} onClick={() => deleteUnverified.mutate({ expectedCount: cleanupCount, confirmation: cleanupConfirmation.trim() })} className="bg-red-300 text-[#3a1219] hover:bg-red-200">Delete {cleanupCount.toLocaleString()} accounts</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog></div>
    <div className="rounded-xl border border-[#c9ff73]/25 bg-[#c9ff73]/[.045] p-4"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold text-[#e4f5c8]">Discord-verified giveaway</p><p className="mt-1 text-[10px] leading-5 text-[#a7aa9a]">Credit one USD amount to every currently Discord-verified regular account. Each recipient receives a visible wallet entry; the recipient set is rechecked before any credit is applied.</p></div><Badge className="shrink-0 border-0 bg-[#c9ff73]/10 text-[10px] text-[#c9ff73]">{giveawayRecipients.isLoading ? "Checking…" : `${giveawayRecipientCount.toLocaleString()} eligible`}</Badge></div><div className="mt-4 flex gap-2"><Input aria-label="Giveaway amount in USD" type="number" min="0.01" max="100000" step="0.01" inputMode="decimal" value={giveawayAmount} onChange={event => setGiveawayAmount(event.target.value)} placeholder="Amount per account" className="h-9 min-w-0 border-[#c9ff73]/20 bg-black/15 px-2 text-xs text-white placeholder:text-[#767886]" disabled={runGiveaway.isPending} /><AlertDialog open={giveawayOpen} onOpenChange={open => { setGiveawayOpen(open); if (!open) setGiveawayConfirmation(""); }}><AlertDialogTrigger asChild><Button type="button" size="sm" className="h-9 shrink-0 bg-[#c9ff73] text-[#17210d] hover:bg-[#d8ff91]" disabled={!isValidGiveawayAmount || !giveawayRecipientCount || giveawayRecipients.isLoading || runGiveaway.isPending}><WalletCards size={14} />Review</Button></AlertDialogTrigger><AlertDialogContent className="border-[#c9ff73]/25 bg-[#171820] text-white"><AlertDialogHeader><AlertDialogTitle>Credit every Discord-verified account?</AlertDialogTitle><AlertDialogDescription className="text-[#a1a2b2]">This adds <span className="font-semibold text-[#e4f5c8]">${isValidGiveawayAmount ? parsedGiveawayAmount.toFixed(2) : "0.00"}</span> to each of the currently reviewed <span className="font-semibold text-[#e4f5c8]">{giveawayRecipientCount.toLocaleString()}</span> verified account{giveawayRecipientCount === 1 ? "" : "s"}, for a total allocation of <span className="font-semibold text-[#e4f5c8]">${isValidGiveawayAmount ? (parsedGiveawayAmount * giveawayRecipientCount).toFixed(2) : "0.00"}</span>. Repeating a giveaway creates an additional credit grant.</AlertDialogDescription></AlertDialogHeader><div className="space-y-2"><label className="block text-xs font-semibold text-[#d9d8e1]" htmlFor="discord-verified-giveaway-note">Recipient announcement <span className="font-normal text-[#898b99]">(optional)</span></label><Textarea id="discord-verified-giveaway-note" value={giveawayAnnouncement} onChange={event => setGiveawayAnnouncement(event.target.value)} maxLength={256} placeholder="Example: Thank you for being a verified TokenForge Discord member." className="min-h-20 border-[#c9ff73]/20 bg-black/20 text-xs text-white placeholder:text-[#767886]" disabled={runGiveaway.isPending} /><p className="text-[10px] text-[#898b99]">Shown only in each recipient’s wallet activity.</p></div><label className="block text-xs font-semibold text-[#d9d8e1]" htmlFor="discord-verified-giveaway-confirmation">Type <span className="font-mono text-[#c9ff73]">{giveawayPhrase}</span> to confirm</label><Input id="discord-verified-giveaway-confirmation" value={giveawayConfirmation} onChange={event => setGiveawayConfirmation(event.target.value)} placeholder={giveawayPhrase} autoComplete="off" className="border-[#c9ff73]/20 bg-black/20 font-mono text-xs text-white" disabled={runGiveaway.isPending} /><AlertDialogFooter><AlertDialogCancel className="border-white/12 bg-transparent text-[#d9d8e1] hover:bg-white/10 hover:text-white" disabled={runGiveaway.isPending}>Cancel</AlertDialogCancel><AlertDialogAction disabled={giveawayConfirmation.trim() !== giveawayPhrase || runGiveaway.isPending} onClick={() => runGiveaway.mutate({ amountUsd: parsedGiveawayAmount, announcementNote: giveawayAnnouncement.trim() || undefined, expectedRecipientCount: giveawayRecipientCount, confirmation: giveawayConfirmation.trim() })} className="bg-[#c9ff73] text-[#17210d] hover:bg-[#d8ff91]">{runGiveaway.isPending ? <><Loader2 className="animate-spin" size={14} />Crediting…</> : "Credit verified accounts"}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog></div><p className="mt-3 text-[10px] text-[#909982]">The amount is per eligible account. Only completed Discord verification qualifies.</p></div>
  </div>
  <div className="mt-5 border-t border-white/8 pt-5">
    <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold text-white">Giveaway history</p><p className="mt-1 text-[10px] text-[#8f90a2]">Completed administrator grants, including the amount, recipient count, and recipient-facing announcement.</p></div><Badge className="border-0 bg-white/6 text-[10px] text-[#b9bac8]">{giveawayHistory.isLoading ? "Loading…" : `${giveawayHistory.data?.length ?? 0} recorded`}</Badge></div>
    <div className="mt-3 max-h-72 space-y-2 overflow-y-auto pr-1">{giveawayHistory.isLoading ? <div className="grid h-20 place-items-center"><Loader2 className="animate-spin text-[#c9ff73]" size={16} /></div> : giveawayHistory.data?.length ? giveawayHistory.data.map(giveaway => <div key={giveaway.id} className="rounded-xl border border-white/8 bg-black/15 p-3"><div className="flex flex-wrap items-start justify-between gap-2"><div><p className="text-xs font-semibold text-[#e4f5c8]">{formatCredits(giveaway.amountNanos)} per verified account</p><p className="mt-1 text-[10px] text-[#9193a1]">{giveaway.recipientCount.toLocaleString()} recipient{giveaway.recipientCount === 1 ? "" : "s"} · {formatCredits(giveaway.totalAmountNanos)} allocated</p></div><time className="text-[10px] text-[#858697]" dateTime={new Date(giveaway.createdAt).toISOString()}>{new Date(giveaway.createdAt).toLocaleString()}</time></div>{giveaway.announcementNote && <p className="mt-3 border-t border-white/8 pt-3 text-[11px] leading-5 text-[#d8d9e4]">“{giveaway.announcementNote}”</p>}</div>) : <p className="rounded-xl border border-dashed border-white/10 py-7 text-center text-xs text-[#858697]">No completed giveaways have been recorded yet.</p>}</div>
  </div>
</section>;
}

function AccountRow({ account, activeAdminId, modelUsage, modelUsageLoading }: { account: AdminAccount; activeAdminId: number; modelUsage: AdminAccountModelUsage[]; modelUsageLoading: boolean }) {
  const utils = trpc.useUtils();
  const [creditAmount, setCreditAmount] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [resetVerificationOpen, setResetVerificationOpen] = useState(false);
  const [resetVerificationConfirmation, setResetVerificationConfirmation] = useState("");
  const isCurrentAdmin = account.id === activeAdminId;
  const confirmationPhrase = `DELETE ACCOUNT ${account.id}`;
  const resetVerificationPhrase = `RESET DISCORD VERIFICATION ${account.id}`;
  const control = trpc.admin.setAccountControl.useMutation({ onSuccess: () => { utils.admin.overview.invalidate(); utils.admin.accounts.invalidate(); toast.success("Account access updated"); }, onError: error => toast.error(error.message) });
  const deleteAccount = trpc.admin.deleteAccount.useMutation({
    onSuccess: async () => {
      await Promise.all([utils.admin.overview.invalidate(), utils.admin.accounts.invalidate()]);
      toast.success("Account and associated TokenForge data permanently deleted");
    },
    onError: error => toast.error(error.message),
  });
  const addCredit = trpc.admin.addAccountCredit.useMutation({
    onSuccess: async result => {
      setCreditAmount("");
      await Promise.all([utils.admin.overview.invalidate(), utils.admin.accounts.invalidate(), utils.admin.activity.invalidate()]);
      toast.success(`${formatCredits(result.amountNanos)} added; balance is now ${formatCredits(result.balanceNanos)}`);
    },
    onError: error => toast.error(error.message),
  });
  const resetDiscordVerification = trpc.admin.resetDiscordVerification.useMutation({
    onSuccess: async result => {
      setResetVerificationOpen(false);
      setResetVerificationConfirmation("");
      await Promise.all([utils.admin.overview.invalidate(), utils.admin.accounts.invalidate(), utils.admin.activity.invalidate()]);
      toast.success(result.reset ? "Discord verification reset; the member must verify again" : "This account already requires Discord verification");
    },
    onError: error => toast.error(error.message),
  });
  const activity = account.lastActivityAt ? new Date(account.lastActivityAt).toLocaleDateString() : "No activity";

  return <div data-admin-account-row className="grid gap-3 border-t border-white/8 py-4 xl:grid-cols-[1.1fr_.75fr_.95fr_auto] xl:items-center">
    <div className="min-w-0"><p className="truncate text-xs font-bold text-white">{account.name || "Unnamed account"}</p><p className="mt-1 truncate text-[10px] text-[#8f90a2]">{account.email || "No email available"}</p><div className="mt-2 flex flex-wrap gap-1"><Badge className="border-0 bg-white/6 text-[10px] text-[#c9c8d2]">Standard account</Badge><Badge className={`border-0 text-[10px] ${account.discordVerifiedAt ? "bg-[#c9ff73]/10 text-[#c9ff73]" : "bg-[#f0c180]/10 text-[#f0c180]"}`}>{account.discordVerifiedAt ? "Discord verified" : "Discord re-verification required"}</Badge>{account.suspicious && <Badge className="border-0 bg-[#f0c180]/10 text-[10px] text-[#f0c180]">flagged</Badge>}{account.suspended && <Badge className="border-0 bg-red-400/10 text-[10px] text-red-300">suspended</Badge>}{isCurrentAdmin && <Badge className="border-0 bg-[#c9ff73]/10 text-[10px] text-[#c9ff73]">current admin</Badge>}</div></div>
    <div><p className="text-[10px] uppercase tracking-[.12em] text-[#77798b]">Live credit</p><p className="mt-1 text-sm font-bold text-[#c9ff73]">{formatCredits(account.balanceNanos)}</p><p className="mt-1.5 text-[10px] text-[#8f90a2]">Lifetime spent <span className="font-mono font-semibold tabular-nums text-[#e2e2ea]">{formatCredits(account.lifetimeSpendNanos)}</span></p><div className="mt-2 flex gap-1"><Input aria-label="Credit amount in USD" type="number" min="0.01" step="0.01" inputMode="decimal" value={creditAmount} onChange={event => setCreditAmount(event.target.value)} placeholder="$ amount" className="h-8 min-w-0 border-[#c9ff73]/20 bg-black/15 px-2 text-[10px]" disabled={isCurrentAdmin || addCredit.isPending} /><Button size="sm" className="h-8 shrink-0 bg-[#c9ff73] px-2 text-[10px] text-[#17210d] hover:bg-[#d8ff91]" disabled={isCurrentAdmin || addCredit.isPending || !(Number(creditAmount) > 0)} onClick={() => addCredit.mutate({ userId: account.id, amountUsd: Number(creditAmount) })}>{addCredit.isPending ? "…" : "Add"}</Button><Button size="sm" variant="outline" aria-label="Permanently delete account now" title="Permanently delete this account and all associated TokenForge data" className="h-8 shrink-0 border-red-400/20 px-2 text-red-300 hover:bg-red-400/10 hover:text-red-200" disabled={isCurrentAdmin || deleteAccount.isPending} onClick={() => deleteAccount.mutate({ userId: account.id })}><Trash2 size={13} /></Button></div></div>
    <div><p className="text-[10px] uppercase tracking-[.12em] text-[#77798b]">Lifetime successful usage</p><p className="mt-1 text-sm font-bold text-white">{formatTokens(account.totalTokens)}</p><p className="mt-0.5 text-[10px] text-[#8f90a2]">{account.requestCount.toLocaleString()} requests · {activity}</p></div>
    <div className="flex flex-wrap gap-1"><Button size="sm" variant="outline" aria-label={account.suspended ? "Restore account access" : "Suspend account access"} className={`h-8 border-white/12 px-2 ${account.suspended ? "text-[#8aefc0]" : "text-[#f0a2a9]"} hover:bg-white/10`} disabled={control.isPending || isCurrentAdmin} onClick={() => control.mutate({ userId: account.id, isSuspended: !account.suspended })}><Power size={13} /></Button><AlertDialog open={resetVerificationOpen} onOpenChange={open => { setResetVerificationOpen(open); if (!open) setResetVerificationConfirmation(""); }}><AlertDialogTrigger asChild><Button size="sm" variant="outline" aria-label="Reset Discord verification" title={account.discordVerifiedAt ? "Require Discord membership verification again" : "This account already requires Discord verification"} className="h-8 border-[#c9ff73]/20 px-2 text-[#c9ff73] hover:bg-[#c9ff73]/10" disabled={isCurrentAdmin || !account.discordVerifiedAt || resetDiscordVerification.isPending}><RefreshCw size={13} /></Button></AlertDialogTrigger><AlertDialogContent className="border-white/10 bg-[#171820] text-white"><AlertDialogHeader><AlertDialogTitle>Require Discord verification again?</AlertDialogTitle><AlertDialogDescription className="text-[#a1a2b2]">This clears only the account’s membership-verification timestamp. On the next protected dashboard request, the member must complete the existing Discord OAuth and guild-membership check again. TokenForge does not retain a Discord identity or OAuth token.</AlertDialogDescription></AlertDialogHeader><label className="mt-4 block text-xs font-semibold text-[#d9d8e1]" htmlFor={`reset-discord-${account.id}`}>Type <span className="font-mono text-[#c9ff73]">{resetVerificationPhrase}</span> to confirm</label><Input id={`reset-discord-${account.id}`} value={resetVerificationConfirmation} onChange={event => setResetVerificationConfirmation(event.target.value)} placeholder={resetVerificationPhrase} autoComplete="off" className="mt-2 border-[#c9ff73]/20 bg-black/20 font-mono text-xs" disabled={resetDiscordVerification.isPending} /><AlertDialogFooter><AlertDialogCancel className="border-white/12 bg-transparent text-[#d9d8e1] hover:bg-white/10 hover:text-white">Cancel</AlertDialogCancel><Button onClick={() => resetDiscordVerification.mutate({ userId: account.id, confirmation: resetVerificationConfirmation.trim() })} disabled={resetDiscordVerification.isPending || resetVerificationConfirmation.trim() !== resetVerificationPhrase} className="bg-[#c9ff73] text-[#17210d] hover:bg-[#d8ff91]">{resetDiscordVerification.isPending ? "Resetting…" : "Require re-verification"}</Button></AlertDialogFooter></AlertDialogContent></AlertDialog><AlertDialog open={deleteOpen} onOpenChange={open => { setDeleteOpen(open); if (!open) setDeleteConfirmation(""); }}><AlertDialogTrigger asChild><Button size="sm" variant="outline" aria-label="Permanently delete account" className="h-8 border-red-400/20 px-2 text-red-300 hover:bg-red-400/10 hover:text-red-200" disabled={isCurrentAdmin || deleteAccount.isPending}><Trash2 size={13} /></Button></AlertDialogTrigger><AlertDialogContent className="border-white/10 bg-[#171820] text-white"><AlertDialogHeader><AlertDialogTitle>Permanent deletion — step 2 of 2</AlertDialogTitle><AlertDialogDescription className="text-[#a1a2b2]">This removes the account’s API keys, credits, usage, credentials, and identity links. Type <span className="font-mono text-[#f4c1c7]">{confirmationPhrase}</span> exactly to continue. The server checks this phrase before deletion.</AlertDialogDescription></AlertDialogHeader><label className="mt-4 block text-xs font-semibold text-[#d9d8e1]" htmlFor={`delete-account-${account.id}`}>Typed confirmation</label><Input id={`delete-account-${account.id}`} value={deleteConfirmation} onChange={event => setDeleteConfirmation(event.target.value)} placeholder={confirmationPhrase} autoComplete="off" className="mt-2 border-red-400/20 bg-black/20 font-mono text-xs" disabled={deleteAccount.isPending} /><AlertDialogFooter><AlertDialogCancel className="border-white/12 bg-transparent text-[#d9d8e1] hover:bg-white/10 hover:text-white">Cancel</AlertDialogCancel><Button onClick={() => deleteAccount.mutate({ userId: account.id, confirmation: deleteConfirmation.trim() })} disabled={deleteAccount.isPending || deleteConfirmation.trim() !== confirmationPhrase} className="bg-[#ef929b] text-[#271216] hover:bg-[#ffabb2]">{deleteAccount.isPending ? "Deleting…" : "Delete permanently"}</Button></AlertDialogFooter></AlertDialogContent></AlertDialog></div>
    <div className="rounded-xl border border-white/8 bg-black/15 p-3 xl:col-span-4"><div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[.13em] text-[#bfc0cb]">Observed model activity</p><p className="mt-1 text-[10px] text-[#7f8190]">Only this account’s API-key and Playground request events. No prompts or key material are shown.</p></div><p className="shrink-0 font-mono text-[9px] text-[#77798b]">Bars compare request totals</p></div><AccountModelUsageChart usage={modelUsage} loading={modelUsageLoading} /></div>
  </div>;
}

export default function AdminDashboard() {
  const { user, loading } = useAuth();
  const isAdminSession = user?.isAdminSession === true;
  const overview = trpc.admin.overview.useQuery(undefined, {
    enabled: isAdminSession,
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
    retry: 2,
    retryDelay: attempt => Math.min(1_000 * 2 ** attempt, 8_000),
  });
  const flags = trpc.admin.flags.useQuery(undefined, { enabled: isAdminSession, refetchInterval: 15_000 });
  const activityFeed = trpc.admin.activity.useQuery({ limit: 40 }, { enabled: isAdminSession, refetchInterval: 15_000 });
  const auditExport = trpc.admin.auditExport.useQuery(undefined, { enabled: false });
  const announcement = trpc.admin.announcement.useQuery(undefined, { enabled: isAdminSession });
  const utils = trpc.useUtils();
  const [adminPasscode, setAdminPasscode] = useState("");
  const [section, setSection] = useState<"overview" | "accounts" | "controls" | "operations" | "announcement" | "activity">("overview");
  const [announcementText, setAnnouncementText] = useState("");
  const [modelQuery, setModelQuery] = useState("");
  const [accountSearch, setAccountSearch] = useState("");
  const [accountStatus, setAccountStatus] = useState<"all" | "active" | "suspended" | "flagged">("all");
  const [accountSort, setAccountSort] = useState<"latestJoin" | "mostTokens" | "discordVerified" | "mostCredit">("latestJoin");
  const [accountPage, setAccountPage] = useState(1);
  const deferredAccountSearch = useDeferredValue(accountSearch);
  const modelControl = trpc.admin.setModelEnabled.useMutation({ onSuccess: () => { utils.admin.overview.invalidate(); toast.success("Model availability updated"); }, onError: error => toast.error(error.message) });
  const providerControl = trpc.admin.setProviderEnabled.useMutation({ onSuccess: result => { utils.admin.overview.invalidate(); toast.success(result.disabledModels ? `Provider paused; ${result.disabledModels} routed model${result.disabledModels === 1 ? "" : "s"} disabled` : "Provider availability updated"); }, onError: error => toast.error(error.message) });
  const unlockAdmin = trpc.admin.unlock.useMutation({ onSuccess: async () => { setAdminPasscode(""); await utils.auth.me.invalidate(); toast.success("Administrator access activated; other sessions were signed out"); }, onError: error => toast.error(error.message) });
  const signOutAdmin = trpc.admin.signOut.useMutation({ onSuccess: async () => { await utils.auth.me.invalidate(); toast.success("Administrator access revoked for this browser"); }, onError: error => toast.error(error.message) });
  const saveAnnouncement = trpc.admin.setAnnouncement.useMutation({
    onSuccess: async result => {
      setAnnouncementText(result.text ?? "");
      utils.admin.announcement.setData(undefined, result.text);
      await Promise.all([utils.public.announcement.invalidate(), utils.admin.activity.invalidate()]);
      toast.success(result.text ? "Announcement published across TokenForge" : "Announcement cleared from TokenForge");
    },
    onError: error => toast.error(error.message),
  });
  const accounts = (overview.data?.accounts ?? []) as AdminAccount[];
  const accountDirectoryInput = useMemo(() => ({ page: accountPage, pageSize: 10, search: deferredAccountSearch, status: accountStatus, sort: accountSort }), [accountPage, accountSort, accountStatus, deferredAccountSearch]);
  const accountDirectory = trpc.admin.accounts.useQuery(accountDirectoryInput, { enabled: isAdminSession, refetchInterval: 15_000 });
  const accountItems = (accountDirectory.data?.items ?? []) as AdminAccount[];
  const visibleAccountIds = useMemo(() => accountItems.map(account => account.id), [accountItems]);
  const accountModelUsage = trpc.admin.accountModelUsage.useQuery({ userIds: visibleAccountIds.length ? visibleAccountIds : [user?.id ?? 1] }, { enabled: isAdminSession && visibleAccountIds.length > 0, refetchInterval: 15_000 });
  const modelUsageByAccount = useMemo(() => {
    const grouped = new Map<number, AdminAccountModelUsage[]>();
    for (const item of (accountModelUsage.data ?? []) as AdminAccountModelUsage[]) {
      const current = grouped.get(item.userId) ?? [];
      current.push(item);
      grouped.set(item.userId, current);
    }
    return grouped;
  }, [accountModelUsage.data]);
  useEffect(() => { setAccountPage(1); }, [deferredAccountSearch, accountSort, accountStatus]);
  useEffect(() => { if (announcement.data !== undefined) setAnnouncementText(announcement.data ?? ""); }, [announcement.data]);
  const visibleModels = useMemo(() => (overview.data?.models ?? []).filter(model => `${model.displayName} ${model.modelId}`.toLowerCase().includes(modelQuery.trim().toLowerCase())), [modelQuery, overview.data?.models]);
  const totalCredits = accounts.reduce((total, account) => total + account.balanceNanos, 0);
  const providerTelemetry = overview.data?.providerTelemetry ?? [];
  const emailProviders = overview.data?.emailProviders ?? [];
  const telemetryFor = (providerSlug: string) => providerTelemetry.find(provider => provider.providerSlug === providerSlug);
  const downloadAuditExport = async () => {
    const result = await auditExport.refetch();
    if (!result.data) {
      toast.error("Audit export is temporarily unavailable");
      return;
    }
    downloadAuditCsv(result.data);
    toast.success("Privacy-safe audit export downloaded");
  };

  if (loading) {
    return <main className="grid min-h-screen place-items-center bg-[#0b0c10] text-[#c9ff73]"><Loader2 className="animate-spin" size={22} /></main>;
  }

  if (!isAdminSession) {
    return <main className="min-h-screen bg-[#0b0c10] px-4 py-8 text-white sm:py-12"><section className="relative mx-auto flex min-h-[70vh] max-w-xl flex-col justify-center overflow-hidden rounded-3xl border border-white/10 bg-[radial-gradient(circle_at_90%_4%,rgba(201,255,115,.14),transparent_29%),linear-gradient(145deg,#171820,#101116_72%)] p-6 shadow-2xl sm:p-9"><div className="absolute right-[-4rem] top-[-5rem] h-48 w-48 rounded-full border border-[#c9ff73]/15" /><div className="relative"><div className="grid h-11 w-11 place-items-center rounded-xl border border-[#c9ff73]/20 bg-[#b8fb59]/10 text-[#c9ff73]"><KeyRound size={19} /></div><p className="mt-6 text-[10px] font-bold uppercase tracking-[.19em] text-[#c9ff73]">Operations console</p><h1 className="mt-2 text-3xl font-bold tracking-[-.04em]">Unlock control plane</h1><p className="mt-3 max-w-md text-sm leading-6 text-[#a8a9b6]">Administrator access is independent of a TokenForge developer account. Enter the owner passcode to create the only active administrator session; existing sessions are signed out when access is granted.</p><form className="mt-7 rounded-2xl border border-white/10 bg-black/20 p-5 sm:p-6" onSubmit={event => { event.preventDefault(); if (adminPasscode.trim()) unlockAdmin.mutate({ passcode: adminPasscode }); }}><label className="block text-xs font-semibold text-[#d9d8e1]" htmlFor="admin-passcode">Administrator passcode</label><Input id="admin-passcode" type="password" inputMode="numeric" autoComplete="one-time-code" value={adminPasscode} onChange={event => setAdminPasscode(event.target.value)} placeholder="Enter passcode" className="mt-2 h-11 border-white/10 bg-black/20 text-white placeholder:text-[#707184]" disabled={unlockAdmin.isPending} /><Button type="submit" className="mt-4 h-11 w-full bg-[#c9ff73] text-[#17210d] hover:bg-[#d8ff91]" disabled={!adminPasscode.trim() || unlockAdmin.isPending}>{unlockAdmin.isPending ? <><Loader2 className="animate-spin" size={15} /> Verifying access</> : "Unlock administrator access"}</Button><p className="mt-4 text-[11px] leading-5 text-[#858697]">The server verifies and rate-limits passcode attempts. The passcode is never saved in an account profile.</p></form></div></section></main>;
  }

  const metrics = <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5"><Metric icon={<UsersRound size={17} />} label="Accounts" value={(accountDirectory.data?.total ?? accounts.length).toLocaleString()} detail="Searchable live directory" /><Metric icon={<WalletCards size={17} />} label="Credits in wallets" value={formatCredits(totalCredits)} detail="Current visible balances" lime /><Metric icon={<ChartNoAxesCombined size={17} />} label="Total tokens processed" value={formatTokens(overview.data?.totals?.totalTokens ?? 0)} detail="Across every TokenForge account" lime /><Metric icon={<Activity size={17} />} label="Lifetime requests" value={(overview.data?.totals?.totalRequests ?? 0).toLocaleString()} detail="Across all accounts" /><Metric icon={<AlertTriangle size={17} />} label="Safety signals" value={(flags.data?.length ?? 0).toLocaleString()} detail="Open account flags" warning /></div>;
  const accountSection = <section className="dashboard-card"><SectionHeader icon={<UsersRound size={17} />} title="Accounts" detail="Search name, email, or account ID. API key material is never shown. Deletion is irreversible and leaves only a non-reversible identity guard." /><div className="mt-5 grid gap-2 lg:grid-cols-[minmax(0,1fr)_9rem_12rem]"><div className="relative"><Search className="pointer-events-none absolute left-3 top-2.5 text-[#858697]" size={15} /><Input value={accountSearch} onChange={event => setAccountSearch(event.target.value)} placeholder="Search name, email, or account ID" className="h-10 border-white/10 bg-black/15 pl-9 text-xs" /></div><label className="sr-only" htmlFor="account-status-filter">Filter accounts by status</label><select id="account-status-filter" value={accountStatus} onChange={event => setAccountStatus(event.target.value as typeof accountStatus)} className="h-10 rounded-lg border border-white/10 bg-black/15 px-3 text-xs text-[#e5e5ed] outline-none transition focus:border-[#c9ff73]/60"><option value="all">All states</option><option value="active">Active</option><option value="flagged">Flagged</option><option value="suspended">Suspended</option></select><label className="sr-only" htmlFor="account-sort">Sort accounts</label><select id="account-sort" value={accountSort} onChange={event => setAccountSort(event.target.value as typeof accountSort)} className="h-10 rounded-lg border border-white/10 bg-black/15 px-3 text-xs text-[#e5e5ed] outline-none transition focus:border-[#c9ff73]/60"><option value="latestJoin">Latest joined</option><option value="mostTokens">Most tokens used</option><option value="discordVerified">Discord verified first</option><option value="mostCredit">Most credit</option></select></div><div className="mt-4 rounded-xl border border-white/8 bg-black/10 px-3 sm:px-5">{accountDirectory.isLoading ? <div className="grid h-40 place-items-center"><Loader2 className="animate-spin text-[#c9ff73]" size={18} /></div> : accountItems.length ? accountItems.map(account => <AccountRow key={account.id} account={account} activeAdminId={user?.id ?? -1} modelUsage={modelUsageByAccount.get(account.id) ?? []} modelUsageLoading={accountModelUsage.isLoading} />) : <p className="py-12 text-center text-sm text-[#9091a3]">No accounts match these filters.</p>}</div>{accountDirectory.data && accountDirectory.data.total > 0 && <div className="mt-4 flex flex-col gap-3 border-t border-white/8 pt-4 sm:flex-row sm:items-center sm:justify-between"><p className="text-xs text-[#8f90a2]">Showing {((accountDirectory.data.page - 1) * accountDirectory.data.pageSize) + 1}–{Math.min(accountDirectory.data.page * accountDirectory.data.pageSize, accountDirectory.data.total)} of {accountDirectory.data.total.toLocaleString()} accounts</p><div className="flex items-center gap-2"><Button size="sm" variant="outline" disabled={accountDirectory.data.page <= 1} className="border-white/12 text-xs text-[#d9d8e1] hover:bg-white/10" onClick={() => setAccountPage(page => Math.max(1, page - 1))}>Previous</Button><span className="min-w-20 text-center font-mono text-[10px] text-[#aeb0bd]">Page {accountDirectory.data.page} / {accountDirectory.data.pageCount}</span><Button size="sm" variant="outline" disabled={accountDirectory.data.page >= accountDirectory.data.pageCount} className="border-white/12 text-xs text-[#d9d8e1] hover:bg-white/10" onClick={() => setAccountPage(page => Math.min(accountDirectory.data?.pageCount ?? page, page + 1))}>Next</Button></div></div>}</section>;
  const capacitySection = <section className="dashboard-card"><SectionHeader icon={<Gauge size={17} />} title="Provider capacity & failover" detail="Live runtime signal from anonymous credential-pool slots. No keys, key fragments, or request content are retained or displayed." /><div className="mt-5 grid gap-3 md:grid-cols-3">{overview.data?.providers.map(provider => { const telemetry = telemetryFor(provider.slug); const healthy = telemetry?.healthySlots ?? 0; const poolSize = telemetry?.poolSize ?? 0; const cooling = telemetry?.coolingDownSlots ?? 0; const tone = !provider.enabled || !poolSize ? "text-[#858697]" : cooling ? "text-[#f0c180]" : "text-[#c9ff73]"; return <div key={provider.slug} className="rounded-xl border border-white/8 bg-black/15 p-4"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate text-xs font-bold text-white">{provider.displayName}</p><p className="mt-1 font-mono text-[10px] text-[#858697]">{provider.slug}</p></div><Badge className={`border-0 bg-white/6 text-[10px] ${tone}`}>{!provider.enabled ? "Paused" : !poolSize ? "Not configured" : cooling ? "Failing over" : "Capacity ready"}</Badge></div><div className="mt-5 flex items-end justify-between gap-3"><div><p className="text-[10px] uppercase tracking-[.12em] text-[#858697]">Healthy slots</p><p className={`mt-1 text-2xl font-black tabular-nums ${tone}`}>{healthy}/{poolSize}</p></div><div className="text-right"><p className="text-[10px] uppercase tracking-[.12em] text-[#858697]">Failovers</p><p className="mt-1 text-lg font-bold text-white">{telemetry?.failoverCount ?? 0}</p></div></div><p className="mt-4 border-t border-white/8 pt-3 text-[10px] leading-5 text-[#8f90a2]">{cooling ? `${cooling} slot${cooling === 1 ? " is" : "s are"} cooling down; eligible requests use remaining capacity.` : telemetry?.lastSuccessAt ? `Last provider response: ${new Date(telemetry.lastSuccessAt).toLocaleTimeString()}` : "Awaiting the first provider response in this runtime."}</p></div>; })}</div></section>;
  const controlSection = <section className="dashboard-card"><SectionHeader icon={<ServerCog size={17} />} title="Inference controls" detail="Each labelled switch takes effect immediately for the gateway. Pausing a provider disables every routed model; re-enable individual routes after capacity returns." /><div className="mt-5 grid gap-5 xl:grid-cols-[.8fr_1.2fr]"><div className="space-y-2">{overview.data?.providers.map(provider => { const telemetry = telemetryFor(provider.slug); return <div key={provider.slug} className="flex items-center justify-between gap-3 rounded-xl border border-white/8 bg-white/[.025] p-3 transition-colors hover:border-white/14"><div className="min-w-0"><p className="truncate text-xs font-bold text-white">{provider.displayName}</p><p className="mt-0.5 truncate text-[10px] text-[#8f90a2]">{provider.slug} · {telemetry?.healthySlots ?? 0}/{telemetry?.poolSize ?? 0} slots ready · {telemetry?.failoverCount ?? 0} failovers</p></div><Toggle label={provider.displayName} enabled={provider.enabled} pending={providerControl.isPending} onChange={enabled => providerControl.mutate({ slug: provider.slug as never, enabled })} /></div>; })}</div><div><div className="relative"><Search className="pointer-events-none absolute left-3 top-2.5 text-[#858697]" size={15} /><Input value={modelQuery} onChange={event => setModelQuery(event.target.value)} placeholder="Search active model catalogue" className="h-10 border-white/10 bg-black/15 pl-9 text-xs" /></div><div className="mt-2 max-h-[26rem] space-y-1 overflow-y-auto rounded-xl border border-white/8 bg-black/10 p-2">{visibleModels.map(model => <div key={model.modelId} className="flex items-center justify-between gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-white/[.035]"><div className="min-w-0"><p className="truncate text-xs font-semibold text-white">{model.displayName}</p><p className="truncate text-[10px] text-[#8f90a2]">{model.modelId} · {model.providerSlug}</p></div><Toggle label={model.displayName} enabled={model.enabled} pending={modelControl.isPending} onChange={enabled => modelControl.mutate({ modelId: model.modelId as never, enabled })} /></div>)}{!visibleModels.length && <p className="py-8 text-center text-xs text-[#8f90a2]">No active catalogue model matches that search.</p>}</div></div></div></section>;
  const announcementSection = <section className="dashboard-card"><SectionHeader icon={<Megaphone size={17} />} title="Rolling announcement" detail="Publish one concise, site-wide message below the public and developer headers. Save an empty field to remove it." /><div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(18rem,.8fr)]"><div><label htmlFor="announcement-text" className="text-xs font-semibold text-[#dedfe7]">Announcement text</label><Textarea id="announcement-text" value={announcementText} onChange={event => setAnnouncementText(event.target.value)} maxLength={500} rows={5} placeholder="For example: New model capacity is now available…" className="mt-2 resize-y border-white/10 bg-black/15 text-sm leading-6 text-white placeholder:text-[#6f7181]" disabled={announcement.isLoading || saveAnnouncement.isPending} /><div className="mt-2 flex items-center justify-between gap-3"><p className="text-[10px] text-[#858697]">{announcementText.length}/500 characters</p><Button size="sm" onClick={() => saveAnnouncement.mutate({ text: announcementText })} disabled={saveAnnouncement.isPending || announcement.isLoading} className="bg-[#c9ff73] text-[#17210d] hover:bg-[#d8ff91]">{saveAnnouncement.isPending ? <><Loader2 className="animate-spin" size={14} />Saving…</> : "Save announcement"}</Button></div></div><div className="rounded-xl border border-white/8 bg-black/15 p-4"><p className="text-[10px] font-bold uppercase tracking-[.13em] text-[#858697]">Live preview</p>{announcementText.trim() ? <div className="mt-3 overflow-hidden rounded-lg border border-[#c9ff73]/15 bg-[#1b2415]"><div className="flex w-max min-w-[180%] items-center gap-5 px-4 py-3 font-mono text-[10px] font-bold tracking-wide text-[#dfe9d4]"><Megaphone size={13} className="text-[#c9ff73]" /><span>{announcementText.trim()}</span><span aria-hidden="true">·</span><span aria-hidden="true">{announcementText.trim()}</span></div></div> : <div className="mt-3 grid min-h-24 place-items-center rounded-lg border border-dashed border-white/10 px-4 text-center text-xs leading-5 text-[#858697]">No announcement is currently published.</div>}<p className="mt-3 text-[10px] leading-5 text-[#858697]">The live banner scrolls from left to right and respects each visitor’s reduced-motion preference.</p></div></div></section>;
  const activitySection = <AuditTimeline events={(activityFeed.data ?? []) as AdminAuditRecord[]} onExport={downloadAuditExport} exporting={auditExport.isFetching} />;
  const body = loading ? <div className="grid h-80 place-items-center"><Loader2 className="animate-spin text-[#c9ff73]" /></div> : overview.error && !overview.data ? <div className="dashboard-card grid min-h-64 place-items-center p-6 text-center"><div><AlertTriangle className="mx-auto text-[#f0c180]" size={22} /><p className="mt-3 text-sm font-semibold text-white">Live operations data could not load</p><p className="mt-2 max-w-sm text-xs leading-5 text-[#9091a3]">Your administrator session is still active. Refresh the control-plane data to try again.</p><Button size="sm" variant="outline" className="mt-4 border-white/12 text-[#e2e1ea] hover:bg-white/10" onClick={() => overview.refetch()}>Retry live data</Button></div></div> : <div className="space-y-4">{overview.error && <div className="flex items-center justify-between gap-3 rounded-xl border border-[#f0c180]/20 bg-[#f0c180]/[.06] px-3 py-2 text-[11px] text-[#f0c180]"><span>Using the last successfully loaded operations data while a refresh is retried.</span><Button size="sm" variant="ghost" className="h-7 shrink-0 px-2 text-[#f0c180] hover:bg-[#f0c180]/10 hover:text-[#ffe1a4]" onClick={() => overview.refetch()}>Retry</Button></div>}{metrics}<div className="dashboard-card flex flex-wrap gap-2 p-2">{(["overview", "accounts", "controls", "operations", "announcement", "activity"] as const).map(item => <Button key={item} size="sm" variant={section === item ? "default" : "ghost"} onClick={() => setSection(item)} className={section === item ? "bg-[#c9ff73] text-[#17210d] hover:bg-[#d8ff91]" : "text-[#b7b8c7] hover:bg-white/8 hover:text-white"}>{item === "overview" ? "Overview" : item === "accounts" ? "Accounts" : item === "controls" ? "Model controls" : item === "operations" ? "Operations" : item === "announcement" ? "Announcement" : "Activity"}</Button>)}</div>{section === "overview" && <div className="grid gap-4 xl:grid-cols-2">{accountSection}<section className="dashboard-card"><SectionHeader icon={<ChartNoAxesCombined size={17} />} title="Usage activity" detail="Recent request activity across the TokenForge gateway." /><AdminUsageChart usage={overview.data?.usage ?? []} modelUsage={(overview.data?.allAccountModelUsage ?? []) as AdminGlobalModelUsage[]} loading={overview.isLoading} /></section><section className="dashboard-card"><SectionHeader icon={<Mail size={17} />} title="Email provider distribution" detail="Live account counts by mailbox domain. Individual email addresses are never displayed." /><div className="mt-5"><EmailProviderChart providers={emailProviders} loading={overview.isLoading} /></div></section><div className="xl:col-span-2">{capacitySection}</div></div>}{section === "accounts" && accountSection}{section === "controls" && controlSection}{section === "operations" && <OperationalControls />}{section === "announcement" && announcementSection}{section === "activity" && activitySection}</div>;

  return <DashboardLayout><div className="dashboard-page-surface"><div className="dashboard-page-content"><div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="dashboard-kicker">Operations console</p><h1 className="dashboard-title">Control plane</h1><p className="dashboard-subtitle">Passcode-scoped administrator access, live account oversight, inference availability, and safety operations.</p></div><AlertDialog><AlertDialogTrigger asChild><Button variant="outline" className="w-full border-white/12 text-[#d9d8e1] hover:bg-white/10 sm:w-auto"><LogOut size={15} /> Sign out of admin</Button></AlertDialogTrigger><AlertDialogContent className="border-white/10 bg-[#171820] text-white"><AlertDialogHeader><AlertDialogTitle>Revoke administrator access?</AlertDialogTitle><AlertDialogDescription className="text-[#a1a2b2]">This browser returns to standard-user access. You can unlock the control plane again only with the owner passcode.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel className="border-white/12 bg-transparent text-[#d9d8e1] hover:bg-white/10 hover:text-white">Keep admin access</AlertDialogCancel><AlertDialogAction onClick={() => signOutAdmin.mutate()} disabled={signOutAdmin.isPending} className="bg-[#ef929b] text-[#271216] hover:bg-[#ffabb2]">{signOutAdmin.isPending ? "Revoking…" : "Sign out of admin"}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog></div>{body}</div></div></DashboardLayout>;
}

function Metric({ icon, label, value, detail, lime, warning }: { icon: React.ReactNode; label: string; value: string; detail: string; lime?: boolean; warning?: boolean }) {
  return <div className="dashboard-card p-4"><div className={`grid h-8 w-8 place-items-center rounded-lg ${warning ? "bg-[#f0c180]/10 text-[#f0c180]" : lime ? "bg-[#c9ff73]/10 text-[#c9ff73]" : "bg-white/6 text-[#b8b9c8]"}`}>{icon}</div><p className={`mt-4 text-xl font-bold ${lime ? "text-[#c9ff73]" : "text-white"}`}>{value}</p><p className="mt-1 text-xs font-semibold text-[#d6d7e2]">{label}</p><p className="mt-1 text-[10px] text-[#838497]">{detail}</p></div>;
}

function SectionHeader({ icon, title, detail }: { icon: React.ReactNode; title: string; detail: string }) {
  return <div className="flex gap-3"><div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[#c9ff73]/10 text-[#c9ff73]">{icon}</div><div><p className="text-sm font-bold text-white">{title}</p><p className="mt-1 text-xs leading-5 text-[#9495a7]">{detail}</p></div></div>;
}
