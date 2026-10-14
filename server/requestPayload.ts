export const TOKENFORGE_JSON_BODY_LIMIT = "12mb";
export const TOKENFORGE_JSON_BODY_LIMIT_BYTES = 12 * 1024 * 1024;

type PayloadLimitError = {
  status?: unknown;
  type?: unknown;
  code?: unknown;
};

export function isRequestPayloadTooLarge(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const candidate = error as PayloadLimitError;
  return candidate.status === 413 || candidate.type === "entity.too.large" || candidate.code === "LIMIT_FILE_SIZE";
}

export function requestPayloadTooLargeResponse(path: string) {
  const message = `Request payload exceeds TokenForge's ${TOKENFORGE_JSON_BODY_LIMIT} limit. Reduce accumulated tool output or conversation history and retry.`;

  if (path.startsWith("/v1/messages")) {
    return { type: "error", error: { type: "request_too_large", message } };
  }

  return {
    error: {
      message,
      type: "invalid_request_error",
      param: null,
      code: "request_too_large",
    },
  };
}
