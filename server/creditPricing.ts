import { TOKENFORGE_MODEL_CATALOGUE, type TokenForgeModelId } from "./modelCatalogue";

export const NANODOLLARS_PER_DOLLAR = 1_000_000_000;
export const INTRODUCTORY_CREDIT_NANOS = 50 * NANODOLLARS_PER_DOLLAR;
export const DAILY_CHECKIN_CREDIT_NANOS = 15 * NANODOLLARS_PER_DOLLAR;
export const DEFAULT_MAX_OUTPUT_TOKENS_FOR_CREDIT = 1_024;
export const TOKENFORGE_PLATFORM_CHARGE_MULTIPLIER = 2.0;
/**
 * Display baseline for "tokens processed": the metric starts at exactly 5,000M
 * and adds only usage recorded after this deploy. TOKENFORGE_TOKEN_HISTORICAL
 * is the SUM(usage_events.totalTokens) at the moment this baseline was set, so
 * the pre-existing total is treated as already counted and not shown again.
 */
export const TOKENFORGE_TOKEN_BASELINE = 5_000_000_000;
export const TOKENFORGE_TOKEN_HISTORICAL = 4_226_341_496;

function platformCreditRate(upstreamUsdPerMillion: number) {
  return Number((upstreamUsdPerMillion * TOKENFORGE_PLATFORM_CHARGE_MULTIPLIER).toFixed(6));
}

export type CreditPricedModel = TokenForgeModelId;

export const TOKENFORGE_CREDIT_PRICING: Record<CreditPricedModel, {
  inputNanosPerToken: number;
  outputNanosPerToken: number;
  upstreamInputUsdPerMillion: number;
  upstreamOutputUsdPerMillion: number;
  inputUsdPerMillion: number;
  outputUsdPerMillion: number;
}> = Object.fromEntries(TOKENFORGE_MODEL_CATALOGUE.map(model => [model.id, {
  inputNanosPerToken: Math.round(platformCreditRate(model.inputUsdPerMillion) * 1_000),
  outputNanosPerToken: Math.round(platformCreditRate(model.outputUsdPerMillion) * 1_000),
  upstreamInputUsdPerMillion: model.inputUsdPerMillion,
  upstreamOutputUsdPerMillion: model.outputUsdPerMillion,
  inputUsdPerMillion: platformCreditRate(model.inputUsdPerMillion),
  outputUsdPerMillion: platformCreditRate(model.outputUsdPerMillion),
}])) as Record<CreditPricedModel, {
  inputNanosPerToken: number;
  outputNanosPerToken: number;
  upstreamInputUsdPerMillion: number;
  upstreamOutputUsdPerMillion: number;
  inputUsdPerMillion: number;
  outputUsdPerMillion: number;
}>;

export function calculateCreditChargeNanos(model: CreditPricedModel, inputTokens: number, outputTokens: number) {
  const pricing = TOKENFORGE_CREDIT_PRICING[model];
  return Math.max(0, Math.trunc(inputTokens)) * pricing.inputNanosPerToken + Math.max(0, Math.trunc(outputTokens)) * pricing.outputNanosPerToken;
}

export function normalizedBillableMaxOutputTokens(requestedMaxTokens?: number) {
  if (typeof requestedMaxTokens !== "number" || !Number.isSafeInteger(requestedMaxTokens) || requestedMaxTokens < 1) return DEFAULT_MAX_OUTPUT_TOKENS_FOR_CREDIT;
  return requestedMaxTokens;
}

export function formatCreditUsd(nanos: number) {
  return (nanos / NANODOLLARS_PER_DOLLAR).toFixed(4);
}
