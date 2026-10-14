import { useLocation } from "wouter";
import { TokenForgeGlyph } from "./TokenForgeGlyph";
import { useEffect, useRef, useState } from "react";

/** Deliberate product transition used for the current TokenForge concept preview. */
export function RouteLoader() {
  const [location] = useLocation();
  const [visible, setVisible] = useState(true);
  const previousLocation = useRef(location);

  useEffect(() => {
    const routeChanged = previousLocation.current !== location;
    previousLocation.current = location;
    setVisible(true);
    const timeout = window.setTimeout(() => setVisible(false), routeChanged ? 2400 : 2400);
    return () => window.clearTimeout(timeout);
  }, [location]);

  if (!visible) return null;

  return (
    <div className="tf-route-loader" role="status" aria-live="polite" aria-label="Loading TokenForge">
      <div className="tf-route-loader__inner">
        <TokenForgeGlyph className="tf-route-loader__glyph" label="TokenForge is loading" />
        <p>Forging a clearer path</p>
        <span>Preparing the workspace…</span>
      </div>
    </div>
  );
}
