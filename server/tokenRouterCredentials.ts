type TokenRouterCredentialSelection = {
  credential: string;
  slot: number;
  poolSize: number;
};

let rotationIndex = 0;

export function getTokenRouterCredentialPool() {
  return [
    process.env.TOKENROUTER_API_KEY,
    process.env.TOKENROUTER_API_KEY_3,
    process.env.TOKENROUTER_API_KEY_5,
    process.env.TOKENROUTER_API_KEY_7,
    process.env.TOKENROUTER_API_KEY_9,
    process.env.TOKENROUTER_API_KEY_2,
    process.env.TOKENROUTER_API_KEY_4,
    process.env.TOKENROUTER_API_KEY_6,
    process.env.TOKENROUTER_API_KEY_8,
  ]
    .map(credential => credential?.trim())
    .filter((credential): credential is string => Boolean(credential));
}

export function selectNextTokenRouterCredentialWithSlot(): TokenRouterCredentialSelection | null {
  const pool = getTokenRouterCredentialPool();
  if (!pool.length) return null;
  const selectedIndex = rotationIndex % pool.length;
  const credential = pool[selectedIndex];
  rotationIndex = (selectedIndex + 1) % pool.length;
  return { credential, slot: selectedIndex, poolSize: pool.length };
}

export function resetTokenRouterCredentialRotation() {
  rotationIndex = 0;
}
