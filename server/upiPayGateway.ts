import type { Express, Request, Response } from "express";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { creditAccountFromUPIPay, getDb } from "./db";
import { sql } from "drizzle-orm";
import { sdk } from "./_core/sdk";
import { createStrictCors } from "./_core/cors";
import { UPI_TIERS, CODING_PLAN_TIERS, getCodingPlanTier, USD_TO_INR_RATE, UPI_INTERNAL_SURCHARGE_USD, UPI_INTERNAL_SURCHARGE_INR } from "../shared/paymentTiers";

export interface UPIOrder {
  orderId: string;
  userId: number | null;
  userEmail?: string | null;
  userName?: string | null;
  tierId: string;
  amountInr: number;
  amountUsd?: number;
  isPayg?: boolean;
  isCodingPlan?: boolean;
  codingTokens?: number;
  planName?: string;
  credits: number;
  creditsNanos: number;
  upiId: string;
  merchantName: string;
  upiUri: string;
  status: "PENDING_PAYMENT" | "PENDING_VERIFICATION" | "COMPLETED" | "REJECTED" | "EXPIRED";
  utr: string | null;
  submittedAt: string | null;
  verifiedAt: string | null;
  verifiedBy: string | null;
  rejectionReason: string | null;
  createdAt: string;
  expiresAt: string;
}

// In-memory cache synced with persistent database
const upiOrders = new Map<string, UPIOrder>();
const processedUtrs = new Set<string>();

export const DEFAULT_UPI_ID = "tokenforge@upi";
export const DEFAULT_MERCHANT_NAME = "TokenForge";

/** Strict regex pattern for UPI Virtual Payment Address (VPA) */
export const UPI_VPA_REGEX = /^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$/;

export function isValidUpiVpa(vpa: unknown): boolean {
  if (!vpa || typeof vpa !== "string") return false;
  return UPI_VPA_REGEX.test(vpa.trim());
}

export function getEffectiveUpiConfig() {
  const envVpa = (process.env.UPI_ID || process.env.UPI_VPA || "").trim();
  const upiId = envVpa && isValidUpiVpa(envVpa) ? envVpa : DEFAULT_UPI_ID;
  return {
    upiId,
    merchantName: (process.env.UPI_MERCHANT_NAME || DEFAULT_MERCHANT_NAME).trim(),
  };
}

/**
 * Threshold (in INR) above which banks and UPI apps restrict pre-locked dynamic QR codes
 * on unverified / personal VPAs to ₹2,000–₹5,000. For amounts at or above this threshold,
 * we generate an amount-free direct UPI URI (upi://pay?pa=...&pn=...) so transactions
 * qualify under the standard NPCI P2P limit of up to ₹1,00,000.
 */
export const UPI_DIRECT_ENTRY_THRESHOLD_INR = 4000;

/**
 * Builds standard NPCI UPI URI
 * For large amounts (>= UPI_DIRECT_ENTRY_THRESHOLD_INR) or when omitAmount=true,
 * omits the locked 'am' and 'tn' params so Indian banks allow the transaction up to ₹1 Lakh.
 */
export function buildUpiUri(params: {
  upiId: string;
  merchantName: string;
  amountInr?: number;
  orderId?: string;
  omitAmount?: boolean;
}) {
  const vpa = params.upiId.trim();
  const name = encodeURIComponent(params.merchantName.trim());
  const isDirect = params.omitAmount || (params.amountInr !== undefined && params.amountInr >= UPI_DIRECT_ENTRY_THRESHOLD_INR);
  if (isDirect) {
    return `upi://pay?pa=${vpa}&pn=${name}&cu=INR`;
  }
  const am = (params.amountInr ?? 0).toFixed(2);
  const tn = params.orderId ? encodeURIComponent(`Order_${params.orderId}`) : "";
  return `upi://pay?pa=${vpa}&pn=${name}&am=${am}&cu=INR${tn ? `&tn=${tn}` : ""}`;
}

/**
 * Synchronize UPI orders from persistent MySQL storage into memory
 * Also hydrates any completed orders recorded in credit_ledger
 */
export async function syncUpiOrdersFromDb(): Promise<void> {
  try {
    const db = await getDb();
    if (!db) return;

    // 1. Ensure table exists with user_email and user_name columns
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS upi_orders (
        order_id VARCHAR(64) PRIMARY KEY,
        user_id INT NULL,
        user_email VARCHAR(320) NULL,
        user_name VARCHAR(255) NULL,
        amount_inr INT NOT NULL,
        amount_usd DECIMAL(10, 2) NOT NULL,
        credits BIGINT NOT NULL,
        credits_nanos BIGINT NOT NULL,
        tier_id VARCHAR(64) NOT NULL,
        tier_name VARCHAR(128) NOT NULL,
        status VARCHAR(32) NOT NULL,
        utr VARCHAR(64) NULL,
        utr_submitted_at VARCHAR(64) NULL,
        verified_at VARCHAR(64) NULL,
        verified_by VARCHAR(128) NULL,
        rejection_reason TEXT NULL,
        created_at VARCHAR(64) NOT NULL,
        expires_at VARCHAR(64) NOT NULL,
        raw_order JSON NULL
      )
    `);

    // Ensure columns exist on older tables if needed
    try {
      await db.execute(sql`ALTER TABLE upi_orders ADD COLUMN user_email VARCHAR(320) NULL`);
    } catch {}
    try {
      await db.execute(sql`ALTER TABLE upi_orders ADD COLUMN user_name VARCHAR(255) NULL`);
    } catch {}

    // 2. Hydrate from credit_ledger if any approved orders exist
    try {
      const ledgerRows = await db.execute(sql`
        SELECT cl.*, u.email as user_email, u.name as user_name 
        FROM credit_ledger cl
        LEFT JOIN users u ON cl.userId = u.id
        WHERE cl.referenceId LIKE "upi_pay:%"
      `);
      if (ledgerRows && Array.isArray(ledgerRows[0])) {
        for (const row of ledgerRows[0] as any[]) {
          const orderId = String(row.referenceId || "").replace("upi_pay:", "").trim();
          if (!orderId) continue;
          const utrMatch = (row.note || "").match(/UTR:\s*([0-9A-Za-z]+)/);
          const utr = utrMatch ? utrMatch[1] : "UTR_VERIFIED";
          const amountMatch = (row.note || "").match(/₹(\d+)/);
          const amountInr = amountMatch ? parseInt(amountMatch[1], 10) : 149;
          const creditsNanos = Number(row.amountNanos);
          const credits = Math.floor(creditsNanos / 1_000_000_000);
          const createdAt = row.createdAt ? new Date(row.createdAt).toISOString() : new Date().toISOString();
          const userEmail = row.user_email || null;
          const userName = row.user_name || null;

          await db.execute(sql`
            INSERT INTO upi_orders (
              order_id, user_id, user_email, user_name, amount_inr, amount_usd, credits, credits_nanos,
              tier_id, tier_name, status, utr, utr_submitted_at, verified_at,
              verified_by, rejection_reason, created_at, expires_at, raw_order
            ) VALUES (
              ${orderId}, ${row.userId}, ${userEmail}, ${userName}, ${amountInr}, 1.80, ${credits}, ${creditsNanos},
              ${"upi_" + amountInr}, "Starter Pack", "COMPLETED", ${utr}, ${createdAt}, ${createdAt},
              "admin", NULL, ${createdAt}, ${createdAt}, NULL
            )
            ON DUPLICATE KEY UPDATE 
              status = "COMPLETED", 
              utr = VALUES(utr), 
              verified_at = VALUES(verified_at),
              user_email = COALESCE(VALUES(user_email), user_email),
              user_name = COALESCE(VALUES(user_name), user_name)
          `);
        }
      }
    } catch (hydrateErr) {
      console.warn("[UPI Gateway] Ledger hydration warning:", hydrateErr);
    }

    // 3. Load all persistent orders into memory cache joined with users table
    const rows = await db.execute(sql`
      SELECT 
        o.*,
        COALESCE(o.user_email, u.email) as resolved_user_email,
        COALESCE(o.user_name, u.name) as resolved_user_name
      FROM upi_orders o
      LEFT JOIN users u ON o.user_id = u.id
      ORDER BY o.created_at DESC
    `);
    if (rows && Array.isArray(rows[0])) {
      upiOrders.clear();
      processedUtrs.clear();
      for (const r of rows[0] as any[]) {
        const order: UPIOrder = {
          orderId: r.order_id,
          userId: r.user_id,
          userEmail: r.resolved_user_email || r.user_email || null,
          userName: r.resolved_user_name || r.user_name || null,
          tierId: r.tier_id,
          amountInr: Number(r.amount_inr),
          credits: Number(r.credits),
          creditsNanos: Number(r.credits_nanos),
          upiId: getEffectiveUpiConfig().upiId,
          merchantName: getEffectiveUpiConfig().merchantName,
          upiUri: buildUpiUri({
            upiId: getEffectiveUpiConfig().upiId,
            merchantName: getEffectiveUpiConfig().merchantName,
            amountInr: Number(r.amount_inr),
            orderId: r.order_id,
          }),
          status: r.status,
          utr: r.utr,
          submittedAt: r.utr_submitted_at,
          verifiedAt: r.verified_at,
          verifiedBy: r.verified_by,
          rejectionReason: r.rejection_reason,
          createdAt: r.created_at,
          expiresAt: r.expires_at,
        };
        upiOrders.set(order.orderId, order);
        if (order.utr) {
          processedUtrs.add(order.utr);
        }
      }
    }
  } catch (err) {
    console.error("[UPI Gateway] Error syncing orders from DB:", err);
  }
}

/**
 * Persist an order update to MySQL
 */
export async function persistOrderToDb(order: UPIOrder): Promise<void> {
  try {
    const db = await getDb();
    if (!db) return;
    await db.execute(sql`
      INSERT INTO upi_orders (
        order_id, user_id, user_email, user_name, amount_inr, amount_usd, credits, credits_nanos,
        tier_id, tier_name, status, utr, utr_submitted_at, verified_at,
        verified_by, rejection_reason, created_at, expires_at, raw_order
      ) VALUES (
        ${order.orderId}, ${order.userId}, ${order.userEmail || null}, ${order.userName || null}, ${order.amountInr}, ${order.amountInr / USD_TO_INR_RATE}, ${order.credits}, ${order.creditsNanos},
        ${order.tierId}, ${order.tierId}, ${order.status}, ${order.utr}, ${order.submittedAt}, ${order.verifiedAt},
        ${order.verifiedBy}, ${order.rejectionReason}, ${order.createdAt}, ${order.expiresAt}, NULL
      )
      ON DUPLICATE KEY UPDATE
        user_email = COALESCE(VALUES(user_email), user_email),
        user_name = COALESCE(VALUES(user_name), user_name),
        status = VALUES(status),
        utr = VALUES(utr),
        utr_submitted_at = VALUES(utr_submitted_at),
        verified_at = VALUES(verified_at),
        verified_by = VALUES(verified_by),
        rejection_reason = VALUES(rejection_reason)
    `);
  } catch (err) {
    console.error("[UPI Gateway] Failed to persist order to database:", err);
  }
}

function safeSecretCompare(received?: string, expected?: string): boolean {
  if (!received || !expected) return false;
  const rec = Buffer.from(received.trim(), "utf8");
  const exp = Buffer.from(expected.trim(), "utf8");
  return rec.length === exp.length && timingSafeEqual(rec, exp);
}

/**
 * Helper to authenticate admin requests via:
 * 1. Authenticated TokenForge session (cookie or Bearer token) with isAdminSession: true
 * 2. Explicit admin header secret (ADMIN_SECRET_KEY, UPI_ADMIN_SECRET, or TOKENFORGE_ADMIN_PASSCODE)
 */
async function isAuthorizedAdmin(req: Request): Promise<{ authorized: boolean; adminIdentifier: string }> {
  // 1. Authenticated TokenForge administrator session
  try {
    const user = await sdk.authenticateRequest(req);
    if (
      user &&
      ((user as any).isAdminSession ||
        (user as any).role === "admin" ||
        (user as any).isSuperAdmin)
    ) {
      return { authorized: true, adminIdentifier: `admin_user_${user.id}` };
    }
  } catch {
    // Non-admin session or unauthenticated request
  }

  // 2. Explicitly configured server admin secret or passcode (only from environment variables)
  const configuredSecrets = [
    process.env.ADMIN_SECRET_KEY?.trim(),
    process.env.UPI_ADMIN_SECRET?.trim(),
    process.env.TOKENFORGE_ADMIN_PASSCODE?.trim(),
  ].filter(Boolean) as string[];

  const receivedKey =
    (req.headers["x-admin-key"] as string) ||
    (req.headers["x-admin-secret"] as string) ||
    (req.headers["x-admin-passcode"] as string) ||
    (req.query.admin_key as string) ||
    (req.query.secret as string) ||
    (req.query.passcode as string) ||
    (req.body?.admin_key as string) ||
    (req.body?.passcode as string);

  if (receivedKey) {
    const cleanKey = receivedKey.trim();
    for (const secret of configuredSecrets) {
      if (cleanKey === secret || safeSecretCompare(cleanKey, secret)) {
        return { authorized: true, adminIdentifier: "admin_secret_key" };
      }
    }
  }

  return { authorized: false, adminIdentifier: "unauthorized" };
}

export function registerUpiPayGateway(app: Express) {
  // Synchronize orders on initialization
  syncUpiOrdersFromDb().catch((err) => {
    console.error("[UPI Gateway] Initial DB sync error:", err);
  });

  // Strict CORS policy: blocks arbitrary cross-origin domains and "null" origins
  const upiCors = createStrictCors({ allowCredentials: true });

  app.use("/api/upi", upiCors);
  app.use("/api/payments/upi", upiCors);
  // Note: Admin endpoints (/api/admin/upi) intentionally do NOT allow permissive cross-origin requests

  /**
   * GET /api/upi/config
   * Returns current merchant UPI VPA and configured preset tiers
   */
  const handleGetConfig = (_req: Request, res: Response) => {
    const { upiId, merchantName } = getEffectiveUpiConfig();
    return res.json({
      success: true,
      upi_id: upiId,
      merchant_name: merchantName,
      currency: "INR",
      tiers: UPI_TIERS,
      anti_replay_active: true,
    });
  };
  app.get("/api/upi/config", handleGetConfig);
  app.get("/api/payments/upi/config", handleGetConfig);

  /**
   * POST /api/upi/create-order
   * Generates a high-entropy order ID and dynamic NPCI standard UPI URI
   */
  const handleCreateOrder = async (req: Request, res: Response) => {
    try {
      // 1. Enforce Authentication (Prevents unauthenticated order creation and user ID spoofing)
      const authUser = await sdk.authenticateRequest(req).catch(() => null);
      if (!authUser) {
        return res.status(401).json({
          error: "Authentication required",
          detail: "You must be logged in to create a UPI payment order.",
        });
      }

      const resolvedUserId = authUser.id;
      const resolvedUserEmail = authUser.email || null;
      const resolvedUserName = authUser.name || null;

      const {
        tier_id,
        tierId,
        amount_usd,
        amountUsd,
        amount_inr,
        amountInr,
        is_payg,
        isPayg,
        is_coding_plan,
        isCodingPlan,
      } = req.body || {};

      const rawAmount = typeof amount_inr === "number" ? amount_inr : typeof amountInr === "number" ? amountInr : 0;
      let parsedAmount = Number(rawAmount);
      const requestedUsd = typeof amount_usd === "number" ? amount_usd : typeof amountUsd === "number" ? amountUsd : undefined;
      const isPaygDeposit = Boolean(is_payg || isPayg);

      // Check tier: strictly map from server-side definitions
      const selectedTierId = String(tier_id || tierId || "").trim();
      const isCoding = Boolean(is_coding_plan || isCodingPlan || (selectedTierId && selectedTierId.startsWith("coding_")));
      const matchedCodingTier = isCoding ? getCodingPlanTier(selectedTierId || requestedUsd || 25) : undefined;
      const matchedTier = matchedCodingTier ? undefined : (UPI_TIERS.find(t => (selectedTierId && t.id === selectedTierId) || (requestedUsd && t.amountUsd === requestedUsd))
        || UPI_TIERS.find(t => t.amountInr === parsedAmount || t.scanAmountInr === parsedAmount));

      let scannedInr: number;
      let scannedUsd: number;
      let finalCredits: number;
      let finalCreditsNanos: number;
      const finalTierId = matchedCodingTier?.id || matchedTier?.id || (isPaygDeposit ? "inr_payg" : selectedTierId || "inr_custom");

      if (matchedCodingTier) {
        scannedInr = matchedCodingTier.scanAmountInr;
        scannedUsd = matchedCodingTier.scanAmountUsd;
        finalCredits = matchedCodingTier.tokensMillions;
        finalCreditsNanos = matchedCodingTier.tokens;
      } else if (matchedTier) {
        scannedInr = matchedTier.scanAmountInr;
        scannedUsd = matchedTier.scanAmountUsd;
        finalCredits = matchedTier.credits;
        finalCreditsNanos = matchedTier.creditsNanos;
      } else {
        // Custom deposit requires PAYG flag and minimum deposit of ₹100 / $1
        const baseInr = parsedAmount > 0 ? parsedAmount : (requestedUsd ? requestedUsd * USD_TO_INR_RATE : 960);
        if (baseInr < 100) {
          return res.status(400).json({
            error: "Minimum payment amount is ₹100.",
            detail: "Custom deposits must be at least ₹100.",
          });
        }
        scannedInr = baseInr + UPI_INTERNAL_SURCHARGE_INR;
        scannedUsd = Number((scannedInr / USD_TO_INR_RATE).toFixed(2));
        finalCredits = Math.max(1, Math.floor((baseInr / USD_TO_INR_RATE) * 240));
        finalCreditsNanos = finalCredits * 1_000_000_000;
      }

      scannedInr = Math.round(scannedInr * 100) / 100;

      // Strict boundary and type validation: positive finite number within reasonable limits
      if (!Number.isFinite(scannedInr) || scannedInr <= 0 || scannedInr > 10_000_000) {
        return res.status(400).json({
          error: "Invalid amount_inr. Must be a positive finite number.",
          detail: "Invalid amount_inr. Must be greater than 0 and below 10,000,000.",
        });
      }

      // Cryptographically secure 128-bit high-entropy random order ID
      const orderId = `tf_upi_${randomBytes(16).toString("hex")}`;
      const { upiId, merchantName } = getEffectiveUpiConfig();

      const isDirectAmount = scannedInr >= UPI_DIRECT_ENTRY_THRESHOLD_INR;
      const cleanVpa = upiId.trim();
      const cleanName = encodeURIComponent(merchantName.trim());
      const directUpiUri = `upi://pay?pa=${cleanVpa}&pn=${cleanName}&cu=INR`;
      const dynamicUpiUri = `upi://pay?pa=${cleanVpa}&pn=${cleanName}&am=${scannedInr.toFixed(2)}&cu=INR&tn=${encodeURIComponent(`Order_${orderId}`)}`;

      const upiUri = buildUpiUri({
        upiId,
        merchantName,
        amountInr: scannedInr,
        orderId,
      });

      const now = new Date();
      const expiresAt = new Date(now.getTime() + 30 * 60 * 1000).toISOString();

      const orderRecord: UPIOrder = {
        orderId,
        userId: resolvedUserId,
        userEmail: resolvedUserEmail,
        userName: resolvedUserName,
        tierId: finalTierId,
        amountInr: scannedInr,
        amountUsd: matchedCodingTier?.amountUsd ?? matchedTier?.amountUsd ?? (requestedUsd || Number((scannedInr / USD_TO_INR_RATE).toFixed(2))),
        isPayg: isPaygDeposit,
        isCodingPlan: Boolean(matchedCodingTier || isCoding),
        codingTokens: matchedCodingTier?.tokens,
        planName: matchedCodingTier?.name,
        credits: finalCredits,
        creditsNanos: finalCreditsNanos,
        upiId,
        merchantName,
        upiUri,
        status: "PENDING_PAYMENT",
        utr: null,
        submittedAt: null,
        verifiedAt: null,
        verifiedBy: null,
        rejectionReason: null,
        createdAt: now.toISOString(),
        expiresAt,
      };

      upiOrders.set(orderId, orderRecord);
      await persistOrderToDb(orderRecord);

      return res.json({
        success: true,
        order_id: orderId,
        amount_inr: scannedInr,
        amount_usd: scannedUsd,
        base_plan_usd: matchedTier?.amountUsd ?? (scannedUsd - UPI_INTERNAL_SURCHARGE_USD),
        conversion_rate: USD_TO_INR_RATE,
        tier_id: finalTierId,
        is_payg: isPaygDeposit,
        credits: finalCredits,
        credits_nanos: finalCreditsNanos,
        upi_id: upiId,
        upi_uri: upiUri,
        direct_upi_uri: directUpiUri,
        dynamic_upi_uri: dynamicUpiUri,
        is_direct_amount: isDirectAmount,
        status: "PENDING_PAYMENT",
        expires_at: expiresAt,
      });
    } catch (err: any) {
      console.error("[UPI Gateway] Create order error:", err);
      return res.status(500).json({ error: "Failed to create UPI order", detail: err?.message });
    }
  };
  app.post("/api/upi/create-order", handleCreateOrder);
  app.post("/api/payments/upi/create-order", handleCreateOrder);

  /**
   * POST /api/upi/submit-utr
   * Validates 12-digit UTR, enforces caller ownership, anti-replay, transitions status to PENDING_VERIFICATION
   */
  const handleSubmitUtr = async (req: Request, res: Response) => {
    try {
      // 0. Authorization check: caller must be authenticated
      const authUser = await sdk.authenticateRequest(req).catch(() => null);
      if (!authUser) {
        return res.status(401).json({
          error: "Authentication required",
          detail: "You must be logged in to submit a UTR.",
        });
      }

      const { order_id, orderId, utr } = req.body || {};
      const resolvedOrderId = String(order_id || orderId || "").trim();
      const cleanUtr = String(utr || "").trim();

      // 1. Strict 12-digit numeric format validation
      if (!/^\d{12}$/.test(cleanUtr)) {
        return res.status(400).json({
          error: "Invalid UTR format. UTR must be exactly 12 numeric digits.",
          detail: "Invalid UTR format. UTR must be exactly 12 numeric digits.",
        });
      }

      // 2. Prevent Replay Attacks (duplicate UTR reuse across the entire system)
      if (processedUtrs.has(cleanUtr)) {
        return res.status(409).json({
          error: "This UTR has already been submitted for an order.",
          detail: "This UTR has already been submitted for an order.",
        });
      }

      // 3. Locate Order
      const order = upiOrders.get(resolvedOrderId);
      if (!order) {
        return res.status(404).json({
          error: "Order not found.",
          detail: "Order not found.",
        });
      }

      // 4. IDOR Protection: Verify caller owns this order (or is an authorized administrator)
      const adminCheck = await isAuthorizedAdmin(req).catch(() => ({ authorized: false }));
      if (order.userId && order.userId !== authUser.id && !adminCheck.authorized) {
        return res.status(403).json({
          error: "Unauthorized",
          detail: "You do not have permission to modify this order.",
        });
      }

      if (order.status === "COMPLETED") {
        return res.status(400).json({
          error: "Order already credited.",
          detail: "Order already credited.",
        });
      }

      // 5. Update Status to PENDING_VERIFICATION
      order.utr = cleanUtr;
      order.status = "PENDING_VERIFICATION";
      order.submittedAt = new Date().toISOString();
      processedUtrs.add(cleanUtr);
      await persistOrderToDb(order);

      return res.json({
        success: true,
        status: "PENDING_VERIFICATION",
        order_id: order.orderId,
        utr: cleanUtr,
        message: "UTR submitted successfully. Credits will be added upon bank confirmation.",
      });
    } catch (err: any) {
      console.error("[UPI Gateway] Submit UTR error:", err);
      return res.status(500).json({ error: "Failed to submit UTR", detail: err?.message });
    }
  };
  app.post("/api/upi/submit-utr", handleSubmitUtr);
  app.post("/api/payments/upi/submit-utr", handleSubmitUtr);

  /**
   * GET /api/upi/order-status/:orderId
   * Allows the frontend checkout modal to poll for completion.
   * Hardened against IDOR: Requires caller authentication and ownership verification.
   */
  const handleOrderStatus = async (req: Request, res: Response) => {
    const orderId = String(req.params.orderId || req.params.order_id || req.query.order_id || "").trim();
    const order = upiOrders.get(orderId);
    if (!order) {
      return res.status(404).json({ error: "Order not found.", detail: "Order not found." });
    }

    // IDOR Protection: Verify caller is authenticated and owns this order (or is admin)
    const authUser = await sdk.authenticateRequest(req).catch(() => null);
    const adminCheck = await isAuthorizedAdmin(req).catch(() => ({ authorized: false }));
    const isOwner = authUser && order.userId && order.userId === authUser.id;
    const isAdmin = adminCheck.authorized;

    if (!isOwner && !isAdmin) {
      // Return 404 to avoid leaking the existence of other users' orders
      return res.status(404).json({ error: "Order not found.", detail: "Order not found." });
    }

    return res.json({
      success: true,
      order_id: order.orderId,
      status: order.status,
      credits: order.credits,
      credits_nanos: order.creditsNanos,
      amount_inr: order.amountInr,
      utr: order.utr,
      created_at: order.createdAt,
      submitted_at: order.submittedAt,
      completed_at: order.verifiedAt,
      rejection_reason: order.rejectionReason,
    });
  };
  app.get("/api/upi/order-status/:orderId", handleOrderStatus);
  app.get("/api/payments/upi/status/:orderId", handleOrderStatus);

  /**
   * GET /api/upi/my-orders
   * Authenticated user endpoint to retrieve ONLY their own orders
   */
  const handleGetMyOrders = async (req: Request, res: Response) => {
    try {
      const user = await sdk.authenticateRequest(req);
      if (!user) {
        return res.status(401).json({ error: "Authentication required." });
      }

      await syncUpiOrdersFromDb();
      const allOrders = Array.from(upiOrders.values());
      const userOrders = allOrders
        .filter(o => o.userId === user.id)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      return res.json({
        success: true,
        orders: userOrders,
      });
    } catch {
      return res.status(401).json({ error: "Authentication required." });
    }
  };
  app.get("/api/upi/my-orders", handleGetMyOrders);
  app.get("/api/payments/upi/my-orders", handleGetMyOrders);

  /**
   * Admin Endpoints:
   * Protected verification and listing routes
   */

  // List all orders (with optional status filter)
  const handleAdminListOrders = async (req: Request, res: Response) => {
    const auth = await isAuthorizedAdmin(req);
    if (!auth.authorized) {
      return res.status(403).json({ error: "Unauthorized. Admin authentication required." });
    }

    await syncUpiOrdersFromDb();
    const statusFilter = (req.query.status as string) || "ALL";
    const ordersArray = Array.from(upiOrders.values());

    const filtered = ordersArray.filter(o => {
      if (statusFilter === "ALL") return true;
      return o.status === statusFilter;
    });

    // Sort by submitted/created descending, with PENDING_VERIFICATION prioritized
    filtered.sort((a, b) => {
      if (a.status === "PENDING_VERIFICATION" && b.status !== "PENDING_VERIFICATION") return -1;
      if (b.status === "PENDING_VERIFICATION" && a.status !== "PENDING_VERIFICATION") return 1;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    return res.json({
      success: true,
      total: filtered.length,
      pending_verification_count: ordersArray.filter(o => o.status === "PENDING_VERIFICATION").length,
      orders: filtered,
    });
  };
  app.get("/api/admin/upi/orders", handleAdminListOrders);
  app.get("/api/admin/upi/pending", handleAdminListOrders);
  app.get("/api/payments/admin/upi/orders", handleAdminListOrders);

  // Approve order and grant user credits
  const handleAdminApprove = async (req: Request, res: Response) => {
    const auth = await isAuthorizedAdmin(req);
    if (!auth.authorized) {
      return res.status(403).json({ error: "Unauthorized. Admin authentication required." });
    }

    const orderId = String(req.params.orderId || req.body?.order_id || req.body?.orderId || "").trim();
    const order = upiOrders.get(orderId);

    if (!order) {
      return res.status(404).json({ error: "Order not found." });
    }

    if (order.status === "COMPLETED") {
      return res.json({
        success: true,
        already_completed: true,
        order_id: order.orderId,
        status: "COMPLETED",
        credited_user: order.userId,
        added_credits: order.credits,
      });
    }

    if (order.status !== "PENDING_VERIFICATION" && order.status !== "PENDING_PAYMENT") {
      return res.status(400).json({ error: `Order is not in a verifiable state (current: ${order.status})` });
    }

    order.status = "COMPLETED";
    order.verifiedAt = new Date().toISOString();
    order.verifiedBy = auth.adminIdentifier;
    await persistOrderToDb(order);

    let updatedBalanceNanos: number | null = null;
    let updatedPaygBalanceNanos: number | null = null;
    let updatedCodingTokens: number | null = null;
    if (order.userId) {
      try {
        const depositUsd = order.amountUsd ?? Number((order.amountInr / USD_TO_INR_RATE).toFixed(2));
        const matchedCodingTier = order.isCodingPlan ? getCodingPlanTier(order.tierId) : undefined;
        const matchedTier = UPI_TIERS.find(t => t.id === order.tierId);
        const authoritativeTokens = matchedCodingTier?.tokens ?? (order.codingTokens || 0);
        const authoritativeNanos = matchedCodingTier
          ? matchedCodingTier.tokens
          : matchedTier
          ? matchedTier.creditsNanos
          : order.isPayg
          ? Math.round(depositUsd * 1_000_000_000)
          : order.creditsNanos;

        const creditResult = await creditAccountFromUPIPay({
          userId: order.userId,
          amountNanos: authoritativeNanos,
          orderId: order.orderId,
          utr: order.utr || "MANUAL_APPROVAL",
          assetLabel: order.isCodingPlan ? `Coding Plan: ${order.planName || order.tierId} (${Math.round((authoritativeTokens || 0) / 1_000_000)}M Tokens)` : order.isPayg ? `UPI PAYG Deposit (₹${order.amountInr} / $${depositUsd})` : `₹${order.amountInr} UPI`,
          isPayg: order.isPayg,
          isCodingPlan: order.isCodingPlan,
          codingPlanTokens: authoritativeTokens,
          planName: order.planName,
        });
        updatedBalanceNanos = creditResult?.balanceNanos ?? null;
        updatedPaygBalanceNanos = creditResult?.paygBalanceNanos ?? null;
        updatedCodingTokens = creditResult?.codingPlanTokens ?? null;
      } catch (dbErr) {
        console.error("[UPI Gateway] Error crediting account:", dbErr);
      }
    }

    return res.json({
      success: true,
      status: "COMPLETED",
      order_id: order.orderId,
      credited_user: order.userId,
      added_credits: order.credits,
      is_coding_plan: Boolean(order.isCodingPlan),
      coding_tokens: order.codingTokens,
      updated_balance_nanos: updatedBalanceNanos,
      updated_coding_tokens: updatedCodingTokens,
      message: order.isCodingPlan
        ? `Order approved. ${Math.round((order.codingTokens || 0) / 1_000_000)}M Coding Tokens have been issued to the user.`
        : "Order approved successfully. Credits have been issued to the user.",
    });
  };
  app.post("/api/admin/upi/approve", handleAdminApprove);
  app.post("/api/admin/upi/approve-order/:orderId", handleAdminApprove);
  app.post("/api/payments/admin/upi/verify", handleAdminApprove);

  // Reject order
  const handleAdminReject = async (req: Request, res: Response) => {
    const auth = await isAuthorizedAdmin(req);
    if (!auth.authorized) {
      return res.status(403).json({ error: "Unauthorized. Admin authentication required." });
    }

    const orderId = String(req.params.orderId || req.body?.order_id || req.body?.orderId || "").trim();
    const reason = String(req.body?.reason || "UTR not found in bank statement").trim();
    const order = upiOrders.get(orderId);

    if (!order) {
      return res.status(404).json({ error: "Order not found." });
    }

    order.status = "REJECTED";
    order.rejectionReason = reason;
    await persistOrderToDb(order);

    return res.json({
      success: true,
      status: "REJECTED",
      order_id: order.orderId,
      reason,
      message: "Order marked as rejected.",
    });
  };
  app.post("/api/admin/upi/reject", handleAdminReject);
  app.post("/api/admin/upi/reject-order/:orderId", handleAdminReject);
}
