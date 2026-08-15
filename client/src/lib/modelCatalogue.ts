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
};

const model = (id: string, name: string, provider: string, providerMark: string, tone: CatalogueModel["tone"], inputUsdPerMillion: number, outputUsdPerMillion: number, eyebrow: string, description: string, capabilities: string[], pricingSource: string, pricingUrl: string): CatalogueModel => ({ id, name, provider, providerMark, tone, inputUsdPerMillion, outputUsdPerMillion, eyebrow, description, capabilities, pricingSource, pricingUrl });

export const TOKENFORGE_MODELS: CatalogueModel[] = [
  model("glm-5.2", "GLM-5.2", "Z.AI", "GLM", "lime", 1.4, 4.4, "Long-horizon intelligence", "A focused option for complex engineering, coding, and extended-context work where careful reasoning matters.", ["Reasoning", "Long context", "Streaming", "Coding"], "Z.AI model pricing", "https://docs.z.ai/guides/overview/pricing"),
  model("grok-4.5", "Grok 4.5", "xAI", "G", "cyan", 2, 6, "Fast engineering reasoning", "A reasoning-forward option for code, agentic workflows, and practical knowledge work.", ["Reasoning", "Agentic", "Streaming", "Coding"], "xAI API pricing", "https://docs.x.ai/developers/pricing"),
  model("deepseek-v4-flash", "DeepSeek V4 Flash", "DeepSeek", "DS", "sky", 0.14, 0.28, "TokenHarbor Flash route", "A fast DeepSeek text-chat route served through TokenHarbor’s `deepseek-v4-flash:free` endpoint.", ["Streaming", "Coding"], "DeepSeek V4 Flash API pricing (cache-miss input)", "https://api-docs.deepseek.com/quick_start/pricing"),
  model("deepseek-v4-pro", "DeepSeek V4 Pro", "DeepSeek", "DS", "sky", 0.14, 0.28, "Shared Flash upstream", "A compatibility route currently backed by the same TokenHarbor `deepseek-v4-flash:free` endpoint as DeepSeek V4 Flash, so it uses that upstream’s published rate.", ["Streaming", "Coding"], "DeepSeek V4 Flash API pricing (shared Flash upstream; cache-miss input)", "https://api-docs.deepseek.com/quick_start/pricing"),
  model("glm-5.1", "GLM-5.1", "Z.AI", "GLM", "lime", 1.4, 4.4, "Z.AI reasoning", "A capable Z.AI general-purpose model for practical text reasoning and coding.", ["Reasoning", "Streaming", "Coding"], "Z.AI model pricing", "https://docs.z.ai/guides/overview/pricing"),
  model("claude-haiku-4.5", "Claude Haiku 4.5", "Anthropic", "AI", "violet", 1, 5, "Fast Claude", "Anthropic’s compact production model for efficient writing, chat, and coding.", ["Streaming", "Coding"], "Anthropic Claude API pricing", "https://platform.claude.com/docs/en/about-claude/pricing"),
  model("claude-opus-4.5", "Claude Opus 4.5", "Anthropic", "AI", "violet", 5, 25, "Premium Claude", "Anthropic’s high-capability model for demanding text reasoning and engineering tasks.", ["Reasoning", "Streaming", "Coding"], "Anthropic Claude API pricing", "https://platform.claude.com/docs/en/about-claude/pricing"),
  model("claude-opus-4.6", "Claude Opus 4.6", "Anthropic", "AI", "violet", 5, 25, "Premium Claude", "Anthropic’s high-capability model for demanding text reasoning and engineering tasks.", ["Reasoning", "Streaming", "Coding"], "Anthropic Claude API pricing", "https://platform.claude.com/docs/en/about-claude/pricing"),
  model("claude-opus-4.7", "Claude Opus 4.7", "Anthropic", "AI", "violet", 5, 25, "Premium Claude", "Anthropic’s high-capability model for demanding text reasoning and engineering tasks.", ["Reasoning", "Streaming", "Coding"], "Anthropic Claude API pricing", "https://platform.claude.com/docs/en/about-claude/pricing"),
  model("claude-sonnet-4.5", "Claude Sonnet 4.5", "Anthropic", "AI", "violet", 3, 15, "Balanced Claude", "Anthropic’s balanced production model for capable chat, coding, and streamed responses.", ["Reasoning", "Streaming", "Coding"], "Anthropic Claude API pricing", "https://platform.claude.com/docs/en/about-claude/pricing"),
  model("claude-sonnet-4.6", "Claude Sonnet 4.6", "Anthropic", "AI", "violet", 3, 15, "Balanced Claude", "Anthropic’s balanced production model for capable chat, coding, and streamed responses.", ["Reasoning", "Streaming", "Coding"], "Anthropic Claude API pricing", "https://platform.claude.com/docs/en/about-claude/pricing"),
  model("gpt-4.1", "GPT-4.1", "OpenAI", "O", "sky", 2, 8, "OpenAI production", "A capable OpenAI text model for agentic, coding, and long-context chat workflows.", ["Reasoning", "Streaming", "Coding"], "OpenAI API pricing", "https://developers.openai.com/api/docs/pricing"),
  model("gpt-4.1-mini", "GPT-4.1 mini", "OpenAI", "O", "sky", 0.4, 1.6, "OpenAI efficient", "A compact OpenAI text model for efficient production chat and coding.", ["Streaming", "Coding"], "OpenAI API pricing", "https://developers.openai.com/api/docs/pricing"),
  model("gpt-4.1-nano", "GPT-4.1 nano", "OpenAI", "O", "sky", 0.1, 0.4, "OpenAI compact", "A lightweight OpenAI route for high-throughput text completions.", ["Streaming"], "OpenAI API pricing", "https://developers.openai.com/api/docs/pricing"),
  model("gpt-4o", "GPT-4o", "OpenAI", "O", "sky", 2.5, 10, "OpenAI general", "OpenAI’s general-purpose route, exposed here for text-only chat completions.", ["Reasoning", "Streaming", "Coding"], "OpenAI API pricing", "https://developers.openai.com/api/docs/pricing"),
  model("gpt-4o-mini", "GPT-4o mini", "OpenAI", "O", "sky", 0.15, 0.6, "OpenAI efficient", "An efficient OpenAI text model for everyday production chat.", ["Streaming", "Coding"], "OpenAI API pricing", "https://developers.openai.com/api/docs/pricing"),
  model("gpt-5", "GPT-5", "OpenAI", "O", "sky", 1.25, 10, "GPT-5 production", "OpenAI’s general production model for high-quality chat and coding.", ["Reasoning", "Streaming", "Coding"], "OpenAI API pricing", "https://developers.openai.com/api/docs/pricing"),
  model("gpt-5-mini", "GPT-5 mini", "OpenAI", "O", "sky", 0.25, 2, "GPT-5 efficient", "A smaller GPT-5 route for cost-conscious text-chat workloads.", ["Streaming", "Coding"], "OpenAI API pricing", "https://developers.openai.com/api/docs/pricing"),
  model("gpt-5-nano", "GPT-5 nano", "OpenAI", "O", "sky", 0.05, 0.4, "GPT-5 compact", "A compact GPT-5 route for lower-cost high-volume completion tasks.", ["Streaming"], "OpenAI API pricing", "https://developers.openai.com/api/docs/pricing"),
  model("gpt-5.4", "GPT-5.4", "OpenAI", "O", "sky", 2.5, 15, "GPT-5 premium", "A higher-capability OpenAI model for difficult reasoning and coding work.", ["Reasoning", "Streaming", "Coding"], "OpenAI API pricing", "https://developers.openai.com/api/docs/pricing"),
  model("gpt-5.5", "GPT-5.5", "OpenAI", "O", "sky", 5, 30, "GPT-5 premium", "A premium OpenAI model for advanced text reasoning and engineering.", ["Reasoning", "Streaming", "Coding"], "OpenAI API pricing", "https://developers.openai.com/api/docs/pricing"),
  model("o3", "o3", "OpenAI", "O", "sky", 2, 8, "OpenAI reasoning", "OpenAI’s reasoning model for complex analytical and coding tasks.", ["Reasoning", "Streaming", "Coding"], "OpenAI API pricing", "https://developers.openai.com/api/docs/pricing"),
  model("o3-pro", "o3-pro", "OpenAI", "O", "sky", 20, 80, "OpenAI reasoning", "A premium OpenAI reasoning route for difficult multi-step text work.", ["Reasoning", "Streaming", "Coding"], "OpenAI API pricing", "https://developers.openai.com/api/docs/pricing"),
  model("o4-mini", "o4-mini", "OpenAI", "O", "sky", 1.1, 4.4, "OpenAI reasoning", "An efficient OpenAI reasoning model for tool-oriented text and coding work.", ["Reasoning", "Streaming", "Coding"], "OpenAI API pricing", "https://developers.openai.com/api/docs/pricing"),
  model("kimi-k3", "Kimi K3", "Moonshot AI", "K", "amber", 3, 15, "Moonshot flagship", "Moonshot AI’s flagship text model for long-horizon coding and knowledge work.", ["Reasoning", "Long context", "Streaming", "Coding"], "Moonshot AI Kimi API pricing", "https://platform.kimi.ai/docs/pricing/chat-k3"),
  model("gemini-2.5-flash", "Gemini 2.5 Flash", "Google", "✦", "coral", 0.3, 2.5, "Google fast", "Google’s fast text model for responsive general-purpose chat completions.", ["Streaming", "Coding"], "Gemini API pricing", "https://ai.google.dev/gemini-api/docs/pricing"),
  model("gemini-2.5-flash-lite", "Gemini 2.5 Flash-Lite", "Google", "✦", "coral", 0.1, 0.4, "Google lightweight", "Google’s lightweight text model for efficient high-volume chat workloads.", ["Streaming"], "Gemini API pricing", "https://ai.google.dev/gemini-api/docs/pricing"),
  model("mistral-large-3", "Mistral Large 3", "Mistral AI", "M", "coral", 0.5, 1.5, "Mistral capable", "Mistral AI’s capable text model for general reasoning, writing, and code.", ["Reasoning", "Streaming", "Coding"], "Mistral API inference pricing", "https://docs.mistral.ai/inference/pricing"),
  model("mistral-small-4", "Mistral Small 4", "Mistral AI", "M", "coral", 0.15, 0.6, "Mistral efficient", "Mistral AI’s efficient text model for low-latency production chat.", ["Streaming", "Coding"], "Mistral API inference pricing", "https://docs.mistral.ai/inference/pricing"),
  model("minimax-m2", "MiniMax M2", "MiniMax", "M", "amber", 0.3, 1.2, "MiniMax production", "MiniMax’s standard text model for production conversation and agent workflows.", ["Reasoning", "Streaming", "Coding"], "MiniMax API pay-as-you-go pricing", "https://platform.minimax.io/docs/guides/pricing-paygo"),
  model("minimax-m2-7", "MiniMax M2.7", "MiniMax", "M", "amber", 0.3, 1.2, "MiniMax production", "MiniMax’s M2.7 text model for capable, efficient chat completions.", ["Reasoning", "Streaming", "Coding"], "MiniMax API pay-as-you-go pricing", "https://platform.minimax.io/docs/guides/pricing-paygo"),
  model("qwen3.7-max", "Qwen3.7 Max", "Alibaba Cloud", "Q", "lime", 2.5, 7.5, "Qwen flagship", "Alibaba Cloud’s Qwen flagship for advanced reasoning and coding tasks.", ["Reasoning", "Long context", "Streaming", "Coding"], "Alibaba Cloud Model Studio pricing", "https://www.alibabacloud.com/help/en/model-studio/model-pricing"),
];

export const formatUsdPerMillion = (value: number) => `$${value.toFixed(2)}`;
