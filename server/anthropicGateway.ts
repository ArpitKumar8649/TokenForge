import type { Express, Request, Response } from "express";
import { randomUUID } from "node:crypto";
import { checkAccountRateLimit } from "./rateLimiters";
import {
  findActiveApiKey,
  getPlatformMaintenanceConfig,
  isUserExemptFromPlatformMaintenance,
  getEffectivePlatformMaintenanceMessage,
  PLATFORM_MAINTENANCE_ERROR_MESSAGE,
  getQuotaStatus,
  getGpt6AstraQuotaStatus,
  isModelAvailable,
  getModelMinTier,
  getModelIsPayg,
  getModelAccess,
  getUserTier,
  isTierSufficient,
  USER_TIER_DISPLAY_NAMES,
  loadGlmToolContinuations,
  recordUsage,
  reserveCredit,
  isUserCreditsEnabled,
  settleReservedCredit,
  storeGlmToolContinuation,
  touchApiKey,
  isUserMessageLoggingEnabled,
  recordUserInteractionLog,
  getModelCompactScalingConfig,
} from "./db";
import type { GlmPrivateToolContinuation } from "./glmToolContinuationVault";
import { calculateCreditChargeNanos, normalizedBillableMaxOutputTokens, type PricingTier } from "./creditPricing";
import {
  forwardProviderRequest,
  isClaudeOpus5ZeroOutputFailure,
  forwardTokenRouterAnthropicMessagesRequest,
  modelScopedGuidance,
  modelScopedGuidanceAnchor,
  publicProviderErrorMessage,
  publicProviderFailureStatus,
  sanitizeModelResponsePayload,
  tokenForgeRequestIpHash,
  type TokenForgeChatInput,
  type TokenForgeChatMessage,
  withModelScopedGuidance,
  formatInspectionMessages,
  finalizeProviderLabel,
  type ProviderRequestContext,
  tryExtractImageDimensions,
  estimateSingleImageTokens,
} from "./openaiGateway";

export { tryExtractImageDimensions, estimateSingleImageTokens };
import {
  isCacheDebugEnabled,
  recordCacheDebugEvent,
  generateSessionId,
} from "./cacheDebugger";
import { CLUSTER_PROTOCOL_PROVIDER_SLUG, getTokenForgeProviderSlug, isTokenForgeModelId, normalizeModelIdentifier, type TokenForgeModelId } from "./modelCatalogue";
import { MultimodalRoutingError, payloadContainsVisualData, payloadContainsDocumentData, pruneOldImagesAndDeriveContent } from "./modelCapabilityRouter";

/** Applies only until upstream response headers arrive; successful bodies and SSE streams may continue within the hosting request ceiling. */
const PROVIDER_TIMEOUT_MS = 120_000;
export const CLAUDE_OPUS5_RESPONSE_START_TIMEOUT_MS = PROVIDER_TIMEOUT_MS;
const SSE_IDLE_TIMEOUT_MS = 120_000;

const disabledStreamOptionsProviders = new Set<string>();

export function isStreamOptionsDisabledForProvider(provider: string): boolean {
  return disabledStreamOptionsProviders.has(provider);
}

/** Races a stream read against an idle timer so a stalled upstream can't hang a response forever. */
function readWithIdleTimeout(reader: ReadableStreamDefaultReader<Uint8Array>) {
  return new Promise<ReadableStreamReadResult<Uint8Array>>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Upstream stream was idle for ${Math.round(SSE_IDLE_TIMEOUT_MS / 1000)} seconds`));
    }, SSE_IDLE_TIMEOUT_MS);
    reader.read().then(
      result => { clearTimeout(timer); resolve(result); },
      error => { clearTimeout(timer); reject(error); },
    );
  });
}

export function providerResponseStartTimeoutMs(model: TokenForgeModelId) {
  return model === "claude-opus-5" || model === "claude-opus-5.5" || model === "gpt-6-astra" || model === "gpt-6-sol"
    ? CLAUDE_OPUS5_RESPONSE_START_TIMEOUT_MS
    : PROVIDER_TIMEOUT_MS;
}

type Usage = { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number; input_tokens?: number; output_tokens?: number };
type AnthropicRequest = { model?: unknown; messages?: unknown; system?: unknown; tools?: unknown; stream?: unknown; max_tokens?: unknown; temperature?: unknown; [key: string]: unknown };
type AnthropicBlock = { type?: unknown; text?: unknown; id?: unknown; name?: unknown; input?: unknown; tool_use_id?: unknown; content?: unknown; is_error?: unknown };
// TokenRouter exposes the validated Claude routes through OpenAI-compatible Chat
// Completions. Keep both customer-facing Claude models on the same converter so
// Claude Code receives consistent Anthropic response, tool, and SSE semantics.
const OPENAI_TRANSLATED_MESSAGES_MODELS = new Set(["qwen3.8-27b", "qwen3.8-max", "claude-fable-5.1", "claude-fable-5", "claude-opus-5", "claude-opus-5.5", "gpt-6-sol", "glm-5.3", "claude-sonnet-5.5", "claude-sonnet-4.6", "deepseek-v4-pro", "gpt-6-astra", "kimi-k3"]);

export const CLAUDE_CODE_REPORTED_COMPACT_TOTAL = 980_000;

export function isClaudeCodeRequest(req: Request): boolean {
  const ua = (req.headers["user-agent"] ?? "") as string;
  const anthropicBeta = (req.headers["anthropic-beta"] ?? "") as string;
  if (!ua && !anthropicBeta) return false;
  const uaLower = ua.toLowerCase();
  return (
    uaLower.includes("claude-cli") ||
    uaLower.includes("claude-code") ||
    uaLower.includes("@anthropic-ai/claude-code") ||
    anthropicBeta.toLowerCase().includes("claude-code")
  );
}

export function scaleUsageProportionally(
  inputTokens: number,
  cacheRead: number,
  cacheCreation: number,
  targetTotal = CLAUDE_CODE_REPORTED_COMPACT_TOTAL
): { inputTokens: number; cacheRead: number; cacheCreation: number } {
  const realTotal = Math.max(0, inputTokens) + Math.max(0, cacheRead) + Math.max(0, cacheCreation);
  if (realTotal <= 0) {
    return { inputTokens: targetTotal, cacheRead: 0, cacheCreation: 0 };
  }
  const scale = targetTotal / realTotal;
  let scaledInput = Math.round(Math.max(0, inputTokens) * scale);
  let scaledRead = Math.round(Math.max(0, cacheRead) * scale);
  let scaledCreation = Math.round(Math.max(0, cacheCreation) * scale);
  const diff = targetTotal - (scaledInput + scaledRead + scaledCreation);
  if (scaledInput >= scaledRead && scaledInput >= scaledCreation) {
    scaledInput += diff;
  } else if (scaledRead >= scaledCreation) {
    scaledRead += diff;
  } else {
    scaledCreation += diff;
  }
  return {
    inputTokens: Math.max(0, scaledInput),
    cacheRead: Math.max(0, scaledRead),
    cacheCreation: Math.max(0, scaledCreation),
  };
}

type NativeTokenRouterMessagesInput = {
  model: "claude-fable-5.1";
  messages: unknown[];
  stream?: boolean;
  max_tokens?: number;
  system?: unknown;
  reasoning_effort?: "xhigh";
  [key: string]: unknown;
};

export class AnthropicBridgeError extends Error {
  constructor(public readonly status: number, public readonly type: string, message: string) {
    super(message);
  }
}

function respondError(res: Response, requestId: string, status: number, type: string, message: string, headers?: Record<string, string | number>) {
  res.setHeader("request-id", requestId);
  res.setHeader("x-request-id", requestId);
  for (const [name, value] of Object.entries(headers ?? {})) res.setHeader(name, String(value));
  return res.status(status).json({ type: "error", error: { type, message } });
}

export function anthropicApiKey(req: Pick<Request, "header">) {
  const xApiKey = req.header("x-api-key")?.trim();
  if (xApiKey) return xApiKey;
  const authorization = req.header("authorization")?.trim();
  return authorization?.startsWith("Bearer ") ? authorization.slice(7).trim() : null;
}

function requireText(value: unknown, message: string) {
  if (typeof value !== "string") throw new AnthropicBridgeError(400, "invalid_request_error", message);
  return value;
}

function contentToText(content: unknown) {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) return content.map(block => {
    if (block && typeof block === "object") {
      if ((block as AnthropicBlock).type === "text") return requireText((block as AnthropicBlock).text, "Text content blocks require a text string.");
      if ((block as any).type === "image") {
        const mt = (block as any).source?.media_type || "image";
        return `[Image: ${mt}]`;
      }
    }
    return JSON.stringify(block);
  }).join("\n");
  return JSON.stringify(content ?? "");
}

function systemToText(system: unknown) {
  if (typeof system === "string") return system;
  if (!Array.isArray(system)) throw new AnthropicBridgeError(400, "invalid_request_error", "system must be a string or an array of text blocks.");
  return system.map((candidate, index) => {
    if (!candidate || typeof candidate !== "object" || (candidate as AnthropicBlock).type !== "text") {
      throw new AnthropicBridgeError(400, "invalid_request_error", `system[${index}] must be a text block.`);
    }
    return requireText((candidate as AnthropicBlock).text, `system[${index}].text must be a string.`);
  }).join("\n");
}

export function isNativeTokenRouterMessagesRequest(raw: AnthropicRequest) {
  return false;
}

/** Preserve Claude Code's native Anthropic payload shape for Claude Fable 5.1. */
export function prepareNativeTokenRouterMessagesRequest(raw: AnthropicRequest): NativeTokenRouterMessagesInput {
  if (!isNativeTokenRouterMessagesRequest(raw)) throw new AnthropicBridgeError(400, "invalid_request_error", "The requested model does not support native TokenRouter Messages forwarding.");
  if (!Array.isArray(raw.messages) || raw.messages.length < 1) {
    throw new AnthropicBridgeError(400, "invalid_request_error", "messages must contain at least one entry.");
  }
  if (raw.stream !== undefined && typeof raw.stream !== "boolean") throw new AnthropicBridgeError(400, "invalid_request_error", "stream must be a Boolean.");
  if (raw.max_tokens !== undefined && (typeof raw.max_tokens !== "number" || !Number.isSafeInteger(raw.max_tokens) || raw.max_tokens < 1)) {
    throw new AnthropicBridgeError(400, "invalid_request_error", "max_tokens must be a positive safe integer.");
  }
  if (raw.system !== undefined && typeof raw.system !== "string" && !Array.isArray(raw.system)) {
    throw new AnthropicBridgeError(400, "invalid_request_error", "system must be a string or an array of text blocks.");
  }
  const stream = raw.stream === true ? true : undefined;
  const maxTokens = typeof raw.max_tokens === "number" ? raw.max_tokens : undefined;
  const model = raw.model as NativeTokenRouterMessagesInput["model"];
  const startGuidance = String(modelScopedGuidanceAnchor(model, "start").content ?? "");
  const system = raw.system === undefined
    ? startGuidance
    : typeof raw.system === "string"
      ? `${startGuidance}\n\n${raw.system}`
      : [{ type: "text", text: startGuidance }, ...raw.system];
  return { ...raw, model, messages: raw.messages, system, stream, max_tokens: maxTokens, reasoning_effort: "xhigh" as const };
}

/** Backward-compatible focused helper retained for the Claude Fable 5.1 regression suite. */
export function prepareNativeClaudeFableMessagesRequest(raw: AnthropicRequest) {
  const input = prepareNativeTokenRouterMessagesRequest(raw);
  if (input.model !== "claude-fable-5.1") throw new AnthropicBridgeError(400, "invalid_request_error", "The requested model is not Claude Fable 5.1.");
  return input;
}

export function estimateNativeAnthropicInputTokens(input: { system?: unknown; messages?: unknown; tools?: unknown }) {
  return estimateFullAnthropicInputTokens(input);
}

export function translateAnthropicRequest(raw: AnthropicRequest, privateGlmToolContinuations: ReadonlyMap<string, GlmPrivateToolContinuation> = new Map()): TokenForgeChatInput {
  if (typeof raw.model !== "string" || !raw.model.trim()) {
    throw new AnthropicBridgeError(400, "invalid_request_error", "model must be a non-empty TokenForge Messages-supported model identifier.");
  }
  const model = normalizeModelIdentifier(raw.model);
  const provider = isTokenForgeModelId(model) ? getTokenForgeProviderSlug(model) : null;
  if (provider !== CLUSTER_PROTOCOL_PROVIDER_SLUG && !OPENAI_TRANSLATED_MESSAGES_MODELS.has(model)) {
    throw new AnthropicBridgeError(400, "invalid_request_error", `The Anthropic Messages endpoint does not support the requested TokenForge model ("${raw.model}").`);
  }
  if (!Array.isArray(raw.messages) || raw.messages.length < 1) {
    throw new AnthropicBridgeError(400, "invalid_request_error", "messages must contain at least one entry.");
  }
  if (raw.stream !== undefined && typeof raw.stream !== "boolean") throw new AnthropicBridgeError(400, "invalid_request_error", "stream must be a Boolean.");
  if (raw.max_tokens !== undefined && (typeof raw.max_tokens !== "number" || !Number.isSafeInteger(raw.max_tokens) || raw.max_tokens < 1)) {
    throw new AnthropicBridgeError(400, "invalid_request_error", "max_tokens must be a positive safe integer.");
  }
  if (raw.temperature !== undefined && (typeof raw.temperature !== "number" || !Number.isFinite(raw.temperature) || raw.temperature < 0 || raw.temperature > 2)) {
    throw new AnthropicBridgeError(400, "invalid_request_error", "temperature must be a number from 0 to 2.");
  }
  // TokenRouter's GLM 5.3 route previously attempted to flatten historical tool
  // turns into text when reasoning_content was missing, which caused upstream providers
  // to mimic that format and emit literal text "[Tool call: ...]" instead of structured
  // tool calls. Use native OpenAI tool_calls and role: "tool" linkage across all
  // supported models, replaying private B.ai reasoning when available.
  const usesOpenAiNativeToolResults = OPENAI_TRANSLATED_MESSAGES_MODELS.has(model);
  const maxTokens = typeof raw.max_tokens === "number" ? raw.max_tokens : undefined;
  const temperature = typeof raw.temperature === "number" ? raw.temperature : undefined;

  const messages: TokenForgeChatMessage[] = [];
  const systemInstructions: string[] = raw.system === undefined ? [] : [systemToText(raw.system)];

  // Helper to append a user turn without creating consecutive user messages,
  // merging adjacent user text or inlined system reminders smoothly.
  function appendUserTurn(content: string | unknown[]) {
    if (messages.length > 0 && messages[messages.length - 1].role === "user") {
      const prev = messages[messages.length - 1];
      if (typeof prev.content === "string" && typeof content === "string") {
        prev.content = `${prev.content}\n\n${content}`;
        return;
      }
      const prevParts = typeof prev.content === "string" ? [{ type: "text", text: prev.content }] : Array.isArray(prev.content) ? [...prev.content] : [];
      const newParts = typeof content === "string" ? [{ type: "text", text: content }] : Array.isArray(content) ? content : [];
      prev.content = [...prevParts, ...newParts];
      return;
    }
    messages.push({ role: "user", content: content as any });
  }

  for (let messageIndex = 0; messageIndex < raw.messages.length; messageIndex += 1) {
    const candidate = raw.messages[messageIndex];
    if (!candidate || typeof candidate !== "object") throw new AnthropicBridgeError(400, "invalid_request_error", `messages[${messageIndex}] must be an object.`);
    const message = candidate as { role?: unknown; content?: unknown };
    if (message.role === "system" || message.role === "developer") {
      const instruction = contentToText(message.content).trim();
      if (!instruction) throw new AnthropicBridgeError(400, "invalid_request_error", `messages[${messageIndex}].content must contain instruction text.`);
      // If this is the root first message and no raw.system was specified, it becomes the root system instruction
      if (messageIndex === 0 && systemInstructions.length === 0) {
        systemInstructions.push(instruction);
      } else {
        // In-line mid-conversation system reminders without creating consecutive user turns or mutating messages[0]
        appendUserTurn(`<system-reminder>\n${instruction}\n</system-reminder>`);
      }
      continue;
    }
    if (message.role === "tool" || message.role === "function") {
      const result = contentToText(message.content).trim();
      if (!result) throw new AnthropicBridgeError(400, "invalid_request_error", `messages[${messageIndex}].content must contain tool output.`);
      const label = message.role === "tool" ? "Tool result" : "Function result";
      appendUserTurn(`[${label}]\n${result}`);
      continue;
    }
    if (message.role !== "user" && message.role !== "assistant") throw new AnthropicBridgeError(400, "invalid_request_error", `messages[${messageIndex}] must be user or assistant.`);
    if (typeof message.content === "string") {
      if (message.role === "user") {
        appendUserTurn(message.content);
      } else {
        messages.push({ role: message.role, content: message.content });
      }
      continue;
    }
    if (!Array.isArray(message.content)) throw new AnthropicBridgeError(400, "invalid_request_error", `messages[${messageIndex}].content must be a string or content-block array.`);

    let text = "";
    const toolCalls: Array<{ id: string; type: "function"; function: { name: string; arguments: string } }> = [];
    const toolResults: Array<{ toolUseId: string; content: string }> = [];
    const imageParts: Array<{ type: "image_url"; image_url: { url: string } }> = [];
    for (let blockIndex = 0; blockIndex < message.content.length; blockIndex += 1) {
      const candidateBlock = message.content[blockIndex];
      if (!candidateBlock || typeof candidateBlock !== "object") throw new AnthropicBridgeError(400, "invalid_request_error", `messages[${messageIndex}].content[${blockIndex}] must be an object.`);
      const block = candidateBlock as AnthropicBlock;
      if (block.type === "text") {
        text += requireText(block.text, `messages[${messageIndex}].content[${blockIndex}].text must be a string.`);
      } else if (block.type === "tool_use") {
        if (message.role !== "assistant") throw new AnthropicBridgeError(400, "invalid_request_error", "tool_use blocks require an assistant message.");
        toolCalls.push({ id: requireText(block.id, "tool_use.id must be a string."), type: "function", function: { name: requireText(block.name, "tool_use.name must be a string."), arguments: JSON.stringify(block.input ?? {}) } });
      } else if (block.type === "tool_result") {
        if (message.role !== "user") throw new AnthropicBridgeError(400, "invalid_request_error", "tool_result blocks require a user message.");
        const toolUseId = requireText(block.tool_use_id, "tool_result.tool_use_id must be a string.");
        const errorPrefix = block.is_error === true ? "Error: " : "";
        if (Array.isArray(block.content)) {
          for (const sub of block.content) {
            if (sub && typeof sub === "object" && (sub as any).type === "image") {
              const src = (sub as any).source as { type?: string; media_type?: string; data?: string; url?: string } | undefined;
              let imgUrl = "";
              if (src?.type === "base64" && typeof src.data === "string" && src.data.trim()) {
                const mediaType = (typeof src.media_type === "string" && src.media_type.trim()) ? src.media_type.trim() : "image/jpeg";
                imgUrl = `data:${mediaType};base64,${src.data.trim()}`;
              } else if (src?.type === "url" && typeof src.url === "string" && src.url.trim()) {
                imgUrl = src.url.trim();
              } else if (typeof (sub as any).url === "string" && (sub as any).url.trim()) {
                imgUrl = (sub as any).url.trim();
              } else if (typeof (src as any)?.data === "string" && (src as any).data.startsWith("data:image/")) {
                imgUrl = (src as any).data;
              }
              if (imgUrl) {
                imageParts.push({ type: "image_url", image_url: { url: imgUrl } });
              }
            }
          }
        }
        toolResults.push({ toolUseId, content: `${errorPrefix}${contentToText(block.content)}` });
      } else if (block.type === "thinking" || block.type === "redacted_thinking") {
        if (message.role !== "assistant") throw new AnthropicBridgeError(400, "invalid_request_error", `${String(block.type)} blocks require an assistant message.`);
        // OrcaRouter's OpenAI-compatible endpoint cannot verify Anthropic signatures. Do not forward
        // private reasoning summaries or encrypted thinking state as regular conversation content.
      } else if (block.type === "image") {
        const source = (block as any).source as { type?: string; media_type?: string; data?: string; url?: string } | undefined;
        let url = "";
        if (source?.type === "base64" && typeof source.data === "string" && source.data.trim()) {
          const mediaType = (typeof source.media_type === "string" && source.media_type.trim()) ? source.media_type.trim() : "image/jpeg";
          url = `data:${mediaType};base64,${source.data.trim()}`;
        } else if (source?.type === "url" && typeof source.url === "string" && source.url.trim()) {
          url = source.url.trim();
        } else if (typeof (block as any).url === "string" && (block as any).url.trim()) {
          url = (block as any).url.trim();
        } else if (typeof (source as any)?.data === "string" && (source as any).data.startsWith("data:image/")) {
          url = (source as any).data;
        }
        if (!url) {
          throw new AnthropicBridgeError(400, "invalid_request_error", `messages[${messageIndex}].content[${blockIndex}] image block requires valid base64 data or URL.`);
        }
        imageParts.push({ type: "image_url", image_url: { url } });
      } else if (block.type === "document") {
        const source = (block as any).source as { type?: string; media_type?: string; data?: string; url?: string } | undefined;
        if (source?.media_type?.startsWith("image/")) {
          const mediaType = source.media_type.trim();
          const url = source.type === "base64" && source.data ? `data:${mediaType};base64,${source.data.trim()}` : (source.url || "");
          if (url) {
            imageParts.push({ type: "image_url", image_url: { url } });
          }
        } else if (source?.type === "text" && typeof (source as any).data === "string") {
          text += (source as any).data;
        } else if (typeof (block as any).text === "string") {
          text += (block as any).text;
        } else if (source?.type === "base64" && source.data) {
          imageParts.push({ type: "image_url", image_url: { url: `data:${source.media_type || "application/pdf"};base64,${source.data.trim()}` } });
        }
      } else {
        throw new AnthropicBridgeError(400, "invalid_request_error", `Unsupported content block at messages[${messageIndex}].content[${blockIndex}].`);
      }
    }
    if (message.role === "assistant") {
      const privateGlmToolContinuation = model === "glm-5.3" && toolCalls.length > 0
        ? privateGlmToolContinuations.get(toolCalls[0].id)
        : undefined;
      const canReplayPrivateGlmToolContinuation = Boolean(privateGlmToolContinuation
        && toolCalls.every(toolCall => privateGlmToolContinuation.tool_calls.some(call => call.id === toolCall.id)));
      if (text || toolCalls.length > 0) {
        messages.push(canReplayPrivateGlmToolContinuation
          ? privateGlmToolContinuation!
          : { role: "assistant", content: text || null, ...(toolCalls.length > 0 ? { tool_calls: toolCalls } : {}) } as TokenForgeChatMessage);
      }
    } else {
      const canReplayPrivateGlmToolResults = model === "glm-5.3" && toolResults.length > 0
        && toolResults.every(result => privateGlmToolContinuations.has(result.toolUseId));
      if ((usesOpenAiNativeToolResults || canReplayPrivateGlmToolResults) && toolResults.length > 0) {
        for (const result of toolResults) {
          messages.push({ role: "tool", tool_call_id: result.toolUseId, content: result.content } as TokenForgeChatMessage);
        }
        if (imageParts.length > 0) {
          const parts: unknown[] = [];
          if (text) parts.push({ type: "text", text });
          parts.push(...imageParts);
          appendUserTurn(parts);
        } else if (text) {
          appendUserTurn(text);
        }
        continue;
      }
      const combinedText = [...toolResults.map(result => `[Tool Result for ${result.toolUseId}]:\n${result.content}`), text].filter(Boolean).join("\n\n").trim();
      if (!combinedText && imageParts.length === 0) throw new AnthropicBridgeError(400, "invalid_request_error", `messages[${messageIndex}] must contain text, image, or tool_result content.`);
      
      if (imageParts.length > 0) {
        const parts: unknown[] = [];
        if (combinedText) parts.push({ type: "text", text: combinedText });
        parts.push(...imageParts);
        appendUserTurn(parts);
      } else {
        appendUserTurn(combinedText);
      }
    }
  }

  const systemContext = systemInstructions.filter(Boolean).join("\n\n").trim();
  if (systemContext) {
    if (model === "kimi-k3") {
      const firstUserIndex = messages.findIndex(message => message.role === "user");
      const prefixedContext = `[System context]\n${systemContext}`;
      if (firstUserIndex >= 0 && typeof messages[firstUserIndex].content === "string") {
        messages[firstUserIndex] = { ...messages[firstUserIndex], content: `${prefixedContext}\n\n${messages[firstUserIndex].content}` };
      } else {
        messages.unshift({ role: "user", content: prefixedContext });
      }
    } else {
      messages.unshift({ role: "system", content: systemContext });
    }
  }

  const translated: TokenForgeChatInput = {
    model,
    messages,
    stream: raw.stream === true,
    ...(maxTokens !== undefined ? { max_tokens: maxTokens } : {}),
    ...(temperature !== undefined ? { temperature } : {}),
    ...((raw as any).reasoning_effort ? { reasoning_effort: (raw as any).reasoning_effort } : {}),
    ...((raw as any).reasoningEffort ? { reasoning_effort: (raw as any).reasoningEffort } : {}),
    // This bridge policy is deliberately model-scoped and not caller-configurable.
    ...(model === "kimi-k3" ? { reasoning_effort: "max" } : {}),
    ...(model === "claude-fable-5.1" ? { reasoning_effort: "xhigh" } : {}),
  };
  if (raw.tools !== undefined) {
    if (!Array.isArray(raw.tools)) throw new AnthropicBridgeError(400, "invalid_request_error", "tools must be an array.");
    translated.tools = raw.tools.map((candidate, index) => {
      if (!candidate || typeof candidate !== "object") throw new AnthropicBridgeError(400, "invalid_request_error", `tools[${index}] must be an object.`);
      const tool = candidate as { name?: unknown; description?: unknown; input_schema?: unknown };
      const name = requireText(tool.name, `tools[${index}].name must be a string.`);
      return { type: "function", function: { name, ...(typeof tool.description === "string" ? { description: tool.description } : {}), parameters: tool.input_schema ?? { type: "object", properties: {} } } };
    });
  }
  return translated;
}

export function estimateMessageTokens(content: unknown): number {
  if (typeof content === "string") {
    const base64DataUris = content.match(/data:image\/[a-zA-Z0-9.+-]+;base64,[A-Za-z0-9+/=]+/g);
    if (base64DataUris && base64DataUris.length > 0) {
      const stripped = content.replace(/data:image\/[a-zA-Z0-9.+-]+;base64,[A-Za-z0-9+/=]+/g, "");
      let imageTokens = 0;
      for (const uri of base64DataUris) {
        imageTokens += estimateSingleImageTokens(uri);
      }
      return Math.ceil(stripped.length / 4) + imageTokens;
    }
    return Math.ceil(content.length / 4);
  }
  if (Array.isArray(content)) {
    let sum = 0;
    for (const part of content) {
      if (!part || typeof part !== "object") continue;
      const p = part as any;
      if (
        p.type === "image_url" ||
        p.type === "image" ||
        p.image_url ||
        p.source?.type === "base64" ||
        p.source?.media_type?.startsWith("image/")
      ) {
        sum += estimateSingleImageTokens(p);
      } else if (p.type === "text" && typeof p.text === "string") {
        sum += estimateMessageTokens(p.text);
      } else if (p.type === "tool_use") {
        sum += Math.ceil((p.name?.length ?? 0) / 4) + Math.ceil(JSON.stringify(p.input ?? {}).length / 4) + 8;
      } else if (p.type === "tool_result") {
        sum += estimateMessageTokens(p.content) + 8;
      } else {
        sum += estimateMessageTokens(p);
      }
    }
    return sum;
  }
  if (content && typeof content === "object") {
    const p = content as any;
    if (
      p.type === "image" ||
      p.type === "image_url" ||
      p.image_url ||
      p.source?.type === "base64" ||
      p.source?.media_type?.startsWith("image/")
    ) {
      return estimateSingleImageTokens(p);
    }
    if (typeof p.text === "string") {
      return estimateMessageTokens(p.text);
    }
    try {
      const str = JSON.stringify(content, (key, value) => {
        if (key === "data" && typeof value === "string" && value.length > 200) return "[image_data]";
        if (typeof value === "string" && value.startsWith("data:image/")) return "[image_data]";
        return value;
      });
      return Math.ceil(str.length / 4);
    } catch {
      return 50;
    }
  }
  return 0;
}

export function estimateSystemPromptTokens(system: unknown): number {
  if (!system) return 0;
  if (typeof system === "string") return Math.ceil(system.length / 4);
  if (Array.isArray(system)) {
    return system.reduce((acc: number, block) => {
      if (typeof block === "string") return acc + Math.ceil(block.length / 4);
      if (block && typeof block === "object" && typeof (block as any).text === "string") {
        return acc + Math.ceil((block as any).text.length / 4);
      }
      return acc + estimateMessageTokens(block);
    }, 0);
  }
  return Math.ceil(JSON.stringify(system).length / 4);
}

export function estimateToolsTokens(tools: unknown): number {
  if (!Array.isArray(tools) || tools.length === 0) return 0;
  return tools.reduce((total: number, tool) => {
    if (!tool || typeof tool !== "object") return total;
    try {
      return total + Math.ceil(JSON.stringify(tool).length / 4) + 8;
    } catch {
      return total + 50;
    }
  }, 0);
}

export function estimateFullAnthropicInputTokens(raw: { system?: unknown; tools?: unknown; messages?: unknown }): number {
  const systemTokens = estimateSystemPromptTokens(raw.system);
  const toolsTokens = estimateToolsTokens(raw.tools);
  let messagesTokens = 0;
  if (Array.isArray(raw.messages)) {
    for (const msg of raw.messages) {
      if (!msg || typeof msg !== "object") continue;
      const m = msg as any;
      messagesTokens += estimateMessageTokens(m.content) + 4;
      if (Array.isArray(m.tool_calls)) {
        for (const tc of m.tool_calls) {
          messagesTokens += Math.ceil((tc.function?.name?.length ?? 0) / 4) + Math.ceil((tc.function?.arguments?.length ?? 0) / 4) + 8;
        }
      }
    }
  }
  return Math.max(1, systemTokens + toolsTokens + messagesTokens);
}

export function estimateAnthropicCacheBreakdown(raw: { system?: unknown; tools?: unknown; messages?: unknown }): {
  inputTokens: number;
  cacheReadTokens: number;
  cacheCreationTokens: number;
  totalTokens: number;
} {
  let cacheTokens = 0;
  let uncachedTokens = 0;
  let hasCacheControl = false;

  if (Array.isArray(raw.system)) {
    for (const block of raw.system) {
      const tokens = estimateSystemPromptTokens(block);
      if (block && typeof block === "object" && (block as any).cache_control) {
        hasCacheControl = true;
        cacheTokens += tokens;
      } else {
        uncachedTokens += tokens;
      }
    }
  } else if (raw.system) {
    uncachedTokens += estimateSystemPromptTokens(raw.system);
  }

  if (Array.isArray(raw.tools)) {
    for (const tool of raw.tools) {
      const tokens = estimateToolsTokens([tool]);
      if (tool && typeof tool === "object" && (tool as any).cache_control) {
        hasCacheControl = true;
        cacheTokens += tokens;
      } else {
        uncachedTokens += tokens;
      }
    }
  }

  if (Array.isArray(raw.messages)) {
    for (const msg of raw.messages) {
      if (!msg || typeof msg !== "object") continue;
      const m = msg as any;
      const msgTokens = estimateMessageTokens(m.content) + 4;
      let msgHasCache = false;
      if (Array.isArray(m.content)) {
        for (const block of m.content) {
          if (block && typeof block === "object" && block.cache_control) {
            msgHasCache = true;
            hasCacheControl = true;
          }
        }
      } else if (m.cache_control) {
        msgHasCache = true;
        hasCacheControl = true;
      }
      if (msgHasCache) {
        cacheTokens += msgTokens;
      } else {
        uncachedTokens += msgTokens;
      }
    }
  }

  const totalTokens = Math.max(1, cacheTokens + uncachedTokens);

  if (hasCacheControl) {
    return {
      inputTokens: Math.max(1, uncachedTokens),
      cacheReadTokens: Math.max(0, cacheTokens),
      cacheCreationTokens: 0,
      totalTokens,
    };
  }

  return {
    inputTokens: totalTokens,
    cacheReadTokens: 0,
    cacheCreationTokens: 0,
    totalTokens,
  };
}

export function estimateInputTokens(messages: TokenForgeChatMessage[]) {
  return messages.reduce((total, message) => total + estimateMessageTokens(message.content) + 4, 0);
}

function usageFrom(payload: unknown): Usage {
  return payload && typeof payload === "object" ? ((payload as { usage?: Usage }).usage ?? {}) : {};
}

function estimateTextTokens(text: unknown): number {
  if (typeof text !== "string" || !text) return 0;
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return Math.max(1, Math.ceil(trimmed.length / 3.5));
}

function normalizedTokens(usage: Usage, inputEstimate: number, fallbackOutput?: string | number) {
  const inputTokens = Number(usage.prompt_tokens ?? usage.input_tokens ?? inputEstimate);
  const rawOutput = usage.completion_tokens ?? usage.output_tokens;
  let outputTokens = (typeof rawOutput === "number" && Number.isFinite(rawOutput) && rawOutput > 0)
    ? Math.trunc(rawOutput)
    : Number(rawOutput ?? Math.max(0, Number(usage.total_tokens ?? inputTokens) - inputTokens));

  if ((!Number.isFinite(outputTokens) || outputTokens <= 0) && fallbackOutput !== undefined) {
    outputTokens = typeof fallbackOutput === "number"
      ? Math.max(0, Math.trunc(fallbackOutput))
      : estimateTextTokens(fallbackOutput);
  }
  return { inputTokens, outputTokens: Math.max(0, outputTokens) };
}

function toStopReason(reason: unknown) {
  if (reason === "tool_calls") return "tool_use";
  if (reason === "length") return "max_tokens";
  return "end_turn";
}

function authenticGlmToolContinuation(payload: unknown): GlmPrivateToolContinuation | null {
  const message = (payload as { choices?: Array<{ message?: unknown }> })?.choices?.[0]?.message;
  if (!message || typeof message !== "object") return null;
  const candidate = message as Partial<GlmPrivateToolContinuation>;
  if (candidate.role !== "assistant" || typeof candidate.reasoning_content !== "string" || !candidate.reasoning_content.trim() || !Array.isArray(candidate.tool_calls)) return null;
  const toolCalls = candidate.tool_calls.filter((call): call is GlmPrivateToolContinuation["tool_calls"][number] =>
    Boolean(call && typeof call.id === "string" && call.id && call.type === "function" && typeof call.function?.name === "string" && typeof call.function?.arguments === "string"),
  );
  if (!toolCalls.length) return null;
  return { role: "assistant", content: typeof candidate.content === "string" ? candidate.content : null, reasoning_content: candidate.reasoning_content, tool_calls: toolCalls };
}

async function capturePrivateGlmToolContinuation(userId: number, payload: unknown) {
  const continuation = authenticGlmToolContinuation(payload);
  if (!continuation) return;
  await Promise.all(continuation.tool_calls.map(toolCall => storeGlmToolContinuation(userId, toolCall.id, continuation)));
}

function anthropicToolResultIds(raw: AnthropicRequest) {
  const ids: string[] = [];
  const requestMessages = Array.isArray(raw.messages) ? raw.messages : [];
  for (const message of requestMessages) {
    if (!message || typeof message !== "object" || !Array.isArray(message.content)) continue;
    for (const block of message.content) {
      const candidate = block as { type?: unknown; tool_use_id?: unknown };
      if (candidate?.type === "tool_result" && typeof candidate.tool_use_id === "string") ids.push(candidate.tool_use_id);
    }
  }
  return ids;
}

export function translateOpenAiMessageResponse(model: string, payload: unknown, fallbackInputTokens = 0) {
  const response = payload as { id?: unknown; choices?: Array<{ finish_reason?: unknown; message?: { content?: unknown; tool_calls?: Array<{ id?: unknown; function?: { name?: unknown; arguments?: unknown } }> } }>; usage?: Usage };
  const choice = response?.choices?.[0];
  if (!choice?.message) throw new AnthropicBridgeError(503, "api_error", "The selected provider returned an invalid response.");
  const content: Array<Record<string, unknown>> = [];
  const rawMsg = choice.message as any;
  const reasoning = rawMsg.reasoning_content ?? rawMsg.reasoning ?? rawMsg.thinking;
  let isReasoningPromoted = Boolean(rawMsg.isReasoningPromoted);
  if (typeof choice.message.content === "string" && choice.message.content.trim()) {
    content.push({ type: "text", text: choice.message.content });
  } else if (typeof reasoning === "string" && reasoning.trim() && (!choice.message.tool_calls || choice.message.tool_calls.length === 0)) {
    content.push({ type: "text", text: reasoning });
    isReasoningPromoted = true;
    rawMsg.isReasoningPromoted = true;
  }
  for (const toolCall of choice.message.tool_calls ?? []) {
    if (typeof toolCall.id !== "string" || typeof toolCall.function?.name !== "string") continue;
    let input: unknown = {};
    if (typeof toolCall.function.arguments === "string") {
      try { input = JSON.parse(toolCall.function.arguments); } catch { input = {}; }
    }
    content.push({ type: "tool_use", id: toolCall.id, name: toolCall.function.name, input });
  }

  const rawUsage = usageFrom(response) as any;
  const cachedTokens = Number(
    rawUsage.cached_tokens ??
    rawUsage.prompt_tokens_details?.cached_tokens ??
    rawUsage.prompt_cache_hit_tokens ??
    rawUsage.cache_read_input_tokens ??
    rawUsage.prompt_tokens_details?.cache_read_tokens ??
    0
  );
  const cacheCreationTokens = Number(
    rawUsage.cache_creation_input_tokens ??
    rawUsage.prompt_tokens_details?.cache_creation_tokens ??
    rawUsage.prompt_cache_miss_tokens ??
    0
  );
  const reportedPrompt = rawUsage.prompt_tokens ?? rawUsage.input_tokens;
  const promptTokens = reportedPrompt !== undefined && Number.isFinite(Number(reportedPrompt)) && Number(reportedPrompt) > 0
    ? Number(reportedPrompt)
    : fallbackInputTokens;
  const inputTokens = Math.max(0, promptTokens - cachedTokens);
  const outputTokensReported = Number(rawUsage.completion_tokens ?? rawUsage.output_tokens ?? 0);
  const finalOutputTokens = outputTokensReported > 0 ? outputTokensReported : 0;

  return {
    id: typeof response.id === "string" ? response.id : `msg_${randomUUID().replaceAll("-", "")}`,
    type: "message",
    role: "assistant",
    model,
    content,
    stop_reason: toStopReason(choice.finish_reason),
    stop_sequence: null,
    usage: {
      input_tokens: inputTokens,
      output_tokens: finalOutputTokens,
      ...(cachedTokens > 0 ? { cache_read_input_tokens: cachedTokens } : {}),
      ...(cacheCreationTokens > 0 ? { cache_creation_input_tokens: cacheCreationTokens } : {}),
    },
  };
}

function writeSse(res: Response, event: string, payload: unknown) {
  res.write(`event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`);
}

function nativeTokenRouterResponse(model: TokenForgeModelId, payload: unknown): (Record<string, any> & { model: TokenForgeModelId }) | null {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;
  return { ...(payload as Record<string, unknown>), model };
}

async function handleNativeTokenRouterMessagesRequest(req: Request, res: Response, requestId: string, key: { id: number; userId: number }) {
  let input: NativeTokenRouterMessagesInput;
  try {
    input = prepareNativeTokenRouterMessagesRequest((req.body ?? {}) as AnthropicRequest);
  } catch (error) {
    return error instanceof AnthropicBridgeError
      ? respondError(res, requestId, error.status, error.type, error.message)
      : respondError(res, requestId, 400, "invalid_request_error", "The Messages request could not be processed.");
  }
  const model: TokenForgeModelId = input.model;
  if (!(await isModelAvailable(model))) return respondError(res, requestId, 503, "api_error", "The requested model is temporarily unavailable. Retry shortly or choose another available model.");

  const userTier = await getUserTier(key.userId);
  const minTier = await getModelMinTier(model);
  if (!isTierSufficient(userTier, minTier)) {
    const requiredName = USER_TIER_DISPLAY_NAMES[minTier] ?? minTier;
    const currentName = USER_TIER_DISPLAY_NAMES[userTier] ?? userTier;
    return respondError(
      res,
      requestId,
      403,
      "permission_error",
      `Model '${model}' requires ${requiredName} tier or higher. Your account is currently on the ${currentName} tier. Please upgrade your tier in the dashboard to access this model.`
    );
  }

  const ipHash = tokenForgeRequestIpHash(req);
  const quota = await getQuotaStatus(key.userId);
  if (!quota) return respondError(res, requestId, 503, "api_error", "Account status is temporarily unavailable. Retry shortly.");
  if (quota.suspended) return respondError(res, requestId, 403, "permission_error", "This account is currently suspended.");

  const keyGroup = ((key as any).keyGroup as "payg" | "bundle" | "token_plan" | "tokens" | "coding_plan") || "bundle";
  const isTokenPlan = keyGroup === "token_plan" || keyGroup === "tokens" || keyGroup === "coding_plan";
  const pricingTier: PricingTier = keyGroup === "payg" ? "payg" : "bundle";
  const creditsEnabled = await isUserCreditsEnabled(key.userId);
  if (keyGroup === "bundle" && !creditsEnabled) {
    return respondError(
      res,
      requestId,
      403,
      "permission_error",
      "Credit bundle system is currently disabled for this account. Please use a Tier 1 (Pay-As-You-Go) or Tier 2 (Token Plan) API key."
    );
  }

  const modelAccess = await getModelAccess(model);
  if (isTokenPlan && !modelAccess.isTokenPlan) {
    return respondError(
      res,
      requestId,
      403,
      "permission_error",
      `Access denied: The model '${model}' does not have the Token Plan tag enabled. Please ask an administrator to enable the Token Plan tag for '${model}', or use a PAYG / standard API key.`
    );
  }
  if (keyGroup === "payg" && !modelAccess.isPayg) {
    return respondError(
      res,
      requestId,
      403,
      "permission_error",
      `Access denied: This API key is configured for Tier 1 (Pay-As-You-Go) and cannot access '${model}'. This model is not enabled for PAYG access.`
    );
  }
  if (keyGroup === "bundle" && !modelAccess.isBundle) {
    return respondError(
      res,
      requestId,
      403,
      "permission_error",
      `Access denied: The model '${model}' is not enabled for Tier 2 (Credit Bundles) access. Please generate and use a Tier 1 (Pay-As-You-Go) or Token Plan API key.`
    );
  }

  const userAgent = (req.headers["user-agent"] ?? "") as string;
  const isClaudeCli = isClaudeCodeRequest(req);
  const compactScalingConfig = await getModelCompactScalingConfig(model);
  const compactScalingEnabled = isClaudeCli && compactScalingConfig.enabled;
  let didCompactScalingTrigger = false;
  const breakdown = estimateAnthropicCacheBreakdown(input as any);
  let scaledReportedTokens: { inputTokens: number; cacheRead: number; cacheCreation: number } | null = null;
  if (compactScalingEnabled && breakdown.totalTokens >= compactScalingConfig.triggerTokens) {
    didCompactScalingTrigger = true;
    scaledReportedTokens = scaleUsageProportionally(
      breakdown.inputTokens,
      breakdown.cacheReadTokens,
      breakdown.cacheCreationTokens
    );
    console.log(`[CompactTrigger] key=${key.id} real=${breakdown.totalTokens} reported=${CLAUDE_CODE_REPORTED_COMPACT_TOTAL} model=${model} ua=${userAgent}`);
  }

  const estimatedInputTokens = estimateNativeAnthropicInputTokens(input);
  const reservedNanos = calculateCreditChargeNanos(model, estimatedInputTokens, normalizedBillableMaxOutputTokens(input.max_tokens), pricingTier);
  const reservation = await reserveCredit(key.userId, reservedNanos, requestId, { keyGroup });
  if (!reservation.authorized) {
    return respondError(
      res,
      requestId,
      402,
      "permission_error",
      isTokenPlan
        ? "Your Token Plan (Coding Tokens) balance is exhausted (0 tokens remaining). Please top up your coding tokens in your dashboard."
        : keyGroup === "payg"
        ? "Your Pay-As-You-Go (PAYG) balance cannot cover this request’s maximum estimated cost. Please top up your PAYG balance in your dashboard."
        : "Your TokenForge promotional credit balance cannot cover this request’s maximum estimated cost. Please purchase a credit package or recharge in your dashboard."
    );
  }

  const aborter = new AbortController();
  const timeout = setTimeout(() => aborter.abort(), providerResponseStartTimeoutMs(model));
  const startedAt = Date.now();
  let upstream: globalThis.Response;
  let providerLabel: string | undefined;
  const visualAnalysis = await pruneOldImagesAndDeriveContent(input.messages);
  input.messages = visualAnalysis.messages;
  const isVisual = visualAnalysis.analysis.hasVisualData;
  const isDocument = payloadContainsDocumentData(input);
  const isMultimodal = isVisual || isDocument;
  const multimodalTag = isVisual
    ? visualAnalysis.analysis.tag
    : (isDocument ? "(document)" : "");
  try {
    const forwarded = await forwardTokenRouterAnthropicMessagesRequest(input, aborter.signal, req.header("anthropic-beta")?.trim());
    upstream = forwarded.response;
    providerLabel = forwarded.providerLabel;
  } catch (error) {
    clearTimeout(timeout);
    const message = error instanceof Error && error.name === "AbortError" ? "The selected provider timed out. Retry this request." : "The selected provider is temporarily unavailable.";
    await settleReservedCredit({ userId: key.userId, requestId, reservedNanos, finalChargeNanos: 0, releaseReason: "Native TokenRouter Messages provider request did not complete" });
    await recordUsage({ requestId, userId: key.userId, apiKeyId: key.id, modelId: model, source: "api", stream: Boolean(input.stream), status: "provider_error", sourceIpHash: ipHash, provider: finalizeProviderLabel(providerLabel, multimodalTag || isMultimodal), latencyMs: Date.now() - startedAt, errorMessage: message });
    return respondError(res, requestId, 503, "api_error", message);
  }
  if (!upstream.ok) {
    clearTimeout(timeout);
    const message = publicProviderFailureStatus(upstream.status) === 503 && (upstream.status === 401 || upstream.status === 403)
      ? "The selected provider temporarily denied this request after secure credential failover. Retry shortly or choose another model."
      : "The selected provider could not process this request.";
    await settleReservedCredit({ userId: key.userId, requestId, reservedNanos, finalChargeNanos: 0, releaseReason: "Native TokenRouter Messages provider returned an error" });
    await recordUsage({ requestId, userId: key.userId, apiKeyId: key.id, modelId: model, source: "api", stream: Boolean(input.stream), status: "provider_error", sourceIpHash: ipHash, provider: finalizeProviderLabel(providerLabel, multimodalTag || isMultimodal), latencyMs: Date.now() - startedAt, errorMessage: message });
    const status = publicProviderFailureStatus(upstream.status);
    return respondError(res, requestId, status, "api_error", message);
  }
  await touchApiKey(key.id);

  if (!input.stream) {
    clearTimeout(timeout);
    const payload = await upstream.json().catch(() => null);
    const response = nativeTokenRouterResponse(model, payload);
    if (!response) {
      const message = "The selected provider returned an invalid response.";
      await settleReservedCredit({ userId: key.userId, requestId, reservedNanos, finalChargeNanos: 0, releaseReason: "Native TokenRouter Messages provider returned an invalid response" });
      await recordUsage({ requestId, userId: key.userId, apiKeyId: key.id, modelId: model, source: "api", stream: false, status: "provider_error", sourceIpHash: ipHash, provider: finalizeProviderLabel(providerLabel, multimodalTag || isMultimodal), latencyMs: Date.now() - startedAt, errorMessage: message });
      return respondError(res, requestId, 503, "api_error", message);
    }
    const outputText = response.content?.map(c => typeof c === "object" && c && "text" in c ? (c as { text: string }).text : "").join("\n") ?? "";
    const tokens = normalizedTokens(usageFrom(response), estimatedInputTokens, outputText);
    const chargeNanos = calculateCreditChargeNanos(model, tokens.inputTokens, tokens.outputTokens, pricingTier);
    const settlement = await settleReservedCredit({
      userId: key.userId,
      requestId,
      reservedNanos,
      finalChargeNanos: chargeNanos,
      usedTokens: tokens.totalTokens ?? (tokens.inputTokens + tokens.outputTokens),
      keyGroup,
    });
    const rawReportedUsage = response.usage as any;
    const cachedTokens = Number(rawReportedUsage?.cache_read_input_tokens ?? 0);
    const cacheCreationTokens = Number(rawReportedUsage?.cache_creation_input_tokens ?? 0);
    const realTotalInput = tokens.inputTokens + cachedTokens + cacheCreationTokens;

    if (scaledReportedTokens) {
      response.usage = {
        input_tokens: scaledReportedTokens.inputTokens,
        output_tokens: tokens.outputTokens,
        ...(scaledReportedTokens.cacheRead > 0 ? { cache_read_input_tokens: scaledReportedTokens.cacheRead } : {}),
        ...(scaledReportedTokens.cacheCreation > 0 ? { cache_creation_input_tokens: scaledReportedTokens.cacheCreation } : {}),
      };
    } else if (compactScalingEnabled && realTotalInput >= compactScalingConfig.triggerTokens) {
      didCompactScalingTrigger = true;
      const scaled = scaleUsageProportionally(tokens.inputTokens, cachedTokens, cacheCreationTokens);
      response.usage = {
        input_tokens: scaled.inputTokens,
        output_tokens: tokens.outputTokens,
        ...(scaled.cacheRead > 0 ? { cache_read_input_tokens: scaled.cacheRead } : {}),
        ...(scaled.cacheCreation > 0 ? { cache_creation_input_tokens: scaled.cacheCreation } : {}),
      };
      console.log(`[CompactTrigger] key=${key.id} real=${realTotalInput} reported=${CLAUDE_CODE_REPORTED_COMPACT_TOTAL} model=${model} ua=${userAgent}`);
    }

    const compactDiagnosticTag = didCompactScalingTrigger
      ? `[CompactTrigger: ${realTotalInput.toLocaleString()} -> 980k (ua: ${userAgent})]`
      : undefined;

    const nonStreamStopReason = response?.stop_reason ? toStopReason(response.stop_reason) : "end_turn";
    const nonStreamOutcome = nonStreamStopReason === "max_tokens" ? "truncated" : "success";

    await recordUsage({
      requestId,
      userId: key.userId,
      apiKeyId: key.id,
      modelId: model,
      source: "api",
      stream: false,
      status: "success",
      ...tokens,
      chargeNanos: settlement.chargedNanos,
      sourceIpHash: ipHash,
      provider: finalizeProviderLabel(providerLabel, multimodalTag || isMultimodal),
      latencyMs: Date.now() - startedAt,
      durationMs: Date.now() - startedAt,
      ttftMs: Date.now() - startedAt,
      stopReason: nonStreamStopReason,
      outcome: nonStreamOutcome,
      rawErrorMessage: compactDiagnosticTag,
    });
    res.setHeader("request-id", requestId);
    res.setHeader("x-request-id", requestId);
    res.setHeader("x-tokenforge-credit-balance", String(settlement.balanceNanos));
    res.setHeader("x-tokenforge-credit-charge", String(settlement.chargedNanos));
    return res.status(200).json(response);
  }

  res.status(200);
  res.setHeader("request-id", requestId);
  res.setHeader("x-request-id", requestId);
  res.setHeader("content-type", "text/event-stream; charset=utf-8");
  res.setHeader("cache-control", "no-cache, no-transform");
  res.setHeader("connection", "keep-alive");
  res.flushHeaders();
  const reader = upstream.body?.getReader();
  if (!reader) {
    clearTimeout(timeout);
    await settleReservedCredit({ userId: key.userId, requestId, reservedNanos, finalChargeNanos: 0, keyGroup, releaseReason: "Native TokenRouter Messages provider returned an empty stream" });
    return res.end();
  }
  const decoder = new TextDecoder();
  let buffer = "";
  let usage: Usage = {};
  let streamedOutputText = "";
  let failed = false;
  let failedMessage: string | undefined;
  let clientDisconnected = false;
  let firstTokenTimeMs: number | null = null;
  let nativeStopReason: "end_turn" | "tool_use" | "max_tokens" | "refusal" | "none" = "none";

  const onClientClose = () => {
    if (!res.writableEnded) {
      clientDisconnected = true;
      failed = true;
      failedMessage = "Client disconnected before stream completed";
      aborter.abort();
      reader.cancel().catch(() => undefined);
    }
  };
  req.on("close", onClientClose);
  res.on("close", onClientClose);

  try {
    while (true) {
      const next = await readWithIdleTimeout(reader);
      if (next.done) break;
      buffer += decoder.decode(next.value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const sourceLine of lines) {
        if (!sourceLine.trim().startsWith("data:")) {
          res.write(`${sourceLine}\n`);
          continue;
        }
        const serialized = sourceLine.slice(sourceLine.indexOf(":") + 1).trim();
        if (!serialized || serialized === "[DONE]") {
          res.write(`${sourceLine}\n`);
          continue;
        }
        try {
          const event = JSON.parse(serialized) as { type?: unknown; message?: { model?: unknown; usage?: Usage }; usage?: Usage; delta?: { text?: string; reasoning_content?: string; stop_reason?: string } };
          if (event.type === "error") { failed = true; failedMessage = "Upstream stream reported an error."; }
          if (firstTokenTimeMs === null && (event.delta?.text || event.delta?.reasoning_content || event.type === "content_block_delta" || event.type === "content_block_start")) {
            firstTokenTimeMs = Date.now() - startedAt;
          }
          if (event.type === "message_delta" && event.delta?.stop_reason) {
            nativeStopReason = toStopReason(event.delta.stop_reason);
          }
          usage = { ...usage, ...(event.message?.usage ?? {}), ...(event.usage ?? {}) };
          if (typeof event.delta?.text === "string") streamedOutputText += event.delta.text;
          if (typeof event.delta?.reasoning_content === "string") streamedOutputText += event.delta.reasoning_content;
          if (event.type === "message_start" && event.message) {
            event.message.model = model;
            if (scaledReportedTokens) {
              event.message.usage = {
                input_tokens: scaledReportedTokens.inputTokens,
                output_tokens: 0,
                ...(scaledReportedTokens.cacheRead > 0 ? { cache_read_input_tokens: scaledReportedTokens.cacheRead } : {}),
                ...(scaledReportedTokens.cacheCreation > 0 ? { cache_creation_input_tokens: scaledReportedTokens.cacheCreation } : {}),
              };
            }
          }
          if (event.type === "message_delta" && didCompactScalingTrigger && event.usage) {
            if (scaledReportedTokens) {
              event.usage = {
                input_tokens: scaledReportedTokens.inputTokens,
                output_tokens: (event.usage as any).output_tokens ?? 0,
                ...(scaledReportedTokens.cacheRead > 0 ? { cache_read_input_tokens: scaledReportedTokens.cacheRead } : {}),
                ...(scaledReportedTokens.cacheCreation > 0 ? { cache_creation_input_tokens: scaledReportedTokens.cacheCreation } : {}),
              };
            }
          }
          res.write(`data: ${JSON.stringify(event)}\n`);
        } catch {
          res.write(`${sourceLine}\n`);
        }
      }
    }
    if (buffer) res.write(`${buffer}\n`);
  } catch {
    failed = true;
    if (!failedMessage) {
      failedMessage = clientDisconnected ? "Client disconnected before stream completed" : "The selected provider stream did not complete.";
    }
  } finally {
    clearTimeout(timeout);
    let outcome: "success" | "client_disconnected" | "truncated" | "upstream_error" = "success";
    if (clientDisconnected) {
      outcome = "client_disconnected";
    } else if (failed) {
      outcome = "upstream_error";
    } else if (nativeStopReason === "max_tokens") {
      outcome = "truncated";
    }

    const tokens = normalizedTokens(usage, estimatedInputTokens, streamedOutputText);
    const chargeNanos = failed ? 0 : calculateCreditChargeNanos(model, tokens.inputTokens, tokens.outputTokens, pricingTier);
    const settlement = await settleReservedCredit({
      userId: key.userId,
      requestId,
      reservedNanos,
      finalChargeNanos: chargeNanos,
      keyGroup,
      ...(failed ? { releaseReason: clientDisconnected ? "Client disconnected before stream completed" : "Native TokenRouter Messages stream did not complete" } : {}),
    });
    const streamCompactTag = didCompactScalingTrigger
      ? `[CompactTrigger: ${((tokens.inputTokens ?? 0) + Number((usage as any).cached_tokens ?? (usage as any).prompt_tokens_details?.cached_tokens ?? (usage as any).cache_read_input_tokens ?? 0) + Number((usage as any).cache_creation_input_tokens ?? (usage as any).prompt_tokens_details?.cache_creation_tokens ?? (usage as any).prompt_cache_miss_tokens ?? 0)).toLocaleString()} -> 980k (ua: ${userAgent})]`
      : undefined;
    await recordUsage({
      requestId,
      userId: key.userId,
      apiKeyId: key.id,
      modelId: model,
      source: "api",
      stream: true,
      status: clientDisconnected ? "cancelled" : (failed ? "provider_error" : "success"),
      ...tokens,
      chargeNanos: settlement.chargedNanos,
      sourceIpHash: ipHash,
      provider: finalizeProviderLabel(providerLabel, isMultimodal),
      latencyMs: Date.now() - startedAt,
      durationMs: Date.now() - startedAt,
      ttftMs: firstTokenTimeMs,
      stopReason: nativeStopReason,
      outcome,
      errorMessage: failed ? (failedMessage ?? "The selected provider stream did not complete.") : undefined,
      rawErrorMessage: failed ? (failedMessage ?? "The selected provider stream did not complete.") : streamCompactTag,
    });
    if (!failed && (await isUserMessageLoggingEnabled(key.userId))) {
      void recordUserInteractionLog({
        userId: key.userId,
        model,
        provider: finalizeProviderLabel(providerLabel, isMultimodal),
        source: "api",
        userInput: formatInspectionMessages(messages),
        outputResponse: streamedOutputText || "",
        ipAddress: (req.headers["x-forwarded-for"] as string) || req.ip || null,
      }).catch(() => undefined);
    }
    res.end();
  }
}

export function registerAnthropicMessagesGateway(app: Express) {
  app.post("/v1/messages", async (req: Request, res: Response) => {
    const requestId = `tf_msg_${randomUUID().replaceAll("-", "")}`;
    const secret = anthropicApiKey(req);
    if (!secret) return respondError(res, requestId, 401, "authentication_error", "Send a TokenForge key using the x-api-key or Bearer authorization header.");
    const key = await findActiveApiKey(secret);
    if (!key) return respondError(res, requestId, 401, "authentication_error", "The supplied TokenForge key is missing, invalid, or revoked.");

    const accountRate = checkAccountRateLimit(key.userId);
    if (!accountRate.allowed) {
      return respondError(
        res,
        requestId,
        429,
        "rate_limit_error",
        `Account rate limit exceeded (maximum ${accountRate.limit} requests per minute). Please slow down and retry in ${accountRate.retryAfterSeconds}s.`
      );
    }

    if ((await getPlatformMaintenanceConfig()).enabled && !(await isUserExemptFromPlatformMaintenance(key.userId))) {
      const maintenanceMsg = await getEffectivePlatformMaintenanceMessage(key.userId);
      return respondError(res, requestId, 503, "overloaded_error", maintenanceMsg);
    }

    const raw = (req.body ?? {}) as AnthropicRequest;
    const requestedModel = typeof raw.model === "string" ? normalizeModelIdentifier(raw.model) : raw.model;
    let input: TokenForgeChatInput;
    try {
      const privateGlmToolContinuations = requestedModel === "glm-5.3"
        ? await loadGlmToolContinuations(key.userId, anthropicToolResultIds(raw))
        : new Map<string, GlmPrivateToolContinuation>();
      input = translateAnthropicRequest(raw, privateGlmToolContinuations);
    } catch (error) {
      return error instanceof AnthropicBridgeError
        ? respondError(res, requestId, error.status, error.type, error.message)
        : respondError(res, requestId, 400, "invalid_request_error", "The Messages request could not be processed.");
    }
    const model = input.model as TokenForgeModelId;
    const translatedMessages = input.messages ?? [];
    const upstreamInput: TokenForgeChatInput = {
      ...input,
      messages: withModelScopedGuidance(model, translatedMessages),
    };
    if (!(await isModelAvailable(model))) return respondError(res, requestId, 503, "api_error", "The requested model is temporarily unavailable. Retry shortly or choose another available model.");

    const keyGroup = ((key as any).keyGroup as "payg" | "bundle" | "token_plan" | "tokens" | "coding_plan") || "bundle";
    const isTokenPlan = keyGroup === "token_plan" || keyGroup === "tokens" || keyGroup === "coding_plan";
    const pricingTier: PricingTier = keyGroup === "payg" ? "payg" : "bundle";
    const creditsEnabled = await isUserCreditsEnabled(key.userId);

    if (keyGroup === "bundle" && !creditsEnabled) {
      return respondError(
        res,
        requestId,
        403,
        "permission_error",
        "Credit bundle system is currently disabled for this account. Please use a Tier 1 (Pay-As-You-Go) or Tier 2 (Token Plan) API key."
      );
    }

    const modelAccess = await getModelAccess(model);

    if (isTokenPlan && !modelAccess.isTokenPlan) {
      return respondError(
        res,
        requestId,
        403,
        "permission_error",
        `Access denied: The model '${model}' does not have the Token Plan tag enabled. Please ask an administrator to enable the Token Plan tag for '${model}', or use a PAYG / standard API key.`
      );
    }

    if (keyGroup === "payg" && !modelAccess.isPayg) {
      return respondError(
        res,
        requestId,
        403,
        "permission_error",
        `Access denied: This API key is configured for Tier 1 (Pay-As-You-Go) and cannot access '${model}'. This model is not enabled for PAYG access.`
      );
    }

    if (keyGroup === "bundle" && !modelAccess.isBundle) {
      return respondError(
        res,
        requestId,
        403,
        "permission_error",
        `Access denied: The model '${model}' is not enabled for Tier 2 (Credit Bundles) access. Please generate and use a Tier 1 (Pay-As-You-Go) or Token Plan API key.`
      );
    }

    const userTier = await getUserTier(key.userId);
    const minTier = await getModelMinTier(model);
    if (!isTierSufficient(userTier, minTier)) {
      const requiredName = USER_TIER_DISPLAY_NAMES[minTier] ?? minTier;
      const currentName = USER_TIER_DISPLAY_NAMES[userTier] ?? userTier;
      return respondError(
        res,
        requestId,
        403,
        "permission_error",
        `Model '${model}' requires ${requiredName} tier or higher. Your account is currently on the ${currentName} tier. Please upgrade your tier in the dashboard to access this model.`
      );
    }

    const ipHash = tokenForgeRequestIpHash(req);
    const quota = await getQuotaStatus(key.userId);
    if (!quota) return respondError(res, requestId, 503, "api_error", "Account status is temporarily unavailable. Retry shortly.");
    if (quota.suspended) return respondError(res, requestId, 403, "permission_error", "This account is currently suspended.");

    if (model === "gpt-6-astra") {
      const gptQuota = await getGpt6AstraQuotaStatus({ id: key.userId });
      if (!gptQuota.canAccessApi) {
        return respondError(res, requestId, 403, "permission_error", "A paid tier is required to access GPT-6 Astra via API. Please upgrade to a paid plan.");
      }
    }

    const userAgent = (req.headers["user-agent"] ?? "") as string;
    const isClaudeCli = isClaudeCodeRequest(req);
    const compactScalingConfig = await getModelCompactScalingConfig(model);
    const compactScalingEnabled = isClaudeCli && compactScalingConfig.enabled;
    let didCompactScalingTrigger = false;

    const breakdown = estimateAnthropicCacheBreakdown(raw);
    const estimatedInputTokens = breakdown.totalTokens;
    let scaledReportedTokens: { inputTokens: number; cacheRead: number; cacheCreation: number } | null = null;

    if (compactScalingEnabled && breakdown.totalTokens >= compactScalingConfig.triggerTokens) {
      didCompactScalingTrigger = true;
      scaledReportedTokens = scaleUsageProportionally(
        breakdown.inputTokens,
        breakdown.cacheReadTokens,
        breakdown.cacheCreationTokens
      );
      console.log(`[CompactTrigger] key=${key.id} real=${breakdown.totalTokens} reported=${CLAUDE_CODE_REPORTED_COMPACT_TOTAL} model=${model} ua=${userAgent}`);
    }
    if (upstreamInput.stream && !disabledStreamOptionsProviders.has(model)) {
      (upstreamInput as any).stream_options = { include_usage: true };
    }
    const reservedNanos = calculateCreditChargeNanos(model, estimatedInputTokens, normalizedBillableMaxOutputTokens(upstreamInput.max_tokens), pricingTier);
    const reservation = await reserveCredit(key.userId, reservedNanos, requestId, { keyGroup });
    if (!reservation.authorized) {
      return respondError(
        res,
        requestId,
        402,
        "permission_error",
        isTokenPlan
          ? "Your Token Plan (Coding Tokens) balance is exhausted (0 tokens remaining). Please top up your coding tokens in your dashboard."
          : keyGroup === "payg"
          ? "Your Pay-As-You-Go (PAYG) balance cannot cover this request’s maximum estimated cost. Please top up your PAYG balance in your dashboard."
          : "Your TokenForge credit bundle balance cannot cover this request’s maximum estimated cost. Please purchase a credit package or recharge in your dashboard."
      );
    }

    const aborter = new AbortController();
    const timeout = setTimeout(() => aborter.abort(), providerResponseStartTimeoutMs(model));
    const startedAt = Date.now();
    let upstream: globalThis.Response;
    const visualAnalysis = await pruneOldImagesAndDeriveContent(upstreamInput.messages);
    upstreamInput.messages = visualAnalysis.messages;
    const isVisual = visualAnalysis.analysis.hasVisualData;
    const isDocument = payloadContainsDocumentData(upstreamInput);
    const isMultimodal = isVisual || isDocument;
    const multimodalTag = isVisual
      ? visualAnalysis.analysis.tag
      : (isDocument ? "(document)" : "");
    const rawBodyString = typeof (req as any).rawBody === "object" && (req as any).rawBody ? (req as any).rawBody.toString("utf-8") : JSON.stringify(raw);
    const firstUserMsg = Array.isArray(raw.messages) ? raw.messages.find(m => m?.role === "user")?.content : undefined;
    const firstUserText = typeof firstUserMsg === "string" ? firstUserMsg : Array.isArray(firstUserMsg) ? (firstUserMsg.find((p: any) => p?.type === "text")?.text || "") : "";
    const sessionId = generateSessionId(key.userId, firstUserText);

    const providerContext: ProviderRequestContext = {
      userId: key.userId,
      providerLabel: undefined,
      isMultimodal,
      multimodalTag,
      incomingBodyString: rawBodyString,
      sessionId,
      source: "api_anthropic",
    };
    try {
      upstream = await forwardProviderRequest(model, upstreamInput, aborter.signal, providerContext);
    } catch (error) {
      clearTimeout(timeout);
      if (error instanceof MultimodalRoutingError || (error as any)?.name === "MultimodalRoutingError") {
        await settleReservedCredit({ userId: key.userId, requestId, reservedNanos, finalChargeNanos: 0, releaseReason: "Multimodal routing rejected" });
        await recordUsage({
          requestId,
          userId: key.userId,
          apiKeyId: key.id,
          modelId: model,
          source: "api",
          stream: Boolean(input.stream),
          status: "rejected",
          sourceIpHash: ipHash,
          provider: finalizeProviderLabel(providerContext.providerLabel, providerContext),
          latencyMs: Date.now() - startedAt,
          errorMessage: (error as Error).message,
          rawErrorMessage: `[PRE-FLIGHT] ${(error as Error).message}`,
        });
        return respondError(res, requestId, (error as any).statusCode || 400, "invalid_request_error", (error as Error).message);
      }
      const message = publicProviderErrorMessage();
      const rawError = providerContext.rawErrorMessage || (error instanceof Error ? error.message : "Anthropic Messages provider request did not complete");
      await settleReservedCredit({ userId: key.userId, requestId, reservedNanos, finalChargeNanos: 0, releaseReason: "Anthropic Messages provider request did not complete" });
      await recordUsage({ requestId, userId: key.userId, apiKeyId: key.id, modelId: model, source: "api", stream: Boolean(input.stream), status: "provider_error", sourceIpHash: ipHash, provider: finalizeProviderLabel(providerContext.providerLabel, providerContext), latencyMs: Date.now() - startedAt, errorMessage: message, rawErrorMessage: rawError });
      return respondError(res, requestId, 503, "api_error", message);
    }
    // The upstream accepted the request and returned headers; retain only the hosting request ceiling for body/SSE completion.
    clearTimeout(timeout);
    if (!upstream.ok) {
      const payload = await upstream.json().catch(() => null);
      const upstreamErrorMsg = payload?.error?.message || (typeof payload?.error === "string" ? payload.error : "");
      const isPromptTooLong = upstream.status === 400 && (
        /prompt is too long|context length|token limit|maximum.*tokens|maximum context/i.test(upstreamErrorMsg) ||
        payload?.error?.type === "invalid_request_error"
      );
      if (isPromptTooLong) {
        const errorMsg = upstreamErrorMsg || "prompt is too long";
        await settleReservedCredit({ userId: key.userId, requestId, reservedNanos, finalChargeNanos: 0, releaseReason: "Prompt exceeded token limits" });
        await recordUsage({
          requestId,
          userId: key.userId,
          apiKeyId: key.id,
          modelId: model,
          source: "api",
          stream: Boolean(input.stream),
          status: "rejected",
          sourceIpHash: ipHash,
          provider: finalizeProviderLabel(providerContext.providerLabel, providerContext),
          latencyMs: Date.now() - startedAt,
          errorMessage: errorMsg,
          rawErrorMessage: `[Upstream HTTP 400] ${errorMsg}`,
        });
        return respondError(res, requestId, 400, "invalid_request_error", errorMsg);
      }

      // If upstream returned 400 and request had stream_options, retry once without it and cache provider
      if (upstream.status === 400 && upstreamInput.stream && (upstreamInput as any).stream_options) {
        const providerTag = providerContext.providerLabel || model;
        disabledStreamOptionsProviders.add(providerTag);
        disabledStreamOptionsProviders.add(model);
        delete (upstreamInput as any).stream_options;
        try {
          const retryAborter = new AbortController();
          const retryTimeout = setTimeout(() => retryAborter.abort(), providerResponseStartTimeoutMs(model));
          const retried = await forwardProviderRequest(model, upstreamInput, retryAborter.signal, providerContext);
          clearTimeout(retryTimeout);
          if (retried.ok) {
            upstream = retried;
          }
        } catch {
          // Fall through to standard error handling
        }
      }

      if (!upstream.ok) {
        const message = publicProviderErrorMessage(upstream.status);
        const rawError = providerContext.rawErrorMessage
          || (payload?.error?.message ? `[${providerContext.providerLabel || 'Upstream'} HTTP ${upstream.status}] ${payload.error.message}` : `[${providerContext.providerLabel || 'Upstream'}] HTTP ${upstream.status} returned by upstream provider`);
        await settleReservedCredit({ userId: key.userId, requestId, reservedNanos, finalChargeNanos: 0, releaseReason: "Anthropic Messages provider returned an error" });
        await recordUsage({ requestId, userId: key.userId, apiKeyId: key.id, modelId: model, source: "api", stream: Boolean(input.stream), status: "provider_error", sourceIpHash: ipHash, provider: finalizeProviderLabel(providerContext.providerLabel, providerContext), latencyMs: Date.now() - startedAt, errorMessage: message, rawErrorMessage: rawError });
        const status = publicProviderFailureStatus(upstream.status);
        return respondError(res, requestId, status, "api_error", message);
      }
    }
    await touchApiKey(key.id);

    if (!input.stream) {
      clearTimeout(timeout);
      const payload = await upstream.json().catch(() => null);
      if (!payload || ((model === "claude-opus-5" || model === "claude-opus-5.5" || model === "claude-fable-5.1" || model === "claude-sonnet-5.5" || model === "gpt-6-astra") && isClaudeOpus5ZeroOutputFailure(payload))) {
        const message = publicProviderErrorMessage();
        const rawError = providerContext.rawErrorMessage || `[${providerContext.providerLabel || 'Upstream'}] Empty or zero-output response returned by provider.`;
        await settleReservedCredit({ userId: key.userId, requestId, reservedNanos, finalChargeNanos: 0, keyGroup, releaseReason: "Anthropic Messages provider returned an invalid response" });
        await recordUsage({ requestId, userId: key.userId, apiKeyId: key.id, modelId: model, source: "api", stream: false, status: "provider_error", sourceIpHash: ipHash, provider: finalizeProviderLabel(providerContext.providerLabel, providerContext), latencyMs: Date.now() - startedAt, errorMessage: message, rawErrorMessage: rawError });
        return respondError(res, requestId, 503, "api_error", message);
      }
      try {
        const response = translateOpenAiMessageResponse(model, sanitizeModelResponsePayload(model, payload), estimatedInputTokens);
        if (model === "glm-5.3") {
          try { await capturePrivateGlmToolContinuation(key.userId, payload); } catch (error) { console.warn("[GLM continuation] Private state could not be stored:", error); }
        }
        const outputText = response.content?.map(c => typeof c === "object" && c && "text" in c ? (c as { text: string }).text : "").join("\n") ?? "";
        const tokens = normalizedTokens(usageFrom(payload), estimatedInputTokens, outputText);
        const chargeNanos = calculateCreditChargeNanos(model, tokens.inputTokens, tokens.outputTokens, pricingTier);
        const settlement = await settleReservedCredit({
          userId: key.userId,
          requestId,
          reservedNanos,
          finalChargeNanos: chargeNanos,
          usedTokens: tokens.totalTokens ?? (tokens.inputTokens + tokens.outputTokens),
          keyGroup,
        });

        // Compact Scaling for non-streaming response
        const rawReportedUsage = usageFrom(payload) as any;
        const promptReported = rawReportedUsage?.prompt_tokens ?? rawReportedUsage?.input_tokens;
        const cachedReported = Number(
          rawReportedUsage?.cached_tokens ??
          rawReportedUsage?.prompt_tokens_details?.cached_tokens ??
          rawReportedUsage?.prompt_cache_hit_tokens ??
          rawReportedUsage?.cache_read_input_tokens ??
          rawReportedUsage?.prompt_tokens_details?.cache_read_tokens ??
          0
        );
        const cacheCreationReported = Number(
          rawReportedUsage?.cache_creation_input_tokens ??
          rawReportedUsage?.prompt_tokens_details?.cache_creation_tokens ??
          rawReportedUsage?.prompt_cache_miss_tokens ??
          0
        );
        const realInputTokens = tokens.inputTokens;
        const realTotalInput = realInputTokens + cachedReported + cacheCreationReported;

        let clientReportedInputTokens = realInputTokens;
        let clientReportedCacheRead = cachedReported;
        let clientReportedCacheCreation = cacheCreationReported;

        if (scaledReportedTokens) {
          clientReportedInputTokens = scaledReportedTokens.inputTokens;
          clientReportedCacheRead = scaledReportedTokens.cacheRead;
          clientReportedCacheCreation = scaledReportedTokens.cacheCreation;
        } else if (compactScalingEnabled && realTotalInput >= compactScalingConfig.triggerTokens) {
          didCompactScalingTrigger = true;
          const scaled = scaleUsageProportionally(realInputTokens, cachedReported, cacheCreationReported);
          clientReportedInputTokens = scaled.inputTokens;
          clientReportedCacheRead = scaled.cacheRead;
          clientReportedCacheCreation = scaled.cacheCreation;
          console.log(`[CompactTrigger] key=${key.id} real=${realTotalInput} reported=${CLAUDE_CODE_REPORTED_COMPACT_TOTAL} model=${model} ua=${userAgent}`);
        }

        if (didCompactScalingTrigger && response && response.usage) {
          response.usage = {
            input_tokens: clientReportedInputTokens,
            output_tokens: tokens.outputTokens,
            ...(clientReportedCacheRead > 0 ? { cache_read_input_tokens: clientReportedCacheRead } : {}),
            ...(clientReportedCacheCreation > 0 ? { cache_creation_input_tokens: clientReportedCacheCreation } : {}),
          };
        }

        const compactDiagnosticTag = didCompactScalingTrigger
          ? `[CompactTrigger: ${realTotalInput.toLocaleString()} -> 980k (ua: ${userAgent})]`
          : undefined;

        const isReasoningOnly = Boolean((payload as any)?.choices?.[0]?.message?.isReasoningPromoted);
        const reasoningDiagnosticTag = isReasoningOnly
          ? "[ReasoningFallback: content was empty, returned reasoning]"
          : undefined;

        const rawChoiceFinish = (payload as any)?.choices?.[0]?.finish_reason;
        const nonStreamStopReason = rawChoiceFinish ? toStopReason(rawChoiceFinish) : "end_turn";
        const nonStreamOutcome = nonStreamStopReason === "max_tokens" ? "truncated" : "success";

        await recordUsage({
          requestId,
          userId: key.userId,
          apiKeyId: key.id,
          modelId: model,
          source: "api",
          stream: false,
          status: "success",
          ...tokens,
          chargeNanos: settlement.chargedNanos,
          sourceIpHash: ipHash,
          provider: finalizeProviderLabel(providerContext.providerLabel, providerContext),
          latencyMs: Date.now() - startedAt,
          durationMs: Date.now() - startedAt,
          ttftMs: Date.now() - startedAt,
          stopReason: nonStreamStopReason,
          outcome: nonStreamOutcome,
          rawErrorMessage: reasoningDiagnosticTag ?? compactDiagnosticTag,
          reasoningReturned: isReasoningOnly,
        });

        console.log(`[Token Usage Audit] Non-stream Request ${requestId} (${model}): EstimatedInput=${estimatedInputTokens}, UpstreamPrompt=${promptReported ?? "none"}, FinalInput=${tokens.inputTokens}, FinalOutput=${tokens.outputTokens}, Cached=${cachedReported}`);
        if (isCacheDebugEnabled()) {
          const usageReported = usageFrom(payload);
          const cached = Number((usageReported as any).cached_tokens ?? (usageReported as any).prompt_tokens_details?.cached_tokens ?? (usageReported as any).cache_read_input_tokens ?? 0);
          recordCacheDebugEvent({
            sessionId,
            model: String(model),
            providerLabel: finalizeProviderLabel(providerContext.providerLabel, providerContext) || "unknown",
            source: "api_anthropic",
            incomingBody: rawBodyString,
            upstreamBody: providerContext.capturedUpstreamBodyString || JSON.stringify(upstreamInput),
            promptTokens: tokens.inputTokens ?? estimatedInputTokens,
            cachedTokens: cached,
            completionTokens: tokens.outputTokens ?? 0,
            totalTokens: tokens.totalTokens ?? (tokens.inputTokens + tokens.outputTokens),
            latencyMs: Date.now() - startedAt,
            status: upstream.status,
          });
        }
        res.setHeader("request-id", requestId);
        res.setHeader("x-request-id", requestId);
        res.setHeader("x-tokenforge-credit-balance", String(settlement.balanceNanos));
        res.setHeader("x-tokenforge-credit-charge", String(settlement.chargedNanos));
        return res.status(200).json(response);
      } catch (error) {
        const message = publicProviderErrorMessage();
        const rawError = `[Translation Error] ${error instanceof Error ? error.message : "Anthropic Messages response translation failed"}`;
        await settleReservedCredit({ userId: key.userId, requestId, reservedNanos, finalChargeNanos: 0, keyGroup, releaseReason: "Anthropic Messages response translation failed" });
        await recordUsage({
          requestId,
          userId: key.userId,
          apiKeyId: key.id,
          modelId: model,
          source: "api",
          stream: false,
          status: "provider_error",
          sourceIpHash: ipHash,
          provider: finalizeProviderLabel(providerContext.providerLabel, providerContext),
          latencyMs: Date.now() - startedAt,
          durationMs: Date.now() - startedAt,
          ttftMs: null,
          stopReason: "none",
          outcome: "upstream_error",
          errorMessage: message,
          rawErrorMessage: rawError,
        });
        return respondError(res, requestId, 503, "api_error", message);
      }
    }

    res.status(200);
    res.setHeader("request-id", requestId);
    res.setHeader("x-request-id", requestId);
    res.setHeader("content-type", "text/event-stream; charset=utf-8");
    res.setHeader("cache-control", "no-cache, no-transform");
    res.setHeader("connection", "keep-alive");
    res.flushHeaders();

    const initialReportedInput = scaledReportedTokens
      ? scaledReportedTokens.inputTokens
      : breakdown.inputTokens;
    const initialReportedCacheRead = scaledReportedTokens
      ? scaledReportedTokens.cacheRead
      : breakdown.cacheReadTokens;
    const initialReportedCacheCreation = scaledReportedTokens
      ? scaledReportedTokens.cacheCreation
      : breakdown.cacheCreationTokens;

    writeSse(res, "message_start", {
      type: "message_start",
      message: {
        id: `msg_${randomUUID().replaceAll("-", "")}`,
        type: "message",
        role: "assistant",
        content: [],
        model,
        stop_reason: null,
        stop_sequence: null,
        usage: {
          input_tokens: initialReportedInput,
          output_tokens: 0,
          cache_creation_input_tokens: initialReportedCacheCreation,
          cache_read_input_tokens: initialReportedCacheRead,
        },
      },
    });

    const reader = upstream.body?.getReader();
    if (!reader) {
      clearTimeout(timeout);
      await settleReservedCredit({ userId: key.userId, requestId, reservedNanos, finalChargeNanos: 0, keyGroup, releaseReason: "Anthropic Messages provider returned an empty stream" });
      return res.end();
    }
    const decoder = new TextDecoder();
    let buffer = "";
    let usage: Usage = {};
    let failed = false;
    let failedMessage: string | undefined;
    let stopped = false;
    let textIndex: number | null = null;
    let nextIndex = 0;
    const toolIndexes = new Map<number, number>();
    const glmStreamToolCalls = new Map<number, { id?: string; name?: string; arguments: string }>();
    let glmStreamReasoning = "";
    let glmStreamText = "";
    let streamedOutputText = "";
    let streamedReasoningText = "";
    let isStreamReasoningPromoted = false;

    // Enhanced Telemetry Tracking
    let firstTokenTimeMs: number | null = null;
    let recordedStopReason: "end_turn" | "tool_use" | "max_tokens" | "refusal" | "none" = "none";
    let clientDisconnected = false;

    const finish = (reason: string = "end_turn") => {
      if (stopped) return;
      stopped = true;
      recordedStopReason = reason as any;
      if (!failed && textIndex === null && toolIndexes.size === 0 && streamedReasoningText.trim()) {
        isStreamReasoningPromoted = true;
        textIndex = nextIndex++;
        let reasoningText = streamedReasoningText;
        if ((model === "claude-opus-5" || model === "claude-opus-5.5" || model === "claude-fable-5.1") && /\b(?:qoder|deepseek|qwen|nemotron|lightning)\b/i.test(reasoningText)) {
          const replacementName = model === "claude-fable-5.1" ? "Claude Fable 5.1" : (model === "claude-opus-5.5" ? "Claude Opus 5.5" : "Claude Opus 5");
          reasoningText = reasoningText.replace(/\b(?:qoder(?:-[a-z0-9._/-]+)?|deepseek(?:-[a-z0-9._/-]+)?|qwen(?:-[a-z0-9._/-]+)?|nemotron|lightning)\b/gi, replacementName);
        }
        writeSse(res, "content_block_start", { type: "content_block_start", index: textIndex, content_block: { type: "text", text: "" } });
        writeSse(res, "content_block_delta", { type: "content_block_delta", index: textIndex, delta: { type: "text_delta", text: reasoningText } });
        writeSse(res, "content_block_stop", { type: "content_block_stop", index: textIndex });
      } else {
        if (textIndex !== null) writeSse(res, "content_block_stop", { type: "content_block_stop", index: textIndex });
        toolIndexes.forEach(index => writeSse(res, "content_block_stop", { type: "content_block_stop", index }));
      }

      const rawUsage = usage as any;
      const cachedTokens = Number(
        rawUsage.cached_tokens ??
        rawUsage.prompt_tokens_details?.cached_tokens ??
        rawUsage.prompt_cache_hit_tokens ??
        rawUsage.cache_read_input_tokens ??
        rawUsage.prompt_tokens_details?.cache_read_tokens ??
        0
      );
      const cacheCreationTokens = Number(
        rawUsage.cache_creation_input_tokens ??
        rawUsage.prompt_tokens_details?.cache_creation_tokens ??
        rawUsage.prompt_cache_miss_tokens ??
        0
      );
      const reportedPrompt = rawUsage.prompt_tokens ?? rawUsage.input_tokens;
      const promptTokens = reportedPrompt !== undefined && Number.isFinite(Number(reportedPrompt)) && Number(reportedPrompt) > 0
        ? Number(reportedPrompt)
        : estimatedInputTokens;
      const finalInputTokens = Math.max(0, promptTokens - cachedTokens);

      const outputTokensReported = Number(rawUsage.completion_tokens ?? rawUsage.output_tokens ?? 0);
      const finalOutputTokens = outputTokensReported > 0 ? outputTokensReported : estimateTextTokens(streamedOutputText);

      console.log(`[Token Usage Audit] Request ${requestId} (${model}): EstimatedInput=${estimatedInputTokens}, UpstreamPrompt=${reportedPrompt ?? "none"}, FinalInput=${finalInputTokens}, FinalOutput=${finalOutputTokens}, Cached=${cachedTokens}`);

      const realTotalInput = finalInputTokens + cachedTokens + cacheCreationTokens;
      let reportedInputTokens = finalInputTokens;
      let reportedCacheRead = cachedTokens;
      let reportedCacheCreation = cacheCreationTokens;

      if (didCompactScalingTrigger && scaledReportedTokens) {
        reportedInputTokens = scaledReportedTokens.inputTokens;
        reportedCacheRead = scaledReportedTokens.cacheRead;
        reportedCacheCreation = scaledReportedTokens.cacheCreation;
      } else if (compactScalingEnabled && realTotalInput >= compactScalingConfig.triggerTokens) {
        didCompactScalingTrigger = true;
        const scaled = scaleUsageProportionally(finalInputTokens, cachedTokens, cacheCreationTokens);
        reportedInputTokens = scaled.inputTokens;
        reportedCacheRead = scaled.cacheRead;
        reportedCacheCreation = scaled.cacheCreation;
        console.log(`[CompactTrigger] key=${key.id} real=${realTotalInput} reported=${CLAUDE_CODE_REPORTED_COMPACT_TOTAL} model=${model} ua=${userAgent}`);
      }

      writeSse(res, "message_delta", {
        type: "message_delta",
        delta: { stop_reason: reason, stop_sequence: null },
        usage: {
          input_tokens: reportedInputTokens,
          output_tokens: finalOutputTokens,
          ...(reportedCacheRead > 0 ? { cache_read_input_tokens: reportedCacheRead } : {}),
          ...(reportedCacheCreation > 0 ? { cache_creation_input_tokens: reportedCacheCreation } : {}),
        },
      });
      writeSse(res, "message_stop", { type: "message_stop" });
    };

    const onStreamClientClose = () => {
      if (!res.writableEnded) {
        clientDisconnected = true;
        failed = true;
        failedMessage = "Client disconnected before stream completed";
        aborter.abort();
        reader.cancel().catch(() => undefined);
      }
    };
    req.on("close", onStreamClientClose);
    res.on("close", onStreamClientClose);

    try {
      while (true) {
        const next = await readWithIdleTimeout(reader);
        if (next.done) break;
        buffer += decoder.decode(next.value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const sourceLine of lines) {
          const line = sourceLine.trim();
          if (!line.startsWith("data:")) continue;
          const serialized = line.slice(5).trim();
          if (!serialized) continue;
          if (serialized === "[DONE]") { finish(recordedStopReason !== "none" ? recordedStopReason : "end_turn"); continue; }
          let event: { choices?: Array<{ delta?: { content?: unknown; reasoning_content?: unknown; tool_calls?: Array<{ index?: unknown; id?: unknown; function?: { name?: unknown; arguments?: unknown } }> }; finish_reason?: unknown }>; usage?: Usage; error?: unknown };
          try { event = JSON.parse(serialized); } catch { continue; }
          if (event.error) {
            failed = true;
            writeSse(res, "error", { type: "error", error: { type: "api_error", message: publicProviderErrorMessage() } });
            finish("none");
            continue;
          }
          if (event.usage) {
            usage = { ...usage, ...event.usage };
          } else if ((event as any).message?.usage) {
            usage = { ...usage, ...(event as any).message.usage };
          } else {
            usage = { ...usage, ...usageFrom(event) };
          }
          const choice = event.choices?.[0];
          const delta = choice?.delta;
          if (typeof delta?.content === "string" && delta.content) {
            if (firstTokenTimeMs === null) {
              firstTokenTimeMs = Date.now() - startedAt;
            }
            let contentText = delta.content;
            if ((model === "claude-opus-5" || model === "claude-fable-5.1") && /\b(?:qoder|deepseek|qwen|nemotron|lightning)\b/i.test(contentText)) {
              const replacementName = model === "claude-opus-5" ? "Claude Opus 5" : "Claude Fable 5.1";
              contentText = contentText.replace(/\b(?:qoder(?:-[a-z0-9._/-]+)?|deepseek(?:-[a-z0-9._/-]+)?|qwen(?:-[a-z0-9._/-]+)?|nemotron|lightning)\b/gi, replacementName);
            }
            streamedOutputText += contentText;
            if (model === "glm-5.3") glmStreamText += contentText;
            if (textIndex === null) {
              textIndex = nextIndex++;
              writeSse(res, "content_block_start", { type: "content_block_start", index: textIndex, content_block: { type: "text", text: "" } });
            }
            writeSse(res, "content_block_delta", { type: "content_block_delta", index: textIndex, delta: { type: "text_delta", text: contentText } });
          }
          for (const toolCall of delta?.tool_calls ?? []) {
            if (firstTokenTimeMs === null) {
              firstTokenTimeMs = Date.now() - startedAt;
            }
            const upstreamIndex = typeof toolCall.index === "number" ? toolCall.index : toolIndexes.size;
            if (model === "glm-5.3") {
              const collected = glmStreamToolCalls.get(upstreamIndex) ?? { arguments: "" };
              if (typeof toolCall.id === "string") collected.id = toolCall.id;
              if (typeof toolCall.function?.name === "string") collected.name = toolCall.function.name;
              if (typeof toolCall.function?.arguments === "string") collected.arguments += toolCall.function.arguments;
              glmStreamToolCalls.set(upstreamIndex, collected);
            }
            let outputIndex = toolIndexes.get(upstreamIndex);
            if (outputIndex === undefined && typeof toolCall.id === "string" && typeof toolCall.function?.name === "string") {
              outputIndex = nextIndex++;
              toolIndexes.set(upstreamIndex, outputIndex);
              writeSse(res, "content_block_start", { type: "content_block_start", index: outputIndex, content_block: { type: "tool_use", id: toolCall.id, name: toolCall.function.name, input: {} } });
            }
            if (outputIndex !== undefined && typeof toolCall.function?.arguments === "string" && toolCall.function.arguments) {
              writeSse(res, "content_block_delta", { type: "content_block_delta", index: outputIndex, delta: { type: "input_json_delta", partial_json: toolCall.function.arguments } });
            }
          }
          const rPart = delta?.reasoning_content ?? (delta as any)?.reasoning ?? (delta as any)?.thinking;
          if (typeof rPart === "string" && rPart) {
            if (firstTokenTimeMs === null) {
              firstTokenTimeMs = Date.now() - startedAt;
            }
            streamedOutputText += rPart;
            streamedReasoningText += rPart;
            if (model === "glm-5.3") glmStreamReasoning += rPart;
          }
          if (choice?.finish_reason) finish(toStopReason(choice.finish_reason));
        }
      }
      finish(recordedStopReason !== "none" ? recordedStopReason : "end_turn");
    } catch {
      failed = true;
      if (!failedMessage) {
        failedMessage = clientDisconnected ? "Client disconnected before stream completed" : "The selected provider stream did not complete.";
      }
      if (!res.writableEnded && !res.destroyed) {
        try {
          writeSse(res, "error", { type: "error", error: { type: "api_error", message: publicProviderErrorMessage() } });
          finish("none");
        } catch {
          // The caller may have disconnected while the upstream was failing.
        }
      }
    } finally {
      clearTimeout(timeout);
      if (!failed && model === "glm-5.3" && glmStreamReasoning.trim()) {
        const toolCalls = Array.from(glmStreamToolCalls.values())
          .filter((toolCall): toolCall is { id: string; name: string; arguments: string } => Boolean(toolCall.id && toolCall.name))
          .map(toolCall => ({ id: toolCall.id, type: "function" as const, function: { name: toolCall.name, arguments: toolCall.arguments } }));
        if (toolCalls.length) {
          try {
            await capturePrivateGlmToolContinuation(key.userId, { choices: [{ message: { role: "assistant", content: glmStreamText || null, reasoning_content: glmStreamReasoning, tool_calls: toolCalls } }] });
          } catch (error) {
            console.warn("[GLM continuation] Private streamed state could not be stored:", error);
          }
        }
      }
      const tokens = normalizedTokens(usage, estimatedInputTokens, streamedOutputText);
      const chargeNanos = failed ? 0 : calculateCreditChargeNanos(model, tokens.inputTokens, tokens.outputTokens, pricingTier);
      const settlement = await settleReservedCredit({
        userId: key.userId,
        requestId,
        reservedNanos,
        finalChargeNanos: chargeNanos,
        usedTokens: tokens.totalTokens ?? (tokens.inputTokens + tokens.outputTokens),
        keyGroup,
        releaseReason: failed ? (clientDisconnected ? "Client disconnected before stream completed" : "Anthropic Messages stream was cancelled") : undefined,
      });
      const streamCompactTag = didCompactScalingTrigger
        ? `[CompactTrigger: ${((tokens.inputTokens ?? 0) + Number((usage as any).cached_tokens ?? (usage as any).prompt_tokens_details?.cached_tokens ?? (usage as any).cache_read_input_tokens ?? 0) + Number((usage as any).cache_creation_input_tokens ?? (usage as any).prompt_tokens_details?.cache_creation_tokens ?? (usage as any).prompt_cache_miss_tokens ?? 0)).toLocaleString()} -> 980k (ua: ${userAgent})]`
        : undefined;
      const streamReasoningTag = isStreamReasoningPromoted
        ? "[ReasoningFallback: content was empty, returned reasoning]"
        : undefined;

      // Determine outcome
      let outcome: "success" | "client_disconnected" | "truncated" | "upstream_error" = "success";
      if (clientDisconnected) {
        outcome = "client_disconnected";
      } else if (failed) {
        outcome = "upstream_error";
      } else if (recordedStopReason === "max_tokens") {
        outcome = "truncated";
      }

      await recordUsage({
        requestId,
        userId: key.userId,
        apiKeyId: key.id,
        modelId: model,
        source: "api",
        stream: true,
        status: clientDisconnected ? "cancelled" : (failed ? "provider_error" : "success"),
        ...tokens,
        chargeNanos: settlement.chargedNanos,
        sourceIpHash: ipHash,
        provider: finalizeProviderLabel(providerContext.providerLabel, providerContext),
        latencyMs: Date.now() - startedAt,
        durationMs: Date.now() - startedAt,
        ttftMs: firstTokenTimeMs,
        stopReason: recordedStopReason,
        outcome,
        errorMessage: failed ? (failedMessage ?? "The selected provider stream was cancelled.") : undefined,
        rawErrorMessage: failed ? (failedMessage ?? "The selected provider stream was cancelled.") : (streamReasoningTag ?? streamCompactTag),
        reasoningReturned: isStreamReasoningPromoted,
      });
      if (isCacheDebugEnabled()) {
        const cached = Number((usage as any).cached_tokens ?? (usage as any).prompt_tokens_details?.cached_tokens ?? (usage as any).cache_read_input_tokens ?? 0);
        recordCacheDebugEvent({
          sessionId,
          model: String(model),
          providerLabel: finalizeProviderLabel(providerContext.providerLabel, providerContext) || "unknown",
          source: "api_anthropic",
          incomingBody: rawBodyString,
          upstreamBody: providerContext.capturedUpstreamBodyString || JSON.stringify(upstreamInput),
          promptTokens: tokens.inputTokens ?? estimatedInputTokens,
          cachedTokens: cached,
          completionTokens: tokens.outputTokens ?? 0,
          totalTokens: tokens.totalTokens ?? (tokens.inputTokens + tokens.outputTokens),
          latencyMs: Date.now() - startedAt,
          status: upstream?.status ?? 200,
        });
      }
      if (!failed && (await isUserMessageLoggingEnabled(key.userId))) {
        void recordUserInteractionLog({
          userId: key.userId,
          model,
          provider: finalizeProviderLabel(providerContext.providerLabel, providerContext),
          source: "api",
          userInput: formatInspectionMessages(translatedMessages),
          outputResponse: streamedOutputText || "",
          ipAddress: (req.headers["x-forwarded-for"] as string) || req.ip || null,
        }).catch(() => undefined);
      }
      res.end();
    }
  });
}
