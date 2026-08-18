type NvidiaClaudeFable5CredentialSelection = {
  credential: string;
  slot: number;
  poolSize: number;
};

type NvidiaClaudeFable5Env = Record<string, string | undefined>;

let rotationIndex = 0;

/** Returns only normalized credentials; callers must never log the returned values. */
export function getNvidiaClaudeFable5CredentialPool(env: NvidiaClaudeFable5Env = process.env) {
  return [
    env.NVIDIA_CLAUDE_FABLE5_API_KEY,
    env.NVIDIA_CLAUDE_FABLE5_API_KEY_2,
    env.NVIDIA_CLAUDE_FABLE5_API_KEY_3,
    env.NVIDIA_CLAUDE_FABLE5_API_KEY_4,
    env.NVIDIA_CLAUDE_FABLE5_API_KEY_5,
  ]
    .map(credential => credential?.trim())
    .filter((credential): credential is string => Boolean(credential));
}

export function selectNextNvidiaClaudeFable5CredentialWithSlot(env: NvidiaClaudeFable5Env = process.env): NvidiaClaudeFable5CredentialSelection | null {
  const pool = getNvidiaClaudeFable5CredentialPool(env);
  if (!pool.length) return null;
  const selectedIndex = rotationIndex % pool.length;
  rotationIndex = (selectedIndex + 1) % pool.length;
  return { credential: pool[selectedIndex], slot: selectedIndex, poolSize: pool.length };
}

export function resetNvidiaClaudeFable5CredentialRotation() {
  rotationIndex = 0;
}
