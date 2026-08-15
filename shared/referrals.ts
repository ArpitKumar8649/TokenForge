export const TOKENFORGE_PUBLIC_ORIGIN = "https://tokengate-cqt9ivzs.manus.space";
export const TOKENFORGE_REFERRAL_REWARD_USD = 10;
export const TOKENFORGE_REFERRAL_REWARD_NANOS = TOKENFORGE_REFERRAL_REWARD_USD * 1_000_000_000;

/** Referral tokens are opaque, case-insensitive identifiers. Invalid input is ignored rather than persisted. */
export function normalizeReferralCode(value: string | null | undefined) {
  const code = value?.trim().toUpperCase() ?? "";
  return /^[A-Z0-9]{8,24}$/.test(code) ? code : undefined;
}

export function buildReferralInviteUrl(code: string) {
  return `${TOKENFORGE_PUBLIC_ORIGIN}/signup?ref=${encodeURIComponent(code)}`;
}
