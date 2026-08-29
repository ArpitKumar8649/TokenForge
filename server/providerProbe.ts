import { randomUUID } from "node:crypto";

export type ProviderProbeInput = {
  baseUrl: string;
  apiKey: string;
  model: string;
  /** Anthropic Messages (/v1/messages) vs OpenAI-compatible (/v1/chat/completions). */
  anthropic?: boolean;
};

export type ProviderProbeResult = {
  ok: boolean;
  status: number | null;
  latencyMs: number;
  message: string;
};

const PROBE_TIMEOUT_MS = 20_000;

function normalizeBaseUrl(baseUrl: string) {
  return baseUrl.trim().replace(/\/+$/, "");
}

/** Sends a tiny completion to an upstream provider without exposing the key or persisting anything. */
export async function probeProvider(input: ProviderProbeInput): Promise<ProviderProbeResult> {
  const base = normalizeBaseUrl(input.baseUrl);
  if (!base) return { ok: false, status: null, latencyMs: 0, message: "Base URL is required" };
  if (!input.apiKey.trim()) return { ok: false, status: null, latencyMs: 0, message: "API key is required" };
  if (!input.model.trim()) return { ok: false, status: null, latencyMs: 0, message: "Model ID is required" };

  const isAnthropic = input.anthropic === true;
  const url = isAnthropic
    ? `${base}/v1/messages`
    : `${base.endsWith("/v1") ? base : `${base}/v1`}/chat/completions`;

  const body = isAnthropic
    ? {
        model: input.model,
        max_tokens: 1,
        messages: [{ role: "user", content: "ping" }],
      }
    : {
        model: input.model,
        max_tokens: 1,
        messages: [{ role: "user", content: "ping" }],
      };

  const started = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": isAnthropic ? input.apiKey.trim() : "",
        Authorization: isAnthropic ? "" : `Bearer ${input.apiKey.trim()}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const latencyMs = Date.now() - started;
    const ok = response.ok;
    if (ok) {
      return { ok, status: response.status, latencyMs, message: "Connected successfully" };
    }
    let detail = "";
    try {
      const text = await response.text();
      detail = text.slice(0, 300);
    } catch {
      /* ignore body read failure */
    }
    return {
      ok,
      status: response.status,
      latencyMs,
      message: detail ? `HTTP ${response.status}: ${detail}` : `HTTP ${response.status}`,
    };
  } catch (error) {
    const latencyMs = Date.now() - started;
    const aborted = controller.signal.aborted;
    return {
      ok: false,
      status: null,
      latencyMs,
      message: aborted ? `Timed out after ${Math.round(PROBE_TIMEOUT_MS / 1000)}s` : (error instanceof Error ? error.message : "Connection failed"),
    };
  } finally {
    clearTimeout(timer);
  }
}

export function providerProbeRequestId() {
  return `tf_probe_${randomUUID().replaceAll("-", "")}`;
}
