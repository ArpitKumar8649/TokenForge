import { PRICING_URL } from "../shared/const";

export const FXQIDIAN_PROVIDER_SLUG = "fxqidian" as const;
export const CLUSTER_PROTOCOL_PROVIDER_SLUG = "cluster-protocol" as const;
export const TOKENHARBOR_PROVIDER_SLUG = "tokenharbor" as const;
export const CLAUDE_OPUS5_PROVIDER_SLUG = "claude-opus5" as const;
export const GPT6_ASTRA_PROVIDER_SLUG = "gpt6-astra" as const;
export const TOKENROUTER_PROVIDER_SLUG = "tokenrouter" as const;

export type TokenForgeProviderSlug = typeof FXQIDIAN_PROVIDER_SLUG | typeof CLUSTER_PROTOCOL_PROVIDER_SLUG | typeof TOKENHARBOR_PROVIDER_SLUG | typeof CLAUDE_OPUS5_PROVIDER_SLUG | typeof GPT6_ASTRA_PROVIDER_SLUG | typeof TOKENROUTER_PROVIDER_SLUG;

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
  upstreamHandler?: string;
  isPremium?: boolean;
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
    id: "claude-opus-5.5",
    displayName: "Claude Opus 5.5",
    description: "Next-generation Anthropic frontier model featuring deep reasoning, exceptional code synthesis, and autonomous multi-step problem solving.",
    providerSlug: TOKENROUTER_PROVIDER_SLUG,
    providerName: "Claude",
    capabilities: ["reasoning", "coding", "streaming", "thinking"],
    inputUsdPerMillion: 15.0,
    outputUsdPerMillion: 75.0,
    pricingSource: "TokenForge Claude Opus 5.5 pricing",
    pricingUrl: PRICING_URL,
    isPremium: true,
  },
  {
    id: "gpt-6-sol",
    displayName: "GPT 6 Sol",
    description: "Next-generation OpenAI frontier reasoning model featuring Sol high-velocity inference, autonomous software engineering, and extended chain-of-thought.",
    providerSlug: TOKENROUTER_PROVIDER_SLUG,
    providerName: "OpenAI",
    capabilities: ["reasoning", "coding", "streaming", "thinking"],
    inputUsdPerMillion: 15.0,
    outputUsdPerMillion: 75.0,
    pricingSource: "TokenForge GPT 6 Sol pricing",
    pricingUrl: PRICING_URL,
    isPremium: true,
  },
  {
    id: "gpt-6-astra",
    displayName: "GPT-6 Astra",
    description: "Next-generation OpenAI frontier reasoning model featuring ultra-deep Astra chain-of-thought, code synthesis, and multimodal capability.",
    providerSlug: TOKENROUTER_PROVIDER_SLUG,
    providerName: "OpenAI",
    capabilities: ["reasoning", "coding", "streaming", "thinking"],
    inputUsdPerMillion: 15.0,
    outputUsdPerMillion: 75.0,
    pricingSource: "TokenForge GPT-6 Astra pricing",
    pricingUrl: PRICING_URL,
    isPremium: true,
  },
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
    inputUsdPerMillion: 15,
    outputUsdPerMillion: 75,
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
    id: "claude-fable-5.1",
    displayName: "Claude Fable 5.1",
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
    id: "claude-sonnet-5.5",
    displayName: "Claude Sonnet 5.5",
    description: "Anthropic's flagship Sonnet 5.5 frontier model offering exceptional intelligence, advanced software engineering, and fast reasoning.",
    providerSlug: TOKENROUTER_PROVIDER_SLUG,
    providerName: "Claude",
    capabilities: ["reasoning", "coding", "streaming", "thinking"],
    inputUsdPerMillion: 3,
    outputUsdPerMillion: 15,
    pricingSource: "Anthropic Claude API pricing",
    pricingUrl: "https://platform.claude.com/docs/en/about-claude/pricing",
    isPremium: true,
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
    id: "kimi-k3", displayName: "Kimi K3", description: "Moonshot AI’s flagship text model for long-horizon coding and knowledge work.", providerSlug: TOKENROUTER_PROVIDER_SLUG, providerName: "Moonshot AI", capabilities: ["reasoning", "coding", "long_context", "streaming"], inputUsdPerMillion: 3, outputUsdPerMillion: 15, pricingSource: "Moonshot AI Kimi API pricing", pricingUrl: "https://platform.kimi.ai/docs/pricing/chat-k3",
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

export type TokenForgeModelId = string;

export const TOKENFORGE_DEFAULT_MODEL_IDS = TOKENFORGE_MODEL_CATALOGUE.map(model => model.id);
export let TOKENFORGE_MODEL_IDS: string[] = [...TOKENFORGE_DEFAULT_MODEL_IDS];

export let dynamicModelCatalogue: TokenForgeModelDefinition[] = TOKENFORGE_MODEL_CATALOGUE.map(model => ({ ...model }));
const modelById = new Map<string, TokenForgeModelDefinition>(dynamicModelCatalogue.map(model => [model.id, model]));

type CatalogueChangeListener = () => void;
const catalogueChangeListeners: CatalogueChangeListener[] = [];

export function onModelCatalogueChanged(listener: CatalogueChangeListener) {
  catalogueChangeListeners.push(listener);
}

function notifyCatalogueChanged() {
  TOKENFORGE_MODEL_IDS = dynamicModelCatalogue.map(m => m.id);
  for (const listener of catalogueChangeListeners) {
    try {
      listener();
    } catch (e) {
      console.error("[ModelCatalogue] error in listener", e);
    }
  }
}

export function getDynamicModelCatalogue(): TokenForgeModelDefinition[] {
  return dynamicModelCatalogue;
}

export function getDynamicModelIds(): string[] {
  return dynamicModelCatalogue.map(m => m.id);
}

export function isTokenForgeModelId(model: string): model is TokenForgeModelId {
  return modelById.has(model);
}

export function getTokenForgeModel(model: string): TokenForgeModelDefinition | undefined {
  return modelById.get(model);
}

export function getTokenForgeProviderSlug(model: string): TokenForgeProviderSlug | undefined {
  return modelById.get(model)?.providerSlug;
}

export function getTokenForgeUpstreamModelId(model: string) {
  return modelById.get(model)?.upstreamModelId ?? modelById.get(model)?.id;
}


/**
 * Synchronizes an individual model row from the database into the runtime in-memory catalogue.
 */
export function syncModelFromDatabaseRecord(record: {
  modelId: string;
  displayName: string;
  description?: string | null;
  providerSlug: string;
  capabilities?: unknown;
}) {
  const existingDef = modelById.get(record.modelId);
  const caps = Array.isArray(record.capabilities) ? record.capabilities : existingDef?.capabilities ?? ["reasoning", "coding", "streaming"];

  const updatedDef: TokenForgeModelDefinition = {
    id: record.modelId,
    displayName: record.displayName,
    description: record.description ?? existingDef?.description ?? "",
    providerSlug: (record.providerSlug as TokenForgeProviderSlug) || existingDef?.providerSlug || CLUSTER_PROTOCOL_PROVIDER_SLUG,
    providerName: existingDef?.providerName ?? "TokenForge",
    capabilities: caps,
    inputUsdPerMillion: existingDef?.inputUsdPerMillion ?? 0.5,
    outputUsdPerMillion: existingDef?.outputUsdPerMillion ?? 2.0,
    pricingSource: existingDef?.pricingSource ?? "TokenForge pricing",
    pricingUrl: existingDef?.pricingUrl ?? PRICING_URL,
    upstreamModelId: existingDef?.upstreamModelId ?? (record.modelId === "deepseek-v4-pro" ? "deepseek-v4-flash:free" : record.modelId),
    upstreamHandler: existingDef?.upstreamHandler ?? (record.modelId === "deepseek-v4-pro" ? "deepseek-v4-pro" : undefined),
    isPremium: existingDef?.isPremium,
  };

  const idx = dynamicModelCatalogue.findIndex(m => m.id === record.modelId);
  if (idx !== -1) {
    dynamicModelCatalogue[idx] = updatedDef;
  } else {
    dynamicModelCatalogue.push(updatedDef);
  }
  modelById.set(record.modelId, updatedDef);
}

/**
 * Normalizes user-supplied or client-SDK model names (handling spaces, uppercase, dashes,
 * and common provider aliases like "glm 5.3", "GLM-5.3", "glm5.3", "claude-3-5-sonnet", etc.)
 * to a canonical TokenForgeModelId.
 * If a model was renamed or retired, old aliases will NOT map to it if it is no longer in modelById.
 */
export function normalizeModelIdentifier(raw: string | unknown): string {
  if (typeof raw !== "string" || !raw.trim()) return "";
  const trimmed = raw.trim();
  if (modelById.has(trimmed)) return trimmed;

  const lower = trimmed.toLowerCase();
  if (modelById.has(lower)) return lower;

  // Normalized hyphenated version (replaces spaces and underscores with dashes)
  const dashed = lower.replace(/[\s_]+/g, "-");
  if (modelById.has(dashed)) return dashed;

  // GLM aliases
  if (dashed === "glm-5.3" || dashed === "glm5.3" || dashed === "glm-53" || dashed === "glm53" || dashed === "glm-5.3-turbo" || dashed === "glm-5.3-air") {
    if (modelById.has("glm-5.3")) return "glm-5.3";
  }
  if (dashed === "glm-5.2" || dashed === "glm5.2" || dashed === "glm-52" || dashed === "glm52") {
    if (modelById.has("glm-5.2")) return "glm-5.2";
  }
  if (dashed === "glm-5.1" || dashed === "glm5.1") {
    if (modelById.has("glm-5.1")) return "glm-5.1";
  }
  if (dashed === "glm" || dashed === "glm-5" || dashed === "glm5") {
    if (modelById.has("glm-5.3")) return "glm-5.3";
  }

  // Claude Opus 5.5 aliases
  if (dashed === "claude-opus-5.5" || dashed === "claude-5.5-opus" || dashed === "opus-5.5" || dashed === "opus5.5" || dashed === "anthropic/claude-opus-5.5") {
    if (modelById.has("claude-opus-5.5")) return "claude-opus-5.5";
  }

  // GPT-6 Sol aliases
  if (dashed === "gpt-6-sol" || dashed === "gpt6-sol" || dashed === "gpt-6sol" || dashed === "sol" || dashed === "gpt-sol" || dashed === "openai/gpt-6-sol") {
    if (modelById.has("gpt-6-sol")) return "gpt-6-sol";
  }

  // Claude Opus aliases
  if (dashed.startsWith("claude-3-opus") || dashed === "claude-opus" || dashed === "opus") {
    if (modelById.has("claude-opus-5")) return "claude-opus-5";
  }

  // Claude Sonnet aliases
  if (dashed.startsWith("claude-sonnet-5-5") || dashed === "claude-sonnet-5.5" || dashed === "sonnet-5.5") {
    if (modelById.has("claude-sonnet-5.5")) return "claude-sonnet-5.5";
  }
  if (dashed.startsWith("claude-3-5-sonnet") || dashed.startsWith("claude-3-7-sonnet") || dashed === "claude-sonnet" || dashed === "sonnet") {
    if (modelById.has("claude-sonnet-5.5")) return "claude-sonnet-5.5";
    if (modelById.has("claude-sonnet-4.6")) return "claude-sonnet-4.6";
  }

  // Claude Fable aliases
  if (
    dashed.startsWith("claude-3-5-haiku") ||
    dashed.startsWith("claude-3-haiku") ||
    dashed.startsWith("claude-fable") ||
    dashed.startsWith("fable") ||
    dashed === "haiku" ||
    dashed === "claude-haiku" ||
    dashed === "claude-fable-5" ||
    dashed === "claude-fable-5.1" ||
    dashed === "fable-5" ||
    dashed === "fable-5.1" ||
    dashed === "fable5" ||
    dashed === "fable5.1"
  ) {
    if (modelById.has("claude-fable-5.1")) return "claude-fable-5.1";
  }

  // GPT-6 Astra aliases
  if (dashed === "gpt-6" || dashed === "gpt6" || dashed === "gpt-6-astra" || dashed === "astra" || dashed === "openai/gpt-6-astra") {
    if (modelById.has("gpt-6-astra")) return "gpt-6-astra";
  }

  // DeepSeek aliases - ONLY map if deepseek-v4-pro still exists in active modelById!
  if (dashed === "deepseek" || dashed === "deepseek-v4" || dashed === "deepseek-v4-pro" || dashed === "deepseek-chat") {
    if (modelById.has("deepseek-v4-pro")) return "deepseek-v4-pro";
  }

  // Qwen aliases
  if (dashed === "qwen" || dashed === "qwen-3.8-max" || dashed === "qwen3.8-max") {
    if (modelById.has("qwen3.8-max")) return "qwen3.8-max";
  }

  return trimmed;
}
