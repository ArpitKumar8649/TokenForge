import { describe, expect, it } from "vitest";
import { appOrigin, buildGitHubAuthorizationUrl, isGitHubAccountOldEnough, mayBypassGitHubAccountAge, MINIMUM_GITHUB_ACCOUNT_AGE_MS, selectVerifiedGitHubEmail } from "./githubOAuth";

describe("GitHub OAuth flow primitives", () => {
  it("creates a PKCE authorization request without exposing a client secret", () => {
    const authorizationUrl = buildGitHubAuthorizationUrl({
      clientId: "client-id",
      redirectUri: "https://tokenforge-api-0mrs.onrender.com/api/auth/github/callback",
      state: "csrf-state",
      verifier: "verifier-for-tokenforge-tests",
    });
    const url = new URL(authorizationUrl);

    expect(url.origin).toBe("https://github.com");
    expect(url.searchParams.get("scope")).toBe("read:user user:email");
    expect(url.searchParams.get("state")).toBe("csrf-state");
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(authorizationUrl).not.toContain("client_secret");
  });

  it("uses TokenForge's stable public origin instead of the internal deployment hostname", () => {
    expect(appOrigin({ protocol: "https", hostname: "oqxlgfryso-ilvd6ib5ma-uk.a.run.app" })).toBe(
      "https://tokenforge-api-0mrs.onrender.com",
    );
  });

  it("prefers GitHub's verified primary address and never accepts an unverified address", () => {
    expect(selectVerifiedGitHubEmail("profile@example.com", [
      { email: "secondary@example.com", primary: false, verified: true },
      { email: "primary@example.com", primary: true, verified: true },
    ])).toBe("primary@example.com");
    expect(selectVerifiedGitHubEmail(null, [{ email: "unverified@example.com", primary: true, verified: false }])).toBeNull();
    expect(selectVerifiedGitHubEmail("profile-only@example.com", [])).toBeNull();
  });

  it("requires a GitHub account to be at least fourteen days old", () => {
    const now = Date.parse("2026-08-18T00:00:00.000Z");
    expect(isGitHubAccountOldEnough(new Date(now - MINIMUM_GITHUB_ACCOUNT_AGE_MS).toISOString(), now)).toBe(true);
    expect(isGitHubAccountOldEnough(new Date(now - MINIMUM_GITHUB_ACCOUNT_AGE_MS + 1).toISOString(), now)).toBe(false);
    expect(isGitHubAccountOldEnough("not-a-date", now)).toBe(false);
    expect(isGitHubAccountOldEnough(null, now)).toBe(false);
  });

  it("waives GitHub account age only for a matching verified-email pre-provisioned reservation", () => {
    expect(mayBypassGitHubAccountAge({ verifiedEmail: "reserved@example.com", hasPreProvisionedReservation: true })).toBe(true);
    expect(mayBypassGitHubAccountAge({ verifiedEmail: "", hasPreProvisionedReservation: true })).toBe(false);
    expect(mayBypassGitHubAccountAge({ verifiedEmail: "ordinary@example.com", hasPreProvisionedReservation: false })).toBe(false);
  });
});
