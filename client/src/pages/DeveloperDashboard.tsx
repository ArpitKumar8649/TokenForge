import DashboardLayout from "@/components/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { coalesceDailyUsage } from "../../../shared/usageSeries";
import { markApiKeyRevoked, prependCreatedApiKey } from "../../../shared/apiKeyListCache";
import { useAuth } from "@/_core/hooks/useAuth";
import { AlertTriangle, ArrowRight, BarChart3, BookOpen, Check, Clipboard, Code2, Copy, KeyRound, Loader2, LockKeyhole, Plus, RefreshCw, ShieldCheck, Sparkles, Terminal, Trash2 } from "lucide-react";
import { FormEvent, useMemo, useState } from "react";
import { Link } from "wouter";
import { toast } from "sonner";
import "../dashboard.css";
import Playground from "./Playground";
import { CreditOverview, Profile, UsageLogs } from "./CreditWorkspace";
import { DashboardModels } from "./DashboardModels";

type Section = "overview" | "keys" | "usage" | "playground" | "profile" | "models" | "model";
type UsageData = {
  quota?: { usedRequests: number; requestLimit: number; usedTokens: number; tokenLimit: number; maxConcurrentRequests: number; suspended: boolean; suspicious: boolean } | null;
  totalRequests: number;
  totalTokens: number;
  daily: { day: string; requests: number; tokens: number }[];
};

function UsageRing({ label, used, limit, tone = "violet" }: { label: string; used: number; limit: number; tone?: "violet" | "cyan" }) {
  const pct = Math.min(100, Math.round((used / Math.max(limit, 1)) * 100));
  const color = tone === "cyan" ? "#79e8ef" : "#b89aff";
  return <div className="usage-ring"><div className="usage-ring__disc" style={{ background: `conic-gradient(${color} ${pct * 3.6}deg, rgba(255,255,255,.09) 0deg)` }}><div>{pct}%</div></div><div><p>{label}</p><span>{used.toLocaleString()} of {limit.toLocaleString()}</span></div></div>;
}

function KeySecret({ value, onDismiss }: { value: string; onDismiss: () => void }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => { await navigator.clipboard.writeText(value); setCopied(true); toast.success("API key copied to clipboard"); };
  return <div className="rounded-2xl border border-[#b89aff]/40 bg-[#1a1824] p-5 shadow-2xl shadow-black/30"><div className="flex items-start gap-3"><div className="rounded-xl bg-[#b89aff]/15 p-2.5 text-[#d7c6ff]"><ShieldCheck size={18} /></div><div><p className="text-sm font-bold text-white">Copy this key now</p><p className="mt-1 max-w-xl text-xs leading-5 text-[#b4b3c0]">For your security, TokenForge will not show this plaintext key again after you dismiss this message.</p></div></div><div className="mt-4 flex items-center gap-2 rounded-lg border border-white/10 bg-[#0d0e14] p-3"><code className="min-w-0 flex-1 truncate font-mono text-xs text-[#e2d8ff]">{value}</code><Button size="sm" className="bg-[#f0efff] text-[#18151f] hover:bg-white" onClick={copy}>{copied ? <Check size={14} /> : <Copy size={14} />}{copied ? "Copied" : "Copy"}</Button></div><Button variant="outline" size="sm" className="mt-4 border-white/15 text-[#d7d6df] hover:bg-white/10" onClick={onDismiss}>I’ve saved this key</Button></div>;
}

type NewApiKeyResult = {
  key: string;
  record: { id: number; label: string; prefix: string; status: "active" | "revoked"; createdAt: Date };
};

function KeyCreateForm({ onSuccess }: { onSuccess: (value: NewApiKeyResult) => void }) {
  const [label, setLabel] = useState("");
  const create = trpc.developer.createApiKey.useMutation({ onSuccess: value => { onSuccess(value); setLabel(""); toast.success("New API key created"); }, onError: error => toast.error(error.message) });
  const submit = (event: FormEvent) => { event.preventDefault(); create.mutate({ label }); };
  return <form onSubmit={submit} className="rounded-xl border border-white/10 bg-[#15161f] p-4"><Label htmlFor="key-label" className="text-xs text-[#d7d6df]">Key label</Label><div className="mt-2 flex gap-2"><Input id="key-label" value={label} onChange={event => setLabel(event.target.value)} placeholder="e.g. staging web app" maxLength={100} className="border-white/12 bg-[#0e0f16] text-white placeholder:text-[#6f7181]" /><Button disabled={!label.trim() || create.isPending} className="shrink-0 bg-[#f0efff] text-[#18151f] hover:bg-white">{create.isPending ? <Loader2 className="animate-spin" size={15} /> : <Plus size={15} />} Create</Button></div></form>;
}

function ApiKeyList() {
  const keys = trpc.developer.apiKeys.useQuery();
  const utils = trpc.useUtils();
  const [plainTextKey, setPlainTextKey] = useState<string | null>(null);
  const showNewKey = (value: NewApiKeyResult) => {
    const record = { ...value.record, lastUsedAt: null, revokedAt: null };
    utils.developer.apiKeys.setData(undefined, current => prependCreatedApiKey(current, record));
    setPlainTextKey(value.key);
  };
  const revoke = trpc.developer.revokeApiKey.useMutation({ onSuccess: (_, variables) => {
    utils.developer.apiKeys.setData(undefined, current => markApiKeyRevoked(current, variables.apiKeyId, new Date()));
    toast.success("API key revoked");
  }, onError: error => toast.error(error.message) });
  const rotate = trpc.developer.rotateApiKey.useMutation({ onSuccess: (value, variables) => {
    const record = { ...value.record, lastUsedAt: null, revokedAt: null };
    utils.developer.apiKeys.setData(undefined, current => prependCreatedApiKey(markApiKeyRevoked(current, variables.apiKeyId, new Date()), record));
    setPlainTextKey(value.key);
    toast.success("Key rotated — copy the new secret now");
  }, onError: error => toast.error(error.message) });
  if (keys.isLoading) return <div className="grid min-h-48 place-items-center rounded-xl border border-white/10 bg-[#15161f]"><Loader2 className="animate-spin text-[#b89aff]" /></div>;
  return <div className="space-y-3">{plainTextKey && <KeySecret value={plainTextKey} onDismiss={() => setPlainTextKey(null)} />}<KeyCreateForm onSuccess={showNewKey} />{keys.data?.length ? <div className="overflow-hidden rounded-xl border border-white/10 bg-[#15161f]">{keys.data.map(key => <div key={key.id} className="flex flex-wrap items-center gap-3 border-b border-white/8 p-4 last:border-0"><div className="grid h-9 w-9 place-items-center rounded-lg bg-white/5 text-[#cbb7ff]"><KeyRound size={16} /></div><div className="min-w-40 flex-1"><p className="text-xs font-bold text-white">{key.label}</p><code className="mt-1 block font-mono text-[10px] text-[#9394a7]">{key.prefix}</code></div><div className="text-[10px] text-[#8e8fa1]">Created {new Date(key.createdAt).toLocaleDateString()}</div><Badge className={key.status === "active" ? "border-0 bg-[#7debbd]/10 text-[#8aefc0]" : "border-0 bg-red-400/10 text-red-300"}>{key.status}</Badge>{key.status === "active" && <div className="flex gap-1"><Button variant="ghost" size="sm" title="Rotate key" className="text-[#c7c5d2] hover:bg-white/8 hover:text-white" disabled={rotate.isPending} onClick={() => rotate.mutate({ apiKeyId: key.id, label: `${key.label.slice(0, 85)} · rotated` })}><RefreshCw size={14} /></Button><Button variant="ghost" size="sm" title="Revoke key" className="text-[#d69ca6] hover:bg-red-400/10 hover:text-red-200" disabled={revoke.isPending} onClick={() => revoke.mutate({ apiKeyId: key.id })}><Trash2 size={14} /></Button></div>}</div>)}</div> : <div className="rounded-xl border border-dashed border-white/12 p-8 text-center"><KeyRound className="mx-auto text-[#77788b]" size={22} /><p className="mt-3 text-sm font-bold text-white">No keys yet</p><p className="mt-1 text-xs text-[#9394a7]">Create a labeled key above to begin making requests.</p></div>}</div>;
}

function UsageChart({ daily }: { daily: { day: string; requests: number; tokens: number }[] }) {
  const data = useMemo(() => coalesceDailyUsage(daily).slice(-14), [daily]);
  const max = Math.max(1, ...data.map(row => row.tokens));
  if (!data.length) return <div className="dashboard-empty-chart"><BarChart3 size={24} /><p>Usage will appear here after your first successful request.</p></div>;
  return <div className="usage-chart-bars">{data.map(row => <div key={row.day} className="usage-chart-bar"><div className="usage-chart-bar__track"><div className="usage-chart-bar__fill" style={{ height: `${Math.max(4, Math.round((row.tokens / max) * 100))}%` }}><span>{row.tokens.toLocaleString()}</span></div></div><small>{row.day.slice(5)}</small></div>)}</div>;
}

function PageIntro({ eyebrow, title, subtitle, action }: { eyebrow: string; title: string; subtitle: string; action?: React.ReactNode }) {
  return <div className="dashboard-page-intro"><div><p>{eyebrow}</p><h1>{title}</h1><span>{subtitle}</span></div>{action}</div>;
}

function Overview({ user, loading, usage }: { user: ReturnType<typeof useAuth>["user"]; loading: boolean; usage: { data?: UsageData; isLoading: boolean } }) {
  const quota = usage.data?.quota;
  if (loading || usage.isLoading) return <div className="dashboard-loading-panel"><Loader2 className="animate-spin" /></div>;
  return <>
    <PageIntro eyebrow="Workspace overview" title={`Good to see you${user?.name ? `, ${user.name.split(" ")[0]}` : ""}.`} subtitle="A considered control surface for everything your TokenForge account can do." action={<Link href="/docs" className="dashboard-outline-action"><BookOpen size={15} /> API reference</Link>} />
    <CreditOverview />
    <section className="dashboard-command-center">
      <div className="dashboard-allowance-card"><div className="dashboard-panel-kicker"><span><i /> GATEWAY STATUS</span><Badge className={quota?.suspended ? "border-0 bg-red-400/10 text-red-300" : "border-0 bg-[#befe6c]/10 text-[#cbff8b]"}>{quota?.suspended ? "Suspended" : "Active"}</Badge></div><h2>Requests, kept accountable.</h2><p>Usage is logged per call, billed only for reported tokens, and protected by rate and concurrency controls.</p><div className="usage-ring-grid"><UsageRing label="Concurrent slots" used={0} limit={quota?.maxConcurrentRequests ?? 2} /><UsageRing label="Recent requests" used={usage.data?.totalRequests ?? 0} limit={Math.max(1, usage.data?.totalRequests ?? 1)} tone="cyan" /></div></div>
      <div className="dashboard-posture-card"><div className="dashboard-panel-kicker"><span><Sparkles size={12} /> GATEWAY POSTURE</span></div><h2>Built to stay legible.</h2><p>Selected models, visible limits, and an accountable request surface.</p><div className="dashboard-posture-list"><span><ShieldCheck size={15} /> Keys protected as one-way hashes</span><span><Check size={15} /> {quota?.maxConcurrentRequests ?? 2} concurrent requests available</span>{quota?.suspicious && <span className="dashboard-warning"><AlertTriangle size={15} /> Account review is in progress</span>}</div><Link href="/dashboard/playground" className="dashboard-primary-link">Open Playground <ArrowRight size={15} /></Link></div>
    </section>
    <section className="dashboard-usage-panel"><div className="dashboard-section-head"><div><p>REQUEST TELEMETRY</p><h2>Transparent activity</h2><span>Inspect model, source, token counts, and promotional-credit charge for each request.</span></div><Link href="/dashboard/usage" className="dashboard-outline-action">Usage logs <ArrowRight size={14} /></Link></div><UsageChart daily={usage.data?.daily ?? []} /></section>
    <section className="dashboard-next-section"><div className="dashboard-section-head"><div><p>BUILD WITH INTENT</p><h2>Your next useful move</h2><span>Everything needed to go from a fresh account to a measured request.</span></div></div><div className="dashboard-next-grid"><Link href="/dashboard/keys" className="dashboard-next-card"><span><KeyRound size={17} /> 01</span><h3>Create a scoped key</h3><p>Label a credential for your project and see it exactly once.</p><b>Manage keys <ArrowRight size={14} /></b></Link><Link href="/dashboard/playground" className="dashboard-next-card"><span><Terminal size={17} /> 02</span><h3>Shape a first prompt</h3><p>Test GLM-5.2 or Grok 4.5 inside the protected Playground.</p><b>Open Playground <ArrowRight size={14} /></b></Link><Link href="/docs" className="dashboard-next-card"><span><Code2 size={17} /> 03</span><h3>Ship the connection</h3><p>Copy a familiar OpenAI-compatible request into your client.</p><b>Read the docs <ArrowRight size={14} /></b></Link></div></section>
    <section className="dashboard-reference-strip"><div><LockKeyhole size={18} /><span><b>Credential handling</b><small>Provider access stays server-side; plaintext user keys are shown once.</small></span></div><Link href="/legal/terms">Trust & policies <ArrowRight size={14} /></Link></section>
  </>;
}

export default function DeveloperDashboard({ section = "overview", modelId }: { section?: Section; modelId?: string }) {
  const { user, loading } = useAuth();
  const usage = trpc.developer.usage.useQuery(undefined, { enabled: Boolean(user) });
  const content = section === "playground" ? <Playground /> : section === "models" ? <DashboardModels /> : section === "model" ? <DashboardModels modelId={modelId} /> : section === "keys" ? <><PageIntro eyebrow="Credentials" title="API keys" subtitle="Create, rotate, or revoke credentials without ever re-exposing a saved secret." /><ApiKeyList /></> : section === "usage" ? <><PageIntro eyebrow="Observability" title="Usage logs" subtitle="A transparent record of request source, model, tokens, and credit cost." /><UsageLogs /></> : section === "profile" ? <><PageIntro eyebrow="Account & rewards" title="Profile" subtitle="Manage your TokenForge identity and claim your daily build credit." /><Profile /></> : <Overview user={user} loading={loading} usage={usage} />;
  return <DashboardLayout><div className="dashboard-page-surface"><div className="dashboard-page-content">{content}</div></div></DashboardLayout>;
}
