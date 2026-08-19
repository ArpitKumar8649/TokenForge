import { beforeEach, describe, expect, it } from "vitest";
import { getBluesMindsClaudeFable5CredentialPool, resetBluesMindsClaudeFable5CredentialRotation, selectNextBluesMindsClaudeFable5CredentialWithSlot } from "./bluesMindsClaudeFable5Credentials";

const rotationEnvironment = {
  BLUESMINDS_CLAUDE_FABLE5_API_KEY: "credential-one",
  BLUESMINDS_CLAUDE_FABLE5_API_KEY_2: "credential-two",
};

describe("BluesMinds Claude Fable 5 credential rotation", () => {
  beforeEach(() => resetBluesMindsClaudeFable5CredentialRotation());

  it("keeps a trimmed server-only pool in configured slot order", () => {
    expect(getBluesMindsClaudeFable5CredentialPool({ ...rotationEnvironment, BLUESMINDS_CLAUDE_FABLE5_API_KEY_2: "  " })).toEqual(["credential-one"]);
  });

  it("cycles both configured credentials before repeating", () => {
    expect(Array.from({ length: 5 }, () => selectNextBluesMindsClaudeFable5CredentialWithSlot(rotationEnvironment))).toEqual([
      { credential: "credential-one", slot: 0, poolSize: 2 },
      { credential: "credential-two", slot: 1, poolSize: 2 },
      { credential: "credential-one", slot: 0, poolSize: 2 },
      { credential: "credential-two", slot: 1, poolSize: 2 },
      { credential: "credential-one", slot: 0, poolSize: 2 },
    ]);
  });
});
