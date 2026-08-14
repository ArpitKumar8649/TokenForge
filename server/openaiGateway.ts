import type { Express, Request, Response } from "express";
import { createHash, createHmac, randomUUID } from "node:crypto";
import {
  findActiveApiKey,
  getQuotaStatus,
  getRecentRequestCounts,
  isModelAvailable,
  recordUsage,
  touchApiKey,
} from "./db";
import { raiseOperationalAlert } from "./operationalAlerts";

export const TOKENFORGE_CATALOGUE = [
  {
    id: "glm-5.2",
    object: "model",
    created: 0,
    owned_by: "tokenforge",
    capabilities: ["reasoning", "long_context", "streaming", "coding"],
  },
  {
    id: "grok-4.5",
    object: "model",
    created: 0,
    owned_by: "tokenforge",
    capabilities: ["reasoning", "agentic", "coding", "streaming"],
  },
] as const;

const MODELS = new Set<string>(TOKENFORGE_CATALOGUE.map(model => model.id));
const ACCOUNT_RATE_LIMIT_PER_MINUTE = 20;
const IP_RATE_LIMIT_PER_MINUTE = 40;
const RATE_WINDOW_SECONDS = 60;
const PROVIDER_TIMEOUT_MS = 110_000;
const activeRequests = new Map<number, number>();

export type TokenForgeChatMessage = { role?: string; content?: unknown };
type ChatMessage = TokenForgeChatMessage;
type ChatInput = { model?: string; messages?: ChatMessage[]; stream?: boolean; max_tokens?: number; [key: string]: unknown };
type Usage = { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };

type PlaygroundFailureCode = "model_not_found" | "model_unavailable" | "invalid_messages" | "account_suspended" | "quota_exceeded" | "rate_limited" | "provider_unavailable";

export class TokenForgePlaygroundError extends Error {
  constructor(public readonly code: PlaygroundFailureCode, message: string) {
    super(message);
    this.name = "TokenForgePlaygroundError";
  }
}

function errorResponse(res: Response, requestId: string, status: number, message: string, code: string, headers?: Record<string, string | number>) {
  res.setHeader("x-request-id", requestId);
  for (const [key, value] of Object.entries(headers ?? {})) res.setHeader(key, String(value));
  return res.status(status).json(tokenForgeErrorBody(status, message, code));
}

function bearer(req: Request) {
  const value = req.header("authorization");
  return value?.startsWith("Bearer ") ? value.slice(7).trim() : null;
}

export function tokenForgeRequestIpHash(req: Pick<Request, "header" | "ip">) {
  const forwarded = req.header("x-forwarded-for")?.split(",")[0]?.trim();
  const ip = forwarded || req.ip || "unknown";
  return createHmac("sha256", process.env.JWT_SECRET ?? "tokenforge-local-ip-salt").update(ip).digest("hex");
}

export function tokenForgeRateHeaders(limit: number, remaining: number) {
  const reset = Math.ceil(Date.now() / 1000) + RATE_WINDOW_SECONDS;
  return {
    "x-ratelimit-limit": limit,
    "x-ratelimit-remaining": Math.max(0, remaining),
    "x-ratelimit-reset": reset,
  };
}

export function tokenForgeErrorBody(status: number, message: string, code: string) {
  return { error: { message, type: status === 429 ? "rate_limit_error" : "invalid_request_error", param: null, code } };
}

function estimateInputTokens(messages: ChatMessage[]) {
  return messages.reduce((total, message) => {
    const content = typeof message.content === "string" ? message.content : JSON.stringify(message.content ?? "");
    return total + Math.ceil(content.length / 4) + 4;
  }, 0);
}

function usageFrom(payload: unknown): Usage {
  if (!payload || typeof payload !== "object") return {};
  const candidate = (payload as { usage?: Usage }).usage;
  return candidate ?? {};
}

function normalizedTokens(usage: Usage, inputEstimate: number) {
  const inputTokens = Number(usage.prompt_tokens ?? inputEstimate);
  const outputTokens = Number(usage.completion_tokens ?? Math.max(0, Number(usage.total_tokens ?? inputTokens) - inputTokens));
  return { inputTokens, outputTokens };
}

function acquireRequestSlot(userId: number, maxConcurrentRequests: number) {
  const inFlight = activeRequests.get(userId) ?? 0;
  if (inFlight >= maxConcurrentRequests) return false;
  activeRequests.set(userId, inFlight + 1);
  return true;
}

function releaseRequestSlot(userId: number) {
  const next = (activeRequests.get(userId) ?? 1) - 1;
  if (next <= 0) activeRequests.delete(userId);
  else activeRequests.set(userId, next);
}

async function forwardRequest(input: ChatInput, signal: AbortSignal) {
  const base = process.env.FXQIDIAN_BASE_URL?.replace(/\/$/, "");
  const secret = process.env.FXQIDIAN_API_KEY;
  if (!base || !secret) throw new Error("TokenForge inference is not configured");
  return fetch(`${base}/v1/chat/completions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/json", Accept: input.stream ? "text/event-stream" : "application/json" },
    body: JSON.stringify(input),
    signal,
  });
}

function upstreamError(payload: unknown) {
  if (payload && typeof payload === "object" && "error" in payload) {
    const error = (payload as { error?: { message?: string } }).error;
    return error?.message ?? "The selected provider could not process this request";
  }
  return "The selected provider could not process this request";
}

function textContentFrom(payload: unknown) {
  if (!payload || typeof payload !== "object") return null;
  const choices = (payload as { choices?: unknown }).choices;
  if (!Array.isArray(choices)) return null;
  const content = (choices[0] as { message?: { content?: unknown } } | undefined)?.message?.content;
  return typeof content === "string" && content.trim() ? content : null;
}

/** Runs a dashboard turn through the server-side provider without exposing its credential to the browser. */
export async function runPlaygroundCompletion(input: {
  userId: number;
  model: "glm-5.2" | "grok-4.5";
  messages: TokenForgeChatMessage[];
  sourceIpHash: string;
}) {
  const requestId = `tf_pg_${randomUUID().replaceAll("-", "")}`;
  if (!MODELS.has(input.model)) throw new TokenForgePlaygroundError("model_not_found", "The requested model is not in the active TokenForge catalogue.");
  if (!Array.isArray(input.messages) || input.messages.length === 0 || input.messages.length > 100) {
    throw new TokenForgePlaygroundError("invalid_messages", "Send between 1 and 100 conversation messages.");
  }
  if (!(await isModelAvailable(input.model))) {
    throw new TokenForgePlaygroundError("model_unavailable", "The requested model is currently unavailable in the active TokenForge catalogue.");
  }

  const quota = await getQuotaStatus(input.userId);
  if (!quota) throw new TokenForgePlaygroundError("provider_unavailable", "Quota state is temporarily unavailable. Retry shortly.");
  if (quota.suspended) throw new TokenForgePlaygroundError("account_suspended", "This account is currently suspended.");
  if (quota.remainingRequests <= 0 || quota.remainingTokens <= 0) {
    void raiseOperationalAlert("quota_exceeded", { userId: input.userId, requestId, reason: "Daily request or token quota exhausted in Playground" });
    throw new TokenForgePlaygroundError("quota_exceeded", "Your daily TokenForge quota has been reached. Try again after the quota reset.");
  }

  const recent = await getRecentRequestCounts(input.userId, input.sourceIpHash, new Date(Date.now() - RATE_WINDOW_SECONDS * 1_000));
  if (recent.account >= ACCOUNT_RATE_LIMIT_PER_MINUTE || recent.ip >= IP_RATE_LIMIT_PER_MINUTE) {
    void raiseOperationalAlert("rate_circuit", { userId: input.userId, requestId, reason: "Playground per-minute account or source-IP rate threshold exceeded" });
    if (recent.account >= ACCOUNT_RATE_LIMIT_PER_MINUTE * 2 || recent.ip >= IP_RATE_LIMIT_PER_MINUTE * 2) {
      void raiseOperationalAlert("suspicious_usage", { userId: input.userId, requestId, reason: "Playground repeated rate-limit behavior exceeded the suspicious-usage threshold" });
    }
    throw new TokenForgePlaygroundError("rate_limited", "Rate limit reached. Slow down briefly and retry.");
  }

  const estimatedInputTokens = estimateInputTokens(input.messages);
  if (estimatedInputTokens > quota.remainingTokens) {
    void raiseOperationalAlert("quota_exceeded", { userId: input.userId, requestId, reason: "Playground input exceeds remaining daily token allowance" });
    throw new TokenForgePlaygroundError("quota_exceeded", "This request exceeds the remaining daily token allowance.");
  }
  if (!acquireRequestSlot(input.userId, quota.maxConcurrentRequests)) {
    void raiseOperationalAlert("rate_circuit", { userId: input.userId, requestId, reason: "Playground per-account concurrent-request circuit breaker triggered" });
    throw new TokenForgePlaygroundError("rate_limited", "This account has reached its concurrent-request limit. Wait for an active request to finish.");
  }

  const aborter = new AbortController();
  const timeout = setTimeout(() => aborter.abort(), PROVIDER_TIMEOUT_MS);
  try {
    const upstream = await forwardRequest({ model: input.model, messages: input.messages, stream: false }, aborter.signal);
    if (!upstream.ok) {
      const payload = await upstream.json().catch(() => null);
      await recordUsage({ requestId, userId: input.userId, modelId: input.model, status: "provider_error", sourceIpHash: input.sourceIpHash });
      throw new TokenForgePlaygroundError("provider_unavailable", upstreamError(payload));
    }
    const payload = await upstream.json().catch(() => null);
    const content = textContentFrom(payload);
    if (!payload || !content) {
      await recordUsage({ requestId, userId: input.userId, modelId: input.model, status: "provider_error", sourceIpHash: input.sourceIpHash });
      throw new TokenForgePlaygroundError("provider_unavailable", "The selected provider returned an invalid response.");
    }
    const tokens = normalizedTokens(usageFrom(payload), estimatedInputTokens);
    await recordUsage({ requestId, userId: input.userId, modelId: input.model, status: "success", ...tokens, sourceIpHash: input.sourceIpHash });
    return {
      requestId,
      model: input.model,
      content,
      usage: { promptTokens: tokens.inputTokens, completionTokens: tokens.outputTokens, totalTokens: tokens.inputTokens + tokens.outputTokens },
      quota: { remainingRequests: Math.max(0, quota.remainingRequests - 1), remainingTokens: Math.max(0, quota.remainingTokens - tokens.inputTokens - tokens.outputTokens) },
    };
  } catch (error) {
    if (error instanceof TokenForgePlaygroundError) throw error;
    await recordUsage({ requestId, userId: input.userId, modelId: input.model, status: "provider_error", sourceIpHash: input.sourceIpHash });
    const message = error instanceof Error && error.name === "AbortError" ? "The selected provider timed out. Retry this request." : "The selected provider is temporarily unavailable.";
    throw new TokenForgePlaygroundError("provider_unavailable", message);
  } finally {
    clearTimeout(timeout);
    releaseRequestSlot(input.userId);
  }
}

export function registerOpenAiGateway(app: Express) {
  app.get("/v1/models", (_req, res) => {
    res.setHeader("x-request-id", `tf_req_${randomUUID().replaceAll("-", "")}`);
    res.json({ object: "list", data: TOKENFORGE_CATALOGUE });
  });

  app.post("/v1/chat/completions", async (req: Request, res) => {
    const requestId = `tf_req_${randomUUID().replaceAll("-", "")}`;
    const secret = bearer(req);
    if (!secret) return errorResponse(res, requestId, 401, "Send a TokenForge key using the Bearer authorization header.", "invalid_api_key");

    const key = await findActiveApiKey(secret);
    if (!key) return errorResponse(res, requestId, 401, "The supplied TokenForge key is missing, invalid, or revoked.", "invalid_api_key");

    const input = (req.body ?? {}) as ChatInput;
    if (!input.model || !MODELS.has(input.model)) {
      return errorResponse(res, requestId, 404, "The requested model is not in the active TokenForge catalogue.", "model_not_found");
    }
    if (!(await isModelAvailable(input.model))) {
      return errorResponse(res, requestId, 503, "The requested model is currently unavailable in the active TokenForge catalogue.", "model_unavailable");
    }
    if (!Array.isArray(input.messages) || input.messages.length === 0) {
      return errorResponse(res, requestId, 400, "messages must be a non-empty array.", "invalid_messages");
    }
    if (input.messages.length > 100) {
      return errorResponse(res, requestId, 400, "messages may contain at most 100 entries.", "invalid_messages");
    }

    const ipHash = tokenForgeRequestIpHash(req);
    const quota = await getQuotaStatus(key.userId);
    if (!quota) return errorResponse(res, requestId, 503, "Quota state is temporarily unavailable. Retry shortly.", "quota_unavailable");
    const headers = tokenForgeRateHeaders(quota.requestLimit, quota.remainingRequests);
    if (quota.suspended) return errorResponse(res, requestId, 403, "This account is currently suspended.", "account_suspended", headers);
    if (quota.remainingRequests <= 0 || quota.remainingTokens <= 0) {
      void raiseOperationalAlert("quota_exceeded", { userId: key.userId, requestId, reason: "Daily request or token quota exhausted" });
      return errorResponse(res, requestId, 429, "Your daily TokenForge quota has been reached. Try again after the quota reset.", "quota_exceeded", { ...headers, "retry-after": 86_400 });
    }

    const recent = await getRecentRequestCounts(key.userId, ipHash, new Date(Date.now() - RATE_WINDOW_SECONDS * 1_000));
    if (recent.account >= ACCOUNT_RATE_LIMIT_PER_MINUTE || recent.ip >= IP_RATE_LIMIT_PER_MINUTE) {
      void raiseOperationalAlert("rate_circuit", { userId: key.userId, requestId, reason: "Per-minute account or source-IP rate threshold exceeded" });
      if (recent.account >= ACCOUNT_RATE_LIMIT_PER_MINUTE * 2 || recent.ip >= IP_RATE_LIMIT_PER_MINUTE * 2) void raiseOperationalAlert("suspicious_usage", { userId: key.userId, requestId, reason: "Repeated rate-limit behavior exceeded the suspicious-usage threshold" });
      return errorResponse(res, requestId, 429, "Rate limit reached. Slow down briefly and retry using the supplied rate-limit headers.", "rate_limited", { ...tokenForgeRateHeaders(ACCOUNT_RATE_LIMIT_PER_MINUTE, ACCOUNT_RATE_LIMIT_PER_MINUTE - recent.account), "retry-after": RATE_WINDOW_SECONDS });
    }

    const estimatedInputTokens = estimateInputTokens(input.messages);
    if (estimatedInputTokens > quota.remainingTokens) {
      void raiseOperationalAlert("quota_exceeded", { userId: key.userId, requestId, reason: "Request input exceeds remaining daily token allowance" });
      return errorResponse(res, requestId, 429, "This request exceeds the remaining daily token allowance.", "quota_exceeded", { ...headers, "retry-after": 86_400 });
    }

    if (!acquireRequestSlot(key.userId, quota.maxConcurrentRequests)) {
      void raiseOperationalAlert("rate_circuit", { userId: key.userId, requestId, reason: "Per-account concurrent-request circuit breaker triggered" });
      return errorResponse(res, requestId, 429, "This account has reached its concurrent-request limit. Wait for an active request to finish.", "rate_limited", { ...headers, "retry-after": 5 });
    }

    const aborter = new AbortController();
    const timeout = setTimeout(() => aborter.abort(), PROVIDER_TIMEOUT_MS);
    let upstream: globalThis.Response;
    try {
      upstream = await forwardRequest(input, aborter.signal);
    } catch (error) {
      clearTimeout(timeout);
      releaseRequestSlot(key.userId);
      await recordUsage({ requestId, userId: key.userId, apiKeyId: key.id, modelId: input.model, status: "provider_error", sourceIpHash: ipHash });
      const message = error instanceof Error && error.name === "AbortError" ? "The selected provider timed out. Retry this request." : "The selected provider is temporarily unavailable.";
      return errorResponse(res, requestId, 503, message, "provider_unavailable", headers);
    }

    if (!upstream.ok) {
      clearTimeout(timeout);
      releaseRequestSlot(key.userId);
      const payload = await upstream.json().catch(() => null);
      await recordUsage({ requestId, userId: key.userId, apiKeyId: key.id, modelId: input.model, status: "provider_error", sourceIpHash: ipHash });
      return errorResponse(res, requestId, upstream.status >= 500 ? 503 : upstream.status, upstreamError(payload), "provider_unavailable", headers);
    }

    await touchApiKey(key.id);
    if (!input.stream) {
      clearTimeout(timeout);
      const payload = await upstream.json().catch(() => null);
      if (!payload) {
        releaseRequestSlot(key.userId);
        await recordUsage({ requestId, userId: key.userId, apiKeyId: key.id, modelId: input.model, status: "provider_error", sourceIpHash: ipHash });
        return errorResponse(res, requestId, 503, "The selected provider returned an invalid response.", "provider_unavailable", headers);
      }
      const tokens = normalizedTokens(usageFrom(payload), estimatedInputTokens);
      await recordUsage({ requestId, userId: key.userId, apiKeyId: key.id, modelId: input.model, status: "success", ...tokens, sourceIpHash: ipHash });
      releaseRequestSlot(key.userId);
      res.setHeader("x-request-id", requestId);
      for (const [name, value] of Object.entries(tokenForgeRateHeaders(quota.requestLimit, quota.remainingRequests - 1))) res.setHeader(name, String(value));
      return res.status(200).json(payload);
    }

    res.status(200);
    res.setHeader("x-request-id", requestId);
    res.setHeader("content-type", "text/event-stream; charset=utf-8");
    res.setHeader("cache-control", "no-cache, no-transform");
    res.setHeader("connection", "keep-alive");
    for (const [name, value] of Object.entries(tokenForgeRateHeaders(quota.requestLimit, quota.remainingRequests - 1))) res.setHeader(name, String(value));
    res.flushHeaders();

    const reader = upstream.body?.getReader();
    if (!reader) {
      clearTimeout(timeout);
      releaseRequestSlot(key.userId);
      return errorResponse(res, requestId, 503, "The selected provider returned an empty stream.", "provider_unavailable", headers);
    }

    const decoder = new TextDecoder();
    let buffer = "";
    let finalUsage: Usage = {};
    let streamFailed = false;
    req.on("close", () => aborter.abort());
    try {
      while (true) {
        const chunk = await reader.read();
        if (chunk.done) break;
        const value = decoder.decode(chunk.value, { stream: true });
        buffer += value;
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data:")) continue;
          const payload = line.slice(5).trim();
          if (!payload || payload === "[DONE]") continue;
          try { finalUsage = { ...finalUsage, ...usageFrom(JSON.parse(payload)) }; } catch { /* passthrough malformed upstream event */ }
        }
        res.write(value);
      }
    } catch {
      streamFailed = true;
    } finally {
      clearTimeout(timeout);
      const tokens = normalizedTokens(finalUsage, estimatedInputTokens);
      await recordUsage({ requestId, userId: key.userId, apiKeyId: key.id, modelId: input.model, status: streamFailed ? "cancelled" : "success", ...tokens, sourceIpHash: ipHash });
      releaseRequestSlot(key.userId);
      res.end();
    }
  });
}
