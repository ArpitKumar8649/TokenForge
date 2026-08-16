import { randomBytes, timingSafeEqual } from "node:crypto";
import { parse as parseCookieHeader } from "cookie";
import type { Express, Request, Response } from "express";
import { markDiscordVerified } from "./db";
import { appOrigin } from "./githubOAuth";
import { getSessionCookieOptions } from "./_core/cookies";
import { ENV } from "./_core/env";
import { sdk } from "./_core/sdk";

const DISCORD_AUTHORIZE_URL = "https://discord.com/oauth2/authorize";
const DISCORD_TOKEN_URL = "https://discord.com/api/v10/oauth2/token";
const DISCORD_API_URL = "https://discord.com/api/v10";
const DISCORD_STATE_COOKIE = "tf_discord_oauth_state";
const DISCORD_ACCOUNT_COOKIE = "tf_discord_oauth_account";
const DISCORD_INVITE_URL = "https://discord.gg/pnsWamDbe";

type DiscordIdentity = { id: string };

function getQueryParam(req: Request, key: string): string | undefined {
  const value = req.query[key];
  return typeof value === "string" ? value : undefined;
}

function callbackUrl(req: Request) {
  return `${appOrigin(req)}/api/auth/discord/callback`;
}

function oauthCookieOptions(req: Request) {
  const sessionOptions = getSessionCookieOptions(req);
  return {
    ...sessionOptions,
    path: "/api/auth/discord",
    sameSite: sessionOptions.secure ? "none" as const : "lax" as const,
    maxAge: 10 * 60 * 1_000,
  };
}

function clearOAuthCookies(req: Request, res: Response) {
  const options = oauthCookieOptions(req);
  res.clearCookie(DISCORD_STATE_COOKIE, options);
  res.clearCookie(DISCORD_ACCOUNT_COOKIE, options);
}

function randomUrlToken() {
  return randomBytes(32).toString("base64url");
}

function constantTimeEquals(left: string | undefined, right: string | undefined) {
  if (!left || !right || left.length !== right.length) return false;
  return timingSafeEqual(Buffer.from(left), Buffer.from(right));
}

export function buildDiscordAuthorizationUrl(input: { clientId: string; redirectUri: string; state: string }) {
  const url = new URL(DISCORD_AUTHORIZE_URL);
  url.searchParams.set("client_id", input.clientId);
  url.searchParams.set("redirect_uri", input.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "identify");
  url.searchParams.set("state", input.state);
  return url.toString();
}

async function exchangeCode(input: { code: string; redirectUri: string }) {
  if (!ENV.discordClientId || !ENV.discordClientSecret) throw new Error("Discord OAuth is not configured");
  const response = await fetch(DISCORD_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: ENV.discordClientId,
      client_secret: ENV.discordClientSecret,
      grant_type: "authorization_code",
      code: input.code,
      redirect_uri: input.redirectUri,
    }),
  });
  const payload = await response.json() as { access_token?: string; error?: string };
  if (!response.ok || !payload.access_token) throw new Error(payload.error || "Discord did not return an access token");
  return payload.access_token;
}

async function getDiscordIdentity(accessToken: string) {
  const response = await fetch(`${DISCORD_API_URL}/users/@me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) throw new Error("Discord identity lookup failed");
  const identity = await response.json() as DiscordIdentity;
  if (!identity.id) throw new Error("Discord did not return an account identifier");
  return identity;
}

export async function isDiscordGuildMember(input: {
  guildId: string;
  discordUserId: string;
  botToken: string;
  fetchImpl?: typeof fetch;
}) {
  const response = await (input.fetchImpl ?? fetch)(
    `${DISCORD_API_URL}/guilds/${encodeURIComponent(input.guildId)}/members/${encodeURIComponent(input.discordUserId)}`,
    { headers: { Authorization: `Bot ${input.botToken}` } },
  );
  if (response.status === 404) return false;
  if (!response.ok) throw new Error("Discord guild membership lookup failed");
  return true;
}

function redirectToVerificationError(res: Response, error: "not-member" | "failed" | "state-error") {
  res.redirect(302, `/verify-discord?error=${error}`);
}

export function registerDiscordOAuthRoutes(app: Express) {
  app.get("/api/auth/discord", async (req: Request, res: Response) => {
    if (!ENV.discordClientId || !ENV.discordClientSecret || !ENV.discordBotToken || !ENV.discordGuildId) {
      res.status(503).json({ error: "Discord membership verification is temporarily unavailable" });
      return;
    }
    try {
      const user = await sdk.authenticateRequest(req);
      if (user.isAdminSession) {
        res.redirect(302, "/dashboard");
        return;
      }
      const state = randomUrlToken();
      const options = oauthCookieOptions(req);
      res.cookie(DISCORD_STATE_COOKIE, state, options);
      res.cookie(DISCORD_ACCOUNT_COOKIE, String(user.id), options);
      res.redirect(302, buildDiscordAuthorizationUrl({
        clientId: ENV.discordClientId,
        redirectUri: callbackUrl(req),
        state,
      }));
    } catch {
      res.redirect(302, "/signin?discord=sign-in-required");
    }
  });

  app.get("/api/auth/discord/callback", async (req: Request, res: Response) => {
    const code = getQueryParam(req, "code");
    const state = getQueryParam(req, "state");
    const cookies = parseCookieHeader(req.headers.cookie ?? "");
    const expectedState = cookies[DISCORD_STATE_COOKIE];
    const expectedAccountId = cookies[DISCORD_ACCOUNT_COOKIE];
    clearOAuthCookies(req, res);

    if (!code || !constantTimeEquals(state, expectedState)) {
      redirectToVerificationError(res, "state-error");
      return;
    }

    try {
      const user = await sdk.authenticateRequest(req);
      if (user.isAdminSession) {
        res.redirect(302, "/dashboard");
        return;
      }
      if (!constantTimeEquals(String(user.id), expectedAccountId)) {
        redirectToVerificationError(res, "state-error");
        return;
      }
      const accessToken = await exchangeCode({ code, redirectUri: callbackUrl(req) });
      const identity = await getDiscordIdentity(accessToken);
      const member = await isDiscordGuildMember({
        guildId: ENV.discordGuildId,
        discordUserId: identity.id,
        botToken: ENV.discordBotToken,
      });
      if (!member) {
        redirectToVerificationError(res, "not-member");
        return;
      }
      await markDiscordVerified(user.id);
      res.redirect(302, "/dashboard");
    } catch (error) {
      console.error("[Discord OAuth] Membership verification failed", error instanceof Error ? error.message : "unknown error");
      redirectToVerificationError(res, "failed");
    }
  });
}

export { DISCORD_INVITE_URL };
