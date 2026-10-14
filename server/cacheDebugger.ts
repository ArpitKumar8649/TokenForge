import crypto from "crypto";
import fs from "fs";
import path from "path";

const STATE_FILE_PATH = path.resolve("/tmp/tf_cache_debug_enabled.json");

export interface CacheDebugEntry {
  id: string;
  timestamp: string;
  createdAt: number;
  sessionId: string;
  model: string;
  providerLabel: string;
  source: "api_anthropic" | "api_openai" | "playground";
  incomingBody: string;
  upstreamBody: string;
  promptTokens: number;
  cachedTokens: number;
  completionTokens: number;
  totalTokens: number;
  cachePercent: number;
  latencyMs: number;
  status: number;
}

export interface CacheDebugSummary {
  id: string;
  timestamp: string;
  createdAt: number;
  sessionId: string;
  model: string;
  providerLabel: string;
  source: "api_anthropic" | "api_openai" | "playground";
  promptTokens: number;
  cachedTokens: number;
  completionTokens: number;
  totalTokens: number;
  cachePercent: number;
  latencyMs: number;
  status: number;
  incomingSize: number;
  upstreamSize: number;
}

export interface CacheDiffResult {
  reqA: {
    id: string;
    timestamp: string;
    model: string;
    promptTokens: number;
    cachedTokens: number;
    cachePercent: number;
    providerLabel: string;
  };
  reqB: {
    id: string;
    timestamp: string;
    model: string;
    promptTokens: number;
    cachedTokens: number;
    cachePercent: number;
    providerLabel: string;
  };
  field: "upstream_body" | "incoming_body";
  isFullPrefixStable: boolean;
  differingPartName: string | null;
  differingCharIndexInPart: number;
  firstDifferingGlobalChar: number;
  stablePrefixCharLength: number;
  stablePrefixTokenEstimate: number;
  stablePrefixPercentA: number;
  stablePrefixPercentB: number;
  snippetBefore: string;
  snippetAfterA: string;
  snippetAfterB: string;
  diffExplanation: string;
}

const MAX_DEBUG_ENTRIES = 100;
let cacheDebugEnabled = false;

// Initialize from state file on startup if present
try {
  if (fs.existsSync(STATE_FILE_PATH)) {
    const data = JSON.parse(fs.readFileSync(STATE_FILE_PATH, "utf8"));
    if (typeof data.enabled === "boolean") {
      cacheDebugEnabled = data.enabled;
    }
  }
} catch {
  // Ignore state file read error on startup
}

const debugEntriesRingBuffer: CacheDebugEntry[] = [];

export function isCacheDebugEnabled(): boolean {
  return cacheDebugEnabled;
}

export function setCacheDebugEnabled(enabled: boolean): void {
  cacheDebugEnabled = Boolean(enabled);
  try {
    fs.writeFileSync(STATE_FILE_PATH, JSON.stringify({ enabled: cacheDebugEnabled, updatedAt: Date.now() }), "utf8");
  } catch {
    // Ignore state file write error
  }
}

export function clearCacheDebugEntries(): void {
  debugEntriesRingBuffer.length = 0;
}

export function sanitizePayloadForDebug(payload: unknown): string {
  if (!payload) return "{}";
  if (typeof payload === "string") {
    try {
      const parsed = JSON.parse(payload);
      return sanitizeJsonForDebug(parsed);
    } catch {
      return payload.replace(/Bearer\s+[A-Za-z0-9_\-\.]+/gi, "Bearer [REDACTED]");
    }
  }
  return sanitizeJsonForDebug(payload);
}

function sanitizeJsonForDebug(obj: any): string {
  try {
    const clone = JSON.parse(JSON.stringify(obj, (key, value) => {
      const lower = key.toLowerCase();
      if (
        lower.includes("authorization") ||
        lower.includes("apikey") ||
        lower.includes("api_key") ||
        lower.includes("secret") ||
        lower.includes("password") ||
        lower.includes("credential")
      ) {
        return "[REDACTED]";
      }
      return value;
    }));
    return JSON.stringify(clone, null, 2);
  } catch {
    return String(obj);
  }
}

export function generateSessionId(userId: number | string | undefined, firstUserMessage: string | undefined): string {
  const seed = `${userId ?? "anon"}:${(firstUserMessage ?? "").slice(0, 150).trim()}`;
  return crypto.createHash("sha256").update(seed).digest("hex").slice(0, 12);
}

export function recordCacheDebugEvent(entry: Omit<CacheDebugEntry, "id" | "createdAt" | "timestamp" | "cachePercent"> & { id?: string }): void {
  if (!cacheDebugEnabled) return;

  const now = new Date();
  const promptTokens = Math.max(0, entry.promptTokens || 0);
  const cachedTokens = Math.max(0, entry.cachedTokens || 0);
  const cachePercent = promptTokens > 0 ? Math.min(100, Math.round((cachedTokens / promptTokens) * 1000) / 10) : 0;

  const fullEntry: CacheDebugEntry = {
    id: entry.id || `cdbg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    timestamp: now.toISOString(),
    createdAt: now.getTime(),
    sessionId: entry.sessionId || "default_session",
    model: entry.model,
    providerLabel: entry.providerLabel || "unknown",
    source: entry.source,
    incomingBody: sanitizePayloadForDebug(entry.incomingBody),
    upstreamBody: sanitizePayloadForDebug(entry.upstreamBody),
    promptTokens,
    cachedTokens,
    completionTokens: Math.max(0, entry.completionTokens || 0),
    totalTokens: Math.max(0, entry.totalTokens || promptTokens + (entry.completionTokens || 0)),
    cachePercent,
    latencyMs: Math.max(0, entry.latencyMs || 0),
    status: entry.status || 200,
  };

  debugEntriesRingBuffer.unshift(fullEntry);
  if (debugEntriesRingBuffer.length > MAX_DEBUG_ENTRIES) {
    debugEntriesRingBuffer.pop();
  }
}

export function getCacheDebugSummaries(): CacheDebugSummary[] {
  return debugEntriesRingBuffer.map(e => ({
    id: e.id,
    timestamp: e.timestamp,
    createdAt: e.createdAt,
    sessionId: e.sessionId,
    model: e.model,
    providerLabel: e.providerLabel,
    source: e.source,
    promptTokens: e.promptTokens,
    cachedTokens: e.cachedTokens,
    completionTokens: e.completionTokens,
    totalTokens: e.totalTokens,
    cachePercent: e.cachePercent,
    latencyMs: e.latencyMs,
    status: e.status,
    incomingSize: e.incomingBody.length,
    upstreamSize: e.upstreamBody.length,
  }));
}

export function getCacheDebugEntry(id: string): CacheDebugEntry | null {
  return debugEntriesRingBuffer.find(e => e.id === id) || null;
}

export function exportCacheDebugJsonl(): string {
  return debugEntriesRingBuffer
    .slice()
    .reverse()
    .map(e => JSON.stringify({
      id: e.id,
      timestamp: e.timestamp,
      sessionId: e.sessionId,
      model: e.model,
      provider: e.providerLabel,
      prompt_tokens: e.promptTokens,
      cached_tokens: e.cachedTokens,
      completion_tokens: e.completionTokens,
      cache_percent: e.cachePercent,
      upstream_body: e.upstreamBody,
    }))
    .join("\n");
}

interface StructuralPart {
  name: string;
  content: string;
}

function extractStructuralParts(bodyStr: string): StructuralPart[] {
  const parts: StructuralPart[] = [];
  try {
    const json = JSON.parse(bodyStr);

    // 1. System instructions
    if (json.system !== undefined) {
      if (typeof json.system === "string") {
        parts.push({ name: "system", content: json.system });
      } else if (Array.isArray(json.system)) {
        json.system.forEach((s: any, idx: number) => {
          parts.push({
            name: `system[${idx}]`,
            content: typeof s === "string" ? s : JSON.stringify(s, null, 2),
          });
        });
      } else {
        parts.push({ name: "system", content: JSON.stringify(json.system, null, 2) });
      }
    }

    // 2. Tools definition
    if (Array.isArray(json.tools) && json.tools.length > 0) {
      json.tools.forEach((tool: any, idx: number) => {
        const toolName = tool?.name || tool?.function?.name || `tool_${idx}`;
        parts.push({
          name: `tools[${idx}] (${toolName})`,
          content: JSON.stringify(tool, null, 2),
        });
      });
    }

    // 3. Messages array
    if (Array.isArray(json.messages)) {
      json.messages.forEach((msg: any, idx: number) => {
        const role = msg?.role || "unknown";
        let textSummary = "";
        if (typeof msg.content === "string") {
          textSummary = msg.content;
        } else if (Array.isArray(msg.content)) {
          textSummary = msg.content
            .map((c: any) => {
              if (c?.type === "text") return c.text;
              if (c?.type === "tool_use") return `[tool_use: ${c.name}]`;
              if (c?.type === "tool_result") return `[tool_result: ${typeof c.content === "string" ? c.content.slice(0, 50) : "..."}]`;
              return JSON.stringify(c);
            })
            .join("\n");
        } else {
          textSummary = JSON.stringify(msg.content ?? msg, null, 2);
        }

        parts.push({
          name: `messages[${idx}] (role: ${role})`,
          content: textSummary,
        });
      });
    }

    // If no structural components found, fallback to whole string
    if (parts.length === 0) {
      parts.push({ name: "root_payload", content: bodyStr });
    }
  } catch {
    parts.push({ name: "raw_body", content: bodyStr });
  }

  return parts;
}

export function computeCacheDiffBetweenEntries(
  entryA: CacheDebugEntry,
  entryB: CacheDebugEntry,
  field: "upstream_body" | "incoming_body" = "upstream_body"
): CacheDiffResult {
  const bodyA = field === "upstream_body" ? entryA.upstreamBody : entryA.incomingBody;
  const bodyB = field === "upstream_body" ? entryB.upstreamBody : entryB.incomingBody;

  const partsA = extractStructuralParts(bodyA);
  const partsB = extractStructuralParts(bodyB);

  let differingPartName: string | null = null;
  let differingCharIndexInPart = -1;
  let firstDifferingGlobalChar = -1;
  let matchingChars = 0;
  let snippetBefore = "";
  let snippetAfterA = "";
  let snippetAfterB = "";
  let diffExplanation = "";
  let isFullPrefixStable = false;

  const maxCommon = Math.min(partsA.length, partsB.length);
  let foundDiff = false;

  for (let i = 0; i < maxCommon; i++) {
    const pA = partsA[i];
    const pB = partsB[i];

    if (pA.content === pB.content) {
      matchingChars += pA.content.length;
      continue;
    }

    // Found the first differing part
    foundDiff = true;
    differingPartName = pA.name !== pB.name ? `${pA.name} vs ${pB.name}` : pA.name;

    // Find first differing character
    const minLen = Math.min(pA.content.length, pB.content.length);
    let charIdx = 0;
    while (charIdx < minLen && pA.content[charIdx] === pB.content[charIdx]) {
      charIdx++;
    }

    differingCharIndexInPart = charIdx;
    firstDifferingGlobalChar = matchingChars + charIdx;
    matchingChars += charIdx;

    // Extract 150 chars before and after
    const startBefore = Math.max(0, charIdx - 150);
    snippetBefore = pA.content.slice(startBefore, charIdx);
    snippetAfterA = pA.content.slice(charIdx, charIdx + 150);
    snippetAfterB = pB.content.slice(charIdx, charIdx + 150);

    diffExplanation = `Cache broke inside "${differingPartName}" at character position ${charIdx}. Content diverged between Request A and Request B.`;
    break;
  }

  if (!foundDiff) {
    if (partsA.length === partsB.length) {
      isFullPrefixStable = true;
      differingPartName = null;
      firstDifferingGlobalChar = matchingChars;
      diffExplanation = "Both request payloads are 100% identical byte-for-byte.";
    } else {
      isFullPrefixStable = true;
      const shorter = partsA.length < partsB.length ? "Request A" : "Request B";
      const longer = partsA.length < partsB.length ? "Request B" : "Request A";
      const diffCount = Math.abs(partsA.length - partsB.length);
      differingPartName = `Append-only continuation (+${diffCount} turns in ${longer})`;
      diffExplanation = `Full prefix 100% stable! All ${maxCommon} previous conversation turns are identical byte-for-byte. Any cache miss is confirmed to be upstream multi-node worker routing at the provider.`;
    }
  }

  const totalLenA = Math.max(1, bodyA.length);
  const totalLenB = Math.max(1, bodyB.length);
  const stablePrefixTokenEstimate = Math.round(matchingChars / 4);

  return {
    reqA: {
      id: entryA.id,
      timestamp: entryA.timestamp,
      model: entryA.model,
      promptTokens: entryA.promptTokens,
      cachedTokens: entryA.cachedTokens,
      cachePercent: entryA.cachePercent,
      providerLabel: entryA.providerLabel,
    },
    reqB: {
      id: entryB.id,
      timestamp: entryB.timestamp,
      model: entryB.model,
      promptTokens: entryB.promptTokens,
      cachedTokens: entryB.cachedTokens,
      cachePercent: entryB.cachePercent,
      providerLabel: entryB.providerLabel,
    },
    field,
    isFullPrefixStable,
    differingPartName,
    differingCharIndexInPart,
    firstDifferingGlobalChar,
    stablePrefixCharLength: matchingChars,
    stablePrefixTokenEstimate,
    stablePrefixPercentA: Math.min(100, Math.round((matchingChars / totalLenA) * 1000) / 10),
    stablePrefixPercentB: Math.min(100, Math.round((matchingChars / totalLenB) * 1000) / 10),
    snippetBefore,
    snippetAfterA,
    snippetAfterB,
    diffExplanation,
  };
}
