type Glm53CredentialSelection = {
  credential: string;
  slot: number;
  poolSize: number;
};

let rotationIndex = 0;

/** Select from a normalized server-only GLM 5.3 pool without logging credential material. */
export function selectNextGlm53CredentialWithSlot(credentials: string[], enabled?: readonly boolean[]): Glm53CredentialSelection | null {
  const pool = credentials.flatMap((credential, slot) => {
    const normalized = credential.trim();
    return normalized && enabled?.[slot] !== false ? [{ credential: normalized, slot }] : [];
  });
  if (!pool.length) return null;
  const selectedIndex = rotationIndex % pool.length;
  rotationIndex = (selectedIndex + 1) % pool.length;
  return { credential: pool[selectedIndex]!.credential, slot: pool[selectedIndex]!.slot, poolSize: pool.length };
}

export function resetGlm53CredentialRotation() {
  rotationIndex = 0;
}
