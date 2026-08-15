export const TOKENFORGE_PUBLIC_ORIGIN = "https://tokengate-cqt9ivzs.manus.space";
export const TOKENFORGE_REFERRAL_REWARD_USD = 10;
export const TOKENFORGE_REFERRAL_REWARD_NANOS = TOKENFORGE_REFERRAL_REWARD_USD * 1_000_000_000;
export const TOKENFORGE_AFFILIATE_CODE_LENGTH = 4;

/** Affiliate codes are compact, lowercase, case-insensitive identifiers. Invalid input is ignored rather than persisted. */
export function normalizeReferralCode(value: string | null | undefined) {
  const code = value?.trim().toLowerCase() ?? "";
  return new RegExp(`^[a-z0-9]{${TOKENFORGE_AFFILIATE_CODE_LENGTH}}$`).test(code) ? code : undefined;
}

export function buildReferralInviteUrl(code: string) {
  return `${TOKENFORGE_PUBLIC_ORIGIN}/sign-up?aff=${encodeURIComponent(code)}`;
}
