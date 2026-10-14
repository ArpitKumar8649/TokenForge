import React, { useState } from "react";
import { cn } from "@/lib/utils";

export interface RippleButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  rippleColor?: string;
  duration?: number;
}

interface Ripple {
  x: number;
  y: number;
  size: number;
  key: number;
}

export const RippleButton = React.forwardRef<HTMLButtonElement, RippleButtonProps>(
  (
    {
      children,
      className,
      onClick,
      rippleColor = "rgba(255, 255, 255, 0.4)",
      duration = 600,
      ...props
    },
    ref
  ) => {
    const [ripples, setRipples] = useState<Ripple[]>([]);

    const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
      const button = e.currentTarget;
      const rect = button.getBoundingClientRect();
      const size = Math.max(rect.width, rect.height) * 2;
      const x = e.clientX - rect.left - size / 2;
      const y = e.clientY - rect.top - size / 2;

      const newRipple: Ripple = {
        x,
        y,
        size,
        key: Date.now() + Math.random(),
      };

      setRipples((prev) => [...prev, newRipple]);

      setTimeout(() => {
        setRipples((prev) => prev.filter((r) => r.key !== newRipple.key));
      }, duration);

      if (onClick) {
        onClick(e);
      }
    };

    return (
      <button
        ref={ref}
        className={cn(
          "relative overflow-hidden cursor-pointer select-none active:scale-[0.98] transition-transform",
          className
        )}
        onClick={handleClick}
        {...props}
      >
        {children}
        {ripples.map((ripple) => (
          <span
            key={ripple.key}
            style={{
              position: "absolute",
              top: ripple.y,
              left: ripple.x,
              width: ripple.size,
              height: ripple.size,
              borderRadius: "50%",
              backgroundColor: rippleColor,
              pointerEvents: "none",
              animation: `ripple-animation ${duration}ms cubic-bezier(0, 0, 0.2, 1) forwards`,
            }}
          />
        ))}
      </button>
    );
  }
);

RippleButton.displayName = "RippleButton";
