import type { CookieOptions, Request } from "express";
import { COOKIE_NAME } from "@shared/const";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

function isIpAddress(host: string) {
  // Basic IPv4 check and IPv6 presence detection.
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return true;
  return host.includes(":");
}

function isSecureRequest(req: Request) {
  if (req.protocol === "https") return true;

  const forwardedProto = req.headers["x-forwarded-proto"];
  if (!forwardedProto) return false;

  const protoList = Array.isArray(forwardedProto)
    ? forwardedProto
    : forwardedProto.split(",");

  return protoList.some(proto => proto.trim().toLowerCase() === "https");
}

export type SessionCookieOptions = Pick<
  CookieOptions,
  "domain" | "httpOnly" | "path" | "sameSite" | "secure"
>;

/**
 * Canonical cookie options used for both setting and clearing session cookies.
 * Keeping these options in this shared helper guarantees that res.clearCookie
 * matches the exact path, domain, secure, sameSite, and httpOnly flags.
 */
export function getSessionCookieOptions(
  req: Request
): SessionCookieOptions {
  return {
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    secure: isSecureRequest(req),
  };
}

/**
 * Clear the session cookie using identical options to the setting procedure.
 */
export function clearSessionCookie(req: Request, res: { clearCookie: (name: string, options: CookieOptions) => void }): void {
  const options = getSessionCookieOptions(req);
  res.clearCookie(COOKIE_NAME, {
    ...options,
    maxAge: -1,
  });
}

