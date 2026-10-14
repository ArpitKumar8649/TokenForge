import rateLimit from "express-rate-limit";
import type { Request, Response } from "express";

/**
 * 1. Order Creation Rate Limiter (Payment Rails: Solana & UPI)
 * Strictly enforces a 10 requests/minute ceiling per IP to prevent
 * cryptographic keypair spam, order ID exhaustion, and database write flood.
 */
export const orderCreationRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  limit: 10, // 10 requests per minute
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: {
    error: "Order creation rate limit exceeded (maximum 10 orders per minute). Please slow down and try again shortly.",
    type: "rate_limit_exceeded",
  },
});

/**
 * 2. Solana Spot Price Rate Limiter
 * Throttles live price checks to 30 requests/minute to prevent Binance/CoinGecko IP bans.
 */
export const solanaPriceRateLimit = rateLimit({
  windowMs: 60 * 1000,
  limit: 30,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: {
    error: "Price check rate limit exceeded. Please wait a moment before querying again.",
    type: "rate_limit_exceeded",
  },
});

/**
 * 3. tRPC API Rate Limiter
 * Throttles browser/app UI procedure dispatches to 1200 requests/minute per IP
 * allowing rich real-time SPA dashboards, polling, and batch dispatches.
 */
export const trpcRateLimit = rateLimit({
  windowMs: 60 * 1000,
  limit: 1200,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  handler: (_req: Request, res: Response) => {
    res.status(429).json([
      {
        error: {
          message: "Too many requests to TokenForge services from this IP. Please slow down.",
          code: -32029,
          data: { httpStatus: 429 },
        },
      },
    ]);
  },
});

/**
 * 4. Inference Gateway IP Rate Limiter (/v1/chat/completions & /v1/messages)
 * Drops rapid-fire Layer 7 floods (e.g. 60 requests/minute per IP) before
 * touching backend compute or databases.
 */
export const inferenceIpRateLimit = rateLimit({
  windowMs: 60 * 1000,
  limit: 60,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  handler: (req: Request, res: Response) => {
    const isAnthropic = req.path.startsWith("/v1/messages");
    if (isAnthropic) {
      return res.status(429).json({
        type: "error",
        error: {
          type: "rate_limit_error",
          message: "IP rate limit exceeded (maximum 60 requests per minute). Please slow down.",
        },
      });
    }
    return res.status(429).json({
      error: {
        message: "IP rate limit exceeded (maximum 60 requests per minute). Please slow down.",
        type: "rate_limit_exceeded",
        param: null,
        code: "rate_limit_exceeded",
      },
    });
  },
});

/**
 * 5. Global Baseline IP Rate Limiter
 * Broad protective umbrella across all incoming requests (2400 requests/minute),
 * skipping local static assets, images, Vite dev modules, and dedicated tRPC/health endpoints.
 */
export const globalIpRateLimit = rateLimit({
  windowMs: 60 * 1000,
  limit: 2400,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  skip: (req: Request) => {
    const p = req.path;
    return (
      p.startsWith("/assets") ||
      p.startsWith("/@") ||
      p.startsWith("/src") ||
      p.startsWith("/node_modules") ||
      p.startsWith("/api/trpc") ||
      p === "/favicon.ico" ||
      p === "/robots.txt" ||
      p === "/api/health"
    );
  },
  message: {
    error: "Too many requests from this IP. Please slow down.",
    type: "rate_limit_exceeded",
  },
});

/**
 * 6. Per-Account / Per-User Rate Limiter
 * Critical defense: Even if an attacker rotates their IP via proxies or VPNs,
 * any requests authenticated with their TokenForge account or API key will be
 * throttled per user account (default 60 requests/minute).
 */
interface AccountRateState {
  timestamps: number[];
}

const ACCOUNT_RATE_WINDOW_MS = 60_000;
export const DEFAULT_ACCOUNT_RATE_LIMIT = 60; // 60 requests per minute per account

const accountRateMap = new Map<number, AccountRateState>();

export function checkAccountRateLimit(
  userId: number,
  limit = DEFAULT_ACCOUNT_RATE_LIMIT
): { allowed: boolean; limit: number; remaining: number; retryAfterSeconds: number } {
  const now = Date.now();
  let state = accountRateMap.get(userId);
  if (!state) {
    state = { timestamps: [] };
    accountRateMap.set(userId, state);
  }

  // Purge timestamps outside rolling window
  state.timestamps = state.timestamps.filter((t) => now - t < ACCOUNT_RATE_WINDOW_MS);

  if (state.timestamps.length >= limit) {
    const oldest = state.timestamps[0] ?? now;
    const retryAfterSeconds = Math.max(1, Math.ceil((ACCOUNT_RATE_WINDOW_MS - (now - oldest)) / 1000));
    return {
      allowed: false,
      limit,
      remaining: 0,
      retryAfterSeconds,
    };
  }

  state.timestamps.push(now);
  return {
    allowed: true,
    limit,
    remaining: limit - state.timestamps.length,
    retryAfterSeconds: 0,
  };
}

export function resetAccountRateLimit(userId?: number) {
  if (typeof userId === "number") {
    accountRateMap.delete(userId);
  } else {
    accountRateMap.clear();
  }
}
