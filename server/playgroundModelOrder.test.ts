import { describe, expect, it } from "vitest";
import { PLAYGROUND_FEATURED_MODEL_IDS, prioritizePlaygroundModels, TOKENFORGE_MODELS } from "../client/src/lib/modelCatalogue";

describe("Playground model priority", () => {
  it("pins Claude Opus 5 before the remaining featured models without dropping catalogue routes", () => {
    const ordered = prioritizePlaygroundModels(TOKENFORGE_MODELS);

    expect(ordered).toHaveLength(TOKENFORGE_MODELS.length);
    expect(ordered.slice(0, PLAYGROUND_FEATURED_MODEL_IDS.length).map(model => model.id)).toEqual(PLAYGROUND_FEATURED_MODEL_IDS);
    expect(new Set(ordered.map(model => model.id)).size).toBe(TOKENFORGE_MODELS.length);
  });
});
