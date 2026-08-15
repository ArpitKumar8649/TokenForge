import { describe, expect, it } from "vitest";
import { getFxqidianCredentialPool, resetFxqidianCredentialRotation, selectNextFxqidianCredential } from "./fxqidianCredentials";

describe("FXQidian credential pool", () => {
  it("keeps valid configured credentials and alternates in deterministic order", () => {
    const environment = { FXQIDIAN_API_KEY: "primary", FXQIDIAN_API_KEY_2: "secondary" };
    resetFxqidianCredentialRotation();

    expect(getFxqidianCredentialPool(environment)).toEqual(["primary", "secondary"]);
    expect(selectNextFxqidianCredential(environment)).toBe("primary");
    expect(selectNextFxqidianCredential(environment)).toBe("secondary");
    expect(selectNextFxqidianCredential(environment)).toBe("primary");
  });

  it("continues safely with only the primary credential configured", () => {
    resetFxqidianCredentialRotation();
    expect(selectNextFxqidianCredential({ FXQIDIAN_API_KEY: "primary" })).toBe("primary");
  });
});
