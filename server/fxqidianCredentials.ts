type CredentialEnvironment = {
  FXQIDIAN_API_KEY?: string;
  FXQIDIAN_API_KEY_2?: string;
};

let nextFxqidianCredentialIndex = 0;

export type FxqidianCredentialSelection = { credential: string; slot: number; poolSize: number };

function runtimeCredentialEnvironment(): CredentialEnvironment {
  return {
    FXQIDIAN_API_KEY: process.env["FXQIDIAN_API_KEY"],
    FXQIDIAN_API_KEY_2: process.env["FXQIDIAN_API_KEY_2"],
  };
}

export function getFxqidianCredentialPool(environment: CredentialEnvironment = runtimeCredentialEnvironment()) {
  return [environment.FXQIDIAN_API_KEY, environment.FXQIDIAN_API_KEY_2]
    .filter((credential): credential is string => Boolean(credential?.trim()));
}

export function selectNextFxqidianCredential(environment: CredentialEnvironment = runtimeCredentialEnvironment()) {
  return selectNextFxqidianCredentialWithSlot(environment)?.credential ?? null;
}

export function selectNextFxqidianCredentialWithSlot(environment: CredentialEnvironment = runtimeCredentialEnvironment()): FxqidianCredentialSelection | null {
  const credentialPool = getFxqidianCredentialPool(environment);
  if (credentialPool.length === 0) return null;
  const slot = nextFxqidianCredentialIndex % credentialPool.length;
  const selectedCredential = credentialPool[slot];
  nextFxqidianCredentialIndex = (nextFxqidianCredentialIndex + 1) % credentialPool.length;
  return { credential: selectedCredential, slot, poolSize: credentialPool.length };
}

export function resetFxqidianCredentialRotation() {
  nextFxqidianCredentialIndex = 0;
}
