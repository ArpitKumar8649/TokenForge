import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { GlassShineCard } from "../client/src/components/ui/glass-shine-card";

describe("GlassShineCard", () => {
  it("keeps meaningful content above its decorative shine layers", () => {
    const markup = renderToStaticMarkup(
      createElement(
        GlassShineCard,
        { "aria-labelledby": "platform-metric-title", className: "metric-card" },
        createElement("h2", { id: "platform-metric-title" }, "123,456 tokens processed"),
      ),
    );

    expect(markup).toContain("123,456 tokens processed");
    expect(markup).toContain("metric-card");
    expect(markup).toContain("relative z-10");
    expect(markup).toContain('aria-labelledby="platform-metric-title"');
  });
});
