import React from "react";
import { AlertTriangle, Sparkles, Zap, Hand } from "lucide-react";

export interface AlertPreviewButtonProps {
  active: boolean;
  onClick: () => void;
  className?: string;
}

export function AlertPreviewButton({ active, onClick, className = "" }: AlertPreviewButtonProps) {
  return (
    <div className="relative inline-flex items-center">
      {/* Floating Animated Callout Banner: "Click me to test!" */}
      {!active && (
        <div
          className="absolute -top-8 right-2 z-20 pointer-events-none flex items-center gap-1 rounded-full bg-gradient-to-r from-[#c9ff73] via-[#e5ff99] to-[#bbf861] px-2.5 py-0.5 text-[10px] font-extrabold text-[#11180b] shadow-[0_0_16px_rgba(201,255,115,0.75)] animate-bounce select-none whitespace-nowrap"
          aria-hidden="true"
        >
          <Sparkles size={11} className="animate-spin text-[#11180b]" />
          <span>Click me to test!</span>
          <span className="text-[11px] leading-none">👇</span>
        </div>
      )}

      {/* Pulsing halo ring when not active */}
      {!active && (
        <span
          className="pointer-events-none absolute -inset-0.5 rounded-full bg-gradient-to-r from-[#c9ff73]/50 via-[#c9ff73]/20 to-[#c9ff73]/50 blur-sm animate-pulse opacity-80 group-hover:opacity-100"
          aria-hidden="true"
        />
      )}

      <button
        type="button"
        id="alert-preview-toggle-btn"
        onClick={onClick}
        aria-pressed={active}
        aria-label={active ? "Hide low balance alert preview" : "Click to preview low balance warning alert"}
        className={`group relative inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-semibold tracking-wide transition-all duration-300 select-none overflow-hidden cursor-pointer ${
          active
            ? "bg-gradient-to-r from-amber-500/25 via-amber-400/20 to-amber-500/25 text-amber-200 border border-amber-400/50 shadow-[0_0_20px_rgba(245,158,11,0.35)] scale-[1.02]"
            : "bg-gradient-to-r from-[#171e14] via-[#1f291a] to-[#171e14] text-[#e5ffd0] border border-[#c9ff73]/40 hover:border-[#c9ff73] hover:text-white shadow-[0_0_16px_rgba(201,255,115,0.25)] hover:shadow-[0_0_24px_rgba(201,255,115,0.45)] active:scale-95"
        } ${className}`}
      >
        {/* Animated shimmer beam passing across the button */}
        <span
          className="pointer-events-none absolute -inset-full w-[200%] -translate-x-full group-hover:translate-x-full transition-transform duration-1000 bg-gradient-to-r from-transparent via-white/20 to-transparent"
          aria-hidden="true"
        />

        {/* Pulse beacon dot */}
        <span className="relative flex h-2 w-2 items-center justify-center">
          <span
            className={`absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping ${
              active ? "bg-amber-400" : "bg-[#c9ff73]"
            }`}
          />
          <span
            className={`relative inline-flex h-1.5 w-1.5 rounded-full ${
              active ? "bg-amber-300" : "bg-[#c9ff73]"
            }`}
          />
        </span>

        {/* Dynamic Icon */}
        <span
          className={`flex items-center justify-center transition-transform duration-300 ${
            active
              ? "rotate-12 text-amber-300 animate-pulse"
              : "group-hover:scale-125 text-[#c9ff73] group-hover:rotate-6"
          }`}
        >
          {active ? (
            <AlertTriangle size={13} className="fill-amber-400/20 text-amber-300" />
          ) : (
            <Zap size={13} className="fill-[#c9ff73] text-[#c9ff73] animate-pulse" />
          )}
        </span>

        {/* Button Text */}
        <span className="font-mono text-[11px] tracking-tight font-medium">
          {active ? "Hide Alert Preview" : "Preview Low Balance Alert"}
        </span>

        {/* Dynamic Tag Pill */}
        <span
          className={`rounded-full px-1.5 py-0.5 text-[9px] font-mono uppercase tracking-wider font-bold transition-all ${
            active
              ? "bg-amber-400/25 text-amber-200 border border-amber-400/40"
              : "bg-[#c9ff73]/20 text-[#c9ff73] border border-[#c9ff73]/40 group-hover:bg-[#c9ff73] group-hover:text-[#11180b]"
          }`}
        >
          {active ? "Showing" : "Demo"}
        </span>
      </button>
    </div>
  );
}
export default AlertPreviewButton;
