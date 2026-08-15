import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  TOKENFORGE_PUBLIC_ORIGIN,
  TOKENFORGE_REFERRAL_REWARD_NANOS,
  TOKENFORGE_REFERRAL_REWARD_USD,
  buildReferralInviteUrl,
  normalizeReferralCode,
} from "../shared/referrals";

const dbSource = readFileSync(path.resolve(import.meta.dirname, "./db.ts"), "utf8");
const routerSource = readFileSync(path.resolve(import.meta.dirname, "./routers.ts"), "utf8");
const oauthSource = readFileSync(path.resolve(import.meta.dirname, "./githubOAuth.ts"), "utf8");

describe("TokenForge referrals", () => {
  it("uses the canonical hosted signup URL and an equal $10 reward for each eligible account", () => {
    expect(TOKENFORGE_PUBLIC_ORIGIN).toBe("https://tokengate-cqt9ivzs.manus.space");
    expect(TOKENFORGE_REFERRAL_REWARD_USD).toBe(10);
    expect(TOKENFORGE_REFERRAL_REWARD_NANOS).toBe(10_000_000_000);
    expect(buildReferralInviteUrl("AB12CD34")).toBe("https://tokengate-cqt9ivzs.manus.space/signup?ref=AB12CD34");
  });

  it("accepts only opaque normalized referral codes", () => {
    expect(normalizeReferralCode(" ab12cd34 ")).toBe("AB12CD34");
    expect(normalizeReferralCode("ABC123")).toBeUndefined();
    expect(normalizeReferralCode("ab12-cd34")).toBeUndefined();
    expect(normalizeReferralCode(undefined)).toBeUndefined();
  });

  it("retains anti-abuse and exactly-once settlement safeguards across registration methods", () => {
    expect(dbSource).toContain("!invitation || invitation.userId === referredUserId");
    expect(dbSource).toContain("reason: \"already_rewarded\"");
    expect(dbSource).toContain("referralAttributions");
    expect(dbSource).toContain("kind: \"referral_reward\"");
    expect(dbSource).toContain("await awardReferralForNewUser(userId, input.referralCode)");
    expect(routerSource).toContain("referralCode: z.string().trim().max(100).optional()");
    expect(routerSource).toContain("getReferralOverview(ctx.user.id)");
    expect(oauthSource).toContain("normalizeReferralCode(cookies[GITHUB_REFERRAL_COOKIE])");
    expect(oauthSource).toContain("resolveGitHubIdentity({ ...identity, referralCode })");
  });
});
