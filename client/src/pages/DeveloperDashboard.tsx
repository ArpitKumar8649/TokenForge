import DashboardLayout from "@/components/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MovingDotCard } from "@/components/ui/moving-dot-card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { TOKENFORGE_MODELS } from "@/lib/modelCatalogue";
import { coalesceDailyUsage } from "../../../shared/usageSeries";
import { markApiKeyRevoked, prependCreatedApiKey } from "../../../shared/apiKeyListCache";
import { useAuth } from "@/_core/hooks/useAuth";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  BookOpen,
  Check,
  CheckCircle2,
  Clipboard,
  Code2,
  Coins,
  Copy,
  Cpu,
  CreditCard,
  ExternalLink,
  Flame,
  Gift,
  KeyRound,
  Loader2,
  LockKeyhole,
  Play,
  Plus,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Terminal,
  Trash2,
  TrendingUp,
  Users,
  Wallet,
  WalletCards,
  X,
  Zap,
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { toast } from "sonner";
import "../dashboard.css";
import Playground from "./Playground";
import { CreditOverview, Profile, UsageLogs, formatCreditWhole, useIsCreditsEnabled } from "./CreditWorkspace";
import { DashboardModels } from "./DashboardModels";
import { DashboardPricingSection } from "@/components/dashboard/DashboardPricingSection";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { PearlButton } from "@/components/ui/pearl-button";
import { CheckoutModal } from "@/components/CheckoutModal";
import { TicketsWorkspace } from "@/components/tickets/TicketsWorkspace";
import { TransactionsWorkspace } from "@/components/TransactionsWorkspace";
import { UserTierBadge } from "@/components/UserTierBadge";
import VapourAccent from "@/components/ui/vapour-accent";
import { buildTokenForgeCurl, buildTokenForgeJavaScript, buildTokenForgePython, TOKENFORGE_API_BASE_URL } from "../../../shared/tokenforgeApi";
import { clearOneTimeApiKey, getOneTimeApiKey, rememberOneTimeApiKey } from "../../../shared/oneTimeApiKey";
import { buildReferralInviteUrl, TOKENFORGE_REFERRAL_REWARD_USD } from "../../../shared/referrals";

type Section = "overview" | "keys" | "usage" | "playground" | "profile" | "referrals" | "models" | "model" | "tickets" | "transactions" | "pricing";
type UsageData = {
  quota?: { suspended: boolean } | null;
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
  return <div className="rounded-2xl border border-white/15 bg-[#121215] p-5 shadow-2xl shadow-black/50"><div className="flex items-start gap-3"><div className="rounded-xl bg-white/10 p-2.5 text-white"><ShieldCheck size={18} /></div><div><p className="text-sm font-bold text-white">Copy this key now</p><p className="mt-1 max-w-xl text-xs leading-5 text-[#b4b3c0]">For your security, TokenForge will not show this plaintext key again after you dismiss this message.</p></div></div><div className="mt-4 flex items-center gap-2 rounded-lg border border-white/10 bg-[#09090b] p-3"><code className="min-w-0 flex-1 truncate font-mono text-xs text-white">{value}</code><Button size="sm" className="bg-[#f0efff] text-[#18151f] hover:bg-white" onClick={copy}>{copied ? <Check size={14} /> : <Copy size={14} />}{copied ? "Copied" : "Copy"}</Button></div><Button variant="outline" size="sm" className="mt-4 border-white/15 text-[#d7d6df] hover:bg-white/10" onClick={onDismiss}>I’ve saved this key</Button></div>;
}

type NewApiKeyResult = {
  key: string;
  record: { id: number; label: string; prefix: string; keyGroup?: "payg" | "bundle" | "token_plan" | "tokens" | "coding_plan"; status: "active" | "revoked"; createdAt: Date };
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

  return <section className="min-w-0 overflow-hidden rounded-xl border border-white/10 bg-[#09090b] p-4" aria-labelledby="curl-example-title">
    <div className="flex min-w-0 flex-wrap items-start justify-between gap-3"><div className="min-w-0 flex-1"><p className="text-[10px] font-semibold uppercase tracking-[.16em] text-[#befe6c]">Hosted endpoint</p><h3 id="curl-example-title" className="mt-1 text-sm font-bold text-white">Make your first request</h3><p className="mt-1 text-xs leading-5 text-[#9fa0af]">{apiKey ? "This one-time command contains the new plaintext key shown above. Save it securely before dismissing." : "Create or rotate a key to populate this command automatically. Until then, it uses a safe placeholder."}</p></div><Button variant="outline" size="sm" className="shrink-0 border-white/15 text-[#e4e4ea] hover:bg-white/10" onClick={copy}>{copied ? <Check size={14} /> : <Copy size={14} />}{copied ? "Copied" : "Copy cURL"}</Button></div>
    <p className="mt-3 break-all rounded-lg border border-white/8 bg-black/40 px-3 py-2 font-mono text-[10px] text-[#bfc0ca]">{TOKENFORGE_API_BASE_URL}</p>
    <pre className="mt-3 w-full min-w-0 max-w-full overflow-x-auto overscroll-x-contain rounded-lg border border-white/8 bg-[#000000] p-3"><code className="block min-w-max font-mono text-[11px] leading-5 text-[#dfe0e7]">{command}</code></pre>
  </section>;
}

type SdkLanguage = "javascript" | "python";

function SdkQuickStart({ apiKey }: { apiKey?: string }) {
  const [language, setLanguage] = useState<SdkLanguage>("javascript");
  const [copied, setCopied] = useState(false);
  const isJavaScript = language === "javascript";
  const installCommand = isJavaScript ? "npm install @anthropic-ai/sdk" : "pip install anthropic";
  const code = isJavaScript ? buildTokenForgeJavaScript(apiKey) : buildTokenForgePython(apiKey);
  const copy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    toast.success(`${isJavaScript ? "JavaScript" : "Python"} quick-start copied`);
    window.setTimeout(() => setCopied(false), 1500);
  };

  return <section className="min-w-0 overflow-hidden rounded-xl border border-white/10 bg-[#09090b] p-4" aria-labelledby="sdk-quickstart-title">
    <div className="flex min-w-0 flex-wrap items-start justify-between gap-3"><div className="min-w-0 flex-1"><p className="text-[10px] font-semibold uppercase tracking-[.16em] text-[#befe6c]">Anthropic Messages SDK</p><h3 id="sdk-quickstart-title" className="mt-1 text-sm font-bold text-white">Start from your language</h3><p className="mt-1 max-w-xl text-xs leading-5 text-[#9fa0af]">Use the standard Anthropic SDK with TokenForge’s hosted base URL. {apiKey ? "The selected snippet includes the new plaintext key shown above." : "Create or rotate a key to populate a selected snippet automatically."}</p></div><Button variant="outline" size="sm" className="shrink-0 border-white/15 text-[#e4e4ea] hover:bg-white/10" onClick={copy}>{copied ? <Check size={14} /> : <Copy size={14} />}{copied ? "Copied" : "Copy code"}</Button></div>
    <div className="mt-4 flex flex-wrap gap-2" role="tablist" aria-label="SDK language">
      <button type="button" role="tab" aria-selected={isJavaScript} className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${isJavaScript ? "border-[#befe6c]/40 bg-[#befe6c]/10 text-[#d9ff9d]" : "border-white/10 bg-black/15 text-[#a9aab7] hover:bg-white/5 hover:text-white"}`} onClick={() => setLanguage("javascript")}>JavaScript</button>
      <button type="button" role="tab" aria-selected={!isJavaScript} className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${!isJavaScript ? "border-[#befe6c]/40 bg-[#befe6c]/10 text-[#d9ff9d]" : "border-white/10 bg-black/15 text-[#a9aab7] hover:bg-white/5 hover:text-white"}`} onClick={() => setLanguage("python")}>Python</button>
    </div>
    <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-[#a7a8b5]"><span className="font-semibold text-[#d6d6df]">Install:</span><code className="max-w-full overflow-x-auto rounded border border-white/10 bg-black/40 px-2 py-1 font-mono text-[#dfe0e7]">{installCommand}</code></div>
    <pre className="mt-3 w-full min-w-0 max-w-full overflow-x-auto overscroll-x-contain rounded-lg border border-white/8 bg-[#000000] p-3"><code className="block min-w-max font-mono text-[11px] leading-5 text-[#dfe0e7]">{code}</code></pre>
  </section>;
}

function KeyCreateForm({ onSuccess, activeCount = 0 }: { onSuccess: (value: NewApiKeyResult) => void; activeCount?: number }) {
  const { user } = useAuth();
  const emailLower = (user?.email ?? "").trim().toLowerCase();
  const isWhitelistedUser = emailLower === "konchoor@gmail.com" || emailLower === "kumaryush18@gmail.com";
  const creditsEnabled = isWhitelistedUser || Boolean((user as any)?.creditsEnabled);
  const isLimitReached = activeCount >= 10;

  const [label, setLabel] = useState("");
  const [keyGroup, setKeyGroup] = useState<"token_plan" | "payg" | "bundle">("token_plan");

  const create = trpc.developer.createApiKey.useMutation({
    onSuccess: (value) => {
      onSuccess(value as unknown as NewApiKeyResult);
      setLabel("");
      const typeLabel =
        keyGroup === "token_plan"
          ? "Tier 2 (Token Plan / Coding Tokens)"
          : keyGroup === "payg"
          ? "Tier 1 (PAYG)"
          : "Tier 3 (Credit Bundle)";
      toast.success(`New ${typeLabel} API key created`);
    },
    onError: (error) => toast.error(error.message),
  });
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (isLimitReached) {
      toast.error("Maximum limit of 10 active API keys reached. Please delete or revoke an existing key first.");
      return;
    }
    create.mutate({ label, keyGroup });
  };

  return (
    <form onSubmit={submit} className="rounded-2xl border border-white/10 bg-[#09090b] p-4 sm:p-5">
      <div className="space-y-4">
        {isLimitReached && (
          <div className="flex items-center gap-2.5 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5 text-xs text-amber-200">
            <AlertTriangle size={16} className="shrink-0 text-amber-400" />
            <div className="flex-1">
              <strong className="font-semibold text-amber-300">Active API Key Limit Reached (10/10):</strong> You have 10 active API keys. Please delete or revoke an existing key before generating a new one.
            </div>
          </div>
        )}

        <div>
          <div className="flex items-center justify-between">
            <Label className="text-xs font-semibold text-[#d7d6df]">Select Key Group & Compute Routing</Label>
            <div className="flex items-center gap-2">
              <Badge className={activeCount >= 10 ? "border-amber-500/40 bg-amber-500/15 text-amber-300 text-[10px]" : "border-white/10 bg-white/5 text-[#a0a1b2] text-[10px]"}>
                {activeCount} / 10 Active Keys
              </Badge>
              <span className="text-[10px] text-[#8e8fa1]">Quota policy</span>
            </div>
          </div>
          <div className={`mt-2.5 grid grid-cols-1 gap-2.5 ${creditsEnabled ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>
            {/* Option 1: Token Plan (Coding Tokens) */}
            <button
              type="button"
              onClick={() => setKeyGroup("token_plan")}
              className={`flex flex-col items-start rounded-xl border p-3.5 text-left transition-all cursor-pointer ${
                keyGroup === "token_plan"
                  ? "border-cyan-500/60 bg-cyan-500/10 text-white shadow-[0_0_20px_rgba(6,182,212,0.15)] ring-1 ring-cyan-500/30"
                  : "border-white/10 bg-[#121215] text-[#9394a7] hover:border-white/20 hover:text-white"
              }`}
            >
              <div className="flex w-full items-center justify-between">
                <span className="text-xs font-bold text-white flex items-center gap-1.5">
                  <Code2 size={13} className="text-cyan-400" />
                  <span>Tier 2: Token Plan</span>
                </span>
                <Badge className={keyGroup === "token_plan" ? "border-0 bg-cyan-500/20 text-cyan-300 text-[9px]" : "border-0 bg-white/10 text-[#8e8fa1] text-[9px]"}>
                  Coding Plan
                </Badge>
              </div>
              <p className="mt-1.5 text-[11px] leading-4 text-[#a0a1b2]">
                Deducts strictly from Coding Plan token quota (Claude Opus 5.5, GPT 6 Sol, GLM-5.3, etc.).
              </p>
            </button>

            {/* Option 2: PAYG API Key */}
            <button
              type="button"
              onClick={() => setKeyGroup("payg")}
              className={`flex flex-col items-start rounded-xl border p-3.5 text-left transition-all cursor-pointer ${
                keyGroup === "payg"
                  ? "border-rose-500/60 bg-rose-500/10 text-white shadow-[0_0_20px_rgba(244,63,94,0.15)] ring-1 ring-rose-500/30"
                  : "border-white/10 bg-[#121215] text-[#9394a7] hover:border-white/20 hover:text-white"
              }`}
            >
              <div className="flex w-full items-center justify-between">
                <span className="text-xs font-bold text-white flex items-center gap-1.5">
                  <Zap size={13} className="text-rose-400" />
                  <span>Tier 1: PAYG Key</span>
                </span>
                <Badge className={keyGroup === "payg" ? "border-0 bg-rose-500/25 text-rose-300 text-[9px]" : "border-0 bg-white/10 text-[#8e8fa1] text-[9px]"}>
                  100% Bonus
                </Badge>
              </div>
              <p className="mt-1.5 text-[11px] leading-4 text-[#a0a1b2]">
                Deducts strictly from PAYG balance at official zero-markup provider rates.
              </p>
            </button>

            {/* Option 3: Credit Bundles (when enabled) */}
            {creditsEnabled && (
              <button
                type="button"
                onClick={() => setKeyGroup("bundle")}
                className={`flex flex-col items-start rounded-xl border p-3.5 text-left transition-all cursor-pointer ${
                  keyGroup === "bundle"
                    ? "border-[#befe6c]/60 bg-[#befe6c]/10 text-white shadow-[0_0_20px_rgba(190,254,108,0.12)] ring-1 ring-[#befe6c]/30"
                    : "border-white/10 bg-[#121215] text-[#9394a7] hover:border-white/20 hover:text-white"
                }`}
              >
                <div className="flex w-full items-center justify-between">
                  <span className="text-xs font-bold text-white flex items-center gap-1.5">
                    <WalletCards size={13} className="text-[#c9ff73]" />
                    <span>Tier 3: Bundles</span>
                  </span>
                  <Badge className={keyGroup === "bundle" ? "border-0 bg-[#befe6c]/20 text-[#befe6c] text-[9px]" : "border-0 bg-white/10 text-[#8e8fa1] text-[9px]"}>
                    Fixed Credit
                  </Badge>
                </div>
                <p className="mt-1.5 text-[11px] leading-4 text-[#a0a1b2]">
                  Deducts from promotional platform credit bundles.
                </p>
              </button>
            )}
          </div>
        </div>

        <div>
          <Label htmlFor="key-label" className="text-xs text-[#d7d6df]">
            Key label
          </Label>
          <div className="mt-2 flex gap-2">
            <Input
              id="key-label"
              value={label}
              onChange={(event) => setLabel(event.target.value)}
              placeholder={isLimitReached ? "Revoke or delete an existing key to create a new one" : "e.g. cursor ide token-plan, coding backend, claude code"}
              maxLength={100}
              disabled={isLimitReached}
              className="border-white/12 bg-[#121215] text-white placeholder:text-[#6f7181] disabled:opacity-50"
            />
            <Button
              type="submit"
              disabled={!label.trim() || create.isPending || isLimitReached}
              className="shrink-0 bg-[#f0efff] text-[#18151f] hover:bg-white font-semibold cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {create.isPending ? <Loader2 className="animate-spin" size={15} /> : <Plus size={15} />} Create Key
            </Button>
          </div>
        </div>
      </div>
    </form>
  );
}

function ApiKeyList() {
  const keys = trpc.developer.apiKeys.useQuery();
  const utils = trpc.useUtils();
  const [plainTextKey, setPlainTextKey] = useState<string | null>(null);
  const showNewKey = (value: NewApiKeyResult) => {
    const record = { ...value.record, lastUsedAt: null, revokedAt: null };
    utils.developer.apiKeys.setData(undefined, (current) => prependCreatedApiKey(current, record as never));
    setPlainTextKey(value.key);
    rememberOneTimeApiKey(value.key);
  };
  const revoke = trpc.developer.revokeApiKey.useMutation({
    onSuccess: (_, variables) => {
      // Permanently remove from client cache
      utils.developer.apiKeys.setData(undefined, (current) =>
        current ? current.filter((k) => k.id !== variables.apiKeyId) : []
      );
      toast.success("API key deleted permanently");
    },
    onError: (error) => toast.error(error.message),
  });
  const rotate = trpc.developer.rotateApiKey.useMutation({
    onSuccess: (value, variables) => {
      const record = { ...value.record, lastUsedAt: null, revokedAt: null };
      utils.developer.apiKeys.setData(undefined, (current) =>
        prependCreatedApiKey((current || []).filter((k) => k.id !== variables.apiKeyId), record as never)
      );
      setPlainTextKey(value.key);
      rememberOneTimeApiKey(value.key);
      toast.success("Key rotated — copy the new secret now");
    },
    onError: (error) => toast.error(error.message),
  });
  if (keys.isLoading)
    return (
      <div className="grid min-h-48 place-items-center rounded-xl border border-white/10 bg-[#09090b]">
        <Loader2 className="animate-spin text-white" />
      </div>
    );
  const dismissPlainTextKey = () => {
    clearOneTimeApiKey();
    setPlainTextKey(null);
  };

  const activeKeys = (keys.data || []).filter((k) => k.status === "active");
  const activeCount = activeKeys.length;

  return (
    <div className="space-y-3">
      {plainTextKey && <KeySecret value={plainTextKey} onDismiss={dismissPlainTextKey} />}
      <KeyCreateForm onSuccess={showNewKey} activeCount={activeCount} />
      {keys.data?.length ? (
        <div className="overflow-hidden rounded-xl border border-white/10 bg-[#09090b]">
          {keys.data.map((key) => {
            const rawGroup = (key as any).keyGroup;
            const isTokenPlan = rawGroup === "token_plan" || rawGroup === "tokens" || rawGroup === "coding_plan";
            const isPayg = rawGroup === "payg";
            return (
              <div
                key={key.id}
                className="flex flex-wrap items-center gap-3 border-b border-white/8 p-4 last:border-0"
              >
                <div className="grid h-9 w-9 place-items-center rounded-lg bg-white/5 text-white">
                  <KeyRound size={16} />
                </div>
                <div className="min-w-40 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-xs font-bold text-white">{key.label}</p>
                    {isTokenPlan ? (
                      <Badge className="border border-cyan-500/30 bg-cyan-500/15 text-cyan-300 font-mono text-[9px] px-1.5 py-0.5 flex items-center gap-1">
                        <Code2 size={10} /> Tier 2: Token Plan
                      </Badge>
                    ) : isPayg ? (
                      <Badge className="border border-rose-500/30 bg-rose-500/15 text-rose-300 font-mono text-[9px] px-1.5 py-0.5 flex items-center gap-1">
                        <Zap size={10} /> Tier 1: PAYG
                      </Badge>
                    ) : (
                      <Badge className="border border-[#befe6c]/30 bg-[#befe6c]/10 text-[#befe6c] font-mono text-[9px] px-1.5 py-0.5 flex items-center gap-1">
                        <WalletCards size={10} /> Tier 3: Bundles
                      </Badge>
                    )}
                  </div>
                  <code className="mt-1 block font-mono text-[10px] text-[#9394a7]">{key.prefix}</code>
                </div>
                <div className="text-[10px] text-[#8e8fa1]">
                  Created {new Date(key.createdAt).toLocaleDateString()}
                </div>
                <Badge
                  className={
                    key.status === "active"
                      ? "border-0 bg-[#7debbd]/10 text-[#8aefc0]"
                      : "border-0 bg-red-400/10 text-red-300"
                  }
                >
                  {key.status}
                </Badge>
                {key.status === "active" && (
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      title="Rotate key"
                      className="text-[#c7c5d2] hover:bg-white/8 hover:text-white"
                      disabled={rotate.isPending}
                      onClick={() =>
                        rotate.mutate({
                          apiKeyId: key.id,
                          label: `${key.label.slice(0, 85)} · rotated`,
                          keyGroup: (key as any).keyGroup,
                        })
                      }
                    >
                      <RefreshCw size={14} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      title="Delete / Revoke API key permanently"
                      className="text-[#d69ca6] hover:bg-red-400/10 hover:text-red-200"
                      disabled={revoke.isPending}
                      onClick={() => {
                        if (confirm(`Are you sure you want to permanently delete API key "${key.label}"?`)) {
                          revoke.mutate({ apiKeyId: key.id });
                        }
                      }}
                    >
                      <Trash2 size={14} />
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-white/12 p-8 text-center">
          <KeyRound className="mx-auto text-[#77788b]" size={22} />
          <p className="mt-3 text-sm font-bold text-white">No keys yet</p>
          <p className="mt-1 text-xs text-[#9394a7]">Create a labeled key above to begin making requests.</p>
        </div>
      )}
    </div>
  );
}

function UsageChart({ daily }: { daily: { day: string; requests: number; tokens: number }[] }) {
  const data = useMemo(() => coalesceDailyUsage(daily).slice(-14), [daily]);
  const max = Math.max(1, ...data.map(row => row.tokens));
  if (!data.length) return <div className="dashboard-empty-chart"><BarChart3 size={24} /><p>Usage will appear here after your first successful request.</p></div>;
  return <div className="usage-chart-bars">{data.map(row => <div key={row.day} className="usage-chart-bar"><div className="usage-chart-bar__track"><div className="usage-chart-bar__fill" style={{ height: `${Math.max(4, Math.round((row.tokens / max) * 100))}%` }}><span>{row.tokens.toLocaleString()}</span></div></div><small>{row.day.slice(5)}</small></div>)}</div>;
}

function PageIntro({ eyebrow, title, subtitle, action }: { eyebrow: string; title: React.ReactNode; subtitle: string; action?: React.ReactNode }) {
  return <div className="dashboard-page-intro"><div><p>{eyebrow}</p><h1>{title}</h1><span>{subtitle}</span></div>{action}</div>;
}

function OverviewQuickStart() {
  const [apiKey, setApiKey] = useState(() => getOneTimeApiKey());
  const hideOneTimeKey = () => {
    clearOneTimeApiKey();
    setApiKey(null);
    toast.success("One-time key hidden from quick-start examples");
  };

  return <section className="rounded-2xl border border-white/10 bg-[#09090b] p-4 sm:p-5" aria-labelledby="overview-quickstart-title">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-[10px] font-semibold uppercase tracking-[.16em] text-[#befe6c]">Build with TokenForge</p><h2 id="overview-quickstart-title" className="mt-1 text-lg font-bold text-white">Your integration quick-start</h2><p className="mt-1 max-w-2xl text-xs leading-5 text-[#a8a9b6]">Start with cURL or the Anthropic Messages JavaScript and Python SDKs. Create and manage credentials separately in API Keys.</p></div><Link href="/dashboard/keys" className="dashboard-outline-action"><KeyRound size={14} /> Manage keys</Link></div>
    {apiKey && <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#befe6c]/25 bg-[#befe6c]/[.06] p-3"><p className="text-xs leading-5 text-[#d9efad]">A new plaintext key is available only in this open browser page. Copy what you need, then hide it.</p><Button variant="outline" size="sm" className="border-[#befe6c]/30 text-[#d9ff9d] hover:bg-[#befe6c]/10" onClick={hideOneTimeKey}>Hide key</Button></div>}
    <div className="mt-4 grid gap-3 xl:grid-cols-2"><CurlExample apiKey={apiKey ?? undefined} /><SdkQuickStart apiKey={apiKey ?? undefined} /></div>
  </section>;
}

function PlatformUsageMetrics() {
  const metrics = trpc.public.modelTokenMetrics.useQuery(undefined, {
    refetchInterval: 15_000,
    staleTime: 10_000,
    refetchOnWindowFocus: true,
  });
  const totalTokens = metrics.data?.totalTokens ?? 0;
  const refreshedAt = metrics.dataUpdatedAt ? new Date(metrics.dataUpdatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : null;

  return <section className="mt-5" aria-labelledby="platform-usage-title">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div><div className="flex items-center gap-2 text-[#8df1f5]"><span className="relative flex h-2.5 w-2.5"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#79e8ef] opacity-50" /><span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[#79e8ef]" /></span><p className="text-[10px] font-bold uppercase tracking-[.18em]">Live platform activity</p></div><h2 id="platform-usage-title" className="mt-2 text-xl font-bold tracking-[-.025em] text-white sm:text-2xl">TokenForge tokens processed</h2><p className="mt-2 max-w-2xl text-xs leading-5 text-[#a9bcc1]">Exact lifetime successful-token total across TokenForge. Refreshes automatically every 15 seconds while this overview is open.</p></div>
      <div className="flex items-center gap-2 self-start rounded-full border border-[#79e8ef]/20 bg-[#79e8ef]/[.07] px-3 py-1.5 font-mono text-[10px] text-[#b6f7f8] sm:self-auto"><RefreshCw size={12} className={metrics.isFetching ? "animate-spin" : ""} />{metrics.isFetching ? "Refreshing" : refreshedAt ? `Updated ${refreshedAt}` : "Connecting"}</div>
    </div>
    {metrics.isLoading ? <div className="mt-4 grid min-h-56 place-items-center rounded-3xl border border-[#befe6c]/25 bg-[#111710]"><Loader2 className="animate-spin text-[#caff8e]" size={20} /></div> : <MovingDotCard target={totalTokens} label="Tokens processed" description="Exact lifetime successful-token total" className="mt-4 tf-moving-dot-card--dashboard" />}
  </section>;
}

function UnifiedBalancesPortfolio() {
  const wallet = trpc.developer.wallet.useQuery();
  const utils = trpc.useUtils();
  const creditsEnabled = useIsCreditsEnabled(wallet.data?.creditsEnabled);

  const claimCheckin = trpc.developer.claimDailyCheckin.useMutation({
    onSuccess: (res) => {
      if (res.claimed) {
        toast.success(`🎉 Daily reward claimed: ${res.rewardFormatted} added to your balance!`);
      } else {
        toast.info("You have already claimed today's UTC check-in reward.");
      }
      void utils.developer.wallet.invalidate();
    },
    onError: (err) => toast.error(err.message || "Failed to claim check-in reward"),
  });

  const data = wallet.data;
  const paygBalanceNanos = Number((data as any)?.paygBalanceNanos ?? 0);
  const codingPlanTokens = Number((data as any)?.codingPlanTokens ?? 0);
  const bundleBalanceNanos = Number(data?.balanceNanos ?? 0);

  const formattedCodingTokens =
    codingPlanTokens >= 1_000_000
      ? `${(codingPlanTokens / 1_000_000).toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 2 })}M`
      : codingPlanTokens.toLocaleString();

  return (
    <section className="rounded-3xl border border-white/10 bg-gradient-to-b from-[#131715] via-[#0d100e] to-[#080a09] p-5 sm:p-7 shadow-2xl backdrop-blur-xl relative overflow-hidden mb-6">
      {/* Decorative gradient backdrops */}
      <div className="absolute top-0 right-0 h-64 w-64 rounded-full bg-cyan-500/5 blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 h-64 w-64 rounded-full bg-[#c9ff73]/5 blur-3xl pointer-events-none" />

      {/* Header bar of Portfolio */}
      <div className="relative z-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-white/8">
        <div>
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan-400 opacity-60" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-cyan-400" />
            </span>
            <p className="text-[10px] font-bold uppercase tracking-[.18em] text-[#9ba398]">Compute & Balance Portfolio</p>
          </div>
          <h2 className="mt-1 text-xl sm:text-2xl font-extrabold text-white tracking-tight">Active Available Quotas</h2>
        </div>

        {/* Single Pay / Top Up Button */}
        <div className="flex items-center gap-3 flex-wrap">
          <Link href="/dashboard/pricing">
            <Button
              type="button"
              className="px-5 py-2.5 rounded-xl text-xs font-bold text-black bg-gradient-to-r from-[#c9ff73] via-[#a8f34f] to-[#72e6db] hover:opacity-95 shadow-lg shadow-[#c9ff73]/20 transition-all cursor-pointer flex items-center gap-2 h-auto"
            >
              <Zap size={14} className="fill-black" />
              <span>Add Balance & Plans</span>
              <ArrowUpRight size={14} />
            </Button>
          </Link>
        </div>
      </div>

      {/* 3 Balances Grid */}
      <div className={`relative z-10 mt-6 grid grid-cols-1 ${creditsEnabled ? "md:grid-cols-3" : "md:grid-cols-2"} gap-4`}>
        {/* Tier 2: Dedicated Coding Plan Tokens */}
        <div className="group relative overflow-hidden rounded-2xl border border-cyan-500/25 bg-gradient-to-br from-cyan-950/30 via-[#0a1218]/90 to-black/90 p-5 transition-all duration-300 hover:border-cyan-500/40 hover:shadow-lg hover:shadow-cyan-500/10 flex flex-col justify-between">
          <div className="absolute -top-12 -right-12 h-28 w-28 rounded-full bg-cyan-500/10 blur-2xl pointer-events-none group-hover:bg-cyan-500/20 transition-all" />

          <div>
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-cyan-500/15 text-cyan-300 border border-cyan-500/20">
                  <Code2 size={15} />
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-cyan-300 font-mono">Tier 2: Coding Tokens</p>
                  <p className="text-[10px] text-neutral-400">Opus 5 & GLM 5.3 Quota</p>
                </div>
              </div>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold bg-cyan-500/15 border border-cyan-500/30 text-cyan-200 font-mono">
                10M / $1
              </span>
            </div>

            <div className="mt-5">
              <div className="flex items-baseline gap-2">
                <span className="text-3xl sm:text-4xl font-extrabold font-mono tracking-tight text-white">
                  {formattedCodingTokens}
                </span>
                <span className="text-xs font-mono font-bold text-cyan-300 uppercase tracking-wider">
                  {codingPlanTokens >= 1_000_000 ? "Tokens Quota" : "Tokens"}
                </span>
              </div>
              <p className="mt-2 text-[11px] leading-relaxed text-neutral-300">
                Dedicated high-throughput token pool for coding assistants and CLI tools.
              </p>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-cyan-500/15 flex items-center justify-between text-[11px]">
            <span className="text-cyan-400/80 font-medium">Auto-deducted on requests</span>
            <Link href="/dashboard/pricing" className="text-cyan-300 hover:text-white font-semibold flex items-center gap-1 hover:underline">
              <span>Get Tokens</span>
              <ArrowRight size={11} />
            </Link>
          </div>
        </div>

        {/* Tier 1: PAYG Compute Wallet */}
        <div className="group relative overflow-hidden rounded-2xl border border-rose-500/25 bg-gradient-to-br from-rose-950/30 via-[#140b10]/90 to-black/90 p-5 transition-all duration-300 hover:border-rose-500/40 hover:shadow-lg hover:shadow-rose-500/10 flex flex-col justify-between">
          <div className="absolute -top-12 -right-12 h-28 w-28 rounded-full bg-rose-500/10 blur-2xl pointer-events-none group-hover:bg-rose-500/20 transition-all" />

          <div>
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-rose-500/15 text-rose-300 border border-rose-500/20">
                  <Zap size={15} />
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-rose-300 font-mono">Tier 1: PAYG Compute</p>
                  <p className="text-[10px] text-neutral-400">Zero-Markup Direct</p>
                </div>
              </div>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold bg-rose-500/15 border border-rose-500/30 text-rose-200 font-mono">
                +100% Bonus (2x)
              </span>
            </div>

            <div className="mt-5">
              <div className="flex items-baseline gap-2">
                <span className="text-3xl sm:text-4xl font-extrabold font-mono tracking-tight text-white">
                  {formatCreditWhole(paygBalanceNanos)}
                </span>
                <span className="text-xs font-mono font-bold text-neutral-400">USD</span>
              </div>
              <p className="mt-2 text-[11px] leading-relaxed text-neutral-300">
                Settles at official upstream provider rates. Balance never expires.
              </p>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-rose-500/15 flex items-center justify-between text-[11px]">
            <span className="text-rose-400/80 font-medium">All PAYG Tagged Models</span>
            <Link href="/dashboard/pricing" className="text-rose-300 hover:text-white font-semibold flex items-center gap-1 hover:underline">
              <span>Deposit PAYG</span>
              <ArrowRight size={11} />
            </Link>
          </div>
        </div>

        {/* Tier 3: Credit Wallet (when enabled) */}
        {creditsEnabled && (
          <div className="group relative overflow-hidden rounded-2xl border border-[#c9ff73]/25 bg-gradient-to-br from-[#121c10]/40 via-[#0d130d]/90 to-black/90 p-5 transition-all duration-300 hover:border-[#c9ff73]/40 hover:shadow-lg hover:shadow-[#c9ff73]/10 flex flex-col justify-between">
            <div className="absolute -top-12 -right-12 h-28 w-28 rounded-full bg-[#c9ff73]/10 blur-2xl pointer-events-none group-hover:bg-[#c9ff73]/20 transition-all" />

            <div>
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#c9ff73]/15 text-[#c9ff73] border border-[#c9ff73]/20">
                    <WalletCards size={15} />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-[#c9ff73] font-mono">Tier 3: Credit Wallet</p>
                    <p className="text-[10px] text-neutral-400">Platform Compute</p>
                  </div>
                </div>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold bg-[#c9ff73]/15 border border-[#c9ff73]/30 text-[#c9ff73] font-mono">
                  Bundles
                </span>
              </div>

              <div className="mt-5">
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl sm:text-4xl font-extrabold font-mono tracking-tight text-white">
                    {formatCreditWhole(bundleBalanceNanos)}
                  </span>
                  <span className="text-xs font-mono font-bold text-neutral-400">USD</span>
                </div>
                <p className="mt-2 text-[11px] leading-relaxed text-neutral-300">
                  Fixed credit bundles for standard model calls and development.
                </p>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-[#c9ff73]/15 flex items-center justify-between text-[11px]">
              <span className="text-[#c9ff73]/80 font-medium">Standard Bundle Models</span>
              <Link href="/dashboard/pricing" className="text-[#c9ff73] hover:text-white font-semibold flex items-center gap-1 hover:underline">
                <span>Buy Bundle</span>
                <ArrowRight size={11} />
              </Link>
            </div>
          </div>
        )}
      </div>

      {/* Daily Check-in Claim & Quick Status Footer */}
      <div className="relative z-10 mt-5 pt-4 border-t border-white/8 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 text-[#9da598]">
          <ShieldCheck size={14} className="text-[#c9ff73]" />
          <span>Real-time multi-rail settlements via UPI & Solana with zero transaction fees.</span>
        </div>

        {data?.canCheckIn ? (
          <Button
            size="sm"
            onClick={() => claimCheckin.mutate()}
            disabled={claimCheckin.isPending}
            className="w-full sm:w-auto bg-gradient-to-r from-amber-400 to-yellow-500 text-black font-bold text-xs hover:brightness-105 shadow-md shadow-amber-500/20 cursor-pointer"
          >
            {claimCheckin.isPending ? <Loader2 size={13} className="animate-spin" /> : <Gift size={13} />}
            <span>Claim Free Daily Reward ($0.01 - $2.00)</span>
          </Button>
        ) : (
          <div className="flex items-center gap-1.5 text-[11px] text-[#c9ff73] bg-[#c9ff73]/10 border border-[#c9ff73]/20 px-3 py-1 rounded-full font-medium">
            <CheckCircle2 size={13} />
            <span>Today's UTC reward claimed</span>
          </div>
        )}
      </div>
    </section>
  );
}

function Overview({ user, loading, usage }: { user: ReturnType<typeof useAuth>["user"]; loading: boolean; usage: { data?: UsageData; isLoading: boolean } }) {
  const quota = usage.data?.quota;
  if (loading || usage.isLoading) return <div className="dashboard-loading-panel"><Loader2 className="animate-spin" /></div>;
  const firstName = user?.name ? user.name.split(" ")[0] : "";
  const greetingTexts = firstName
    ? [`Good to see you, ${firstName}.`, "Your models are ready.", "High-throughput Gateway Active."]
    : ["Good to see you.", "Your models are ready.", "High-throughput Gateway Active."];

  return (
    <>
      {/* Top Welcome & Navigation Action Header */}
      <PageIntro
        eyebrow="Workspace Control Surface"
        title={
          <>
            <span className="block text-white/90">Welcome back</span>
            <VapourAccent
              texts={greetingTexts}
              color="#c9ff73"
              fontWeight={800}
              fontStyle="normal"
              fontFamily="'Manrope', sans-serif"
            />
          </>
        }
        subtitle="Real-time multi-tier compute management, instant token allocations, and high-concurrency model routing."
        action={
          <div className="flex items-center gap-2.5 flex-wrap">
            <UserTierBadge tier={(user as any)?.tier} showTag size="md" />
            <Link href="/dashboard/pricing" className="dashboard-outline-action border-[#c9ff73]/30 bg-[#c9ff73]/10 text-[#d9ff9d] hover:bg-[#c9ff73]/20 font-bold">
              <Zap size={14} className="text-[#c9ff73]" /> Recharge / Pricing
            </Link>
            <Link href="/docs" className="dashboard-outline-action">
              <BookOpen size={14} /> API reference
            </Link>
          </div>
        }
      />

      {/* Unified Balances & Token Allocation Bento */}
      <UnifiedBalancesPortfolio />

      {/* 2-Column Command & Performance Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 mb-6">
        {/* Left 7 Columns: Personal Activity & Gateway Status */}
        <div className="lg:col-span-7 flex flex-col justify-between rounded-3xl border border-white/10 bg-gradient-to-br from-[#151a17] via-[#0f1311] to-[#080a09] p-6 shadow-xl">
          <div>
            <div className="flex items-center justify-between pb-4 border-b border-white/8">
              <div className="flex items-center gap-2">
                <Activity size={15} className="text-[#c9ff73]" />
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#a5b797]">Gateway Telemetry</span>
              </div>
              <Badge className={quota?.suspended ? "border-0 bg-red-400/10 text-red-300" : "border-0 bg-[#c9ff73]/10 text-[#cbff8b]"}>
                {quota?.suspended ? "Suspended" : "● Operational & Active"}
              </Badge>
            </div>

            <h3 className="mt-4 text-xl font-bold text-white tracking-tight">Zero Artificial Rate Limiting</h3>
            <p className="mt-1 text-xs text-[#95a192] leading-relaxed">
              TokenForge operates without per-minute or concurrent cap constraints. Every request is settled atomically against your selected balance tier.
            </p>

            <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div className="rounded-xl border border-white/8 bg-black/40 p-3.5">
                <p className="text-[10px] uppercase font-bold text-neutral-400 tracking-wider">Lifetime Requests</p>
                <p className="mt-1 text-xl font-mono font-bold text-white">{(usage.data?.totalRequests ?? 0).toLocaleString()}</p>
                <span className="text-[9px] text-[#8ea087]">Successful calls</span>
              </div>

              <div className="rounded-xl border border-white/8 bg-black/40 p-3.5">
                <p className="text-[10px] uppercase font-bold text-cyan-400 tracking-wider">Tokens Processed</p>
                <p className="mt-1 text-xl font-mono font-bold text-cyan-300">{(usage.data?.totalTokens ?? 0).toLocaleString()}</p>
                <span className="text-[9px] text-cyan-500/80">Input + output</span>
              </div>

              <div className="col-span-2 sm:col-span-1 rounded-xl border border-white/8 bg-black/40 p-3.5 flex flex-col justify-between">
                <div>
                  <p className="text-[10px] uppercase font-bold text-[#c9ff73] tracking-wider">Direct Actions</p>
                  <p className="mt-1 text-xs font-semibold text-white">Interactive Test</p>
                </div>
                <Link href="/dashboard/playground" className="mt-2 inline-flex items-center gap-1 text-[11px] font-bold text-[#c9ff73] hover:underline">
                  <span>Open Playground</span>
                  <ArrowRight size={12} />
                </Link>
              </div>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-white/8 flex items-center justify-between flex-wrap gap-2 text-[11px] text-[#919c8d]">
            <span className="flex items-center gap-1.5"><ShieldCheck size={14} className="text-[#79e8ef]" /> Keys hashed with SHA-256</span>
            <Link href="/dashboard/keys" className="text-[#d8ff9e] hover:underline font-semibold flex items-center gap-1">
              <span>Manage API Keys</span>
              <ArrowRight size={11} />
            </Link>
          </div>
        </div>

        {/* Right 5 Columns: Live Global Platform Activity */}
        <div className="lg:col-span-5 flex flex-col justify-between rounded-3xl border border-white/10 bg-gradient-to-br from-[#121614] via-[#0e1210] to-[#080a09] p-6 shadow-xl">
          <PlatformUsageMetrics />
        </div>
      </div>

      {/* Integration Quick Start & Code Snippets */}
      <OverviewQuickStart />

      {/* 14-Day Usage Telemetry Chart */}
      <section className="dashboard-usage-panel">
        <div className="dashboard-section-head">
          <div>
            <p>REQUEST TELEMETRY</p>
            <h2>14-Day Throughput Activity</h2>
            <span>Inspect daily token settlement volume and historical compute trends.</span>
          </div>
          <Link href="/dashboard/usage" className="dashboard-outline-action">
            Detailed Usage logs <ArrowRight size={14} />
          </Link>
        </div>
        <UsageChart daily={usage.data?.daily ?? []} />
      </section>

      {/* Useful Next Moves */}
      <section className="dashboard-next-section">
        <div className="dashboard-section-head">
          <div>
            <p>BUILD WITH INTENT</p>
            <h2>Developer Quick Actions</h2>
            <span>Essential entry points to integrate, test, and ship with TokenForge models.</span>
          </div>
        </div>
        <div className="dashboard-next-grid">
          <Link href="/dashboard/keys" className="dashboard-next-card">
            <span><KeyRound size={17} /> 01</span>
            <h3>Create API Keys</h3>
            <p>Generate a labeled, high-security key for Cursor, Claude Code, or backend servers.</p>
            <b>Manage keys <ArrowRight size={14} /></b>
          </Link>
          <Link href="/dashboard/playground" className="dashboard-next-card">
            <span><Terminal size={17} /> 02</span>
            <h3>Prompt Playground</h3>
            <p>Evaluate Claude Opus 5, GLM-5.3, and DeepSeek V3 in real time.</p>
            <b>Open Playground <ArrowRight size={14} /></b>
          </Link>
          <Link href="/docs" className="dashboard-next-card">
            <span><Code2 size={17} /> 03</span>
            <h3>API Documentation</h3>
            <p>Explore native Anthropic Messages API compatible endpoints and SDKs.</p>
            <b>Read the docs <ArrowRight size={14} /></b>
          </Link>
        </div>
      </section>
    </>
  );
}

function GiveawayNotificationBanner({ enabled }: { enabled: boolean }) {
  const notifications = trpc.developer.unreadGiveawayNotifications.useQuery(undefined, { enabled, staleTime: 15_000, refetchOnWindowFocus: false });
  const utils = trpc.useUtils();
  const dismiss = trpc.developer.dismissGiveawayNotification.useMutation({
    onSuccess: () => utils.developer.unreadGiveawayNotifications.invalidate(),
    onError: () => toast.error("The giveaway notice could not be dismissed. Please try again."),
  });
  const notification = notifications.data?.[0];
  if (!notification) return null;
  const credit = `$${(notification.amountNanos / 1_000_000_000).toFixed(2)}`;
  const note = notification.announcementNote || "Thank you for being a verified TokenForge member. Your giveaway credit is ready to use.";
  const remaining = Math.max(0, (notifications.data?.length ?? 1) - 1);
  return <section className="giveaway-alert mb-5" aria-label="New Giveaway credit" role="status">
    <div className="giveaway-alert__edge" aria-hidden="true" />
    <div className="giveaway-alert__ribbons" aria-hidden="true">{Array.from({ length: 11 }, (_, index) => <i key={index} />)}</div>
    <div className="giveaway-alert__content">
      <div className="giveaway-alert__topline"><div className="giveaway-alert__heading"><span className="giveaway-alert__gift"><Gift size={18} /></span><p>GIVEAWAY ALERT</p></div><Button variant="ghost" size="icon" className="giveaway-alert__dismiss" onClick={() => dismiss.mutate({ notificationId: notification.id })} disabled={dismiss.isPending} aria-label="Dismiss giveaway notification"><X size={17} /></Button></div>
      <div className="giveaway-alert__body"><div className="giveaway-alert__amount">{credit}</div><div className="min-w-0 flex-1"><h2>Credit added to your TokenForge balance</h2><p>{note}</p>{remaining > 0 && <small>{remaining} more giveaway {remaining === 1 ? "notice" : "notices"} waiting.</small>}</div></div>
    </div>
  </section>;
}

function SpecialReferralGiftBox({ enabled }: { enabled: boolean }) {
  const utils = trpc.useUtils();
  const gift = trpc.developer.specialReferralGift.useQuery(undefined, { enabled, refetchInterval: 15_000 });
  const [revealed, setRevealed] = useState(false);
  const acknowledge = trpc.developer.acknowledgeSpecialReferralGift.useMutation({
    onSuccess: () => {
      setRevealed(true);
      utils.developer.specialReferralGift.invalidate();
    },
    onError: error => toast.error(error.message),
  });
  const claim = gift.data;
  if (!claim?.awardedAt || (claim.giftViewedAt && !revealed)) return null;
  const amount = `$${(claim.amountNanos / 1_000_000_000).toFixed(0)}`;
  return <section className="special-referral-gift mb-5" aria-label="Special referral gift" role="status">
    <div className="special-referral-gift__ribbons" aria-hidden="true">{Array.from({ length: 16 }, (_, index) => <i key={index} />)}</div>
    <div className={`special-referral-gift__box ${revealed ? "special-referral-gift__box--opened" : ""}`}>
      <div className="special-referral-gift__shine" aria-hidden="true" />
      <div className="special-referral-gift__icon"><Gift size={28} /></div>
      <div className="min-w-0 flex-1">
        <p className="special-referral-gift__eyebrow">SPECIAL REFERRAL REWARD</p>
        <h2>{revealed ? `${amount} added to your account` : "Your special referral gift box is ready"}</h2>
        <p>{revealed ? "Your special referral bonus is now available in your TokenForge credit balance." : "You joined through TokenForge’s limited special link. Open your gift box to reveal the bonus."}</p>
      </div>
      {!revealed && <Button className="special-referral-gift__button" onClick={() => acknowledge.mutate()} disabled={acknowledge.isPending}>{acknowledge.isPending ? <Loader2 className="animate-spin" size={16} /> : <Gift size={16} />}{acknowledge.isPending ? "Opening…" : "Open gift"}</Button>}
      {revealed && <span className="special-referral-gift__confirmed"><Check size={15} /> Credited</span>}
    </div>
  </section>;
}

function OverviewPricingLink() {
  const { user } = useAuth();
  const emailLower = (user?.email ?? "").trim().toLowerCase();
  const isWhitelistedUser = emailLower === "konchoor@gmail.com" || emailLower === "kumaryush18@gmail.com";
  const creditsEnabled = isWhitelistedUser || Boolean((user as any)?.creditsEnabled);

  return (
    <section className="mb-6 rounded-2xl border border-white/8 bg-[#0c0d10] p-4 sm:p-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-rose-500/25 bg-rose-500/10 text-rose-400">
            <CreditCard size={18} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-white">
                {creditsEnabled ? "TokenForge Pricing & Plans" : "TokenForge Pay-As-You-Go Compute"}
              </h3>
              <span className="rounded-full bg-rose-500/10 px-2 py-0.5 text-[10px] font-medium text-rose-300">
                {creditsEnabled ? "Zero Markup" : "100% Deposit Match"}
              </span>
            </div>
            <p className="mt-0.5 text-xs text-[#8e909e]">
              {creditsEnabled
                ? "Compare Card, Domestic UPI, and Solana Pay top-ups with instant credit recharge."
                : "Fund your account with Card, UPI, or Solana Pay at official zero-markup provider rates."}
            </p>
          </div>
        </div>
        <Link
          href="/dashboard/pricing"
          className="dashboard-primary-link inline-flex items-center justify-center gap-2 whitespace-nowrap self-start sm:self-auto"
        >
          {creditsEnabled ? "See our pricing plan" : "View deposit options"} <ArrowRight size={15} />
        </Link>
      </div>
    </section>
  );
}

export default function DeveloperDashboard({ section = "overview", modelId }: { section?: Section; modelId?: string }) {
  const { user, loading } = useAuth({ redirectOnUnauthenticated: true, redirectPath: "/signin" });
  const workspaceVerified = Boolean(user);
  const usage = trpc.developer.usage.useQuery(undefined, { enabled: Boolean(user) });

  if (!loading && !user) {
    return (
      <div className="min-h-screen bg-[#09090b] flex items-center justify-center">
        <Loader2 className="animate-spin text-[#c9ff73] h-8 w-8" />
      </div>
    );
  }
  const content =
    section === "pricing" ? (
      <DashboardPricingSection />
    ) : section === "playground" ? (
      <Playground />
    ) : section === "models" ? (
      <DashboardModels />
    ) : section === "model" ? (
      <DashboardModels modelId={modelId} />
    ) : section === "keys" ? (
      <>
        <PageIntro
          eyebrow="Credentials"
          title="API keys"
          subtitle="Create, rotate, or revoke credentials without ever re-exposing a saved secret."
        />
        <ApiKeyList />
      </>
    ) : section === "tickets" ? (
      <TicketsWorkspace />
    ) : section === "transactions" ? (
      <TransactionsWorkspace />
    ) : section === "usage" ? (
      <>
        <PageIntro
          eyebrow="Observability"
          title="Usage logs"
          subtitle="A transparent record of request source, model, tokens, and credit cost."
        />
        <UsageLogs />
      </>
    ) : section === "profile" ? (
      <>
        <PageIntro
          eyebrow="Account & rewards"
          title="Profile"
          subtitle="Manage your TokenForge identity and claim your daily build credit."
        />
        <Profile />
      </>
    ) : section === "referrals" ? (
      <ReferralWorkspace />
    ) : (
      <Overview user={user} loading={loading} usage={usage} />
    );
  return <DashboardLayout><div className="dashboard-page-surface"><div className="dashboard-page-content"><SpecialReferralGiftBox enabled={Boolean(user) && workspaceVerified} /><GiveawayNotificationBanner enabled={Boolean(user) && workspaceVerified} />{content}</div></div></DashboardLayout>;
}

function ReferralWorkspace() {
  const referralQuery = trpc.developer.referrals.useQuery(undefined, {
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
  });
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
      <div className="rounded-2xl border border-[#befe6c]/20 bg-[radial-gradient(circle_at_80%_0%,rgba(190,254,108,.11),transparent_42%),#09090b] p-5 sm:p-6">
        <div className="flex items-start gap-3"><div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#befe6c]/12 text-[#d8ff9d]"><Gift size={19} /></div><div><p className="text-[10px] font-bold uppercase tracking-[.16em] text-[#befe6c]">Your invitation</p><h2 className="mt-1 text-xl font-bold text-white">A ${TOKENFORGE_REFERRAL_REWARD_USD} credit for both accounts.</h2><p className="mt-2 max-w-xl text-xs leading-5 text-[#a9aab7]">Rewards are granted once after a new account is created through your link. Existing accounts, self-referrals, and repeat claims are not eligible.</p></div></div>
        <div className="mt-5 rounded-xl border border-white/10 bg-black/40 p-3"><p className="text-[10px] font-semibold uppercase tracking-[.13em] text-[#9698a8]">Your four-character affiliate link</p><div className="mt-2 flex flex-col gap-2 sm:flex-row"><code className="min-w-0 flex-1 overflow-x-auto rounded-lg border border-white/8 bg-[#000000] px-3 py-2.5 font-mono text-[11px] text-[#dfe0e7]">{inviteUrl}</code><Button className="bg-[#e5ffb8] text-[#233310] hover:bg-[#f1ffd3]" onClick={copyInvite}>{copied ? <Check size={15} /> : <Copy size={15} />}{copied ? "Copied" : "Copy link"}</Button></div></div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1"><div className="rounded-2xl border border-white/10 bg-[#09090b] p-5"><div className="flex items-center gap-2 text-[#befe6c]"><Users size={16} /><p className="text-[10px] font-semibold uppercase tracking-[.14em]">Successful invites</p></div><p className="mt-4 text-3xl font-bold text-white">{referral.referrals.length}</p><p className="mt-1 text-xs text-[#9597a7]">New accounts credited through your link</p></div><div className="rounded-2xl border border-white/10 bg-[#09090b] p-5"><div className="flex items-center gap-2 text-[#befe6c]"><Gift size={16} /><p className="text-[10px] font-semibold uppercase tracking-[.14em]">Invitation credit</p></div><p className="mt-4 text-3xl font-bold text-white">{formatCredit(referral.totalRewardNanos)}</p><p className="mt-1 text-xs text-[#9597a7]">Total promotional credit awarded to you</p></div></div>
    </section>
    {referral.receivedRewardNanos > 0 && <section className="mt-4 flex items-start gap-3 rounded-xl border border-[#befe6c]/20 bg-[#befe6c]/[.06] p-4"><Gift className="mt-0.5 text-[#cfff8d]" size={18} /><div><p className="text-sm font-bold text-[#efffd3]">Your welcome credit has arrived</p><p className="mt-1 text-xs leading-5 text-[#c4dca6]">You received {formatCredit(referral.receivedRewardNanos)} in referral credit when you joined TokenForge. It is available in your wallet now.</p></div></section>}
    <section className="mt-4 overflow-hidden rounded-2xl border border-white/10 bg-[#09090b]"><div className="border-b border-white/8 p-5"><p className="text-[10px] font-semibold uppercase tracking-[.14em] text-[#befe6c]">Reward activity</p><h2 className="mt-1 text-lg font-bold text-white">Your successful invitations</h2></div>{referral.referrals.length ? <div>{referral.referrals.map(item => <div key={item.id} className="flex items-center justify-between gap-4 border-b border-white/8 px-5 py-4 last:border-0"><div><p className="text-sm font-semibold text-white">New TokenForge member</p><p className="mt-1 text-[11px] text-[#9294a4]">Credited {new Date(item.createdAt).toLocaleString()}</p></div><span className="rounded-full bg-[#befe6c]/10 px-2.5 py-1 font-mono text-xs font-bold text-[#d8ff9d]">+{formatCredit(item.rewardNanos)}</span></div>)}</div> : <div className="p-8 text-center"><Users className="mx-auto text-[#767889]" size={22} /><p className="mt-3 text-sm font-bold text-white">No referral rewards yet</p><p className="mt-1 text-xs text-[#9395a5]">Share your link with a developer who has not created a TokenForge account.</p></div>}</section>
  </>;
}
