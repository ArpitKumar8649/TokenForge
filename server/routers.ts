import { COOKIE_NAME } from "@shared/const";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  createApiKey,
  getAdminOverview,
  getQuotaStatus,
  getUsageSummary,
  listOpenFlags,
  listApiKeys,
  revokeApiKey,
  rotateApiKey,
  setAccountControl,
  setModelEnabled,
  setProviderEnabled,
  writeAuditEvent,
  authenticatePasswordUser,
  clearFailedPasswordLogin,
  createPasswordUser,
  getPasswordLoginThrottle,
  recordFailedPasswordLogin,
} from "./db";
import { getSessionCookieOptions } from "./_core/cookies";
import { sdk } from "./_core/sdk";
import { systemRouter } from "./_core/systemRouter";
import { adminProcedure, protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { PASSWORD_MIN_LENGTH } from "./localAuth";
import { runPlaygroundCompletion, TokenForgePlaygroundError, tokenForgeRequestIpHash } from "./openaiGateway";

const apiKeyLabel = z
  .string()
  .trim()
  .min(1, "Choose a label for this key")
  .max(100, "Key labels must be 100 characters or fewer");

const localCredentials = z.object({
  email: z.string().trim().email("Enter a valid email address").max(320),
  password: z.string().min(PASSWORD_MIN_LENGTH, `Use at least ${PASSWORD_MIN_LENGTH} characters`).max(256),
});
const registrationInput = localCredentials.extend({ name: z.string().trim().min(1).max(120).optional() });
const LOCAL_SESSION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const playgroundMessage = z.object({
  role: z.enum(["user", "assistant", "system"]),
  content: z.string().trim().min(1, "Message content cannot be empty").max(20_000, "Each message must be 20,000 characters or fewer"),
});

function playgroundTrpcError(error: TokenForgePlaygroundError) {
  const code = error.code === "model_not_found" ? "NOT_FOUND"
    : error.code === "model_unavailable" || error.code === "provider_unavailable" ? "SERVICE_UNAVAILABLE"
      : error.code === "invalid_messages" ? "BAD_REQUEST"
        : error.code === "account_suspended" ? "FORBIDDEN"
          : "TOO_MANY_REQUESTS";
  return new TRPCError({ code, message: error.message });
}

async function startLocalSession(ctx: { req: any; res: any }, user: { openId: string; name: string | null }) {
  const token = await sdk.createSessionToken(user.openId, { expiresInMs: LOCAL_SESSION_MAX_AGE_MS, name: user.name ?? "TokenForge developer" });
  ctx.res.cookie(COOKIE_NAME, token, { ...getSessionCookieOptions(ctx.req), maxAge: LOCAL_SESSION_MAX_AGE_MS });
}

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    register: publicProcedure.input(registrationInput).mutation(async ({ ctx, input }) => {
      const user = await createPasswordUser(input);
      if (!user) throw new TRPCError({ code: "CONFLICT", message: "An account already exists for this email" });
      await startLocalSession(ctx, user);
      return { user };
    }),
    login: publicProcedure.input(localCredentials).mutation(async ({ ctx, input }) => {
      const throttle = await getPasswordLoginThrottle(input.email);
      if (throttle.blocked) {
        throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: `Too many sign-in attempts. Try again in ${throttle.retryAfterSeconds} seconds.` });
      }
      const user = await authenticatePasswordUser(input.email, input.password);
      if (!user) {
        const failedAttempt = await recordFailedPasswordLogin(input.email);
        if (failedAttempt.blocked) {
          throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: `Too many sign-in attempts. Try again in ${failedAttempt.retryAfterSeconds} seconds.` });
        }
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Incorrect email or password" });
      }
      await clearFailedPasswordLogin(input.email);
      await startLocalSession(ctx, user);
      return { user };
    }),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  developer: router({
    apiKeys: protectedProcedure.query(async ({ ctx }) => listApiKeys(ctx.user.id)),
    createApiKey: protectedProcedure.input(z.object({ label: apiKeyLabel })).mutation(async ({ ctx, input }) => {
      try {
        return await createApiKey(ctx.user.id, input.label);
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error instanceof Error ? error.message : "TokenForge could not create this key",
        });
      }
    }),
    revokeApiKey: protectedProcedure.input(z.object({ apiKeyId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      const revoked = await revokeApiKey(ctx.user.id, input.apiKeyId);
      if (!revoked) throw new TRPCError({ code: "NOT_FOUND", message: "This active API key was not found" });
      return { success: true } as const;
    }),
    rotateApiKey: protectedProcedure
      .input(z.object({ apiKeyId: z.number().int().positive(), label: apiKeyLabel }))
      .mutation(async ({ ctx, input }) => {
        const result = await rotateApiKey(ctx.user.id, input.apiKeyId, input.label);
        if (!result) throw new TRPCError({ code: "NOT_FOUND", message: "This active API key was not found" });
        return result;
      }),
    quota: protectedProcedure.query(async ({ ctx }) => {
      const quota = await getQuotaStatus(ctx.user.id);
      if (!quota) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Quota status is temporarily unavailable" });
      return quota;
    }),
    usage: protectedProcedure.query(async ({ ctx }) => getUsageSummary(ctx.user.id)),
    playground: protectedProcedure
      .input(z.object({ model: z.enum(["glm-5.2", "grok-4.5"]), messages: z.array(playgroundMessage).min(1).max(100) }))
      .mutation(async ({ ctx, input }) => {
        try {
          return await runPlaygroundCompletion({ userId: ctx.user.id, model: input.model, messages: input.messages, sourceIpHash: tokenForgeRequestIpHash(ctx.req) });
        } catch (error) {
          if (error instanceof TokenForgePlaygroundError) throw playgroundTrpcError(error);
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "TokenForge could not complete this Playground request" });
        }
      }),
  }),
  admin: router({
    overview: adminProcedure.query(() => getAdminOverview()),
    flags: adminProcedure.query(() => listOpenFlags()),
    setModelEnabled: adminProcedure.input(z.object({ modelId: z.enum(["glm-5.2", "grok-4.5"]), enabled: z.boolean() })).mutation(async ({ ctx, input }) => {
      const updated = await setModelEnabled(input.modelId, input.enabled);
      if (!updated) throw new TRPCError({ code: "NOT_FOUND", message: "Model configuration not found" });
      await writeAuditEvent({ actorUserId: ctx.user.id, action: input.enabled ? "model.enabled" : "model.disabled", entityType: "model", entityId: input.modelId });
      return { success: true } as const;
    }),
    setProviderEnabled: adminProcedure.input(z.object({ slug: z.literal("fxqidian"), enabled: z.boolean() })).mutation(async ({ ctx, input }) => {
      const updated = await setProviderEnabled(input.slug, input.enabled);
      if (!updated) throw new TRPCError({ code: "NOT_FOUND", message: "Provider configuration not found" });
      await writeAuditEvent({ actorUserId: ctx.user.id, action: input.enabled ? "provider.enabled" : "provider.disabled", entityType: "provider", entityId: input.slug });
      return { success: true } as const;
    }),
    setAccountControl: adminProcedure
      .input(z.object({ userId: z.number().int().positive(), isSuspended: z.boolean().optional(), dailyRequestLimit: z.number().int().min(1).max(1_000_000).optional(), dailyTokenLimit: z.number().int().min(1_000).max(10_000_000).optional() }))
      .mutation(async ({ ctx, input }) => {
        if (input.userId === ctx.user.id && input.isSuspended) throw new TRPCError({ code: "BAD_REQUEST", message: "You cannot suspend your own administrator account" });
        const updated = await setAccountControl(input);
        if (!updated) throw new TRPCError({ code: "NOT_FOUND", message: "Account control record not found" });
        await writeAuditEvent({ actorUserId: ctx.user.id, targetUserId: input.userId, action: "account.control.updated", entityType: "account", entityId: String(input.userId), metadata: { isSuspended: input.isSuspended, dailyRequestLimit: input.dailyRequestLimit, dailyTokenLimit: input.dailyTokenLimit } });
        return { success: true } as const;
      }),
  }),
});

export type AppRouter = typeof appRouter;
