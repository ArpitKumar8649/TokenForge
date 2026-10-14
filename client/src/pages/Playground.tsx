import { useAuth } from "@/_core/hooks/useAuth";
import { AIChatBox, type Message } from "@/components/AIChatBox";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { CheckoutModal } from "@/components/CheckoutModal";
import { ProviderMark } from "@/components/ProviderMark";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { PLAYGROUND_FEATURED_MODEL_IDS, prioritizePlaygroundModels, TOKENFORGE_MODELS } from "@/lib/modelCatalogue";
import { trpc } from "@/lib/trpc";
import { AlertTriangle, Brain, ChevronDown, CircleDollarSign, Cpu, Radio, RotateCcw, Search, ShieldCheck, SlidersHorizontal, Sparkles, Thermometer, WandSparkles, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import "./playground-control-pane.css";

const suggestedPrompts = [
  "Explain the trade-offs between REST and GraphQL for a developer platform.",
  "Write a concise TypeScript function that retries a request with exponential backoff.",
  "Review this architecture goal and propose a secure implementation plan.",
];

export default function Playground() {
  const { user } = useAuth();
  const utils = trpc.useUtils();
  const wallet = trpc.developer.wallet.useQuery(undefined, { enabled: Boolean(user) });
  const modelAvailability = trpc.developer.modelAvailability.useQuery(undefined, {
    enabled: Boolean(user),
    staleTime: 60_000,
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
  });
  const gpt6AstraQuota = trpc.developer.gpt6AstraQuota.useQuery(undefined, {
    enabled: Boolean(user),
    staleTime: 60_000,
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
  });
  const platformMaintenanceStatus = trpc.public.platformMaintenanceStatus.useQuery(undefined, {
    staleTime: 120_000,
    refetchInterval: 120_000,
    refetchIntervalInBackground: false,
  });
  const [model, setModel] = useState("glm-5.2");
  const [isModelMenuOpen, setIsModelMenuOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [authAlertOpen, setAuthAlertOpen] = useState(false);
  const [modelSearch, setModelSearch] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [systemPrompt, setSystemPrompt] = useState("");
  const [showSystemPrompt, setShowSystemPrompt] = useState(false);
  const [showParameters, setShowParameters] = useState(false);
  const [maxOutputTokens, setMaxOutputTokens] = useState(1024);
  const [temperature, setTemperature] = useState(0.7);
  const [reasoningEffort, setReasoningEffort] = useState<"default" | "low" | "medium" | "high" | "xhigh" | "max">("default");
  const [stream, setStream] = useState(true);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUsage, setLastUsage] = useState<{ totalTokens: number } | null>(null);

  useEffect(() => {
    if (!isModelMenuOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsModelMenuOpen(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isModelMenuOpen]);

  const complete = trpc.developer.playground.useMutation({
    onSuccess: response => {
      setMessages(previous => [...previous, { role: "assistant", content: response.content, ...(response.thinking ? { thinking: response.thinking } : {}) }]);
      setLastUsage({ totalTokens: response.usage.totalTokens });
      setError(null);
      utils.developer.wallet.invalidate();
      utils.developer.usage.invalidate();
      utils.developer.usageLogs.invalidate();
      utils.developer.gpt6AstraQuota.invalidate();
    },
    onError: requestError => setError(requestError.message),
  });

  const refreshUsage = () => {
    utils.developer.wallet.invalidate();
    utils.developer.usage.invalidate();
    utils.developer.usageLogs.invalidate();
    utils.developer.gpt6AstraQuota.invalidate();
  };

  const sendStreamedMessage = async (requestMessages: Message[], userMessage: Message) => {
    setIsStreaming(true);
    setMessages(previous => [...previous, userMessage, { role: "assistant", content: "" }]);
    try {
      const response = await fetch("/api/playground/chat/completions", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
        body: JSON.stringify({ model, messages: requestMessages, maxOutputTokens, temperature, reasoningEffort }),
      });
      if (!response.ok || !response.body) {
        const payload = await response.json().catch(() => null) as { error?: { message?: string } } | null;
        throw new Error(payload?.error?.message ?? "TokenForge could not start the streamed response.");
      }
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let eventName = "message";
      const applyEvent = (raw: string, name: string) => {
        if (!raw || raw === "[DONE]") return;
        try {
          const payload = JSON.parse(raw) as { choices?: Array<{ delta?: { content?: string; reasoning_content?: string; reasoning?: string; thinking?: string } }>; usage?: { totalTokens?: number }; credit?: unknown };
          if (name === "tokenforge:usage") {
            const usage = payload.usage;
            if (usage?.totalTokens !== undefined) setLastUsage({ totalTokens: usage.totalTokens });
            refreshUsage();
            return;
          }
          const delta = payload.choices?.[0]?.delta?.content;
          const thinkingDelta = payload.choices?.[0]?.delta?.reasoning_content ?? payload.choices?.[0]?.delta?.reasoning ?? payload.choices?.[0]?.delta?.thinking;
          if (!delta && !thinkingDelta) return;
          setMessages(previous => {
            const updated = [...previous];
            const last = updated[updated.length - 1];
            if (last?.role === "assistant") updated[updated.length - 1] = {
              ...last,
              ...(delta ? { content: `${last.content}${delta}` } : {}),
              ...(thinkingDelta ? { thinking: `${last.thinking ?? ""}${thinkingDelta}` } : {}),
            };
            return updated;
          });
        } catch { /* Ignore non-JSON provider keep-alives and malformed passthrough events. */ }
      };
      while (true) {
        const chunk = await reader.read();
        if (chunk.done) break;
        buffer += decoder.decode(chunk.value, { stream: true });
        const events = buffer.split("\n\n");
        buffer = events.pop() ?? "";
        for (const event of events) {
          const lines = event.split("\n");
          eventName = "message";
          const data = lines.reduce<string[]>((parts, line) => {
            if (line.startsWith("event:")) eventName = line.slice(6).trim();
            if (line.startsWith("data:")) parts.push(line.slice(5).trim());
            return parts;
          }, []).join("\n");
          applyEvent(data, eventName);
        }
      }
      setError(null);
    } catch (requestError) {
      setMessages(previous => previous.filter((message, index) => !(index === previous.length - 1 && message.role === "assistant" && !message.content && !message.thinking)));
      setError(requestError instanceof Error ? requestError.message : "TokenForge could not complete this streamed request.");
    } finally {
      setIsStreaming(false);
    }
  };

  const sendMessage = (content: string) => {
    if (complete.isPending || isStreaming) return;
    if (modelAvailability.isSuccess && !isActiveModelAvailable) {
      setError("The selected model is temporarily unavailable. Choose another available model or retry shortly.");
      return;
    }
    setError(null);
    const userMessage: Message = { role: "user", content };
    const requestMessages: Message[] = [
      ...(systemPrompt.trim() ? [{ role: "system" as const, content: systemPrompt.trim() }] : []),
      ...messages,
      userMessage,
    ];
    if (stream) {
      void sendStreamedMessage(requestMessages, userMessage);
      return;
    }
    setMessages(previous => [...previous, userMessage]);
    complete.mutate({ model, messages: requestMessages, maxOutputTokens, temperature, reasoningEffort });
  };

  const activeModel = TOKENFORGE_MODELS.find(candidate => candidate.id === model) ?? TOKENFORGE_MODELS[0];
  const modelOptions = useMemo(() => prioritizePlaygroundModels(TOKENFORGE_MODELS), []);
  const availabilityByModelId = useMemo(() => new Map(modelAvailability.data?.map(item => [item.modelId, item.available]) ?? []), [modelAvailability.data]);
  const normalizedSearch = modelSearch.trim().toLowerCase();
  const visibleModelOptions = useMemo(() => modelOptions.filter(candidate => {
    if (!normalizedSearch) return true;
    return `${candidate.name} ${candidate.provider} ${candidate.eyebrow} ${candidate.id}`.toLowerCase().includes(normalizedSearch);
  }), [modelOptions, normalizedSearch]);
  const isActiveModelAvailable = availabilityByModelId.get(activeModel.id) ?? false;
  const emailLower = (user?.email ?? "").trim().toLowerCase();
  const isWhitelistedUser = emailLower === "konchoor@gmail.com" || emailLower === "kumaryush18@gmail.com";
  const creditsEnabled = isWhitelistedUser || (typeof wallet.data?.creditsEnabled === "boolean" ? wallet.data.creditsEnabled : Boolean((user as any)?.creditsEnabled));
  const creditBalance = Number(wallet.data?.balanceNanos ?? 0) / 1_000_000_000;
  const paygBalance = Number((wallet.data as any)?.paygBalanceNanos ?? 0) / 1_000_000_000;
  const displayBalance = creditsEnabled ? creditBalance : paygBalance;

  return (
    <section className="playground-shell">
      <header className="playground-header">
        <div className="min-w-0">
          <p className="dashboard-kicker">Model workbench</p>
          <h1 className="dashboard-title">Playground</h1>
          <p className="dashboard-subtitle">A protected space to inspect prompts before they reach your integration.</p>
        </div>
        <div className="flex flex-col sm:items-end items-start gap-2.5 sm:gap-3 w-full sm:w-auto shrink-0">
          {platformMaintenanceStatus.data?.active && (
             <Badge variant="outline" className={`h-6 text-[11px] font-medium ${platformMaintenanceStatus.data.isExempt ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400" : "border-red-500/30 bg-red-500/10 text-red-400"}`}>
               {platformMaintenanceStatus.data.isExempt ? "Maintenance Bypass Active" : "Global Maintenance Active"}
             </Badge>
          )}
          <div className="playground-header-mark"><span className="playground-header-mark__pulse" /><span>Server-routed</span><strong>Private session</strong></div>
        </div>
      </header>

      <div className="playground-grid">
        <aside className="playground-controls" aria-label="Playground controls">
          <section className="playground-budget">
            <div className="playground-panel-title"><CircleDollarSign size={15} /><span>{creditsEnabled ? "Promotional credit" : "PAYG balance"}</span></div>
            <div className="playground-budget-number"><strong>${displayBalance.toFixed(2)}</strong><span>available to use</span></div>
            <div className="playground-meter"><i style={{ width: `${Math.min(100, Math.max(5, (displayBalance / 25) * 100))}%` }} /></div>
            {creditsEnabled ? (
              <div className="playground-budget-stat"><span><Sparkles size={13} /> Daily check-in</span><strong>Up to $2.00 (Try your luck!)</strong></div>
            ) : (
              <div className="playground-budget-stat"><span><Sparkles size={13} /> Daily check-in</span><strong className="text-emerald-400">Up to $2.00</strong></div>
            )}
            <p className="playground-setting-help">Successful requests are debited only from actual provider-reported token usage.</p>
          </section>

          <div className="playground-divider" />
          <section className="playground-model-selection">
            <div className="playground-panel-title"><Cpu size={15} /><span>Selected model</span></div>
            <div className="playground-model-picker">
              <div className="playground-model-picker__selected"><span>Text model</span><strong>{activeModel.name}</strong></div>
              <button type="button" className="playground-model-picker__toggle" onClick={() => { setIsModelMenuOpen(value => !value); setModelSearch(""); }} disabled={complete.isPending || isStreaming} aria-expanded={isModelMenuOpen} aria-haspopup="listbox" aria-label="Choose a model"><ChevronDown size={15} /></button>
              {isModelMenuOpen ? (
                <>
                  <div
                    className="playground-model-backdrop"
                    onClick={() => setIsModelMenuOpen(false)}
                    aria-hidden="true"
                  />
                  <div className="playground-model-menu" role="dialog" aria-label="Find a text model">
                    <div className="playground-model-menu__head">
                      <span>Choose a text model</span>
                      <div className="flex items-center gap-2">
                        <b>{TOKENFORGE_MODELS.length} routes</b>
                        <button
                          type="button"
                          className="sm:hidden text-[#94a48e] hover:text-[#edf4e8] p-0.5 rounded transition-colors"
                          onClick={() => setIsModelMenuOpen(false)}
                          aria-label="Close menu"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    </div>
                    <label className="playground-model-search">
                      <Search size={15} />
                      <input autoFocus value={modelSearch} onChange={event => setModelSearch(event.target.value)} placeholder="Search models or providers" aria-label="Search models or providers" />
                      {modelSearch ? <button type="button" aria-label="Clear model search" onClick={() => setModelSearch("")}><X size={14} /></button> : null}
                    </label>
                    <div className="playground-model-menu__options" role="listbox" aria-label="Available text models">
                      {visibleModelOptions.length ? visibleModelOptions.map((candidate) => {
                        const isAvailable = availabilityByModelId.get(candidate.id) ?? false;
                        return (
                          <button
                            type="button"
                            role="option"
                            aria-selected={candidate.id === model}
                            key={candidate.id}
                            className={`playground-model-menu__option${candidate.id === model ? " playground-model-menu__option--active" : ""}`}
                            onClick={() => { if (!isAvailable) return; setModel(candidate.id); setIsModelMenuOpen(false); setModelSearch(""); }}
                            disabled={!isAvailable}
                          >
                            <ProviderMark provider={candidate.provider} fallback={candidate.providerMark} size={20} />
                            <span><b>{candidate.name}</b><small>{candidate.eyebrow}</small></span>
                            <i className={isAvailable ? "playground-model-status playground-model-status--online" : "playground-model-status"}><em />{modelAvailability.isLoading ? "Checking" : isAvailable ? "Live" : "Unavailable"}</i>
                            {PLAYGROUND_FEATURED_MODEL_IDS.includes(candidate.id as (typeof PLAYGROUND_FEATURED_MODEL_IDS)[number]) && !normalizedSearch ? (
                              <strong className={candidate.id === "gpt-6-astra" ? "bg-[#befe6c]/20 text-[#befe6c] border border-[#befe6c]/30" : undefined}>
                                {candidate.id === "gpt-6-astra" ? "Frontier" : "Featured"}
                              </strong>
                            ) : null}
                          </button>
                        );
                      }) : (
                        <div className="playground-model-menu__empty">
                          <Search size={16} />
                          <b>No model found</b>
                          <span>Try a provider name or model ID.</span>
                        </div>
                      )}
                    </div>
                  </div>
                </>
              ) : null}
            </div>
            <p className="playground-model-route"><b><span className={isActiveModelAvailable ? "playground-live-dot" : "playground-live-dot playground-live-dot--offline"} />{modelAvailability.isLoading ? "Checking availability" : isActiveModelAvailable ? "Live" : "Temporarily unavailable"}</b> · Claude Opus 5 & GPT-6 Astra pinned · {TOKENFORGE_MODELS.length} verified text routes · {activeModel.capabilities.join(" · ")}</p>
          </section>

          <div className="playground-divider" />
          <section className="playground-settings">
            <div className="playground-panel-title"><SlidersHorizontal size={15} /><span>Session parameters</span></div>
            <button type="button" className="playground-system-toggle" onClick={() => setShowParameters(value => !value)} aria-expanded={showParameters}>
              <span><SlidersHorizontal size={14} /><b>Response controls</b><em>{stream ? "streaming" : "standard"}</em></span><ChevronDown size={15} className={showParameters ? "rotate-180 transition-transform" : "transition-transform"} />
            </button>
            {showParameters && <div className="playground-parameters">
              <label>
                <span>Max output</span>
                <select
                  value={maxOutputTokens}
                  onChange={event => setMaxOutputTokens(Number(event.target.value))}
                  disabled={complete.isPending || isStreaming}
                >
                  <option value={256}>256 tokens</option>
                  <option value={512}>512 tokens</option>
                  <option value={1024}>1,024 tokens (1k)</option>
                  <option value={2048}>2,048 tokens (2k)</option>
                  <option value={4096}>4,096 tokens (4k)</option>
                  <option value={8192}>8,192 tokens (8k)</option>
                  <option value={16384}>16,384 tokens (16k)</option>
                  <option value={32768}>32,768 tokens (32k)</option>
                  <option value={65536}>65,536 tokens (64k)</option>
                </select>
              </label>
              <label><span><Thermometer size={13} /> Temperature <b>{temperature.toFixed(1)}</b></span><input type="range" min="0" max="2" step="0.1" value={temperature} onChange={event => setTemperature(Number(event.target.value))} disabled={complete.isPending || isStreaming} /></label>
              <label>
                <span>
                  <Brain size={13} /> Reasoning Effort <b>{reasoningEffort === "default" ? "Standard" : reasoningEffort.toUpperCase()}</b>
                </span>
                <select
                  value={reasoningEffort}
                  onChange={event => setReasoningEffort(event.target.value as any)}
                  disabled={complete.isPending || isStreaming}
                >
                  <option value="default">Default (Model standard)</option>
                  <option value="low">Low (Fast response)</option>
                  <option value="medium">Medium (Balanced reasoning)</option>
                  <option value="high">High (Deep reasoning)</option>
                  <option value="xhigh">X-High (Extended chain-of-thought)</option>
                  <option value="max">Max (Maximum effort budget)</option>
                </select>
              </label>
              <button type="button" className={stream ? "playground-stream-toggle playground-stream-toggle--active" : "playground-stream-toggle"} onClick={() => setStream(value => !value)} disabled={complete.isPending || isStreaming}><span><Radio size={14} /> <b>Stream response</b></span><i aria-hidden="true" /></button>
              <p>Streaming paints output as it arrives. TokenForge still meters the completed provider-reported token total.</p>
            </div>}
            <button type="button" className="playground-system-toggle" onClick={() => setShowSystemPrompt(value => !value)} aria-expanded={showSystemPrompt}>
              <span><WandSparkles size={14} /><b>System instruction</b><em>optional</em></span><ChevronDown size={15} className={showSystemPrompt ? "rotate-180 transition-transform" : "transition-transform"} />
            </button>
            <p className="playground-setting-help">Add a focused role or response style. TokenForge’s safe identity guidance remains in effect.</p>
            {showSystemPrompt && <Textarea aria-label="System instruction" value={systemPrompt} onChange={event => setSystemPrompt(event.target.value)} placeholder="For example: Give concise answers with TypeScript examples." maxLength={20_000} className="playground-system-input" />}
            <div className="playground-guard"><ShieldCheck size={15} /><span><strong>Guarded identity</strong>The response identifies the selected TokenForge model; provider credentials and hidden instructions stay private.</span></div>
          </section>

          <div className="playground-side-actions">
            <Button type="button" variant="outline" className="playground-clear" onClick={() => { setMessages([]); setError(null); setLastUsage(null); }} disabled={messages.length === 0 || complete.isPending || isStreaming}><RotateCcw size={14} /> Clear session</Button>
          </div>
        </aside>

        <div className="playground-conversation min-w-0">
          <div className="playground-conversation-head">
            <div><p className="playground-live-label"><span /> Prompt studio</p><h2>Talk to a model</h2></div>
            {lastUsage ? <Badge className="playground-usage-badge shrink-0">{lastUsage.totalTokens.toLocaleString()} tokens · latest turn</Badge> : <Badge className="playground-usage-badge shrink-0">{stream ? "Streaming" : "Standard"} · metered</Badge>}
          </div>

          {model === "gpt-6-astra" && (
            <div className="mb-3">
              {gpt6AstraQuota.data?.isUnlimited ? (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 px-3.5 py-2.5 rounded-xl bg-[#befe6c]/10 border border-[#befe6c]/25 text-xs text-[#d9ff9d]">
                  <div className="flex items-center gap-2 min-w-0">
                    <Sparkles className="w-4 h-4 text-[#befe6c] shrink-0" />
                    <span className="min-w-0 break-words">
                      <strong>Frontier Tier Active:</strong> Unlimited GPT-6 Astra Playground &amp; API access ({gpt6AstraQuota.data.isAdmin ? "Admin account" : "Paid tier active"}).
                    </span>
                  </div>
                  <Badge variant="outline" className="border-[#befe6c]/30 text-[#befe6c] bg-[#befe6c]/10 text-[10px] font-mono shrink-0 self-start sm:self-auto">UNLIMITED</Badge>
                </div>
              ) : (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 px-3.5 py-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-200">
                  <div className="flex items-center gap-2 min-w-0">
                    <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
                    <span className="min-w-0 break-words">
                      <strong className="text-white">GPT-6 Astra Free Tier:</strong> {gpt6AstraQuota.data ? `${gpt6AstraQuota.data.remainingMessages} of ${gpt6AstraQuota.data.maxFreePerMonth} free playground messages left this month.` : "5 free messages/month on free tier."} Upgrade to any paid pack for unlimited access &amp; API access.
                    </span>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => { if (!user) { setAuthAlertOpen(true); return; } setCheckoutOpen(true); }}
                    className="bg-amber-400 text-black hover:bg-amber-300 font-semibold text-xs h-7 px-3 shrink-0 rounded-lg shadow-sm self-start sm:self-auto"
                  >
                    Upgrade for Unlimited
                  </Button>
                </div>
              )}
            </div>
          )}

          {platformMaintenanceStatus.data?.active && !platformMaintenanceStatus.data.isExempt && (
            <div className="mb-3 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-200" role="alert">
              <div className="flex items-start sm:items-center gap-2 min-w-0">
                <AlertTriangle className="h-4 w-4 text-red-400 shrink-0 mt-0.5 sm:mt-0" />
                <div className="min-w-0 break-words">
                  <strong>Platform Maintenance Active:</strong>{" "}
                  <span>{platformMaintenanceStatus.data.message || "Site entered in maintainence mode due to massive request."}</span>
                </div>
              </div>
            </div>
          )}

          {error && (
            <div className="playground-error flex flex-col sm:flex-row sm:items-center justify-between gap-2 min-w-0" role="alert">
              <div className="min-w-0 break-words"><strong>Request not completed.</strong> {error}</div>
              {(error.toLowerCase().includes("paid tier") || error.toLowerCase().includes("limit of 5 messages")) && (
                <Button
                  type="button"
                  size="sm"
                  onClick={() => { if (!user) { setAuthAlertOpen(true); return; } setCheckoutOpen(true); }}
                  className="bg-amber-400 text-black hover:bg-amber-300 font-bold text-xs h-7 px-3 shrink-0 rounded-lg shadow-sm self-start sm:self-auto"
                >
                  Upgrade Plan
                </Button>
              )}
            </div>
          )}
          <AIChatBox
            messages={messages}
            onSendMessage={sendMessage}
            isLoading={complete.isPending || isStreaming}
            className="playground-chat h-[480px] sm:h-[540px] md:h-[580px] lg:h-[min(640px,calc(100dvh-250px))]"
            placeholder={`Ask ${activeModel.name} anything…`}
            emptyStateMessage="Start with a focused problem, a concept, or a draft you want to make clearer."
            suggestedPrompts={suggestedPrompts}
          />
          <p className="playground-footnote">The selected model responds through TokenForge’s protected server route. {stream ? "Streaming is enabled for this session. " : "Standard response mode is enabled. "}Completed requests are charged against promotional credit and appear in Usage logs.</p>
        </div>
      </div>

      <CheckoutModal
        isOpen={checkoutOpen}
        onClose={() => setCheckoutOpen(false)}
        initialRail="upi"
        initialPackageUsd={6.0}
        userId={(wallet.data as any)?.userId}
        onSuccess={() => {
          utils.developer.wallet.invalidate();
          utils.developer.gpt6AstraQuota.invalidate();
          setError(null);
        }}
      />
    </section>
  );
}
