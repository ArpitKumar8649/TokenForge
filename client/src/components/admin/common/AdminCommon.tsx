import React from "react";
import { Switch } from "@/components/ui/switch";

export const formatCredits = (nanos: number) => `$${Math.round(nanos / 1_000_000_000).toLocaleString("en-US")}`;

export const formatTokens = (tokens: number) => {
  if (tokens >= 1_000_000) {
    const millions = Math.round(tokens / 1_000_000);
    return `${millions.toLocaleString("en-US")} M`;
  }
  if (tokens >= 1_000) {
    const thousands = Math.round(tokens / 1_000);
    return `${thousands.toLocaleString("en-US")} K`;
  }
  return Math.round(tokens).toLocaleString("en-US");
};

export function Toggle({
  label,
  enabled,
  onChange,
  pending,
}: {
  label: string;
  enabled: boolean;
  onChange: (value: boolean) => void;
  pending?: boolean;
}) {
  return (
    <div
      className={`flex shrink-0 items-center gap-2 rounded-xl border px-2 py-1 ${
        enabled ? "border-[#c9ff73]/20 bg-[#c9ff73]/[.055]" : "border-white/8 bg-black/15"
      }`}
    >
      <span
        className={`min-w-9 text-right text-[9px] font-bold uppercase tracking-[.12em] ${
          enabled ? "text-[#c9ff73]" : "text-[#828394]"
        }`}
      >
        {pending ? "Saving" : enabled ? "Live" : "Off"}
      </span>
      <Switch
        aria-label={`${label}: ${enabled ? "enabled" : "disabled"}`}
        checked={enabled}
        onCheckedChange={(value) => onChange(Boolean(value))}
        disabled={pending}
        className="h-5 w-9 border-0 data-[state=checked]:bg-[#88c637] data-[state=unchecked]:bg-[#4a4b59] [&_[data-slot=switch-thumb]]:size-4 [&_[data-slot=switch-thumb]]:data-[state=checked]:translate-x-[calc(100%-1px)]"
      />
    </div>
  );
}

export function Metric({
  icon,
  label,
  value,
  detail,
  lime,
  warning,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  detail: string;
  lime?: boolean;
  warning?: boolean;
}) {
  return (
    <div className="dashboard-card min-w-0 p-3 sm:p-4">
      <div
        className={`grid h-8 w-8 place-items-center rounded-lg ${
          warning
            ? "bg-[#f0c180]/10 text-[#f0c180]"
            : lime
            ? "bg-[#c9ff73]/10 text-[#c9ff73]"
            : "bg-white/6 text-[#b8b9c8]"
        }`}
      >
        {icon}
      </div>
      <p
        className={`mt-3 truncate text-lg font-bold tabular-nums sm:mt-4 sm:text-xl ${
          lime ? "text-[#c9ff73]" : "text-white"
        }`}
      >
        {value}
      </p>
      <p className="mt-1 truncate text-xs font-semibold text-[#d6d7e2]">{label}</p>
      <p className="mt-1 hidden text-[10px] text-[#838497] sm:block">{detail}</p>
    </div>
  );
}

export function SectionHeader({
  icon,
  title,
  detail,
}: {
  icon: React.ReactNode;
  title: string;
  detail: string;
}) {
  return (
    <div className="flex gap-3">
      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[#c9ff73]/10 text-[#c9ff73]">
        {icon}
      </div>
      <div>
        <p className="text-sm font-bold text-white">{title}</p>
        <p className="mt-1 text-xs leading-5 text-[#9495a7]">{detail}</p>
      </div>
    </div>
  );
}
