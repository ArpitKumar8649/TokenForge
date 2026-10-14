import { describe, expect, it } from "vitest";
import { betaPlans, demoSafetyNotice, publicModels } from "../client/src/lib/tokenforgePresentation";

describe("TokenForge public-product contracts", () => {
  it("publishes only the two approved model identifiers", () => {
    expect(publicModels.map(model => model.id)).toEqual(["glm-5.2", "grok-4.5"]);
  });

  it("keeps the demo explicitly disconnected from protected platform operations", () => {
    expect(demoSafetyNotice).toMatch(/disconnected from the live API/i);
    expect(demoSafetyNotice).toMatch(/provider controls/i);
    expect(demoSafetyNotice).toMatch(/administrative procedures/i);
  });

  it("describes the present offering as free beta and does not present a live paid checkout", () => {
    const explorer = betaPlans.find(plan => plan.name === "Explorer");
    const studio = betaPlans.find(plan => plan.name === "Studio");
    expect(explorer).toMatchObject({ eyebrow: "Free beta", price: "$0" });
    expect(explorer?.features).toContain("100 requests each day");
    expect(studio?.features).toContain("No payment collected today");
  });
});
