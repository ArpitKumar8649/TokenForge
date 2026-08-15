import { describe, expect, it } from "vitest";
import { buildGitHubAuthorizationUrl, selectVerifiedGitHubEmail } from "./githubOAuth";

describe("GitHub OAuth flow primitives", () => {
  it("creates a PKCE authorization request without exposing a client secret", () => {
    const authorizationUrl = buildGitHubAuthorizationUrl({
      clientId: "client-id",
      redirectUri: "https://tokengate-cqt9ivzs.manus.space/api/auth/github/callback",
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

  it("prefers GitHub's verified primary address and never accepts an unverified address", () => {
    expect(selectVerifiedGitHubEmail("profile@example.com", [
      { email: "secondary@example.com", primary: false, verified: true },
      { email: "primary@example.com", primary: true, verified: true },
    ])).toBe("primary@example.com");
    expect(selectVerifiedGitHubEmail(null, [{ email: "unverified@example.com", primary: true, verified: false }])).toBeNull();
    expect(selectVerifiedGitHubEmail("profile-only@example.com", [])).toBeNull();
  });
});
