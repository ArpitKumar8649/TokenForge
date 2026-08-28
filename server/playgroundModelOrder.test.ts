import { describe, expect, it } from "vitest";
import { formatTokenForgeCreditRatePerMillion, PLAYGROUND_FEATURED_MODEL_IDS, prioritizePlaygroundModels, TOKENFORGE_MODELS, TOKENFORGE_PLATFORM_CHARGE_MULTIPLIER } from "../client/src/lib/modelCatalogue";

describe("Playground model priority", () => {
  it("uses the active 2.0× platform multiplier for every displayed model rate", () => {
    expect(TOKENFORGE_PLATFORM_CHARGE_MULTIPLIER).toBe(2.0);
    expect(formatTokenForgeCreditRatePerMillion(5)).toBe("$10");
    expect(formatTokenForgeCreditRatePerMillion(25)).toBe("$50");
    expect(formatTokenForgeCreditRatePerMillion(0.14)).toBe("$0.28");
    expect(formatTokenForgeCreditRatePerMillion(0.28)).toBe("$0.56");
    for (const model of TOKENFORGE_MODELS) {
      expect(model.inputUsdPerMillion * TOKENFORGE_PLATFORM_CHARGE_MULTIPLIER).toBeGreaterThanOrEqual(0);
      expect(model.outputUsdPerMillion * TOKENFORGE_PLATFORM_CHARGE_MULTIPLIER).toBeGreaterThanOrEqual(0);
    }
  });
  it("pins Claude Fable 5 before the remaining featured models without dropping catalogue routes", () => {
    const ordered = prioritizePlaygroundModels(TOKENFORGE_MODELS);

    expect(ordered).toHaveLength(TOKENFORGE_MODELS.length);
    expect(ordered.slice(0, PLAYGROUND_FEATURED_MODEL_IDS.length).map(model => model.id)).toEqual(PLAYGROUND_FEATURED_MODEL_IDS);
    expect(new Set(ordered.map(model => model.id)).size).toBe(TOKENFORGE_MODELS.length);
  });
});
