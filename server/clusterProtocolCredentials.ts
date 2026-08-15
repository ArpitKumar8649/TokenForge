type CredentialEnvironment = {
  CLUSTER_PROTOCOL_API_KEY?: string;
  CLUSTER_PROTOCOL_API_KEY_2?: string;
  CLUSTER_PROTOCOL_API_KEY_3?: string;
};

let nextClusterProtocolCredentialIndex = 0;

export type ClusterProtocolCredentialSelection = { credential: string; slot: number; poolSize: number };

function runtimeCredentialEnvironment(): CredentialEnvironment {
  return {
    CLUSTER_PROTOCOL_API_KEY: process.env["CLUSTER_PROTOCOL_API_KEY"],
    CLUSTER_PROTOCOL_API_KEY_2: process.env["CLUSTER_PROTOCOL_API_KEY_2"],
    CLUSTER_PROTOCOL_API_KEY_3: process.env["CLUSTER_PROTOCOL_API_KEY_3"],
  };
}

export function getClusterProtocolCredentialPool(environment: CredentialEnvironment = runtimeCredentialEnvironment()) {
  return [
    environment.CLUSTER_PROTOCOL_API_KEY,
    environment.CLUSTER_PROTOCOL_API_KEY_2,
    environment.CLUSTER_PROTOCOL_API_KEY_3,
  ].filter((credential): credential is string => Boolean(credential?.trim()));
}

export function selectNextClusterProtocolCredential(environment: CredentialEnvironment = runtimeCredentialEnvironment()) {
  return selectNextClusterProtocolCredentialWithSlot(environment)?.credential ?? null;
}

export function selectNextClusterProtocolCredentialWithSlot(environment: CredentialEnvironment = runtimeCredentialEnvironment()): ClusterProtocolCredentialSelection | null {
  const credentialPool = getClusterProtocolCredentialPool(environment);
  if (credentialPool.length === 0) return null;
  const slot = nextClusterProtocolCredentialIndex % credentialPool.length;
  const selectedCredential = credentialPool[slot];
  nextClusterProtocolCredentialIndex = (nextClusterProtocolCredentialIndex + 1) % credentialPool.length;
  return { credential: selectedCredential, slot, poolSize: credentialPool.length };
}

export function resetClusterProtocolCredentialRotation() {
  nextClusterProtocolCredentialIndex = 0;
}
