type Glm53CredentialSelection = {
  credential: string;
  slot: number;
  poolSize: number;
};

let rotationIndex = 0;

/** Select from a normalized server-only GLM 5.3 pool without logging credential material. */
export function selectNextGlm53CredentialWithSlot(credentials: string[]): Glm53CredentialSelection | null {
  const pool = credentials.map(credential => credential.trim()).filter(Boolean);
  if (!pool.length) return null;
  const selectedIndex = rotationIndex % pool.length;
  rotationIndex = (selectedIndex + 1) % pool.length;
  return { credential: pool[selectedIndex], slot: selectedIndex, poolSize: pool.length };
}

export function resetGlm53CredentialRotation() {
  rotationIndex = 0;
}
