import type { Request, Response, NextFunction } from "express";

/**
 * Validates whether an incoming HTTP Origin header is authorized.
 * - Non-browser or same-origin requests (no Origin header) are allowed.
 * - Explicit "null" origins (sandboxed iframes, opaque contexts) are blocked.
 * - Origins matching the request Host or explicitly configured APP_URL are allowed.
 * - Localhost and loopback IPs are allowed for local development.
 */
export function isAllowedOrigin(origin: string | undefined, req: Request): boolean {
  if (!origin) return true;
  if (origin === "null") return false;

  try {
    const originUrl = new URL(origin);
    const originHost = originUrl.host.toLowerCase();

    // 1. Compare strictly against authoritative request host (never untrusted X-Forwarded-Host)
    const reqHost = (req.headers.host || "")
      .toString()
      .toLowerCase()
      .split(",")[0]
      .trim();

    if (reqHost && originHost === reqHost) {
      return true;
    }

    // 2. Allow local loopback development
    if (
      originUrl.hostname === "localhost" ||
      originUrl.hostname === "127.0.0.1" ||
      originUrl.hostname === "::1"
    ) {
      return true;
    }

    // 3. Match explicitly declared canonical application URLs in environment
    const allowedEnvUrls = [
      process.env.APP_URL,
      process.env.VITE_APP_URL,
      process.env.BASE_URL,
    ].filter(Boolean) as string[];

    for (const urlStr of allowedEnvUrls) {
      try {
        const u = new URL(urlStr);
        if (originHost === u.host.toLowerCase()) {
          return true;
        }
      } catch {}
    }

    return false;
  } catch {
    return false;
  }
}

/**
 * Strict CORS middleware that rejects unverified cross-origin domains and "null" origins.
 */
export function createStrictCors(options: { allowCredentials?: boolean } = {}) {
  return (req: Request, res: Response, next: NextFunction) => {
    const origin = req.headers.origin;

    if (!origin) {
      return next();
    }

    if (!isAllowedOrigin(origin, req)) {
      if (req.method === "OPTIONS") {
        return res.status(403).json({ error: "CORS origin rejected" });
      }
      return res.status(403).json({ error: "CORS origin rejected" });
    }

    res.setHeader("Access-Control-Allow-Origin", origin);
    if (options.allowCredentials) {
      res.setHeader("Access-Control-Allow-Credentials", "true");
    }
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader(
      "Access-Control-Allow-Headers",
      "Content-Type, Authorization, x-request-id"
    );

    if (req.method === "OPTIONS") {
      return res.status(204).end();
    }

    next();
  };
}
