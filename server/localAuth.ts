import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback);
const KEY_LENGTH = 64;
const SCRYPT_N = 16_384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;

export const PASSWORD_MIN_LENGTH = 12;
export const LOGIN_FAILURE_LIMIT = 5;
export const LOGIN_FAILURE_WINDOW_MS = 15 * 60 * 1000;
export const LOGIN_BLOCK_MS = 15 * 60 * 1000;

export type LoginAttemptState = {
  failureCount: number;
  windowStartedAt: Date;
  blockedUntil: Date | null;
};

export function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("base64url");
  const derived = await scrypt(password, salt, KEY_LENGTH) as Buffer;
  return `scrypt$${SCRYPT_N}$${SCRYPT_R}$${SCRYPT_P}$${salt}$${derived.toString("base64url")}`;
}

export async function verifyPassword(password: string, storedHash: string) {
  const [algorithm, nRaw, rRaw, pRaw, salt, expected] = storedHash.split("$");
  const N = Number(nRaw);
  const r = Number(rRaw);
  const p = Number(pRaw);
  if (algorithm !== "scrypt" || !salt || !expected || !Number.isSafeInteger(N) || !Number.isSafeInteger(r) || !Number.isSafeInteger(p)) return false;
  try {
    const candidate = await scrypt(password, salt, KEY_LENGTH) as Buffer;
    const expectedBuffer = Buffer.from(expected, "base64url");
    return expectedBuffer.length === candidate.length && timingSafeEqual(expectedBuffer, candidate);
  } catch {
    return false;
  }
}

export function nextFailedLoginState(previous: LoginAttemptState | null, now = new Date()): LoginAttemptState {
  if (previous?.blockedUntil && previous.blockedUntil > now) return previous;
  const startsNewWindow = !previous || now.getTime() - previous.windowStartedAt.getTime() >= LOGIN_FAILURE_WINDOW_MS;
  const failureCount = startsNewWindow ? 1 : previous.failureCount + 1;
  const windowStartedAt = startsNewWindow ? now : previous.windowStartedAt;
  return {
    failureCount,
    windowStartedAt,
    blockedUntil: failureCount >= LOGIN_FAILURE_LIMIT ? new Date(now.getTime() + LOGIN_BLOCK_MS) : null,
  };
}

export function retryAfterSeconds(blockedUntil: Date | null, now = new Date()) {
  return blockedUntil ? Math.max(0, Math.ceil((blockedUntil.getTime() - now.getTime()) / 1000)) : 0;
}
