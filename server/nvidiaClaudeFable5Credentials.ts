type NvidiaClaudeFable5CredentialSelection = {
  credential: string;
  slot: number;
  poolSize: number;
};

type NvidiaClaudeFable5Env = Record<string, string | undefined>;
type NvidiaClaudeFable5CredentialSource = NvidiaClaudeFable5Env | string[];

let rotationIndex = 0;

/** Returns only normalized credentials; callers must never log the returned values. */
export function getNvidiaClaudeFable5CredentialPool(source: NvidiaClaudeFable5CredentialSource = process.env) {
  const credentials = Array.isArray(source) ? source : [
    source.NVIDIA_CLAUDE_FABLE5_API_KEY,
    source.NVIDIA_CLAUDE_FABLE5_API_KEY_2,
    source.NVIDIA_CLAUDE_FABLE5_API_KEY_3,
    source.NVIDIA_CLAUDE_FABLE5_API_KEY_4,
    source.NVIDIA_CLAUDE_FABLE5_API_KEY_5,
  ];
  return credentials
    .map(credential => credential?.trim())
    .filter((credential): credential is string => Boolean(credential));
}

export function selectNextNvidiaClaudeFable5CredentialWithSlot(source: NvidiaClaudeFable5CredentialSource = process.env): NvidiaClaudeFable5CredentialSelection | null {
  const pool = getNvidiaClaudeFable5CredentialPool(source);
  if (!pool.length) return null;
  const selectedIndex = rotationIndex % pool.length;
  rotationIndex = (selectedIndex + 1) % pool.length;
  return { credential: pool[selectedIndex], slot: selectedIndex, poolSize: pool.length };
}

export function resetNvidiaClaudeFable5CredentialRotation() {
  rotationIndex = 0;
}
