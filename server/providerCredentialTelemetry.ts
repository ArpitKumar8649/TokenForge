import { CLAUDE_OPUS5_PROVIDER_SLUG, CLUSTER_PROTOCOL_PROVIDER_SLUG, FXQIDIAN_PROVIDER_SLUG, TOKENHARBOR_PROVIDER_SLUG, TOKENROUTER_PROVIDER_SLUG } from "./modelCatalogue";

export type CredentialTelemetryProvider =
  | typeof FXQIDIAN_PROVIDER_SLUG
  | typeof CLUSTER_PROTOCOL_PROVIDER_SLUG
  | typeof TOKENHARBOR_PROVIDER_SLUG
  | typeof CLAUDE_OPUS5_PROVIDER_SLUG
  | typeof TOKENROUTER_PROVIDER_SLUG
  | "claude-fable-5.1"
  | "claude-opus-5"
  | "glm-5.3"
  | "claude-sonnet-4.6"
  | "deepseek-v4-pro"
  | "qwen3.8-max"
  | "gpt-6-astra"
  | "kimi-k3"
  | `${string}:${string}`
  | (string & {});

type CredentialSlotHealth = {
  consecutiveFailures: number;
  cooldownUntil: number;
  lastSuccessAt: Date | null;
  lastFailureAt: Date | null;
};

export type SlotPerformanceMetrics = {
  activeRequests: number;
  lastLatencyMs: number | null;
  avgLatencyMs: number | null;
  lastTtftMs: number | null;
  avgTtftMs: number | null;
  lastTokensPerSec: number | null;
  avgTokensPerSec: number | null;
  totalTokens: number;
  recentLatencies: number[];
  recentTtfts: number[];
  recentTokensPerSec: number[];
};

const slotHealth = new Map<string, CredentialSlotHealth>();
const slotPerformance = new Map<string, SlotPerformanceMetrics>();
const failoverCounts = new Map<CredentialTelemetryProvider, number>();
const BASE_COOLDOWN_MS = 5_000;
const MAX_COOLDOWN_MS = 60_000;
const ROLLING_WINDOW_SIZE = 10;

function slotKey(providerSlug: CredentialTelemetryProvider, slot: number) {
  return `${providerSlug}:${slot}`;
}

function healthFor(providerSlug: CredentialTelemetryProvider, slot: number) {
  const key = slotKey(providerSlug, slot);
  const existing = slotHealth.get(key);
  if (existing) return existing;
  const created: CredentialSlotHealth = { consecutiveFailures: 0, cooldownUntil: 0, lastSuccessAt: null, lastFailureAt: null };
  slotHealth.set(key, created);
  return created;
}

function performanceFor(providerSlug: CredentialTelemetryProvider, slot: number): SlotPerformanceMetrics {
  const key = slotKey(providerSlug, slot);
  const existing = slotPerformance.get(key);
  if (existing) return existing;
  const created: SlotPerformanceMetrics = {
    activeRequests: 0,
    lastLatencyMs: null,
    avgLatencyMs: null,
    lastTtftMs: null,
    avgTtftMs: null,
    lastTokensPerSec: null,
    avgTokensPerSec: null,
    totalTokens: 0,
    recentLatencies: [],
    recentTtfts: [],
    recentTokensPerSec: [],
  };
  slotPerformance.set(key, created);
  return created;
}

/** Acquires concurrency for a provider key slot, returning a cleanup function to release when settled. */
export function acquireProviderSlotConcurrency(providerSlug: CredentialTelemetryProvider, slot: number): () => void {
  const perf = performanceFor(providerSlug, slot);
  perf.activeRequests += 1;
  let released = false;
  return () => {
    if (!released) {
      released = true;
      perf.activeRequests = Math.max(0, perf.activeRequests - 1);
    }
  };
}

/** Gets the current in-flight concurrent requests for a specific key slot. */
export function getProviderSlotConcurrency(providerSlug: CredentialTelemetryProvider, slot: number): number {
  return performanceFor(providerSlug, slot).activeRequests;
}

/** Gets the total active in-flight requests across all slots in a provider group. */
export function getProviderGroupConcurrency(providerSlug: CredentialTelemetryProvider): number {
  let total = 0;
  const prefix = `${providerSlug}:`;
  for (const [key, perf] of slotPerformance.entries()) {
    if (key.startsWith(prefix) || key === String(providerSlug)) {
      total += perf.activeRequests;
    }
  }
  return total;
}

/** Records latency, streaming TTFT, and throughput metrics for a provider key slot. */
export function recordProviderPerformance(
  providerSlug: CredentialTelemetryProvider,
  slot: number,
  data: {
    latencyMs?: number;
    ttftMs?: number;
    outputTokens?: number;
    totalTokens?: number;
  }
) {
  const perf = performanceFor(providerSlug, slot);

  if (typeof data.latencyMs === "number" && data.latencyMs >= 0) {
    perf.lastLatencyMs = Math.round(data.latencyMs);
    perf.recentLatencies.push(perf.lastLatencyMs);
    if (perf.recentLatencies.length > ROLLING_WINDOW_SIZE) perf.recentLatencies.shift();
    const sum = perf.recentLatencies.reduce((a, b) => a + b, 0);
    perf.avgLatencyMs = Math.round(sum / perf.recentLatencies.length);
  }

  if (typeof data.ttftMs === "number" && data.ttftMs >= 0) {
    perf.lastTtftMs = Math.round(data.ttftMs);
    perf.recentTtfts.push(perf.lastTtftMs);
    if (perf.recentTtfts.length > ROLLING_WINDOW_SIZE) perf.recentTtfts.shift();
    const sum = perf.recentTtfts.reduce((a, b) => a + b, 0);
    perf.avgTtftMs = Math.round(sum / perf.recentTtfts.length);
  }

  if (typeof data.outputTokens === "number" && data.outputTokens > 0 && typeof data.latencyMs === "number" && data.latencyMs > 0) {
    const durationSec = data.latencyMs / 1000;
    const tokensPerSec = Math.round((data.outputTokens / durationSec) * 10) / 10;
    perf.lastTokensPerSec = tokensPerSec;
    perf.recentTokensPerSec.push(tokensPerSec);
    if (perf.recentTokensPerSec.length > ROLLING_WINDOW_SIZE) perf.recentTokensPerSec.shift();
    const sum = perf.recentTokensPerSec.reduce((a, b) => a + b, 0);
    perf.avgTokensPerSec = Math.round((sum / perf.recentTokensPerSec.length) * 10) / 10;
  }

  if (typeof data.totalTokens === "number" && data.totalTokens > 0) {
    perf.totalTokens += data.totalTokens;
  }
}

/** Returns the performance metrics for a specific slot. */
export function getSlotPerformanceMetrics(providerSlug: CredentialTelemetryProvider, slot: number) {
  const perf = performanceFor(providerSlug, slot);
  return {
    activeRequests: perf.activeRequests,
    lastLatencyMs: perf.lastLatencyMs,
    avgLatencyMs: perf.avgLatencyMs,
    lastTtftMs: perf.lastTtftMs,
    avgTtftMs: perf.avgTtftMs,
    lastTokensPerSec: perf.lastTokensPerSec,
    avgTokensPerSec: perf.avgTokensPerSec,
  };
}

/** Uses pool-slot indices only; secret values and key fragments are never recorded. */
export function isCredentialSlotEligible(providerSlug: CredentialTelemetryProvider, slot: number, now = Date.now()) {
  return healthFor(providerSlug, slot).cooldownUntil <= now;
}

export function recordCredentialSuccess(providerSlug: CredentialTelemetryProvider, slot: number, now = new Date()) {
  const health = healthFor(providerSlug, slot);
  const nowMs = now.getTime();
  const preserveCooldown = health.cooldownUntil > nowMs && health.consecutiveFailures === 0;
  health.consecutiveFailures = 0;
  if (!preserveCooldown) {
    health.cooldownUntil = 0;
  }
  health.lastSuccessAt = now;
}

export function setCredentialCooldown(
  providerSlug: CredentialTelemetryProvider,
  slot: number,
  durationMs: number = 60_000,
  now = Date.now()
) {
  const health = healthFor(providerSlug, slot);
  health.cooldownUntil = Math.max(health.cooldownUntil, now + durationMs);
}

export function recordCredentialFailure(providerSlug: CredentialTelemetryProvider, slot: number, now = Date.now()) {
  const health = healthFor(providerSlug, slot);
  health.consecutiveFailures += 1;
  health.cooldownUntil = now + Math.min(MAX_COOLDOWN_MS, BASE_COOLDOWN_MS * 2 ** Math.min(4, health.consecutiveFailures - 1));
  health.lastFailureAt = new Date(now);
}

export function recordCredentialFailover(providerSlug: CredentialTelemetryProvider) {
  failoverCounts.set(providerSlug, (failoverCounts.get(providerSlug) ?? 0) + 1);
}

/** Returns a single opaque slot health view for dynamically configured provider groups. */
export function getCredentialSlotTelemetry(providerSlug: CredentialTelemetryProvider, slot: number, now = Date.now()) {
  const health = healthFor(providerSlug, slot);
  const perf = performanceFor(providerSlug, slot);
  return {
    health: health.cooldownUntil > now ? "cooling-down" as const : health.lastSuccessAt ? "healthy" as const : "unverified" as const,
    cooldownUntil: health.cooldownUntil > now ? new Date(health.cooldownUntil) : null,
    lastSuccessAt: health.lastSuccessAt,
    lastFailureAt: health.lastFailureAt,
    activeRequests: perf.activeRequests,
    lastLatencyMs: perf.lastLatencyMs,
    avgLatencyMs: perf.avgLatencyMs,
    lastTtftMs: perf.lastTtftMs,
    avgTtftMs: perf.avgTtftMs,
    lastTokensPerSec: perf.lastTokensPerSec,
    avgTokensPerSec: perf.avgTokensPerSec,
  };
}

export function getProviderCredentialTelemetry(poolSizes: Partial<Record<CredentialTelemetryProvider, number>>, now = Date.now()) {
  return ([FXQIDIAN_PROVIDER_SLUG, CLUSTER_PROTOCOL_PROVIDER_SLUG, TOKENHARBOR_PROVIDER_SLUG, CLAUDE_OPUS5_PROVIDER_SLUG, TOKENROUTER_PROVIDER_SLUG, "claude-fable-5.1", "claude-opus-5", "glm-5.3", "deepseek-v4-pro"] as const).map(providerSlug => {
    const poolSize = Math.max(0, poolSizes[providerSlug] ?? 0);
    const slots = Array.from({ length: poolSize }, (_, slot) => ({ slot: slot + 1, ...healthFor(providerSlug, slot), ...performanceFor(providerSlug, slot) }));
    const coolingDownSlots = slots.filter(slot => slot.cooldownUntil > now).length;
    const healthySlots = poolSize - coolingDownSlots;
    const lastSuccessAt = slots.reduce<Date | null>((latest, slot) => !latest || (slot.lastSuccessAt && slot.lastSuccessAt > latest) ? slot.lastSuccessAt : latest, null);
    const lastFailureAt = slots.reduce<Date | null>((latest, slot) => !latest || (slot.lastFailureAt && slot.lastFailureAt > latest) ? slot.lastFailureAt : latest, null);
    const totalActiveRequests = slots.reduce((total, slot) => total + slot.activeRequests, 0);
    return {
      providerSlug,
      poolSize,
      healthySlots,
      coolingDownSlots,
      failoverCount: failoverCounts.get(providerSlug) ?? 0,
      activeRequests: totalActiveRequests,
      lastSuccessAt,
      lastFailureAt,
      slots: slots.map(slot => ({
        slot: slot.slot,
        health: slot.cooldownUntil > now ? "cooling-down" as const : slot.lastSuccessAt ? "healthy" as const : "unverified" as const,
        cooldownUntil: slot.cooldownUntil > now ? new Date(slot.cooldownUntil) : null,
        lastSuccessAt: slot.lastSuccessAt,
        lastFailureAt: slot.lastFailureAt,
        activeRequests: slot.activeRequests,
        lastLatencyMs: slot.lastLatencyMs,
        avgLatencyMs: slot.avgLatencyMs,
        lastTtftMs: slot.lastTtftMs,
        avgTtftMs: slot.avgTtftMs,
        lastTokensPerSec: slot.lastTokensPerSec,
        avgTokensPerSec: slot.avgTokensPerSec,
      })),
    };
  });
}

export function resetProviderCredentialTelemetry() {
  slotHealth.clear();
  slotPerformance.clear();
  failoverCounts.clear();
}

/** Removes only one dynamic provider group's transient state after its encrypted configuration is deleted. */
export function clearProviderCredentialTelemetryGroup(providerSlug: Extract<CredentialTelemetryProvider, `${string}:${string}`>) {
  const prefix = `${providerSlug}:`;
  for (const key of Array.from(slotHealth.keys())) {
    if (key.startsWith(prefix)) slotHealth.delete(key);
  }
  for (const key of Array.from(slotPerformance.keys())) {
    if (key.startsWith(prefix)) slotPerformance.delete(key);
  }
  failoverCounts.delete(providerSlug);
}

/** Resets active cooldowns for a provider group when cooldown bypass is enabled. */
export function clearProviderCredentialCooldowns(providerSlug: string) {
  const prefix = `${providerSlug}:`;
  for (const [key, health] of slotHealth.entries()) {
    if (key.startsWith(prefix)) {
      health.cooldownUntil = 0;
      health.consecutiveFailures = 0;
    }
  }
}
