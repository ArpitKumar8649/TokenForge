import { describe, expect, it, beforeEach } from "vitest";
import { resetDeepseekV4ProCredentialRotation, selectNextDeepseekV4ProCredentialWithSlot } from "./deepseekV4ProCredentials";
import { resetGlm53CredentialRotation, selectNextGlm53CredentialWithSlot } from "./glm53Credentials";

describe("managed GLM and DeepSeek credential pools", () => {
  beforeEach(() => {
    resetGlm53CredentialRotation();
    resetDeepseekV4ProCredentialRotation();
  });

  it("round-robins GLM 5.3 through only normalized active keys and wraps to the first key", () => {
    const pool = [" glm-key-1 ", "", "glm-key-2"];
    expect(selectNextGlm53CredentialWithSlot(pool)).toMatchObject({ credential: "glm-key-1", slot: 0, poolSize: 2 });
    expect(selectNextGlm53CredentialWithSlot(pool)).toMatchObject({ credential: "glm-key-2", slot: 1, poolSize: 2 });
    expect(selectNextGlm53CredentialWithSlot(pool)).toMatchObject({ credential: "glm-key-1", slot: 0, poolSize: 2 });
    expect(selectNextGlm53CredentialWithSlot([])).toBeNull();
  });

  it("round-robins DeepSeek V4 Pro through its independent active-key pool", () => {
    const pool = ["deepseek-key-1", "deepseek-key-2", "deepseek-key-3"];
    expect(selectNextDeepseekV4ProCredentialWithSlot(pool)).toMatchObject({ credential: "deepseek-key-1", slot: 0, poolSize: 3 });
    expect(selectNextDeepseekV4ProCredentialWithSlot(pool)).toMatchObject({ credential: "deepseek-key-2", slot: 1, poolSize: 3 });
    expect(selectNextDeepseekV4ProCredentialWithSlot(pool)).toMatchObject({ credential: "deepseek-key-3", slot: 2, poolSize: 3 });
    expect(selectNextDeepseekV4ProCredentialWithSlot(pool)).toMatchObject({ credential: "deepseek-key-1", slot: 0, poolSize: 3 });
  });
});
