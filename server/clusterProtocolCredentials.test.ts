import { describe, expect, it, beforeEach } from "vitest";
import { getClusterProtocolCredentialPool, resetClusterProtocolCredentialRotation, selectNextClusterProtocolCredential } from "./clusterProtocolCredentials";

const rotationEnvironment = {
  CLUSTER_PROTOCOL_API_KEY: "credential-one",
  CLUSTER_PROTOCOL_API_KEY_2: "credential-two",
  CLUSTER_PROTOCOL_API_KEY_3: "credential-three",
  CLUSTER_PROTOCOL_API_KEY_4: "credential-four",
  CLUSTER_PROTOCOL_API_KEY_5: "credential-five",
  CLUSTER_PROTOCOL_API_KEY_6: "credential-six",
};

describe("Cluster Protocol credential rotation", () => {
  beforeEach(() => resetClusterProtocolCredentialRotation());

  it("keeps a trimmed server-only credential pool in deterministic primary-to-secondary order", () => {
    expect(getClusterProtocolCredentialPool({ ...rotationEnvironment, CLUSTER_PROTOCOL_API_KEY_2: "  " })).toEqual([
      "credential-one",
      "credential-three",
      "credential-four",
      "credential-five",
      "credential-six",
    ]);
  });

  it("cycles inference credential selection across every configured key before repeating", () => {
    expect([
      selectNextClusterProtocolCredential(rotationEnvironment),
      selectNextClusterProtocolCredential(rotationEnvironment),
      selectNextClusterProtocolCredential(rotationEnvironment),
      selectNextClusterProtocolCredential(rotationEnvironment),
      selectNextClusterProtocolCredential(rotationEnvironment),
      selectNextClusterProtocolCredential(rotationEnvironment),
      selectNextClusterProtocolCredential(rotationEnvironment),
    ]).toEqual([
      "credential-one",
      "credential-two",
      "credential-three",
      "credential-four",
      "credential-five",
      "credential-six",
      "credential-one",
    ]);
  });
});
