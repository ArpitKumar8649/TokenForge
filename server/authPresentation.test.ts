import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const authPagePath = path.resolve(import.meta.dirname, "../client/src/pages/LocalAuth.tsx");
const authStylesPath = path.resolve(import.meta.dirname, "../client/src/auth-refresh.css");

describe("TokenForge authentication presentation", () => {
  const authPage = readFileSync(authPagePath, "utf8");
  const authStyles = readFileSync(authStylesPath, "utf8");

  it("uses the supplied managed ghost artwork and presents both account entry methods", () => {
    expect(authPage).toContain('src="/manus-storage/tokenforge-auth-ghost_e3dbdc71.jpg"');
    expect(authPage).toContain("Continue with GitHub");
    expect(authPage).toContain("Sign in with email");
    expect(authPage).toContain("Create account with email");
  });

  it("retains the secure registration, sign-in, and provider-policy hooks", () => {
    expect(authPage).toContain("isEstablishedEmailAddress(email)");
    expect(authPage).toContain("register.mutateAsync");
    expect(authPage).toContain("login.mutateAsync");
    expect(authPage).toContain("window.location.assign(`/api/auth/github${referralQuery}`)");
    expect(authPage).toContain('autoComplete={isSignup ? "new-password" : "current-password"}');
  });

  it("keeps the artwork-led layout responsive for mobile users", () => {
    expect(authStyles).toContain(".local-auth-showcase");
    expect(authStyles).toContain(".local-auth-artwork");
    expect(authStyles).toContain("@media (max-width: 900px)");
    expect(authStyles).toContain("@media (max-width: 520px)");
  });
});
