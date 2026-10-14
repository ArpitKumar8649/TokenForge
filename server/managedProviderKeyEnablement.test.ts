import { describe, expect, it, beforeEach } from "vitest";
import { isManagedProviderCredentialEnabled } from "./db";
import { resetGlm53CredentialRotation, selectNextGlm53CredentialWithSlot } from "./glm53Credentials";

describe("managed provider credential enablement", () => {
  beforeEach(() => resetGlm53CredentialRotation());

  it("treats legacy slots as enabled but honors an explicit administrator disablement", () => {
    expect(isManagedProviderCredentialEnabled({}, 0)).toBe(true);
    expect(isManagedProviderCredentialEnabled({ apiKeyEnabled: [true, false] }, 0)).toBe(true);
    expect(isManagedProviderCredentialEnabled({ apiKeyEnabled: [true, false] }, 1)).toBe(false);
  });

  it("never selects an explicitly disabled GLM credential and preserves the original slot number for telemetry", () => {
    const selection = selectNextGlm53CredentialWithSlot(["first-key", "second-key", "third-key"], [false, true, false]);
    expect(selection).toEqual({ credential: "second-key", slot: 1, poolSize: 1 });
  });
});
