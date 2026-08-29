import { PRICING_URL } from "../shared/const";

export const FXQIDIAN_PROVIDER_SLUG = "fxqidian" as const;
export const CLUSTER_PROTOCOL_PROVIDER_SLUG = "cluster-protocol" as const;
export const TOKENHARBOR_PROVIDER_SLUG = "tokenharbor" as const;
export const CLAUDE_OPUS5_PROVIDER_SLUG = "claude-opus5" as const;
export const TOKENROUTER_PROVIDER_SLUG = "tokenrouter" as const;

export type TokenForgeProviderSlug = typeof FXQIDIAN_PROVIDER_SLUG | typeof CLUSTER_PROTOCOL_PROVIDER_SLUG | typeof TOKENHARBOR_PROVIDER_SLUG | typeof CLAUDE_OPUS5_PROVIDER_SLUG | typeof TOKENROUTER_PROVIDER_SLUG;

export type TokenForgeModelDefinition = {
  id: string;
  displayName: string;
  description: string;
  providerSlug: TokenForgeProviderSlug;
  providerName: string;
  capabilities: readonly string[];
  inputUsdPerMillion: number;
  outputUsdPerMillion: number;
  pricingSource: string;
  pricingUrl: string;
  upstreamModelId?: string;
};

const claude = (id: string, displayName: string, inputUsdPerMillion: number, outputUsdPerMillion: number): TokenForgeModelDefinition => ({
  id,
  displayName,
  description: "Anthropic’s production Claude model for capable reasoning, writing, coding, and streamed chat completions.",
  providerSlug: CLUSTER_PROTOCOL_PROVIDER_SLUG,
  providerName: "Anthropic",
  capabilities: ["reasoning", "coding", "streaming"],
  inputUsdPerMillion,
  outputUsdPerMillion,
  pricingSource: "Anthropic Claude API pricing",
  pricingUrl: "https://platform.claude.com/docs/en/about-claude/pricing",
});

export const TOKENFORGE_MODEL_CATALOGUE = [
  {
    id: "glm-5.3",
    displayName: "GLM 5.3",
    description: "A configurable TokenRouter-backed Z.AI route for advanced reasoning, coding, and streamed text chat.",
    providerSlug: TOKENROUTER_PROVIDER_SLUG,
    providerName: "Z.AI",
    capabilities: ["reasoning", "coding", "streaming"],
    inputUsdPerMillion: 1.4,
    outputUsdPerMillion: 4.4,
    pricingSource: "TokenForge provisional GLM 5.3 configured-route pricing",
    pricingUrl: PRICING_URL,
  },
  {
    id: "glm-5.2",
    displayName: "GLM-5.2",
    description: "A flagship long-horizon model for complex engineering, coding, and extended-context work.",
    providerSlug: FXQIDIAN_PROVIDER_SLUG,
    providerName: "Z.AI",
    capabilities: ["reasoning", "long_context", "streaming", "coding"],
    inputUsdPerMillion: 1.4,
    outputUsdPerMillion: 4.4,
    pricingSource: "Z.AI model pricing",
    pricingUrl: "https://docs.z.ai/guides/overview/pricing",
  },
  {
    id: "grok-4.5",
    displayName: "Grok 4.5",
    description: "A high-performance reasoning model positioned for code, agentic workflows, and knowledge work.",
    providerSlug: FXQIDIAN_PROVIDER_SLUG,
    providerName: "xAI",
    capabilities: ["reasoning", "agentic", "coding", "streaming"],
    inputUsdPerMillion: 2,
    outputUsdPerMillion: 6,
    pricingSource: "xAI API pricing",
    pricingUrl: "https://docs.x.ai/developers/pricing",
  },
  {
    id: "deepseek-v4-flash",
    displayName: "DeepSeek V4 Flash",
    description: "A fast DeepSeek text-chat route served through TokenHarbor’s `deepseek-v4-flash:free` endpoint.",
    providerSlug: TOKENHARBOR_PROVIDER_SLUG,
    providerName: "DeepSeek",
    capabilities: ["streaming", "coding"],
    inputUsdPerMillion: 0.14,
    outputUsdPerMillion: 0.28,
    pricingSource: "DeepSeek V4 Flash API pricing (cache-miss input)",
    pricingUrl: "https://api-docs.deepseek.com/quick_start/pricing",
    upstreamModelId: "deepseek-v4-flash:free",
  },
  {
    id: "deepseek-v4-pro",
    displayName: "DeepSeek V4 Pro",
    description: "A TokenForge compatibility route currently backed by the same TokenHarbor `deepseek-v4-flash:free` endpoint as DeepSeek V4 Flash.",
    providerSlug: TOKENHARBOR_PROVIDER_SLUG,
    providerName: "DeepSeek",
    capabilities: ["streaming", "coding"],
    inputUsdPerMillion: 0.14,
    outputUsdPerMillion: 0.28,
    pricingSource: "DeepSeek V4 Flash API pricing (shared Flash upstream; cache-miss input)",
    pricingUrl: "https://api-docs.deepseek.com/quick_start/pricing",
    upstreamModelId: "deepseek-v4-flash:free",
  },
  {
    id: "claude-opus-5",
    displayName: "Claude Opus 5",
    description: "A configured custom upstream route for capable text reasoning, coding, and streamed chat completions. Its provider identity and technical details are not asserted beyond this configured route.",
    providerSlug: TOKENROUTER_PROVIDER_SLUG,
    providerName: "Claude",
    capabilities: ["reasoning", "coding", "streaming"],
    inputUsdPerMillion: 5,
    outputUsdPerMillion: 25,
    pricingSource: "TokenForge provisional configured-route pricing",
    pricingUrl: PRICING_URL,
  },
  {
    id: "qwen3.8-27b",
    displayName: "Qwen3.8 27B",
    description: "A capable Qwen 3.8 27B text model for reasoning, coding, and chat completions.",
    providerSlug: CLAUDE_OPUS5_PROVIDER_SLUG,
    providerName: "Alibaba Cloud",
    capabilities: ["reasoning", "coding", "streaming"],
    inputUsdPerMillion: 0.45,
    outputUsdPerMillion: 3.2,
    pricingSource: "Qwen3.8 27B API pricing",
    pricingUrl: "https://openrouter.ai/qwen/qwen3.8-27b",
    upstreamModelId: "qwen/qwen3.8-27b-free",
  },
  {
    id: "qwen3.8-max",
    displayName: "Qwen 3.8 Max",
    description: "Qwen’s flagship text route for advanced reasoning, coding, streamed chat, and visible Playground thinking summaries.",
    providerSlug: TOKENROUTER_PROVIDER_SLUG,
    providerName: "Qwen",
    capabilities: ["reasoning", "thinking", "coding", "streaming"],
    inputUsdPerMillion: 2,
    outputUsdPerMillion: 6,
    pricingSource: "OpenRouter Qwen3.8 Max published rate",
    pricingUrl: "https://openrouter.ai/qwen/qwen3.8-max",
    upstreamModelId: "qwen/qwen3.8-max-free",
  },
  {
    id: "claude-fable-5",
    displayName: "Claude Fable 5",
    description: "A capable text model available through TokenForge for reasoning, coding, and streamed chat completions. Its provider identity and technical details are not asserted beyond this configured route.",
    providerSlug: TOKENROUTER_PROVIDER_SLUG,
    providerName: "Claude",
    capabilities: ["reasoning", "thinking", "coding", "streaming"],
    inputUsdPerMillion: 10,
    outputUsdPerMillion: 50,
    pricingSource: "TokenForge provisional configured-route pricing",
    pricingUrl: PRICING_URL,
  },
  {
    id: "glm-5.1",
    displayName: "GLM-5.1",
    description: "A Z.AI general-purpose reasoning and coding model for text chat workloads.",
    providerSlug: CLUSTER_PROTOCOL_PROVIDER_SLUG,
    providerName: "Z.AI",
    capabilities: ["reasoning", "coding", "streaming"],
    inputUsdPerMillion: 1.4,
    outputUsdPerMillion: 4.4,
    pricingSource: "Z.AI model pricing",
    pricingUrl: "https://docs.z.ai/guides/overview/pricing",
  },
  claude("claude-haiku-4.5", "Claude Haiku 4.5", 1, 5),
  claude("claude-opus-4.5", "Claude Opus 4.5", 5, 25),
  claude("claude-opus-4.6", "Claude Opus 4.6", 5, 25),
  claude("claude-opus-4.7", "Claude Opus 4.7", 5, 25),
  claude("claude-sonnet-4.5", "Claude Sonnet 4.5", 3, 15),
  {
    id: "claude-sonnet-4.6",
    displayName: "Claude Sonnet 4.6",
    description: "A configurable TokenForge-managed Claude Sonnet 4.6 route for reasoning, coding, and streamed text chat.",
    providerSlug: TOKENROUTER_PROVIDER_SLUG,
    providerName: "Claude",
    capabilities: ["reasoning", "coding", "streaming"],
    inputUsdPerMillion: 3,
    outputUsdPerMillion: 15,
    pricingSource: "Anthropic Claude API pricing",
    pricingUrl: "https://platform.claude.com/docs/en/about-claude/pricing",
  },
  {
    id: "gpt-4.1",
    displayName: "GPT-4.1",
    description: "OpenAI’s high-capability text model for agentic, coding, and long-context chat workflows.",
    providerSlug: CLUSTER_PROTOCOL_PROVIDER_SLUG,
    providerName: "OpenAI",
    capabilities: ["reasoning", "coding", "streaming"],
    inputUsdPerMillion: 2,
    outputUsdPerMillion: 8,
    pricingSource: "OpenAI API pricing",
    pricingUrl: "https://developers.openai.com/api/docs/pricing",
  },
  {
    id: "gpt-4.1-mini", displayName: "GPT-4.1 mini", description: "A compact OpenAI text model for efficient chat and coding tasks.", providerSlug: CLUSTER_PROTOCOL_PROVIDER_SLUG, providerName: "OpenAI", capabilities: ["coding", "streaming"], inputUsdPerMillion: 0.4, outputUsdPerMillion: 1.6, pricingSource: "OpenAI API pricing", pricingUrl: "https://developers.openai.com/api/docs/pricing",
  },
  {
    id: "gpt-4.1-nano", displayName: "GPT-4.1 nano", description: "A lightweight OpenAI text model for high-throughput chat completions.", providerSlug: CLUSTER_PROTOCOL_PROVIDER_SLUG, providerName: "OpenAI", capabilities: ["streaming"], inputUsdPerMillion: 0.1, outputUsdPerMillion: 0.4, pricingSource: "OpenAI API pricing", pricingUrl: "https://developers.openai.com/api/docs/pricing",
  },
  {
    id: "gpt-4o", displayName: "GPT-4o", description: "OpenAI’s general-purpose model available here for text-only chat completions.", providerSlug: CLUSTER_PROTOCOL_PROVIDER_SLUG, providerName: "OpenAI", capabilities: ["reasoning", "coding", "streaming"], inputUsdPerMillion: 2.5, outputUsdPerMillion: 10, pricingSource: "OpenAI API pricing", pricingUrl: "https://developers.openai.com/api/docs/pricing",
  },
  {
    id: "gpt-4o-mini", displayName: "GPT-4o mini", description: "An efficient OpenAI text model for everyday production chat workflows.", providerSlug: CLUSTER_PROTOCOL_PROVIDER_SLUG, providerName: "OpenAI", capabilities: ["coding", "streaming"], inputUsdPerMillion: 0.15, outputUsdPerMillion: 0.6, pricingSource: "OpenAI API pricing", pricingUrl: "https://developers.openai.com/api/docs/pricing",
  },
  {
    id: "gpt-5", displayName: "GPT-5", description: "OpenAI’s general production text model for high-quality chat and coding.", providerSlug: CLUSTER_PROTOCOL_PROVIDER_SLUG, providerName: "OpenAI", capabilities: ["reasoning", "coding", "streaming"], inputUsdPerMillion: 1.25, outputUsdPerMillion: 10, pricingSource: "OpenAI API pricing", pricingUrl: "https://developers.openai.com/api/docs/pricing",
  },
  {
    id: "gpt-5-mini", displayName: "GPT-5 mini", description: "A smaller GPT-5 text model for cost-conscious chat workloads.", providerSlug: CLUSTER_PROTOCOL_PROVIDER_SLUG, providerName: "OpenAI", capabilities: ["coding", "streaming"], inputUsdPerMillion: 0.25, outputUsdPerMillion: 2, pricingSource: "OpenAI API pricing", pricingUrl: "https://developers.openai.com/api/docs/pricing",
  },
  {
    id: "gpt-5-nano", displayName: "GPT-5 nano", description: "A compact GPT-5 text model for low-cost, high-volume completion tasks.", providerSlug: CLUSTER_PROTOCOL_PROVIDER_SLUG, providerName: "OpenAI", capabilities: ["streaming"], inputUsdPerMillion: 0.05, outputUsdPerMillion: 0.4, pricingSource: "OpenAI API pricing", pricingUrl: "https://developers.openai.com/api/docs/pricing",
  },
  {
    id: "gpt-5.4", displayName: "GPT-5.4", description: "A higher-capability OpenAI text model for demanding reasoning and coding work.", providerSlug: CLUSTER_PROTOCOL_PROVIDER_SLUG, providerName: "OpenAI", capabilities: ["reasoning", "coding", "streaming"], inputUsdPerMillion: 2.5, outputUsdPerMillion: 15, pricingSource: "OpenAI API pricing", pricingUrl: "https://developers.openai.com/api/docs/pricing",
  },
  {
    id: "gpt-5.5", displayName: "GPT-5.5", description: "A premium OpenAI text model for advanced reasoning and engineering workloads.", providerSlug: CLUSTER_PROTOCOL_PROVIDER_SLUG, providerName: "OpenAI", capabilities: ["reasoning", "coding", "streaming"], inputUsdPerMillion: 5, outputUsdPerMillion: 30, pricingSource: "OpenAI API pricing", pricingUrl: "https://developers.openai.com/api/docs/pricing",
  },
  {
    id: "o3", displayName: "o3", description: "OpenAI’s reasoning model for complex analytical and coding tasks.", providerSlug: CLUSTER_PROTOCOL_PROVIDER_SLUG, providerName: "OpenAI", capabilities: ["reasoning", "coding", "streaming"], inputUsdPerMillion: 2, outputUsdPerMillion: 8, pricingSource: "OpenAI API pricing", pricingUrl: "https://developers.openai.com/api/docs/pricing",
  },
  {
    id: "o3-pro", displayName: "o3-pro", description: "OpenAI’s premium reasoning model for difficult multi-step text tasks.", providerSlug: CLUSTER_PROTOCOL_PROVIDER_SLUG, providerName: "OpenAI", capabilities: ["reasoning", "coding", "streaming"], inputUsdPerMillion: 20, outputUsdPerMillion: 80, pricingSource: "OpenAI API pricing", pricingUrl: "https://developers.openai.com/api/docs/pricing",
  },
  {
    id: "o4-mini", displayName: "o4-mini", description: "An efficient OpenAI reasoning model for tool-oriented text and coding work.", providerSlug: CLUSTER_PROTOCOL_PROVIDER_SLUG, providerName: "OpenAI", capabilities: ["reasoning", "coding", "streaming"], inputUsdPerMillion: 1.1, outputUsdPerMillion: 4.4, pricingSource: "OpenAI API pricing", pricingUrl: "https://developers.openai.com/api/docs/pricing",
  },
  {
    id: "kimi-k3", displayName: "Kimi K3", description: "Moonshot AI’s flagship text model for long-horizon coding and knowledge work.", providerSlug: CLUSTER_PROTOCOL_PROVIDER_SLUG, providerName: "Moonshot AI", capabilities: ["reasoning", "coding", "long_context", "streaming"], inputUsdPerMillion: 3, outputUsdPerMillion: 15, pricingSource: "Moonshot AI Kimi API pricing", pricingUrl: "https://platform.kimi.ai/docs/pricing/chat-k3",
  },
  {
    id: "gemini-2.5-flash", displayName: "Gemini 2.5 Flash", description: "Google’s fast text model for responsive general-purpose chat completions.", providerSlug: CLUSTER_PROTOCOL_PROVIDER_SLUG, providerName: "Google", capabilities: ["coding", "streaming"], inputUsdPerMillion: 0.3, outputUsdPerMillion: 2.5, pricingSource: "Gemini API pricing", pricingUrl: "https://ai.google.dev/gemini-api/docs/pricing",
  },
  {
    id: "gemini-2.5-flash-lite", displayName: "Gemini 2.5 Flash-Lite", description: "Google’s lightweight text model for efficient high-volume chat workloads.", providerSlug: CLUSTER_PROTOCOL_PROVIDER_SLUG, providerName: "Google", capabilities: ["streaming"], inputUsdPerMillion: 0.1, outputUsdPerMillion: 0.4, pricingSource: "Gemini API pricing", pricingUrl: "https://ai.google.dev/gemini-api/docs/pricing",
  },
  {
    id: "mistral-large-3", displayName: "Mistral Large 3", description: "Mistral AI’s capable text model for general reasoning, writing, and code.", providerSlug: CLUSTER_PROTOCOL_PROVIDER_SLUG, providerName: "Mistral AI", capabilities: ["reasoning", "coding", "streaming"], inputUsdPerMillion: 0.5, outputUsdPerMillion: 1.5, pricingSource: "Mistral API inference pricing", pricingUrl: "https://docs.mistral.ai/inference/pricing",
  },
  {
    id: "mistral-small-4", displayName: "Mistral Small 4", description: "Mistral AI’s efficient text model for low-latency production chat.", providerSlug: CLUSTER_PROTOCOL_PROVIDER_SLUG, providerName: "Mistral AI", capabilities: ["coding", "streaming"], inputUsdPerMillion: 0.15, outputUsdPerMillion: 0.6, pricingSource: "Mistral API inference pricing", pricingUrl: "https://docs.mistral.ai/inference/pricing",
  },
  {
    id: "minimax-m2", displayName: "MiniMax M2", description: "MiniMax’s standard text model for production conversation and agent workflows.", providerSlug: CLUSTER_PROTOCOL_PROVIDER_SLUG, providerName: "MiniMax", capabilities: ["reasoning", "coding", "streaming"], inputUsdPerMillion: 0.3, outputUsdPerMillion: 1.2, pricingSource: "MiniMax API pay-as-you-go pricing", pricingUrl: "https://platform.minimax.io/docs/guides/pricing-paygo",
  },
  {
    id: "minimax-m2-7", displayName: "MiniMax M2.7", description: "MiniMax’s M2.7 text model for capable and efficient chat completions.", providerSlug: CLUSTER_PROTOCOL_PROVIDER_SLUG, providerName: "MiniMax", capabilities: ["reasoning", "coding", "streaming"], inputUsdPerMillion: 0.3, outputUsdPerMillion: 1.2, pricingSource: "MiniMax API pay-as-you-go pricing", pricingUrl: "https://platform.minimax.io/docs/guides/pricing-paygo",
  },
  {
    id: "qwen3.7-max", displayName: "Qwen3.7 Max", description: "Alibaba Cloud’s Qwen flagship text model for advanced reasoning and coding tasks.", providerSlug: CLUSTER_PROTOCOL_PROVIDER_SLUG, providerName: "Alibaba Cloud", capabilities: ["reasoning", "coding", "long_context", "streaming"], inputUsdPerMillion: 2.5, outputUsdPerMillion: 7.5, pricingSource: "Alibaba Cloud Model Studio pricing", pricingUrl: "https://www.alibabacloud.com/help/en/model-studio/model-pricing",
  },
] as const satisfies readonly TokenForgeModelDefinition[];

export type TokenForgeModelId = (typeof TOKENFORGE_MODEL_CATALOGUE)[number]["id"];
export const TOKENFORGE_MODEL_IDS = TOKENFORGE_MODEL_CATALOGUE.map(model => model.id) as TokenForgeModelId[];
const modelById = new Map<string, TokenForgeModelDefinition>(TOKENFORGE_MODEL_CATALOGUE.map(model => [model.id, model]));

export function isTokenForgeModelId(model: string): model is TokenForgeModelId {
  return modelById.has(model);
}

export function getTokenForgeModel(model: string) {
  return modelById.get(model);
}

export function getTokenForgeProviderSlug(model: string): TokenForgeProviderSlug | undefined {
  return modelById.get(model)?.providerSlug;
}

export function getTokenForgeUpstreamModelId(model: string) {
  return modelById.get(model)?.upstreamModelId ?? modelById.get(model)?.id;
}
