import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { MovingDotCard, formatMovingDotMetric } from "../client/src/components/ui/moving-dot-card";

describe("MovingDotCard", () => {
  it("formats truthful aggregate values without a hard-coded display target", () => {
    expect(formatMovingDotMetric(123_456_789)).toMatch(/123(?:\.|,)5?M|123M/i);
    expect(formatMovingDotMetric(-20)).toBe("0");
  });

  it("renders a labelled, decorative moving-dot stat card", () => {
    const markup = renderToStaticMarkup(createElement(MovingDotCard, {
      target: 123_456_789,
      label: "Tokens processed",
      description: "Live platform aggregate",
    }));

    expect(markup).toContain("Tokens processed");
    expect(markup).toContain("Live platform aggregate");
    expect(markup).toContain("tf-moving-dot-card__orbit");
    expect(markup).toContain('aria-hidden="true"');
  });
});
