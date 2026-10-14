import { describe, expect, it, vi } from "vitest";
import {
  applyProviderReasoningPolicy,
  isReasoningEffortRejectedError,
  safeFetchChatWithReasoningFallback,
  sanitizeUpstreamChatInput,
} from "./openaiGateway";
import { normalizeReasoningEffort } from "./db";

describe("Provider Card Reasoning Effort Policy and Forwarding", () => {
  describe("applyProviderReasoningPolicy", () => {
    it("enforces provider card reasoning effort over incoming request when set on provider card", () => {
      const input = {
        model: "test-model",
        messages: [{ role: "user", content: "Hello" }],
        reasoning_effort: "low",
      };
      const provider = { reasoningEffort: "max" as const };
      const output = applyProviderReasoningPolicy(input, provider);

      expect(output.reasoning_effort).toBe("max");
    });

    it("enforces provider card 'xhigh' effort", () => {
      const input = {
        model: "test-model",
        messages: [{ role: "user", content: "Hello" }],
      };
      const provider = { reasoningEffort: "xhigh" as const };
      const output = applyProviderReasoningPolicy(input, provider);

      expect(output.reasoning_effort).toBe("xhigh");
    });

    it("preserves client reasoning effort when provider card reasoning effort is not configured (null)", () => {
      const input = {
        model: "test-model",
        messages: [{ role: "user", content: "Hello" }],
        reasoning_effort: "max",
      };
      const provider = { reasoningEffort: null };
      const output = applyProviderReasoningPolicy(input, provider);

      expect(output.reasoning_effort).toBe("max");
    });

    it("promotes camelCase reasoningEffort and removes 'default'", () => {
      const input = {
        model: "test-model",
        messages: [{ role: "user", content: "Hello" }],
        reasoningEffort: "high",
      };
      const provider = { reasoningEffort: null };
      const output = applyProviderReasoningPolicy(input, provider);

      expect(output.reasoning_effort).toBe("high");
      expect((output as any).reasoningEffort).toBeUndefined();
    });

    it("cleans up reasoning effort when set to 'default'", () => {
      const input = {
        model: "test-model",
        messages: [{ role: "user", content: "Hello" }],
        reasoning_effort: "default",
      };
      const provider = { reasoningEffort: null };
      const output = applyProviderReasoningPolicy(input, provider);

      expect(output.reasoning_effort).toBeUndefined();
    });
  });

  describe("sanitizeUpstreamChatInput", () => {
    it("promotes camelCase reasoningEffort to snake_case and removes reasoningEffort key", () => {
      const input = {
        model: "test-model",
        messages: [{ role: "user", content: "Hello" }],
        reasoningEffort: "max",
      };
      const sanitized = sanitizeUpstreamChatInput(input);
      expect(sanitized.reasoning_effort).toBe("max");
      expect((sanitized as any).reasoningEffort).toBeUndefined();
    });

    it("strips 'default' reasoning effort from upstream payload", () => {
      const input = {
        model: "test-model",
        messages: [{ role: "user", content: "Hello" }],
        reasoning_effort: "default",
      };
      const sanitized = sanitizeUpstreamChatInput(input);
      expect(sanitized.reasoning_effort).toBeUndefined();
    });
  });

  describe("isReasoningEffortRejectedError", () => {
    it("identifies 400 error where reasoning_effort 'max' is not supported", () => {
      const errorText = JSON.stringify({
        error: {
          message: "Invalid value for 'reasoning_effort': 'max'. Supported values are 'low', 'medium', 'high'.",
          type: "invalid_request_error",
        },
      });
      expect(isReasoningEffortRejectedError(400, errorText)).toBe(true);
    });

    it("identifies 400 error where reasoning_effort is an unrecognized extra field", () => {
      const errorText = JSON.stringify({
        detail: [{ loc: ["body", "reasoning_effort"], msg: "extra fields not permitted", type: "value_error.extra" }],
      });
      expect(isReasoningEffortRejectedError(400, errorText)).toBe(true);
    });

    it("returns false for unrelated 400 errors", () => {
      const errorText = JSON.stringify({
        error: { message: "messages must be a non-empty array", type: "invalid_request_error" },
      });
      expect(isReasoningEffortRejectedError(400, errorText)).toBe(false);
    });

    it("returns false for non-400/422 status codes", () => {
      expect(isReasoningEffortRejectedError(500, "reasoning_effort error")).toBe(false);
    });
  });

  describe("safeFetchChatWithReasoningFallback", () => {
    it("returns 200 immediately if upstream supports max reasoning", async () => {
      const fetchMock = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ choices: [{ message: { content: "Deep response" } }] }), {
          status: 200,
          headers: { "content-type": "application/json" },
        })
      );
      vi.stubGlobal("fetch", fetchMock);

      const requestBody = {
        model: "test-model",
        messages: [{ role: "user", content: "Think hard" }],
        reasoning_effort: "max",
      };

      const response = await safeFetchChatWithReasoningFallback(
        "https://api.example.com/v1/chat/completions",
        { method: "POST" },
        requestBody
      );

      expect(response.ok).toBe(true);
      expect(fetchMock).toHaveBeenCalledTimes(1);
      const sentPayload = JSON.parse(fetchMock.mock.calls[0][1].body as string);
      expect(sentPayload.reasoning_effort).toBe("max");
    });

    it("automatically downgrades from max to high if upstream rejects max", async () => {
      const fetchMock = vi.fn()
        // First attempt with "max" fails with 400
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              error: {
                message: "Invalid value for 'reasoning_effort': 'max'. Supported values are 'low', 'medium', 'high'.",
              },
            }),
            { status: 400, headers: { "content-type": "application/json" } }
          )
        )
        // Second attempt with "high" succeeds with 200
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ choices: [{ message: { content: "High response" } }] }), {
            status: 200,
            headers: { "content-type": "application/json" },
          })
        );
      vi.stubGlobal("fetch", fetchMock);

      const requestBody = {
        model: "test-model",
        messages: [{ role: "user", content: "Think hard" }],
        reasoning_effort: "max",
      };

      const response = await safeFetchChatWithReasoningFallback(
        "https://api.example.com/v1/chat/completions",
        { method: "POST" },
        requestBody
      );

      expect(response.ok).toBe(true);
      expect(fetchMock).toHaveBeenCalledTimes(2);

      const firstCallBody = JSON.parse(fetchMock.mock.calls[0][1].body as string);
      expect(firstCallBody.reasoning_effort).toBe("max");

      const secondCallBody = JSON.parse(fetchMock.mock.calls[1][1].body as string);
      expect(secondCallBody.reasoning_effort).toBe("high");
    });

    it("retries without reasoning_effort if provider completely rejects reasoning parameter", async () => {
      const fetchMock = vi.fn()
        // First attempt fails: extra inputs reasoning_effort
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              error: { message: "Unrecognized request argument: reasoning_effort" },
            }),
            { status: 400, headers: { "content-type": "application/json" } }
          )
        )
        // Retry with high also fails
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              error: { message: "Unrecognized request argument: reasoning_effort" },
            }),
            { status: 400, headers: { "content-type": "application/json" } }
          )
        )
        // Final retry without reasoning_effort succeeds!
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ choices: [{ message: { content: "Standard response" } }] }), {
            status: 200,
            headers: { "content-type": "application/json" },
          })
        );
      vi.stubGlobal("fetch", fetchMock);

      const requestBody = {
        model: "test-model",
        messages: [{ role: "user", content: "Hello" }],
        reasoning_effort: "max",
      };

      const response = await safeFetchChatWithReasoningFallback(
        "https://api.example.com/v1/chat/completions",
        { method: "POST" },
        requestBody
      );

      expect(response.ok).toBe(true);
      expect(fetchMock).toHaveBeenCalledTimes(3);

      const thirdCallBody = JSON.parse(fetchMock.mock.calls[2][1].body as string);
      expect(thirdCallBody.reasoning_effort).toBeUndefined();
    });
  });

  describe("normalizeReasoningEffort", () => {
    it("normalizes valid effort strings", () => {
      expect(normalizeReasoningEffort("low")).toBe("low");
      expect(normalizeReasoningEffort("medium")).toBe("medium");
      expect(normalizeReasoningEffort("high")).toBe("high");
      expect(normalizeReasoningEffort("xhigh")).toBe("xhigh");
      expect(normalizeReasoningEffort("max")).toBe("max");
      expect(normalizeReasoningEffort("  MAX  ")).toBe("max");
    });

    it("returns undefined for invalid or empty inputs", () => {
      expect(normalizeReasoningEffort("")).toBeUndefined();
      expect(normalizeReasoningEffort("default")).toBeUndefined();
      expect(normalizeReasoningEffort(null)).toBeUndefined();
      expect(normalizeReasoningEffort(undefined)).toBeUndefined();
      expect(normalizeReasoningEffort("invalid")).toBeUndefined();
    });
  });
});
