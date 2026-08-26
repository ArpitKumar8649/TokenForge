import { COOKIE_NAME } from "@shared/const";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { ESTABLISHED_EMAIL_DOMAIN_GUIDANCE } from "../shared/emailPolicy";
import {
  createApiKey,
  getAdminAccountModelUsage,
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
  clearFailedPasswordLogin,
  getPasswordLoginThrottle,
  recordFailedPasswordLogin,
  claimDailyCheckin,
  getCreditProfile,
  getModelAvailabilitySnapshot,
  getPublicModelTokenMetrics,
  getUsageLogs,
  clearLegacyAdministratorRoles,
  countDiscordVerifiedAccounts,
  deleteAccountPermanently,
  grantAdminAccountCredit,
  grantDiscordVerifiedAccountGiveaway,
  listCreditGiveawayHistory,
  listUnreadCreditGiveawayNotifications,
  dismissCreditGiveawayNotification,
  getAdminAuditExport,
  getAuthSessionVersion,
  getPlatformMaintenanceConfig,
  getMaintenanceCountdown,
  listAdminAuditEvents,
  countDiscordUnverifiedAccounts,
  deleteDiscordUnverifiedAccounts,
  revokeAllTokenForgeSessions,
  getAnnouncementText,
  setAnnouncementText,
  getReferralOverview,
  getSpecialReferralGiftStatus,
  acknowledgeSpecialReferralGift,
  getSpecialReferralCampaignAdminOverview,
  resetDiscordVerification,
  setPlatformMaintenanceConfig,
  resumePlatformAfterTimedMaintenance,
  setMaintenanceCountdown,
  getOrCreateAdminSessionPrincipal,
  replaceOrcaRouterCredentialPool,
  getClaudeFable5NvidiaProviderSettings,
  updateClaudeFable5NvidiaProviderSettings,
  getRecentClaudeFable5FailureLogs,
  getRecentGlm53FailureLogs,
  getRecentSonnet46FailureLogs,
  getRecentClaudeOpus5FailureLogs,
  getRecentDeepseekV4ProFailureLogs,
  getRecentQwen38MaxFailureLogs,
  getClaudeOpus5ProviderSettings,
  updateClaudeOpus5ProviderSettings,
  deleteClaudeOpus5QwenApiKey,
  deleteClaudeOpus5QwenModel,
  getGlm53ProviderSettings,
  updateGlm53ProviderSettings,
  getSonnet46ProviderSettings,
  updateSonnet46ProviderSettings,
  getDeepseekV4ProProviderSettings,
  updateDeepseekV4ProProviderSettings,
  getQwen38MaxProviderSettings,
  updateQwen38MaxProviderSettings,
  listAdminPreProvisionedAccounts,
  preProvisionAccountEmail,
} from "./db";
import { getSessionCookieOptions } from "./_core/cookies";
import { sdk } from "./_core/sdk";
import { systemRouter } from "./_core/systemRouter";
import { adminProcedure, protectedProcedure, publicProcedure, router, verifiedDeveloperProcedure } from "./_core/trpc";
import { configuredEmailAllowlist } from "./localAuth";
import { CLAUDE_OPUS5_PROVIDER_SLUG, CLUSTER_PROTOCOL_PROVIDER_SLUG, FXQIDIAN_PROVIDER_SLUG, isTokenForgeModelId, TOKENHARBOR_PROVIDER_SLUG, TOKENROUTER_PROVIDER_SLUG, type TokenForgeModelId } from "./modelCatalogue";
import { PUBLIC_PROVIDER_ERROR_MESSAGE, runPlaygroundCompletion, TokenForgePlaygroundError, tokenForgeRequestIpHash } from "./openaiGateway";
import { verifyAdminPasscode } from "./adminPasscode";
import { getOrcaRouterCredentialPoolStatus, getOrcaRouterSlotRequestCounts, invalidateOrcaRouterCredentialPool, ORCA_ROUTER_CREDENTIAL_POOL_SIZE, validateOrcaRouterCredential } from "./orcaRouterCredentials";
import { buildSpecialReferralCampaignUrl } from "../shared/referrals";

const apiKeyLabel = z
  .string()
  .trim()
  .min(1, "Choose a label for this key")
  .max(100, "Key labels must be 100 characters or fewer");

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
  sort: z.enum(["latestJoin", "mostTokens", "discordVerified", "mostCredit", "specialReferral"]).default("latestJoin"),
});
const adminPreProvisionAccountInput = z.object({
  email: z.string().trim().email("Enter a valid email address").max(320, "Email addresses must be 320 characters or fewer"),
});
const permanentAccountDeleteInput = z.object({ userId: z.number().int().positive(), confirmation: z.string().trim().max(64).optional() });
const adminCreditGrantInput = z.object({
  userId: z.number().int().positive(),
  amountUsd: z.number().finite().positive().max(100_000).refine(value => Math.round(value * 100) === value * 100, "Use an amount with no more than two decimal places"),
});
const discordVerifiedGiveawayInput = z.object({
  amountUsd: z.number().finite().positive().max(100_000).refine(value => Math.round(value * 100) === value * 100, "Use an amount with no more than two decimal places"),
  announcementNote: z.string().trim().max(256, "Recipient announcement notes must be 256 characters or fewer").optional(),
  expectedRecipientCount: z.number().int().min(0).max(1_000_000),
  confirmation: z.string().trim().max(160),
}).superRefine((input, context) => {
  const phrase = `GIVE $${input.amountUsd.toFixed(2)} TO ${input.expectedRecipientCount} VERIFIED ACCOUNTS`;
  if (input.confirmation !== phrase) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["confirmation"], message: `Type ${phrase} to confirm this giveaway` });
  }
});
const discordVerificationResetInput = z.object({
  userId: z.number().int().positive(),
  confirmation: z.string().trim().max(80),
}).superRefine((input, context) => {
  if (input.confirmation !== `RESET DISCORD VERIFICATION ${input.userId}`) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["confirmation"], message: `Type RESET DISCORD VERIFICATION ${input.userId} to require membership verification again` });
  }
});
const announcementInput = z.object({ text: z.string().max(500, "Announcements must be 500 characters or fewer") });
const maintenanceCountdownInput = z.object({
  durationMs: z.number().int().min(1_000, "Choose a countdown duration of at least one second").max(30 * 24 * 60 * 60 * 1_000, "Maintenance countdowns can be no longer than 30 days"),
  note: z.string().trim().max(200, "Maintenance notes must be 200 characters or fewer"),
}).nullable();
const orcaRouterCredentialPoolInput = z.object({
  credentials: z.array(z.string().trim().min(20, "Enter a complete OrcaRouter credential").max(512)).length(ORCA_ROUTER_CREDENTIAL_POOL_SIZE, `Provide exactly ${ORCA_ROUTER_CREDENTIAL_POOL_SIZE} OrcaRouter credentials`),
});
const claudeFable5ProviderGroupInput = z.object({
    id: z.string().trim().regex(/^[a-z0-9][a-z0-9_-]{0,63}$/i, "Use letters, numbers, hyphens, or underscores for the provider ID"),
    label: z.string().trim().min(1, "Enter a provider label").max(80),
    enabled: z.boolean().optional(),
    baseUrl: z.string().trim().url("Enter a valid HTTPS base URL").max(512),
    model: z.string().trim().min(1, "Enter a model ID").max(256),
    apiKeys: z.array(z.string().trim().max(512)).max(50, "A provider pool can contain at most 50 API keys"),
    removeSlots: z.array(z.number().int().positive()).max(50).optional(),
  });
const claudeFable5ProviderSettingsInput = z.union([
  z.object({ providers: z.array(claudeFable5ProviderGroupInput).min(1, "Keep at least one Claude Fable 5 provider").max(12, "At most 12 Claude Fable 5 providers may be configured") }),
  z.object({ baseUrl: z.string().trim().url("Enter a valid HTTPS base URL").max(512).optional(), model: z.string().trim().min(1, "Enter a model ID").max(256).optional(), apiKeys: z.array(z.string().trim().max(512)).max(50).optional(), removeSlots: z.array(z.number().int().positive()).max(50).optional() }).refine(input => input.baseUrl !== undefined || input.model !== undefined || input.apiKeys !== undefined || input.removeSlots !== undefined, "Provide at least one setting to update"),
]);
const claudeOpus5ProviderSettingsInput = z.object({
  providers: z.array(z.object({
    id: z.string().trim().regex(/^[a-z0-9][a-z0-9_-]{0,63}$/i, "Use letters, numbers, hyphens, or underscores for the provider ID"),
    label: z.string().trim().min(1, "Enter a provider label").max(80),
    enabled: z.boolean().optional(),
    baseUrl: z.string().trim().url("Enter a valid HTTPS base URL").max(512),
    model: z.string().trim().min(1, "Enter a model ID").max(256),
    apiKeys: z.array(z.string().trim().max(512)).max(50, "A provider pool can contain at most 50 API keys"),
    removeSlots: z.array(z.number().int().positive()).max(50).optional(),
    modelPool: z.array(z.object({
      id: z.string().trim().regex(/^[a-z0-9][a-z0-9_-]{0,63}$/i, "Use letters, numbers, hyphens, or underscores for the model entry ID"),
      model: z.string().trim().min(1, "Enter a model ID").max(256),
      enabled: z.boolean().optional(),
      quotaTokens: z.number().int().min(1_000).max(100_000_000).optional(),
    })).max(50, "A Qwen provider can contain at most 50 model IDs").optional(),
  })).min(1, "Keep at least one Claude Opus 5 provider").max(12, "At most 12 Claude Opus 5 providers may be configured"),
});
const claudeOpus5QwenModelDeleteInput = z.object({
  providerId: z.string().trim().regex(/^[a-z0-9][a-z0-9_-]{0,63}$/i),
  modelEntryId: z.string().trim().regex(/^[a-z0-9][a-z0-9_-]{0,63}$/i),
});
const claudeOpus5QwenApiKeyDeleteInput = z.object({
  providerId: z.string().trim().regex(/^[a-z0-9][a-z0-9_-]{0,63}$/i),
  slot: z.number().int().positive(),
});
const glm53ProviderSettingsInput = z.object({
  baseUrl: z.string().trim().url("Enter a valid HTTPS base URL").max(512).optional(),
  model: z.string().trim().min(1, "Enter a model ID").max(256).optional(),
  apiKeys: z.array(z.string().trim().max(512)).max(50, "A provider pool can contain at most 50 API keys").optional(),
  removeSlots: z.array(z.number().int().positive()).max(50).optional(),
}).refine(input => input.baseUrl !== undefined || input.model !== undefined || input.apiKeys !== undefined || input.removeSlots !== undefined, "Provide at least one setting to update");
const deepseekV4ProProviderGroupInput = z.object({
  id: z.string().trim().regex(/^[a-z0-9][a-z0-9_-]{0,63}$/i, "Use letters, numbers, hyphens, or underscores for the provider identifier"),
  label: z.string().trim().min(1, "Enter a provider label").max(80),
  enabled: z.boolean().optional(),
  baseUrl: z.string().trim().url("Enter a valid HTTPS base URL").max(512),
  model: z.string().trim().min(1, "Enter a model ID").max(256),
  apiKeys: z.array(z.string().trim().max(512)).min(1).max(50, "A provider pool can contain at most 50 API keys"),
  removeSlots: z.array(z.number().int().positive()).max(50).optional(),
});
const deepseekV4ProProviderSettingsInput = z.union([
  z.object({
    providers: z.array(deepseekV4ProProviderGroupInput).min(1).max(12, "DeepSeek V4 Pro supports at most 12 provider groups"),
  }),
  z.object({
    baseUrl: z.string().trim().url("Enter a valid HTTPS base URL").max(512).optional(),
    model: z.string().trim().min(1, "Enter a model ID").max(256).optional(),
    apiKeys: z.array(z.string().trim().max(512)).max(50, "A provider pool can contain at most 50 API keys").optional(),
    removeSlots: z.array(z.number().int().positive()).max(50).optional(),
  }).refine(input => input.baseUrl !== undefined || input.model !== undefined || input.apiKeys !== undefined || input.removeSlots !== undefined, "Provide at least one setting to update"),
]);
const sonnet46ProviderSettingsInput = z.object({
  providers: z.array(z.object({
    id: z.string().trim().regex(/^[a-z0-9][a-z0-9_-]{0,63}$/i, "Use letters, numbers, hyphens, or underscores for the provider identifier"),
    label: z.string().trim().min(1, "Enter a provider label").max(80),
    enabled: z.boolean().optional(),
    baseUrl: z.string().trim().url("Enter a valid HTTPS base URL").max(512),
    model: z.string().trim().min(1, "Enter a model ID").max(256),
    apiKeys: z.array(z.string().trim().max(512)).max(50, "A provider pool can contain at most 50 API keys"),
    removeSlots: z.array(z.number().int().positive()).max(50).optional(),
  })).min(1, "Keep at least one Claude Sonnet 4.6 provider").max(12, "Claude Sonnet 4.6 supports at most 12 provider groups"),
});
const discordUnverifiedCleanupInput = z.object({
  expectedCount: z.number().int().min(0).max(1_000_000),
  confirmation: z.string().trim().max(128),
}).superRefine((input, context) => {
  const phrase = `DELETE ${input.expectedCount} UNVERIFIED DISCORD ACCOUNTS`;
  if (input.confirmation !== phrase) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["confirmation"], message: `Type ${phrase} to permanently remove these accounts` });
  }
});

function playgroundTrpcError(error: TokenForgePlaygroundError) {
  const code = error.code === "model_not_found" ? "NOT_FOUND"
    : error.code === "model_unavailable" || error.code === "provider_unavailable" || error.code === "platform_maintenance" ? "SERVICE_UNAVAILABLE"
        : error.code === "invalid_messages" ? "BAD_REQUEST"
          : error.code === "account_suspended" ? "FORBIDDEN"
            : error.code === "insufficient_credits" ? "PAYMENT_REQUIRED"
          : "TOO_MANY_REQUESTS";
  return new TRPCError({ code, message: error.message });
}

function adminUnlockThrottleIdentifier(req: Parameters<typeof tokenForgeRequestIpHash>[0]) {
  return `admin-unlock-ip-${tokenForgeRequestIpHash(req)}@tokenforge.internal`;
}

export const appRouter = router({
  system: systemRouter,
  public: router({
    modelTokenMetrics: publicProcedure.query(() => getPublicModelTokenMetrics()),
    announcement: publicProcedure.query(() => getAnnouncementText()),
    maintenanceCountdown: publicProcedure.query(() => getMaintenanceCountdown()),
  }),
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  developer: router({
    discordVerificationStatus: protectedProcedure.query(({ ctx }) => ({
      verified: ctx.user.isAdminSession === true || Boolean(ctx.user.discordVerifiedAt),
      administratorBypass: ctx.user.isAdminSession === true,
      discordInviteUrl: "https://discord.gg/pnsWamDbe",
    })),
    apiKeys: verifiedDeveloperProcedure.query(async ({ ctx }) => listApiKeys(ctx.user.id)),
    referrals: verifiedDeveloperProcedure.query(async ({ ctx }) => {
      const referrals = await getReferralOverview(ctx.user.id);
      if (!referrals) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Referral details are temporarily unavailable" });
      return referrals;
    }),
    specialReferralGift: verifiedDeveloperProcedure.query(async ({ ctx }) => getSpecialReferralGiftStatus(ctx.user.id)),
    acknowledgeSpecialReferralGift: verifiedDeveloperProcedure.mutation(async ({ ctx }) => {
      const gift = await acknowledgeSpecialReferralGift(ctx.user.id);
      if (!gift) throw new TRPCError({ code: "NOT_FOUND", message: "No verified special referral gift is available for this account." });
      return gift;
    }),
    createApiKey: verifiedDeveloperProcedure.input(z.object({ label: apiKeyLabel })).mutation(async ({ ctx, input }) => {
      try {
        return await createApiKey(ctx.user.id, input.label);
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error instanceof Error ? error.message : "TokenForge could not create this key",
        });
      }
    }),
    revokeApiKey: verifiedDeveloperProcedure.input(z.object({ apiKeyId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      const revoked = await revokeApiKey(ctx.user.id, input.apiKeyId);
      if (!revoked) throw new TRPCError({ code: "NOT_FOUND", message: "This active API key was not found" });
      return { success: true } as const;
    }),
    rotateApiKey: verifiedDeveloperProcedure
      .input(z.object({ apiKeyId: z.number().int().positive(), label: apiKeyLabel }))
      .mutation(async ({ ctx, input }) => {
        const result = await rotateApiKey(ctx.user.id, input.apiKeyId, input.label);
        if (!result) throw new TRPCError({ code: "NOT_FOUND", message: "This active API key was not found" });
        return result;
      }),
    quota: verifiedDeveloperProcedure.query(async ({ ctx }) => {
      const quota = await getQuotaStatus(ctx.user.id);
      if (!quota) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Quota status is temporarily unavailable" });
      return quota;
    }),
    modelAvailability: verifiedDeveloperProcedure.query(() => getModelAvailabilitySnapshot()),
    usage: verifiedDeveloperProcedure.query(async ({ ctx }) => getUsageSummary(ctx.user.id)),
    usageLogs: verifiedDeveloperProcedure
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
    wallet: verifiedDeveloperProcedure.query(async ({ ctx }) => {
      const wallet = await getCreditProfile(ctx.user.id);
      if (!wallet) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Credit balance is temporarily unavailable" });
      return wallet;
    }),
    unreadGiveawayNotifications: verifiedDeveloperProcedure.query(({ ctx }) => listUnreadCreditGiveawayNotifications(ctx.user.id)),
    dismissGiveawayNotification: verifiedDeveloperProcedure
      .input(z.object({ notificationId: z.number().int().positive() }))
      .mutation(({ ctx, input }) => dismissCreditGiveawayNotification({ userId: ctx.user.id, notificationId: input.notificationId })),
    profile: verifiedDeveloperProcedure.query(({ ctx }) => ({
      id: ctx.user.id,
      name: ctx.user.name,
      email: ctx.user.email,
      role: ctx.user.role,
      createdAt: ctx.user.createdAt,
      lastSignedIn: ctx.user.lastSignedIn,
      loginMethod: ctx.user.loginMethod,
    })),
    checkIn: verifiedDeveloperProcedure.mutation(async ({ ctx }) => {
      const result = await claimDailyCheckin(ctx.user.id);
      return result;
    }),
    playground: verifiedDeveloperProcedure
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
    unlock: publicProcedure.input(adminPasscodeInput).mutation(async ({ ctx, input }) => {
      if (ctx.user?.isAdminSession) return { unlocked: true, alreadyAdmin: true } as const;
      const identifier = adminUnlockThrottleIdentifier(ctx.req);
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
      const administrator = await getOrCreateAdminSessionPrincipal();
      await clearLegacyAdministratorRoles();
      const sessionVersion = await revokeAllTokenForgeSessions();
      const token = await sdk.createSessionToken(administrator.openId, { expiresInMs: LOCAL_SESSION_MAX_AGE_MS, name: administrator.name ?? "TokenForge administrator", sessionVersion, isAdminSession: true });
      ctx.res.cookie(COOKIE_NAME, token, { ...getSessionCookieOptions(ctx.req), maxAge: LOCAL_SESSION_MAX_AGE_MS });
      await writeAuditEvent({ actorUserId: administrator.id, targetUserId: administrator.id, action: "admin.passcode.unlocked", entityType: "administrator_session", entityId: String(administrator.id), metadata: { entry: "passcode_only" } });
      return { unlocked: true, alreadyAdmin: false, sessionVersion } as const;
    }),
    signOut: adminProcedure.mutation(async ({ ctx }) => {
      ctx.res.clearCookie(COOKIE_NAME, getSessionCookieOptions(ctx.req));
      await writeAuditEvent({ actorUserId: ctx.user.id, targetUserId: ctx.user.id, action: "admin.self_revoked", entityType: "account", entityId: String(ctx.user.id) });
      return { success: true } as const;
    }),
    overview: adminProcedure.query(() => getAdminOverview()),
    specialReferralCampaign: adminProcedure.query(async () => ({ ...(await getSpecialReferralCampaignAdminOverview()), link: buildSpecialReferralCampaignUrl(), bonusUsd: 150 })),
    accounts: adminProcedure.input(adminAccountDirectoryInput).query(({ input }) => listAdminAccounts(input)),
    preProvisionedAccounts: adminProcedure.query(() => listAdminPreProvisionedAccounts()),
    preProvisionAccount: adminProcedure.input(adminPreProvisionAccountInput).mutation(async ({ ctx, input }) => {
      const result = await preProvisionAccountEmail({ email: input.email, provisionedByUserId: ctx.user.id });
      if (result.kind === "created") {
        const emailDomain = result.email.split("@")[1] ?? "unknown";
        await writeAuditEvent({
          actorUserId: ctx.user.id,
          action: "account.pre_provisioned",
          entityType: "pre_provisioned_account",
          entityId: String(result.reservationId),
          metadata: { emailDomain, introductoryCreditNanos: result.introductoryCreditNanos },
        });
      }
      return result;
    }),
    accountModelUsage: adminProcedure.input(z.object({ userIds: z.array(z.number().int().positive()).min(1).max(10) })).query(({ input }) => getAdminAccountModelUsage(input.userIds)),
    activity: adminProcedure.input(z.object({ limit: z.number().int().min(1).max(100).default(40) }).optional()).query(({ input }) => listAdminAuditEvents(input?.limit ?? 40)),
    auditExport: adminProcedure.query(() => getAdminAuditExport()),
    platformMaintenance: adminProcedure.query(() => getPlatformMaintenanceConfig()),
    setPlatformMaintenance: adminProcedure.input(z.object({ enabled: z.boolean() })).mutation(async ({ ctx, input }) => {
      const maintenance = await setPlatformMaintenanceConfig(input.enabled, ctx.user.id);
      await writeAuditEvent({ actorUserId: ctx.user.id, action: input.enabled ? "platform.maintenance.enabled" : "platform.maintenance.disabled", entityType: "platform_setting", entityId: "platform_maintenance" });
      return maintenance;
    }),
    resumeTimedMaintenance: adminProcedure.mutation(async ({ ctx }) => {
      const maintenance = await resumePlatformAfterTimedMaintenance(ctx.user.id);
      await writeAuditEvent({ actorUserId: ctx.user.id, action: "platform.maintenance.timed_resumed", entityType: "platform_setting", entityId: "platform_maintenance" });
      return maintenance;
    }),
    maintenanceCountdown: adminProcedure.query(() => getMaintenanceCountdown()),
    setMaintenanceCountdown: adminProcedure.input(maintenanceCountdownInput).mutation(async ({ ctx, input }) => {
      const countdown = await setMaintenanceCountdown(input, ctx.user.id);
      await writeAuditEvent({
        actorUserId: ctx.user.id,
        action: input ? "platform.maintenance_countdown.started" : "platform.maintenance_countdown.cleared",
        entityType: "platform_setting",
        entityId: "maintenance_countdown_v1",
        metadata: input ? { durationMs: input.durationMs } : undefined,
      });
      return countdown;
    }),
    discordVerifiedGiveawayRecipients: adminProcedure.query(async () => ({ count: await countDiscordVerifiedAccounts() })),
    giveawayHistory: adminProcedure.query(() => listCreditGiveawayHistory()),
    giveDiscordVerifiedAccountsCredit: adminProcedure.input(discordVerifiedGiveawayInput).mutation(async ({ ctx, input }) => {
      const amountNanos = Math.round(input.amountUsd * 1_000_000_000);
      let result: Awaited<ReturnType<typeof grantDiscordVerifiedAccountGiveaway>>;
      try {
        result = await grantDiscordVerifiedAccountGiveaway({ actorUserId: ctx.user.id, amountNanos, expectedRecipientCount: input.expectedRecipientCount, announcementNote: input.announcementNote });
      } catch (error) {
        console.error("[TokenForge giveaway persistence failure]", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "The giveaway could not be completed. No giveaway credit was applied; review the recipient count and try again.",
        });
      }
      if (!result.applied) {
        throw new TRPCError({ code: "CONFLICT", message: `The verified recipient set changed from ${input.expectedRecipientCount} to ${result.recipientCount} accounts. Review the updated count and confirm again.` });
      }
      await writeAuditEvent({
        actorUserId: ctx.user.id,
        action: "account.discord_verified.giveaway_credited",
        entityType: "credit_giveaway",
        entityId: result.id ?? "discord_verified",
        metadata: { amountNanos: result.amountNanos, recipientCount: result.recipientCount, totalAmountNanos: result.totalAmountNanos, hasAnnouncementNote: Boolean(input.announcementNote?.trim()) },
      });
      return result;
    }),
    discordUnverifiedAccountCleanup: adminProcedure.query(async () => ({ count: await countDiscordUnverifiedAccounts() })),
    deleteDiscordUnverifiedAccounts: adminProcedure.input(discordUnverifiedCleanupInput).mutation(async ({ ctx, input }) => {
      const currentCount = await countDiscordUnverifiedAccounts();
      if (currentCount !== input.expectedCount) {
        throw new TRPCError({ code: "CONFLICT", message: `The cleanup set changed from ${input.expectedCount} to ${currentCount} accounts. Review the updated count and confirm again.` });
      }
      const result = await deleteDiscordUnverifiedAccounts();
      await writeAuditEvent({ actorUserId: ctx.user.id, action: "account.discord_unverified.bulk_deleted", entityType: "account_cleanup", entityId: "discord_unverified", metadata: { deletedCount: result.deletedCount } });
      return result;
    }),
    deleteAccount: adminProcedure.input(permanentAccountDeleteInput).mutation(async ({ ctx, input }) => {
      if (input.userId === ctx.user.id) throw new TRPCError({ code: "BAD_REQUEST", message: "The active administrator account cannot be deleted from the control plane" });
      const deleted = await deleteAccountPermanently(input.userId);
      if (!deleted) throw new TRPCError({ code: "NOT_FOUND", message: "This account no longer exists" });
      await writeAuditEvent({ actorUserId: ctx.user.id, action: "account.permanently_deleted", entityType: "deleted_account", entityId: String(input.userId) });
      return { success: true } as const;
    }),
    addAccountCredit: adminProcedure.input(adminCreditGrantInput).mutation(async ({ ctx, input }) => {
      if (input.userId === ctx.user.id) throw new TRPCError({ code: "BAD_REQUEST", message: "Administrator session credit cannot be adjusted from the control plane" });
      const amountNanos = Math.round(input.amountUsd * 1_000_000_000);
      const result = await grantAdminAccountCredit({ userId: input.userId, amountNanos, actorUserId: ctx.user.id });
      if (!result) throw new TRPCError({ code: "NOT_FOUND", message: "This account no longer exists" });
      await writeAuditEvent({ actorUserId: ctx.user.id, targetUserId: input.userId, action: "account.credit_granted", entityType: "account", entityId: String(input.userId), metadata: { amountNanos: result.amountNanos } });
      return result;
    }),
    resetDiscordVerification: adminProcedure.input(discordVerificationResetInput).mutation(async ({ ctx, input }) => {
      if (input.userId === ctx.user.id) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Administrator sessions bypass Discord verification and cannot be reset from the control plane" });
      }
      const result = await resetDiscordVerification(input.userId);
      if (!result) throw new TRPCError({ code: "NOT_FOUND", message: "This account no longer exists" });
      await writeAuditEvent({
        actorUserId: ctx.user.id,
        targetUserId: input.userId,
        action: "account.discord_verification.reset",
        entityType: "account",
        entityId: String(input.userId),
        metadata: { verificationWasPresent: result.reset },
      });
      return { success: true, reset: result.reset } as const;
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
    orcaRouterCredentials: adminProcedure.query(() => getOrcaRouterCredentialPoolStatus()),
    orcaRouterSlotUsage: adminProcedure.query(() => getOrcaRouterSlotRequestCounts()),
    claudeFable5ProviderSettings: adminProcedure.query(() => getClaudeFable5NvidiaProviderSettings()),
    claudeFable5FailureLogs: adminProcedure.query(async () => (await getRecentClaudeFable5FailureLogs(200)).map(entry => ({ ...entry, publicMessage: PUBLIC_PROVIDER_ERROR_MESSAGE }))),
    updateClaudeFable5ProviderSettings: adminProcedure.input(claudeFable5ProviderSettingsInput).mutation(async ({ ctx, input }) => {
      try {
        const settings = await updateClaudeFable5NvidiaProviderSettings(input, ctx.user.id);
        await writeAuditEvent({
          actorUserId: ctx.user.id,
          action: "provider.claude_fable5.runtime_updated",
          entityType: "provider",
          entityId: "claude-fable-5",
          metadata: {
            providerCount: "providers" in input ? input.providers.length : 1,
            configuredKeySlots: "providers" in input ? input.providers.reduce((count, provider) => count + provider.apiKeys.filter(value => Boolean(value.trim())).length, 0) : (input.apiKeys?.filter(value => Boolean(value.trim())).length ?? 0),
          },
        });
        return settings;
      } catch (error) {
        throw new TRPCError({ code: "BAD_REQUEST", message: error instanceof Error ? error.message : "TokenForge could not save Claude Fable 5 provider settings" });
      }
    }),
    claudeOpus5ProviderSettings: adminProcedure.query(() => getClaudeOpus5ProviderSettings()),
    claudeOpus5FailureLogs: adminProcedure.query(async () => (await getRecentClaudeOpus5FailureLogs(200)).map(entry => ({ ...entry, publicMessage: PUBLIC_PROVIDER_ERROR_MESSAGE }))),
    deepseekV4ProFailureLogs: adminProcedure.query(async () => (await getRecentDeepseekV4ProFailureLogs(200)).map(entry => ({ ...entry, publicMessage: PUBLIC_PROVIDER_ERROR_MESSAGE }))),
    qwen38MaxProviderSettings: adminProcedure.query(() => getQwen38MaxProviderSettings()),
    updateQwen38MaxProviderSettings: adminProcedure.input(claudeOpus5ProviderSettingsInput).mutation(async ({ ctx, input }) => {
      const settings = await updateQwen38MaxProviderSettings(input, ctx.user.id);
      await writeAuditEvent({ actorUserId: ctx.user.id, action: "qwen38_max_provider_settings_updated", entityType: "provider", entityId: "qwen3.8-max", metadata: { providerCount: input.providers.length } });
      return settings;
    }),
    qwen38MaxFailureLogs: adminProcedure.query(async () => (await getRecentQwen38MaxFailureLogs(200)).map(entry => ({ ...entry, publicMessage: PUBLIC_PROVIDER_ERROR_MESSAGE }))),
    updateClaudeOpus5ProviderSettings: adminProcedure.input(claudeOpus5ProviderSettingsInput).mutation(async ({ ctx, input }) => {
      try {
        const settings = await updateClaudeOpus5ProviderSettings(input, ctx.user.id);
        await writeAuditEvent({
          actorUserId: ctx.user.id,
          action: "provider.claude_opus5.runtime_updated",
          entityType: "provider",
          entityId: "claude-opus-5",
          metadata: {
            providerCount: input.providers.length,
            providerIds: input.providers.map(provider => provider.id),
            configuredKeySlots: input.providers.reduce((count, provider) => count + provider.apiKeys.filter(value => Boolean(value.trim())).length, 0),
          },
        });
        return settings;
      } catch (error) {
        throw new TRPCError({ code: "BAD_REQUEST", message: error instanceof Error ? error.message : "TokenForge could not save Claude Opus 5 provider settings" });
      }
    }),
    deleteClaudeOpus5QwenModel: adminProcedure.input(claudeOpus5QwenModelDeleteInput).mutation(async ({ ctx, input }) => {
      try {
        const settings = await deleteClaudeOpus5QwenModel(input, ctx.user.id);
        await writeAuditEvent({ actorUserId: ctx.user.id, action: "provider.claude_opus5.qwen_model_deleted", entityType: "provider", entityId: input.providerId, metadata: { modelEntryId: input.modelEntryId } });
        return settings;
      } catch (error) {
        throw new TRPCError({ code: "BAD_REQUEST", message: error instanceof Error ? error.message : "TokenForge could not delete the Qwen model" });
      }
    }),
    deleteClaudeOpus5QwenApiKey: adminProcedure.input(claudeOpus5QwenApiKeyDeleteInput).mutation(async ({ ctx, input }) => {
      try {
        const settings = await deleteClaudeOpus5QwenApiKey(input, ctx.user.id);
        await writeAuditEvent({ actorUserId: ctx.user.id, action: "provider.claude_opus5.qwen_key_deleted", entityType: "provider", entityId: input.providerId, metadata: { slot: input.slot } });
        return settings;
      } catch (error) {
        throw new TRPCError({ code: "BAD_REQUEST", message: error instanceof Error ? error.message : "TokenForge could not delete the Qwen API key" });
      }
    }),
    glm53ProviderSettings: adminProcedure.query(() => getGlm53ProviderSettings()),
    glm53FailureLogs: adminProcedure.query(async () => (await getRecentGlm53FailureLogs(200)).map(entry => ({ ...entry, publicMessage: PUBLIC_PROVIDER_ERROR_MESSAGE }))),
    updateGlm53ProviderSettings: adminProcedure.input(glm53ProviderSettingsInput).mutation(async ({ ctx, input }) => {
      try {
        const settings = await updateGlm53ProviderSettings(input, ctx.user.id);
        await writeAuditEvent({
          actorUserId: ctx.user.id,
          action: "provider.glm53.runtime_updated",
          entityType: "provider",
          entityId: "glm-5.3",
          metadata: {
            baseUrlChanged: input.baseUrl !== undefined,
            modelChanged: input.model !== undefined,
            apiKeySlotsChanged: (input.apiKeys?.filter(value => Boolean(value.trim())).length ?? 0) + (input.removeSlots?.length ?? 0),
          },
        });
        return settings;
      } catch (error) {
        throw new TRPCError({ code: "BAD_REQUEST", message: error instanceof Error ? error.message : "TokenForge could not save GLM 5.3 provider settings" });
      }
    }),
    sonnet46ProviderSettings: adminProcedure.query(() => getSonnet46ProviderSettings()),
    sonnet46FailureLogs: adminProcedure.query(async () => (await getRecentSonnet46FailureLogs(200)).map(entry => ({ ...entry, publicMessage: PUBLIC_PROVIDER_ERROR_MESSAGE }))),
    updateSonnet46ProviderSettings: adminProcedure.input(sonnet46ProviderSettingsInput).mutation(async ({ ctx, input }) => {
      try {
        const settings = await updateSonnet46ProviderSettings(input, ctx.user.id);
        await writeAuditEvent({ actorUserId: ctx.user.id, action: "provider.sonnet46.runtime_updated", entityType: "provider", entityId: "claude-sonnet-4.6", metadata: { providerGroups: input.providers.length, enabledProviderGroups: input.providers.filter(provider => provider.enabled !== false).length } });
        return settings;
      } catch (error) {
        throw new TRPCError({ code: "BAD_REQUEST", message: error instanceof Error ? error.message : "TokenForge could not save Claude Sonnet 4.6 provider settings" });
      }
    }),
    deepseekV4ProProviderSettings: adminProcedure.query(() => getDeepseekV4ProProviderSettings()),
    updateDeepseekV4ProProviderSettings: adminProcedure.input(deepseekV4ProProviderSettingsInput).mutation(async ({ ctx, input }) => {
      try {
        const settings = await updateDeepseekV4ProProviderSettings(input, ctx.user.id);
        await writeAuditEvent({
          actorUserId: ctx.user.id,
          action: "provider.deepseek_v4_pro.runtime_updated",
          entityType: "provider",
          entityId: "deepseek-v4-pro",
          metadata: "providers" in input ? {
            providerGroups: input.providers.length,
            enabledProviderGroups: input.providers.filter(provider => provider.enabled !== false).length,
            submittedApiKeySlots: input.providers.reduce((total, provider) => total + provider.apiKeys.filter(value => Boolean(value.trim())).length, 0),
            removedApiKeySlots: input.providers.reduce((total, provider) => total + (provider.removeSlots?.length ?? 0), 0),
          } : {
            legacyCompatibilityUpdate: true,
            baseUrlChanged: input.baseUrl !== undefined,
            modelChanged: input.model !== undefined,
            apiKeySlotsChanged: (input.apiKeys?.filter(value => Boolean(value.trim())).length ?? 0) + (input.removeSlots?.length ?? 0),
          },
        });
        return settings;
      } catch (error) {
        throw new TRPCError({ code: "BAD_REQUEST", message: error instanceof Error ? error.message : "TokenForge could not save DeepSeek V4 Pro provider settings" });
      }
    }),
    replaceOrcaRouterCredentials: adminProcedure
      .input(orcaRouterCredentialPoolInput)
      .mutation(async ({ ctx, input }) => {
        try {
          for (const credential of input.credentials) await validateOrcaRouterCredential(credential);
          const slots = await replaceOrcaRouterCredentialPool(input.credentials, ctx.user.id);
          invalidateOrcaRouterCredentialPool();
          await writeAuditEvent({
            actorUserId: ctx.user.id,
            action: "provider.orcarouter.credentials_rotated",
            entityType: "provider",
            entityId: CLAUDE_OPUS5_PROVIDER_SLUG,
            metadata: { slotCount: slots.length, validation: "server_probe" },
          });
          return { source: "database" as const, slots };
        } catch (error) {
          throw new TRPCError({ code: "BAD_REQUEST", message: error instanceof Error ? error.message : "OrcaRouter credential validation failed" });
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
    setProviderEnabled: adminProcedure.input(z.object({ slug: z.enum([FXQIDIAN_PROVIDER_SLUG, CLUSTER_PROTOCOL_PROVIDER_SLUG, TOKENHARBOR_PROVIDER_SLUG, CLAUDE_OPUS5_PROVIDER_SLUG, TOKENROUTER_PROVIDER_SLUG]), enabled: z.boolean() })).mutation(async ({ ctx, input }) => {
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
