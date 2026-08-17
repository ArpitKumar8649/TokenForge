import { beforeEach, describe, expect, it } from "vitest";
import { getTokenRouterCredentialPool, resetTokenRouterCredentialRotation, selectNextTokenRouterCredentialWithSlot } from "./tokenRouterCredentials";

describe("TokenRouter credential pool", () => {
  beforeEach(() => {
    process.env.TOKENROUTER_API_KEY = "tokenrouter-key-one";
    process.env.TOKENROUTER_API_KEY_2 = "tokenrouter-key-two";
    process.env.TOKENROUTER_API_KEY_3 = "tokenrouter-key-three";
    process.env.TOKENROUTER_API_KEY_4 = "tokenrouter-key-four";
    process.env.TOKENROUTER_API_KEY_5 = "tokenrouter-key-five";
    process.env.TOKENROUTER_API_KEY_6 = "tokenrouter-key-six";
    resetTokenRouterCredentialRotation();
  });

  it("round-robins over all six configured server-only credentials", () => {
    expect(getTokenRouterCredentialPool()).toHaveLength(6);
    expect([selectNextTokenRouterCredentialWithSlot(), selectNextTokenRouterCredentialWithSlot(), selectNextTokenRouterCredentialWithSlot(), selectNextTokenRouterCredentialWithSlot(), selectNextTokenRouterCredentialWithSlot(), selectNextTokenRouterCredentialWithSlot(), selectNextTokenRouterCredentialWithSlot()]).toEqual([
      { credential: "tokenrouter-key-one", slot: 0, poolSize: 6 },
      { credential: "tokenrouter-key-two", slot: 1, poolSize: 6 },
      { credential: "tokenrouter-key-three", slot: 2, poolSize: 6 },
      { credential: "tokenrouter-key-four", slot: 3, poolSize: 6 },
      { credential: "tokenrouter-key-five", slot: 4, poolSize: 6 },
      { credential: "tokenrouter-key-six", slot: 5, poolSize: 6 },
      { credential: "tokenrouter-key-one", slot: 0, poolSize: 6 },
    ]);
  });
});
