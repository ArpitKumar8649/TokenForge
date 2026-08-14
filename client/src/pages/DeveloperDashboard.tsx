import DashboardLayout from "@/components/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { coalesceDailyUsage } from "../../../shared/usageSeries";
import { useAuth } from "@/_core/hooks/useAuth";
import { AlertTriangle, ArrowRight, BarChart3, BookOpen, Check, Clipboard, Code2, Copy, KeyRound, Loader2, LockKeyhole, Plus, RefreshCw, ShieldCheck, Sparkles, Terminal, Trash2 } from "lucide-react";
import { FormEvent, useMemo, useState } from "react";
import { Link } from "wouter";
import { toast } from "sonner";
import "../dashboard.css";
import Playground from "./Playground";

type Section = "overview" | "keys" | "usage" | "playground";
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

function KeyCreateForm({ onSuccess }: { onSuccess: (key: string) => void }) {
  const [label, setLabel] = useState("");
  const create = trpc.developer.createApiKey.useMutation({ onSuccess: value => { onSuccess(value.key); setLabel(""); toast.success("New API key created"); }, onError: error => toast.error(error.message) });
  const submit = (event: FormEvent) => { event.preventDefault(); create.mutate({ label }); };
  return <form onSubmit={submit} className="rounded-xl border border-white/10 bg-[#15161f] p-4"><Label htmlFor="key-label" className="text-xs text-[#d7d6df]">Key label</Label><div className="mt-2 flex gap-2"><Input id="key-label" value={label} onChange={event => setLabel(event.target.value)} placeholder="e.g. staging web app" maxLength={100} className="border-white/12 bg-[#0e0f16] text-white placeholder:text-[#6f7181]" /><Button disabled={!label.trim() || create.isPending} className="shrink-0 bg-[#f0efff] text-[#18151f] hover:bg-white">{create.isPending ? <Loader2 className="animate-spin" size={15} /> : <Plus size={15} />} Create</Button></div></form>;
}

function ApiKeyList() {
  const keys = trpc.developer.apiKeys.useQuery();
  const utils = trpc.useUtils();
  const [plainTextKey, setPlainTextKey] = useState<string | null>(null);
  const revoke = trpc.developer.revokeApiKey.useMutation({ onSuccess: () => { utils.developer.apiKeys.invalidate(); toast.success("API key revoked"); }, onError: error => toast.error(error.message) });
  const rotate = trpc.developer.rotateApiKey.useMutation({ onSuccess: value => { utils.developer.apiKeys.invalidate(); setPlainTextKey(value.key); toast.success("Key rotated — copy the new secret now"); }, onError: error => toast.error(error.message) });
  if (keys.isLoading) return <div className="grid min-h-48 place-items-center rounded-xl border border-white/10 bg-[#15161f]"><Loader2 className="animate-spin text-[#b89aff]" /></div>;
  return <div className="space-y-3">{plainTextKey && <KeySecret value={plainTextKey} onDismiss={() => setPlainTextKey(null)} />}<KeyCreateForm onSuccess={setPlainTextKey} />{keys.data?.length ? <div className="overflow-hidden rounded-xl border border-white/10 bg-[#15161f]">{keys.data.map(key => <div key={key.id} className="flex flex-wrap items-center gap-3 border-b border-white/8 p-4 last:border-0"><div className="grid h-9 w-9 place-items-center rounded-lg bg-white/5 text-[#cbb7ff]"><KeyRound size={16} /></div><div className="min-w-40 flex-1"><p className="text-xs font-bold text-white">{key.label}</p><code className="mt-1 block font-mono text-[10px] text-[#9394a7]">{key.prefix}</code></div><div className="text-[10px] text-[#8e8fa1]">Created {new Date(key.createdAt).toLocaleDateString()}</div><Badge className={key.status === "active" ? "border-0 bg-[#7debbd]/10 text-[#8aefc0]" : "border-0 bg-red-400/10 text-red-300"}>{key.status}</Badge>{key.status === "active" && <div className="flex gap-1"><Button variant="ghost" size="sm" title="Rotate key" className="text-[#c7c5d2] hover:bg-white/8 hover:text-white" disabled={rotate.isPending} onClick={() => rotate.mutate({ apiKeyId: key.id, label: `${key.label.slice(0, 85)} · rotated` })}><RefreshCw size={14} /></Button><Button variant="ghost" size="sm" title="Revoke key" className="text-[#d69ca6] hover:bg-red-400/10 hover:text-red-200" disabled={revoke.isPending} onClick={() => revoke.mutate({ apiKeyId: key.id })}><Trash2 size={14} /></Button></div>}</div>)}</div> : <div className="rounded-xl border border-dashed border-white/12 p-8 text-center"><KeyRound className="mx-auto text-[#77788b]" size={22} /><p className="mt-3 text-sm font-bold text-white">No keys yet</p><p className="mt-1 text-xs text-[#9394a7]">Create a labeled key above to begin making requests.</p></div>}</div>;
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
    <section className="dashboard-command-center">
      <div className="dashboard-allowance-card"><div className="dashboard-panel-kicker"><span><i /> LIVE ACCOUNT CAPACITY</span><Badge className={quota?.suspended ? "border-0 bg-red-400/10 text-red-300" : "border-0 bg-[#befe6c]/10 text-[#cbff8b]"}>{quota?.suspended ? "Suspended" : "Active"}</Badge></div><h2>Today’s allowance</h2><p>Resets at 00:00 UTC. Every request is metered transparently.</p><div className="usage-ring-grid"><UsageRing label="Requests" used={quota?.usedRequests ?? 0} limit={quota?.requestLimit ?? 100} /><UsageRing label="Tokens" used={quota?.usedTokens ?? 0} limit={quota?.tokenLimit ?? 100000} tone="cyan" /></div></div>
      <div className="dashboard-posture-card"><div className="dashboard-panel-kicker"><span><Sparkles size={12} /> GATEWAY POSTURE</span></div><h2>Built to stay legible.</h2><p>Selected models, visible limits, and an accountable request surface.</p><div className="dashboard-posture-list"><span><ShieldCheck size={15} /> Keys protected as one-way hashes</span><span><Check size={15} /> {quota?.maxConcurrentRequests ?? 2} concurrent requests available</span>{quota?.suspicious && <span className="dashboard-warning"><AlertTriangle size={15} /> Account review is in progress</span>}</div><Link href="/dashboard/playground" className="dashboard-primary-link">Open Playground <ArrowRight size={15} /></Link></div>
    </section>
    <section className="dashboard-usage-panel"><div className="dashboard-section-head"><div><p>REQUEST TELEMETRY</p><h2>Recent token usage</h2><span>Usage is recorded only after completed provider requests.</span></div><Badge className="border-0 bg-white/6 text-[#d4d4df]">{usage.data?.totalRequests ?? 0} requests</Badge></div><UsageChart daily={usage.data?.daily ?? []} /></section>
    <section className="dashboard-next-section"><div className="dashboard-section-head"><div><p>BUILD WITH INTENT</p><h2>Your next useful move</h2><span>Everything needed to go from a fresh account to a measured request.</span></div></div><div className="dashboard-next-grid"><Link href="/dashboard/keys" className="dashboard-next-card"><span><KeyRound size={17} /> 01</span><h3>Create a scoped key</h3><p>Label a credential for your project and see it exactly once.</p><b>Manage keys <ArrowRight size={14} /></b></Link><Link href="/dashboard/playground" className="dashboard-next-card"><span><Terminal size={17} /> 02</span><h3>Shape a first prompt</h3><p>Test GLM-5.2 or Grok 4.5 inside the protected Playground.</p><b>Open Playground <ArrowRight size={14} /></b></Link><Link href="/docs" className="dashboard-next-card"><span><Code2 size={17} /> 03</span><h3>Ship the connection</h3><p>Copy a familiar OpenAI-compatible request into your client.</p><b>Read the docs <ArrowRight size={14} /></b></Link></div></section>
    <section className="dashboard-reference-strip"><div><LockKeyhole size={18} /><span><b>Credential handling</b><small>Provider access stays server-side; plaintext user keys are shown once.</small></span></div><Link href="/legal/terms">Trust & policies <ArrowRight size={14} /></Link></section>
  </>;
}

export default function DeveloperDashboard({ section = "overview" }: { section?: Section }) {
  const { user, loading } = useAuth();
  const usage = trpc.developer.usage.useQuery(undefined, { enabled: Boolean(user) });
  const content = section === "playground" ? <Playground /> : section === "keys" ? <><PageIntro eyebrow="Credentials" title="API keys" subtitle="Create, rotate, or revoke credentials without ever re-exposing a saved secret." /><ApiKeyList /></> : section === "usage" ? <><PageIntro eyebrow="Observability" title="Usage history" subtitle="A clear view of your recent requests and token consumption." /><section className="dashboard-usage-panel"><div className="dashboard-section-head"><div><p>LAST 14 ACTIVE DAYS</p><h2>Daily tokens</h2></div><Badge className="border-0 bg-white/6 text-[#d4d4df]">{usage.data?.totalTokens.toLocaleString() ?? 0} total</Badge></div><UsageChart daily={usage.data?.daily ?? []} /></section></> : <Overview user={user} loading={loading} usage={usage} />;
  return <DashboardLayout><div className="dashboard-page-surface"><div className="dashboard-page-content">{content}</div></div></DashboardLayout>;
}
