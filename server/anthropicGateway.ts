import type { Express, Request, Response } from "express";
import { randomUUID } from "node:crypto";
import {
  findActiveApiKey,
  getQuotaStatus,
  getRecentRequestCounts,
  isModelAvailable,
  recordUsage,
  reserveCredit,
  settleReservedCredit,
  touchApiKey,
} from "./db";
import { raiseOperationalAlert } from "./operationalAlerts";
import { calculateCreditChargeNanos, normalizedBillableMaxOutputTokens } from "./creditPricing";
import {
  forwardProviderRequest,
  tokenForgeRateHeaders,
  tokenForgeRequestIpHash,
  type TokenForgeChatInput,
  type TokenForgeChatMessage,
} from "./openaiGateway";
import { CLUSTER_PROTOCOL_PROVIDER_SLUG, getTokenForgeProviderSlug, isTokenForgeModelId, type TokenForgeModelId } from "./modelCatalogue";

const RATE_WINDOW_SECONDS = 60;
const ACCOUNT_RATE_LIMIT_PER_MINUTE = 20;
const IP_RATE_LIMIT_PER_MINUTE = 40;
const PROVIDER_TIMEOUT_MS = 110_000;
const activeRequests = new Map<number, number>();

type Usage = { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number; input_tokens?: number; output_tokens?: number };
type AnthropicRequest = { model?: unknown; messages?: unknown; system?: unknown; tools?: unknown; stream?: unknown; max_tokens?: unknown; temperature?: unknown };
type AnthropicBlock = { type?: unknown; text?: unknown; id?: unknown; name?: unknown; input?: unknown; tool_use_id?: unknown; content?: unknown; is_error?: unknown };

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

export function translateAnthropicRequest(raw: AnthropicRequest): TokenForgeChatInput {
  if (typeof raw.model !== "string" || !raw.model.trim()) {
    throw new AnthropicBridgeError(400, "invalid_request_error", "model must be a non-empty TokenForge Cluster Protocol model identifier.");
  }
  if (!isTokenForgeModelId(raw.model) || getTokenForgeProviderSlug(raw.model) !== CLUSTER_PROTOCOL_PROVIDER_SLUG) {
    throw new AnthropicBridgeError(400, "invalid_request_error", "The Anthropic Messages endpoint supports only TokenForge Cluster Protocol models.");
  }
  if (!Array.isArray(raw.messages) || raw.messages.length < 1 || raw.messages.length > 100) {
    throw new AnthropicBridgeError(400, "invalid_request_error", "messages must contain between 1 and 100 entries.");
  }
  if (raw.stream !== undefined && typeof raw.stream !== "boolean") throw new AnthropicBridgeError(400, "invalid_request_error", "stream must be a Boolean.");
  if (raw.max_tokens !== undefined && (!Number.isInteger(raw.max_tokens) || Number(raw.max_tokens) < 1 || Number(raw.max_tokens) > 32_768)) {
    throw new AnthropicBridgeError(400, "invalid_request_error", "max_tokens must be an integer between 1 and 32768.");
  }
  if (raw.temperature !== undefined && (typeof raw.temperature !== "number" || !Number.isFinite(raw.temperature) || raw.temperature < 0 || raw.temperature > 2)) {
    throw new AnthropicBridgeError(400, "invalid_request_error", "temperature must be a number from 0 to 2.");
  }
  const model = raw.model as string;
  const maxTokens = typeof raw.max_tokens === "number" ? raw.max_tokens : undefined;
  const temperature = typeof raw.temperature === "number" ? raw.temperature : undefined;

  const messages: TokenForgeChatMessage[] = [];
  if (raw.system !== undefined) messages.push({ role: "system", content: systemToText(raw.system) });
  for (let messageIndex = 0; messageIndex < raw.messages.length; messageIndex += 1) {
    const candidate = raw.messages[messageIndex];
    if (!candidate || typeof candidate !== "object") throw new AnthropicBridgeError(400, "invalid_request_error", `messages[${messageIndex}] must be an object.`);
    const message = candidate as { role?: unknown; content?: unknown };
    if (message.role !== "user" && message.role !== "assistant") throw new AnthropicBridgeError(400, "invalid_request_error", `messages[${messageIndex}].role must be user or assistant.`);
    if (typeof message.content === "string") {
      messages.push({ role: message.role, content: message.content });
      continue;
    }
    if (!Array.isArray(message.content)) throw new AnthropicBridgeError(400, "invalid_request_error", `messages[${messageIndex}].content must be a string or content-block array.`);

    let text = "";
    const toolCalls: Array<{ id: string; type: "function"; function: { name: string; arguments: string } }> = [];
    const toolResults: string[] = [];
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
        toolResults.push(`[Tool Result for ${toolUseId}]:\n${errorPrefix}${contentToText(block.content)}`);
      } else if (block.type === "image" || block.type === "document") {
        throw new AnthropicBridgeError(400, "invalid_request_error", "This bridge supports text and tool blocks only; image and document blocks are not supported.");
      } else {
        throw new AnthropicBridgeError(400, "invalid_request_error", `Unsupported content block at messages[${messageIndex}].content[${blockIndex}].`);
      }
    }
    if (message.role === "assistant") {
      messages.push({ role: "assistant", content: text || null, ...(toolCalls.length > 0 ? { tool_calls: toolCalls } : {}) } as TokenForgeChatMessage);
    } else {
      const content = [...toolResults, text].filter(Boolean).join("\n\n").trim();
      if (!content) throw new AnthropicBridgeError(400, "invalid_request_error", `messages[${messageIndex}] must contain text or tool_result content.`);
      messages.push({ role: "user", content });
    }
  }

  const translated: TokenForgeChatInput = { model, messages, stream: raw.stream === true, ...(maxTokens !== undefined ? { max_tokens: maxTokens } : {}), ...(temperature !== undefined ? { temperature } : {}) };
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

function reserveSlot(userId: number, limit: number) {
  const active = activeRequests.get(userId) ?? 0;
  if (active >= limit) return false;
  activeRequests.set(userId, active + 1);
  return true;
}

function releaseSlot(userId: number) {
  const next = (activeRequests.get(userId) ?? 1) - 1;
  if (next <= 0) activeRequests.delete(userId);
  else activeRequests.set(userId, next);
}

function toStopReason(reason: unknown) {
  if (reason === "tool_calls") return "tool_use";
  if (reason === "length") return "max_tokens";
  return "end_turn";
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

export function registerAnthropicMessagesGateway(app: Express) {
  app.post("/v1/messages", async (req: Request, res: Response) => {
    const requestId = `tf_msg_${randomUUID().replaceAll("-", "")}`;
    const secret = anthropicApiKey(req);
    if (!secret) return respondError(res, requestId, 401, "authentication_error", "Send a TokenForge key using the x-api-key or Bearer authorization header.");
    const key = await findActiveApiKey(secret);
    if (!key) return respondError(res, requestId, 401, "authentication_error", "The supplied TokenForge key is missing, invalid, or revoked.");

    let input: TokenForgeChatInput;
    try {
      input = translateAnthropicRequest((req.body ?? {}) as AnthropicRequest);
    } catch (error) {
      return error instanceof AnthropicBridgeError
        ? respondError(res, requestId, error.status, error.type, error.message)
        : respondError(res, requestId, 400, "invalid_request_error", "The Messages request could not be processed.");
    }
    const model = input.model as TokenForgeModelId;
    if (!(await isModelAvailable(model))) return respondError(res, requestId, 503, "api_error", "The requested model is temporarily unavailable. Retry shortly or choose another Cluster Protocol model.");

    const ipHash = tokenForgeRequestIpHash(req);
    const quota = await getQuotaStatus(key.userId);
    if (!quota) return respondError(res, requestId, 503, "api_error", "Quota state is temporarily unavailable. Retry shortly.");
    const rateHeaders = tokenForgeRateHeaders(ACCOUNT_RATE_LIMIT_PER_MINUTE, ACCOUNT_RATE_LIMIT_PER_MINUTE);
    if (quota.suspended) return respondError(res, requestId, 403, "permission_error", "This account is currently suspended.", rateHeaders);
    const recent = await getRecentRequestCounts(key.userId, ipHash, new Date(Date.now() - RATE_WINDOW_SECONDS * 1_000));
    if (recent.account >= ACCOUNT_RATE_LIMIT_PER_MINUTE || recent.ip >= IP_RATE_LIMIT_PER_MINUTE) {
      void raiseOperationalAlert("rate_circuit", { userId: key.userId, requestId, reason: "Anthropic Messages per-minute account or source-IP rate threshold exceeded" });
      return respondError(res, requestId, 429, "rate_limit_error", "Rate limit reached. Slow down briefly and retry.", { ...tokenForgeRateHeaders(ACCOUNT_RATE_LIMIT_PER_MINUTE, ACCOUNT_RATE_LIMIT_PER_MINUTE - recent.account), "retry-after": RATE_WINDOW_SECONDS });
    }

    const estimatedInputTokens = estimateInputTokens(input.messages ?? []);
    const reservedNanos = calculateCreditChargeNanos(model, estimatedInputTokens, normalizedBillableMaxOutputTokens(input.max_tokens));
    const reservation = await reserveCredit(key.userId, reservedNanos, requestId);
    if (!reservation.authorized) return respondError(res, requestId, 402, "permission_error", "Your TokenForge promotional credit balance cannot cover this request’s maximum estimated cost.", rateHeaders);
    if (!reserveSlot(key.userId, quota.maxConcurrentRequests)) {
      await settleReservedCredit({ userId: key.userId, requestId, reservedNanos, finalChargeNanos: 0, releaseReason: "Anthropic Messages request was not started because the concurrency limit was reached" });
      return respondError(res, requestId, 429, "rate_limit_error", "This account has reached its concurrent-request limit. Wait for an active request to finish.", { ...rateHeaders, "retry-after": 5 });
    }

    const aborter = new AbortController();
    const timeout = setTimeout(() => aborter.abort(), PROVIDER_TIMEOUT_MS);
    let upstream: globalThis.Response;
    try {
      upstream = await forwardProviderRequest(model, input, aborter.signal);
    } catch (error) {
      clearTimeout(timeout);
      releaseSlot(key.userId);
      await settleReservedCredit({ userId: key.userId, requestId, reservedNanos, finalChargeNanos: 0, releaseReason: "Anthropic Messages provider request did not complete" });
      await recordUsage({ requestId, userId: key.userId, apiKeyId: key.id, modelId: model, source: "api", stream: Boolean(input.stream), status: "provider_error", sourceIpHash: ipHash });
      return respondError(res, requestId, 503, "api_error", error instanceof Error && error.name === "AbortError" ? "The selected provider timed out. Retry this request." : "The selected provider is temporarily unavailable.", rateHeaders);
    }
    if (!upstream.ok) {
      clearTimeout(timeout);
      releaseSlot(key.userId);
      await settleReservedCredit({ userId: key.userId, requestId, reservedNanos, finalChargeNanos: 0, releaseReason: "Anthropic Messages provider returned an error" });
      await recordUsage({ requestId, userId: key.userId, apiKeyId: key.id, modelId: model, source: "api", stream: Boolean(input.stream), status: "provider_error", sourceIpHash: ipHash });
      return respondError(res, requestId, upstream.status >= 500 ? 503 : upstream.status, "api_error", "The selected provider could not process this request.", rateHeaders);
    }
    await touchApiKey(key.id);

    if (!input.stream) {
      clearTimeout(timeout);
      const payload = await upstream.json().catch(() => null);
      if (!payload) {
        releaseSlot(key.userId);
        await settleReservedCredit({ userId: key.userId, requestId, reservedNanos, finalChargeNanos: 0, releaseReason: "Anthropic Messages provider returned an invalid response" });
        await recordUsage({ requestId, userId: key.userId, apiKeyId: key.id, modelId: model, source: "api", stream: false, status: "provider_error", sourceIpHash: ipHash });
        return respondError(res, requestId, 503, "api_error", "The selected provider returned an invalid response.", rateHeaders);
      }
      try {
        const response = translateOpenAiMessageResponse(model, payload);
        const tokens = normalizedTokens(usageFrom(payload), estimatedInputTokens);
        const chargeNanos = calculateCreditChargeNanos(model, tokens.inputTokens, tokens.outputTokens);
        const settlement = await settleReservedCredit({ userId: key.userId, requestId, reservedNanos, finalChargeNanos: chargeNanos });
        await recordUsage({ requestId, userId: key.userId, apiKeyId: key.id, modelId: model, source: "api", stream: false, status: "success", ...tokens, chargeNanos: settlement.chargedNanos, sourceIpHash: ipHash });
        releaseSlot(key.userId);
        res.setHeader("request-id", requestId);
        res.setHeader("x-request-id", requestId);
        res.setHeader("x-tokenforge-credit-balance", String(settlement.balanceNanos));
        res.setHeader("x-tokenforge-credit-charge", String(settlement.chargedNanos));
        for (const [name, value] of Object.entries(tokenForgeRateHeaders(quota.requestLimit, quota.remainingRequests - 1))) res.setHeader(name, String(value));
        return res.status(200).json(response);
      } catch (error) {
        releaseSlot(key.userId);
        await settleReservedCredit({ userId: key.userId, requestId, reservedNanos, finalChargeNanos: 0, releaseReason: "Anthropic Messages response translation failed" });
        await recordUsage({ requestId, userId: key.userId, apiKeyId: key.id, modelId: model, source: "api", stream: false, status: "provider_error", sourceIpHash: ipHash });
        return respondError(res, requestId, 503, "api_error", error instanceof Error ? error.message : "The selected provider returned an invalid response.", rateHeaders);
      }
    }

    res.status(200);
    res.setHeader("request-id", requestId);
    res.setHeader("x-request-id", requestId);
    res.setHeader("content-type", "text/event-stream; charset=utf-8");
    res.setHeader("cache-control", "no-cache, no-transform");
    res.setHeader("connection", "keep-alive");
    for (const [name, value] of Object.entries(tokenForgeRateHeaders(quota.requestLimit, quota.remainingRequests - 1))) res.setHeader(name, String(value));
    res.flushHeaders();
    writeSse(res, "message_start", { type: "message_start", message: { id: `msg_${randomUUID().replaceAll("-", "")}`, type: "message", role: "assistant", content: [], model, stop_reason: null, stop_sequence: null, usage: { input_tokens: 0, output_tokens: 0 } } });

    const reader = upstream.body?.getReader();
    if (!reader) {
      clearTimeout(timeout);
      releaseSlot(key.userId);
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
          let event: { choices?: Array<{ delta?: { content?: unknown; tool_calls?: Array<{ index?: unknown; id?: unknown; function?: { name?: unknown; arguments?: unknown } }> }; finish_reason?: unknown }>; usage?: Usage; error?: unknown };
          try { event = JSON.parse(serialized); } catch { continue; }
          if (event.error) {
            failed = true;
            writeSse(res, "error", { type: "error", error: { type: "api_error", message: "The selected provider could not process this request." } });
            finish();
            continue;
          }
          usage = { ...usage, ...usageFrom(event) };
          const choice = event.choices?.[0];
          const delta = choice?.delta;
          if (typeof delta?.content === "string" && delta.content) {
            if (textIndex === null) {
              textIndex = nextIndex++;
              writeSse(res, "content_block_start", { type: "content_block_start", index: textIndex, content_block: { type: "text", text: "" } });
            }
            writeSse(res, "content_block_delta", { type: "content_block_delta", index: textIndex, delta: { type: "text_delta", text: delta.content } });
          }
          for (const toolCall of delta?.tool_calls ?? []) {
            const upstreamIndex = typeof toolCall.index === "number" ? toolCall.index : toolIndexes.size;
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
          if (choice?.finish_reason) finish(toStopReason(choice.finish_reason));
        }
      }
      finish();
    } catch {
      failed = true;
    } finally {
      clearTimeout(timeout);
      const tokens = normalizedTokens(usage, estimatedInputTokens);
      const chargeNanos = failed ? 0 : calculateCreditChargeNanos(model, tokens.inputTokens, tokens.outputTokens);
      const settlement = await settleReservedCredit({ userId: key.userId, requestId, reservedNanos, finalChargeNanos: chargeNanos, releaseReason: failed ? "Anthropic Messages stream was cancelled" : undefined });
      await recordUsage({ requestId, userId: key.userId, apiKeyId: key.id, modelId: model, source: "api", stream: true, status: failed ? "cancelled" : "success", ...tokens, chargeNanos: settlement.chargedNanos, sourceIpHash: ipHash });
      releaseSlot(key.userId);
      res.end();
    }
  });
}
