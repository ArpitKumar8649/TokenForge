import { describe, it, expect } from "vitest";
import {
  payloadContainsVisualData,
  payloadContainsDocumentData,
  getPayloadCapabilityRequirements,
  isOpenRouterEndpoint,
  buildUpstreamRequestHeaders,
  normalizeUpstreamChatCompletionsUrl,
  filterProvidersByVisionCapability,
  filterProvidersByDocumentCapability,
  filterProvidersByMultimodalCapability,
  MultimodalRoutingError,
  pruneOldImagesAndDeriveContent,
  DEFAULT_MAX_IMAGE_TURNS_BACK,
} from "./modelCapabilityRouter";

describe("Model Capability Router", () => {
  describe("payloadContainsVisualData", () => {
    it("returns false for plain text single message", () => {
      const payload = {
        messages: [{ role: "user", content: "Hello, what is the capital of France?" }],
      };
      expect(payloadContainsVisualData(payload)).toBe(false);
    });

    it("returns false for multi-turn text-only conversation", () => {
      const payload = {
        messages: [
          { role: "user", content: "Write a poem about trees." },
          { role: "assistant", content: "Green leaves whispering..." },
          { role: "user", content: "Now explain the metaphor." },
        ],
      };
      expect(payloadContainsVisualData(payload)).toBe(false);
    });

    it("returns false when message content is an array of text-only parts", () => {
      const payload = {
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: "Look at this paragraph:" },
              { type: "text", text: "Once upon a time..." },
            ],
          },
        ],
      };
      expect(payloadContainsVisualData(payload)).toBe(false);
    });

    it("detects standard OpenAI image_url object with http URL", () => {
      const payload = {
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: "What is in this photo?" },
              {
                type: "image_url",
                image_url: { url: "https://example.com/cat.jpg" },
              },
            ],
          },
        ],
      };
      expect(payloadContainsVisualData(payload)).toBe(true);
    });

    it("detects standard OpenAI image_url object with base64 data URL", () => {
      const payload = {
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image_url",
                image_url: { url: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==" },
              },
            ],
          },
        ],
      };
      expect(payloadContainsVisualData(payload)).toBe(true);
    });

    it("detects base64 data:image URL in plain string content", () => {
      const payload = {
        messages: [
          { role: "user", content: "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP..." },
        ],
      };
      expect(payloadContainsVisualData(payload)).toBe(true);
    });

    it("detects multi-turn conversation where image was sent in an earlier turn", () => {
      // User Request 9: Client sent image in turn 1, in turn 2 client asks a follow-up without sending a new image.
      // The router must recognize the visual payload persists and route to a vision-enabled provider!
      const payload = {
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: "Describe this chart:" },
              { type: "image_url", image_url: { url: "https://example.com/chart.png" } },
            ],
          },
          {
            role: "assistant",
            content: "The chart shows quarterly revenue growth rising from $10M to $25M in Q4.",
          },
          {
            role: "user",
            content: "Which quarter had the biggest dip?",
          },
        ],
      };
      expect(payloadContainsVisualData(payload)).toBe(true);
    });

    it("detects image blocks in Anthropic/custom format", () => {
      const payload = {
        messages: [
          {
            role: "user",
            content: [
              { type: "image", source: { type: "base64", media_type: "image/png", data: "iVBORw..." } },
            ],
          },
        ],
      };
      expect(payloadContainsVisualData(payload)).toBe(true);
    });

    it("detects top-level or message-level images array", () => {
      const payload1 = {
        messages: [{ role: "user", content: "Hello", images: ["data:image/png;base64,abc"] }],
      };
      expect(payloadContainsVisualData(payload1)).toBe(true);

      const payload2 = {
        messages: [{ role: "user", content: "Hello" }],
        images: ["https://example.com/img.png"],
      };
      expect(payloadContainsVisualData(payload2)).toBe(true);
    });
  });

  describe("payloadContainsDocumentData", () => {
    it("returns false for plain text message", () => {
      const payload = {
        messages: [{ role: "user", content: "Summarize this article please." }],
      };
      expect(payloadContainsDocumentData(payload)).toBe(false);
    });

    it("detects Anthropic document block with PDF media_type", () => {
      const payload = {
        messages: [
          {
            role: "user",
            content: [
              {
                type: "document",
                source: {
                  type: "base64",
                  media_type: "application/pdf",
                  data: "JVBERi0xLjQKJ...",
                },
              },
              { type: "text", text: "What are the main findings in this PDF?" },
            ],
          },
        ],
      };
      expect(payloadContainsDocumentData(payload)).toBe(true);
      expect(payloadContainsVisualData(payload)).toBe(false);
    });

    it("detects base64 PDF in text content", () => {
      const payload = {
        messages: [
          { role: "user", content: "Here is the document: data:application/pdf;base64,JVBERi0xLjQK..." },
        ],
      };
      expect(payloadContainsDocumentData(payload)).toBe(true);
    });

    it("detects document url or file block", () => {
      const payload = {
        messages: [
          {
            role: "user",
            content: [
              { type: "file", file_url: "https://example.com/report.pdf" },
              { type: "text", text: "Read the report" },
            ],
          },
        ],
      };
      expect(payloadContainsDocumentData(payload)).toBe(true);
    });

    it("detects top-level documents array", () => {
      const payload = {
        messages: [{ role: "user", content: "Analyze" }],
        documents: [{ name: "contract.pdf" }],
      };
      expect(payloadContainsDocumentData(payload)).toBe(true);
    });

    it("detects multi-turn conversation with document in earlier turn", () => {
      const payload = {
        messages: [
          {
            role: "user",
            content: [
              { type: "document", source: { type: "base64", media_type: "application/pdf", data: "JVBERi0..." } },
            ],
          },
          { role: "assistant", content: "I have read the document." },
          { role: "user", content: "What is clause 4?" },
        ],
      };
      expect(payloadContainsDocumentData(payload)).toBe(true);
    });
  });

  describe("getPayloadCapabilityRequirements", () => {
    it("identifies text-only payload as requiring neither", () => {
      const reqs = getPayloadCapabilityRequirements({
        messages: [{ role: "user", content: "Hello world" }],
      });
      expect(reqs.needsVision).toBe(false);
      expect(reqs.needsDocuments).toBe(false);
      expect(reqs.isMultimodal).toBe(false);
    });

    it("identifies image payload as requiring vision only", () => {
      const reqs = getPayloadCapabilityRequirements({
        messages: [
          {
            role: "user",
            content: [{ type: "image_url", image_url: { url: "https://example.com/test.png" } }],
          },
        ],
      });
      expect(reqs.needsVision).toBe(true);
      expect(reqs.needsDocuments).toBe(false);
      expect(reqs.isMultimodal).toBe(true);
    });

    it("identifies PDF payload as requiring documents only", () => {
      const reqs = getPayloadCapabilityRequirements({
        messages: [
          {
            role: "user",
            content: [
              { type: "document", source: { type: "base64", media_type: "application/pdf", data: "JVBERi0..." } },
            ],
          },
        ],
      });
      expect(reqs.needsVision).toBe(false);
      expect(reqs.needsDocuments).toBe(true);
      expect(reqs.isMultimodal).toBe(true);
    });

    it("identifies payload containing BOTH image and document", () => {
      const reqs = getPayloadCapabilityRequirements({
        messages: [
          {
            role: "user",
            content: [
              { type: "image_url", image_url: { url: "https://example.com/chart.png" } },
              { type: "document", source: { type: "base64", media_type: "application/pdf", data: "JVBERi0..." } },
            ],
          },
        ],
      });
      expect(reqs.needsVision).toBe(true);
      expect(reqs.needsDocuments).toBe(true);
      expect(reqs.isMultimodal).toBe(true);
    });
  });

  describe("isOpenRouterEndpoint", () => {
    it("identifies openrouter.ai URLs correctly", () => {
      expect(isOpenRouterEndpoint("https://openrouter.ai/api/v1/chat/completions")).toBe(true);
      expect(isOpenRouterEndpoint("https://openrouter.ai/api")).toBe(true);
      expect(isOpenRouterEndpoint("https://openrouter.ai/api/v1")).toBe(true);
    });

    it("returns false for non-openrouter endpoints", () => {
      expect(isOpenRouterEndpoint("https://api.openai.com/v1")).toBe(false);
      expect(isOpenRouterEndpoint("https://api.anthropic.com/v1")).toBe(false);
      expect(isOpenRouterEndpoint("https://fxqidian.de5.net")).toBe(false);
    });
  });

  describe("buildUpstreamRequestHeaders", () => {
    it("attaches Authorization and Content-Type headers for generic endpoints", () => {
      const headers = buildUpstreamRequestHeaders("sk-test-key-123", {
        stream: false,
        url: "https://api.example.com/v1",
      });
      expect(headers.Authorization).toBe("Bearer sk-test-key-123");
      expect(headers["Content-Type"]).toBe("application/json");
      expect(headers.Accept).toBe("application/json");
      expect(headers["HTTP-Referer"]).toBeUndefined();
      expect(headers["X-Title"]).toBeUndefined();
    });

    it("attaches HTTP-Referer and X-Title when calling OpenRouter endpoints", () => {
      const headers = buildUpstreamRequestHeaders("sk-or-v1-abcdef123456", {
        stream: true,
        url: "https://openrouter.ai/api/v1/chat/completions",
      });
      expect(headers.Authorization).toBe("Bearer sk-or-v1-abcdef123456");
      expect(headers["Content-Type"]).toBe("application/json");
      expect(headers.Accept).toBe("text/event-stream");
      expect(headers["HTTP-Referer"]).toBe("https://tokenforge.ai");
      expect(headers["X-Title"]).toBe("TokenForge");
    });
  });

  describe("normalizeUpstreamChatCompletionsUrl", () => {
    it("appends /v1/chat/completions if base URL does not have /v1", () => {
      expect(normalizeUpstreamChatCompletionsUrl("https://openrouter.ai/api")).toBe(
        "https://openrouter.ai/api/v1/chat/completions"
      );
    });

    it("appends /chat/completions if base URL already ends with /v1", () => {
      expect(normalizeUpstreamChatCompletionsUrl("https://openrouter.ai/api/v1")).toBe(
        "https://openrouter.ai/api/v1/chat/completions"
      );
    });

    it("leaves url unchanged if it already ends with /chat/completions", () => {
      expect(
        normalizeUpstreamChatCompletionsUrl("https://openrouter.ai/api/v1/chat/completions")
      ).toBe("https://openrouter.ai/api/v1/chat/completions");
    });
  });

  describe("filterProvidersByVisionCapability", () => {
    const providers = [
      { id: "p1", label: "Bailu Text", supportsVision: false, enabled: true },
      { id: "p2", label: "OpenRouter Vision", supportsVision: true, enabled: true },
      { id: "p3", label: "Disabled Vision", supportsVision: true, enabled: false },
    ];

    it("returns all providers when requireVision is false", () => {
      const filtered = filterProvidersByVisionCapability(providers, false);
      expect(filtered.length).toBe(3);
    });

    it("returns ONLY enabled vision providers when requireVision is true", () => {
      const filtered = filterProvidersByVisionCapability(providers, true);
      expect(filtered.length).toBe(1);
      expect(filtered[0].id).toBe("p2");
      expect(filtered[0].label).toBe("OpenRouter Vision");
    });
  });

  describe("MultimodalRoutingError", () => {
    it("instantiates with standard statusCode 400 and custom message", () => {
      const err = new MultimodalRoutingError("No vision provider configured");
      expect(err.statusCode).toBe(400);
      expect(err.name).toBe("MultimodalRoutingError");
      expect(err.message).toBe("No vision provider configured");
    });
  });

  describe("Enhanced Visual Detection", () => {
    it("detects image nested inside Anthropic tool_result block", () => {
      const payload = {
        messages: [
          {
            role: "user",
            content: [
              {
                type: "tool_result",
                tool_use_id: "tool_screenshot_1",
                content: [
                  {
                    type: "image",
                    source: {
                      type: "base64",
                      media_type: "image/png",
                      data: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
                    },
                  },
                  {
                    type: "text",
                    text: "Screen capture completed.",
                  },
                ],
              },
            ],
          },
        ],
      };
      expect(payloadContainsVisualData(payload)).toBe(true);
    });

    it("detects markdown image syntax in text content", () => {
      const payload = {
        messages: [
          {
            role: "user",
            content: "Please analyze this architectural diagram: ![diagram](https://cdn.example.com/arch-v2.png)",
          },
        ],
      };
      expect(payloadContainsVisualData(payload)).toBe(true);
    });

    it("detects direct image URL in text content", () => {
      const payload = {
        messages: [
          {
            role: "user",
            content: "What is shown at https://images.unsplash.com/photo-1543852786-1cf6624b9987.jpg?auto=format",
          },
        ],
      };
      expect(payloadContainsVisualData(payload)).toBe(true);
    });
  });

  describe("pruneOldImagesAndDeriveContent (25-turn stripping)", () => {
    it("preserves image when it occurred within 25 message turns back", async () => {
      // Create 26 turns: index 0 (image) to index 25 (latest user message).
      // turnsBack = 25 - 0 = 25 turns back.
      const messages: any[] = [
        {
          role: "user",
          content: [
            { type: "text", text: "Look at this chart" },
            { type: "image_url", image_url: { url: "https://example.com/chart.png" } },
          ],
        },
      ];
      for (let i = 1; i <= 25; i++) {
        messages.push({
          role: i % 2 === 1 ? "assistant" : "user",
          content: `Message turn ${i}`,
        });
      }

      expect(messages.length).toBe(26);
      const result = await pruneOldImagesAndDeriveContent(messages);
      expect(result.analysis.hasVisualData).toBe(true);
      expect(result.analysis.tag).toBe("(image: 25 msgs back)");
      // Image remains intact
      expect(result.messages[0].content[1].type).toBe("image_url");
    });

    it("strips image when it occurred more than 25 message turns back (e.g. 26 msgs back)", async () => {
      // Create 27 turns: index 0 (image) to index 26 (latest user message).
      // turnsBack = 26 - 0 = 26 turns back (> 25).
      const messages: any[] = [
        {
          role: "user",
          content: [
            { type: "text", text: "Look at this chart" },
            { type: "image_url", image_url: { url: "https://example.com/chart.png" } },
          ],
        },
      ];
      for (let i = 1; i <= 26; i++) {
        messages.push({
          role: i % 2 === 1 ? "assistant" : "user",
          content: `Message turn ${i}`,
        });
      }

      expect(messages.length).toBe(27);
      const result = await pruneOldImagesAndDeriveContent(messages);
      // Image older than 25 turns has been stripped
      expect(result.analysis.hasVisualData).toBe(false);
      expect(result.analysis.tag).toBeUndefined();
      expect(result.messages[0].content[1]).toEqual({
        type: "text",
        text: "[Earlier image omitted for context limit]",
      });
    });

    it("keeps recent image while stripping image that occurred more than 25 turns back", async () => {
      // 30 messages total: index 0 (image 1, 29 msgs back) and index 22 (image 2, 7 msgs back)
      const messages: any[] = [
        {
          role: "user",
          content: [
            { type: "image_url", image_url: { url: "https://example.com/old.png" } },
          ],
        },
      ];
      for (let i = 1; i <= 29; i++) {
        if (i === 22) {
          messages.push({
            role: "user",
            content: [
              { type: "text", text: "Here is a new screenshot" },
              { type: "image_url", image_url: { url: "https://example.com/new.png" } },
            ],
          });
        } else {
          messages.push({
            role: i % 2 === 1 ? "assistant" : "user",
            content: `Turn ${i}`,
          });
        }
      }

      const result = await pruneOldImagesAndDeriveContent(messages);
      // Old image stripped
      expect(result.messages[0].content[0]).toEqual({
        type: "text",
        text: "[Earlier image omitted for context limit]",
      });
      // Recent image (7 msgs back) preserved
      expect(result.analysis.hasVisualData).toBe(true);
      expect(result.analysis.tag).toBe("(image: 7 msgs back)");
      expect(result.messages[22].content[1].type).toBe("image_url");
    });
  });
});
