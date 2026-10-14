import { cn } from "@/lib/utils";
import React, { useState, useRef, useEffect } from "react";
import { useLocation } from "wouter";

interface ThreeDButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  href?: string;
  label1?: string;
  label2?: string;
  redirectDelay?: number;
}

export const Component: React.FC<ThreeDButtonProps> = ({
  className,
  onClick,
  href = "/signin",
  label1 = "Join Today",
  label2 = "Join Now",
  redirectDelay = 850,
  ...props
}) => {
  const [isPressed, setIsPressed] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [, setLocation] = useLocation();
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (onClick) {
      onClick(e);
    }

    if (e.defaultPrevented) return;

    // Physical button compression
    setIsPressed(true);
    setIsAnimating(true);

    // Spring up after brief press
    setTimeout(() => {
      setIsPressed(false);
    }, 180);

    // Wait for the button animation to complete before redirecting to login
    if (href) {
      e.preventDefault();
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        setIsAnimating(false);
        setLocation(href);
      }, redirectDelay);
    }
  };

  const chars1 = label1.split("");
  const chars2 = label2.split("");

  return (
    <div className={cn("inline-flex flex-col items-center", className)}>
      <button
        type="button"
        className={cn(
          "button",
          isPressed && "is-pressed",
          isAnimating && "is-animating"
        )}
        onClick={handleClick}
        disabled={isAnimating || props.disabled}
        aria-label={label1}
        {...props}
      >
        <div className="bg" />
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 342 208"
          height={208}
          width={342}
          className="splash"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeWidth={3}
            d="M54.1054 99.7837C54.1054 99.7837 40.0984 90.7874 26.6893 97.6362C13.2802 104.485 1.5 97.6362 1.5 97.6362"
          />
          <path
            strokeLinecap="round"
            strokeWidth={3}
            d="M285.273 99.7841C285.273 99.7841 299.28 90.7879 312.689 97.6367C326.098 104.486 340.105 95.4893 340.105 95.4893"
          />
          <path
            strokeLinecap="round"
            strokeWidth={3}
            strokeOpacity="0.3"
            d="M281.133 64.9917C281.133 64.9917 287.96 49.8089 302.934 48.2295C317.908 46.6501 319.712 36.5272 319.712 36.5272"
          />
          <path
            strokeLinecap="round"
            strokeWidth={3}
            strokeOpacity="0.3"
            d="M281.133 138.984C281.133 138.984 287.96 154.167 302.934 155.746C317.908 157.326 319.712 167.449 319.712 167.449"
          />
          <path
            strokeLinecap="round"
            strokeWidth={3}
            d="M230.578 57.4476C230.578 57.4476 225.785 41.5051 236.061 30.4998C246.337 19.4945 244.686 12.9998 244.686 12.9998"
          />
          <path
            strokeLinecap="round"
            strokeWidth={3}
            d="M230.578 150.528C230.578 150.528 225.785 166.471 236.061 177.476C246.337 188.481 244.686 194.976 244.686 194.976"
          />
          <path
            strokeLinecap="round"
            strokeWidth={3}
            strokeOpacity="0.3"
            d="M170.392 57.0278C170.392 57.0278 173.89 42.1322 169.571 29.54C165.252 16.9478 168.751 2.05227 168.751 2.05227"
          />
          <path
            strokeLinecap="round"
            strokeWidth={3}
            strokeOpacity="0.3"
            d="M170.392 150.948C170.392 150.948 173.89 165.844 169.571 178.436C165.252 191.028 168.751 205.924 168.751 205.924"
          />
          <path
            strokeLinecap="round"
            strokeWidth={3}
            d="M112.609 57.4476C112.609 57.4476 117.401 41.5051 107.125 30.4998C96.8492 19.4945 98.5 12.9998 98.5 12.9998"
          />
          <path
            strokeLinecap="round"
            strokeWidth={3}
            d="M112.609 150.528C112.609 150.528 117.401 166.471 107.125 177.476C96.8492 188.481 98.5 194.976 98.5 194.976"
          />
          <path
            strokeLinecap="round"
            strokeWidth={3}
            strokeOpacity="0.3"
            d="M62.2941 64.9917C62.2941 64.9917 55.4671 49.8089 40.4932 48.2295C25.5194 46.6501 23.7159 36.5272 23.7159 36.5272"
          />
          <path
            strokeLinecap="round"
            strokeWidth={3}
            strokeOpacity="0.3"
            d="M62.2941 145.984C62.2941 145.984 55.4671 161.167 40.4932 162.746C25.5194 164.326 23.7159 174.449 23.7159 174.449"
          />
        </svg>
        <div className="wrap">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 221 42"
            height={42}
            width={221}
            className="path"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeWidth={3}
              d="M182.674 2H203C211.837 2 219 9.16344 219 18V24C219 32.8366 211.837 40 203 40H18C9.16345 40 2 32.8366 2 24V18C2 9.16344 9.16344 2 18 2H47.8855"
            />
          </svg>
          <div className="outline" />
          <div className="content">
            <span className="char state-1">
              {chars1.map((ch, idx) => (
                <span
                  key={idx}
                  data-label={ch}
                  style={{ ["--i" as any]: idx + 1 } as React.CSSProperties}
                >
                  {ch === " " ? "\u00A0" : ch}
                </span>
              ))}
            </span>
            <div className="icon" aria-hidden="true">
              <div />
            </div>
            <span className="char state-2">
              {chars2.map((ch, idx) => (
                <span
                  key={idx}
                  data-label={ch}
                  style={{ ["--i" as any]: idx + 1 } as React.CSSProperties}
                >
                  {ch === " " ? "\u00A0" : ch}
                </span>
              ))}
            </span>
          </div>
        </div>
      </button>
    </div>
  );
};

export const ThreeDButton = Component;
export default Component;
