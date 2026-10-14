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
    process.env.TOKENROUTER_API_KEY_7 = "tokenrouter-key-seven";
    process.env.TOKENROUTER_API_KEY_8 = "tokenrouter-key-eight";
    process.env.TOKENROUTER_API_KEY_9 = "tokenrouter-key-nine";
    resetTokenRouterCredentialRotation();
  });

  it("round-robins over all nine configured server-only credentials in the interleaved order", () => {
    expect(getTokenRouterCredentialPool()).toHaveLength(9);
    expect(Array.from({ length: 10 }, () => selectNextTokenRouterCredentialWithSlot())).toEqual([
      { credential: "tokenrouter-key-one", slot: 0, poolSize: 9 },
      { credential: "tokenrouter-key-three", slot: 1, poolSize: 9 },
      { credential: "tokenrouter-key-five", slot: 2, poolSize: 9 },
      { credential: "tokenrouter-key-seven", slot: 3, poolSize: 9 },
      { credential: "tokenrouter-key-nine", slot: 4, poolSize: 9 },
      { credential: "tokenrouter-key-two", slot: 5, poolSize: 9 },
      { credential: "tokenrouter-key-four", slot: 6, poolSize: 9 },
      { credential: "tokenrouter-key-six", slot: 7, poolSize: 9 },
      { credential: "tokenrouter-key-eight", slot: 8, poolSize: 9 },
      { credential: "tokenrouter-key-one", slot: 0, poolSize: 9 },
    ]);
  });
});
