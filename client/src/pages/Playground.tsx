import { useAuth } from "@/_core/hooks/useAuth";
import { AIChatBox, type Message } from "@/components/AIChatBox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ProviderMark } from "@/components/ProviderMark";
import { TOKENFORGE_MODELS } from "@/lib/modelCatalogue";
import { trpc } from "@/lib/trpc";
import { ChevronDown, CircleDollarSign, Cpu, Radio, RotateCcw, Search, ShieldCheck, SlidersHorizontal, Sparkles, Thermometer, WandSparkles, X } from "lucide-react";
import { useMemo, useState } from "react";
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
  const modelAvailability = trpc.developer.modelAvailability.useQuery(undefined, { enabled: Boolean(user), refetchInterval: 5_000, refetchIntervalInBackground: true });
  const [model, setModel] = useState("glm-5.2");
  const [isModelMenuOpen, setIsModelMenuOpen] = useState(false);
  const [modelSearch, setModelSearch] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [systemPrompt, setSystemPrompt] = useState("");
  const [showSystemPrompt, setShowSystemPrompt] = useState(false);
  const [showParameters, setShowParameters] = useState(false);
  const [maxOutputTokens, setMaxOutputTokens] = useState(1024);
  const [temperature, setTemperature] = useState(0.7);
  const [stream, setStream] = useState(true);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUsage, setLastUsage] = useState<{ totalTokens: number } | null>(null);

  const complete = trpc.developer.playground.useMutation({
    onSuccess: response => {
      setMessages(previous => [...previous, { role: "assistant", content: response.content }]);
      setLastUsage({ totalTokens: response.usage.totalTokens });
      setError(null);
      utils.developer.wallet.invalidate();
      utils.developer.usage.invalidate();
      utils.developer.usageLogs.invalidate();
    },
    onError: requestError => setError(requestError.message),
  });

  const refreshUsage = () => {
    utils.developer.wallet.invalidate();
    utils.developer.usage.invalidate();
    utils.developer.usageLogs.invalidate();
  };

  const sendStreamedMessage = async (requestMessages: Message[], userMessage: Message) => {
    setIsStreaming(true);
    setMessages(previous => [...previous, userMessage, { role: "assistant", content: "" }]);
    try {
      const response = await fetch("/api/playground/chat/completions", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
        body: JSON.stringify({ model, messages: requestMessages, maxOutputTokens, temperature }),
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
          const payload = JSON.parse(raw) as { choices?: Array<{ delta?: { content?: string } }>; usage?: { totalTokens?: number }; credit?: unknown };
          if (name === "tokenforge:usage") {
            const usage = payload.usage;
            if (usage?.totalTokens !== undefined) setLastUsage({ totalTokens: usage.totalTokens });
            refreshUsage();
            return;
          }
          const delta = payload.choices?.[0]?.delta?.content;
          if (!delta) return;
          setMessages(previous => {
            const updated = [...previous];
            const last = updated[updated.length - 1];
            if (last?.role === "assistant") updated[updated.length - 1] = { ...last, content: `${last.content}${delta}` };
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
      setMessages(previous => previous.filter((message, index) => !(index === previous.length - 1 && message.role === "assistant" && !message.content)));
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
    complete.mutate({ model, messages: requestMessages, maxOutputTokens, temperature });
  };

  const activeModel = TOKENFORGE_MODELS.find(candidate => candidate.id === model) ?? TOKENFORGE_MODELS[0];
  const modelOptions = useMemo(() => {
    const featuredIds = ["kimi-k3", "qwen3.7-max"];
    const featured = featuredIds.flatMap(id => TOKENFORGE_MODELS.filter(candidate => candidate.id === id));
    return [...featured, ...TOKENFORGE_MODELS.filter(candidate => !featuredIds.includes(candidate.id))];
  }, []);
  const availabilityByModelId = useMemo(() => new Map(modelAvailability.data?.map(item => [item.modelId, item.available]) ?? []), [modelAvailability.data]);
  const normalizedSearch = modelSearch.trim().toLowerCase();
  const visibleModelOptions = useMemo(() => modelOptions.filter(candidate => {
    if (!normalizedSearch) return true;
    return `${candidate.name} ${candidate.provider} ${candidate.eyebrow} ${candidate.id}`.toLowerCase().includes(normalizedSearch);
  }), [modelOptions, normalizedSearch]);
  const isActiveModelAvailable = availabilityByModelId.get(activeModel.id) ?? false;
  const creditBalance = Number(wallet.data?.balanceNanos ?? 0) / 1_000_000_000;

  return (
    <section className="playground-shell">
      <header className="playground-header">
        <div><p className="dashboard-kicker">Model workbench</p><h1 className="dashboard-title">Playground</h1><p className="dashboard-subtitle">A protected space to inspect prompts before they reach your integration.</p></div>
        <div className="playground-header-mark"><span className="playground-header-mark__pulse" /><span>Server-routed</span><strong>Private session</strong></div>
      </header>

      <div className="playground-grid">
        <aside className="playground-controls" aria-label="Playground controls">
          <section className="playground-budget">
            <div className="playground-panel-title"><CircleDollarSign size={15} /><span>Promotional credit</span></div>
            <div className="playground-budget-number"><strong>${creditBalance.toFixed(2)}</strong><span>available to use</span></div>
            <div className="playground-meter"><i style={{ width: `${Math.min(100, Math.max(5, (creditBalance / 50) * 100))}%` }} /></div>
            <div className="playground-budget-stat"><span><Sparkles size={13} /> Daily calendar check-in</span><strong>+$5.00</strong></div>
            <p className="playground-setting-help">Successful requests are debited only from actual provider-reported token usage.</p>
          </section>

          <div className="playground-divider" />
          <section className="playground-model-selection">
            <div className="playground-panel-title"><Cpu size={15} /><span>Selected model</span></div>
            <div className="playground-model-picker">
              <span className={`playground-model-orb playground-model-orb--${activeModel.tone}`}><ProviderMark provider={activeModel.provider} fallback={activeModel.providerMark} size={20} /></span>
              <div className="playground-model-picker__selected"><span>{activeModel.provider} · {activeModel.eyebrow}</span><strong>{activeModel.name}</strong></div>
              <button type="button" className="playground-model-picker__toggle" onClick={() => { setIsModelMenuOpen(value => !value); setModelSearch(""); }} disabled={complete.isPending || isStreaming} aria-expanded={isModelMenuOpen} aria-haspopup="listbox" aria-label="Choose a model"><ChevronDown size={15} /></button>
              {isModelMenuOpen ? <div className="playground-model-menu" role="dialog" aria-label="Find a text model">
                <div className="playground-model-menu__head"><span>Choose a text model</span><b>{TOKENFORGE_MODELS.length} routes</b></div>
                <label className="playground-model-search"><Search size={15} /><input autoFocus value={modelSearch} onChange={event => setModelSearch(event.target.value)} placeholder="Search models or providers" aria-label="Search models or providers" />{modelSearch ? <button type="button" aria-label="Clear model search" onClick={() => setModelSearch("")}><X size={14} /></button> : null}</label>
                <div className="playground-model-menu__options" role="listbox" aria-label="Available text models">
                  {visibleModelOptions.length ? visibleModelOptions.map((candidate, index) => {
                    const isAvailable = availabilityByModelId.get(candidate.id) ?? false;
                    return <button type="button" role="option" aria-selected={candidate.id === model} key={candidate.id} className={`playground-model-menu__option${candidate.id === model ? " playground-model-menu__option--active" : ""}`} onClick={() => { if (!isAvailable) return; setModel(candidate.id); setIsModelMenuOpen(false); setModelSearch(""); }} disabled={!isAvailable}><span className={`playground-model-orb playground-model-orb--${candidate.tone}`}><ProviderMark provider={candidate.provider} fallback={candidate.providerMark} size={18} /></span><span><b>{candidate.name}</b><small>{candidate.provider} · {candidate.eyebrow}</small></span><i className={isAvailable ? "playground-model-status playground-model-status--online" : "playground-model-status"}><em />{modelAvailability.isLoading ? "Checking" : isAvailable ? "Live" : "Unavailable"}</i>{index < 2 && !normalizedSearch ? <strong>Featured</strong> : null}</button>;
                  }) : <div className="playground-model-menu__empty"><Search size={16} /><b>No model found</b><span>Try a provider name or model ID.</span></div>}
                </div>
              </div> : null}
            </div>
            <p className="playground-model-route"><b><span className={isActiveModelAvailable ? "playground-live-dot" : "playground-live-dot playground-live-dot--offline"} />{modelAvailability.isLoading ? "Checking availability" : isActiveModelAvailable ? "Live" : "Temporarily unavailable"}</b> · Kimi K3 is featured first · {TOKENFORGE_MODELS.length} verified text routes · {activeModel.capabilities.join(" · ")}</p>
          </section>

          <div className="playground-divider" />
          <section className="playground-settings">
            <div className="playground-panel-title"><SlidersHorizontal size={15} /><span>Session parameters</span></div>
            <button type="button" className="playground-system-toggle" onClick={() => setShowParameters(value => !value)} aria-expanded={showParameters}>
              <span><SlidersHorizontal size={14} /><b>Response controls</b><em>{stream ? "streaming" : "standard"}</em></span><ChevronDown size={15} className={showParameters ? "rotate-180 transition-transform" : "transition-transform"} />
            </button>
            {showParameters && <div className="playground-parameters">
              <label><span>Max output</span><select value={maxOutputTokens} onChange={event => setMaxOutputTokens(Number(event.target.value))} disabled={complete.isPending || isStreaming}><option value={256}>256 tokens</option><option value={512}>512 tokens</option><option value={1024}>1,024 tokens</option><option value={2048}>2,048 tokens</option><option value={4096}>4,096 tokens</option><option value={8192}>8,192 tokens</option></select></label>
              <label><span><Thermometer size={13} /> Temperature <b>{temperature.toFixed(1)}</b></span><input type="range" min="0" max="2" step="0.1" value={temperature} onChange={event => setTemperature(Number(event.target.value))} disabled={complete.isPending || isStreaming} /></label>
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

        <div className="playground-conversation">
          <div className="playground-conversation-head">
            <div><p className="playground-live-label"><span /> Prompt studio</p><h2>Talk to a model</h2></div>
            {lastUsage ? <Badge className="playground-usage-badge">{lastUsage.totalTokens.toLocaleString()} tokens · latest turn</Badge> : <Badge className="playground-usage-badge">{stream ? "Streaming" : "Standard"} · metered</Badge>}
          </div>
          {error && <div className="playground-error" role="alert"><strong>Request not completed.</strong> {error}</div>}
          <AIChatBox
            messages={messages}
            onSendMessage={sendMessage}
            isLoading={complete.isPending || isStreaming}
            height="min(620px, calc(100vh - 255px))"
            className="playground-chat"
            placeholder={`Ask ${activeModel.name} anything…`}
            emptyStateMessage="Start with a focused problem, a concept, or a draft you want to make clearer."
            suggestedPrompts={suggestedPrompts}
          />
          <p className="playground-footnote">The selected model responds through TokenForge’s protected server route. {stream ? "Streaming is enabled for this session. " : "Standard response mode is enabled. "}Completed requests are charged against promotional credit and appear in Usage logs.</p>
        </div>
      </div>
    </section>
  );
}
