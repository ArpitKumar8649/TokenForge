export const NANODOLLARS_PER_DOLLAR = 1_000_000_000;
export const INTRODUCTORY_CREDIT_NANOS = 50 * NANODOLLARS_PER_DOLLAR;
export const DAILY_CHECKIN_CREDIT_NANOS = 5 * NANODOLLARS_PER_DOLLAR;
export const DEFAULT_MAX_OUTPUT_TOKENS_FOR_CREDIT = 1_024;
export const MAX_BILLABLE_OUTPUT_TOKENS = 8_192;

export type CreditPricedModel = "glm-5.2" | "grok-4.5";

export const TOKENFORGE_CREDIT_PRICING: Record<CreditPricedModel, {
  inputNanosPerToken: number;
  outputNanosPerToken: number;
  inputUsdPerMillion: number;
  outputUsdPerMillion: number;
}> = {
  "glm-5.2": { inputNanosPerToken: 1_400, outputNanosPerToken: 4_400, inputUsdPerMillion: 1.4, outputUsdPerMillion: 4.4 },
  "grok-4.5": { inputNanosPerToken: 2_000, outputNanosPerToken: 6_000, inputUsdPerMillion: 2, outputUsdPerMillion: 6 },
};

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
