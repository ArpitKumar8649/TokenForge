import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const authPagePath = path.resolve(import.meta.dirname, "../client/src/pages/LocalAuth.tsx");
const authStylesPath = path.resolve(import.meta.dirname, "../client/src/auth-refresh.css");

describe("TokenForge authentication presentation", () => {
  const authPage = readFileSync(authPagePath, "utf8");
  const authStyles = readFileSync(authStylesPath, "utf8");

  it("uses the supplied managed ghost artwork and presents GitHub as the only account entry method", () => {
    expect(authPage).toContain('src="/manus-storage/tokenforge-auth-ghost_e3dbdc71.jpg"');
    expect(authPage).toContain("Continue with GitHub");
    expect(authPage).not.toContain("Sign in with email");
    expect(authPage).not.toContain("Create account with email");
  });

  it("retains the secure GitHub authorization, account-age, and referral hooks", () => {
    expect(authPage).toContain("GitHub accounts must be at least 14 days old");
    expect(authPage).toContain("verified permanent GitHub email address");
    expect(authPage).toContain("window.location.assign(`/api/auth/github${referralQuery}`)");
    expect(authPage).not.toContain("register.mutateAsync");
    expect(authPage).not.toContain("login.mutateAsync");
  });

  it("keeps the artwork-led layout responsive for mobile users", () => {
    expect(authStyles).toContain(".local-auth-showcase");
    expect(authStyles).toContain(".local-auth-artwork");
    expect(authStyles).toContain("@media (max-width: 900px)");
    expect(authStyles).toContain("@media (max-width: 520px)");
  });
});
