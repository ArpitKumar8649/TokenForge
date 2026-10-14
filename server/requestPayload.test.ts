import { describe, expect, it } from "vitest";
import {
  TOKENFORGE_JSON_BODY_LIMIT,
  TOKENFORGE_JSON_BODY_LIMIT_BYTES,
  isRequestPayloadTooLarge,
  requestPayloadTooLargeResponse,
} from "./requestPayload";

describe("request payload limits", () => {
  it("allows substantial Claude Code histories while retaining a bounded request limit", () => {
    expect(TOKENFORGE_JSON_BODY_LIMIT).toBe("12mb");
    expect(TOKENFORGE_JSON_BODY_LIMIT_BYTES).toBe(12 * 1024 * 1024);
  });

  it("recognizes body-parser payload-limit errors without swallowing unrelated failures", () => {
    expect(isRequestPayloadTooLarge({ status: 413, type: "entity.too.large" })).toBe(true);
    expect(isRequestPayloadTooLarge({ status: 502, type: "provider_error" })).toBe(false);
  });

  it("returns the Anthropic-compatible error contract for Claude Code messages requests", () => {
    expect(requestPayloadTooLargeResponse("/v1/messages")).toEqual({
      type: "error",
      error: {
        type: "request_too_large",
        message: "Request payload exceeds TokenForge's 12mb limit. Reduce accumulated tool output or conversation history and retry.",
      },
    });
  });

  it("returns an OpenAI-compatible payload-limit error for chat completion requests", () => {
    expect(requestPayloadTooLargeResponse("/v1/chat/completions")).toEqual({
      error: {
        message: "Request payload exceeds TokenForge's 12mb limit. Reduce accumulated tool output or conversation history and retry.",
        type: "invalid_request_error",
        param: null,
        code: "request_too_large",
      },
    });
  });
});
