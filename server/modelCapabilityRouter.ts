import { findAllMultimodalProviders, MultimodalProviderCandidate } from "./db";
import { TokenForgeChatInput, ProviderRequestContext, sanitizeUpstreamChatInput, safeFetch } from "./openaiGateway";
import {
  computeImageHash,
  extractImagesFromMessage,
  lookupDescriptionsForHashes,
  queueSemanticDistillationForMessages,
  distillImageSemantics,
} from "./semanticImageDistillation";

export class MultimodalRoutingError extends Error {
  statusCode: number;
  constructor(message: string, statusCode = 400) {
    super(message);
    this.name = "MultimodalRoutingError";
    this.statusCode = statusCode;
  }
}

/**
 * Intercepts an incoming request payload to determine if any visual/image data is present.
 * Checks messages (current or historical turns), multimodal content arrays, base64 data URLs,
 * and top-level visual attributes.
 */
export function payloadContainsVisualData(payload: unknown): boolean {
  if (!payload || typeof payload !== "object") return false;

  const raw = payload as Record<string, unknown>;

  // Check top-level image/visual fields
  if (Array.isArray(raw.images) && raw.images.length > 0) return true;
  if (raw.image && typeof raw.image === "string" && raw.image.trim().length > 0) return true;

  // Check messages array
  const messages = raw.messages;
  if (!Array.isArray(messages)) return false;

  for (const message of messages) {
    if (!message || typeof message !== "object") continue;

    // Check message-level images field
    if (Array.isArray((message as any).images) && (message as any).images.length > 0) return true;
    if ((message as any).image && typeof (message as any).image === "string") return true;

    const content = (message as any).content;
    if (Array.isArray(content)) {
      for (const part of content) {
        if (!part || typeof part !== "object") continue;
        const type = String(part.type || "");
        if (type === "image_url" || type === "image" || type === "input_audio") {
          return true;
        }
        if (part.image_url && typeof part.image_url === "object") {
          return true;
        }
        if (type === "document") {
          const src = part.source || part;
          if (typeof src?.media_type === "string" && src.media_type.startsWith("image/")) {
            return true;
          }
        }
        // Anthropic tool_result block: check nested images inside tool_result.content
        if (type === "tool_result") {
          const toolContent = (part as any).content;
          if (Array.isArray(toolContent)) {
            for (const subPart of toolContent) {
              if (!subPart || typeof subPart !== "object") continue;
              const subType = String((subPart as any).type || "");
              if (subType === "image" || subType === "image_url" || (subPart as any).image_url) {
                return true;
              }
              const subSource = (subPart as any).source;
              if (subSource?.type === "base64" && subSource.media_type?.startsWith("image/")) {
                return true;
              }
              if (typeof (subPart as any).text === "string" && isBase64ImageString((subPart as any).text)) {
                return true;
              }
            }
          } else if (typeof toolContent === "string" && isBase64ImageString(toolContent)) {
            return true;
          }
        }
        // Base64 image or image URL embedded inside text part
        if (typeof part.text === "string" && isBase64ImageString(part.text)) {
          return true;
        }
      }
    } else if (typeof content === "string") {
      if (isBase64ImageString(content)) {
        return true;
      }
    }
  }

  return false;
}

export interface VisualAnalysisResult {
  hasVisualData: boolean;
  tag?: string;
}

export interface PrunedVisualMessagesResult {
  messages: any[];
  analysis: VisualAnalysisResult;
}

export const DEFAULT_MAX_IMAGE_TURNS_BACK = 25;
export const DEFAULT_MAX_IMAGES_TO_KEEP = 8;

/**
 * Strips visual and image data from a single message, replacing images
 * with rich Semantic Distillation descriptions if available, or a clean context placeholder.
 */
export function stripVisualContentFromMessage(
  msg: any,
  descriptionsMap?: Map<string, string>,
  metadata?: { turnNumber?: number; turnsBack?: number }
): any {
  if (!msg || typeof msg !== "object") return msg;
  const cloned = { ...msg };
  if ("images" in cloned) delete cloned.images;
  if ("image" in cloned) delete cloned.image;

  const formatReplacementText = (imageSource?: string): string => {
    if (imageSource && descriptionsMap) {
      const hash = computeImageHash(imageSource);
      const desc = descriptionsMap.get(hash);
      if (desc) {
        const turnMeta = metadata?.turnNumber !== undefined
          ? ` (Turn #${metadata.turnNumber})`
          : "";
        return `[Visual Attachment${turnMeta} - Semantic Image Distillation]:\n${desc}`;
      }
    }
    return "[Earlier image omitted for context limit]";
  };

  if (Array.isArray(cloned.content)) {
    cloned.content = cloned.content.map((part: any) => {
      if (!part || typeof part !== "object") return part;
      const type = String(part.type || "");
      if (type === "image_url" || type === "image" || part.image_url) {
        const src = typeof part.image_url === "string" ? part.image_url : part.image_url?.url || (part.source?.type === "base64" ? `data:${part.source.media_type || "image/png"};base64,${part.source.data}` : undefined);
        return { type: "text", text: formatReplacementText(src) };
      }
      if (type === "document") {
        const src = part.source || part;
        if (typeof src?.media_type === "string" && src.media_type.startsWith("image/")) {
          const raw = src.data ? `data:${src.media_type};base64,${src.data}` : undefined;
          return { type: "text", text: formatReplacementText(raw) };
        }
      }
      if (type === "tool_result" && Array.isArray(part.content)) {
        return {
          ...part,
          content: part.content.map((sub: any) => {
            if (!sub || typeof sub !== "object") return sub;
            const subType = String(sub.type || "");
            if (subType === "image" || subType === "image_url" || sub.image_url) {
              const raw = sub.image_url?.url || (sub.source?.data ? `data:${sub.source.media_type || "image/png"};base64,${sub.source.data}` : undefined);
              return { type: "text", text: formatReplacementText(raw) };
            }
            const subSource = sub.source;
            if (subSource?.type === "base64" && subSource.media_type?.startsWith("image/")) {
              const raw = subSource.data ? `data:${subSource.media_type};base64,${subSource.data}` : undefined;
              return { type: "text", text: formatReplacementText(raw) };
            }
            if (typeof sub.text === "string" && isBase64ImageString(sub.text)) {
              return { type: "text", text: formatReplacementText(sub.text) };
            }
            return sub;
          }),
        };
      }
      if (typeof part.text === "string" && isBase64ImageString(part.text)) {
        return { type: "text", text: formatReplacementText(part.text) };
      }
      return part;
    });
  } else if (typeof cloned.content === "string") {
    if (isBase64ImageString(cloned.content)) {
      cloned.content = formatReplacementText(cloned.content);
    }
  }
  return cloned;
}

/**
 * Inspects conversation messages for visual content:
 * 1. Automatically queues background Semantic Distillation for new images.
 * 2. Strips any image that occurred more than maxImageTurnsBack (default: 25) message turns back,
 *    replacing it with dense technical Semantic Distillation descriptions from cache/DB.
 * 3. Prunes older images beyond maxImagesToKeep (default: 8) so upstream providers don't exceed request/context limits.
 * 4. Calculates the relative recency tag (e.g. '(image: current)' or '(image: 2 msgs back)').
 */
export async function pruneOldImagesAndDeriveContent(
  messages: any[] | undefined,
  maxImageTurnsBack: number | { maxTurnsBack?: number; maxImagesToKeep?: number } = DEFAULT_MAX_IMAGE_TURNS_BACK,
  maxImagesToKeep = DEFAULT_MAX_IMAGES_TO_KEEP
): Promise<PrunedVisualMessagesResult> {
  if (!Array.isArray(messages) || messages.length === 0) {
    return {
      messages: messages ?? [],
      analysis: { hasVisualData: false },
    };
  }

  // Asynchronously queue distillation in background so future turns have cached descriptions ready
  queueSemanticDistillationForMessages(messages);

  const turnsLimit =
    typeof maxImageTurnsBack === "object" && maxImageTurnsBack !== null
      ? (maxImageTurnsBack.maxTurnsBack ?? DEFAULT_MAX_IMAGE_TURNS_BACK)
      : maxImageTurnsBack;

  const countLimit =
    typeof maxImageTurnsBack === "object" && maxImageTurnsBack !== null
      ? (maxImageTurnsBack.maxImagesToKeep ?? maxImagesToKeep)
      : maxImagesToKeep;

  const lastIdx = messages.length - 1;

  // Identify images that will be stripped due to turn limit
  const hashesToLookup = new Set<string>();
  for (let idx = 0; idx < messages.length; idx++) {
    const turnsBack = lastIdx - idx;
    if (turnsBack > turnsLimit && payloadContainsVisualData({ messages: [messages[idx]] })) {
      const targets = extractImagesFromMessage(messages[idx]);
      for (const t of targets) {
        if (t.hash) hashesToLookup.add(t.hash);
      }
    }
  }

  // Lookup descriptions from cache / database
  const descriptionsMap = hashesToLookup.size > 0
    ? await lookupDescriptionsForHashes(Array.from(hashesToLookup))
    : new Map<string, string>();

  // Step 1: Strip any image that occurred more than turnsLimit (25) message turns back
  let workingMessages = messages.map((msg, idx) => {
    const turnsBack = lastIdx - idx;
    if (turnsBack > turnsLimit && payloadContainsVisualData({ messages: [msg] })) {
      return stripVisualContentFromMessage(msg, descriptionsMap, { turnNumber: idx + 1, turnsBack });
    }
    return msg;
  });

  // Step 2: Inspect remaining visual messages
  let latestImageMsgIndex = -1;
  let totalImagesFound = 0;

  for (let i = workingMessages.length - 1; i >= 0; i--) {
    const msg = workingMessages[i];
    if (payloadContainsVisualData({ messages: [msg] })) {
      if (latestImageMsgIndex === -1) {
        latestImageMsgIndex = i;
      }
      totalImagesFound++;
    }
  }

  if (latestImageMsgIndex === -1) {
    return {
      messages: workingMessages,
      analysis: { hasVisualData: false },
    };
  }

  // Step 3: If remaining images still exceed countLimit, prune oldest among remaining
  if (totalImagesFound > countLimit) {
    // Collect any additional hashes needed for count pruning
    for (let idx = 0; idx < workingMessages.length; idx++) {
      if (payloadContainsVisualData({ messages: [workingMessages[idx]] })) {
        let imageMsgsAfter = 0;
        for (let j = idx + 1; j < workingMessages.length; j++) {
          if (payloadContainsVisualData({ messages: [workingMessages[j]] })) {
            imageMsgsAfter++;
          }
        }
        if (imageMsgsAfter >= countLimit) {
          const targets = extractImagesFromMessage(workingMessages[idx]);
          for (const t of targets) {
            if (t.hash && !descriptionsMap.has(t.hash)) {
              hashesToLookup.add(t.hash);
            }
          }
        }
      }
    }

    if (hashesToLookup.size > descriptionsMap.size) {
      const extraMap = await lookupDescriptionsForHashes(Array.from(hashesToLookup));
      for (const [k, v] of extraMap) descriptionsMap.set(k, v);
    }

    workingMessages = workingMessages.map((msg, idx) => {
      if (!payloadContainsVisualData({ messages: [msg] })) {
        return msg;
      }
      let imageMsgsAfter = 0;
      for (let j = idx + 1; j < workingMessages.length; j++) {
        if (payloadContainsVisualData({ messages: [workingMessages[j]] })) {
          imageMsgsAfter++;
        }
      }
      if (imageMsgsAfter < countLimit) {
        return msg;
      }
      const turnsBack = lastIdx - idx;
      return stripVisualContentFromMessage(msg, descriptionsMap, { turnNumber: idx + 1, turnsBack });
    });

    latestImageMsgIndex = -1;
    for (let i = workingMessages.length - 1; i >= 0; i--) {
      if (payloadContainsVisualData({ messages: [workingMessages[i]] })) {
        latestImageMsgIndex = i;
        break;
      }
    }

    if (latestImageMsgIndex === -1) {
      return {
        messages: workingMessages,
        analysis: { hasVisualData: false },
      };
    }
  }

  const msgsBack = lastIdx - latestImageMsgIndex;
  const tag = msgsBack === 0 ? "(image: current)" : `(image: ${msgsBack} msgs back)`;

  return {
    messages: workingMessages,
    analysis: { hasVisualData: true, tag },
  };
}

/**
 * Intercepts an incoming request payload to determine if any document/PDF/file data is present.
 * Checks messages (current or historical turns), document blocks, PDF data URLs,
 * Anthropic document source blocks, and document attachment fields.
 */
export function payloadContainsDocumentData(payload: unknown): boolean {
  if (!payload || typeof payload !== "object") return false;

  const raw = payload as Record<string, unknown>;

  // Check top-level document fields
  if (Array.isArray(raw.documents) && raw.documents.length > 0) return true;
  if (Array.isArray(raw.files) && raw.files.length > 0) return true;
  if (raw.document && (typeof raw.document === "string" || typeof raw.document === "object")) return true;
  if (raw.file && (typeof raw.file === "string" || typeof raw.file === "object")) return true;

  // Check messages array
  const messages = raw.messages;
  if (!Array.isArray(messages)) return false;

  for (const message of messages) {
    if (!message || typeof message !== "object") continue;

    // Check message-level documents/files fields
    if (Array.isArray((message as any).documents) && (message as any).documents.length > 0) return true;
    if (Array.isArray((message as any).files) && (message as any).files.length > 0) return true;

    const content = (message as any).content;
    if (Array.isArray(content)) {
      for (const part of content) {
        if (!part || typeof part !== "object") continue;
        const type = String(part.type || "").toLowerCase();

        // Anthropic document block or standard document part
        if (type === "document" || type === "file") {
          const src = part.source || part;
          // If explicitly marked as image, that is handled by visual detector unless it's a PDF/doc media type
          if (typeof src?.media_type === "string") {
            const mt = src.media_type.toLowerCase();
            if (mt.includes("pdf") || mt.includes("text") || mt.includes("document") || mt.includes("csv") || mt.includes("json")) {
              return true;
            }
          }
          if (src?.type === "base64" && typeof src?.data === "string" && src.data.trim()) {
            return true;
          }
          if (typeof src?.url === "string" || typeof part.url === "string") {
            return true;
          }
          return true;
        }

        if (part.file_url || part.pdf_url || part.document_url) {
          return true;
        }

        // Base64 document / PDF embedded inside text part
        if (typeof part.text === "string" && isBase64DocumentString(part.text)) {
          return true;
        }
      }
    } else if (typeof content === "string") {
      if (isBase64DocumentString(content)) {
        return true;
      }
    }
  }

  return false;
}

const MARKDOWN_IMAGE_REGEX = /!\[.*?\]\((https?:\/\/[^\s)]+)\)/i;
const DIRECT_IMAGE_URL_REGEX = /\bhttps?:\/\/[^\s"'<>]+\.(?:png|jpe?g|webp|gif|bmp|tiff|svg)(?:\?[^\s"'<>]*)?\b/i;

function isBase64ImageString(text: string): boolean {
  return (
    text.includes("data:image/") ||
    text.includes("<image>") ||
    text.includes("[image:") ||
    MARKDOWN_IMAGE_REGEX.test(text) ||
    DIRECT_IMAGE_URL_REGEX.test(text)
  );
}

function isBase64DocumentString(text: string): boolean {
  return (
    text.includes("data:application/pdf") ||
    text.includes("data:text/csv") ||
    text.includes("data:text/plain") ||
    text.includes("data:application/msword") ||
    text.includes("data:application/vnd") ||
    text.includes("<document>") ||
    text.includes("[document:") ||
    text.includes("<doc>") ||
    text.includes("JVBERi0") // '%PDF-' in base64
  );
}

/**
 * Returns required capabilities for a request payload.
 */
export function getPayloadCapabilityRequirements(payload: unknown): {
  needsVision: boolean;
  needsDocuments: boolean;
  isMultimodal: boolean;
} {
  const needsVision = payloadContainsVisualData(payload);
  const needsDocuments = payloadContainsDocumentData(payload);
  return {
    needsVision,
    needsDocuments,
    isMultimodal: needsVision || needsDocuments,
  };
}

/**
 * Checks whether a destination URL points to OpenRouter.
 */
export function isOpenRouterEndpoint(url?: string): boolean {
  if (!url) return false;
  const lower = url.toLowerCase();
  return lower.includes("openrouter.ai") || lower.includes("openrouter");
}

/**
 * Constructs standard upstream headers, injecting OpenRouter-compliant headers
 * (HTTP-Referer, X-Title) when targeting OpenRouter endpoints.
 */
export function buildUpstreamRequestHeaders(
  credential: string,
  options: {
    stream?: boolean;
    url?: string;
    extraHeaders?: Record<string, string>;
  } = {}
): Record<string, string> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${credential.replace(/[\r\n]+/g, "").trim()}`,
    "Content-Type": "application/json",
    Accept: options.stream ? "text/event-stream" : "application/json",
    ...options.extraHeaders,
  };

  if (isOpenRouterEndpoint(options.url)) {
    headers["HTTP-Referer"] = "https://tokenforge.ai";
    headers["X-Title"] = "TokenForge";
  }

  return headers;
}

/**
 * Normalizes a base URL to guarantee a valid /chat/completions endpoint.
 */
export function normalizeUpstreamChatCompletionsUrl(baseUrl: string): string {
  const clean = baseUrl.replace(/\/$/, "");
  if (clean.endsWith("/chat/completions")) {
    return clean;
  }
  if (clean.endsWith("/v1")) {
    return `${clean}/chat/completions`;
  }
  return `${clean}/v1/chat/completions`;
}

/**
 * Filters a provider pool based on visual/multimodal requirement.
 * If requireVision is true, ONLY providers with supportsVision === true are returned.
 */
export function filterProvidersByVisionCapability<T extends { supportsVision?: boolean; enabled?: boolean }>(
  providers: T[],
  requireVision: boolean
): T[] {
  if (!requireVision) return providers;
  return providers.filter(p => p.supportsVision === true && p.enabled !== false);
}

/**
 * Filters a provider pool based on document/PDF requirement.
 * If requireDocuments is true, ONLY providers with supportsDocuments === true are returned.
 */
export function filterProvidersByDocumentCapability<T extends { supportsDocuments?: boolean; enabled?: boolean }>(
  providers: T[],
  requireDocuments: boolean
): T[] {
  if (!requireDocuments) return providers;
  return providers.filter(p => p.supportsDocuments === true && p.enabled !== false);
}

/**
 * Filters a provider pool matching both image and document capability requirements.
 */
export function filterProvidersByMultimodalCapability<
  T extends { supportsVision?: boolean; supportsDocuments?: boolean; enabled?: boolean }
>(
  providers: T[],
  requirements: { requireVision?: boolean; requireDocuments?: boolean }
): T[] {
  return providers.filter(p => {
    if (p.enabled === false) return false;
    if (requirements.requireVision && !p.supportsVision) return false;
    if (requirements.requireDocuments && !p.supportsDocuments) return false;
    return true;
  });
}

let multimodalFailoverCursor = 0;

/**
 * Rotates eligible multimodal failover providers so multiple active vision/doc providers
 * in the system share traffic evenly one-by-one, matching TokenForge's load-balancer behavior.
 */
export function rotateMultimodalFailoverCandidates(
  candidates: MultimodalProviderCandidate[]
): MultimodalProviderCandidate[] {
  if (candidates.length <= 1) return candidates;
  const rotated = candidates.map((_, offset) => candidates[(multimodalFailoverCursor + offset) % candidates.length]!);
  multimodalFailoverCursor = (multimodalFailoverCursor + 1) % candidates.length;
  return rotated;
}

/**
 * Gracefully routes a multimodal payload (images, documents, or both) to any active
 * provider configured in the system when the primary model's providers cannot handle the modalities.
 */
export async function routeMultimodalFailover(
  input: TokenForgeChatInput,
  signal: AbortSignal,
  context?: ProviderRequestContext,
  requirements?: { requireVision?: boolean; requireDocuments?: boolean }
): Promise<globalThis.Response> {
  const needsVision = requirements?.requireVision ?? payloadContainsVisualData(input);
  const needsDocuments = requirements?.requireDocuments ?? payloadContainsDocumentData(input);

  const candidates = await findAllMultimodalProviders();
  const eligible = candidates.filter(c => {
    if (!c.baseUrl || !c.apiKeys?.length) return false;
    if (needsVision && !c.supportsVision) return false;
    if (needsDocuments && !c.supportsDocuments) return false;
    return true;
  });

  if (eligible.length === 0) {
    const missingKinds = [
      needsVision ? "images/vision" : null,
      needsDocuments ? "documents/PDFs" : null,
    ].filter(Boolean).join(" and ");

    const errorMsg = `This request contains ${missingKinds || "multimodal"} data, but no provider with matching capability (${needsVision ? "Vision" : ""}${needsVision && needsDocuments ? " + " : ""}${needsDocuments ? "Documents" : ""}) is currently active. In the TokenForge Admin panel, please enable the Image or Document toggle on a provider (such as OpenRouter or a vision/doc-capable upstream).`;
    if (context) {
      context.rawErrorMessage = `[PRE-FLIGHT] Zero eligible multimodal providers found for ${missingKinds || "multimodal"} data.`;
    }
    throw new MultimodalRoutingError(errorMsg);
  }

  let lastError: unknown = null;
  const rotatedCandidates = rotateMultimodalFailoverCandidates(eligible);

  for (const candidate of rotatedCandidates) {
    const url = normalizeUpstreamChatCompletionsUrl(candidate.baseUrl);
    const activeKeys = candidate.apiKeys.filter((_, idx) => candidate.apiKeyEnabled?.[idx] !== false);
    if (!activeKeys.length) continue;

    for (const key of activeKeys) {
      if (signal.aborted) break;
      if (context) {
        const failoverTag = context.multimodalTag
          ? `${context.multimodalTag.replace(")", " - failover)")}`
          : "(Multimodal Failover)";
        context.providerLabel = `${candidate.label} ${failoverTag}`;
      }

      const headers = buildUpstreamRequestHeaders(key, {
        stream: Boolean(input.stream),
        url,
      });

      const bodyPayload = sanitizeUpstreamChatInput({
        ...input,
        model: candidate.model || (typeof input.model === "string" ? input.model : "openai/gpt-4o"),
      });

      try {
        const response = await safeFetch(url, {
          method: "POST",
          headers,
          body: JSON.stringify(bodyPayload),
          signal,
        });

        if (response.ok) {
          const contentType = response.headers.get("content-type") || "";
          if (input.stream && contentType.includes("text/event-stream")) {
            return response;
          }
          // For non-streaming, verify that upstream actually returned a valid completion rather than an error payload inside 200 OK
          const clone = response.clone();
          const json = await clone.json().catch(() => null);
          if (json && typeof json === "object") {
            const hasError = Boolean((json as any).error);
            const hasChoices = Array.isArray((json as any).choices) && (json as any).choices.length > 0;
            const hasContent = Array.isArray((json as any).content) || (typeof (json as any).content === "string" && (json as any).content.length > 0);
            if (hasError || (!hasChoices && !hasContent)) {
              const errMsg = (json as any).error?.message || (json as any).error || "Provider returned an empty or invalid completion payload";
              lastError = new Error(`Multimodal provider '${candidate.label}' returned error payload in HTTP 200: ${typeof errMsg === "string" ? errMsg : JSON.stringify(errMsg).slice(0, 200)}`);
              if (context) {
                context.rawErrorMessage = `[${candidate.label} 200 Error] ${typeof errMsg === "string" ? errMsg : JSON.stringify(errMsg).slice(0, 200)}`;
              }
              continue;
            }
          }
          return response;
        }

        const errText = await response.clone().text().catch(() => "");
        lastError = new Error(`Multimodal provider '${candidate.label}' returned HTTP ${response.status}: ${errText.slice(0, 200)}`);
        if (context) {
          context.rawErrorMessage = `[${candidate.label} HTTP ${response.status}] ${errText.slice(0, 200) || "HTTP failure"}`;
        }
      } catch (err) {
        lastError = err;
        if (context) {
          context.rawErrorMessage = `[${candidate.label} Network Error] ${err instanceof Error ? err.message : "Request failed"}`;
        }
      }
    }
  }

  const finalMsg = `Every multimodal provider failed to process the visual payload. Last error: ${lastError instanceof Error ? lastError.message : "Unknown error"}. Check the provider configuration and API keys in the admin panel.`;
  if (context && !context.rawErrorMessage) {
    context.rawErrorMessage = `[PRE-FLIGHT] ${lastError instanceof Error ? lastError.message : "Every multimodal provider failed."}`;
  }
  throw new MultimodalRoutingError(finalMsg);
}
