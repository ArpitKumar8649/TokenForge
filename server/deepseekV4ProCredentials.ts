type DeepseekV4ProCredentialSelection = {
  credential: string;
  slot: number;
  poolSize: number;
};

let rotationIndex = 0;

/** Select from a normalized server-only DeepSeek V4 Pro pool without logging credential material. */
export function selectNextDeepseekV4ProCredentialWithSlot(credentials: string[]): DeepseekV4ProCredentialSelection | null {
  const pool = credentials.map(credential => credential.trim()).filter(Boolean);
  if (!pool.length) return null;
  const selectedIndex = rotationIndex % pool.length;
  rotationIndex = (selectedIndex + 1) % pool.length;
  return { credential: pool[selectedIndex], slot: selectedIndex, poolSize: pool.length };
}

export function resetDeepseekV4ProCredentialRotation() {
  rotationIndex = 0;
}
