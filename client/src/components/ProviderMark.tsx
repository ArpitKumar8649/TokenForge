type ProviderMarkProps = {
  provider: string;
  fallback?: string;
  size?: number;
  className?: string;
};

const OFFICIAL_MARKS: Partial<Record<string, string>> = {
  "Alibaba Cloud": "/manus-storage/qwen-official-mark_6d32eee6.png",
  "Moonshot AI": "/manus-storage/kimi-official-mark_f3ab99a3.png",
  Anthropic: "/manus-storage/anthropic_21a2c9bb.svg",
  Google: "/manus-storage/google_8bc26cff.svg",
  DeepSeek: "/manus-storage/deepseek_3213d99a.svg",
};

const PROVIDER_MONOGRAMS: Record<string, string> = {
  "Z.AI": "GLM",
  xAI: "G",
  OpenAI: "O",
  "Mistral AI": "M",
  MiniMax: "MM",
};

export function ProviderMark({ provider, fallback = provider.slice(0, 1), size = 18, className }: ProviderMarkProps) {
  const image = OFFICIAL_MARKS[provider];
  if (image) {
    return <img src={image} width={size} height={size} className={className} alt="" aria-hidden="true" />;
  }

  return (
    <span className={className} style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: size, height: size, color: "currentColor", fontSize: Math.max(8, Math.floor(size * 0.5)), fontWeight: 800, letterSpacing: "-0.06em", lineHeight: 1 }} aria-hidden="true">
      {PROVIDER_MONOGRAMS[provider] ?? fallback}
    </span>
  );
}
