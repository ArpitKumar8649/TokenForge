/** One USD per million tokens corresponds to 1,000 nanodollars per token. */
const NANODOLLARS_PER_USD_PER_MILLION = 1_000;

export function calculateProviderBaseCostNanos(inputTokens: number, outputTokens: number, upstreamInputUsdPerMillion: number, upstreamOutputUsdPerMillion: number) {
  const input = Math.max(0, Math.trunc(inputTokens));
  const output = Math.max(0, Math.trunc(outputTokens));
  const upstreamInputNanosPerToken = Math.round(upstreamInputUsdPerMillion * NANODOLLARS_PER_USD_PER_MILLION);
  const upstreamOutputNanosPerToken = Math.round(upstreamOutputUsdPerMillion * NANODOLLARS_PER_USD_PER_MILLION);
  return input * upstreamInputNanosPerToken + output * upstreamOutputNanosPerToken;
}

export function calculateSettledUsagePricingBreakdownNanos({ inputTokens, outputTokens, upstreamInputUsdPerMillion, upstreamOutputUsdPerMillion, finalCreditDeductionNanos }: { inputTokens: number; outputTokens: number; upstreamInputUsdPerMillion: number; upstreamOutputUsdPerMillion: number; finalCreditDeductionNanos: number }) {
  const providerBaseNanos = calculateProviderBaseCostNanos(inputTokens, outputTokens, upstreamInputUsdPerMillion, upstreamOutputUsdPerMillion);
  const settledDeductionNanos = Math.max(0, Math.trunc(finalCreditDeductionNanos));
  return {
    providerBaseNanos,
    platformChargeNanos: Math.max(0, settledDeductionNanos - providerBaseNanos),
    finalCreditDeductionNanos: settledDeductionNanos,
  };
}
