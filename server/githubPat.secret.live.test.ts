import { describe, expect, it } from "vitest";

const githubPat = process.env.GITHUB_PAT_TOKEN?.trim();

describe.runIf(Boolean(githubPat))("server-only GitHub personal access token", () => {
  it("authenticates against GitHub without exposing token material", async () => {
    const response = await fetch("https://api.github.com/user", {
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${githubPat}`,
        "X-GitHub-Api-Version": "2022-11-28",
      },
    });

    expect(response.ok).toBe(true);
    const body = await response.json() as { login?: unknown };
    expect(typeof body.login).toBe("string");
    expect(body.login).not.toHaveLength(0);
  }, 15_000);
});
