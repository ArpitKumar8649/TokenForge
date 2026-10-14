export type UserTier = "free" | "starter" | "pro" | "max" | "power" | "ultra";

export type AdminAccount = {
  id: number;
  name: string | null;
  email: string | null;
  tier?: UserTier | null;
  creditsEnabled?: boolean | null;
  suspended: boolean | null;
  suspicious: boolean | null;
  requestLimit: number | null;
  tokenLimit: number | null;
  balanceNanos: number;
  paygBalanceNanos?: number;
  codingPlanTokens?: number;
  lifetimeSpendNanos: number;
  requestCount: number;
  totalTokens: number;
  lastActivityAt: Date | null;
  discordVerifiedAt: Date | null;
  specialReferralSlot: number | null;
  specialReferralAwardedAt: Date | null;
  referralCount: number;
  logUserMessages?: boolean | null;
};

export type AdminAuditRecord = {
  id: number;
  action: string;
  entityType: string;
  entityId: string | null;
  createdAt: Date;
};

export type AdminAccountModelUsage = {
  userId: number;
  modelId: string;
  requestCount: number;
  totalTokens: number;
};

export type AdminGlobalModelUsage = {
  modelId: string;
  accountCount: number;
  requestCount: number;
  totalTokens: number;
};

export type PreProvisionedAccount = {
  id: number;
  email: string;
  introductoryCreditNanos: number;
  createdAt: Date;
  activatedAt: Date | null;
  activatedUserId: number | null;
  activatedUserName: string | null;
};

export type ManagedKeyMask = {
  slot: number;
  value: string;
  enabled?: boolean;
  activeRequests?: number;
  remainingRequests?: number;
  maxActiveRequests?: number;
};

export type ManagedProviderSettingsData = {
  baseUrl: string;
  model: string;
  apiKeyMasks: ManagedKeyMask[];
  source: "database" | "environment";
};

export type ClaudeOpus5QwenModelSetting = {
  id: string;
  model: string;
  enabled: boolean;
  quotaTokens: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  requestCount: number;
  retired: boolean;
  retiredAt: Date | null;
  lastUsedAt: Date | null;
};

export type BaiProviderCircuitStatus = {
  providerGroupId: string;
  rateLimitCount: number;
  consecutiveRateLimits: number;
  cooldownUntil: Date | null;
  lastRateLimitedAt: Date | null;
  lastSuccessAt: Date | null;
  coolingDown: boolean;
};

export type ClaudeOpus5ProviderSettingsData = {
  id: string;
  label: string;
  enabled: boolean;
  baseUrl: string;
  model: string;
  apiKeyMasks: ManagedKeyMask[];
  maxOutputTokens?: number;
  maxInputTokens?: number;
  modelPool?: ClaudeOpus5QwenModelSetting[];
  baiCircuit?: BaiProviderCircuitStatus;
  disableIdentityPrompt?: boolean;
  bypassCooldown?: boolean;
  supportsVision?: boolean;
  supportsDocuments?: boolean;
  pinnedUserEmails?: string[];
  reasoningEffort?: "low" | "medium" | "high" | "xhigh" | "max" | null;
};

export type ClaudeOpus5SettingsData = {
  providers: ClaudeOpus5ProviderSettingsData[];
  baiPriority?: boolean;
  source: "database" | "environment";
};

export type ClaudeOpus5ProviderDraft = {
  id: string;
  label: string;
  enabled: boolean;
  baseUrl: string;
  model: string;
  apiKeys: string[];
  apiKeyEnabled?: boolean[];
  removedSlots: number[];
  maxInputTokens?: number | string;
  maxOutputTokens?: number | string;
  disableIdentityPrompt?: boolean;
  bypassCooldown?: boolean;
  supportsVision?: boolean;
  supportsDocuments?: boolean;
  pinnedUserEmails?: string[];
  reasoningEffort?: "low" | "medium" | "high" | "xhigh" | "max" | "" | null;
};

export type PinnedUserRoutingPolicy = {
  softPreference: boolean;
  updatedAt?: string | null;
  updatedBy?: number | null;
};

export type DeepseekV4ProSettingsData = ClaudeOpus5SettingsData;

export type ManagedProviderKeyMetric = {
  slot: number;
  keyMask: string;
  requestCount: number;
  successCount: number;
  failureCount: number;
  health: "healthy" | "cooling-down" | "unverified" | "unknown";
  cooldownUntil: Date | null;
  lastRequestAt: Date | null;
  lastSuccessAt: Date | null;
  lastFailureAt: Date | null;
  activeRequests?: number;
  lastLatencyMs?: number | null;
  avgLatencyMs?: number | null;
  lastTtftMs?: number | null;
  avgTtftMs?: number | null;
  lastTokensPerSec?: number | null;
  avgTokensPerSec?: number | null;
};

export type ManagedProviderKeyMetricGroup = {
  modelId: string;
  slots: ManagedProviderKeyMetric[];
  providers?: { id: string; label: string; slots: ManagedProviderKeyMetric[] }[];
};

export type RenderNimProxyEndpointData = {
  id: string;
  url: string;
  enabled: boolean;
  activeRequests: number;
  availableSlots: number;
  peakActiveRequests: number;
  requestCount: number;
  successCount: number;
  failureCount: number;
  timeoutCount: number;
  cooldownUntil: Date | null;
  lastRequestAt: Date | null;
  lastSuccessAt: Date | null;
  lastFailureAt: Date | null;
  lastHttpStatus: number | null;
  lastFailureKind: string | null;
  lastFailureMessage: string | null;
};

export type RenderNimProxySwarmSettingsData = {
  enabled: boolean;
  model: string;
  apiKeyConfigured: boolean;
  maxConcurrentRequests: number;
  endpoints: RenderNimProxyEndpointData[];
  source: "database" | "environment";
  updatedAt: Date | null;
};

export type BailuWebshareProxySettingsData = {
  enabled: boolean;
  proxies: {
    id: string;
    label: string;
    host: string;
    port: number;
    enabled: boolean;
    usernameMask: string;
    passwordConfigured: boolean;
    metrics: {
      activeRequests: number;
      requestCount: number;
      successCount: number;
      failureCount: number;
      timeoutCount: number;
      cooldownUntil: Date | null;
      lastRequestAt: Date | null;
      lastSuccessAt: Date | null;
      lastFailureAt: Date | null;
      lastFailureKind: string | null;
      health: "healthy" | "degraded" | "cooling-down" | "disabled";
    };
  }[];
  source: "database" | "not_configured";
  updatedAt: Date | null;
};

export type BailuWebshareProxyDraft = {
  id: string;
  label: string;
  host: string;
  port: string;
  username: string;
  password: string;
  enabled: boolean;
};

export type ClaudeOpus5FailureLog = {
  id: number;
  sourceType: "provider" | "render";
  sourceId: string;
  sourceLabel: string;
  credentialSlot?: number | null;
  httpStatus: number | null;
  failureKind: string;
  retryable: boolean;
  callerMessage: string;
  publicMessage?: string;
  occurredAt: Date;
};

export type SpecialReferralCampaignData = {
  cap: number;
  reserved: number;
  awarded: number;
  remaining: number;
  link: string;
  accounts: Array<{
    id: number;
    name: string | null;
    email: string | null;
    slotNumber: number;
    awardedAt: Date | null;
  }>;
};

export type ProviderTelemetryItem = {
  providerSlug: string;
  healthySlots: number;
  poolSize: number;
  coolingDownSlots: number;
  failoverCount: number;
  lastSuccessAt: Date | string | null;
};

export type ManagedModelOverviewItem = {
  modelId: string;
  displayName: string;
  providerSlug: string;
  enabled: boolean;
  minTier?: UserTier;
  isPayg?: boolean;
  isBundle?: boolean;
  isTokenPlan?: boolean;
  enableCompactScaling?: boolean;
  compactTriggerTokens?: number;
};

