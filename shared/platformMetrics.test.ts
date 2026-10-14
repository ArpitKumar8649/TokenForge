import { describe, expect, it } from "vitest";
import { FEATURED_MODEL_TOKEN_THRESHOLD, selectFeaturedPlatformModels } from "./platformMetrics";

const models = [
  { id: "alpha", name: "Alpha", provider: "Example", providerMark: "A", tone: "lime" },
  { id: "beta", name: "Beta", provider: "Example", providerMark: "B", tone: "cyan" },
  { id: "gamma", name: "Gamma", provider: "Example", providerMark: "G", tone: "violet" },
] as const;

describe("selectFeaturedPlatformModels", () => {
  it("returns only models at or above 100 million exact processed tokens in descending order", () => {
    expect(selectFeaturedPlatformModels(models, {
      alpha: FEATURED_MODEL_TOKEN_THRESHOLD,
      beta: 320_500_101,
      gamma: 99_999_999,
    })).toEqual([
      { ...models[1], totalTokens: 320_500_101 },
      { ...models[0], totalTokens: FEATURED_MODEL_TOKEN_THRESHOLD },
    ]);
  });

  it("ignores unrecognised models and protects the display from invalid negative values", () => {
    expect(selectFeaturedPlatformModels(models, { alpha: -5, unknown: 900_000_000 })).toEqual([]);
  });
});
