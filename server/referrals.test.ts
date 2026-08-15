import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  TOKENFORGE_PUBLIC_ORIGIN,
  TOKENFORGE_AFFILIATE_CODE_LENGTH,
  TOKENFORGE_REFERRAL_REWARD_NANOS,
  TOKENFORGE_REFERRAL_REWARD_USD,
  buildReferralInviteUrl,
  normalizeReferralCode,
} from "../shared/referrals";

const dbSource = readFileSync(path.resolve(import.meta.dirname, "./db.ts"), "utf8");
const routerSource = readFileSync(path.resolve(import.meta.dirname, "./routers.ts"), "utf8");
const oauthSource = readFileSync(path.resolve(import.meta.dirname, "./githubOAuth.ts"), "utf8");
const clientSource = readFileSync(path.resolve(import.meta.dirname, "../client/src/pages/LocalAuth.tsx"), "utf8");
const appSource = readFileSync(path.resolve(import.meta.dirname, "../client/src/App.tsx"), "utf8");
const mainSource = readFileSync(path.resolve(import.meta.dirname, "../client/src/main.tsx"), "utf8");
const schemaSource = readFileSync(path.resolve(import.meta.dirname, "../drizzle/schema.ts"), "utf8");

describe("TokenForge referrals", () => {
  it("uses the canonical hosted affiliate URL and an equal $10 reward for each eligible account", () => {
    expect(TOKENFORGE_PUBLIC_ORIGIN).toBe("https://tokengate-cqt9ivzs.manus.space");
    expect(TOKENFORGE_REFERRAL_REWARD_USD).toBe(10);
    expect(TOKENFORGE_REFERRAL_REWARD_NANOS).toBe(10_000_000_000);
    expect(TOKENFORGE_AFFILIATE_CODE_LENGTH).toBe(4);
    expect(buildReferralInviteUrl("a7xp")).toBe("https://tokengate-cqt9ivzs.manus.space/sign-up?aff=a7xp");
  });

  it("accepts only four-character alphanumeric affiliate codes", () => {
    expect(normalizeReferralCode(" A7XP ")).toBe("a7xp");
    expect(normalizeReferralCode("abc")).toBeUndefined();
    expect(normalizeReferralCode("a7xp9")).toBeUndefined();
    expect(normalizeReferralCode("a7-p")).toBeUndefined();
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
    expect(dbSource).toContain("AFFILIATE_CODE_ALPHABET");
    expect(dbSource).toContain("randomInt(AFFILIATE_CODE_ALPHABET.length)");
    expect(dbSource).toContain("attempt < 8");
    expect(schemaSource).toContain('code: varchar("code", { length: 4 }).notNull().unique()');
  });

  it("captures `aff` separately from pathname routing and preserves it for both signup methods", () => {
    expect(clientSource).toContain("import { Link, useLocation, useSearch } from \"wouter\"");
    expect(clientSource).toContain("const search = useSearch()");
    expect(clientSource).toContain("normalizeReferralCode(new URLSearchParams(search).get(\"aff\"))");
    expect(clientSource).toContain("const referralQuery = referralCode ? `?aff=${encodeURIComponent(referralCode)}` : \"\";");
    expect(clientSource).toContain("register.mutateAsync({ email, password, name: name || undefined, referralCode })");
    expect(clientSource).toContain("window.location.assign(`/api/auth/github${referralQuery}`)");
    expect(oauthSource).toContain('getQueryParam(req, "aff")');
    expect(appSource).toContain('<Route path={"/sign-up"}>{() => <LocalAuth mode="signup" />}</Route>');
    expect(mainSource).toContain('window.location.pathname !== "/sign-up"');
  });
});
