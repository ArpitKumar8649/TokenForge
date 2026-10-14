import React from "react";
import { Sparkles, CheckCircle2, Zap, Brain, Flame, Crown } from "lucide-react";

export type UserTier = "free" | "starter" | "pro" | "max" | "power" | "ultra";

export interface UserTierConfig {
  tier: UserTier;
  label: string;
  tag: string;
  description: string;
  badgeClass: string;
  borderClass: string;
  textClass: string;
  glowClass: string;
  icon: React.ComponentType<{ className?: string; size?: number }>;
}

export const USER_TIER_CONFIGS: Record<UserTier, UserTierConfig> = {
  free: {
    tier: "free",
    label: "Free Tier",
    tag: "Explorer",
    description: "Standard rate quotas & community access",
    badgeClass: "bg-zinc-500/10 border-zinc-500/25 text-zinc-300",
    borderClass: "border-zinc-500/30",
    textClass: "text-zinc-300",
    glowClass: "shadow-zinc-500/5",
    icon: Sparkles,
  },
  starter: {
    tier: "starter",
    label: "Starter Tier",
    tag: "Builder",
    description: "Full Claude Opus 5 access & standard quotas",
    badgeClass: "bg-emerald-500/10 border-emerald-500/30 text-emerald-300",
    borderClass: "border-emerald-500/40",
    textClass: "text-emerald-300",
    glowClass: "shadow-emerald-500/10",
    icon: CheckCircle2,
  },
  pro: {
    tier: "pro",
    label: "Pro Tier",
    tag: "Pro Developer",
    description: "Priority routing & high token throughput",
    badgeClass: "bg-sky-500/10 border-sky-400/35 text-sky-300",
    borderClass: "border-sky-400/45",
    textClass: "text-sky-300",
    glowClass: "shadow-sky-500/10",
    icon: Zap,
  },
  max: {
    tier: "max",
    label: "Max Tier",
    tag: "Frontier Reasoning",
    description: "Unlimited GPT-6 Astra & priority compute cluster",
    badgeClass: "bg-purple-500/15 border-purple-500/40 text-purple-200",
    borderClass: "border-purple-500/50",
    textClass: "text-purple-200",
    glowClass: "shadow-purple-500/20",
    icon: Brain,
  },
  power: {
    tier: "power",
    label: "Power User",
    tag: "Enterprise Scale",
    description: "Unlimited GPT-6 Astra & multi-agent concurrency",
    badgeClass: "bg-amber-500/15 border-amber-500/40 text-amber-200",
    borderClass: "border-amber-500/50",
    textClass: "text-amber-200",
    glowClass: "shadow-amber-500/20",
    icon: Flame,
  },
  ultra: {
    tier: "ultra",
    label: "Ultra Tier",
    tag: "Dedicated Compute",
    description: "Maximum queue priority & uncapped enterprise inference",
    badgeClass: "bg-gradient-to-r from-rose-500/15 via-purple-500/15 to-indigo-500/15 border-rose-500/40 text-rose-200",
    borderClass: "border-rose-500/50",
    textClass: "text-rose-200",
    glowClass: "shadow-rose-500/25",
    icon: Crown,
  },
};

export function normalizeUserTier(tier?: string | null): UserTier {
  if (!tier) return "free";
  const normalized = tier.trim().toLowerCase();
  if (normalized in USER_TIER_CONFIGS) {
    return normalized as UserTier;
  }
  return "free";
}

interface UserTierBadgeProps {
  tier?: string | null;
  size?: "xs" | "sm" | "md" | "lg";
  showTag?: boolean;
  className?: string;
}

export function UserTierBadge({
  tier,
  size = "md",
  showTag = false,
  className = "",
}: UserTierBadgeProps) {
  const normalizedTier = normalizeUserTier(tier);
  const config = USER_TIER_CONFIGS[normalizedTier];
  const IconComponent = config.icon;

  const sizeStyles = {
    xs: {
      wrapper: "px-2 py-0.5 text-[10px] gap-1 rounded-md",
      icon: 11,
      tag: "text-[9px] px-1 py-0.2",
    },
    sm: {
      wrapper: "px-2.5 py-1 text-xs gap-1.5 rounded-lg",
      icon: 13,
      tag: "text-[10px] px-1.5 py-0.5",
    },
    md: {
      wrapper: "px-3 py-1.5 text-xs gap-2 rounded-xl",
      icon: 14,
      tag: "text-[10px] px-2 py-0.5",
    },
    lg: {
      wrapper: "px-4 py-2 text-sm gap-2.5 rounded-2xl",
      icon: 17,
      tag: "text-xs px-2.5 py-1",
    },
  }[size];

  return (
    <div
      className={`inline-flex items-center font-semibold border backdrop-blur-sm shadow-sm transition-all ${config.badgeClass} ${config.glowClass} ${sizeStyles.wrapper} ${className}`}
    >
      <IconComponent size={sizeStyles.icon} className="shrink-0" />
      <span className="font-medium tracking-tight whitespace-nowrap">{config.label}</span>
      {showTag && (
        <span
          className={`uppercase font-bold tracking-wider rounded-full bg-white/10 ${sizeStyles.tag} whitespace-nowrap opacity-90`}
        >
          {config.tag}
        </span>
      )}
    </div>
  );
}
