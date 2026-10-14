import { TOKENFORGE_MODEL_CATALOGUE, type TokenForgeModelId } from "./modelCatalogue";

export const NANODOLLARS_PER_DOLLAR = 1_000_000_000;
export const INTRODUCTORY_CREDIT_NANOS = 50 * NANODOLLARS_PER_DOLLAR;
export const DAILY_CHECKIN_CREDIT_NANOS = 2 * NANODOLLARS_PER_DOLLAR;
export const DEFAULT_MAX_OUTPUT_TOKENS_FOR_CREDIT = 1_024;
export const TOKENFORGE_PLATFORM_CHARGE_MULTIPLIER = 2.0;
/**
 * Display baseline for "tokens processed": the metric starts at exactly 11,000M (11 Billion)
 * and increments with every token processed on the platform.
 */
export const TOKENFORGE_TOKEN_BASELINE = 11_000_000_000;
export const TOKENFORGE_TOKEN_HISTORICAL = 0;

function platformCreditRate(modelId: string, upstreamUsdPerMillion: number) {
  if (modelId === "gpt-6-astra" || modelId === "claude-opus-5" || modelId === "claude-opus-5.5" || modelId === "gpt-6-sol") {
    return Number(upstreamUsdPerMillion.toFixed(6));
  }
  return Number((upstreamUsdPerMillion * TOKENFORGE_PLATFORM_CHARGE_MULTIPLIER).toFixed(6));
}

export type CreditPricedModel = TokenForgeModelId;
export type PricingTier = "payg" | "bundle";

export type DynamicModelPricingOverride = {
  inputUsdPerMillion: number;
  outputUsdPerMillion: number;
  updatedAt?: string;
  updatedByUserId?: number | null;
};

let activeBundlePricingOverrides: Record<string, DynamicModelPricingOverride> = {};
let activePaygPricingOverrides: Record<string, DynamicModelPricingOverride> = {};
let bundleOverridesCachedAt = 0;
let paygOverridesCachedAt = 0;
const PRICING_OVERRIDES_TTL_MS = 20_000; // 20 seconds TTL

export type PricingOverridesLoader = (tier: PricingTier) => Promise<Record<string, DynamicModelPricingOverride>>;
let pricingLoader: PricingOverridesLoader | null = null;
const inflightSync: Partial<Record<PricingTier, Promise<Record<string, DynamicModelPricingOverride>>>> = {};

export function registerPricingLoader(loader: PricingOverridesLoader) {
  pricingLoader = loader;
}

export function setActivePricingOverrides(overrides: Record<string, DynamicModelPricingOverride>, tier: PricingTier = "bundle") {
  const now = Date.now();
  if (tier === "payg") {
    activePaygPricingOverrides = { ...overrides };
    paygOverridesCachedAt = now;
  } else {
    activeBundlePricingOverrides = { ...overrides };
    bundleOverridesCachedAt = now;
  }
}

export function invalidatePricingOverridesCache(tier?: PricingTier) {
  if (!tier || tier === "bundle") bundleOverridesCachedAt = 0;
  if (!tier || tier === "payg") paygOverridesCachedAt = 0;
}

export async function ensureFreshPricingOverrides(tier: PricingTier = "bundle"): Promise<Record<string, DynamicModelPricingOverride>> {
  const now = Date.now();
  const cachedAt = tier === "payg" ? paygOverridesCachedAt : bundleOverridesCachedAt;
  const currentOverrides = tier === "payg" ? activePaygPricingOverrides : activeBundlePricingOverrides;

  // If cached and not expired, return immediately
  if (cachedAt > 0 && now - cachedAt < PRICING_OVERRIDES_TTL_MS) {
    return currentOverrides;
  }

  // Deduplicate in-flight sync for the same tier
  if (!inflightSync[tier]) {
    const fetcher = async () => {
      if (pricingLoader) {
        return pricingLoader(tier);
      }
      const { getModelPricingOverrides } = await import("./db");
      return getModelPricingOverrides(tier);
    };

    inflightSync[tier] = fetcher()
      .then((fresh) => {
        setActivePricingOverrides(fresh, tier);
        return fresh;
      })
      .catch((err) => {
        console.warn(`[TokenForge] Failed to sync ${tier} pricing overrides:`, err?.message ?? String(err));
        return currentOverrides;
      })
      .finally(() => {
        delete inflightSync[tier];
      });
  }

  return inflightSync[tier]!;
}

export function getActivePricingOverrides(tier: PricingTier = "bundle"): Record<string, DynamicModelPricingOverride> {
  return tier === "payg" ? { ...activePaygPricingOverrides } : { ...activeBundlePricingOverrides };
}

export const TOKENFORGE_PAYG_PRICING: Record<CreditPricedModel, {
  inputNanosPerToken: number;
  outputNanosPerToken: number;
  upstreamInputUsdPerMillion: number;
  upstreamOutputUsdPerMillion: number;
  inputUsdPerMillion: number;
  outputUsdPerMillion: number;
}> = Object.fromEntries(TOKENFORGE_MODEL_CATALOGUE.map(model => {
  // PAYG default baseline: 1.0x upstream base rate (zero platform markup)
  const inputRate = Number(model.inputUsdPerMillion.toFixed(6));
  const outputRate = Number(model.outputUsdPerMillion.toFixed(6));
  return [model.id, {
    inputNanosPerToken: Math.round(inputRate * 1_000),
    outputNanosPerToken: Math.round(outputRate * 1_000),
    upstreamInputUsdPerMillion: model.inputUsdPerMillion,
    upstreamOutputUsdPerMillion: model.outputUsdPerMillion,
    inputUsdPerMillion: inputRate,
    outputUsdPerMillion: outputRate,
  }];
})) as Record<CreditPricedModel, {
  inputNanosPerToken: number;
  outputNanosPerToken: number;
  upstreamInputUsdPerMillion: number;
  upstreamOutputUsdPerMillion: number;
  inputUsdPerMillion: number;
  outputUsdPerMillion: number;
}>;

export const TOKENFORGE_CREDIT_PRICING: Record<CreditPricedModel, {
  inputNanosPerToken: number;
  outputNanosPerToken: number;
  upstreamInputUsdPerMillion: number;
  upstreamOutputUsdPerMillion: number;
  inputUsdPerMillion: number;
  outputUsdPerMillion: number;
}> = Object.fromEntries(TOKENFORGE_MODEL_CATALOGUE.map(model => {
  const inputRate = platformCreditRate(model.id, model.inputUsdPerMillion);
  const outputRate = platformCreditRate(model.id, model.outputUsdPerMillion);
  return [model.id, {
    inputNanosPerToken: Math.round(inputRate * 1_000),
    outputNanosPerToken: Math.round(outputRate * 1_000),
    upstreamInputUsdPerMillion: model.inputUsdPerMillion,
    upstreamOutputUsdPerMillion: model.outputUsdPerMillion,
    inputUsdPerMillion: inputRate,
    outputUsdPerMillion: outputRate,
  }];
})) as Record<CreditPricedModel, {
  inputNanosPerToken: number;
  outputNanosPerToken: number;
  upstreamInputUsdPerMillion: number;
  upstreamOutputUsdPerMillion: number;
  inputUsdPerMillion: number;
  outputUsdPerMillion: number;
}>;

export function getEffectiveModelPricing(modelId: string, tier: PricingTier = "bundle") {
  const cachedAt = tier === "payg" ? paygOverridesCachedAt : bundleOverridesCachedAt;
  if (pricingLoader && (cachedAt === 0 || Date.now() - cachedAt > PRICING_OVERRIDES_TTL_MS)) {
    // Non-blocking auto-refresh in background so token calculations never stall
    void ensureFreshPricingOverrides(tier).catch(() => {});
  }

  const activeOverrides = tier === "payg" ? activePaygPricingOverrides : activeBundlePricingOverrides;
  const custom = activeOverrides[modelId];
  if (custom && typeof custom.inputUsdPerMillion === "number" && typeof custom.outputUsdPerMillion === "number") {
    // Exact real rate configured by administrator for this tier
    const inputRate = Number(custom.inputUsdPerMillion.toFixed(6));
    const outputRate = Number(custom.outputUsdPerMillion.toFixed(6));
    return {
      inputNanosPerToken: Math.round(inputRate * 1_000),
      outputNanosPerToken: Math.round(outputRate * 1_000),
      inputUsdPerMillion: inputRate,
      outputUsdPerMillion: outputRate,
      isCustom: true,
      tier,
      updatedAt: custom.updatedAt,
    };
  }

  const defaultPricing = tier === "payg"
    ? TOKENFORGE_PAYG_PRICING[modelId as CreditPricedModel]
    : TOKENFORGE_CREDIT_PRICING[modelId as CreditPricedModel];

  if (defaultPricing) {
    return {
      inputNanosPerToken: defaultPricing.inputNanosPerToken,
      outputNanosPerToken: defaultPricing.outputNanosPerToken,
      inputUsdPerMillion: defaultPricing.inputUsdPerMillion,
      outputUsdPerMillion: defaultPricing.outputUsdPerMillion,
      isCustom: false,
      tier,
    };
  }
  return {
    inputNanosPerToken: 0,
    outputNanosPerToken: 0,
    inputUsdPerMillion: 0,
    outputUsdPerMillion: 0,
    isCustom: false,
    tier,
  };
}

export function getAllEffectiveModelPricingSync(tier: PricingTier = "bundle") {
  return TOKENFORGE_MODEL_CATALOGUE.map(model => {
    const effective = getEffectiveModelPricing(model.id, tier);
    const defaultPricing = tier === "payg"
      ? TOKENFORGE_PAYG_PRICING[model.id as CreditPricedModel]
      : TOKENFORGE_CREDIT_PRICING[model.id as CreditPricedModel];
    return {
      id: model.id,
      displayName: model.displayName,
      providerName: model.providerName,
      providerSlug: model.providerSlug,
      pricingSource: model.pricingSource,
      tier,
      upstreamInputUsdPerMillion: model.inputUsdPerMillion,
      upstreamOutputUsdPerMillion: model.outputUsdPerMillion,
      defaultInputUsdPerMillion: defaultPricing?.inputUsdPerMillion ?? model.inputUsdPerMillion,
      defaultOutputUsdPerMillion: defaultPricing?.outputUsdPerMillion ?? model.outputUsdPerMillion,
      effectiveInputUsdPerMillion: effective.inputUsdPerMillion,
      effectiveOutputUsdPerMillion: effective.outputUsdPerMillion,
      inputNanosPerToken: effective.inputNanosPerToken,
      outputNanosPerToken: effective.outputNanosPerToken,
      isCustom: effective.isCustom,
      updatedAt: effective.updatedAt,
    };
  });
}

export async function getAllEffectiveModelPricing(tier: PricingTier = "bundle") {
  await ensureFreshPricingOverrides(tier).catch(() => {});
  return getAllEffectiveModelPricingSync(tier);
}

export function calculateCreditChargeNanos(
  model: CreditPricedModel,
  inputTokens: number,
  outputTokens: number,
  tier: PricingTier = "bundle"
) {
  const pricing = getEffectiveModelPricing(model, tier);
  return Math.max(0, Math.trunc(inputTokens)) * pricing.inputNanosPerToken + Math.max(0, Math.trunc(outputTokens)) * pricing.outputNanosPerToken;
}

export function normalizedBillableMaxOutputTokens(requestedMaxTokens?: number) {
  if (typeof requestedMaxTokens !== "number" || !Number.isSafeInteger(requestedMaxTokens) || requestedMaxTokens < 1) return DEFAULT_MAX_OUTPUT_TOKENS_FOR_CREDIT;
  return requestedMaxTokens;
}

export function formatCreditUsd(nanos: number) {
  return (nanos / NANODOLLARS_PER_DOLLAR).toFixed(4);
}
