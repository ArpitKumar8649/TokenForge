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
} from "./db";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { adminProcedure, protectedProcedure, publicProcedure, router } from "./_core/trpc";

const apiKeyLabel = z
  .string()
  .trim()
  .min(1, "Choose a label for this key")
  .max(100, "Key labels must be 100 characters or fewer");

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
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
