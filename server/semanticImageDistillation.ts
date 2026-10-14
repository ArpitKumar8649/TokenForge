import { createHash } from "node:crypto";
import {
  findAllMultimodalProviders,
  getImageSemanticDescription,
  saveImageSemanticDescription,
  type MultimodalProviderCandidate,
} from "./db";
import {
  normalizeUpstreamChatCompletionsUrl,
  buildUpstreamRequestHeaders,
} from "./modelCapabilityRouter";
import { safeFetch } from "./openaiGateway";

export interface ExtractedImageTarget {
  hash: string;
  urlOrData: string;
  mediaType?: string;
}

const DISTILLATION_PROMPT = `You are an expert technical visual analyst and OCR engine.
Provide a dense, highly detailed, objective technical description of this image so a text-only AI model can fully understand and reason about all of its contents.
Include:
1. Text / OCR: Transcribe all visible text, headers, labels, code snippets, logs, error messages, or numerical values exactly as shown.
2. Diagrams & Schematics: Describe the flow, architecture, nodes, connections, arrows, entities, and relationships.
3. User Interface / Web / App: Describe UI layout, active views, buttons, forms, tables, inputs, and states.
4. Data & Visuals: Explain graphs, charts, axes, legends, trends, and data points.
5. Context: Identify the subject matter, file formats, or tools depicted.
Format your output cleanly in markdown without conversational filler (do NOT say "Here is a description" or "This image shows"). Start directly with the structured description.`;

// In-memory LRU cache
const MAX_CACHE_SIZE = 5000;
const NEGATIVE_CACHE_TTL_MS = 300_000; // 5 minutes for negative cache
const _memoryCache = new Map<string, { description: string | null; cachedAt: number }>();

// In-flight deduplication to prevent duplicate concurrent upstream distillation calls
const _inFlightDistillations = new Map<string, Promise<string | null>>();

/**
 * Computes a deterministic SHA-256 hash for any visual data string (URL or base64 data).
 */
export function computeImageHash(source: string): string {
  if (!source || typeof source !== "string") return "";
  return createHash("sha256").update(source.trim()).digest("hex");
}

/**
 * Fast synchronous check in memory cache.
 */
export function getCachedImageDescriptionSync(imageHash: string): string | null {
  if (!imageHash) return null;
  const entry = _memoryCache.get(imageHash);
  if (entry) return entry.description;
  return null;
}

/**
 * Checks in-memory cache first, then falls back to persistent database storage.
 */
export async function getImageSemanticDescriptionWithCache(imageHash: string): Promise<string | null> {
  if (!imageHash) return null;

  // 1. Check memory cache (including cached nulls within TTL)
  const mem = _memoryCache.get(imageHash);
  if (mem) {
    if (mem.description !== null || Date.now() - mem.cachedAt < NEGATIVE_CACHE_TTL_MS) {
      return mem.description;
    }
  }

  // 2. Check persistent database
  try {
    const dbDescription = await getImageSemanticDescription(imageHash);
    setMemoryCache(imageHash, dbDescription ?? null);
    return dbDescription ?? null;
  } catch (err) {
    console.warn("[SemanticDistillation] Error reading from DB cache:", err);
  }

  return null;
}

function setMemoryCache(imageHash: string, description: string | null): void {
  if (_memoryCache.size >= MAX_CACHE_SIZE) {
    const oldestKey = _memoryCache.keys().next().value;
    if (oldestKey) _memoryCache.delete(oldestKey);
  }
  _memoryCache.set(imageHash, { description, cachedAt: Date.now() });
}

/**
 * Extracts all visual assets and their deterministic SHA-256 hashes from a message turn.
 */
export function extractImagesFromMessage(msg: any): ExtractedImageTarget[] {
  if (!msg || typeof msg !== "object") return [];
  const results: ExtractedImageTarget[] = [];
  const seenHashes = new Set<string>();

  const register = (urlOrData: string) => {
    if (!urlOrData || typeof urlOrData !== "string" || urlOrData.trim().length === 0) return;
    const hash = computeImageHash(urlOrData);
    if (!hash || seenHashes.has(hash)) return;
    seenHashes.add(hash);
    results.push({ hash, urlOrData: urlOrData.trim() });
  };

  // Top-level message image fields
  if (Array.isArray(msg.images)) {
    for (const item of msg.images) {
      if (typeof item === "string") register(item);
      else if (item && typeof item.url === "string") register(item.url);
    }
  }
  if (typeof msg.image === "string") {
    register(msg.image);
  }

  // Content array parts
  if (Array.isArray(msg.content)) {
    for (const part of msg.content) {
      if (!part || typeof part !== "object") continue;
      const type = String(part.type || "");

      // OpenAI format
      if (type === "image_url" && part.image_url) {
        const u = typeof part.image_url === "string" ? part.image_url : part.image_url.url;
        if (u) register(u);
      } else if (part.image_url && typeof part.image_url.url === "string") {
        register(part.image_url.url);
      }

      // Anthropic format
      if (type === "image" && part.source) {
        const src = part.source;
        if (src.type === "base64" && src.data) {
          const media = src.media_type || "image/png";
          register(`data:${media};base64,${src.data}`);
        } else if (src.url) {
          register(src.url);
        }
      }

      // Document format with image media type
      if (type === "document" && part.source) {
        const src = part.source;
        if (typeof src.media_type === "string" && src.media_type.startsWith("image/") && src.data) {
          register(`data:${src.media_type};base64,${src.data}`);
        }
      }

      // Tool results
      if (type === "tool_result" && Array.isArray(part.content)) {
        for (const sub of part.content) {
          if (!sub || typeof sub !== "object") continue;
          if (sub.type === "image" && sub.source?.data) {
            const media = sub.source.media_type || "image/png";
            register(`data:${media};base64,${sub.source.data}`);
          } else if (sub.type === "image_url" && sub.image_url?.url) {
            register(sub.image_url.url);
          }
        }
      }

      // Base64 data URL inside text block
      if (typeof part.text === "string" && part.text.includes("data:image/")) {
        const match = part.text.match(/data:image\/[a-zA-Z0-9.+_-]+;base64,[A-Za-z0-9+/=]+/);
        if (match) register(match[0]);
      }
    }
  } else if (typeof msg.content === "string" && msg.content.includes("data:image/")) {
    const match = msg.content.match(/data:image\/[a-zA-Z0-9.+_-]+;base64,[A-Za-z0-9+/=]+/);
    if (match) register(match[0]);
  }

  return results;
}

/**
 * Dispatches an image to an active vision-enabled provider to generate a dense technical description.
 */
async function callVisionProviderForDescription(
  candidate: MultimodalProviderCandidate,
  imageTarget: ExtractedImageTarget
): Promise<string | null> {
  const url = normalizeUpstreamChatCompletionsUrl(candidate.baseUrl);
  const activeKeys = candidate.apiKeys.filter((_, idx) => candidate.apiKeyEnabled?.[idx] !== false);
  if (!activeKeys.length) return null;

  const key = activeKeys[0];
  const headers = buildUpstreamRequestHeaders(key, { stream: false, url });

  const body = {
    model: candidate.model || "openai/gpt-4o",
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: DISTILLATION_PROMPT },
          { type: "image_url", image_url: { url: imageTarget.urlOrData } },
        ],
      },
    ],
    max_tokens: 1024,
    temperature: 0.2,
    stream: false,
  };

  const aborter = new AbortController();
  const timer = setTimeout(() => aborter.abort(), 20_000);

  try {
    const res = await safeFetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: aborter.signal,
    });
    clearTimeout(timer);

    if (!res.ok) {
      console.warn(`[SemanticDistillation] Upstream ${candidate.label} returned HTTP ${res.status}`);
      return null;
    }

    const json = (await res.json()) as any;
    const text = json?.choices?.[0]?.message?.content;
    if (typeof text === "string" && text.trim().length > 20) {
      return text.trim();
    }
  } catch (err) {
    clearTimeout(timer);
    console.warn(`[SemanticDistillation] Provider ${candidate.label} call failed:`, err);
  }

  return null;
}

/**
 * Distills an image into a dense technical description using any available vision-capable provider.
 * Features deduplication, memory caching, and database persistence.
 */
export async function distillImageSemantics(imageTarget: ExtractedImageTarget): Promise<string | null> {
  if (!imageTarget.hash) return null;

  // 1. Check existing cache (memory or DB)
  const existing = await getImageSemanticDescriptionWithCache(imageTarget.hash);
  if (existing) return existing;

  // 2. In-flight deduplication
  const inFlight = _inFlightDistillations.get(imageTarget.hash);
  if (inFlight) return inFlight;

  const distillationPromise = (async () => {
    try {
      const candidates = await findAllMultimodalProviders();
      const visionProviders = candidates.filter(
        c => c.supportsVision && c.baseUrl && c.apiKeys?.length > 0
      );

      if (visionProviders.length === 0) {
        console.warn("[SemanticDistillation] No vision-enabled providers available for distillation.");
        return null;
      }

      for (const provider of visionProviders) {
        const description = await callVisionProviderForDescription(provider, imageTarget);
        if (description) {
          // Save to memory cache
          setMemoryCache(imageTarget.hash, description);

          // Save to database
          void saveImageSemanticDescription({
            imageHash: imageTarget.hash,
            description,
            provider: provider.label,
            model: provider.model,
          }).catch(err => console.warn("[SemanticDistillation] Failed saving to DB:", err));

          return description;
        }
      }
    } catch (err) {
      console.warn("[SemanticDistillation] Unexpected error during distillation:", err);
    } finally {
      _inFlightDistillations.delete(imageTarget.hash);
    }
    return null;
  })();

  _inFlightDistillations.set(imageTarget.hash, distillationPromise);
  return distillationPromise;
}

/**
 * Asynchronously queues semantic distillation for all images in the conversation.
 * Runs in the background (fire-and-forget) so user requests are NEVER delayed.
 */
export function queueSemanticDistillationForMessages(messages: any[] | undefined): void {
  if (!Array.isArray(messages) || messages.length === 0) return;

  void (async () => {
    try {
      const allTargets: ExtractedImageTarget[] = [];
      const seen = new Set<string>();

      for (const msg of messages) {
        const targets = extractImagesFromMessage(msg);
        for (const t of targets) {
          if (!seen.has(t.hash)) {
            seen.add(t.hash);
            allTargets.push(t);
          }
        }
      }

      for (const target of allTargets) {
        const cached = getCachedImageDescriptionSync(target.hash);
        if (!cached) {
          await distillImageSemantics(target).catch(() => null);
        }
      }
    } catch (err) {
      console.warn("[SemanticDistillation] Background queue error:", err);
    }
  })();
}

/**
 * Bulk lookup of image descriptions for a list of image hashes.
 */
export async function lookupDescriptionsForHashes(hashes: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (!hashes.length) return map;

  await Promise.all(
    hashes.map(async hash => {
      const desc = await getImageSemanticDescriptionWithCache(hash);
      if (desc) map.set(hash, desc);
    })
  );

  return map;
}
