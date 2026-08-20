import React, { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export type MovingDotCardProps = {
  target: number;
  duration?: number;
  label?: string;
  description?: string;
  className?: string;
};

export function formatMovingDotMetric(value: number) {
  const safeValue = Math.max(0, Math.floor(Number.isFinite(value) ? value : 0));
  return new Intl.NumberFormat(undefined, {
    notation: "compact",
    maximumFractionDigits: safeValue >= 1_000_000 ? 1 : 0,
  }).format(safeValue);
}

export function MovingDotCard({
  target,
  duration = 900,
  label = "Tokens processed",
  description = "Live platform aggregate",
  className,
}: MovingDotCardProps) {
  const safeTarget = Math.max(0, Math.floor(Number.isFinite(target) ? target : 0));
  const [count, setCount] = useState(0);
  const currentValue = useRef(0);

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReducedMotion) {
      currentValue.current = safeTarget;
      setCount(safeTarget);
      return;
    }

    const startValue = currentValue.current;
    const range = safeTarget - startValue;
    if (range === 0) return;

    const startedAt = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const progress = Math.min(1, (now - startedAt) / duration);
      const eased = 1 - Math.pow(1 - progress, 4);
      const nextValue = Math.round(startValue + range * eased);
      currentValue.current = nextValue;
      setCount(nextValue);
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [duration, safeTarget]);

  const exactValue = new Intl.NumberFormat().format(safeTarget);

  return (
    <article className={cn("tf-moving-dot-card", className)} aria-label={`${exactValue} ${label.toLowerCase()}`}>
      <span className="tf-moving-dot-card__orbit" aria-hidden="true" />
      <div className="tf-moving-dot-card__ray" aria-hidden="true" />
      <div className="tf-moving-dot-card__content">
        <strong className="tf-moving-dot-card__value" title={exactValue}>{formatMovingDotMetric(count)}</strong>
        <span className="tf-moving-dot-card__label">{label}</span>
        <small className="tf-moving-dot-card__description">{description}</small>
      </div>
      <span className="tf-moving-dot-card__line tf-moving-dot-card__line--top" aria-hidden="true" />
      <span className="tf-moving-dot-card__line tf-moving-dot-card__line--left" aria-hidden="true" />
      <span className="tf-moving-dot-card__line tf-moving-dot-card__line--bottom" aria-hidden="true" />
      <span className="tf-moving-dot-card__line tf-moving-dot-card__line--right" aria-hidden="true" />
    </article>
  );
}
