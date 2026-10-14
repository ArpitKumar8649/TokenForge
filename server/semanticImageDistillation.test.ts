import { describe, it, expect, vi } from "vitest";
import {
  computeImageHash,
  extractImagesFromMessage,
  getCachedImageDescriptionSync,
  getImageSemanticDescriptionWithCache,
  lookupDescriptionsForHashes,
} from "./semanticImageDistillation";
import {
  pruneOldImagesAndDeriveContent,
  stripVisualContentFromMessage,
} from "./modelCapabilityRouter";

describe("Semantic Image Distillation", () => {
  describe("computeImageHash", () => {
    it("generates deterministic SHA-256 hash for image strings", () => {
      const img1 = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
      const hash1 = computeImageHash(img1);
      const hash2 = computeImageHash(img1);
      expect(hash1).toBe(hash2);
      expect(hash1.length).toBe(64);

      const hash3 = computeImageHash("https://example.com/cat.png");
      expect(hash3).not.toBe(hash1);
    });
  });

  describe("extractImagesFromMessage", () => {
    it("extracts OpenAI formatted image_url parts", () => {
      const msg = {
        role: "user",
        content: [
          { type: "text", text: "Look at this:" },
          { type: "image_url", image_url: { url: "https://example.com/photo.jpg" } },
        ],
      };
      const targets = extractImagesFromMessage(msg);
      expect(targets.length).toBe(1);
      expect(targets[0].urlOrData).toBe("https://example.com/photo.jpg");
      expect(targets[0].hash).toBe(computeImageHash("https://example.com/photo.jpg"));
    });

    it("extracts Anthropic formatted base64 image parts", () => {
      const base64Data = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
      const msg = {
        role: "user",
        content: [
          {
            type: "image",
            source: {
              type: "base64",
              media_type: "image/png",
              data: base64Data,
            },
          },
        ],
      };
      const targets = extractImagesFromMessage(msg);
      expect(targets.length).toBe(1);
      expect(targets[0].urlOrData).toBe(`data:image/png;base64,${base64Data}`);
    });

    it("extracts images from top-level images array and string", () => {
      const msg1 = { role: "user", images: ["https://example.com/1.png", "https://example.com/2.png"] };
      const targets1 = extractImagesFromMessage(msg1);
      expect(targets1.length).toBe(2);

      const msg2 = { role: "user", image: "https://example.com/single.png" };
      const targets2 = extractImagesFromMessage(msg2);
      expect(targets2.length).toBe(1);
      expect(targets2[0].urlOrData).toBe("https://example.com/single.png");
    });
  });

  describe("Semantic Pruning Replacement (Past 25 Turns)", () => {
    it("replaces pruned images with dense technical semantic descriptions when available", () => {
      const sampleUrl = "https://example.com/dashboard-screenshot.png";
      const sampleHash = computeImageHash(sampleUrl);

      const descriptions = new Map<string, string>([
        [
          sampleHash,
          "### Executive Dashboard Overview\n- Active MRR: $42,500 (+12% MoM)\n- Churn rate: 1.4%\n- Chart displays weekly active user cohort retention across Q3 with a spike in August.",
        ],
      ]);

      const originalMsg = {
        role: "user",
        content: [
          { type: "text", text: "Analyze this metric graph:" },
          { type: "image_url", image_url: { url: sampleUrl } },
        ],
      };

      const stripped = stripVisualContentFromMessage(originalMsg, descriptions, {
        turnNumber: 1,
        turnsBack: 27,
      });

      expect(stripped.content[0].text).toBe("Analyze this metric graph:");
      expect(stripped.content[1].type).toBe("text");
      expect(stripped.content[1].text).toContain("[Visual Attachment (Turn #1) - Semantic Image Distillation]:");
      expect(stripped.content[1].text).toContain("Active MRR: $42,500");
      expect(stripped.content[1].text).toContain("Chart displays weekly active user cohort retention");
    });

    it("falls back cleanly to standard placeholder if description is not yet available", () => {
      const originalMsg = {
        role: "user",
        content: [
          { type: "image_url", image_url: { url: "https://example.com/unknown.png" } },
        ],
      };

      const stripped = stripVisualContentFromMessage(originalMsg, new Map(), {
        turnNumber: 1,
        turnsBack: 30,
      });

      expect(stripped.content[0].type).toBe("text");
      expect(stripped.content[0].text).toBe("[Earlier image omitted for context limit]");
    });

    it("preserves active images within 25 turns while distilling images older than 25 turns", async () => {
      const oldUrl = "https://example.com/old-diagram.png";
      const oldHash = computeImageHash(oldUrl);

      // Pre-seed memory cache
      const descriptions = new Map<string, string>([
        [oldHash, "Architecture diagram showing Client -> API Gateway -> Auth / DB cluster."],
      ]);

      const messages: any[] = [
        {
          role: "user",
          content: [
            { type: "text", text: "Here is our old architecture:" },
            { type: "image_url", image_url: { url: oldUrl } },
          ],
        },
      ];

      // Add 26 text turns
      for (let i = 1; i <= 26; i++) {
        if (i === 20) {
          // Add a recent image at turn 21 (6 turns back from end)
          messages.push({
            role: "user",
            content: [
              { type: "text", text: "Here is the updated design:" },
              { type: "image_url", image_url: { url: "https://example.com/recent-design.png" } },
            ],
          });
        } else {
          messages.push({
            role: i % 2 === 1 ? "assistant" : "user",
            content: `Turn ${i} conversation text`,
          });
        }
      }

      // Total messages: 27
      // Turn 1 (index 0): 26 turns back -> MUST BE STRIPPED & DISTILLED
      // Turn 21 (index 20): 6 turns back -> MUST BE PRESERVED
      const result = await pruneOldImagesAndDeriveContent(messages);

      // Turn 1 image is stripped and replaced with text
      expect(result.messages[0].content[1].type).toBe("text");
      // Turn 21 image is kept as image_url
      expect(result.messages[20].content[1].type).toBe("image_url");

      // Has visual data because recent image still exists
      expect(result.analysis.hasVisualData).toBe(true);
      expect(result.analysis.tag).toBe("(image: 6 msgs back)");
    });
  });
});
