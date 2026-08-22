import { CLAUDE_OPUS5_PROVIDER_SLUG, CLUSTER_PROTOCOL_PROVIDER_SLUG, FXQIDIAN_PROVIDER_SLUG, TOKENHARBOR_PROVIDER_SLUG, TOKENROUTER_PROVIDER_SLUG } from "./modelCatalogue";

export type CredentialTelemetryProvider = typeof FXQIDIAN_PROVIDER_SLUG | typeof CLUSTER_PROTOCOL_PROVIDER_SLUG | typeof TOKENHARBOR_PROVIDER_SLUG | typeof CLAUDE_OPUS5_PROVIDER_SLUG | typeof TOKENROUTER_PROVIDER_SLUG | "claude-fable-5" | "claude-opus-5" | "glm-5.3" | "deepseek-v4-pro" | `claude-opus-5:${string}`;

type CredentialSlotHealth = {
  consecutiveFailures: number;
  cooldownUntil: number;
  lastSuccessAt: Date | null;
  lastFailureAt: Date | null;
};

const slotHealth = new Map<string, CredentialSlotHealth>();
const failoverCounts = new Map<CredentialTelemetryProvider, number>();
const BASE_COOLDOWN_MS = 5_000;
const MAX_COOLDOWN_MS = 60_000;

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

/** Uses pool-slot indices only; secret values and key fragments are never recorded. */
export function isCredentialSlotEligible(providerSlug: CredentialTelemetryProvider, slot: number, now = Date.now()) {
  return healthFor(providerSlug, slot).cooldownUntil <= now;
}

export function recordCredentialSuccess(providerSlug: CredentialTelemetryProvider, slot: number, now = new Date()) {
  const health = healthFor(providerSlug, slot);
  health.consecutiveFailures = 0;
  health.cooldownUntil = 0;
  health.lastSuccessAt = now;
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
  return {
    health: health.cooldownUntil > now ? "cooling-down" as const : health.lastSuccessAt ? "healthy" as const : "unverified" as const,
    cooldownUntil: health.cooldownUntil > now ? new Date(health.cooldownUntil) : null,
    lastSuccessAt: health.lastSuccessAt,
    lastFailureAt: health.lastFailureAt,
  };
}

export function getProviderCredentialTelemetry(poolSizes: Partial<Record<CredentialTelemetryProvider, number>>, now = Date.now()) {
  return ([FXQIDIAN_PROVIDER_SLUG, CLUSTER_PROTOCOL_PROVIDER_SLUG, TOKENHARBOR_PROVIDER_SLUG, CLAUDE_OPUS5_PROVIDER_SLUG, TOKENROUTER_PROVIDER_SLUG, "claude-fable-5", "claude-opus-5", "glm-5.3", "deepseek-v4-pro"] as const).map(providerSlug => {
    const poolSize = Math.max(0, poolSizes[providerSlug] ?? 0);
    const slots = Array.from({ length: poolSize }, (_, slot) => ({ slot: slot + 1, ...healthFor(providerSlug, slot) }));
    const coolingDownSlots = slots.filter(slot => slot.cooldownUntil > now).length;
    const healthySlots = poolSize - coolingDownSlots;
    const lastSuccessAt = slots.reduce<Date | null>((latest, slot) => !latest || (slot.lastSuccessAt && slot.lastSuccessAt > latest) ? slot.lastSuccessAt : latest, null);
    const lastFailureAt = slots.reduce<Date | null>((latest, slot) => !latest || (slot.lastFailureAt && slot.lastFailureAt > latest) ? slot.lastFailureAt : latest, null);
    return {
      providerSlug,
      poolSize,
      healthySlots,
      coolingDownSlots,
      failoverCount: failoverCounts.get(providerSlug) ?? 0,
      lastSuccessAt,
      lastFailureAt,
      slots: slots.map(slot => ({
        slot: slot.slot,
        health: slot.cooldownUntil > now ? "cooling-down" as const : slot.lastSuccessAt ? "healthy" as const : "unverified" as const,
        cooldownUntil: slot.cooldownUntil > now ? new Date(slot.cooldownUntil) : null,
        lastSuccessAt: slot.lastSuccessAt,
        lastFailureAt: slot.lastFailureAt,
      })),
    };
  });
}

export function resetProviderCredentialTelemetry() {
  slotHealth.clear();
  failoverCounts.clear();
}
