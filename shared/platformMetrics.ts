export const FEATURED_MODEL_TOKEN_THRESHOLD = 100_000_000;

export type PlatformModelDescriptor = {
  id: string;
  name: string;
  provider: string;
  providerMark: string;
  tone: string;
};

export type FeaturedPlatformModel = PlatformModelDescriptor & {
  totalTokens: number;
};

/** Selects only catalogue models that have processed the required exact lifetime token total. */
export function selectFeaturedPlatformModels(
  models: readonly PlatformModelDescriptor[],
  byModel: Readonly<Record<string, number | undefined>>,
  threshold = FEATURED_MODEL_TOKEN_THRESHOLD,
): FeaturedPlatformModel[] {
  return models
    .map(model => ({ ...model, totalTokens: Math.max(0, Number(byModel[model.id] ?? 0)) }))
    .filter((model): model is FeaturedPlatformModel => Number.isFinite(model.totalTokens) && model.totalTokens >= threshold)
    .sort((left, right) => right.totalTokens - left.totalTokens || left.name.localeCompare(right.name));
}
