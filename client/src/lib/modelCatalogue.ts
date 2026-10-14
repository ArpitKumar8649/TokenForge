import { PRICING_URL } from "@shared/const";

export type CatalogueModel = {
  id: string;
  name: string;
  provider: string;
  providerMark: string;
  tone: "lime" | "cyan" | "amber" | "violet" | "coral" | "sky";
  description: string;
  eyebrow: string;
  inputUsdPerMillion: number;
  outputUsdPerMillion: number;
  capabilities: string[];
  pricingSource: string;
  pricingUrl: string;
  isPremium?: boolean;
};

const model = (id: string, name: string, provider: string, providerMark: string, tone: CatalogueModel["tone"], inputUsdPerMillion: number, outputUsdPerMillion: number, eyebrow: string, description: string, capabilities: string[], pricingSource: string, pricingUrl: string, isPremium?: boolean): CatalogueModel => ({ id, name, provider, providerMark, tone, inputUsdPerMillion, outputUsdPerMillion, eyebrow, description, capabilities, pricingSource, pricingUrl, ...(isPremium ? { isPremium: true } : {}) });

export const TOKENFORGE_MODELS: CatalogueModel[] = [
  model("claude-opus-5.5", "Claude Opus 5.5", "Claude", "AI", "violet", 15, 75, "Anthropic frontier reasoning", "Next-generation Anthropic frontier model featuring deep reasoning, exceptional code synthesis, and autonomous multi-step problem solving.", ["Reasoning", "Thinking", "Streaming", "Coding"], "TokenForge Claude Opus 5.5 pricing", "PRICING_URL", true),
  model("gpt-6-sol", "GPT 6 Sol", "OpenAI", "O", "sky", 15, 75, "Next-gen Sol frontier reasoning", "Next-generation OpenAI frontier reasoning model featuring Sol high-velocity inference, autonomous software engineering, and extended chain-of-thought.", ["Reasoning", "Thinking", "Streaming", "Coding"], "TokenForge GPT 6 Sol pricing", "PRICING_URL", true),
  model("gpt-6-astra", "GPT-6 Astra", "OpenAI", "O", "sky", 15, 75, "Next-gen frontier reasoning", "Next-generation OpenAI frontier reasoning model featuring ultra-deep Astra chain-of-thought, code synthesis, and multimodal capability.", ["Reasoning", "Thinking", "Streaming", "Coding"], "TokenForge GPT-6 Astra pricing", "PRICING_URL", true),
  model("glm-5.3", "GLM 5.3", "Z.AI", "GLM", "lime", 1.4, 4.4, "Advanced Z.AI reasoning", "A configurable Z.AI route for advanced text reasoning, coding, and streamed chat workloads.", ["Reasoning", "Streaming", "Coding"], "TokenForge provisional GLM 5.3 configured-route pricing", "PRICING_URL"),
  model("glm-5.2", "GLM-5.2", "Z.AI", "GLM", "lime", 1.4, 4.4, "Long-horizon intelligence", "A focused option for complex engineering, coding, and extended-context work where careful reasoning matters.", ["Reasoning", "Long context", "Streaming", "Coding"], "Z.AI model pricing", "https://docs.z.ai/guides/overview/pricing"),
  model("grok-4.5", "Grok 4.5", "xAI", "G", "cyan", 2, 6, "Fast engineering reasoning", "A reasoning-forward option for code, agentic workflows, and practical knowledge work.", ["Reasoning", "Agentic", "Streaming", "Coding"], "xAI API pricing", "https://docs.x.ai/developers/pricing"),
  model("deepseek-v4-flash", "DeepSeek V4 Flash", "DeepSeek", "DS", "sky", 0.14, 0.28, "Fast text chat", "A fast text-chat option for everyday questions, writing, and coding tasks.", ["Streaming", "Coding"], "DeepSeek V4 Flash API pricing", "https://api-docs.deepseek.com/quick_start/pricing"),
  model("deepseek-v4-pro", "DeepSeek V4 Pro", "DeepSeek", "DS", "sky", 0.14, 0.28, "General text reasoning", "A capable text-chat option for analysis, writing, coding, and structured answers.", ["Streaming", "Coding"], "TokenForge model pricing", "PRICING_URL"),
  model("claude-opus-5", "Claude Opus 5", "Claude", "AI", "violet", 15, 75, "Advanced reasoning", "A high-capability text model for detailed reasoning, coding, and streamed chat completions.", ["Reasoning", "Streaming", "Coding"], "TokenForge model pricing", "PRICING_URL"),
  model("qwen3.8-27b", "Qwen3.8 27B", "Alibaba Cloud", "Q", "lime", 0.45, 3.2, "Qwen reasoning", "A capable 27B text model for reasoning, coding, and chat completions.", ["Reasoning", "Streaming", "Coding"], "Qwen3.8 27B API pricing", "https://openrouter.ai/qwen/qwen3.8-27b"),
  model("qwen3.8-max", "Qwen 3.8 Max", "Qwen", "Q", "lime", 2, 6, "Flagship Qwen reasoning", "A flagship Qwen route for advanced reasoning, coding, streamed chat, and inspectable Playground thinking summaries.", ["Reasoning", "Thinking", "Streaming", "Coding"], "OpenRouter Qwen3.8 Max published rate", "https://openrouter.ai/qwen/qwen3.8-max"),
  model("claude-fable-5.1", "Claude Fable 5.1", "Claude", "AI", "violet", 10, 50, "Advanced reasoning", "A capable text model for reasoning, coding, streamed chat, and inspectable Playground thinking summaries.", ["Reasoning", "Thinking", "Streaming", "Coding"], "TokenForge provisional configured-route pricing", "PRICING_URL"),
  model("glm-5.1", "GLM-5.1", "Z.AI", "GLM", "lime", 1.4, 4.4, "Z.AI reasoning", "A capable Z.AI general-purpose model for practical text reasoning and coding.", ["Reasoning", "Streaming", "Coding"], "Z.AI model pricing", "https://docs.z.ai/guides/overview/pricing"),
  model("claude-haiku-4.5", "Claude Haiku 4.5", "Anthropic", "AI", "violet", 1, 5, "Fast Claude", "Anthropic’s compact production model for efficient writing, chat, and coding.", ["Streaming", "Coding"], "Anthropic Claude API pricing", "https://platform.claude.com/docs/en/about-claude/pricing"),
  model("claude-opus-4.5", "Claude Opus 4.5", "Anthropic", "AI", "violet", 5, 25, "Premium Claude", "Anthropic’s high-capability model for demanding text reasoning and engineering tasks.", ["Reasoning", "Streaming", "Coding"], "Anthropic Claude API pricing", "https://platform.claude.com/docs/en/about-claude/pricing"),
  model("claude-opus-4.6", "Claude Opus 4.6", "Anthropic", "AI", "violet", 5, 25, "Premium Claude", "Anthropic’s high-capability model for demanding text reasoning and engineering tasks.", ["Reasoning", "Streaming", "Coding"], "Anthropic Claude API pricing", "https://platform.claude.com/docs/en/about-claude/pricing"),
  model("claude-opus-4.7", "Claude Opus 4.7", "Anthropic", "AI", "violet", 5, 25, "Premium Claude", "Anthropic’s high-capability model for demanding text reasoning and engineering tasks.", ["Reasoning", "Streaming", "Coding"], "Anthropic Claude API pricing", "https://platform.claude.com/docs/en/about-claude/pricing"),
  model("claude-sonnet-4.5", "Claude Sonnet 4.5", "Anthropic", "AI", "violet", 3, 15, "Balanced Claude", "Anthropic’s balanced production model for capable chat, coding, and streamed responses.", ["Reasoning", "Streaming", "Coding"], "Anthropic Claude API pricing", "https://platform.claude.com/docs/en/about-claude/pricing"),
  model("claude-sonnet-4.6", "Claude Sonnet 4.6", "Anthropic", "AI", "violet", 3, 15, "Balanced Claude", "Anthropic’s balanced production model for capable chat, coding, and streamed responses.", ["Reasoning", "Streaming", "Coding"], "Anthropic Claude API pricing", "https://platform.claude.com/docs/en/about-claude/pricing"),
  model("claude-sonnet-5.5", "Claude Sonnet 5.5", "Anthropic", "AI", "violet", 3, 15, "Flagship Claude Sonnet", "Anthropic's flagship Sonnet 5.5 frontier model offering exceptional intelligence, advanced software engineering, and fast reasoning.", ["Reasoning", "Thinking", "Streaming", "Coding"], "Anthropic Claude API pricing", "https://platform.claude.com/docs/en/about-claude/pricing", true),
  model("gpt-5", "GPT-5", "OpenAI", "O", "sky", 1.25, 10, "GPT-5 production", "OpenAI’s general production model for high-quality chat and coding.", ["Reasoning", "Streaming", "Coding"], "OpenAI API pricing", "https://developers.openai.com/api/docs/pricing"),
  model("gpt-5-mini", "GPT-5 mini", "OpenAI", "O", "sky", 0.25, 2, "GPT-5 efficient", "A smaller GPT-5 route for cost-conscious text-chat workloads.", ["Streaming", "Coding"], "OpenAI API pricing", "https://developers.openai.com/api/docs/pricing"),
  model("gpt-5-nano", "GPT-5 nano", "OpenAI", "O", "sky", 0.05, 0.4, "GPT-5 compact", "A compact GPT-5 route for lower-cost high-volume completion tasks.", ["Streaming"], "OpenAI API pricing", "https://developers.openai.com/api/docs/pricing"),
  model("gpt-5.4", "GPT-5.4", "OpenAI", "O", "sky", 2.5, 15, "GPT-5 premium", "A higher-capability OpenAI model for difficult reasoning and coding work.", ["Reasoning", "Streaming", "Coding"], "OpenAI API pricing", "https://developers.openai.com/api/docs/pricing"),
  model("gpt-5.5", "GPT-5.5", "OpenAI", "O", "sky", 5, 30, "GPT-5 premium", "A premium OpenAI model for advanced text reasoning and engineering.", ["Reasoning", "Streaming", "Coding"], "OpenAI API pricing", "https://developers.openai.com/api/docs/pricing"),
  model("kimi-k3", "Kimi K3", "Moonshot AI", "K", "amber", 3, 15, "Moonshot flagship", "Moonshot AI’s flagship text model for long-horizon coding and knowledge work.", ["Reasoning", "Long context", "Streaming", "Coding"], "Moonshot AI Kimi API pricing", "https://platform.kimi.ai/docs/pricing/chat-k3"),
  model("minimax-m2", "MiniMax M2", "MiniMax", "M", "amber", 0.3, 1.2, "MiniMax production", "MiniMax’s standard text model for production conversation and agent workflows.", ["Reasoning", "Streaming", "Coding"], "MiniMax API pay-as-you-go pricing", "https://platform.minimax.io/docs/guides/pricing-paygo"),
  model("minimax-m2-7", "MiniMax M2.7", "MiniMax", "M", "amber", 0.3, 1.2, "MiniMax production", "MiniMax’s M2.7 text model for capable, efficient chat completions.", ["Reasoning", "Streaming", "Coding"], "MiniMax API pay-as-you-go pricing", "https://platform.minimax.io/docs/guides/pricing-paygo"),
  model("qwen3.7-max", "Qwen3.7 Max", "Alibaba Cloud", "Q", "lime", 2.5, 7.5, "Qwen flagship", "Alibaba Cloud’s Qwen flagship for advanced reasoning and coding tasks.", ["Reasoning", "Long context", "Streaming", "Coding"], "Alibaba Cloud Model Studio pricing", "https://www.alibabacloud.com/help/en/model-studio/model-pricing"),
];

export const PLAYGROUND_FEATURED_MODEL_IDS = ["gpt-6-astra", "claude-fable-5.1", "qwen3.8-max", "claude-opus-5", "kimi-k3", "qwen3.7-max"] as const;

export function prioritizePlaygroundModels<T extends { id: string }>(models: readonly T[]) {
  const featured = PLAYGROUND_FEATURED_MODEL_IDS.flatMap(id => models.filter(model => model.id === id));
  return [...featured, ...models.filter(model => !PLAYGROUND_FEATURED_MODEL_IDS.includes(model.id as (typeof PLAYGROUND_FEATURED_MODEL_IDS)[number]))];
}

export const formatUsdPerMillion = (value: number) => `$${value.toFixed(2)}`;
export const TOKENFORGE_PLATFORM_CHARGE_MULTIPLIER = 2.0;
export const tokenForgeCreditRatePerMillion = (upstreamRate: number, modelId?: string) => {
  if (modelId === "gpt-6-astra" || modelId === "claude-opus-5" || modelId === "claude-opus-5.5" || modelId === "gpt-6-sol") return upstreamRate;
  return upstreamRate * TOKENFORGE_PLATFORM_CHARGE_MULTIPLIER;
};
export const formatTokenForgeCreditRatePerMillion = (upstreamRate: number, modelId?: string) => `$${tokenForgeCreditRatePerMillion(upstreamRate, modelId).toFixed(4).replace(/0+$/, "").replace(/\.$/, "")}`;
