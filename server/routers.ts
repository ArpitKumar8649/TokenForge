import { COOKIE_NAME } from "@shared/const";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { ESTABLISHED_EMAIL_DOMAIN_GUIDANCE } from "../shared/emailPolicy";
import {
  createApiKey,
  getAdminOverview,
  listAdminAccounts,
  getEmailAllowlistConfig,
  getQuotaStatus,
  getUsageSummary,
  listOpenFlags,
  listApiKeys,
  revokeApiKey,
  rotateApiKey,
  setAccountControl,
  setEmailAllowlistConfig,
  setModelEnabled,
  setProviderEnabled,
  writeAuditEvent,
  authenticatePasswordUser,
  clearFailedPasswordLogin,
  createPasswordUser,
  getPasswordLoginThrottle,
  recordFailedPasswordLogin,
  claimDailyCheckin,
  getCreditProfile,
  getModelAvailabilitySnapshot,
  getPublicModelTokenMetrics,
  getUsageLogs,
  clearLegacyAdministratorRoles,
  deleteAccountPermanently,
  getAdminAuditExport,
  getAuthSessionVersion,
  listAdminAuditEvents,
  revokeAllTokenForgeSessions,
  getAnnouncementText,
  setAnnouncementText,
} from "./db";
import { getSessionCookieOptions } from "./_core/cookies";
import { sdk } from "./_core/sdk";
import { systemRouter } from "./_core/systemRouter";
import { adminProcedure, protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { configuredEmailAllowlist, isPermanentEmailAddress, PASSWORD_MIN_LENGTH } from "./localAuth";
import { CLUSTER_PROTOCOL_PROVIDER_SLUG, FXQIDIAN_PROVIDER_SLUG, isTokenForgeModelId, TOKENHARBOR_PROVIDER_SLUG, type TokenForgeModelId } from "./modelCatalogue";
import { runPlaygroundCompletion, TokenForgePlaygroundError, tokenForgeRequestIpHash } from "./openaiGateway";
import { verifyAdminPasscode } from "./adminPasscode";

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
const tokenForgeModelId = z.string()
  .refine(isTokenForgeModelId, "The requested model is not in the active TokenForge catalogue.")
  .transform(model => model as TokenForgeModelId);
const adminPasscodeInput = z.object({ passcode: z.string().min(4, "Enter the administrator passcode").max(128) });
const adminAccountDirectoryInput = z.object({
  page: z.number().int().min(1).max(100_000).default(1),
  pageSize: z.number().int().min(5).max(50).default(10),
  search: z.string().trim().max(120).default(""),
  status: z.enum(["all", "active", "suspended", "flagged"]).default("all"),
});
const permanentAccountDeleteInput = z.object({
  userId: z.number().int().positive(),
  confirmation: z.string().trim().max(64),
}).superRefine((input, context) => {
  if (input.confirmation !== `DELETE ACCOUNT ${input.userId}`) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["confirmation"], message: `Type DELETE ACCOUNT ${input.userId} to permanently delete this account` });
  }
});
const announcementInput = z.object({ text: z.string().max(500, "Announcements must be 500 characters or fewer") });

function playgroundTrpcError(error: TokenForgePlaygroundError) {
  const code = error.code === "model_not_found" ? "NOT_FOUND"
    : error.code === "model_unavailable" || error.code === "provider_unavailable" ? "SERVICE_UNAVAILABLE"
        : error.code === "invalid_messages" ? "BAD_REQUEST"
          : error.code === "account_suspended" ? "FORBIDDEN"
            : error.code === "insufficient_credits" ? "PAYMENT_REQUIRED"
          : "TOO_MANY_REQUESTS";
  return new TRPCError({ code, message: error.message });
}

async function startLocalSession(ctx: { req: any; res: any }, user: { openId: string; name: string | null }) {
  const sessionVersion = await getAuthSessionVersion();
  const token = await sdk.createSessionToken(user.openId, { expiresInMs: LOCAL_SESSION_MAX_AGE_MS, name: user.name ?? "TokenForge developer", sessionVersion });
  ctx.res.cookie(COOKIE_NAME, token, { ...getSessionCookieOptions(ctx.req), maxAge: LOCAL_SESSION_MAX_AGE_MS });
}

function adminUnlockThrottleIdentifier(userId: number) {
  return `admin-unlock-${userId}@tokenforge.internal`;
}

export const appRouter = router({
  system: systemRouter,
  public: router({
    modelTokenMetrics: publicProcedure.query(() => getPublicModelTokenMetrics()),
    announcement: publicProcedure.query(() => getAnnouncementText()),
  }),
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    register: publicProcedure.input(registrationInput).mutation(async ({ ctx, input }) => {
      const emailPolicy = await getEmailAllowlistConfig();
      if (!isPermanentEmailAddress(input.email, emailPolicy?.entries)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: `Use an accepted mailbox provider to create a TokenForge account. Accepted providers include ${ESTABLISHED_EMAIL_DOMAIN_GUIDANCE}.` });
      }
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
      const emailPolicy = await getEmailAllowlistConfig();
      if (!isPermanentEmailAddress(input.email, emailPolicy?.entries)) {
        const failedAttempt = await recordFailedPasswordLogin(input.email);
        if (failedAttempt.blocked) {
          throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: `Too many sign-in attempts. Try again in ${failedAttempt.retryAfterSeconds} seconds.` });
        }
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Incorrect email or password" });
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
    modelAvailability: protectedProcedure.query(() => getModelAvailabilitySnapshot()),
    usage: protectedProcedure.query(async ({ ctx }) => getUsageSummary(ctx.user.id)),
    usageLogs: protectedProcedure
      .input(z.object({
        modelId: tokenForgeModelId.optional(),
        source: z.enum(["api", "playground"]).optional(),
        from: z.string().datetime().optional(),
        to: z.string().datetime().optional(),
        limit: z.number().int().min(1).max(100).optional(),
      }).optional())
      .query(({ ctx, input }) => getUsageLogs({
        userId: ctx.user.id,
        modelId: input?.modelId,
        source: input?.source,
        from: input?.from ? new Date(input.from) : undefined,
        to: input?.to ? new Date(input.to) : undefined,
        limit: input?.limit,
      })),
    wallet: protectedProcedure.query(async ({ ctx }) => {
      const wallet = await getCreditProfile(ctx.user.id);
      if (!wallet) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Credit balance is temporarily unavailable" });
      return wallet;
    }),
    profile: protectedProcedure.query(({ ctx }) => ({
      id: ctx.user.id,
      name: ctx.user.name,
      email: ctx.user.email,
      role: ctx.user.role,
      createdAt: ctx.user.createdAt,
      lastSignedIn: ctx.user.lastSignedIn,
      loginMethod: ctx.user.loginMethod,
    })),
    checkIn: protectedProcedure.mutation(async ({ ctx }) => {
      const result = await claimDailyCheckin(ctx.user.id);
      return result;
    }),
    playground: protectedProcedure
      .input(z.object({
        model: tokenForgeModelId,
        messages: z.array(playgroundMessage).min(1).max(100),
        maxOutputTokens: z.number().int().min(64).max(8_192).optional(),
        temperature: z.number().min(0).max(2).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        try {
          return await runPlaygroundCompletion({
            userId: ctx.user.id,
            model: input.model,
            messages: input.messages,
            maxOutputTokens: input.maxOutputTokens,
            temperature: input.temperature,
            sourceIpHash: tokenForgeRequestIpHash(ctx.req),
          });
        } catch (error) {
          if (error instanceof TokenForgePlaygroundError) throw playgroundTrpcError(error);
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "TokenForge could not complete this Playground request" });
        }
      }),
  }),
  admin: router({
    unlock: protectedProcedure.input(adminPasscodeInput).mutation(async ({ ctx, input }) => {
      if (ctx.user.isAdminSession) return { unlocked: true, alreadyAdmin: true } as const;
      const identifier = adminUnlockThrottleIdentifier(ctx.user.id);
      const throttle = await getPasswordLoginThrottle(identifier);
      if (throttle.blocked) {
        throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: `Too many administrator passcode attempts. Try again in ${throttle.retryAfterSeconds} seconds.` });
      }
      if (!verifyAdminPasscode(input.passcode)) {
        const failedAttempt = await recordFailedPasswordLogin(identifier);
        if (failedAttempt.blocked) {
          throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: `Too many administrator passcode attempts. Try again in ${failedAttempt.retryAfterSeconds} seconds.` });
        }
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Incorrect administrator passcode" });
      }
      await clearFailedPasswordLogin(identifier);
      await clearLegacyAdministratorRoles();
      const sessionVersion = await revokeAllTokenForgeSessions();
      const token = await sdk.createSessionToken(ctx.user.openId, { expiresInMs: LOCAL_SESSION_MAX_AGE_MS, name: ctx.user.name ?? "TokenForge administrator", sessionVersion, isAdminSession: true });
      ctx.res.cookie(COOKIE_NAME, token, { ...getSessionCookieOptions(ctx.req), maxAge: LOCAL_SESSION_MAX_AGE_MS });
      await writeAuditEvent({ actorUserId: ctx.user.id, targetUserId: ctx.user.id, action: "admin.passcode.unlocked", entityType: "account", entityId: String(ctx.user.id) });
      return { unlocked: true, alreadyAdmin: false, sessionVersion } as const;
    }),
    signOut: adminProcedure.mutation(async ({ ctx }) => {
      const sessionVersion = await getAuthSessionVersion();
      const token = await sdk.createSessionToken(ctx.user.openId, { expiresInMs: LOCAL_SESSION_MAX_AGE_MS, name: ctx.user.name ?? "TokenForge developer", sessionVersion });
      ctx.res.cookie(COOKIE_NAME, token, { ...getSessionCookieOptions(ctx.req), maxAge: LOCAL_SESSION_MAX_AGE_MS });
      await writeAuditEvent({ actorUserId: ctx.user.id, targetUserId: ctx.user.id, action: "admin.self_revoked", entityType: "account", entityId: String(ctx.user.id) });
      return { success: true } as const;
    }),
    overview: adminProcedure.query(() => getAdminOverview()),
    accounts: adminProcedure.input(adminAccountDirectoryInput).query(({ input }) => listAdminAccounts(input)),
    activity: adminProcedure.input(z.object({ limit: z.number().int().min(1).max(100).default(40) }).optional()).query(({ input }) => listAdminAuditEvents(input?.limit ?? 40)),
    auditExport: adminProcedure.query(() => getAdminAuditExport()),
    deleteAccount: adminProcedure.input(permanentAccountDeleteInput).mutation(async ({ ctx, input }) => {
      if (input.userId === ctx.user.id) throw new TRPCError({ code: "BAD_REQUEST", message: "The active administrator account cannot be deleted from the control plane" });
      const deleted = await deleteAccountPermanently(input.userId);
      if (!deleted) throw new TRPCError({ code: "NOT_FOUND", message: "This account no longer exists" });
      await writeAuditEvent({ actorUserId: ctx.user.id, action: "account.permanently_deleted", entityType: "deleted_account", entityId: String(input.userId) });
      return { success: true } as const;
    }),
    flags: adminProcedure.query(() => listOpenFlags()),
    emailAllowlist: adminProcedure.query(async () => {
      const saved = await getEmailAllowlistConfig();
      return {
        entries: saved?.entries ?? Array.from(configuredEmailAllowlist()),
        updatedAt: saved?.updatedAt ?? null,
        updatedByUserId: saved?.updatedByUserId ?? null,
        source: saved ? "database" as const : "environment" as const,
      };
    }),
    setEmailAllowlist: adminProcedure
      .input(z.object({ entries: z.array(z.string().trim().min(3).max(320)).max(250) }))
      .mutation(async ({ ctx, input }) => {
        try {
          const saved = await setEmailAllowlistConfig(input.entries, ctx.user.id);
          await writeAuditEvent({ actorUserId: ctx.user.id, action: "email.allowlist.updated", entityType: "platform_setting", entityId: "email_allowlist", metadata: { entryCount: saved.entries.length } });
          return saved;
        } catch (error) {
          throw new TRPCError({ code: "BAD_REQUEST", message: error instanceof Error ? error.message : "TokenForge could not save the email allowlist" });
        }
      }),
    announcement: adminProcedure.query(() => getAnnouncementText()),
    setAnnouncement: adminProcedure.input(announcementInput).mutation(async ({ ctx, input }) => {
      const text = await setAnnouncementText(input.text, ctx.user.id);
      await writeAuditEvent({
        actorUserId: ctx.user.id,
        action: "announcement.updated",
        entityType: "platform_setting",
        entityId: "announcement_text",
        metadata: { published: Boolean(text), characterCount: text?.length ?? 0 },
      });
      return { text };
    }),
    setModelEnabled: adminProcedure.input(z.object({ modelId: tokenForgeModelId, enabled: z.boolean() })).mutation(async ({ ctx, input }) => {
      const updated = await setModelEnabled(input.modelId, input.enabled);
      if (!updated) throw new TRPCError({ code: "NOT_FOUND", message: "Model configuration not found" });
      await writeAuditEvent({ actorUserId: ctx.user.id, action: input.enabled ? "model.enabled" : "model.disabled", entityType: "model", entityId: input.modelId });
      return { success: true } as const;
    }),
    setProviderEnabled: adminProcedure.input(z.object({ slug: z.enum([FXQIDIAN_PROVIDER_SLUG, CLUSTER_PROTOCOL_PROVIDER_SLUG, TOKENHARBOR_PROVIDER_SLUG]), enabled: z.boolean() })).mutation(async ({ ctx, input }) => {
      const result = await setProviderEnabled(input.slug, input.enabled);
      if (!result.updated) throw new TRPCError({ code: "NOT_FOUND", message: "Provider configuration not found" });
      await writeAuditEvent({ actorUserId: ctx.user.id, action: input.enabled ? "provider.enabled" : "provider.disabled", entityType: "provider", entityId: input.slug, metadata: { disabledModels: result.disabledModels } });
      return { success: true, disabledModels: result.disabledModels } as const;
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
