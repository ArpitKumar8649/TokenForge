import { beforeEach, describe, expect, it } from "vitest";
import { getTokenRouterCredentialPool, resetTokenRouterCredentialRotation, selectNextTokenRouterCredentialWithSlot } from "./tokenRouterCredentials";

describe("TokenRouter credential pool", () => {
  beforeEach(() => {
    process.env.TOKENROUTER_API_KEY = "tokenrouter-key-one";
    process.env.TOKENROUTER_API_KEY_2 = "tokenrouter-key-two";
    process.env.TOKENROUTER_API_KEY_3 = "tokenrouter-key-three";
    process.env.TOKENROUTER_API_KEY_4 = "tokenrouter-key-four";
    resetTokenRouterCredentialRotation();
  });

  it("round-robins over all four configured server-only credentials", () => {
    expect(getTokenRouterCredentialPool()).toHaveLength(4);
    expect([selectNextTokenRouterCredentialWithSlot(), selectNextTokenRouterCredentialWithSlot(), selectNextTokenRouterCredentialWithSlot(), selectNextTokenRouterCredentialWithSlot(), selectNextTokenRouterCredentialWithSlot()]).toEqual([
      { credential: "tokenrouter-key-one", slot: 0, poolSize: 4 },
      { credential: "tokenrouter-key-two", slot: 1, poolSize: 4 },
      { credential: "tokenrouter-key-three", slot: 2, poolSize: 4 },
      { credential: "tokenrouter-key-four", slot: 3, poolSize: 4 },
      { credential: "tokenrouter-key-one", slot: 0, poolSize: 4 },
    ]);
  });
});
