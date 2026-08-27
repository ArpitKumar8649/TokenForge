import type { Express, Request, Response } from "express";
import { randomUUID } from "node:crypto";
import {
  findActiveApiKey,
  getPlatformMaintenanceConfig,
  PLATFORM_MAINTENANCE_ERROR_MESSAGE,
  getQuotaStatus,
  isModelAvailable,
  loadGlmToolContinuations,
  recordUsage,
  reserveCredit,
  settleReservedCredit,
  storeGlmToolContinuation,
  touchApiKey,
} from "./db";
import type { GlmPrivateToolContinuation } from "./glmToolContinuationVault";
import { calculateCreditChargeNanos, normalizedBillableMaxOutputTokens } from "./creditPricing";
import {
  forwardProviderRequest,
  isClaudeOpus5ZeroOutputFailure,
  forwardTokenRouterAnthropicMessagesRequest,
  modelScopedGuidance,
  publicProviderErrorMessage,
  publicProviderFailureStatus,
  sanitizeModelResponsePayload,
  tokenForgeRequestIpHash,
  type TokenForgeChatInput,
  type TokenForgeChatMessage,
  withModelScopedGuidance,
} from "./openaiGateway";
import { CLUSTER_PROTOCOL_PROVIDER_SLUG, getTokenForgeProviderSlug, isTokenForgeModelId, type TokenForgeModelId } from "./modelCatalogue";

/** Applies only until upstream response headers arrive; successful bodies and SSE streams may continue within the hosting request ceiling. */
const PROVIDER_TIMEOUT_MS = 120_000;
export const CLAUDE_OPUS5_RESPONSE_START_TIMEOUT_MS = PROVIDER_TIMEOUT_MS;

export function providerResponseStartTimeoutMs(model: TokenForgeModelId) {
  return model === "claude-opus-5"
    ? CLAUDE_OPUS5_RESPONSE_START_TIMEOUT_MS
    : PROVIDER_TIMEOUT_MS;
}

type Usage = { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number; input_tokens?: number; output_tokens?: number };
type AnthropicRequest = { model?: unknown; messages?: unknown; system?: unknown; tools?: unknown; stream?: unknown; max_tokens?: unknown; temperature?: unknown; [key: string]: unknown };
type AnthropicBlock = { type?: unknown; text?: unknown; id?: unknown; name?: unknown; input?: unknown; tool_use_id?: unknown; content?: unknown; is_error?: unknown };
// TokenRouter exposes the validated Claude routes through OpenAI-compatible Chat
// Completions. Keep both customer-facing Claude models on the same converter so
// Claude Code receives consistent Anthropic response, tool, and SSE semantics.
const OPENAI_TRANSLATED_MESSAGES_MODELS = new Set(["qwen3.8-27b", "qwen3.8-max", "claude-fable-5", "claude-opus-5", "glm-5.3", "claude-sonnet-4.6", "deepseek-v4-pro"]);

type NativeTokenRouterMessagesInput = {
  model: "claude-fable-5";
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
    if (block && typeof block === "object" && (block as AnthropicBlock).type === "text") return requireText((block as AnthropicBlock).text, "Text content blocks require a text string.");
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

/** Preserve Claude Code's native Anthropic payload shape for Claude Fable 5. */
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
  const guidance = modelScopedGuidance(model).content;
  const guidanceText = typeof guidance === "string" ? guidance : "";
  const system = raw.system === undefined
    ? guidanceText
    : typeof raw.system === "string"
      ? `${guidanceText}\n\n${raw.system}`
      : [{ type: "text", text: guidanceText }, ...raw.system];
  return { ...raw, model, messages: raw.messages, system, stream, max_tokens: maxTokens, reasoning_effort: "xhigh" as const };
}

/** Backward-compatible focused helper retained for the Claude Fable 5 regression suite. */
export function prepareNativeClaudeFableMessagesRequest(raw: AnthropicRequest) {
  const input = prepareNativeTokenRouterMessagesRequest(raw);
  if (input.model !== "claude-fable-5") throw new AnthropicBridgeError(400, "invalid_request_error", "The requested model is not Claude Fable 5.");
  return input;
}

function estimateNativeAnthropicInputTokens(input: NativeTokenRouterMessagesInput) {
  return Math.ceil(JSON.stringify({ system: input.system, messages: input.messages, tools: input.tools }).length / 4) + 4;
}

export function translateAnthropicRequest(raw: AnthropicRequest, privateGlmToolContinuations: ReadonlyMap<string, GlmPrivateToolContinuation> = new Map()): TokenForgeChatInput {
  if (typeof raw.model !== "string" || !raw.model.trim()) {
    throw new AnthropicBridgeError(400, "invalid_request_error", "model must be a non-empty TokenForge Messages-supported model identifier.");
  }
  const provider = isTokenForgeModelId(raw.model) ? getTokenForgeProviderSlug(raw.model) : null;
  if (provider !== CLUSTER_PROTOCOL_PROVIDER_SLUG && !OPENAI_TRANSLATED_MESSAGES_MODELS.has(raw.model)) {
    throw new AnthropicBridgeError(400, "invalid_request_error", "The Anthropic Messages endpoint does not support the requested TokenForge model.");
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
  const model = raw.model as string;
  // TokenRouter's GLM 5.3 route rejects a historical OpenAI `tool_calls` turn
  // unless the provider-only reasoning_content emitted with that original call is
  // also replayed. Claude Code sends Anthropic tool history, which deliberately
  // cannot expose that provider-private state. Preserve the observable call and
  // result as conversation text instead of creating an invalid tool-call chain.
  const usesOpenAiNativeToolResults = OPENAI_TRANSLATED_MESSAGES_MODELS.has(model) && model !== "glm-5.3";
  const maxTokens = typeof raw.max_tokens === "number" ? raw.max_tokens : undefined;
  const temperature = typeof raw.temperature === "number" ? raw.temperature : undefined;

  const messages: TokenForgeChatMessage[] = [];
  const systemInstructions: string[] = raw.system === undefined ? [] : [systemToText(raw.system)];
  for (let messageIndex = 0; messageIndex < raw.messages.length; messageIndex += 1) {
    const candidate = raw.messages[messageIndex];
    if (!candidate || typeof candidate !== "object") throw new AnthropicBridgeError(400, "invalid_request_error", `messages[${messageIndex}] must be an object.`);
    const message = candidate as { role?: unknown; content?: unknown };
    if (message.role === "system" || message.role === "developer") {
      const instruction = contentToText(message.content).trim();
      if (!instruction) throw new AnthropicBridgeError(400, "invalid_request_error", `messages[${messageIndex}].content must contain instruction text.`);
      systemInstructions.push(instruction);
      continue;
    }
    if (message.role === "tool" || message.role === "function") {
      const result = contentToText(message.content).trim();
      if (!result) throw new AnthropicBridgeError(400, "invalid_request_error", `messages[${messageIndex}].content must contain tool output.`);
      const label = message.role === "tool" ? "Tool result" : "Function result";
      messages.push({ role: "user", content: `[${label}]\n${result}` });
      continue;
    }
    if (message.role !== "user" && message.role !== "assistant") throw new AnthropicBridgeError(400, "invalid_request_error", `messages[${messageIndex}].role must be user or assistant.`);
    if (typeof message.content === "string") {
      messages.push({ role: message.role, content: message.content });
      continue;
    }
    if (!Array.isArray(message.content)) throw new AnthropicBridgeError(400, "invalid_request_error", `messages[${messageIndex}].content must be a string or content-block array.`);

    let text = "";
    const toolCalls: Array<{ id: string; type: "function"; function: { name: string; arguments: string } }> = [];
    const toolResults: Array<{ toolUseId: string; content: string }> = [];
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
        toolResults.push({ toolUseId, content: `${errorPrefix}${contentToText(block.content)}` });
      } else if (block.type === "thinking" || block.type === "redacted_thinking") {
        if (message.role !== "assistant") throw new AnthropicBridgeError(400, "invalid_request_error", `${String(block.type)} blocks require an assistant message.`);
        // OrcaRouter's OpenAI-compatible endpoint cannot verify Anthropic signatures. Do not forward
        // private reasoning summaries or encrypted thinking state as regular conversation content.
      } else if (block.type === "image" || block.type === "document") {
        throw new AnthropicBridgeError(400, "invalid_request_error", "This bridge supports text and tool blocks only; image and document blocks are not supported.");
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
      const glm53ToolHistory = model === "glm-5.3" && toolCalls.length > 0 && !canReplayPrivateGlmToolContinuation
        ? toolCalls.map(toolCall => `[Tool call: ${toolCall.function.name}]\n${toolCall.function.arguments}`).join("\n\n")
        : "";
      if (text || toolCalls.length > 0) {
        messages.push(canReplayPrivateGlmToolContinuation
          ? privateGlmToolContinuation!
          : model === "glm-5.3"
            ? { role: "assistant", content: [text, glm53ToolHistory].filter(Boolean).join("\n\n") }
            : { role: "assistant", content: text || null, ...(toolCalls.length > 0 ? { tool_calls: toolCalls } : {}) } as TokenForgeChatMessage);
      }
    } else {
      const canReplayPrivateGlmToolResults = model === "glm-5.3" && toolResults.length > 0
        && toolResults.every(result => privateGlmToolContinuations.has(result.toolUseId));
      if ((usesOpenAiNativeToolResults || canReplayPrivateGlmToolResults) && toolResults.length > 0) {
        for (const result of toolResults) {
          messages.push({ role: "tool", tool_call_id: result.toolUseId, content: result.content } as TokenForgeChatMessage);
        }
        if (text) messages.push({ role: "user", content: text });
        continue;
      }
      const content = [...toolResults.map(result => `[Tool Result for ${result.toolUseId}]:\n${result.content}`), text].filter(Boolean).join("\n\n").trim();
      if (!content) throw new AnthropicBridgeError(400, "invalid_request_error", `messages[${messageIndex}] must contain text or tool_result content.`);
      messages.push({ role: "user", content });
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
    // This bridge policy is deliberately model-scoped and not caller-configurable.
    ...(model === "kimi-k3" ? { reasoning_effort: "max" } : {}),
    ...(model === "claude-fable-5" ? { reasoning_effort: "xhigh" } : {}),
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

function estimateInputTokens(messages: TokenForgeChatMessage[]) {
  return messages.reduce((total, message) => total + Math.ceil((typeof message.content === "string" ? message.content : JSON.stringify(message.content ?? "")).length / 4) + 4, 0);
}

function usageFrom(payload: unknown): Usage {
  return payload && typeof payload === "object" ? ((payload as { usage?: Usage }).usage ?? {}) : {};
}

function normalizedTokens(usage: Usage, inputEstimate: number) {
  const inputTokens = Number(usage.prompt_tokens ?? usage.input_tokens ?? inputEstimate);
  const outputTokens = Number(usage.completion_tokens ?? usage.output_tokens ?? Math.max(0, Number(usage.total_tokens ?? inputTokens) - inputTokens));
  return { inputTokens, outputTokens };
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

export function translateOpenAiMessageResponse(model: string, payload: unknown) {
  const response = payload as { id?: unknown; choices?: Array<{ finish_reason?: unknown; message?: { content?: unknown; tool_calls?: Array<{ id?: unknown; function?: { name?: unknown; arguments?: unknown } }> } }>; usage?: Usage };
  const choice = response?.choices?.[0];
  if (!choice?.message) throw new AnthropicBridgeError(503, "api_error", "The selected provider returned an invalid response.");
  const content: Array<Record<string, unknown>> = [];
  if (typeof choice.message.content === "string" && choice.message.content) content.push({ type: "text", text: choice.message.content });
  for (const toolCall of choice.message.tool_calls ?? []) {
    if (typeof toolCall.id !== "string" || typeof toolCall.function?.name !== "string") continue;
    let input: unknown = {};
    if (typeof toolCall.function.arguments === "string") {
      try { input = JSON.parse(toolCall.function.arguments); } catch { input = {}; }
    }
    content.push({ type: "tool_use", id: toolCall.id, name: toolCall.function.name, input });
  }
  const tokens = normalizedTokens(usageFrom(response), 0);
  return { id: typeof response.id === "string" ? response.id : `msg_${randomUUID().replaceAll("-", "")}`, type: "message", role: "assistant", model, content, stop_reason: toStopReason(choice.finish_reason), stop_sequence: null, usage: { input_tokens: tokens.inputTokens, output_tokens: tokens.outputTokens } };
}

function writeSse(res: Response, event: string, payload: unknown) {
  res.write(`event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`);
}

function nativeTokenRouterResponse(model: TokenForgeModelId, payload: unknown) {
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

  const ipHash = tokenForgeRequestIpHash(req);
  const quota = await getQuotaStatus(key.userId);
  if (!quota) return respondError(res, requestId, 503, "api_error", "Account status is temporarily unavailable. Retry shortly.");
  if (quota.suspended) return respondError(res, requestId, 403, "permission_error", "This account is currently suspended.");

  const estimatedInputTokens = estimateNativeAnthropicInputTokens(input);
  const reservedNanos = calculateCreditChargeNanos(model, estimatedInputTokens, normalizedBillableMaxOutputTokens(input.max_tokens));
  const reservation = await reserveCredit(key.userId, reservedNanos, requestId);
  if (!reservation.authorized) return respondError(res, requestId, 402, "permission_error", "Your TokenForge promotional credit balance cannot cover this request’s maximum estimated cost.");

  const aborter = new AbortController();
  const timeout = setTimeout(() => aborter.abort(), providerResponseStartTimeoutMs(model));
  let upstream: globalThis.Response;
  try {
    upstream = await forwardTokenRouterAnthropicMessagesRequest(input, aborter.signal, req.header("anthropic-beta")?.trim());
  } catch (error) {
    clearTimeout(timeout);
    await settleReservedCredit({ userId: key.userId, requestId, reservedNanos, finalChargeNanos: 0, releaseReason: "Native TokenRouter Messages provider request did not complete" });
    await recordUsage({ requestId, userId: key.userId, apiKeyId: key.id, modelId: model, source: "api", stream: Boolean(input.stream), status: "provider_error", sourceIpHash: ipHash });
    return respondError(res, requestId, 503, "api_error", error instanceof Error && error.name === "AbortError" ? "The selected provider timed out. Retry this request." : "The selected provider is temporarily unavailable.");
  }
  if (!upstream.ok) {
    clearTimeout(timeout);
    await settleReservedCredit({ userId: key.userId, requestId, reservedNanos, finalChargeNanos: 0, releaseReason: "Native TokenRouter Messages provider returned an error" });
    await recordUsage({ requestId, userId: key.userId, apiKeyId: key.id, modelId: model, source: "api", stream: Boolean(input.stream), status: "provider_error", sourceIpHash: ipHash });
    const status = publicProviderFailureStatus(upstream.status);
    const message = status === 503 && (upstream.status === 401 || upstream.status === 403)
      ? "The selected provider temporarily denied this request after secure credential failover. Retry shortly or choose another model."
      : "The selected provider could not process this request.";
    return respondError(res, requestId, status, "api_error", message);
  }
  await touchApiKey(key.id);

  if (!input.stream) {
    clearTimeout(timeout);
    const payload = await upstream.json().catch(() => null);
    const response = nativeTokenRouterResponse(model, payload);
    if (!response) {
      await settleReservedCredit({ userId: key.userId, requestId, reservedNanos, finalChargeNanos: 0, releaseReason: "Native TokenRouter Messages provider returned an invalid response" });
      await recordUsage({ requestId, userId: key.userId, apiKeyId: key.id, modelId: model, source: "api", stream: false, status: "provider_error", sourceIpHash: ipHash });
      return respondError(res, requestId, 503, "api_error", "The selected provider returned an invalid response.");
    }
    const tokens = normalizedTokens(usageFrom(response), estimatedInputTokens);
    const chargeNanos = calculateCreditChargeNanos(model, tokens.inputTokens, tokens.outputTokens);
    const settlement = await settleReservedCredit({ userId: key.userId, requestId, reservedNanos, finalChargeNanos: chargeNanos });
    await recordUsage({ requestId, userId: key.userId, apiKeyId: key.id, modelId: model, source: "api", stream: false, status: "success", ...tokens, chargeNanos: settlement.chargedNanos, sourceIpHash: ipHash });
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
    await settleReservedCredit({ userId: key.userId, requestId, reservedNanos, finalChargeNanos: 0, releaseReason: "Native TokenRouter Messages provider returned an empty stream" });
    return res.end();
  }
  const decoder = new TextDecoder();
  let buffer = "";
  let usage: Usage = {};
  let failed = false;
  res.on("close", () => { if (!res.writableEnded) aborter.abort(); });
  try {
    while (true) {
      const next = await reader.read();
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
          const event = JSON.parse(serialized) as { type?: unknown; message?: { model?: unknown; usage?: Usage }; usage?: Usage };
          if (event.type === "error") failed = true;
          usage = { ...usage, ...(event.message?.usage ?? {}), ...(event.usage ?? {}) };
          if (event.type === "message_start" && event.message) event.message.model = model;
          res.write(`data: ${JSON.stringify(event)}\n`);
        } catch {
          res.write(`${sourceLine}\n`);
        }
      }
    }
    if (buffer) res.write(`${buffer}\n`);
  } catch {
    failed = true;
  } finally {
    clearTimeout(timeout);
    const tokens = normalizedTokens(usage, estimatedInputTokens);
    const chargeNanos = failed ? 0 : calculateCreditChargeNanos(model, tokens.inputTokens, tokens.outputTokens);
    const settlement = await settleReservedCredit({ userId: key.userId, requestId, reservedNanos, finalChargeNanos: chargeNanos, ...(failed ? { releaseReason: "Native TokenRouter Messages stream did not complete" } : {}) });
    await recordUsage({ requestId, userId: key.userId, apiKeyId: key.id, modelId: model, source: "api", stream: true, status: failed ? "provider_error" : "success", ...tokens, chargeNanos: settlement.chargedNanos, sourceIpHash: ipHash });
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
    if ((await getPlatformMaintenanceConfig()).enabled) {
      return respondError(res, requestId, 503, "overloaded_error", PLATFORM_MAINTENANCE_ERROR_MESSAGE);
    }

    const raw = (req.body ?? {}) as AnthropicRequest;
    let input: TokenForgeChatInput;
    try {
      const privateGlmToolContinuations = raw.model === "glm-5.3"
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

    const ipHash = tokenForgeRequestIpHash(req);
    const quota = await getQuotaStatus(key.userId);
    if (!quota) return respondError(res, requestId, 503, "api_error", "Account status is temporarily unavailable. Retry shortly.");
    if (quota.suspended) return respondError(res, requestId, 403, "permission_error", "This account is currently suspended.");

    const estimatedInputTokens = estimateInputTokens(upstreamInput.messages ?? []);
    const reservedNanos = calculateCreditChargeNanos(model, estimatedInputTokens, normalizedBillableMaxOutputTokens(upstreamInput.max_tokens));
    const reservation = await reserveCredit(key.userId, reservedNanos, requestId);
    if (!reservation.authorized) return respondError(res, requestId, 402, "permission_error", "Your TokenForge promotional credit balance cannot cover this request’s maximum estimated cost.");

    const aborter = new AbortController();
    const timeout = setTimeout(() => aborter.abort(), providerResponseStartTimeoutMs(model));
    let upstream: globalThis.Response;
    try {
      upstream = await forwardProviderRequest(model, upstreamInput, aborter.signal, { userId: key.userId });
    } catch (error) {
      clearTimeout(timeout);
      await settleReservedCredit({ userId: key.userId, requestId, reservedNanos, finalChargeNanos: 0, releaseReason: "Anthropic Messages provider request did not complete" });
      await recordUsage({ requestId, userId: key.userId, apiKeyId: key.id, modelId: model, source: "api", stream: Boolean(input.stream), status: "provider_error", sourceIpHash: ipHash });
      return respondError(res, requestId, 503, "api_error", publicProviderErrorMessage());
    }
    // The upstream accepted the request and returned headers; retain only the hosting request ceiling for body/SSE completion.
    clearTimeout(timeout);
    if (!upstream.ok) {
      const payload = await upstream.json().catch(() => null);
      await settleReservedCredit({ userId: key.userId, requestId, reservedNanos, finalChargeNanos: 0, releaseReason: "Anthropic Messages provider returned an error" });
      await recordUsage({ requestId, userId: key.userId, apiKeyId: key.id, modelId: model, source: "api", stream: Boolean(input.stream), status: "provider_error", sourceIpHash: ipHash });
      const status = publicProviderFailureStatus(upstream.status);
      return respondError(res, requestId, status, "api_error", publicProviderErrorMessage(upstream.status));
    }
    await touchApiKey(key.id);

    if (!input.stream) {
      clearTimeout(timeout);
      const payload = await upstream.json().catch(() => null);
      if (!payload || (model === "claude-opus-5" && isClaudeOpus5ZeroOutputFailure(payload))) {
        await settleReservedCredit({ userId: key.userId, requestId, reservedNanos, finalChargeNanos: 0, releaseReason: "Anthropic Messages provider returned an invalid response" });
        await recordUsage({ requestId, userId: key.userId, apiKeyId: key.id, modelId: model, source: "api", stream: false, status: "provider_error", sourceIpHash: ipHash });
        return respondError(res, requestId, 503, "api_error", publicProviderErrorMessage());
      }
      try {
        const response = translateOpenAiMessageResponse(model, sanitizeModelResponsePayload(model, payload));
        if (model === "glm-5.3") {
          try { await capturePrivateGlmToolContinuation(key.userId, payload); } catch (error) { console.warn("[GLM continuation] Private state could not be stored:", error); }
        }
        const tokens = normalizedTokens(usageFrom(payload), estimatedInputTokens);
        const chargeNanos = calculateCreditChargeNanos(model, tokens.inputTokens, tokens.outputTokens);
        const settlement = await settleReservedCredit({ userId: key.userId, requestId, reservedNanos, finalChargeNanos: chargeNanos });
        await recordUsage({ requestId, userId: key.userId, apiKeyId: key.id, modelId: model, source: "api", stream: false, status: "success", ...tokens, chargeNanos: settlement.chargedNanos, sourceIpHash: ipHash });
        res.setHeader("request-id", requestId);
        res.setHeader("x-request-id", requestId);
        res.setHeader("x-tokenforge-credit-balance", String(settlement.balanceNanos));
        res.setHeader("x-tokenforge-credit-charge", String(settlement.chargedNanos));
        return res.status(200).json(response);
      } catch (error) {
        await settleReservedCredit({ userId: key.userId, requestId, reservedNanos, finalChargeNanos: 0, releaseReason: "Anthropic Messages response translation failed" });
        await recordUsage({ requestId, userId: key.userId, apiKeyId: key.id, modelId: model, source: "api", stream: false, status: "provider_error", sourceIpHash: ipHash });
        return respondError(res, requestId, 503, "api_error", publicProviderErrorMessage());
      }
    }

    res.status(200);
    res.setHeader("request-id", requestId);
    res.setHeader("x-request-id", requestId);
    res.setHeader("content-type", "text/event-stream; charset=utf-8");
    res.setHeader("cache-control", "no-cache, no-transform");
    res.setHeader("connection", "keep-alive");
    res.flushHeaders();

    writeSse(res, "message_start", { type: "message_start", message: { id: `msg_${randomUUID().replaceAll("-", "")}`, type: "message", role: "assistant", content: [], model, stop_reason: null, stop_sequence: null, usage: { input_tokens: 0, output_tokens: 0 } } });

    const reader = upstream.body?.getReader();
    if (!reader) {
      clearTimeout(timeout);
      await settleReservedCredit({ userId: key.userId, requestId, reservedNanos, finalChargeNanos: 0, releaseReason: "Anthropic Messages provider returned an empty stream" });
      return res.end();
    }
    const decoder = new TextDecoder();
    let buffer = "";
    let usage: Usage = {};
    let failed = false;
    let stopped = false;
    let textIndex: number | null = null;
    let nextIndex = 0;
    const toolIndexes = new Map<number, number>();
    const glmStreamToolCalls = new Map<number, { id?: string; name?: string; arguments: string }>();
    let glmStreamReasoning = "";
    let glmStreamText = "";
    const finish = (reason: string = "end_turn") => {
      if (stopped) return;
      stopped = true;
      if (textIndex !== null) writeSse(res, "content_block_stop", { type: "content_block_stop", index: textIndex });
      toolIndexes.forEach(index => writeSse(res, "content_block_stop", { type: "content_block_stop", index }));
      writeSse(res, "message_delta", { type: "message_delta", delta: { stop_reason: reason, stop_sequence: null }, usage: { output_tokens: Number(usage.completion_tokens ?? usage.output_tokens ?? 0) } });
      writeSse(res, "message_stop", { type: "message_stop" });
    };
    res.on("close", () => { if (!res.writableEnded) aborter.abort(); });
    try {
      while (true) {
        const next = await reader.read();
        if (next.done) break;
        buffer += decoder.decode(next.value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const sourceLine of lines) {
          const line = sourceLine.trim();
          if (!line.startsWith("data:")) continue;
          const serialized = line.slice(5).trim();
          if (!serialized) continue;
          if (serialized === "[DONE]") { finish(); continue; }
          let event: { choices?: Array<{ delta?: { content?: unknown; reasoning_content?: unknown; tool_calls?: Array<{ index?: unknown; id?: unknown; function?: { name?: unknown; arguments?: unknown } }> }; finish_reason?: unknown }>; usage?: Usage; error?: unknown };
          try { event = JSON.parse(serialized); } catch { continue; }
          if (event.error) {
            failed = true;
            writeSse(res, "error", { type: "error", error: { type: "api_error", message: publicProviderErrorMessage() } });
            finish();
            continue;
          }
          usage = { ...usage, ...usageFrom(event) };
          const choice = event.choices?.[0];
          const delta = choice?.delta;
          if (typeof delta?.content === "string" && delta.content) {
            if (model === "glm-5.3") glmStreamText += delta.content;
            if (textIndex === null) {
              textIndex = nextIndex++;
              writeSse(res, "content_block_start", { type: "content_block_start", index: textIndex, content_block: { type: "text", text: "" } });
            }
            writeSse(res, "content_block_delta", { type: "content_block_delta", index: textIndex, delta: { type: "text_delta", text: delta.content } });
          }
          for (const toolCall of delta?.tool_calls ?? []) {
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
          if (model === "glm-5.3" && typeof delta?.reasoning_content === "string") glmStreamReasoning += delta.reasoning_content;
          if (choice?.finish_reason) finish(toStopReason(choice.finish_reason));
        }
      }
      finish();
    } catch {
      failed = true;
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
      const tokens = normalizedTokens(usage, estimatedInputTokens);
      const chargeNanos = failed ? 0 : calculateCreditChargeNanos(model, tokens.inputTokens, tokens.outputTokens);
      const settlement = await settleReservedCredit({ userId: key.userId, requestId, reservedNanos, finalChargeNanos: chargeNanos, releaseReason: failed ? "Anthropic Messages stream was cancelled" : undefined });
      await recordUsage({ requestId, userId: key.userId, apiKeyId: key.id, modelId: model, source: "api", stream: true, status: failed ? "cancelled" : "success", ...tokens, chargeNanos: settlement.chargedNanos, sourceIpHash: ipHash });
      res.end();
    }
  });
}
