import { createHmac } from "crypto";
import { eq, like, desc } from "drizzle-orm";
import { getDb, fallbackPlatformSettings } from "./db";
import { platformSettings, providerKeyMetrics, users } from "../drizzle/schema";
import {
  decryptProviderRuntimeConfig,
  encryptProviderRuntimeConfig,
} from "./providerRuntimeConfigVault";
import { cached, bustCache } from "./memoryCache";
import {
  normalizeClaudeOpus5Providers,
  applyManagedProviderKeyUpdate,
  providerApiKeyMasks,
  normalizeClaudeOpus5ProviderId,
  normalizeMaxInputTokens,
  normalizeReasoningEffort,
  normalizePinnedUserEmails,
  clearRemovedManagedProviderTelemetry,
  maskProviderApiKey,
  managedProviderCredentialFingerprint,
} from "./db";
import {
  getDynamicModelCatalogue,
  getTokenForgeModel,
  TOKENROUTER_PROVIDER_SLUG,
} from "./modelCatalogue";
import {
  getProviderCredentialTelemetry,
  getCredentialSlotTelemetry,
  type CredentialTelemetryProvider,
} from "./providerCredentialTelemetry";

export interface UniversalModelProviderConfig {
  id: string;
  label: string;
  enabled: boolean;
  baseUrl: string;
  model: string;
  apiKeys: string[];
  apiKeyEnabled?: boolean[];
  maxInputTokens?: number | null;
  maxOutputTokens?: number | null;
  disableIdentityPrompt?: boolean;
  bypassCooldown?: boolean;
  supportsVision?: boolean;
  supportsDocuments?: boolean;
  pinnedUserEmails?: string[];
  reasoningEffort?: "low" | "medium" | "high" | "xhigh" | "max" | null;
}

export interface UniversalModelRuntimePayload {
  modelId: string;
  providers: UniversalModelProviderConfig[];
}

export interface UniversalModelProviderSettingsData {
  modelId: string;
  modelDisplayName: string;
  providers: Array<{
    id: string;
    label: string;
    enabled: boolean;
    baseUrl: string;
    model: string;
    apiKeyMasks: Array<{ slot: number; value: string; enabled?: boolean }>;
    maxInputTokens?: number;
    maxOutputTokens?: number;
    disableIdentityPrompt?: boolean;
    bypassCooldown?: boolean;
    supportsVision?: boolean;
    supportsDocuments?: boolean;
    pinnedUserEmails?: string[];
    reasoningEffort?: "low" | "medium" | "high" | "xhigh" | "max" | null;
  }>;
  source: "database" | "catalogue" | "environment";
  updatedAt?: Date | null;
  updatedByUserId?: number | null;
}

export const MAX_UNIVERSAL_PROVIDERS = 100;

export function universalModelSettingKey(modelId: string): string {
  const normalized = modelId.trim().toLowerCase();
  return `universal_model_runtime:${normalized}`;
}

function getTokenRouterCredentialPool(): string[] {
  const direct = process.env.TOKENROUTER_API_KEY?.trim();
  const pool = process.env.TOKENROUTER_API_KEYS?.split(",").map(k => k.trim()).filter(Boolean) ?? [];
  const keys = Array.from(new Set([direct, ...pool].filter((k): k is string => Boolean(k))));
  return keys;
}

export function defaultUniversalModelRuntime(modelId: string): UniversalModelRuntimePayload {
  const normalized = modelId.trim().toLowerCase();
  const modelDef = getTokenForgeModel(normalized);
  const tokenRouterKeys = getTokenRouterCredentialPool();
  const defaultKeys = tokenRouterKeys.length
    ? tokenRouterKeys
    : [process.env.OPENAI_API_KEY?.trim() || "sk-tokenforge-placeholder"];

  const defaultBaseUrl = process.env.TOKENROUTER_BASE_URL?.trim() || "https://api.tokenrouter.io/v1";
  const defaultUpstreamModel = modelDef?.upstreamModelId || modelDef?.id || normalized;
  const isMultimodal = Boolean(
    modelDef?.capabilities?.includes("multimodal") ||
    modelDef?.capabilities?.includes("vision") ||
    normalized.includes("vision") ||
    normalized.includes("astra")
  );

  return {
    modelId: normalized,
    providers: [
      {
        id: "provider-1",
        label: `${modelDef?.displayName || normalized} Primary`,
        enabled: true,
        baseUrl: defaultBaseUrl,
        model: defaultUpstreamModel,
        apiKeys: defaultKeys,
        apiKeyEnabled: defaultKeys.map(() => true),
        supportsVision: isMultimodal,
        supportsDocuments: false,
        pinnedUserEmails: [],
      },
    ],
  };
}

export async function readUniversalModelRuntimeOverride(modelId: string): Promise<{
  payload: UniversalModelRuntimePayload;
  updatedAt?: Date | null;
  updatedByUserId?: number | null;
} | null> {
  const cacheKey = `universal_runtime:${modelId.trim().toLowerCase()}`;
  return cached(cacheKey, 60_000, async () => {
    const settingKey = universalModelSettingKey(modelId);
    const db = await getDb();
    let record: { value: string; updatedAt?: Date | null; updatedByUserId?: number | null } | undefined;

    if (db) {
      try {
        record = (await db.select().from(platformSettings).where(eq(platformSettings.settingKey, settingKey)).limit(1))[0];
      } catch {
        // Fall back to memory cache
      }
    }

    if (!record) {
      record = fallbackPlatformSettings.get(settingKey);
    }

    if (!record) return null;

    try {
      const encoded = JSON.parse(record.value) as { ciphertext?: string; iv?: string; authTag?: string };
      const decrypted = decryptProviderRuntimeConfig({
        ciphertext: String(encoded.ciphertext ?? ""),
        iv: String(encoded.iv ?? ""),
        authTag: String(encoded.authTag ?? ""),
      });
      if (!decrypted || typeof decrypted !== "object") return null;
      const candidate = decrypted as Partial<UniversalModelRuntimePayload>;
      if (!Array.isArray(candidate.providers)) return null;

      const normalizedProviders = normalizeClaudeOpus5Providers(candidate.providers as any[], []);
      return {
        payload: {
          modelId: candidate.modelId || modelId,
          providers: normalizedProviders as UniversalModelProviderConfig[],
        },
        updatedAt: record.updatedAt,
        updatedByUserId: record.updatedByUserId,
      };
    } catch {
      return null;
    }
  });
}

export async function isUniversalModelConfigured(modelId: string): Promise<boolean> {
  const override = await readUniversalModelRuntimeOverride(modelId);
  return Boolean(override && override.payload.providers.length > 0);
}

export async function getUniversalModelRuntimeConfig(modelId: string): Promise<UniversalModelRuntimePayload> {
  const override = await readUniversalModelRuntimeOverride(modelId);
  if (override?.payload.providers.length) {
    return override.payload;
  }
  return defaultUniversalModelRuntime(modelId);
}

export async function getUniversalModelProviderSettings(modelId: string): Promise<UniversalModelProviderSettingsData> {
  const normalized = modelId.trim().toLowerCase();
  const modelDef = getTokenForgeModel(normalized);
  const runtime = await getUniversalModelRuntimeConfig(normalized);
  const override = await readUniversalModelRuntimeOverride(normalized);

  return {
    modelId: normalized,
    modelDisplayName: modelDef?.displayName || normalized,
    providers: runtime.providers.map(provider => ({
      id: provider.id,
      label: provider.label,
      enabled: provider.enabled,
      baseUrl: provider.baseUrl,
      model: provider.model,
      apiKeyMasks: providerApiKeyMasks(provider.apiKeys, provider.apiKeyEnabled),
      ...(provider.maxInputTokens !== undefined ? { maxInputTokens: provider.maxInputTokens ?? undefined } : {}),
      ...(provider.maxOutputTokens !== undefined ? { maxOutputTokens: provider.maxOutputTokens ?? undefined } : {}),
      ...(provider.disableIdentityPrompt ? { disableIdentityPrompt: true } : {}),
      pinnedUserEmails: provider.pinnedUserEmails ?? [],
      bypassCooldown: provider.bypassCooldown === true,
      supportsVision: provider.supportsVision === true,
      supportsDocuments: provider.supportsDocuments === true,
      reasoningEffort: provider.reasoningEffort ?? null,
    })),
    source: override ? "database" : "catalogue",
    updatedAt: override?.updatedAt ?? null,
    updatedByUserId: override?.updatedByUserId ?? null,
  };
}

export async function updateUniversalModelProviderSettings(
  input: {
    modelId: string;
    providers: Array<{
      id: string;
      label: string;
      enabled?: boolean;
      baseUrl: string;
      model: string;
      apiKeys: string[];
      apiKeyEnabled?: boolean[];
      removeSlots?: number[];
      maxInputTokens?: number | null;
      maxOutputTokens?: number | null;
      disableIdentityPrompt?: boolean;
      pinnedUserEmails?: string[];
      bypassCooldown?: boolean;
      supportsVision?: boolean;
      supportsDocuments?: boolean;
      reasoningEffort?: "low" | "medium" | "high" | "xhigh" | "max" | null;
    }>;
  },
  updatedByUserId: number
): Promise<UniversalModelProviderSettingsData> {
  const db = await getDb();
  if (!db) throw new Error("TokenForge database is unavailable");

  const normalizedModelId = input.modelId.trim().toLowerCase();
  if (!normalizedModelId) throw new Error("A valid model ID is required");

  const current = await getUniversalModelRuntimeConfig(normalizedModelId);
  const currentById = new Map(current.providers.map(provider => [provider.id, provider]));

  const nextProviders = input.providers.map((submitted, index) => {
    const existing = currentById.get(submitted.id);
    const keys = applyManagedProviderKeyUpdate(existing as any, submitted);
    const maxInputTokens = normalizeMaxInputTokens(submitted.maxInputTokens ?? existing?.maxInputTokens);
    const maxOutputTokens = normalizeMaxInputTokens(submitted.maxOutputTokens ?? existing?.maxOutputTokens);
    const disableIdentityPrompt = submitted.disableIdentityPrompt !== undefined
      ? submitted.disableIdentityPrompt === true
      : existing?.disableIdentityPrompt === true;
    const bypassCooldown = submitted.bypassCooldown !== undefined
      ? submitted.bypassCooldown === true
      : existing?.bypassCooldown === true;
    const supportsVision = submitted.supportsVision !== undefined
      ? submitted.supportsVision === true
      : existing?.supportsVision === true;
    const supportsDocuments = submitted.supportsDocuments !== undefined
      ? submitted.supportsDocuments === true
      : existing?.supportsDocuments === true;
    const reasoningEffort = normalizeReasoningEffort(
      submitted.reasoningEffort !== undefined ? submitted.reasoningEffort : (existing as any)?.reasoningEffort
    );
    const pinnedUserEmails = normalizePinnedUserEmails(
      submitted.pinnedUserEmails !== undefined ? submitted.pinnedUserEmails : existing?.pinnedUserEmails
    );

    return {
      id: normalizeClaudeOpus5ProviderId(submitted.id, `provider-${index + 1}`),
      label: submitted.label.trim() || `Provider ${index + 1}`,
      enabled: submitted.enabled !== false,
      baseUrl: submitted.baseUrl.trim(),
      model: submitted.model.trim(),
      ...keys,
      ...(disableIdentityPrompt ? { disableIdentityPrompt: true } : {}),
      ...(bypassCooldown ? { bypassCooldown: true } : {}),
      ...(supportsVision ? { supportsVision: true } : {}),
      ...(supportsDocuments ? { supportsDocuments: true } : {}),
      ...(maxInputTokens !== undefined ? { maxInputTokens } : {}),
      ...(maxOutputTokens !== undefined ? { maxOutputTokens } : {}),
      ...(reasoningEffort ? { reasoningEffort } : {}),
      ...(pinnedUserEmails.length ? { pinnedUserEmails } : {}),
    };
  });

  const ids = new Set(nextProviders.map(p => p.id));
  if (
    !nextProviders.length ||
    nextProviders.length > MAX_UNIVERSAL_PROVIDERS ||
    ids.size !== nextProviders.length ||
    nextProviders.some(p => !p.baseUrl || !p.model || !p.apiKeys.length)
  ) {
    throw new Error(`Each ${normalizedModelId} provider needs a unique identifier, base URL, model ID, and at least one API key`);
  }

  const payload: UniversalModelRuntimePayload = {
    modelId: normalizedModelId,
    providers: nextProviders,
  };

  const encrypted = encryptProviderRuntimeConfig(payload);
  const settingKey = universalModelSettingKey(normalizedModelId);
  const removedProviders = current.providers.filter(p => !ids.has(p.id));

  fallbackPlatformSettings.set(settingKey, {
    value: JSON.stringify(encrypted),
    updatedAt: new Date(),
    updatedByUserId,
  });

  try {
    await db.transaction(async tx => {
      let validUserId: number | null = null;
      if (typeof updatedByUserId === "number" && updatedByUserId > 0) {
        const found = await tx.select({ id: users.id }).from(users).where(eq(users.id, updatedByUserId)).limit(1).catch(() => []);
        if (found.length) validUserId = updatedByUserId;
      }
      await tx
        .insert(platformSettings)
        .values({ settingKey, value: JSON.stringify(encrypted), updatedByUserId: validUserId })
        .onDuplicateKeyUpdate({ set: { value: JSON.stringify(encrypted), updatedByUserId: validUserId, updatedAt: new Date() } });
    });
  } catch (err) {
    console.warn(`[Universal Model ${normalizedModelId} settings write to DB failed; runtime preserved in memory]`, err);
  }

  bustCache(`universal_runtime:${normalizedModelId}`);
  clearRemovedManagedProviderTelemetry(normalizedModelId, removedProviders as any[]);
  return getUniversalModelProviderSettings(normalizedModelId);
}

export async function listUniversalConfiguredModels(): Promise<Array<{
  modelId: string;
  displayName: string;
  providerCount: number;
  configured: boolean;
  source: "database" | "catalogue";
  updatedAt: Date | null;
  capabilities: readonly string[];
}>> {
  const catalogue = getDynamicModelCatalogue();
  const db = await getDb();
  const dbRecords = db
    ? await db
        .select()
        .from(platformSettings)
        .where(like(platformSettings.settingKey, "universal_model_runtime:%"))
        .catch(() => [])
    : [];

  const configuredMap = new Map<string, { updatedAt: Date | null }>();
  for (const record of dbRecords) {
    const modelId = record.settingKey.replace(/^universal_model_runtime:/, "");
    configuredMap.set(modelId, { updatedAt: record.updatedAt });
  }

  // Also check memory fallback
  for (const [key, record] of Array.from(fallbackPlatformSettings.entries())) {
    if (key.startsWith("universal_model_runtime:")) {
      const modelId = key.replace(/^universal_model_runtime:/, "");
      if (!configuredMap.has(modelId)) {
        configuredMap.set(modelId, { updatedAt: record.updatedAt });
      }
    }
  }

  const modelMap = new Map<string, {
    modelId: string;
    displayName: string;
    providerCount: number;
    configured: boolean;
    source: "database" | "catalogue";
    updatedAt: Date | null;
    capabilities: readonly string[];
  }>();

  // Add all catalogue models
  for (const item of catalogue) {
    const configured = configuredMap.has(item.id);
    modelMap.set(item.id, {
      modelId: item.id,
      displayName: item.displayName,
      providerCount: 1, // Default or overridden
      configured,
      source: configured ? "database" : "catalogue",
      updatedAt: configuredMap.get(item.id)?.updatedAt ?? null,
      capabilities: item.capabilities,
    });
  }

  // Add custom configured models not in catalogue
  for (const [modelId, meta] of Array.from(configuredMap.entries())) {
    if (!modelMap.has(modelId)) {
      modelMap.set(modelId, {
        modelId,
        displayName: modelId,
        providerCount: 1,
        configured: true,
        source: "database",
        updatedAt: meta.updatedAt,
        capabilities: ["coding", "streaming"],
      });
    }
  }

  return Array.from(modelMap.values()).sort((a, b) => {
    if (a.configured && !b.configured) return -1;
    if (!a.configured && b.configured) return 1;
    return a.displayName.localeCompare(b.displayName);
  });
}

export async function getUniversalModelKeyMetricGroup(modelId: string) {
  const normalized = modelId.trim().toLowerCase();
  const db = await getDb();
  const runtime = await getUniversalModelRuntimeConfig(normalized);

  const rows = db
    ? await db
        .select()
        .from(providerKeyMetrics)
        .where(eq(providerKeyMetrics.providerModelId, normalized))
        .catch(() => [])
    : [];

  const metricsByKey = new Map(rows.map(row => [`${row.providerModelId}:${row.credentialFingerprint}`, row]));

  const providers = runtime.providers.map(provider => {
    return {
      id: provider.id,
      label: provider.label,
      slots: provider.apiKeys.map((credential, index) => {
        const fingerprint = managedProviderCredentialFingerprint(normalized as any, credential, provider.id);
        const metric = metricsByKey.get(`${normalized}:${fingerprint}`);
        const liveSlot = getCredentialSlotTelemetry(`${normalized}:${provider.id}` as CredentialTelemetryProvider, index);
        const requestCount = Number(metric?.requestCount ?? 0);
        const successCount = Number(metric?.successCount ?? 0);
        const failureCount = Number(metric?.failureCount ?? 0);
        return {
          slot: index + 1,
          keyMask: maskProviderApiKey(credential),
          requestCount,
          successCount,
          failureCount,
          health: liveSlot?.health ?? (failureCount > 0 && successCount === 0 ? "cooling-down" : "healthy"),
          cooldownUntil: liveSlot?.cooldownUntil ?? null,
          lastRequestAt: metric?.lastRequestAt ?? null,
          lastSuccessAt: metric?.lastSuccessAt ?? null,
          lastFailureAt: metric?.lastFailureAt ?? null,
          activeRequests: liveSlot?.activeRequests ?? 0,
          lastLatencyMs: liveSlot?.lastLatencyMs ?? null,
          avgLatencyMs: liveSlot?.avgLatencyMs ?? null,
          lastTtftMs: liveSlot?.lastTtftMs ?? null,
          avgTtftMs: liveSlot?.avgTtftMs ?? null,
          lastTokensPerSec: liveSlot?.lastTokensPerSec ?? null,
          avgTokensPerSec: liveSlot?.avgTokensPerSec ?? null,
          requestCap: null,
          retired: false,
        };
      }),
    };
  });

  return {
    modelId: normalized,
    slots: [],
    providers,
  };
}

export async function listAllUniversalKeyMetricGroups() {
  const models = await listUniversalConfiguredModels();
  const configuredOnly = models.filter(m => m.configured);
  const metricGroups = await Promise.all(
    configuredOnly.map(m => getUniversalModelKeyMetricGroup(m.modelId))
  );
  return metricGroups;
}
