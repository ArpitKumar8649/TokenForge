import DashboardLayout from "@/components/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { coalesceDailyUsage } from "../../../shared/usageSeries";
import { markApiKeyRevoked, prependCreatedApiKey } from "../../../shared/apiKeyListCache";
import { useAuth } from "@/_core/hooks/useAuth";
import { AlertTriangle, ArrowRight, BarChart3, BookOpen, Check, Clipboard, Code2, Copy, Gift, KeyRound, Loader2, LockKeyhole, Plus, RefreshCw, ShieldCheck, Sparkles, Terminal, Trash2, Users } from "lucide-react";
import { FormEvent, useMemo, useState } from "react";
import { Link } from "wouter";
import { toast } from "sonner";
import "../dashboard.css";
import Playground from "./Playground";
import { CreditOverview, Profile, UsageLogs } from "./CreditWorkspace";
import { DashboardModels } from "./DashboardModels";
import { buildTokenForgeCurl, buildTokenForgeJavaScript, buildTokenForgePython, TOKENFORGE_API_BASE_URL } from "../../../shared/tokenforgeApi";
import { clearOneTimeApiKey, getOneTimeApiKey, rememberOneTimeApiKey } from "../../../shared/oneTimeApiKey";
import { buildReferralInviteUrl, TOKENFORGE_REFERRAL_REWARD_USD } from "../../../shared/referrals";

type Section = "overview" | "keys" | "usage" | "playground" | "profile" | "referrals" | "models" | "model";
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
}

function CurlExample({ apiKey }: { apiKey?: string }) {
  const [copied, setCopied] = useState(false);
  const command = buildTokenForgeCurl(apiKey);
  const copy = async () => {
    await navigator.clipboard.writeText(command);
    setCopied(true);
    toast.success(apiKey ? "cURL command with your new key copied" : "cURL template copied to clipboard");
    window.setTimeout(() => setCopied(false), 1500);
  };

  return <section className="min-w-0 overflow-hidden rounded-xl border border-white/10 bg-[#111218] p-4" aria-labelledby="curl-example-title">
    <div className="flex min-w-0 flex-wrap items-start justify-between gap-3"><div className="min-w-0 flex-1"><p className="text-[10px] font-semibold uppercase tracking-[.16em] text-[#befe6c]">Hosted endpoint</p><h3 id="curl-example-title" className="mt-1 text-sm font-bold text-white">Make your first request</h3><p className="mt-1 text-xs leading-5 text-[#9fa0af]">{apiKey ? "This one-time command contains the new plaintext key shown above. Save it securely before dismissing." : "Create or rotate a key to populate this command automatically. Until then, it uses a safe placeholder."}</p></div><Button variant="outline" size="sm" className="shrink-0 border-white/15 text-[#e4e4ea] hover:bg-white/10" onClick={copy}>{copied ? <Check size={14} /> : <Copy size={14} />}{copied ? "Copied" : "Copy cURL"}</Button></div>
    <p className="mt-3 break-all rounded-lg border border-white/8 bg-black/20 px-3 py-2 font-mono text-[10px] text-[#bfc0ca]">{TOKENFORGE_API_BASE_URL}</p>
    <pre className="mt-3 w-full min-w-0 max-w-full overflow-x-auto overscroll-x-contain rounded-lg border border-white/8 bg-[#08090d] p-3"><code className="block min-w-max font-mono text-[11px] leading-5 text-[#dfe0e7]">{command}</code></pre>
  </section>;
}

type SdkLanguage = "javascript" | "python";

function SdkQuickStart({ apiKey }: { apiKey?: string }) {
  const [language, setLanguage] = useState<SdkLanguage>("javascript");
  const [copied, setCopied] = useState(false);
  const isJavaScript = language === "javascript";
  const installCommand = isJavaScript ? "npm install openai" : "pip install openai";
  const code = isJavaScript ? buildTokenForgeJavaScript(apiKey) : buildTokenForgePython(apiKey);
  const copy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    toast.success(`${isJavaScript ? "JavaScript" : "Python"} quick-start copied`);
    window.setTimeout(() => setCopied(false), 1500);
  };

  return <section className="min-w-0 overflow-hidden rounded-xl border border-white/10 bg-[#111218] p-4" aria-labelledby="sdk-quickstart-title">
    <div className="flex min-w-0 flex-wrap items-start justify-between gap-3"><div className="min-w-0 flex-1"><p className="text-[10px] font-semibold uppercase tracking-[.16em] text-[#befe6c]">OpenAI-compatible SDKs</p><h3 id="sdk-quickstart-title" className="mt-1 text-sm font-bold text-white">Start from your language</h3><p className="mt-1 max-w-xl text-xs leading-5 text-[#9fa0af]">Use the standard OpenAI SDK with TokenForge’s hosted base URL. {apiKey ? "The selected snippet includes the new plaintext key shown above." : "Create or rotate a key to populate a selected snippet automatically."}</p></div><Button variant="outline" size="sm" className="shrink-0 border-white/15 text-[#e4e4ea] hover:bg-white/10" onClick={copy}>{copied ? <Check size={14} /> : <Copy size={14} />}{copied ? "Copied" : "Copy code"}</Button></div>
    <div className="mt-4 flex flex-wrap gap-2" role="tablist" aria-label="SDK language">
      <button type="button" role="tab" aria-selected={isJavaScript} className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${isJavaScript ? "border-[#befe6c]/40 bg-[#befe6c]/10 text-[#d9ff9d]" : "border-white/10 bg-black/15 text-[#a9aab7] hover:bg-white/5 hover:text-white"}`} onClick={() => setLanguage("javascript")}>JavaScript</button>
      <button type="button" role="tab" aria-selected={!isJavaScript} className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${!isJavaScript ? "border-[#befe6c]/40 bg-[#befe6c]/10 text-[#d9ff9d]" : "border-white/10 bg-black/15 text-[#a9aab7] hover:bg-white/5 hover:text-white"}`} onClick={() => setLanguage("python")}>Python</button>
    </div>
    <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-[#a7a8b5]"><span className="font-semibold text-[#d6d6df]">Install:</span><code className="max-w-full overflow-x-auto rounded border border-white/10 bg-black/20 px-2 py-1 font-mono text-[#dfe0e7]">{installCommand}</code></div>
    <pre className="mt-3 w-full min-w-0 max-w-full overflow-x-auto overscroll-x-contain rounded-lg border border-white/8 bg-[#08090d] p-3"><code className="block min-w-max font-mono text-[11px] leading-5 text-[#dfe0e7]">{code}</code></pre>
  </section>;
}

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
    rememberOneTimeApiKey(value.key);
  };
  const revoke = trpc.developer.revokeApiKey.useMutation({ onSuccess: (_, variables) => {
    utils.developer.apiKeys.setData(undefined, current => markApiKeyRevoked(current, variables.apiKeyId, new Date()));
    toast.success("API key revoked");
  }, onError: error => toast.error(error.message) });
  const rotate = trpc.developer.rotateApiKey.useMutation({ onSuccess: (value, variables) => {
    const record = { ...value.record, lastUsedAt: null, revokedAt: null };
    utils.developer.apiKeys.setData(undefined, current => prependCreatedApiKey(markApiKeyRevoked(current, variables.apiKeyId, new Date()), record));
    setPlainTextKey(value.key);
    rememberOneTimeApiKey(value.key);
    toast.success("Key rotated — copy the new secret now");
  }, onError: error => toast.error(error.message) });
  if (keys.isLoading) return <div className="grid min-h-48 place-items-center rounded-xl border border-white/10 bg-[#15161f]"><Loader2 className="animate-spin text-[#b89aff]" /></div>;
  const dismissPlainTextKey = () => {
    clearOneTimeApiKey();
    setPlainTextKey(null);
  };
  return <div className="space-y-3">{plainTextKey && <KeySecret value={plainTextKey} onDismiss={dismissPlainTextKey} />}<KeyCreateForm onSuccess={showNewKey} />{keys.data?.length ? <div className="overflow-hidden rounded-xl border border-white/10 bg-[#15161f]">{keys.data.map(key => <div key={key.id} className="flex flex-wrap items-center gap-3 border-b border-white/8 p-4 last:border-0"><div className="grid h-9 w-9 place-items-center rounded-lg bg-white/5 text-[#cbb7ff]"><KeyRound size={16} /></div><div className="min-w-40 flex-1"><p className="text-xs font-bold text-white">{key.label}</p><code className="mt-1 block font-mono text-[10px] text-[#9394a7]">{key.prefix}</code></div><div className="text-[10px] text-[#8e8fa1]">Created {new Date(key.createdAt).toLocaleDateString()}</div><Badge className={key.status === "active" ? "border-0 bg-[#7debbd]/10 text-[#8aefc0]" : "border-0 bg-red-400/10 text-red-300"}>{key.status}</Badge>{key.status === "active" && <div className="flex gap-1"><Button variant="ghost" size="sm" title="Rotate key" className="text-[#c7c5d2] hover:bg-white/8 hover:text-white" disabled={rotate.isPending} onClick={() => rotate.mutate({ apiKeyId: key.id, label: `${key.label.slice(0, 85)} · rotated` })}><RefreshCw size={14} /></Button><Button variant="ghost" size="sm" title="Revoke key" className="text-[#d69ca6] hover:bg-red-400/10 hover:text-red-200" disabled={revoke.isPending} onClick={() => revoke.mutate({ apiKeyId: key.id })}><Trash2 size={14} /></Button></div>}</div>)}</div> : <div className="rounded-xl border border-dashed border-white/12 p-8 text-center"><KeyRound className="mx-auto text-[#77788b]" size={22} /><p className="mt-3 text-sm font-bold text-white">No keys yet</p><p className="mt-1 text-xs text-[#9394a7]">Create a labeled key above to begin making requests.</p></div>}</div>;
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

function OverviewQuickStart() {
  const [apiKey, setApiKey] = useState(() => getOneTimeApiKey());
  const hideOneTimeKey = () => {
    clearOneTimeApiKey();
    setApiKey(null);
    toast.success("One-time key hidden from quick-start examples");
  };

  return <section className="rounded-2xl border border-white/10 bg-[#12131a] p-4 sm:p-5" aria-labelledby="overview-quickstart-title">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-[10px] font-semibold uppercase tracking-[.16em] text-[#befe6c]">Build with TokenForge</p><h2 id="overview-quickstart-title" className="mt-1 text-lg font-bold text-white">Your integration quick-start</h2><p className="mt-1 max-w-2xl text-xs leading-5 text-[#a8a9b6]">Start with cURL or the OpenAI-compatible JavaScript and Python SDKs. Create and manage credentials separately in API Keys.</p></div><Link href="/dashboard/keys" className="dashboard-outline-action"><KeyRound size={14} /> Manage keys</Link></div>
    {apiKey && <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#befe6c]/25 bg-[#befe6c]/[.06] p-3"><p className="text-xs leading-5 text-[#d9efad]">A new plaintext key is available only in this open browser page. Copy what you need, then hide it.</p><Button variant="outline" size="sm" className="border-[#befe6c]/30 text-[#d9ff9d] hover:bg-[#befe6c]/10" onClick={hideOneTimeKey}>Hide key</Button></div>}
    <div className="mt-4 grid gap-3 xl:grid-cols-2"><CurlExample apiKey={apiKey ?? undefined} /><SdkQuickStart apiKey={apiKey ?? undefined} /></div>
  </section>;
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
    <OverviewQuickStart />
    <section className="dashboard-usage-panel"><div className="dashboard-section-head"><div><p>REQUEST TELEMETRY</p><h2>Transparent activity</h2><span>Inspect model, source, token counts, and promotional-credit charge for each request.</span></div><Link href="/dashboard/usage" className="dashboard-outline-action">Usage logs <ArrowRight size={14} /></Link></div><UsageChart daily={usage.data?.daily ?? []} /></section>
    <section className="dashboard-next-section"><div className="dashboard-section-head"><div><p>BUILD WITH INTENT</p><h2>Your next useful move</h2><span>Everything needed to go from a fresh account to a measured request.</span></div></div><div className="dashboard-next-grid"><Link href="/dashboard/keys" className="dashboard-next-card"><span><KeyRound size={17} /> 01</span><h3>Create a scoped key</h3><p>Label a credential for your project and see it exactly once.</p><b>Manage keys <ArrowRight size={14} /></b></Link><Link href="/dashboard/playground" className="dashboard-next-card"><span><Terminal size={17} /> 02</span><h3>Shape a first prompt</h3><p>Test GLM-5.2 or Grok 4.5 inside the protected Playground.</p><b>Open Playground <ArrowRight size={14} /></b></Link><Link href="/docs" className="dashboard-next-card"><span><Code2 size={17} /> 03</span><h3>Ship the connection</h3><p>Copy a familiar OpenAI-compatible request into your client.</p><b>Read the docs <ArrowRight size={14} /></b></Link></div></section>
    <section className="dashboard-reference-strip"><div><LockKeyhole size={18} /><span><b>Credential handling</b><small>Provider access stays server-side; plaintext user keys are shown once.</small></span></div><Link href="/legal/terms">Trust & policies <ArrowRight size={14} /></Link></section>
  </>;
}

export default function DeveloperDashboard({ section = "overview", modelId }: { section?: Section; modelId?: string }) {
  const { user, loading } = useAuth();
  const workspaceVerified = Boolean(user?.isAdminSession || user?.discordVerifiedAt);
  const usage = trpc.developer.usage.useQuery(undefined, { enabled: Boolean(user) && workspaceVerified });
  const content = section === "playground" ? <Playground /> : section === "models" ? <DashboardModels /> : section === "model" ? <DashboardModels modelId={modelId} /> : section === "keys" ? <><PageIntro eyebrow="Credentials" title="API keys" subtitle="Create, rotate, or revoke credentials without ever re-exposing a saved secret." /><ApiKeyList /></> : section === "usage" ? <><PageIntro eyebrow="Observability" title="Usage logs" subtitle="A transparent record of request source, model, tokens, and credit cost." /><UsageLogs /></> : section === "profile" ? <><PageIntro eyebrow="Account & rewards" title="Profile" subtitle="Manage your TokenForge identity and claim your daily build credit." /><Profile /></> : section === "referrals" ? <ReferralWorkspace /> : <Overview user={user} loading={loading} usage={usage} />;
  return <DashboardLayout><div className="dashboard-page-surface"><div className="dashboard-page-content">{content}</div></div></DashboardLayout>;
}

function ReferralWorkspace() {
  const referralQuery = trpc.developer.referrals.useQuery(undefined, { refetchInterval: 5_000 });
  const [copied, setCopied] = useState(false);
  const referral = referralQuery.data;
  const inviteUrl = referral ? buildReferralInviteUrl(referral.code) : "";
  const formatCredit = (nanos: number) => `$${(nanos / 1_000_000_000).toFixed(2)}`;

  const copyInvite = async () => {
    if (!inviteUrl) return;
    await navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    toast.success("Your referral link was copied");
    window.setTimeout(() => setCopied(false), 1500);
  };

  if (referralQuery.isLoading) return <div className="dashboard-loading-panel"><Loader2 className="animate-spin" /></div>;
  if (referralQuery.error || !referral) return <div className="rounded-2xl border border-red-400/20 bg-red-400/5 p-6 text-sm text-[#f2b1b7]"><AlertTriangle className="mb-3" size={19} />Referral details could not load. Refresh this page to try again.</div>;

  return <>
    <PageIntro eyebrow="Community rewards" title="Invite builders, earn together." subtitle={`Share your unique link. When an eligible new member creates their TokenForge account with it, you both receive $${TOKENFORGE_REFERRAL_REWARD_USD.toFixed(2)} in promotional credit.`} />
    <section className="grid gap-4 xl:grid-cols-[1.18fr_.82fr]">
      <div className="rounded-2xl border border-[#befe6c]/20 bg-[radial-gradient(circle_at_80%_0%,rgba(190,254,108,.11),transparent_42%),#12131a] p-5 sm:p-6">
        <div className="flex items-start gap-3"><div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#befe6c]/12 text-[#d8ff9d]"><Gift size={19} /></div><div><p className="text-[10px] font-bold uppercase tracking-[.16em] text-[#befe6c]">Your invitation</p><h2 className="mt-1 text-xl font-bold text-white">A $10 credit for both accounts.</h2><p className="mt-2 max-w-xl text-xs leading-5 text-[#a9aab7]">Rewards are granted once after a new account is created through your link. Existing accounts, self-referrals, and repeat claims are not eligible.</p></div></div>
        <div className="mt-5 rounded-xl border border-white/10 bg-black/20 p-3"><p className="text-[10px] font-semibold uppercase tracking-[.13em] text-[#9698a8]">Your four-character affiliate link</p><div className="mt-2 flex flex-col gap-2 sm:flex-row"><code className="min-w-0 flex-1 overflow-x-auto rounded-lg border border-white/8 bg-[#090a0f] px-3 py-2.5 font-mono text-[11px] text-[#dfe0e7]">{inviteUrl}</code><Button className="bg-[#e5ffb8] text-[#233310] hover:bg-[#f1ffd3]" onClick={copyInvite}>{copied ? <Check size={15} /> : <Copy size={15} />}{copied ? "Copied" : "Copy link"}</Button></div></div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1"><div className="rounded-2xl border border-white/10 bg-[#15161f] p-5"><div className="flex items-center gap-2 text-[#befe6c]"><Users size={16} /><p className="text-[10px] font-semibold uppercase tracking-[.14em]">Successful invites</p></div><p className="mt-4 text-3xl font-bold text-white">{referral.referrals.length}</p><p className="mt-1 text-xs text-[#9597a7]">New accounts credited through your link</p></div><div className="rounded-2xl border border-white/10 bg-[#15161f] p-5"><div className="flex items-center gap-2 text-[#befe6c]"><Gift size={16} /><p className="text-[10px] font-semibold uppercase tracking-[.14em]">Invitation credit</p></div><p className="mt-4 text-3xl font-bold text-white">{formatCredit(referral.totalRewardNanos)}</p><p className="mt-1 text-xs text-[#9597a7]">Total promotional credit awarded to you</p></div></div>
    </section>
    {referral.receivedRewardNanos > 0 && <section className="mt-4 flex items-start gap-3 rounded-xl border border-[#befe6c]/20 bg-[#befe6c]/[.06] p-4"><Gift className="mt-0.5 text-[#cfff8d]" size={18} /><div><p className="text-sm font-bold text-[#efffd3]">Your welcome credit has arrived</p><p className="mt-1 text-xs leading-5 text-[#c4dca6]">You received {formatCredit(referral.receivedRewardNanos)} in referral credit when you joined TokenForge. It is available in your wallet now.</p></div></section>}
    <section className="mt-4 overflow-hidden rounded-2xl border border-white/10 bg-[#15161f]"><div className="border-b border-white/8 p-5"><p className="text-[10px] font-semibold uppercase tracking-[.14em] text-[#befe6c]">Reward activity</p><h2 className="mt-1 text-lg font-bold text-white">Your successful invitations</h2></div>{referral.referrals.length ? <div>{referral.referrals.map(item => <div key={item.id} className="flex items-center justify-between gap-4 border-b border-white/8 px-5 py-4 last:border-0"><div><p className="text-sm font-semibold text-white">New TokenForge member</p><p className="mt-1 text-[11px] text-[#9294a4]">Credited {new Date(item.createdAt).toLocaleString()}</p></div><span className="rounded-full bg-[#befe6c]/10 px-2.5 py-1 font-mono text-xs font-bold text-[#d8ff9d]">+{formatCredit(item.rewardNanos)}</span></div>)}</div> : <div className="p-8 text-center"><Users className="mx-auto text-[#767889]" size={22} /><p className="mt-3 text-sm font-bold text-white">No referral rewards yet</p><p className="mt-1 text-xs text-[#9395a5]">Share your link with a developer who has not created a TokenForge account.</p></div>}</section>
  </>;
}
