type ProviderMarkProps = {
  provider: string;
  fallback?: string;
  size?: number;
  className?: string;
};

const OFFICIAL_MARKS: Partial<Record<string, string>> = {
  OpenAI: "/marks/openai.svg",
  "Alibaba Cloud": "/marks/alibabacloud.svg",
  Qwen: "/marks/alibabacloud.svg",
  Anthropic: "/marks/anthropic.svg",
  Claude: "/marks/anthropic.svg",
  Google: "/marks/google.svg",
  "Z.AI": "/marks/zai.svg",
  "Mistral AI": "/marks/mistralai.svg",
  xAI: "/marks/xai.png",
};

const PROVIDER_MONOGRAMS: Record<string, string> = {
  "Z.AI": "GLM",
};

export function ProviderMark({ provider, fallback = provider.slice(0, 1), size = 18, className }: ProviderMarkProps) {
  const image = OFFICIAL_MARKS[provider];
  if (image) {
    return <img src={image} width={size} height={size} className={className} alt="" aria-hidden="true" decoding="async" style={{ objectFit: "contain", flex: "0 0 auto" }} />;
  }

  return (
    <span className={className} style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: size, height: size, color: "currentColor", fontSize: Math.max(8, Math.floor(size * 0.5)), fontWeight: 800, letterSpacing: "-0.06em", lineHeight: 1 }} aria-hidden="true">
      {PROVIDER_MONOGRAMS[provider] ?? fallback}
    </span>
  );
}
