import { Claude, DeepSeek, Gemini, Grok, Kimi, Minimax, Mistral, OpenAI, Qwen, XAI, ZAI } from "@lobehub/icons";
import type { ComponentType } from "react";

type ProviderMarkProps = {
  provider: string;
  fallback?: string;
  size?: number;
  className?: string;
};

type LogoComponent = ComponentType<{ size?: number; className?: string; "aria-hidden"?: boolean }>;

const PROVIDER_MARKS: Record<string, LogoComponent> = {
  "Alibaba Cloud": Qwen,
  Anthropic: Claude,
  "Moonshot AI": Kimi,
  "Z.AI": ZAI,
  xAI: Grok ?? XAI,
  Google: Gemini,
  OpenAI,
  DeepSeek,
  "Mistral AI": Mistral,
  MiniMax: Minimax,
};

export function ProviderMark({ provider, fallback = provider.slice(0, 1), size = 18, className }: ProviderMarkProps) {
  const Logo = PROVIDER_MARKS[provider];
  if (!Logo) return <span className={className} aria-hidden="true">{fallback}</span>;
  return <Logo size={size} className={className} aria-hidden={true} />;
}
