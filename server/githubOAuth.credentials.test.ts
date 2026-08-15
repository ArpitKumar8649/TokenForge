import { describe, expect, it } from "vitest";

describe("GitHub OAuth client credentials", () => {
  it("are accepted by GitHub's token endpoint before a user authorization code is supplied", async () => {
    const clientId = process.env.GITHUB_OAUTH_CLIENT_ID;
    const clientSecret = process.env.GITHUB_OAUTH_CLIENT_SECRET;

    expect(clientId).toBeTruthy();
    expect(clientSecret).toBeTruthy();

    const response = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code: "tokenforge-credential-check-without-user-code",
      }),
    });
    const payload = await response.json() as { error?: string };

    expect(response.status).toBe(200);
    expect(payload.error).toBe("bad_verification_code");
  }, 20_000);
});
