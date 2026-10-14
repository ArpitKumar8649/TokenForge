import { describe, expect, it } from "vitest";
import { verifyAdminPasscode } from "./adminPasscode";

describe("configured admin passcode", () => {
  it("accepts the supplied server-only passcode and rejects a different value", () => {
    const configuredPasscode = process.env.TOKENFORGE_ADMIN_PASSCODE;
    expect(configuredPasscode).toBeTruthy();
    expect(verifyAdminPasscode(configuredPasscode!)).toBe(true);
    expect(verifyAdminPasscode(`${configuredPasscode}x`)).toBe(false);
  });
});
