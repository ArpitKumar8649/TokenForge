import { useAuth } from "@/_core/hooks/useAuth";
import { AIChatBox, type Message } from "@/components/AIChatBox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { ChevronDown, FlaskConical, RotateCcw, Sparkles, WandSparkles } from "lucide-react";
import { useState } from "react";

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

  return (
    <section className="playground-shell">
      <header className="playground-header">
        <div>
          <p className="dashboard-kicker">Experiment workspace</p>
          <h1 className="dashboard-title">Playground</h1>
          <p className="dashboard-subtitle">Test a prompt against the current TokenForge catalogue. Playground turns use your ordinary account allowance.</p>
        </div>
        <div className="playground-status" aria-label="Today’s Playground allowance">
          <span><strong>{remainingRequests.toLocaleString()}</strong> requests left</span>
          <span className="playground-status-dot" aria-hidden="true" />
          <span><strong>{remainingTokens.toLocaleString()}</strong> tokens left</span>
        </div>
      </header>

      <div className="playground-grid">
        <aside className="playground-controls" aria-label="Playground controls">
          <div className="playground-control-label"><FlaskConical size={14} /> Model</div>
          <div className="playground-model-list" role="radiogroup" aria-label="Choose a model">
            {models.map(candidate => (
              <button
                key={candidate.id}
                type="button"
                role="radio"
                aria-checked={model === candidate.id}
                className={model === candidate.id ? "playground-model playground-model-active" : "playground-model"}
                onClick={() => setModel(candidate.id)}
                disabled={complete.isPending}
              >
                <span className="playground-model-orb"><Sparkles size={13} /></span>
                <span><strong>{candidate.label}</strong><small>{candidate.detail}</small></span>
              </button>
            ))}
          </div>

          <div className="playground-divider" />
          <button type="button" className="playground-system-toggle" onClick={() => setShowSystemPrompt(value => !value)} aria-expanded={showSystemPrompt}>
            <span><WandSparkles size={14} /> System instruction <em>optional</em></span>
            <ChevronDown size={15} className={showSystemPrompt ? "rotate-180 transition-transform" : "transition-transform"} />
          </button>
          {showSystemPrompt && (
            <Textarea
              aria-label="System instruction"
              value={systemPrompt}
              onChange={event => setSystemPrompt(event.target.value)}
              placeholder="You are a thoughtful engineering assistant..."
              maxLength={20_000}
              className="playground-system-input"
            />
          )}

          <div className="playground-side-note"><Sparkles size={15} /><p><strong>{activeModel.label}</strong> is available through TokenForge’s server-side gateway. Your provider credential is never sent to this workspace.</p></div>
          <Button type="button" variant="outline" className="playground-clear" onClick={() => { setMessages([]); setError(null); setLastUsage(null); }} disabled={messages.length === 0 || complete.isPending}>
            <RotateCcw size={14} /> Clear conversation
          </Button>
        </aside>

        <div className="playground-conversation">
          <div className="playground-conversation-head">
            <div><p className="playground-live-label"><span /> Live session</p><h2>{activeModel.label}</h2></div>
            {lastUsage ? <Badge className="playground-usage-badge">{lastUsage.totalTokens.toLocaleString()} tokens · latest turn</Badge> : <Badge className="playground-usage-badge">Non-streaming · metered</Badge>}
          </div>
          {error && <div className="playground-error" role="alert"><strong>Request not completed.</strong> {error}</div>}
          <AIChatBox
            messages={messages}
            onSendMessage={sendMessage}
            isLoading={complete.isPending}
            height="min(620px, calc(100vh - 255px))"
            className="playground-chat"
            placeholder={`Message ${activeModel.label}…`}
            emptyStateMessage="Start with a focused question, a draft, or a technical problem."
            suggestedPrompts={suggestedPrompts}
          />
          <p className="playground-footnote">Responses are generated live and count toward today’s request and token allowance.</p>
        </div>
      </div>
    </section>
  );
}
