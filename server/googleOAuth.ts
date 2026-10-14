import { COOKIE_NAME, ONE_YEAR_MS, PUBLIC_ORIGIN } from "@shared/const";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { parse as parseCookieHeader } from "cookie";
import type { Express, Request, Response } from "express";
import { getAuthSessionVersion, getEmailAllowlistConfig, resolveGoogleIdentity } from "./db";
import { isPermanentEmailAddress } from "./localAuth";
import { getSessionCookieOptions } from "./_core/cookies";
import { sdk } from "./_core/sdk";
import { normalizeReferralCampaignCode } from "../shared/referrals";

const GOOGLE_AUTHORIZE_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo";
const GOOGLE_STATE_COOKIE = "tf_google_oauth_state";
const GOOGLE_VERIFIER_COOKIE = "tf_google_oauth_verifier";
const GOOGLE_REFERRAL_COOKIE = "tf_google_oauth_ref";
const LOCAL_SESSION_MAX_AGE_MS = ONE_YEAR_MS;

type GoogleUserInfo = {
  sub: string;
  email: string;
  email_verified?: boolean | string;
  name?: string | null;
  picture?: string | null;
};

export function getGoogleClientId(): string | undefined {
  return (
    process.env.GOOGLE_CLIENT_ID?.trim() ||
    process.env.GOOGLE_OAUTH_CLIENT_ID?.trim() ||
    undefined
  );
}

export function getGoogleClientSecret(): string | undefined {
  return (
    process.env.GOOGLE_CLIENT_SECRET?.trim() ||
    process.env.GOOGLE_OAUTH_CLIENT_SECRET?.trim() ||
    undefined
  );
}

function getQueryParam(req: Request, key: string): string | undefined {
  const value = req.query[key];
  return typeof value === "string" ? value : undefined;
}

export function appOrigin(req: Pick<Request, "protocol" | "hostname" | "headers">) {
  const hostHeader = req.headers?.["x-forwarded-host"] || req.headers?.["host"] || req.hostname;
  const host = (Array.isArray(hostHeader) ? hostHeader[0] : hostHeader)?.split(",")[0]?.trim();
  const protoHeader = req.headers?.["x-forwarded-proto"];
  const protocol = (Array.isArray(protoHeader) ? protoHeader[0] : protoHeader)?.split(",")[0]?.trim() || (req.protocol === "https" ? "https" : "https");

  if (host && host !== "localhost" && !host.startsWith("localhost:") && !host.startsWith("127.0.0.1")) {
    try {
      return new URL(`${protocol}://${host}`).origin;
    } catch {
      // Fall through
    }
  }

  const configuredOrigin = process.env.TOKENFORGE_PUBLIC_ORIGIN?.trim();
  if (configuredOrigin) {
    try {
      const origin = new URL(configuredOrigin);
      return origin.origin;
    } catch {
      // Fall through
    }
  }

  if (host) {
    try {
      const proto = protocol || (host.includes("localhost") || host.includes("127.0.0.1") ? "http" : "https");
      return new URL(`${proto}://${host}`).origin;
    } catch {
      // Fall through
    }
  }

  return PUBLIC_ORIGIN;
}

function callbackUrl(req: Request) {
  return `${appOrigin(req)}/api/auth/google/callback`;
}

function oauthCookieOptions(req: Request) {
  const sessionOptions = getSessionCookieOptions(req);
  return {
    ...sessionOptions,
    path: "/api/auth/google",
    sameSite: sessionOptions.secure ? ("none" as const) : ("lax" as const),
    maxAge: 10 * 60 * 1000,
  };
}

function clearOAuthCookies(req: Request, res: Response) {
  const options = oauthCookieOptions(req);
  res.clearCookie(GOOGLE_STATE_COOKIE, options);
  res.clearCookie(GOOGLE_VERIFIER_COOKIE, options);
  res.clearCookie(GOOGLE_REFERRAL_COOKIE, options);
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

export function buildGoogleAuthorizationUrl(input: {
  clientId: string;
  redirectUri: string;
  state: string;
  verifier: string;
}) {
  const url = new URL(GOOGLE_AUTHORIZE_URL);
  url.searchParams.set("client_id", input.clientId);
  url.searchParams.set("redirect_uri", input.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "openid email profile");
  url.searchParams.set("state", input.state);
  url.searchParams.set("code_challenge", codeChallenge(input.verifier));
  url.searchParams.set("code_challenge_method", "S256");
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "select_account");
  return url.toString();
}

async function exchangeCode(input: { code: string; verifier: string; redirectUri: string }) {
  const clientId = getGoogleClientId();
  const clientSecret = getGoogleClientSecret();
  if (!clientId || !clientSecret) throw new Error("Google OAuth is not configured");

  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code: input.code,
      redirect_uri: input.redirectUri,
      code_verifier: input.verifier,
      grant_type: "authorization_code",
    }),
  });

  const payload = (await response.json()) as { access_token?: string; id_token?: string; error?: string; error_description?: string };
  if (!response.ok || !payload.access_token) {
    throw new Error(payload.error_description || payload.error || "Google did not return an access token");
  }
  return payload.access_token;
}

async function getGoogleIdentity(accessToken: string) {
  const headers = { Authorization: `Bearer ${accessToken}`, Accept: "application/json" };
  const response = await fetch(GOOGLE_USERINFO_URL, { headers });
  if (!response.ok) throw new Error("Google profile lookup failed");
  const profile = (await response.json()) as GoogleUserInfo;
  if (!profile.sub || !profile.email) {
    throw new Error("Google did not provide the verified identity details required by TokenForge");
  }
  return {
    providerUserId: String(profile.sub),
    email: profile.email.trim().toLowerCase(),
    name: profile.name?.trim() || profile.email.split("@")[0] || null,
  };
}

export function registerGoogleOAuthRoutes(app: Express) {
  app.get("/api/auth/google", (req: Request, res: Response) => {
    const clientId = getGoogleClientId();
    if (!clientId) {
      res.status(503).json({ error: "Google sign-in is temporarily unavailable. Please verify GOOGLE_CLIENT_ID configuration." });
      return;
    }
    const state = randomUrlToken();
    const verifier = randomUrlToken();
    const referralCode = normalizeReferralCampaignCode(getQueryParam(req, "aff"));
    const options = oauthCookieOptions(req);
    res.cookie(GOOGLE_STATE_COOKIE, state, options);
    res.cookie(GOOGLE_VERIFIER_COOKIE, verifier, options);
    if (referralCode) res.cookie(GOOGLE_REFERRAL_COOKIE, referralCode, options);
    else res.clearCookie(GOOGLE_REFERRAL_COOKIE, options);

    const authUrl = buildGoogleAuthorizationUrl({
      clientId,
      redirectUri: callbackUrl(req),
      state,
      verifier,
    });
    res.redirect(302, authUrl);
  });

  app.get("/api/auth/google/callback", async (req: Request, res: Response) => {
    const code = getQueryParam(req, "code");
    const state = getQueryParam(req, "state");
    const cookies = parseCookieHeader(req.headers.cookie ?? "");
    const verifier = cookies[GOOGLE_VERIFIER_COOKIE];
    const expectedState = cookies[GOOGLE_STATE_COOKIE];
    const referralCode = normalizeReferralCampaignCode(cookies[GOOGLE_REFERRAL_COOKIE]);
    clearOAuthCookies(req, res);

    if (!code || !constantTimeEquals(state, expectedState) || !verifier) {
      res.redirect(302, "/signin?google=state-error");
      return;
    }

    try {
      const accessToken = await exchangeCode({ code, verifier, redirectUri: callbackUrl(req) });
      const identity = await getGoogleIdentity(accessToken);

      const emailPolicy = await getEmailAllowlistConfig();
      if (!isPermanentEmailAddress(identity.email, emailPolicy?.entries)) {
        res.redirect(302, "/signin?google=email-not-allowed");
        return;
      }

      const result = await resolveGoogleIdentity({ ...identity, referralCode });
      if (result.kind === "link_required") {
        res.redirect(302, "/signin?google=link-required");
        return;
      }

      const sessionVersion = await getAuthSessionVersion();
      const sessionToken = await sdk.createSessionToken(result.user.openId, {
        expiresInMs: LOCAL_SESSION_MAX_AGE_MS,
        name: result.user.name ?? "TokenForge developer",
        sessionVersion,
      });

      res.cookie(COOKIE_NAME, sessionToken, {
        ...getSessionCookieOptions(req),
        maxAge: LOCAL_SESSION_MAX_AGE_MS,
      });

      res.redirect(302, "/dashboard");
    } catch (error) {
      console.error("[Google OAuth] Callback failed", error instanceof Error ? error.message : error);
      res.redirect(302, "/signin?google=failed");
    }
  });
}
