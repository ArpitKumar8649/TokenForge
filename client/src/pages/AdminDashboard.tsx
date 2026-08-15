import DashboardLayout from "@/components/DashboardLayout";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { coalesceDailyUsage } from "../../../shared/usageSeries";
import { Activity, AlertTriangle, ChartNoAxesCombined, KeyRound, Loader2, LogOut, Power, Search, ServerCog, ShieldAlert, Trash2, UsersRound, WalletCards } from "lucide-react";
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
  requestCount: number;
  totalTokens: number;
  lastActivityAt: Date | null;
};

const formatCredits = (nanos: number) => `$${(nanos / 1_000_000_000).toFixed(2)}`;
const formatTokens = (tokens: number) => tokens >= 1_000_000 ? `${(tokens / 1_000_000).toFixed(1)}M` : tokens >= 1_000 ? `${(tokens / 1_000).toFixed(1)}K` : tokens.toLocaleString();

function Toggle({ label, enabled, onChange, pending }: { label: string; enabled: boolean; onChange: (value: boolean) => void; pending?: boolean }) {
  return <div className={`flex shrink-0 items-center gap-2 rounded-xl border px-2 py-1 ${enabled ? "border-[#c9ff73]/20 bg-[#c9ff73]/[.055]" : "border-white/8 bg-black/15"}`}>
    <span className={`min-w-9 text-right text-[9px] font-bold uppercase tracking-[.12em] ${enabled ? "text-[#c9ff73]" : "text-[#828394]"}`}>{pending ? "Saving" : enabled ? "Live" : "Off"}</span>
    <Switch aria-label={`${label}: ${enabled ? "enabled" : "disabled"}`} checked={enabled} onCheckedChange={value => onChange(Boolean(value))} disabled={pending} className="h-5 w-9 border-0 data-[state=checked]:bg-[#88c637] data-[state=unchecked]:bg-[#4a4b59] [&_[data-slot=switch-thumb]]:size-4 [&_[data-slot=switch-thumb]]:data-[state=checked]:translate-x-[calc(100%-1px)]" />
  </div>;
}

function AdminUsageChart({ usage }: { usage: { day: string; requests: number; tokens: number }[] }) {
  const data = coalesceDailyUsage(usage);
  const max = Math.max(1, ...data.map(row => row.requests));
  if (!data.length) return <div className="grid h-40 place-items-center text-xs text-[#9091a3]">No metered activity has been recorded yet.</div>;
  return <div className="flex h-40 items-end gap-2">{data.map(row => <div className="group flex h-full flex-1 flex-col justify-end" key={row.day}><div className="rounded-t bg-gradient-to-t from-[#5f9f29] to-[#c9ff73]" style={{ height: `${Math.max(4, row.requests / max * 100)}%` }} title={`${row.requests} requests · ${row.tokens.toLocaleString()} tokens`} /><span className="mt-2 text-center font-mono text-[8px] text-[#77798b]">{row.day.slice(5)}</span></div>)}</div>;
}

function AccountRow({ account, activeAdminId }: { account: AdminAccount; activeAdminId: number }) {
  const utils = trpc.useUtils();
  const [requests, setRequests] = useState(String(account.requestLimit ?? 100));
  const [tokens, setTokens] = useState(String(account.tokenLimit ?? 100_000));
  const [deleteOpen, setDeleteOpen] = useState(false);
  const isCurrentAdmin = account.id === activeAdminId;
  const control = trpc.admin.setAccountControl.useMutation({ onSuccess: () => { utils.admin.overview.invalidate(); utils.admin.accounts.invalidate(); toast.success("Account controls saved"); }, onError: error => toast.error(error.message) });
  const deleteAccount = trpc.admin.deleteAccount.useMutation({
    onSuccess: async () => {
      setDeleteOpen(false);
      await Promise.all([utils.admin.overview.invalidate(), utils.admin.accounts.invalidate()]);
      toast.success("Account and associated TokenForge data permanently deleted");
    },
    onError: error => toast.error(error.message),
  });
  const activity = account.lastActivityAt ? new Date(account.lastActivityAt).toLocaleDateString() : "No activity";

  return <div className="grid gap-3 border-t border-white/8 py-4 xl:grid-cols-[1.1fr_.75fr_.95fr_1fr_auto] xl:items-center">
    <div className="min-w-0"><p className="truncate text-xs font-bold text-white">{account.name || "Unnamed account"}</p><p className="mt-1 truncate text-[10px] text-[#8f90a2]">{account.email || "No email available"}</p><div className="mt-2 flex flex-wrap gap-1"><Badge className="border-0 bg-white/6 text-[10px] text-[#c9c8d2]">Standard account</Badge>{account.suspicious && <Badge className="border-0 bg-[#f0c180]/10 text-[10px] text-[#f0c180]">flagged</Badge>}{account.suspended && <Badge className="border-0 bg-red-400/10 text-[10px] text-red-300">suspended</Badge>}{isCurrentAdmin && <Badge className="border-0 bg-[#c9ff73]/10 text-[10px] text-[#c9ff73]">current admin</Badge>}</div></div>
    <div><p className="text-[10px] uppercase tracking-[.12em] text-[#77798b]">Live credit</p><p className="mt-1 text-sm font-bold text-[#c9ff73]">{formatCredits(account.balanceNanos)}</p></div>
    <div><p className="text-[10px] uppercase tracking-[.12em] text-[#77798b]">Lifetime usage</p><p className="mt-1 text-sm font-bold text-white">{formatTokens(account.totalTokens)}</p><p className="mt-0.5 text-[10px] text-[#8f90a2]">{account.requestCount.toLocaleString()} requests · {activity}</p></div>
    <div className="grid grid-cols-2 gap-1"><Input aria-label="Daily request limit" value={requests} onChange={event => setRequests(event.target.value)} className="h-8 min-w-0 border-white/10 bg-black/15 px-2 text-[10px]" /><Input aria-label="Daily token limit" value={tokens} onChange={event => setTokens(event.target.value)} className="h-8 min-w-0 border-white/10 bg-black/15 px-2 text-[10px]" /></div>
    <div className="flex gap-1"><Button size="sm" variant="outline" className="h-8 border-white/12 text-[10px] text-[#e2e1ea] hover:bg-white/10" disabled={control.isPending} onClick={() => control.mutate({ userId: account.id, dailyRequestLimit: Number(requests), dailyTokenLimit: Number(tokens) })}>Save</Button><Button size="sm" variant="outline" aria-label={account.suspended ? "Restore account access" : "Suspend account access"} className={`h-8 border-white/12 px-2 ${account.suspended ? "text-[#8aefc0]" : "text-[#f0a2a9]"} hover:bg-white/10`} disabled={control.isPending || isCurrentAdmin} onClick={() => control.mutate({ userId: account.id, isSuspended: !account.suspended })}><Power size={13} /></Button><AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}><AlertDialogTrigger asChild><Button size="sm" variant="outline" aria-label="Permanently delete account" className="h-8 border-red-400/20 px-2 text-red-300 hover:bg-red-400/10 hover:text-red-200" disabled={isCurrentAdmin || deleteAccount.isPending}><Trash2 size={13} /></Button></AlertDialogTrigger><AlertDialogContent className="border-white/10 bg-[#171820] text-white"><AlertDialogHeader><AlertDialogTitle>Permanently delete this account?</AlertDialogTitle><AlertDialogDescription className="text-[#a1a2b2]">This removes the account’s API keys, credits, usage, credentials, and identity links. A hashed deletion guard prevents this identity from creating another TokenForge account.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel className="border-white/12 bg-transparent text-[#d9d8e1] hover:bg-white/10 hover:text-white">Cancel</AlertDialogCancel><AlertDialogAction onClick={() => deleteAccount.mutate({ userId: account.id })} disabled={deleteAccount.isPending} className="bg-[#ef929b] text-[#271216] hover:bg-[#ffabb2]">{deleteAccount.isPending ? "Deleting…" : "Delete permanently"}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog></div>
  </div>;
}

export default function AdminDashboard() {
  const { user, loading } = useAuth();
  const isAdminSession = user?.isAdminSession === true;
  const overview = trpc.admin.overview.useQuery(undefined, { enabled: isAdminSession, refetchInterval: 15_000 });
  const flags = trpc.admin.flags.useQuery(undefined, { enabled: isAdminSession, refetchInterval: 15_000 });
  const utils = trpc.useUtils();
  const [adminPasscode, setAdminPasscode] = useState("");
  const [section, setSection] = useState<"overview" | "accounts" | "controls">("overview");
  const [modelQuery, setModelQuery] = useState("");
  const [accountSearch, setAccountSearch] = useState("");
  const [accountStatus, setAccountStatus] = useState<"all" | "active" | "suspended" | "flagged">("all");
  const [accountPage, setAccountPage] = useState(1);
  const deferredAccountSearch = useDeferredValue(accountSearch);
  const modelControl = trpc.admin.setModelEnabled.useMutation({ onSuccess: () => { utils.admin.overview.invalidate(); toast.success("Model availability updated"); }, onError: error => toast.error(error.message) });
  const providerControl = trpc.admin.setProviderEnabled.useMutation({ onSuccess: () => { utils.admin.overview.invalidate(); toast.success("Provider availability updated"); }, onError: error => toast.error(error.message) });
  const unlockAdmin = trpc.admin.unlock.useMutation({ onSuccess: async () => { setAdminPasscode(""); await utils.auth.me.invalidate(); toast.success("Administrator access activated; other sessions were signed out"); }, onError: error => toast.error(error.message) });
  const signOutAdmin = trpc.admin.signOut.useMutation({ onSuccess: async () => { await utils.auth.me.invalidate(); toast.success("Administrator access revoked for this browser"); }, onError: error => toast.error(error.message) });
  const accounts = (overview.data?.accounts ?? []) as AdminAccount[];
  const accountDirectoryInput = useMemo(() => ({ page: accountPage, pageSize: 10, search: deferredAccountSearch, status: accountStatus }), [accountPage, accountStatus, deferredAccountSearch]);
  const accountDirectory = trpc.admin.accounts.useQuery(accountDirectoryInput, { enabled: isAdminSession, refetchInterval: 15_000 });
  const accountItems = (accountDirectory.data?.items ?? []) as AdminAccount[];
  useEffect(() => { setAccountPage(1); }, [deferredAccountSearch, accountStatus]);
  const visibleModels = useMemo(() => (overview.data?.models ?? []).filter(model => `${model.displayName} ${model.modelId}`.toLowerCase().includes(modelQuery.trim().toLowerCase())), [modelQuery, overview.data?.models]);
  const totalCredits = accounts.reduce((total, account) => total + account.balanceNanos, 0);

  if (!loading && !isAdminSession) {
    return <DashboardLayout><div className="dashboard-page-surface"><div className="dashboard-page-content mx-auto max-w-xl"><div className="mb-7"><p className="dashboard-kicker">Operations console</p><h1 className="dashboard-title">Unlock control plane</h1><p className="dashboard-subtitle">Enter the owner passcode to activate the only administrator session. Existing TokenForge sessions are signed out when access is granted.</p></div><form className="rounded-2xl border border-white/10 bg-[#15161f] p-5 shadow-[0_18px_60px_rgba(0,0,0,.18)] sm:p-7" onSubmit={event => { event.preventDefault(); if (adminPasscode.trim()) unlockAdmin.mutate({ passcode: adminPasscode }); }}><div className="grid h-11 w-11 place-items-center rounded-xl bg-[#b8fb59]/10 text-[#c9ff73]"><KeyRound size={19} /></div><h2 className="mt-5 text-lg font-bold">Administrator passcode</h2><p className="mt-2 text-sm leading-6 text-[#9899aa]">The server verifies this passcode and rate-limits incorrect attempts. It never becomes part of an account profile.</p><label className="mt-6 block text-xs font-semibold text-[#d9d8e1]" htmlFor="admin-passcode">Passcode</label><Input id="admin-passcode" type="password" inputMode="numeric" autoComplete="one-time-code" value={adminPasscode} onChange={event => setAdminPasscode(event.target.value)} placeholder="Enter passcode" className="mt-2 h-11 border-white/10 bg-black/20 text-white placeholder:text-[#707184]" disabled={unlockAdmin.isPending} /><Button type="submit" className="mt-4 h-11 w-full bg-[#c9ff73] text-[#17210d] hover:bg-[#d8ff91]" disabled={!adminPasscode.trim() || unlockAdmin.isPending}>{unlockAdmin.isPending ? <><Loader2 className="animate-spin" size={15} /> Verifying access</> : "Unlock administrator access"}</Button></form></div></div></DashboardLayout>;
  }

  const metrics = <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5"><Metric icon={<UsersRound size={17} />} label="Accounts" value={(accountDirectory.data?.total ?? accounts.length).toLocaleString()} detail="Searchable live directory" /><Metric icon={<WalletCards size={17} />} label="Credits in wallets" value={formatCredits(totalCredits)} detail="Current visible balances" lime /><Metric icon={<ChartNoAxesCombined size={17} />} label="Total tokens processed" value={formatTokens(overview.data?.totals?.totalTokens ?? 0)} detail="Across every TokenForge account" lime /><Metric icon={<Activity size={17} />} label="Lifetime requests" value={(overview.data?.totals?.totalRequests ?? 0).toLocaleString()} detail="Across all accounts" /><Metric icon={<AlertTriangle size={17} />} label="Safety signals" value={(flags.data?.length ?? 0).toLocaleString()} detail="Open account flags" warning /></div>;
  const accountSection = <section className="dashboard-card"><SectionHeader icon={<UsersRound size={17} />} title="Accounts" detail="Search name, email, or account ID. API key material is never shown. Deletion is irreversible and leaves only a non-reversible identity guard." /><div className="mt-5 grid gap-2 lg:grid-cols-[minmax(0,1fr)_9rem]"><div className="relative"><Search className="pointer-events-none absolute left-3 top-2.5 text-[#858697]" size={15} /><Input value={accountSearch} onChange={event => setAccountSearch(event.target.value)} placeholder="Search name, email, or account ID" className="h-10 border-white/10 bg-black/15 pl-9 text-xs" /></div><label className="sr-only" htmlFor="account-status-filter">Filter accounts by status</label><select id="account-status-filter" value={accountStatus} onChange={event => setAccountStatus(event.target.value as typeof accountStatus)} className="h-10 rounded-lg border border-white/10 bg-black/15 px-3 text-xs text-[#e5e5ed] outline-none transition focus:border-[#c9ff73]/60"><option value="all">All states</option><option value="active">Active</option><option value="flagged">Flagged</option><option value="suspended">Suspended</option></select></div><div className="mt-4 rounded-xl border border-white/8 bg-black/10 px-3 sm:px-5">{accountDirectory.isLoading ? <div className="grid h-40 place-items-center"><Loader2 className="animate-spin text-[#c9ff73]" size={18} /></div> : accountItems.length ? accountItems.map(account => <AccountRow key={account.id} account={account} activeAdminId={user?.id ?? -1} />) : <p className="py-12 text-center text-sm text-[#9091a3]">No accounts match these filters.</p>}</div>{accountDirectory.data && accountDirectory.data.total > 0 && <div className="mt-4 flex flex-col gap-3 border-t border-white/8 pt-4 sm:flex-row sm:items-center sm:justify-between"><p className="text-xs text-[#8f90a2]">Showing {((accountDirectory.data.page - 1) * accountDirectory.data.pageSize) + 1}–{Math.min(accountDirectory.data.page * accountDirectory.data.pageSize, accountDirectory.data.total)} of {accountDirectory.data.total.toLocaleString()} accounts</p><div className="flex items-center gap-2"><Button size="sm" variant="outline" disabled={accountDirectory.data.page <= 1} className="border-white/12 text-xs text-[#d9d8e1] hover:bg-white/10" onClick={() => setAccountPage(page => Math.max(1, page - 1))}>Previous</Button><span className="min-w-20 text-center font-mono text-[10px] text-[#aeb0bd]">Page {accountDirectory.data.page} / {accountDirectory.data.pageCount}</span><Button size="sm" variant="outline" disabled={accountDirectory.data.page >= accountDirectory.data.pageCount} className="border-white/12 text-xs text-[#d9d8e1] hover:bg-white/10" onClick={() => setAccountPage(page => Math.min(accountDirectory.data?.pageCount ?? page, page + 1))}>Next</Button></div></div>}</section>;
  const controlSection = <section className="dashboard-card"><SectionHeader icon={<ServerCog size={17} />} title="Inference controls" detail="Each labelled switch takes effect immediately for the gateway. Green is live; gray is paused." /><div className="mt-5 grid gap-5 xl:grid-cols-[.8fr_1.2fr]"><div className="space-y-2">{overview.data?.providers.map(provider => <div key={provider.slug} className="flex items-center justify-between gap-3 rounded-xl border border-white/8 bg-white/[.025] p-3 transition-colors hover:border-white/14"><div className="min-w-0"><p className="truncate text-xs font-bold text-white">{provider.displayName}</p><p className="mt-0.5 truncate text-[10px] text-[#8f90a2]">{provider.slug}</p></div><Toggle label={provider.displayName} enabled={provider.enabled} pending={providerControl.isPending} onChange={enabled => providerControl.mutate({ slug: provider.slug as never, enabled })} /></div>)}</div><div><div className="relative"><Search className="pointer-events-none absolute left-3 top-2.5 text-[#858697]" size={15} /><Input value={modelQuery} onChange={event => setModelQuery(event.target.value)} placeholder="Search active model catalogue" className="h-10 border-white/10 bg-black/15 pl-9 text-xs" /></div><div className="mt-2 max-h-[26rem] space-y-1 overflow-y-auto rounded-xl border border-white/8 bg-black/10 p-2">{visibleModels.map(model => <div key={model.modelId} className="flex items-center justify-between gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-white/[.035]"><div className="min-w-0"><p className="truncate text-xs font-semibold text-white">{model.displayName}</p><p className="truncate text-[10px] text-[#8f90a2]">{model.modelId} · {model.providerSlug}</p></div><Toggle label={model.displayName} enabled={model.enabled} pending={modelControl.isPending} onChange={enabled => modelControl.mutate({ modelId: model.modelId as never, enabled })} /></div>)}{!visibleModels.length && <p className="py-8 text-center text-xs text-[#8f90a2]">No active catalogue model matches that search.</p>}</div></div></div></section>;
  const body = loading ? <div className="grid h-80 place-items-center"><Loader2 className="animate-spin text-[#c9ff73]" /></div> : overview.error ? <div className="dashboard-card grid min-h-64 place-items-center p-6 text-center"><div><AlertTriangle className="mx-auto text-[#f0c180]" size={22} /><p className="mt-3 text-sm font-semibold text-white">Live operations data could not load</p><p className="mt-2 max-w-sm text-xs leading-5 text-[#9091a3]">Your administrator session is still active. Refresh the control-plane data to try again.</p><Button size="sm" variant="outline" className="mt-4 border-white/12 text-[#e2e1ea] hover:bg-white/10" onClick={() => overview.refetch()}>Retry live data</Button></div></div> : <div className="space-y-4">{metrics}<div className="dashboard-card flex flex-wrap gap-2 p-2">{(["overview", "accounts", "controls"] as const).map(item => <Button key={item} size="sm" variant={section === item ? "default" : "ghost"} onClick={() => setSection(item)} className={section === item ? "bg-[#c9ff73] text-[#17210d] hover:bg-[#d8ff91]" : "text-[#b7b8c7] hover:bg-white/8 hover:text-white"}>{item === "overview" ? "Overview" : item === "accounts" ? "Accounts" : "Model controls"}</Button>)}</div>{section === "overview" && <div className="grid gap-4 xl:grid-cols-[1.05fr_.95fr]">{accountSection}<section className="dashboard-card"><SectionHeader icon={<ChartNoAxesCombined size={17} />} title="Usage activity" detail="Recent request activity across the TokenForge gateway." /><AdminUsageChart usage={overview.data?.usage ?? []} /></section></div>}{section === "accounts" && accountSection}{section === "controls" && controlSection}</div>;

  return <DashboardLayout><div className="dashboard-page-surface"><div className="dashboard-page-content"><div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="dashboard-kicker">Operations console</p><h1 className="dashboard-title">Control plane</h1><p className="dashboard-subtitle">Passcode-scoped administrator access, live account oversight, inference availability, and safety operations.</p></div><AlertDialog><AlertDialogTrigger asChild><Button variant="outline" className="w-full border-white/12 text-[#d9d8e1] hover:bg-white/10 sm:w-auto"><LogOut size={15} /> Sign out of admin</Button></AlertDialogTrigger><AlertDialogContent className="border-white/10 bg-[#171820] text-white"><AlertDialogHeader><AlertDialogTitle>Revoke administrator access?</AlertDialogTitle><AlertDialogDescription className="text-[#a1a2b2]">This browser returns to standard-user access. You can unlock the control plane again only with the owner passcode.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel className="border-white/12 bg-transparent text-[#d9d8e1] hover:bg-white/10 hover:text-white">Keep admin access</AlertDialogCancel><AlertDialogAction onClick={() => signOutAdmin.mutate()} disabled={signOutAdmin.isPending} className="bg-[#ef929b] text-[#271216] hover:bg-[#ffabb2]">{signOutAdmin.isPending ? "Revoking…" : "Sign out of admin"}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog></div>{body}</div></div></DashboardLayout>;
}

function Metric({ icon, label, value, detail, lime, warning }: { icon: React.ReactNode; label: string; value: string; detail: string; lime?: boolean; warning?: boolean }) {
  return <div className="dashboard-card p-4"><div className={`grid h-8 w-8 place-items-center rounded-lg ${warning ? "bg-[#f0c180]/10 text-[#f0c180]" : lime ? "bg-[#c9ff73]/10 text-[#c9ff73]" : "bg-white/6 text-[#b8b9c8]"}`}>{icon}</div><p className={`mt-4 text-xl font-bold ${lime ? "text-[#c9ff73]" : "text-white"}`}>{value}</p><p className="mt-1 text-xs font-semibold text-[#d6d7e2]">{label}</p><p className="mt-1 text-[10px] text-[#838497]">{detail}</p></div>;
}

function SectionHeader({ icon, title, detail }: { icon: React.ReactNode; title: string; detail: string }) {
  return <div className="flex gap-3"><div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[#c9ff73]/10 text-[#c9ff73]">{icon}</div><div><p className="text-sm font-bold text-white">{title}</p><p className="mt-1 text-xs leading-5 text-[#9495a7]">{detail}</p></div></div>;
}
