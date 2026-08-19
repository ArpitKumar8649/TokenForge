import { beforeEach, describe, expect, it } from "vitest";
import {
  getTokenReplyClaudeOpus5CredentialPool,
  resetTokenReplyClaudeOpus5CredentialRotation,
  selectNextTokenReplyClaudeOpus5CredentialWithSlot,
} from "./tokenReplyClaudeOpus5Credentials";

const rotationEnvironment = {
  OPENCODE_CLAUDE_OPUS5_API_KEY: "credential-one",
  OPENCODE_CLAUDE_OPUS5_API_KEY_2: "credential-two",
  OPENCODE_CLAUDE_OPUS5_API_KEY_3: "credential-three",
  OPENCODE_CLAUDE_OPUS5_API_KEY_4: "credential-four",
  OPENCODE_CLAUDE_OPUS5_API_KEY_5: "credential-five",
  OPENCODE_CLAUDE_OPUS5_API_KEY_6: "credential-six",
  OPENCODE_CLAUDE_OPUS5_API_KEY_7: "credential-seven",
};

describe("TokenReply Claude Opus 5 credential rotation", () => {
  beforeEach(() => resetTokenReplyClaudeOpus5CredentialRotation());

  it("keeps a trimmed server-only pool in configured slot order", () => {
    expect(getTokenReplyClaudeOpus5CredentialPool({ ...rotationEnvironment, OPENCODE_CLAUDE_OPUS5_API_KEY_4: "  " })).toEqual([
      "credential-one",
      "credential-two",
      "credential-three",
      "credential-five",
      "credential-six",
      "credential-seven",
    ]);
  });

  it("cycles every configured credential before repeating", () => {
    expect(Array.from({ length: 8 }, () => selectNextTokenReplyClaudeOpus5CredentialWithSlot(rotationEnvironment))).toEqual([
      { credential: "credential-one", slot: 0, poolSize: 7 },
      { credential: "credential-two", slot: 1, poolSize: 7 },
      { credential: "credential-three", slot: 2, poolSize: 7 },
      { credential: "credential-four", slot: 3, poolSize: 7 },
      { credential: "credential-five", slot: 4, poolSize: 7 },
      { credential: "credential-six", slot: 5, poolSize: 7 },
      { credential: "credential-seven", slot: 6, poolSize: 7 },
      { credential: "credential-one", slot: 0, poolSize: 7 },
    ]);
  });
});
