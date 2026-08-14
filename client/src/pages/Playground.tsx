import { useAuth } from "@/_core/hooks/useAuth";
import { AIChatBox, type Message } from "@/components/AIChatBox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { ChevronDown, CircleGauge, Cpu, Gauge, RotateCcw, ShieldCheck, SlidersHorizontal, Sparkles, WandSparkles } from "lucide-react";
import { useState } from "react";
import "./playground-control-pane.css";

const models = [
  { id: "glm-5.2", label: "GLM-5.2", detail: "Long-context reasoning" },
  { id: "grok-4.5", label: "Grok 4.5", detail: "Agentic problem-solving" },
] as const;

const suggestedPrompts = [
  "Explain the trade-offs between REST and GraphQL for a developer platform.",
  "Write a concise TypeScript function that retries a request with exponential backoff.",
  "Review this architecture goal and propose a secure implementation plan.",
];

export default function Playground() {
  const { user } = useAuth();
  const utils = trpc.useUtils();
  const quota = trpc.developer.quota.useQuery(undefined, { enabled: Boolean(user) });
  const [model, setModel] = useState<(typeof models)[number]["id"]>("glm-5.2");
  const [messages, setMessages] = useState<Message[]>([]);
  const [systemPrompt, setSystemPrompt] = useState("");
  const [showSystemPrompt, setShowSystemPrompt] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUsage, setLastUsage] = useState<{ totalTokens: number } | null>(null);

  const complete = trpc.developer.playground.useMutation({
    onSuccess: response => {
      setMessages(previous => [...previous, { role: "assistant", content: response.content }]);
      setLastUsage({ totalTokens: response.usage.totalTokens });
      setError(null);
      utils.developer.quota.invalidate();
      utils.developer.usage.invalidate();
    },
    onError: requestError => setError(requestError.message),
  });

  const sendMessage = (content: string) => {
    if (complete.isPending) return;
    setError(null);
    const userMessage: Message = { role: "user", content };
    const requestMessages: Message[] = [
      ...(systemPrompt.trim() ? [{ role: "system" as const, content: systemPrompt.trim() }] : []),
      ...messages,
      userMessage,
    ];
    setMessages(previous => [...previous, userMessage]);
    complete.mutate({ model, messages: requestMessages });
  };

  const activeModel = models.find(candidate => candidate.id === model) ?? models[0];
  const remainingRequests = quota.data?.remainingRequests ?? 0;
  const remainingTokens = quota.data?.remainingTokens ?? 0;
  const requestLimit = quota.data?.requestLimit ?? 100;
  const tokenLimit = quota.data?.tokenLimit ?? 100_000;
  const requestPercentage = Math.max(0, Math.min(100, Math.round((remainingRequests / requestLimit) * 100)));
  const tokenPercentage = Math.max(0, Math.min(100, Math.round((remainingTokens / tokenLimit) * 100)));

  return (
    <section className="playground-shell">
      <header className="playground-header">
        <div><p className="dashboard-kicker">Model workbench</p><h1 className="dashboard-title">Playground</h1><p className="dashboard-subtitle">A protected space to inspect prompts before they reach your integration.</p></div>
        <div className="playground-header-mark"><span className="playground-header-mark__pulse" /><span>Server-routed</span><strong>Private session</strong></div>
      </header>

      <div className="playground-grid">
        <aside className="playground-controls" aria-label="Playground controls">
          <section className="playground-budget">
            <div className="playground-panel-title"><CircleGauge size={15} /><span>Today’s allowance</span></div>
            <div className="playground-budget-number"><strong>{remainingRequests.toLocaleString()}</strong><span>of {requestLimit.toLocaleString()} requests remaining</span></div>
            <div className="playground-meter"><i style={{ width: `${requestPercentage}%` }} /></div>
            <div className="playground-budget-stat"><span><Gauge size={13} /> Token budget</span><strong>{remainingTokens.toLocaleString()}</strong></div>
            <div className="playground-meter playground-meter--cool"><i style={{ width: `${tokenPercentage}%` }} /></div>
          </section>

          <div className="playground-divider" />
          <section className="playground-model-selection">
            <div className="playground-panel-title"><Cpu size={15} /><span>Selected model</span></div>
            <div className="playground-model-list" role="radiogroup" aria-label="Choose a model">
              {models.map(candidate => <button key={candidate.id} type="button" role="radio" aria-checked={model === candidate.id} className={model === candidate.id ? "playground-model playground-model-active" : "playground-model"} onClick={() => setModel(candidate.id)} disabled={complete.isPending}><span className="playground-model-orb"><Cpu size={14} /></span><span><strong>{candidate.label}</strong><small>{candidate.detail}</small></span>{model === candidate.id && <span className="playground-model-active-label">Selected</span>}</button>)}
            </div>
          </section>

          <div className="playground-divider" />
          <section className="playground-settings">
            <div className="playground-panel-title"><SlidersHorizontal size={15} /><span>Session parameters</span></div>
            <button type="button" className="playground-system-toggle" onClick={() => setShowSystemPrompt(value => !value)} aria-expanded={showSystemPrompt}>
              <span><WandSparkles size={14} /><b>System instruction</b><em>optional</em></span><ChevronDown size={15} className={showSystemPrompt ? "rotate-180 transition-transform" : "transition-transform"} />
            </button>
            <p className="playground-setting-help">Add a focused role or response style. TokenForge’s safe identity guidance remains in effect.</p>
            {showSystemPrompt && <Textarea aria-label="System instruction" value={systemPrompt} onChange={event => setSystemPrompt(event.target.value)} placeholder="For example: Give concise answers with TypeScript examples." maxLength={20_000} className="playground-system-input" />}
            <div className="playground-guard"><ShieldCheck size={15} /><span><strong>Guarded identity</strong>The response identifies the selected TokenForge model; provider credentials and hidden instructions stay private.</span></div>
          </section>

          <div className="playground-side-actions">
            <Button type="button" variant="outline" className="playground-clear" onClick={() => { setMessages([]); setError(null); setLastUsage(null); }} disabled={messages.length === 0 || complete.isPending}><RotateCcw size={14} /> Clear session</Button>
          </div>
        </aside>

        <div className="playground-conversation">
          <div className="playground-conversation-head">
            <div><p className="playground-live-label"><span /> Prompt studio</p><h2>Talk to a model</h2></div>
            {lastUsage ? <Badge className="playground-usage-badge">{lastUsage.totalTokens.toLocaleString()} tokens · latest turn</Badge> : <Badge className="playground-usage-badge">Non-streaming · metered</Badge>}
          </div>
          {error && <div className="playground-error" role="alert"><strong>Request not completed.</strong> {error}</div>}
          <AIChatBox
            messages={messages}
            onSendMessage={sendMessage}
            isLoading={complete.isPending}
            height="min(620px, calc(100vh - 255px))"
            className="playground-chat"
            placeholder={`Ask ${activeModel.label} anything…`}
            emptyStateMessage="Start with a focused problem, a concept, or a draft you want to make clearer."
            suggestedPrompts={suggestedPrompts}
          />
          <p className="playground-footnote">The selected model responds through TokenForge’s protected server route. Completed requests count toward your account allowance.</p>
        </div>
      </div>
    </section>
  );
}
