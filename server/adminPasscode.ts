import { timingSafeEqual } from "node:crypto";

function equalConstantTime(received: string, expected: string) {
  const receivedBytes = Buffer.from(received, "utf8");
  const expectedBytes = Buffer.from(expected, "utf8");
  return receivedBytes.length === expectedBytes.length && timingSafeEqual(receivedBytes, expectedBytes);
}

export function verifyAdminPasscode(passcode: string) {
  const configuredPasscode = process.env.TOKENFORGE_ADMIN_PASSCODE?.trim();
  if (!configuredPasscode) return false;
  return equalConstantTime(passcode, configuredPasscode);
}
