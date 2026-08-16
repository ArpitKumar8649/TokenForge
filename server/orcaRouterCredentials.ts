import { decryptOrcaRouterCredential } from "./orcaRouterCredentialVault";
import { loadOrcaRouterCredentialSlotCiphertexts, listOrcaRouterCredentialSlotSummaries } from "./db";

export type OrcaRouterCredentialSelection = { credential: string; slot: number; poolSize: number };
export type OrcaRouterCredentialPoolStatus = {
  source: "database" | "environment" | "unconfigured";
  slots: Array<{ slot: number; fingerprintSuffix: string; lastValidatedAt: Date; updatedAt: Date }>;
};

export const ORCA_ROUTER_CREDENTIAL_POOL_SIZE = 15;
const LEGACY_ORCA_ROUTER_CREDENTIAL_POOL_SIZE = 3;
let rotationIndex = 0;
const slotRequestCounts = new Map<number, number>();
let cachedPool: { expiresAt: number; credentials: OrcaRouterCredentialSelection[] } | null = null;
const POOL_CACHE_MS = 5_000;

/** Runtime-only aggregate request totals. Credentials and caller data are intentionally excluded. */
export function getOrcaRouterSlotRequestCounts(): Array<{ slot: number; requestCount: number }> {
  return Array.from(slotRequestCounts.entries())
    .map(([slot, requestCount]) => ({ slot, requestCount }))
    .sort((left, right) => left.slot - right.slot);
}

/** Clears ephemeral totals during pool rotation and deterministic test setup. */
export function resetOrcaRouterSlotRequestCounts() {
  slotRequestCounts.clear();
}

function environmentFallback() {
  const credential = process.env.CLAUDE_OPUS5_API_KEY?.trim();
  return credential ? [{ credential, slot: 0, poolSize: 1 }] : [];
}

async function loadDatabasePool() {
  const rows = await loadOrcaRouterCredentialSlotCiphertexts();
  if (!rows.length) return { found: false as const, credentials: [] as OrcaRouterCredentialSelection[] };
  const isSupportedPoolSize = rows.length === ORCA_ROUTER_CREDENTIAL_POOL_SIZE || rows.length === LEGACY_ORCA_ROUTER_CREDENTIAL_POOL_SIZE;
  if (!isSupportedPoolSize || rows.some((row, index) => row.slot !== index)) return { found: true as const, credentials: [] as OrcaRouterCredentialSelection[] };
  try {
    const credentials = rows.map(row => ({ credential: decryptOrcaRouterCredential(row), slot: row.slot, poolSize: rows.length }));
    return { found: true as const, credentials };
  } catch {
    return { found: true as const, credentials: [] as OrcaRouterCredentialSelection[] };
  }
}

export async function getOrcaRouterCredentialPool() {
  if (cachedPool && cachedPool.expiresAt > Date.now()) return cachedPool.credentials;
  const databasePool = await loadDatabasePool();
  const credentials = databasePool.found ? databasePool.credentials : environmentFallback();
  cachedPool = { credentials, expiresAt: Date.now() + POOL_CACHE_MS };
  return credentials;
}

export async function selectNextOrcaRouterCredentialWithSlot() {
  const pool = await getOrcaRouterCredentialPool();
  if (!pool.length) return null;
  const selected = pool[rotationIndex % pool.length];
  rotationIndex = (rotationIndex + 1) % pool.length;
  slotRequestCounts.set(selected.slot, (slotRequestCounts.get(selected.slot) ?? 0) + 1);
  return selected;
}

export function invalidateOrcaRouterCredentialPool() {
  cachedPool = null;
  rotationIndex = 0;
  resetOrcaRouterSlotRequestCounts();
}

export async function getOrcaRouterCredentialPoolStatus(): Promise<OrcaRouterCredentialPoolStatus> {
  const slots = await listOrcaRouterCredentialSlotSummaries();
  if (slots.length > 0) return { source: "database", slots: slots.map(({ slot, fingerprintSuffix, lastValidatedAt, updatedAt }) => ({ slot, fingerprintSuffix, lastValidatedAt, updatedAt })) };
  return process.env.CLAUDE_OPUS5_API_KEY?.trim()
    ? { source: "environment", slots: [{ slot: 0, fingerprintSuffix: "", lastValidatedAt: new Date(0), updatedAt: new Date(0) }] }
    : { source: "unconfigured", slots: [] };
}

export async function validateOrcaRouterCredential(credential: string) {
  const baseUrl = process.env.CLAUDE_OPUS5_BASE_URL?.replace(/\/$/, "");
  const model = process.env.CLAUDE_OPUS5_MODEL?.trim();
  if (!baseUrl || !model) throw new Error("OrcaRouter validation is not configured");
  const response = await fetch(`${baseUrl}/v1/chat/completions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${credential.trim()}`, "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ model, messages: [{ role: "user", content: "Reply with: ready" }], max_tokens: 2, stream: false }),
    signal: AbortSignal.timeout(90_000),
  });
  if (!response.ok) throw new Error(`OrcaRouter credential validation failed (HTTP ${response.status})`);
}
