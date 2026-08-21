import { beforeEach, describe, expect, it } from "vitest";
import { getNvidiaClaudeFable5CredentialPool, resetNvidiaClaudeFable5CredentialRotation, selectNextNvidiaClaudeFable5CredentialWithSlot } from "./nvidiaClaudeFable5Credentials";

const rotationEnvironment = {
  NVIDIA_CLAUDE_FABLE5_API_KEY: "credential-one",
  NVIDIA_CLAUDE_FABLE5_API_KEY_2: "credential-two",
  NVIDIA_CLAUDE_FABLE5_API_KEY_3: "credential-three",
  NVIDIA_CLAUDE_FABLE5_API_KEY_4: "credential-four",
  NVIDIA_CLAUDE_FABLE5_API_KEY_5: "credential-five",
};

describe("NVIDIA Claude Fable 5 credential rotation", () => {
  beforeEach(() => resetNvidiaClaudeFable5CredentialRotation());

  it("keeps a trimmed server-only pool in configured slot order", () => {
    expect(getNvidiaClaudeFable5CredentialPool({ ...rotationEnvironment, NVIDIA_CLAUDE_FABLE5_API_KEY_3: "  " })).toEqual([
      "credential-one",
      "credential-two",
      "credential-four",
      "credential-five",
    ]);
  });

  it("cycles every configured credential before repeating", () => {
    expect(Array.from({ length: 6 }, () => selectNextNvidiaClaudeFable5CredentialWithSlot(rotationEnvironment))).toEqual([
      { credential: "credential-one", slot: 0, poolSize: 5 },
      { credential: "credential-two", slot: 1, poolSize: 5 },
      { credential: "credential-three", slot: 2, poolSize: 5 },
      { credential: "credential-four", slot: 3, poolSize: 5 },
      { credential: "credential-five", slot: 4, poolSize: 5 },
      { credential: "credential-one", slot: 0, poolSize: 5 },
    ]);
  });

  it("rotates only the remaining runtime credentials after an administrator removes slots", () => {
    expect(Array.from({ length: 4 }, () => selectNextNvidiaClaudeFable5CredentialWithSlot([
      "credential-two",
      "credential-five",
    ]))).toEqual([
      { credential: "credential-two", slot: 0, poolSize: 2 },
      { credential: "credential-five", slot: 1, poolSize: 2 },
      { credential: "credential-two", slot: 0, poolSize: 2 },
      { credential: "credential-five", slot: 1, poolSize: 2 },
    ]);
  });
});
