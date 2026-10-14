import React, { useEffect, useRef, useState } from "react";
import VaporizeTextCycle, { Tag } from "@/components/ui/vapour-text-effect";

/**
 * VapourAccent — drop-in animated accent for headings.
 *
 * Measures parent font metrics responsively and reserves exact vertical space
 * so heading flow never overlaps body copy.
 */
export default function VapourAccent({
  texts,
  color = "#ffcf8d",
  fontWeight = 500,
  fontFamily,
  fontStyle = "italic",
  className = "",
  alignment = "left",
  animation = { vaporizeDuration: 2.2, fadeInDuration: 0.8, waitDuration: 1.8 },
}: {
  texts: string[];
  color?: string;
  fontWeight?: number;
  fontFamily?: string;
  fontStyle?: string;
  className?: string;
  alignment?: "left" | "center" | "right";
  animation?: {
    vaporizeDuration?: number;
    fadeInDuration?: number;
    waitDuration?: number;
  };
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const [metrics, setMetrics] = useState({
    fontFamily: fontFamily || '"Playfair Display", Georgia, serif',
    fontSize: 52,
    lineHeight: 64,
  });

  useEffect(() => {
    const measure = () => {
      const parent = ref.current?.parentElement;
      if (!parent) return;
      const cs = getComputedStyle(parent);
      const measuredSize = parseFloat(cs.fontSize) || 52;
      const viewportWidth = window.innerWidth;
      const effectiveSize =
        viewportWidth < 480
          ? Math.min(measuredSize, 40)
          : viewportWidth < 820
            ? Math.min(measuredSize, 46)
            : measuredSize;

      setMetrics({
        fontFamily: fontFamily || cs.fontFamily || '"Playfair Display", Georgia, serif',
        fontSize: effectiveSize,
        lineHeight: Math.round(effectiveSize * 1.2),
      });
    };

    measure();

    if (typeof document !== "undefined" && (document as any).fonts?.ready) {
      (document as any).fonts.ready.then(measure).catch(() => {});
    }

    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [fontFamily]);

  return (
    <span
      ref={ref}
      className={`vapour-accent-container block w-full mt-1 ${className}`}
      style={{
        height: `${metrics.lineHeight}px`,
        minHeight: `${metrics.lineHeight}px`,
      }}
    >
      <VaporizeTextCycle
        texts={texts}
        font={{
          fontFamily: metrics.fontFamily,
          fontSize: `${metrics.fontSize}px`,
          fontWeight,
          fontStyle,
        }}
        color={color}
        spread={2.2}
        density={5}
        animation={animation}
        direction="left-to-right"
        alignment={alignment}
        tag={Tag.P}
      />
    </span>
  );
}
