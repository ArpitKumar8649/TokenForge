import { describe, expect, it, vi } from "vitest";
import type { Request } from "express";

vi.mock("./db", () => ({
  getAuthSessionVersion: vi.fn(),
  getUserByOpenId: vi.fn(),
  upsertUser: vi.fn(),
}));

import * as db from "./db";
import { sdk } from "./_core/sdk";
import { COOKIE_NAME } from "../shared/const";

describe("global TokenForge session revocation", () => {
  it("rejects a session minted before the latest administrator passcode unlock", async () => {
    vi.mocked(db.getAuthSessionVersion).mockResolvedValue(8);
    const earlierSession = await sdk.createSessionToken("tf_local_revocation-test", {
      name: "TokenForge Developer",
      sessionVersion: 7,
      expiresInMs: 60_000,
    });
    const request = { headers: { cookie: `${COOKIE_NAME}=${earlierSession}` } } as Request;

    await expect(sdk.authenticateRequest(request)).rejects.toThrow("Session has been revoked");
    expect(db.getUserByOpenId).not.toHaveBeenCalled();
  });
});
