type CredentialEnvironment = {
  FXQIDIAN_API_KEY?: string;
  FXQIDIAN_API_KEY_2?: string;
};

let nextFxqidianCredentialIndex = 0;

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
  const credentialPool = getFxqidianCredentialPool(environment);
  if (credentialPool.length === 0) return null;
  const selectedCredential = credentialPool[nextFxqidianCredentialIndex % credentialPool.length];
  nextFxqidianCredentialIndex = (nextFxqidianCredentialIndex + 1) % credentialPool.length;
  return selectedCredential;
}

export function resetFxqidianCredentialRotation() {
  nextFxqidianCredentialIndex = 0;
}
