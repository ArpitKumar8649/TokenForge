import { TOKENFORGE_MODEL_CATALOGUE, type TokenForgeModelId } from "./modelCatalogue";

export const NANODOLLARS_PER_DOLLAR = 1_000_000_000;
export const INTRODUCTORY_CREDIT_NANOS = 50 * NANODOLLARS_PER_DOLLAR;
export const DAILY_CHECKIN_CREDIT_NANOS = 5 * NANODOLLARS_PER_DOLLAR;
export const DEFAULT_MAX_OUTPUT_TOKENS_FOR_CREDIT = 1_024;
export const MAX_BILLABLE_OUTPUT_TOKENS = 8_192;

export type CreditPricedModel = TokenForgeModelId;

export const TOKENFORGE_CREDIT_PRICING: Record<CreditPricedModel, {
  inputNanosPerToken: number;
  outputNanosPerToken: number;
  inputUsdPerMillion: number;
  outputUsdPerMillion: number;
}> = Object.fromEntries(TOKENFORGE_MODEL_CATALOGUE.map(model => [model.id, {
  inputNanosPerToken: Math.round(model.inputUsdPerMillion * 1_000),
  outputNanosPerToken: Math.round(model.outputUsdPerMillion * 1_000),
  inputUsdPerMillion: model.inputUsdPerMillion,
  outputUsdPerMillion: model.outputUsdPerMillion,
}])) as Record<CreditPricedModel, {
  inputNanosPerToken: number;
  outputNanosPerToken: number;
  inputUsdPerMillion: number;
  outputUsdPerMillion: number;
}>;

export function calculateCreditChargeNanos(model: CreditPricedModel, inputTokens: number, outputTokens: number) {
  const pricing = TOKENFORGE_CREDIT_PRICING[model];
  return Math.max(0, Math.trunc(inputTokens)) * pricing.inputNanosPerToken + Math.max(0, Math.trunc(outputTokens)) * pricing.outputNanosPerToken;
}

export function normalizedBillableMaxOutputTokens(requestedMaxTokens?: number) {
  if (!Number.isFinite(requestedMaxTokens)) return DEFAULT_MAX_OUTPUT_TOKENS_FOR_CREDIT;
  return Math.min(MAX_BILLABLE_OUTPUT_TOKENS, Math.max(0, Math.floor(Number(requestedMaxTokens))));
}

export function formatCreditUsd(nanos: number) {
  return (nanos / NANODOLLARS_PER_DOLLAR).toFixed(4);
}
