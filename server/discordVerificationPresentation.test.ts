import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const verificationPage = readFileSync(path.resolve(import.meta.dirname, "../client/src/pages/DiscordVerify.tsx"), "utf8");
const administratorPage = readFileSync(path.resolve(import.meta.dirname, "../client/src/pages/AdminDashboard.tsx"), "utf8");

describe("Discord verification and administrator entry presentation", () => {
  it("keeps one clear Discord connect-and-verify action without a redundant invite button", () => {
    expect(verificationPage).toContain("Connect Discord &amp; verify membership");
    expect(verificationPage).not.toContain("Join TokenForge Discord");
    expect(verificationPage).not.toContain("ExternalLink");
  });

  it("renders the passcode unlock surface independently of a TokenForge user session", () => {
    expect(administratorPage).toContain("Administrator access is independent of a TokenForge developer account");
    expect(administratorPage).toContain("if (!isAdminSession)");
    expect(administratorPage).toContain("Unlock administrator access");
  });
});
