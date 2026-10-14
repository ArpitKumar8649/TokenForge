import type { Express, Request, Response } from "express";
import crypto from "node:crypto";
import { creditAccountFromUPIPay, getDb } from "./db";
import { sql } from "drizzle-orm";
import { sdk } from "./_core/sdk";
import { UPI_TIERS, USD_TO_INR_RATE } from "../shared/paymentTiers";

// Hardcoded Test / Sandbox Credentials provided for staging test environment
// Can be overridden by process.env when moving to production
const DEFAULT_CASHFREE_APP_ID = "TEST11255985f7479d8dff141088b01658955211";
const DEFAULT_CASHFREE_SECRET_KEY = "cfsk_ma_test_05b96e002f18212429d07dd24c83d75e_2029a481";
const CASHFREE_API_VERSION = "2023-08-01";

export function getCashfreeConfig() {
  const appId = (process.env.CASHFREE_APP_ID || "").trim() || DEFAULT_CASHFREE_APP_ID;
  const secretKey = (process.env.CASHFREE_SECRET_KEY || "").trim() || DEFAULT_CASHFREE_SECRET_KEY;
  const env = (process.env.CASHFREE_ENV || "").trim().toUpperCase();
  const isProd = env === "PROD" || env === "PRODUCTION";
  const baseUrl = isProd ? "https://api.cashfree.com/pg" : "https://sandbox.cashfree.com/pg";
  return { appId, secretKey, baseUrl, isProd };
}

export interface CashfreeOrderRecord {
  orderId: string;
  cfOrderId?: string | null;
  paymentSessionId?: string | null;
  userId: number | null;
  userEmail?: string | null;
  userName?: string | null;
  tierId: string;
  tierName?: string;
  amountInr: number;
  amountUsd: number;
  isPayg?: boolean;
  credits: number;
  creditsNanos: number;
  status: "ACTIVE" | "PAID" | "EXPIRED" | "FAILED";
  paymentId?: string | null;
  paymentMethod?: string | null;
  referenceId?: string | null;
  createdAt: string;
  completedAt?: string | null;
}

const cashfreeOrders = new Map<string, CashfreeOrderRecord>();

let hasEnsuredCashfreeTable = false;

/**
 * Ensure `cashfree_orders` database table exists for audit and fast reconciliation
 */
async function ensureCashfreeOrdersTable(): Promise<boolean> {
  try {
    const db = await getDb();
    if (!db) return false;
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS cashfree_orders (
        order_id VARCHAR(64) PRIMARY KEY,
        cf_order_id VARCHAR(128) NULL,
        payment_session_id VARCHAR(512) NULL,
        user_id INT NULL,
        user_email VARCHAR(320) NULL,
        user_name VARCHAR(255) NULL,
        amount_inr DECIMAL(10, 2) NOT NULL,
        amount_usd DECIMAL(10, 2) NOT NULL,
        credits BIGINT NOT NULL,
        credits_nanos BIGINT NOT NULL,
        tier_id VARCHAR(64) NOT NULL,
        tier_name VARCHAR(128) NOT NULL,
        is_payg TINYINT(1) DEFAULT 0,
        status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
        payment_id VARCHAR(128) NULL,
        payment_method VARCHAR(64) NULL,
        reference_id VARCHAR(128) NULL,
        created_at VARCHAR(64) NOT NULL,
        completed_at VARCHAR(64) NULL,
        raw_order JSON NULL,
        INDEX idx_cf_user (user_id),
        INDEX idx_cf_status (status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    hasEnsuredCashfreeTable = true;
    return true;
  } catch (err) {
    console.error("[Cashfree Gateway] Table initialization notice:", err);
    return false;
  }
}

async function persistCashfreeOrder(order: CashfreeOrderRecord) {
  cashfreeOrders.set(order.orderId, order);
  try {
    const db = await getDb();
    if (!db) return;

    if (!hasEnsuredCashfreeTable) {
      await ensureCashfreeOrdersTable();
    }

    const executeInsert = async () => {
      await db.execute(sql`
        INSERT INTO cashfree_orders (
          order_id, cf_order_id, payment_session_id, user_id, user_email, user_name,
          amount_inr, amount_usd, credits, credits_nanos, tier_id, tier_name,
          is_payg, status, payment_id, payment_method, reference_id, created_at, completed_at
        ) VALUES (
          ${order.orderId}, ${order.cfOrderId || null}, ${order.paymentSessionId || null},
          ${order.userId}, ${order.userEmail || null}, ${order.userName || null},
          ${order.amountInr}, ${order.amountUsd}, ${order.credits}, ${order.creditsNanos},
          ${order.tierId}, ${order.tierName || order.tierId}, ${order.isPayg ? 1 : 0},
          ${order.status}, ${order.paymentId || null}, ${order.paymentMethod || null},
          ${order.referenceId || null}, ${order.createdAt}, ${order.completedAt || null}
        )
        ON DUPLICATE KEY UPDATE
          status = VALUES(status),
          cf_order_id = COALESCE(VALUES(cf_order_id), cf_order_id),
          payment_session_id = COALESCE(VALUES(payment_session_id), payment_session_id),
          payment_id = COALESCE(VALUES(payment_id), payment_id),
          payment_method = COALESCE(VALUES(payment_method), payment_method),
          reference_id = COALESCE(VALUES(reference_id), reference_id),
          completed_at = COALESCE(VALUES(completed_at), completed_at)
      `);
    };

    try {
      await executeInsert();
    } catch (insertErr: any) {
      const errMsg = String(insertErr?.message || insertErr);
      if (errMsg.includes("doesn't exist") || errMsg.includes("cashfree_orders")) {
        await ensureCashfreeOrdersTable();
        await executeInsert();
      } else {
        throw insertErr;
      }
    }
  } catch (err) {
    console.error("[Cashfree Gateway] Failed to persist order to db:", err);
  }
}

async function fulfillCashfreeOrder(order: CashfreeOrderRecord, paymentDetails?: any) {
  if (order.status === "PAID") return;
  order.status = "PAID";
  order.completedAt = new Date().toISOString();
  if (paymentDetails?.paymentId) order.paymentId = paymentDetails.paymentId;
  if (paymentDetails?.paymentMethod) order.paymentMethod = paymentDetails.paymentMethod;

  await persistCashfreeOrder(order);

  if (order.userId) {
    try {
      const depositUsd = order.amountUsd;
      const creditResult = await creditAccountFromUPIPay({
        userId: order.userId,
        amountNanos: order.isPayg ? Math.round(depositUsd * 1_000_000_000) : order.creditsNanos,
        orderId: `cf_${order.orderId}`,
        utr: order.paymentId || "CASHFREE_AUTO_VERIFIED",
        assetLabel: order.isPayg ? `Cashfree Instant UPI PAYG (₹${order.amountInr} / $${depositUsd})` : `Cashfree Instant UPI (₹${order.amountInr})`,
        isPayg: order.isPayg,
      });
      console.log(`[Cashfree Gateway] Granted credits to user ${order.userId} for order ${order.orderId}:`, creditResult);
    } catch (err) {
      console.error(`[Cashfree Gateway] Error crediting account for order ${order.orderId}:`, err);
    }
  }
}

/**
 * Verify Cashfree Webhook Signature
 */
export function verifyCashfreeWebhookSignature(
  rawBody: string,
  timestamp: string,
  signature: string,
  secretKey: string
): boolean {
  try {
    const data = timestamp + rawBody;
    const expected = crypto.createHmac("sha256", secretKey).update(data).digest("base64");
    return expected === signature;
  } catch {
    return false;
  }
}

export function registerCashfreeGateway(app: Express) {
  ensureCashfreeOrdersTable().catch(console.error);

  /**
   * POST /api/cashfree/create-order
   * Creates a Cashfree order and returns payment_session_id for Seamless UPI / Drop-in
   */
  app.post(["/api/cashfree/create-order", "/api/payments/cashfree/create-order"], async (req: Request, res: Response) => {
    try {
      const authUser = await sdk.authenticateRequest(req).catch(() => null);
      const {
        tier_id,
        tierId,
        amount_inr,
        amount_usd,
        credits,
        is_payg,
      } = req.body || {};

      const resolvedUserId = authUser?.id || (req.body?.user_id ? Number(req.body.user_id) : null);
      const resolvedUserEmail = authUser?.email || req.body?.user_email || "developer@tokenforge.ai";
      const resolvedUserName = authUser?.name || req.body?.user_name || "TokenForge Developer";

      // Match tier or calculate amounts
      const selectedTierId = String(tier_id || tierId || "").trim();
      const requestedUsd = amount_usd ? Number(amount_usd) : undefined;
      const parsedAmount = amount_inr ? Number(amount_inr) : 0;

      const matchedTier = UPI_TIERS.find(t => (selectedTierId && t.id === selectedTierId) || (requestedUsd && t.amountUsd === requestedUsd))
        || UPI_TIERS.find(t => t.amountInr === parsedAmount || t.scanAmountInr === parsedAmount);

      let finalInr: number;
      let finalUsd: number;
      let finalCredits: number;
      let finalCreditsNanos: number;
      const isPaygDeposit = Boolean(is_payg);

      if (matchedTier) {
        finalInr = matchedTier.amountInr;
        finalUsd = matchedTier.amountUsd;
        finalCredits = matchedTier.credits;
        finalCreditsNanos = matchedTier.creditsNanos;
      } else {
        finalInr = parsedAmount > 0 ? parsedAmount : (requestedUsd ? requestedUsd * USD_TO_INR_RATE : 960);
        finalUsd = requestedUsd || Number((finalInr / USD_TO_INR_RATE).toFixed(2));
        finalCredits = credits ? Number(credits) : Math.max(1, Math.floor((finalInr / USD_TO_INR_RATE) * 240));
        finalCreditsNanos = finalCredits * 1_000_000_000;
      }

      finalInr = Math.round(finalInr * 100) / 100;

      // Allow high-value amounts up to ₹1,00,000 (1 Lakh INR) via UPI
      if (!Number.isFinite(finalInr) || finalInr <= 0 || finalInr > 200_000) {
        return res.status(400).json({
          error: "Invalid amount. Must be a positive amount up to ₹2,00,000 INR.",
        });
      }

      // Unique Cashfree Order ID
      const orderId = `tf_cf_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
      const { appId, secretKey, baseUrl, isProd } = getCashfreeConfig();

      // Clean phone number (Cashfree requires a 10-digit number)
      const customerPhone = "9999999999";
      const customerId = resolvedUserId ? `user_${resolvedUserId}` : `guest_${crypto.randomBytes(6).toString("hex")}`;

      const cfPayload = {
        order_id: orderId,
        order_amount: finalInr,
        order_currency: "INR",
        customer_details: {
          customer_id: customerId,
          customer_name: resolvedUserName.slice(0, 50),
          customer_email: resolvedUserEmail,
          customer_phone: customerPhone,
        },
        order_meta: {
          return_url: `${req.protocol}://${req.get("host")}/credits?cf_order_id={order_id}`,
          notify_url: `${req.protocol}://${req.get("host")}/api/cashfree/webhook`,
        },
        order_note: isPaygDeposit
          ? `PAYG Deposit $${finalUsd} (₹${finalInr})`
          : `TokenForge ${matchedTier?.name || "Credit"} Pack $${finalUsd} (₹${finalInr})`,
      };

      const cfRes = await fetch(`${baseUrl}/orders`, {
        method: "POST",
        headers: {
          "Accept": "application/json",
          "Content-Type": "application/json",
          "x-api-version": CASHFREE_API_VERSION,
          "x-client-id": appId,
          "x-client-secret": secretKey,
        },
        body: JSON.stringify(cfPayload),
      });

      const cfData = await cfRes.json();

      if (!cfRes.ok || !cfData.payment_session_id) {
        console.error("[Cashfree Gateway] Create order error:", cfData);
        return res.status(cfRes.status || 500).json({
          error: cfData.message || "Failed to create Cashfree order",
          detail: cfData,
        });
      }

      const orderRecord: CashfreeOrderRecord = {
        orderId,
        cfOrderId: cfData.cf_order_id ? String(cfData.cf_order_id) : undefined,
        paymentSessionId: cfData.payment_session_id,
        userId: resolvedUserId,
        userEmail: resolvedUserEmail,
        userName: resolvedUserName,
        tierId: matchedTier?.id || selectedTierId || "inr_custom",
        tierName: matchedTier?.name || (isPaygDeposit ? `PAYG Deposit ($${finalUsd})` : `Custom UPI Plan ($${finalUsd})`),
        amountInr: finalInr,
        amountUsd: finalUsd,
        isPayg: isPaygDeposit,
        credits: finalCredits,
        creditsNanos: finalCreditsNanos,
        status: "ACTIVE",
        createdAt: new Date().toISOString(),
      };

      await persistCashfreeOrder(orderRecord);

      const orderSummary = {
        order_id: orderId,
        cf_order_id: cfData.cf_order_id,
        payment_session_id: cfData.payment_session_id,
        amount_inr: finalInr,
        amount_usd: finalUsd,
        credits: finalCredits,
        is_payg: isPaygDeposit,
        environment: isProd ? "PRODUCTION" : "SANDBOX",
      };

      return res.json({
        success: true,
        order: orderSummary,
        ...orderSummary,
      });
    } catch (err: any) {
      console.error("[Cashfree Gateway] Exception creating order:", err);
      return res.status(500).json({ error: "Internal server error creating Cashfree order", detail: err?.message });
    }
  });

  /**
   * GET /api/cashfree/order-status/:orderId
   * Checks order status directly with Cashfree and automatically awards credits upon SUCCESS
   */
  app.get(["/api/cashfree/order-status/:orderId", "/api/payments/cashfree/status/:orderId"], async (req: Request, res: Response) => {
    try {
      const orderId = String(req.params.orderId || req.query.order_id || "").trim();
      let order = cashfreeOrders.get(orderId);

      if (!order) {
        // Try to query DB if not in memory
        const db = await getDb();
        if (db) {
          const rows = await db.execute(sql`SELECT * FROM cashfree_orders WHERE order_id = ${orderId} LIMIT 1`);
          if (rows && Array.isArray(rows[0]) && (rows[0] as any[]).length > 0) {
            const r = (rows[0] as any[])[0];
            order = {
              orderId: r.order_id,
              cfOrderId: r.cf_order_id,
              paymentSessionId: r.payment_session_id,
              userId: r.user_id,
              userEmail: r.user_email,
              userName: r.user_name,
              amountInr: Number(r.amount_inr),
              amountUsd: Number(r.amount_usd),
              credits: Number(r.credits),
              creditsNanos: Number(r.credits_nanos),
              tierId: r.tier_id,
              tierName: r.tier_name,
              isPayg: Boolean(r.is_payg),
              status: r.status,
              paymentId: r.payment_id,
              paymentMethod: r.payment_method,
              createdAt: r.created_at,
              completedAt: r.completed_at,
            };
            cashfreeOrders.set(order.orderId, order);
          }
        }
      }

      if (!order) {
        return res.status(404).json({ error: "Order not found" });
      }

      // If already paid, return status immediately
      if (order.status === "PAID") {
        return res.json({
          success: true,
          status: "PAID",
          order_id: order.orderId,
          credits: order.credits,
          amount_inr: order.amountInr,
          completed_at: order.completedAt,
        });
      }

      // Verify live with Cashfree PG API
      const { appId, secretKey, baseUrl } = getCashfreeConfig();
      const cfRes = await fetch(`${baseUrl}/orders/${orderId}`, {
        headers: {
          "Accept": "application/json",
          "x-api-version": CASHFREE_API_VERSION,
          "x-client-id": appId,
          "x-client-secret": secretKey,
        },
      });

      if (cfRes.ok) {
        const cfOrder = await cfRes.json();
        if (cfOrder.order_status === "PAID") {
          // Check payments for payment details
          const paymentsRes = await fetch(`${baseUrl}/orders/${orderId}/payments`, {
            headers: {
              "Accept": "application/json",
              "x-api-version": CASHFREE_API_VERSION,
              "x-client-id": appId,
              "x-client-secret": secretKey,
            },
          });
          const payments = paymentsRes.ok ? await paymentsRes.json() : [];
          const successfulPayment = Array.isArray(payments) ? payments.find((p: any) => p.payment_status === "SUCCESS") : null;

          await fulfillCashfreeOrder(order, {
            paymentId: successfulPayment?.cf_payment_id ? String(successfulPayment.cf_payment_id) : undefined,
            paymentMethod: successfulPayment?.payment_group || "upi",
          });

          return res.json({
            success: true,
            status: "PAID",
            order_id: order.orderId,
            credits: order.credits,
            amount_inr: order.amountInr,
            completed_at: order.completedAt,
          });
        } else if (cfOrder.order_status === "EXPIRED") {
          order.status = "EXPIRED";
          await persistCashfreeOrder(order);
        }
      }

      return res.json({
        success: true,
        status: order.status,
        order_id: order.orderId,
        amount_inr: order.amountInr,
      });
    } catch (err: any) {
      console.error("[Cashfree Gateway] Error fetching order status:", err);
      return res.status(500).json({ error: "Failed to verify order status", detail: err?.message });
    }
  });

  /**
   * POST /api/cashfree/webhook
   * Instant server-to-server webhook from Cashfree.
   * Auto-verifies signature and automatically adds credits instantly!
   */
  app.post(["/api/cashfree/webhook", "/api/payments/cashfree/webhook"], async (req: Request, res: Response) => {
    try {
      const signature = (req.headers["x-webhook-signature"] as string) || "";
      const timestamp = (req.headers["x-webhook-timestamp"] as string) || "";
      const { secretKey } = getCashfreeConfig();

      const rawBody = typeof req.body === "string" ? req.body : JSON.stringify(req.body);
      const isVerified = verifyCashfreeWebhookSignature(rawBody, timestamp, signature, secretKey);

      if (!isVerified && process.env.NODE_ENV === "production") {
        console.warn("[Cashfree Webhook] Invalid signature rejected");
        return res.status(401).json({ error: "Invalid webhook signature" });
      }

      const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
      const eventType = body.type;
      console.log(`[Cashfree Webhook] Received event: ${eventType}`);

      if (eventType === "PAYMENT_SUCCESS_WEBHOOK") {
        const orderData = body.data?.order;
        const paymentData = body.data?.payment;
        const orderId = orderData?.order_id;

        if (orderId) {
          let order = cashfreeOrders.get(orderId);
          if (!order) {
            const db = await getDb();
            if (db) {
              const rows = await db.execute(sql`SELECT * FROM cashfree_orders WHERE order_id = ${orderId} LIMIT 1`);
              if (rows && Array.isArray(rows[0]) && (rows[0] as any[]).length > 0) {
                const r = (rows[0] as any[])[0];
                order = {
                  orderId: r.order_id,
                  cfOrderId: r.cf_order_id,
                  paymentSessionId: r.payment_session_id,
                  userId: r.user_id,
                  userEmail: r.user_email,
                  userName: r.user_name,
                  amountInr: Number(r.amount_inr),
                  amountUsd: Number(r.amount_usd),
                  credits: Number(r.credits),
                  creditsNanos: Number(r.credits_nanos),
                  tierId: r.tier_id,
                  tierName: r.tier_name,
                  isPayg: Boolean(r.is_payg),
                  status: r.status,
                  createdAt: r.created_at,
                };
              }
            }
          }

          if (order) {
            await fulfillCashfreeOrder(order, {
              paymentId: paymentData?.cf_payment_id ? String(paymentData.cf_payment_id) : undefined,
              paymentMethod: paymentData?.payment_group || "upi",
            });
            console.log(`[Cashfree Webhook] Successfully processed payment for order ${orderId}`);
          }
        }
      }

      return res.status(200).json({ status: "OK" });
    } catch (err: any) {
      console.error("[Cashfree Webhook] Error processing webhook:", err);
      return res.status(500).json({ error: "Webhook processing error", detail: err?.message });
    }
  });
}
