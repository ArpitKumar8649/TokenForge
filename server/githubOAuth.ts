import { COOKIE_NAME } from "@shared/const";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { parse as parseCookieHeader } from "cookie";
import type { Express, Request, Response } from "express";
import { getEmailAllowlistConfig, resolveGitHubIdentity } from "./db";
import { isPermanentEmailAddress } from "./localAuth";
import { getSessionCookieOptions } from "./_core/cookies";
import { sdk } from "./_core/sdk";

const GITHUB_AUTHORIZE_URL = "https://github.com/login/oauth/authorize";
const GITHUB_TOKEN_URL = "https://github.com/login/oauth/access_token";
const GITHUB_API_URL = "https://api.github.com";
const GITHUB_STATE_COOKIE = "tf_github_oauth_state";
const GITHUB_VERIFIER_COOKIE = "tf_github_oauth_verifier";
const LOCAL_SESSION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

type GitHubEmail = { email: string; primary: boolean; verified: boolean };
type GitHubProfile = { id: number; login: string; name: string | null; email: string | null };

function getQueryParam(req: Request, key: string): string | undefined {
  const value = req.query[key];
  return typeof value === "string" ? value : undefined;
}

function appOrigin(req: Request) {
  return `${req.protocol}://${req.get("host")}`;
}

function callbackUrl(req: Request) {
  return `${appOrigin(req)}/api/auth/github/callback`;
}

function oauthCookieOptions(req: Request) {
  const sessionOptions = getSessionCookieOptions(req);
  return { ...sessionOptions, path: "/api/auth/github", sameSite: sessionOptions.secure ? "none" as const : "lax" as const, maxAge: 10 * 60 * 1000 };
}

function clearOAuthCookies(req: Request, res: Response) {
  const options = oauthCookieOptions(req);
  res.clearCookie(GITHUB_STATE_COOKIE, options);
  res.clearCookie(GITHUB_VERIFIER_COOKIE, options);
}

function randomUrlToken() {
  return randomBytes(32).toString("base64url");
}

function codeChallenge(verifier: string) {
  return createHash("sha256").update(verifier).digest("base64url");
}

function constantTimeEquals(left: string | undefined, right: string | undefined) {
  if (!left || !right || left.length !== right.length) return false;
  return timingSafeEqual(Buffer.from(left), Buffer.from(right));
}

export function buildGitHubAuthorizationUrl(input: { clientId: string; redirectUri: string; state: string; verifier: string }) {
  const url = new URL(GITHUB_AUTHORIZE_URL);
  url.searchParams.set("client_id", input.clientId);
  url.searchParams.set("redirect_uri", input.redirectUri);
  url.searchParams.set("scope", "read:user user:email");
  url.searchParams.set("state", input.state);
  url.searchParams.set("code_challenge", codeChallenge(input.verifier));
  url.searchParams.set("code_challenge_method", "S256");
  return url.toString();
}

export function selectVerifiedGitHubEmail(_profileEmail: string | null, emails: GitHubEmail[]) {
  const verifiedPrimary = emails.find(email => email.primary && email.verified)?.email;
  return verifiedPrimary ?? emails.find(email => email.verified)?.email ?? null;
}

async function exchangeCode(input: { code: string; verifier: string; redirectUri: string }) {
  const clientId = process.env.GITHUB_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GITHUB_OAUTH_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error("GitHub OAuth is not configured");
  const response = await fetch(GITHUB_TOKEN_URL, {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, code: input.code, redirect_uri: input.redirectUri, code_verifier: input.verifier }),
  });
  const payload = await response.json() as { access_token?: string; error?: string };
  if (!response.ok || !payload.access_token) throw new Error(payload.error || "GitHub did not return an access token");
  return payload.access_token;
}

async function getGitHubIdentity(accessToken: string) {
  const headers = { Authorization: `Bearer ${accessToken}`, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" };
  const profileResponse = await fetch(`${GITHUB_API_URL}/user`, { headers });
  if (!profileResponse.ok) throw new Error("GitHub profile lookup failed");
  const profile = await profileResponse.json() as GitHubProfile;
  const emailsResponse = await fetch(`${GITHUB_API_URL}/user/emails`, { headers });
  const emails = emailsResponse.ok ? await emailsResponse.json() as GitHubEmail[] : [];
  const email = selectVerifiedGitHubEmail(profile.email, emails);
  if (!profile.id || !email) throw new Error("GitHub did not provide a verified email address");
  return { providerUserId: String(profile.id), email, name: profile.name?.trim() || profile.login?.trim() || null };
}

export function registerGitHubOAuthRoutes(app: Express) {
  app.get("/api/auth/github", (req: Request, res: Response) => {
    const clientId = process.env.GITHUB_OAUTH_CLIENT_ID;
    if (!clientId) {
      res.status(503).json({ error: "GitHub sign-in is temporarily unavailable" });
      return;
    }
    const state = randomUrlToken();
    const verifier = randomUrlToken();
    const options = oauthCookieOptions(req);
    res.cookie(GITHUB_STATE_COOKIE, state, options);
    res.cookie(GITHUB_VERIFIER_COOKIE, verifier, options);
    res.redirect(302, buildGitHubAuthorizationUrl({ clientId, redirectUri: callbackUrl(req), state, verifier }));
  });

  app.get("/api/auth/github/callback", async (req: Request, res: Response) => {
    const code = getQueryParam(req, "code");
    const state = getQueryParam(req, "state");
    const cookies = parseCookieHeader(req.headers.cookie ?? "");
    const verifier = cookies[GITHUB_VERIFIER_COOKIE];
    const expectedState = cookies[GITHUB_STATE_COOKIE];
    clearOAuthCookies(req, res);
    if (!code || !constantTimeEquals(state, expectedState) || !verifier) {
      res.redirect(302, "/signin?github=state-error");
      return;
    }
    try {
      const accessToken = await exchangeCode({ code, verifier, redirectUri: callbackUrl(req) });
      const identity = await getGitHubIdentity(accessToken);
      const emailPolicy = await getEmailAllowlistConfig();
      if (!isPermanentEmailAddress(identity.email, emailPolicy?.entries)) {
        res.redirect(302, "/signin?github=email-not-allowed");
        return;
      }
      const result = await resolveGitHubIdentity(identity);
      if (result.kind === "link_required") {
        res.redirect(302, "/signin?github=link-required");
        return;
      }
      const sessionToken = await sdk.createSessionToken(result.user.openId, { expiresInMs: LOCAL_SESSION_MAX_AGE_MS, name: result.user.name ?? "TokenForge developer" });
      res.cookie(COOKIE_NAME, sessionToken, { ...getSessionCookieOptions(req), maxAge: LOCAL_SESSION_MAX_AGE_MS });
      res.redirect(302, "/dashboard");
    } catch (error) {
      console.error("[GitHub OAuth] Callback failed", error instanceof Error ? error.message : error);
      res.redirect(302, "/signin?github=failed");
    }
  });
}
