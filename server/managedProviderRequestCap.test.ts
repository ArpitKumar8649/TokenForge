import { describe, expect, it } from "vitest";
import { MANAGED_PROVIDER_METRIC_MODEL_IDS } from "./db";

describe("managed provider request accounting", () => {
  it("keeps GLM 5.3 in the normal managed-provider metric set without a request-retirement policy", () => {
    expect(MANAGED_PROVIDER_METRIC_MODEL_IDS).toContain("glm-5.3");
    expect(MANAGED_PROVIDER_METRIC_MODEL_IDS).toContain("deepseek-v4-pro");
  });
});
