import { PUBLIC_ORIGIN } from "./const";
export const TOKENFORGE_PUBLIC_ORIGIN = PUBLIC_ORIGIN;
export const TOKENFORGE_REFERRAL_REWARD_USD = 10;
export const TOKENFORGE_REFERRAL_REWARD_NANOS = TOKENFORGE_REFERRAL_REWARD_USD * 1_000_000_000;
export const TOKENFORGE_AFFILIATE_CODE_LENGTH = 4;
/** Public reusable campaign marker; it deliberately does not identify an existing user. */
export const SPECIAL_REFERRAL_CAMPAIGN_CODE = "bonus150";

/** Affiliate codes are compact, lowercase, case-insensitive identifiers. Invalid input is ignored rather than persisted. */
export function normalizeReferralCode(value: string | null | undefined) {
  const code = value?.trim().toLowerCase() ?? "";
  return new RegExp(`^[a-z0-9]{${TOKENFORGE_AFFILIATE_CODE_LENGTH}}$`).test(code) ? code : undefined;
}

export function isSpecialReferralCampaignCode(value: string | null | undefined) {
  return value?.trim().toLowerCase() === SPECIAL_REFERRAL_CAMPAIGN_CODE;
}

/** Accepts either a standard four-character affiliate code or the public special campaign marker. */
export function normalizeReferralCampaignCode(value: string | null | undefined) {
  return normalizeReferralCode(value) ?? (isSpecialReferralCampaignCode(value) ? SPECIAL_REFERRAL_CAMPAIGN_CODE : undefined);
}

export function buildReferralInviteUrl(code: string) {
  return `${TOKENFORGE_PUBLIC_ORIGIN}/sign-up?aff=${encodeURIComponent(code)}`;
}

export function buildSpecialReferralCampaignUrl() {
  return `${TOKENFORGE_PUBLIC_ORIGIN}/sign-up?aff=${SPECIAL_REFERRAL_CAMPAIGN_CODE}&via=AmirSNet`;
}
