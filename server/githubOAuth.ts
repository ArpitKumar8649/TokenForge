import { COOKIE_NAME, ONE_YEAR_MS, PUBLIC_ORIGIN } from "@shared/const";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { parse as parseCookieHeader } from "cookie";
import fs from "node:fs";
import type { Express, Request, Response } from "express";
import { getAuthSessionVersion, getEmailAllowlistConfig, hasPreProvisionedAccountEmail, resolveGitHubIdentity } from "./db";
import { isPermanentEmailAddress } from "./localAuth";
import { getSessionCookieOptions } from "./_core/cookies";
import { sdk } from "./_core/sdk";
import { normalizeReferralCampaignCode } from "../shared/referrals";

const GITHUB_AUTHORIZE_URL = "https://github.com/login/oauth/authorize";
const GITHUB_TOKEN_URL = "https://github.com/login/oauth/access_token";
const GITHUB_API_URL = "https://api.github.com";
const GITHUB_STATE_COOKIE = "tf_github_oauth_state";
const GITHUB_VERIFIER_COOKIE = "tf_github_oauth_verifier";
const GITHUB_REFERRAL_COOKIE = "tf_github_oauth_ref";
const LOCAL_SESSION_MAX_AGE_MS = ONE_YEAR_MS;
export const MINIMUM_GITHUB_ACCOUNT_AGE_MS = 14 * 24 * 60 * 60 * 1000;
export const GITHUB_OAUTH_LOG_FILE = "/tmp/github-oauth.log";

type GitHubEmail = { email: string; primary: boolean; verified: boolean };
type GitHubProfile = { id: number; login: string; name: string | null; email: string | null; created_at: string | null };

export function logGitHubOAuth(action: string, meta: Record<string, unknown> = {}) {
  const timestamp = new Date().toISOString();
  const line = `[${timestamp}] [GitHub OAuth] ${action}: ${JSON.stringify(meta)}`;
  console.log(line);
  try {
    fs.appendFileSync(GITHUB_OAUTH_LOG_FILE, line + "\n", "utf8");
  } catch {
    // Non-blocking
  }
}

function getQueryParam(req: Request, key: string): string | undefined {
  const value = req.query[key];
  return typeof value === "string" ? value : undefined;
}

export function appOrigin(req: Pick<Request, "protocol" | "hostname" | "headers">) {
  // The OAuth callback must land on the same host that set the state/verifier
  // cookies. Forwarded headers or Host header must be checked to accurately
  // reflect the requesting browser's origin on Cloud Run, proxies, and custom domains.
  const hostHeader = req.headers?.["x-forwarded-host"] || req.headers?.["host"] || req.hostname;
  const host = (Array.isArray(hostHeader) ? hostHeader[0] : hostHeader)?.split(",")[0]?.trim();

  if (host) {
    const isLocal = host === "localhost" || host.startsWith("localhost:") || host.startsWith("127.0.0.1");
    // Cloud Run and external reverse proxies terminate SSL at the load balancer;
    // all non-localhost traffic must strictly use https.
    const proto = isLocal ? "http" : "https";
    try {
      return new URL(`${proto}://${host}`).origin;
    } catch {
      // Fall through
    }
  }

  // Fallback to explicitly configured environment origins
  const configuredOrigin = process.env.TOKENFORGE_PUBLIC_ORIGIN?.trim() || process.env.APP_URL?.trim();
  if (configuredOrigin) {
    try {
      return new URL(configuredOrigin).origin;
    } catch {
      // Fall through
    }
  }

  return PUBLIC_ORIGIN;
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
  res.clearCookie(GITHUB_REFERRAL_COOKIE, options);
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

/** GitHub supplies this profile timestamp; this server-side check cannot be bypassed by browser state. */
export function isGitHubAccountOldEnough(createdAt: string | null | undefined, now = Date.now()) {
  if (!createdAt) return false;
  const createdAtMs = new Date(createdAt).getTime();
  return Number.isFinite(createdAtMs) && createdAtMs <= now - MINIMUM_GITHUB_ACCOUNT_AGE_MS;
}

/** A reservation may waive account age only after GitHub has supplied the matching verified email. */
export function mayBypassGitHubAccountAge(input: { verifiedEmail: string | null | undefined; hasPreProvisionedReservation: boolean }) {
  return Boolean(input.verifiedEmail?.trim()) && input.hasPreProvisionedReservation;
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
  if (!profile.id || !email || !profile.created_at) throw new Error("GitHub did not provide the verified identity details required by TokenForge");
  return { providerUserId: String(profile.id), email, name: profile.name?.trim() || profile.login?.trim() || null, accountCreatedAt: profile.created_at };
}

function escapeHtml(str: string): string {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function renderOAuthError(res: Response, errorKey: string, heading: string, detail: string) {
  const safeHeading = escapeHtml(heading);
  const safeDetail = escapeHtml(detail);
  const safeErrorKey = escapeHtml(errorKey);

  res.setHeader("Content-Security-Policy", "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'");
  res.status(200).send(`<!DOCTYPE html>
<html>
<head><title>GitHub Sign-In Notice</title></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #12131a; color: #f2f5ee; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0;">
  <div style="text-align: center; padding: 24px; max-width: 440px;">
    <p style="font-size: 16px; font-weight: bold; color: #ef929b; margin-bottom: 8px;">${safeHeading}</p>
    <p style="font-size: 13px; color: #a8a9b6; line-height: 1.5; margin-bottom: 20px;">${safeDetail}</p>
    <div>
      <a href="/signin?github=${encodeURIComponent(errorKey)}" style="display: inline-block; padding: 8px 20px; border-radius: 9999px; background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.15); color: #e2e1ea; font-size: 13px; text-decoration: none; font-weight: 500;">Return to Sign In</a>
    </div>
    <script>
      (function() {
        if (window.opener && !window.opener.closed) {
          try {
            window.opener.postMessage({ type: 'OAUTH_AUTH_ERROR', error: ${JSON.stringify(safeErrorKey)} }, window.location.origin);
            setTimeout(function() {
              try { window.close(); } catch(e) {}
            }, 500);
            return;
          } catch (e) {}
        }
        setTimeout(function() {
          window.location.href = '/signin?github=' + encodeURIComponent(${JSON.stringify(errorKey)});
        }, 1200);
      })();
    </script>
  </div>
</body>
</html>`);
}

export function registerGitHubOAuthRoutes(app: Express) {
  app.get("/api/auth/github/logs", async (req: Request, res: Response) => {
    let user;
    try {
      user = await sdk.authenticateRequest(req);
    } catch {
      return res.status(401).send("Unauthorized: Admin authentication required.");
    }

    if (!user?.isAdminSession) {
      return res.status(403).send("Forbidden: Administrator access required.");
    }

    try {
      if (fs.existsSync(GITHUB_OAUTH_LOG_FILE)) {
        const content = fs.readFileSync(GITHUB_OAUTH_LOG_FILE, "utf8");
        const lines = content.trim().split("\n").slice(-100);
        res.type("text/plain").send(lines.join("\n"));
        return;
      }
    } catch {
      // Fall through
    }
    res.type("text/plain").send("No GitHub OAuth events logged yet.");
  });

  app.get("/api/auth/github", (req: Request, res: Response) => {
    const clientId = process.env.GITHUB_OAUTH_CLIENT_ID;
    const origin = appOrigin(req);
    const redirectUri = callbackUrl(req);
    logGitHubOAuth("Initiate Direct Authorization", {
      clientIdConfigured: Boolean(clientId),
      origin,
      redirectUri,
      hostHeader: req.headers["x-forwarded-host"] || req.headers["host"],
      protoHeader: req.headers["x-forwarded-proto"],
    });

    if (!clientId) {
      logGitHubOAuth("Configuration Missing", { error: "GITHUB_OAUTH_CLIENT_ID missing" });
      res.status(503).json({ error: "GitHub sign-in is temporarily unavailable" });
      return;
    }
    const state = randomUrlToken();
    const verifier = randomUrlToken();
    const referralCode = normalizeReferralCampaignCode(getQueryParam(req, "aff"));
    const options = oauthCookieOptions(req);
    res.cookie(GITHUB_STATE_COOKIE, state, options);
    res.cookie(GITHUB_VERIFIER_COOKIE, verifier, options);
    if (referralCode) res.cookie(GITHUB_REFERRAL_COOKIE, referralCode, options);
    else res.clearCookie(GITHUB_REFERRAL_COOKIE, options);
    res.redirect(302, buildGitHubAuthorizationUrl({ clientId, redirectUri, state, verifier }));
  });

  app.get("/api/auth/github/url", (req: Request, res: Response) => {
    const clientId = process.env.GITHUB_OAUTH_CLIENT_ID;
    const origin = appOrigin(req);
    const redirectUri = callbackUrl(req);
    logGitHubOAuth("Request Popup Authorization URL", {
      clientIdConfigured: Boolean(clientId),
      origin,
      redirectUri,
      hostHeader: req.headers["x-forwarded-host"] || req.headers["host"],
      protoHeader: req.headers["x-forwarded-proto"],
    });

    if (!clientId) {
      logGitHubOAuth("Configuration Missing", { error: "GITHUB_OAUTH_CLIENT_ID missing" });
      res.status(503).json({ error: "GitHub sign-in is temporarily unavailable" });
      return;
    }
    const state = randomUrlToken();
    const verifier = randomUrlToken();
    const referralCode = normalizeReferralCampaignCode(getQueryParam(req, "aff"));
    const options = oauthCookieOptions(req);
    res.cookie(GITHUB_STATE_COOKIE, state, options);
    res.cookie(GITHUB_VERIFIER_COOKIE, verifier, options);
    if (referralCode) res.cookie(GITHUB_REFERRAL_COOKIE, referralCode, options);
    else res.clearCookie(GITHUB_REFERRAL_COOKIE, options);
    res.json({ url: buildGitHubAuthorizationUrl({ clientId, redirectUri, state, verifier }) });
  });

  app.get(["/api/auth/github/callback", "/api/auth/github/callback/"], async (req: Request, res: Response) => {
    const code = getQueryParam(req, "code");
    const state = getQueryParam(req, "state");
    const queryError = getQueryParam(req, "error");
    const queryErrorDesc = getQueryParam(req, "error_description");
    const cookies = parseCookieHeader(req.headers.cookie ?? "");
    const verifier = cookies[GITHUB_VERIFIER_COOKIE];
    const expectedState = cookies[GITHUB_STATE_COOKIE];
    const referralCode = normalizeReferralCampaignCode(cookies[GITHUB_REFERRAL_COOKIE]);
    clearOAuthCookies(req, res);

    logGitHubOAuth("OAuth Callback Received", {
      hasCode: Boolean(code),
      hasState: Boolean(state),
      hasVerifier: Boolean(verifier),
      hasExpectedState: Boolean(expectedState),
      stateMatch: constantTimeEquals(state, expectedState),
      queryError: queryError ?? null,
      queryErrorDesc: queryErrorDesc ?? null,
      redirectUri: callbackUrl(req),
    });

    if (queryError) {
      logGitHubOAuth("Provider Authorization Error", { queryError, queryErrorDesc });
      renderOAuthError(res, "provider-error", "GitHub Authorization Failed", queryErrorDesc || "GitHub rejected the sign-in authorization request.");
      return;
    }

    if (!code || !constantTimeEquals(state, expectedState) || !verifier) {
      logGitHubOAuth("Verification State Mismatch", {
        hasCode: Boolean(code),
        hasVerifier: Boolean(verifier),
        stateMatch: constantTimeEquals(state, expectedState),
      });
      renderOAuthError(res, "state-error", "Authorization Verification Failed", "The authorization state or verifier did not match. Please try signing in again.");
      return;
    }

    try {
      logGitHubOAuth("Exchanging Authorization Code", { redirectUri: callbackUrl(req) });
      const accessToken = await exchangeCode({ code, verifier, redirectUri: callbackUrl(req) });
      logGitHubOAuth("Access Token Exchanged Successfully");

      const identity = await getGitHubIdentity(accessToken);
      logGitHubOAuth("GitHub Identity Retrieved", {
        userId: identity.providerUserId,
        email: identity.email,
        name: identity.name,
        accountCreatedAt: identity.accountCreatedAt,
      });

      const hasPreProvisionedReservation = await hasPreProvisionedAccountEmail(identity.email);
      const mayBypassAge = mayBypassGitHubAccountAge({ verifiedEmail: identity.email, hasPreProvisionedReservation });
      if (!mayBypassAge && !isGitHubAccountOldEnough(identity.accountCreatedAt)) {
        logGitHubOAuth("Account Age Validation Failed", { accountCreatedAt: identity.accountCreatedAt });
        renderOAuthError(res, "account-too-new", "Account Too New", "GitHub accounts must be at least 14 days old to register on TokenForge.");
        return;
      }

      const emailPolicy = await getEmailAllowlistConfig();
      if (!isPermanentEmailAddress(identity.email, emailPolicy?.entries)) {
        logGitHubOAuth("Email Address Disallowed", { email: identity.email });
        renderOAuthError(res, "email-not-allowed", "Email Not Allowed", "Disposable or disallowed email addresses cannot be used with TokenForge.");
        return;
      }

      const result = await resolveGitHubIdentity({ ...identity, referralCode });
      if (result.kind === "link_required") {
        logGitHubOAuth("Account Linking Required", { email: identity.email });
        renderOAuthError(res, "link-required", "Account Linking Required", "An account with this email already exists. Please verify with your email to link GitHub.");
        return;
      }

      const sessionVersion = await getAuthSessionVersion();
      const sessionToken = await sdk.createSessionToken(result.user.openId, { expiresInMs: LOCAL_SESSION_MAX_AGE_MS, name: result.user.name ?? "TokenForge developer", sessionVersion });
      const cookieOpts = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, {
        ...cookieOpts,
        sameSite: cookieOpts.secure ? "none" : "lax",
        maxAge: LOCAL_SESSION_MAX_AGE_MS,
      });

      logGitHubOAuth("Authentication Successful", {
        userId: result.user.id,
        email: result.user.email,
        isNewUser: result.kind === "created",
      });

      res.setHeader("Content-Security-Policy", "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'");
      res.status(200).send(`<!DOCTYPE html>
<html>
<head><title>GitHub Sign-In Success</title></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #12131a; color: #f2f5ee; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0;">
  <div style="text-align: center; padding: 24px; max-width: 440px;">
    <p style="font-size: 16px; font-weight: bold; color: #c9ff73; margin-bottom: 8px;">Authentication Successful</p>
    <p style="font-size: 13px; color: #a8a9b6; margin-bottom: 20px;">Entering your developer workspace…</p>
    <div>
      <a href="/dashboard" style="display: inline-block; padding: 8px 20px; border-radius: 9999px; background: #c9ff73; color: #17210d; font-size: 13px; font-weight: 600; text-decoration: none;">Continue to Workspace &rarr;</a>
    </div>
    <script>
      (function() {
        var notified = false;
        if (window.opener && !window.opener.closed) {
          try {
            window.opener.postMessage({ type: 'OAUTH_AUTH_SUCCESS' }, window.location.origin);
            notified = true;
          } catch (e) {}
        }
        if (notified) {
          setTimeout(function() {
            try { window.close(); } catch(e) {}
            setTimeout(function() { window.location.href = '/dashboard'; }, 300);
          }, 250);
        } else {
          setTimeout(function() { window.location.href = '/dashboard'; }, 500);
        }
      })();
    </script>
  </div>
</body>
</html>`);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      logGitHubOAuth("Callback Failed With Exception", { error: msg });
      console.error("[GitHub OAuth] Callback failed", msg);
      renderOAuthError(res, "failed", "Sign-in Failed", "Unable to complete GitHub sign-in. " + msg);
    }
  });
}
