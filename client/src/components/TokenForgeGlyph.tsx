import { MeshGradient } from "@paper-design/shaders-react";
import { motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";

type TokenForgeGlyphProps = {
  className?: string;
  label?: string;
};

/** A decorative, mouse-responsive TokenForge mark used only for branded product surfaces. */
export function TokenForgeGlyph({ className = "", label = "TokenForge animated mark" }: TokenForgeGlyphProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [eyeOffset, setEyeOffset] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const handlePointerMove = (event: PointerEvent) => {
      const rect = svgRef.current?.getBoundingClientRect();
      if (!rect) return;
      const maxOffset = 8;
      setEyeOffset({
        x: Math.max(-maxOffset, Math.min(maxOffset, (event.clientX - (rect.left + rect.width / 2)) * 0.06)),
        y: Math.max(-maxOffset, Math.min(maxOffset, (event.clientY - (rect.top + rect.height / 2)) * 0.06)),
      });
    };

    window.addEventListener("pointermove", handlePointerMove, { passive: true });
    return () => window.removeEventListener("pointermove", handlePointerMove);
  }, []);

  return (
    <motion.div
      className={`tf-glyph ${className}`}
      animate={{ y: [0, -7, 0], scaleY: [1, 1.055, 1] }}
      transition={{ duration: 3.4, repeat: Infinity, ease: "easeInOut" }}
      aria-label={label}
      role="img"
    >
      <svg ref={svgRef} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 231 289" className="tf-glyph__svg">
        <defs>
          <clipPath id="tokenforge-glyph-clip">
            <path d="M230.809 115.385V249.411C230.809 269.923 214.985 287.282 194.495 288.411C184.544 288.949 175.364 285.718 168.26 280C159.746 273.154 147.769 273.461 139.178 280.23C132.638 285.384 124.381 288.462 115.379 288.462C106.377 288.462 98.1451 285.384 91.6055 280.23C82.912 273.385 70.9353 273.385 62.2415 280.23C55.7532 285.334 47.598 288.411 38.7246 288.462C17.4132 288.615 0 270.667 0 249.359V115.385C0 51.6667 51.6756 0 115.404 0C179.134 0 230.809 51.6667 230.809 115.385Z" />
          </clipPath>
        </defs>
        <foreignObject width="231" height="289" clipPath="url(#tokenforge-glyph-clip)">
          <div className="tf-glyph__mesh">
            <MeshGradient colors={["#ff6b63", "#f7b35a", "#6b5cff", "#241850", "#11152f"]} speed={0.75} className="w-full h-full" />
          </div>
        </foreignObject>
        <motion.ellipse className="tf-glyph__eye" rx="20" ry="30" animate={{ cx: 80 + eyeOffset.x, cy: 120 + eyeOffset.y }} transition={{ type: "spring", stiffness: 150, damping: 15 }} />
        <motion.ellipse className="tf-glyph__eye" rx="20" ry="30" animate={{ cx: 150 + eyeOffset.x, cy: 120 + eyeOffset.y }} transition={{ type: "spring", stiffness: 150, damping: 15 }} />
      </svg>
    </motion.div>
  );
}
