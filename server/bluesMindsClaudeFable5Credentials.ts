export type BluesMindsClaudeFable5CredentialSelection = {
  credential: string;
  slot: number;
  poolSize: number;
};

type BluesMindsClaudeFable5Env = Record<string, string | undefined>;

let rotationIndex = 0;

/** Returns normalized server-only credentials; callers must never log these values. */
export function getBluesMindsClaudeFable5CredentialPool(env: BluesMindsClaudeFable5Env = process.env) {
  return [
    env.BLUESMINDS_CLAUDE_FABLE5_API_KEY,
    env.BLUESMINDS_CLAUDE_FABLE5_API_KEY_2,
  ]
    .map(credential => credential?.trim())
    .filter((credential): credential is string => Boolean(credential));
}

export function selectNextBluesMindsClaudeFable5CredentialWithSlot(env: BluesMindsClaudeFable5Env = process.env): BluesMindsClaudeFable5CredentialSelection | null {
  const pool = getBluesMindsClaudeFable5CredentialPool(env);
  if (!pool.length) return null;
  const selectedIndex = rotationIndex % pool.length;
  rotationIndex = (selectedIndex + 1) % pool.length;
  return { credential: pool[selectedIndex], slot: selectedIndex, poolSize: pool.length };
}

export function resetBluesMindsClaudeFable5CredentialRotation() {
  rotationIndex = 0;
}
