import type { Express, Request, Response } from "express";
import { randomBytes } from "node:crypto";
import { Keypair, Connection, PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { getDb, creditAccountFromSolanaPay } from "./db";
import { sql } from "drizzle-orm";
import { getCodingPlanTier, CODING_PLAN_TIERS } from "../shared/paymentTiers";
import { sdk } from "./_core/sdk";

export const MERCHANT_PUBLIC_KEY =
  process.env.SOLANA_MERCHANT_WALLET || "CUiXiA54MjUCxF1acboThD8R2CwLsqfDidiT7RWJsD7w";
export const HELIUS_API_KEY =
  process.env.HELIUS_API_KEY || "";
export const SOLANA_RPC_URL =
  process.env.SOLANA_RPC_URL || (HELIUS_API_KEY ? `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}` : "https://api.mainnet-beta.solana.com");
export const SOLANA_NETWORK = process.env.SOLANA_NETWORK || "mainnet-beta";
export const ORDER_EXPIRY_MINUTES = 5;
export const ORDER_EXPIRY_SECONDS = ORDER_EXPIRY_MINUTES * 60;

// Price cache for Binance ticker
let cachedSolPrice = { price: 150.0, updatedAt: 0 };

export async function getSolPriceUsd(): Promise<number> {
  const now = Date.now();
  if (now - cachedSolPrice.updatedAt < 5000 && cachedSolPrice.price > 0) {
    return cachedSolPrice.price;
  }
  try {
    const res = await fetch("https://api.binance.com/api/v3/ticker/price?symbol=SOLUSDT", {
      headers: { "User-Agent": "TokenForge-SolanaPay/1.0", Accept: "application/json" },
      signal: AbortSignal.timeout(6000),
    });
    if (res.ok) {
      const data: any = await res.json();
      const price = parseFloat(data.price);
      if (!isNaN(price) && price > 0) {
        cachedSolPrice = { price, updatedAt: now };
        return price;
      }
    }
  } catch (err) {
    console.warn("[Solana Pay] Binance price fetch warning:", err);
  }
  return cachedSolPrice.price > 0 ? cachedSolPrice.price : 150.0;
}

export function registerSolanaPayGateway(app: Express) {
  // 1. Config endpoint
  app.get("/api/solana-pay/config", (_req: Request, res: Response) => {
    return res.json({
      merchant_pubkey: MERCHANT_PUBLIC_KEY,
      solana_rpc_url: SOLANA_RPC_URL,
      network: SOLANA_NETWORK,
      accepted_asset: "SOL",
      expiry_minutes: ORDER_EXPIRY_MINUTES,
      expiry_seconds: ORDER_EXPIRY_SECONDS,
    });
  });

  // 2. Live SOL/USD price
  app.get("/api/solana-pay/price", async (_req: Request, res: Response) => {
    try {
      const price = await getSolPriceUsd();
      const packages = [
        { usd: 5, sol: Number((5 / price).toFixed(5)), label: "Starter" },
        { usd: 10, sol: Number((10 / price).toFixed(5)), label: "Basic" },
        { usd: 25, sol: Number((25 / price).toFixed(5)), label: "Developer", popular: true },
        { usd: 50, sol: Number((50 / price).toFixed(5)), label: "Scale" },
        { usd: 100, sol: Number((100 / price).toFixed(5)), label: "Pro" },
      ];
      return res.json({
        symbol: "SOLUSDT",
        sol_usd_price: price,
        source: "Binance Public Ticker",
        timestamp: new Date().toISOString(),
        packages,
      });
    } catch (err: any) {
      return res.status(500).json({ error: "Failed to fetch price", details: err?.message });
    }
  });

  // 3. Create Order
  const handleCreateOrder = async (req: Request, res: Response) => {
    try {
      const solUsdPrice = await getSolPriceUsd();
      const {
        user_id,
        usd_amount,
        package_usd,
        tier_id,
        amount_sol,
        is_payg,
        is_coding_plan,
        label,
        message,
      } = req.body || {};

      let usdVal = Number(usd_amount || package_usd || 25);
      let calculatedSol: number;

      if (amount_sol && Number(amount_sol) > 0) {
        calculatedSol = Number(Number(amount_sol).toFixed(5));
        usdVal = Number((calculatedSol * solUsdPrice).toFixed(2));
      } else {
        calculatedSol = Number((usdVal / solUsdPrice).toFixed(5));
      }

      // 1 USD = 1,000,000,000 nanos
      const creditsNanos = Math.round(usdVal * 1_000_000_000);

      // Generate single-use reference public key
      const referenceKeypair = Keypair.generate();
      const referencePubkey = referenceKeypair.publicKey.toBase58();

      const now = new Date();
      const expiresAt = new Date(now.getTime() + ORDER_EXPIRY_SECONDS * 1000);
      const orderId = `tf_ord_${Date.now()}_${randomBytes(4).toString("hex")}`;

      const paymentLabel = label || "TokenForge";
      const paymentMessage = message || (is_coding_plan ? "Coding Plan" : "API Credits");

      const amountStr = calculatedSol.toFixed(5).replace(/\.?0+$/, "");
      const params = new URLSearchParams({
        amount: amountStr,
        reference: referencePubkey,
        label: paymentLabel,
        message: paymentMessage,
      });
      const solanaPayUrl = `solana:${MERCHANT_PUBLIC_KEY}?${params.toString()}`;

      // Persist to MySQL solana_orders
      const db = await getDb();
      if (db) {
        let userEmail: string | null = null;
        let userName: string | null = null;
        if (user_id) {
          const userRows: any = await db.execute(sql`SELECT email, name FROM users WHERE id = ${user_id} LIMIT 1`);
          const found = userRows?.[0]?.[0];
          if (found) {
            userEmail = found.email || null;
            userName = found.name || null;
          }
        }

        await db.execute(sql`
          INSERT INTO solana_orders (
            order_id, user_id, user_email, user_name, usd_amount, sol_amount,
            credits_nanos, reference_pubkey, merchant_pubkey, status,
            created_at, expires_at
          ) VALUES (
            ${orderId}, ${user_id || null}, ${userEmail}, ${userName},
            ${usdVal}, ${calculatedSol}, ${creditsNanos}, ${referencePubkey},
            ${MERCHANT_PUBLIC_KEY}, 'PENDING',
            ${now.toISOString().slice(0, 19).replace('T', ' ')},
            ${expiresAt.toISOString().slice(0, 19).replace('T', ' ')}
          )
        `);
      }

      return res.status(201).json({
        order_id: orderId,
        user_id: user_id || null,
        usd_amount: usdVal,
        sol_amount: calculatedSol,
        sol_usd_price: solUsdPrice,
        reference_pubkey: referencePubkey,
        merchant_pubkey: MERCHANT_PUBLIC_KEY,
        solana_pay_url: solanaPayUrl,
        status: "PENDING",
        created_at: now.toISOString(),
        expires_at: expiresAt.toISOString(),
        expires_in_seconds: ORDER_EXPIRY_SECONDS,
      });
    } catch (err: any) {
      console.error("[Solana Pay] createOrder error:", err);
      return res.status(500).json({ error: "Failed to create order", details: err?.message });
    }
  };

  app.post("/api/solana-pay/create-order", handleCreateOrder);
  app.post("/api/payments/solana/create-order", handleCreateOrder);

  // 4. Verify Order
  app.post("/api/solana-pay/verify-order", async (req: Request, res: Response) => {
    try {
      const { order_id, reference_pubkey } = req.body || {};
      if (!order_id && !reference_pubkey) {
        return res.status(400).json({ error: "Must provide either order_id or reference_pubkey" });
      }

      const db = await getDb();
      if (!db) {
        return res.status(500).json({ error: "Database unavailable" });
      }

      let orderRows: any;
      if (order_id) {
        orderRows = await db.execute(sql`SELECT * FROM solana_orders WHERE order_id = ${order_id} LIMIT 1`);
      } else {
        orderRows = await db.execute(sql`SELECT * FROM solana_orders WHERE reference_pubkey = ${reference_pubkey} LIMIT 1`);
      }

      const order = orderRows?.[0]?.[0];
      if (!order) {
        return res.status(404).json({ error: "Order not found" });
      }

      const orderId = order.order_id;
      const refPubkey = order.reference_pubkey;
      const expectedSol = Number(order.sol_amount);
      const usdAmount = Number(order.usd_amount);
      const userId = order.user_id ? Number(order.user_id) : null;
      const currentStatus = order.status;
      const expiresAt = new Date(order.expires_at).getTime();

      // Already paid/completed
      if (currentStatus === "PAID" || currentStatus === "COMPLETED") {
        return res.json({
          success: true,
          status: "PAID",
          order_id: orderId,
          user_id: userId,
          usd_amount: usdAmount,
          sol_amount: expectedSol,
          reference_pubkey: refPubkey,
          signature: order.signature,
          explorer_url: order.signature ? `https://explorer.solana.com/tx/${order.signature}` : null,
          already_verified: true,
          message: "Order was previously verified and paid.",
        });
      }

      // Expired check
      const now = Date.now();
      if (now > expiresAt) {
        await db.execute(sql`UPDATE solana_orders SET status = 'EXPIRED' WHERE order_id = ${orderId}`);
        return res.json({
          success: false,
          status: "EXPIRED",
          order_id: orderId,
          user_id: userId,
          usd_amount: usdAmount,
          sol_amount: expectedSol,
          reference_pubkey: refPubkey,
          message: "Price quote expired. Please refresh the quote to regenerate an active payment reference.",
        });
      }

      // Query Helius / Solana RPC
      const connection = new Connection(SOLANA_RPC_URL, "confirmed");
      const pubkey = new PublicKey(refPubkey);
      const signatures = await connection.getSignaturesForAddress(pubkey, { limit: 5 });

      if (!signatures || signatures.length === 0) {
        return res.json({
          success: false,
          status: "PENDING",
          order_id: orderId,
          user_id: userId,
          usd_amount: usdAmount,
          sol_amount: expectedSol,
          reference_pubkey: refPubkey,
          message: "Transaction not yet detected on-chain. Listening on Solana...",
        });
      }

      const targetSigInfo = signatures[0];
      const txSignature = targetSigInfo.signature;

      if (targetSigInfo.err) {
        await db.execute(sql`UPDATE solana_orders SET status = 'FAILED', signature = ${txSignature} WHERE order_id = ${orderId}`);
        return res.json({
          success: false,
          status: "FAILED",
          order_id: orderId,
          user_id: userId,
          usd_amount: usdAmount,
          sol_amount: expectedSol,
          reference_pubkey: refPubkey,
          signature: txSignature,
          message: "Transaction failed execution on Solana.",
        });
      }

      // Check double-spending across other orders
      const dupRows: any = await db.execute(
        sql`SELECT order_id FROM solana_orders WHERE signature = ${txSignature} AND order_id != ${orderId} AND status IN ('PAID', 'COMPLETED') LIMIT 1`
      );
      if (dupRows?.[0]?.length > 0) {
        return res.status(409).json({
          error: `Double-spending detected: Transaction ${txSignature} was already claimed by another order.`,
        });
      }

      // Verify transaction details
      const tx = await connection.getParsedTransaction(txSignature, {
        maxSupportedTransactionVersion: 0,
        commitment: "confirmed",
      });

      if (!tx || !tx.meta) {
        return res.json({
          success: false,
          status: "PENDING",
          order_id: orderId,
          user_id: userId,
          usd_amount: usdAmount,
          sol_amount: expectedSol,
          reference_pubkey: refPubkey,
          signature: txSignature,
          message: "Transaction detected, awaiting indexing.",
        });
      }

      // Mark order as PAID and credit user
      const completedAt = new Date().toISOString().slice(0, 19).replace('T', ' ');
      await db.execute(
        sql`UPDATE solana_orders SET status = 'PAID', signature = ${txSignature}, completed_at = ${completedAt} WHERE order_id = ${orderId}`
      );

      let newBalanceNanos: number | null = null;
      if (userId) {
        const creditResult = await creditAccountFromSolanaPay({
          userId,
          amountNanos: Number(order.credits_nanos),
          orderId,
          signature: txSignature,
          assetLabel: "Mainnet SOL",
        });
        newBalanceNanos = creditResult?.balanceNanos ?? null;
      }

      return res.json({
        success: true,
        status: "PAID",
        order_id: orderId,
        user_id: userId,
        usd_amount: usdAmount,
        sol_amount: expectedSol,
        reference_pubkey: refPubkey,
        signature: txSignature,
        explorer_url: `https://explorer.solana.com/tx/${txSignature}`,
        new_balance_nanos: newBalanceNanos,
        message: "Payment successfully verified on Solana Mainnet-Beta. Account credited.",
      });
    } catch (err: any) {
      console.error("[Solana Pay] verifyOrder error:", err);
      return res.status(500).json({ error: "Verification failed", details: err?.message });
    }
  });

  // 5. Order Status
  app.get("/api/solana-pay/order-status/:orderId", async (req: Request, res: Response) => {
    try {
      const orderId = req.params.orderId;
      const db = await getDb();
      if (!db) return res.status(500).json({ error: "Database unavailable" });

      const rows: any = await db.execute(sql`SELECT * FROM solana_orders WHERE order_id = ${orderId} LIMIT 1`);
      const order = rows?.[0]?.[0];
      if (!order) return res.status(404).json({ error: "Order not found" });

      const now = Date.now();
      const expiresAt = new Date(order.expires_at).getTime();
      let statusVal = order.status;
      if (statusVal === "PENDING" && now > expiresAt) {
        statusVal = "EXPIRED";
      }

      return res.json({
        order_id: order.order_id,
        user_id: order.user_id,
        usd_amount: Number(order.usd_amount),
        sol_amount: Number(order.sol_amount),
        reference_pubkey: order.reference_pubkey,
        merchant_pubkey: order.merchant_pubkey,
        status: statusVal,
        signature: order.signature,
        created_at: order.created_at,
        expires_at: order.expires_at,
        seconds_remaining: Math.max(0, Math.floor((expiresAt - now) / 1000)),
      });
    } catch (err: any) {
      return res.status(500).json({ error: "Failed to get status", details: err?.message });
    }
  });

  // 6. Transactions history (from Helius / Solana RPC and DB)
  app.get("/api/solana-pay/transactions", async (req: Request, res: Response) => {
    try {
      const limit = Math.min(50, Math.max(5, parseInt(String(req.query.limit || "30"), 10)));
      const connection = new Connection(SOLANA_RPC_URL, "confirmed");
      const merchantKey = new PublicKey(MERCHANT_PUBLIC_KEY);

      const signatures = await connection.getSignaturesForAddress(merchantKey, { limit });

      const db = await getDb();
      let orderMap = new Map<string, any>();
      if (db) {
        const dbOrders: any = await db.execute(
          sql`SELECT * FROM solana_orders WHERE signature IS NOT NULL ORDER BY completed_at DESC LIMIT 100`
        );
        for (const o of (dbOrders?.[0] || [])) {
          if (o.signature) orderMap.set(o.signature, o);
        }
      }

      const transactions = signatures.map((sig) => {
        const matched = orderMap.get(sig.signature);
        const amountSol = matched ? Number(matched.sol_amount) : 0;
        const creditsNanos = matched ? Number(matched.credits_nanos) : 0;
        const credits = Math.round(creditsNanos / 1_000_000);

        return {
          signature: sig.signature,
          slot: sig.slot,
          timestamp: sig.blockTime ? sig.blockTime * 1000 : Date.now(),
          date: sig.blockTime ? new Date(sig.blockTime * 1000).toISOString() : new Date().toISOString(),
          status: sig.err ? "FAILED" : "CONFIRMED",
          type: "Solana Pay Transfer",
          source: "Helius Mainnet RPC",
          amountSol,
          amountFormatted: `${amountSol > 0 ? amountSol.toFixed(4) : "—"} SOL`,
          creditsNanos,
          creditsFormatted: `${credits > 0 ? credits.toLocaleString() : "—"} Credits`,
          from: "Customer Wallet",
          to: MERCHANT_PUBLIC_KEY,
          feeLamports: 5000,
          feeSol: 0.000005,
          description: matched ? `Order ${matched.order_id}` : "Direct Solana Transfer",
          explorerUrl: `https://explorer.solana.com/tx/${sig.signature}`,
          userEmail: matched?.user_email || null,
          userName: matched?.user_name || null,
          matchedOrder: matched
            ? {
                orderId: matched.order_id,
                userId: matched.user_id,
                userEmail: matched.user_email,
                userName: matched.user_name,
                status: matched.status,
              }
            : null,
        };
      });

      const totalVolumeSol = transactions.reduce((acc, t) => acc + t.amountSol, 0);

      return res.json({
        success: true,
        network: SOLANA_NETWORK,
        provider_source: "Helius RPC",
        merchant_wallet: MERCHANT_PUBLIC_KEY,
        total_transactions: transactions.length,
        total_volume_sol: Number(totalVolumeSol.toFixed(4)),
        transactions,
      });
    } catch (err: any) {
      console.error("[Solana Pay] getTransactions error:", err);
      return res.status(500).json({
        success: false,
        error: err?.message || "Failed to retrieve transactions from Solana RPC",
      });
    }
  });

  // 7. Paid users query (Admin & authenticated users)
  const handleGetPaidUsers = async (req: Request, res: Response) => {
    try {
      const db = await getDb();
      if (!db) {
        return res.status(500).json({ error: "Database unavailable" });
      }

      let authUser;
      try {
        authUser = await sdk.authenticateRequest(req);
      } catch {
        return res.status(401).json({ error: "Unauthorized" });
      }

      if (!authUser?.id) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const isAdminRoute = req.path.includes("/api/admin/");
      const isAdminRequest = isAdminRoute && Boolean(authUser.isAdminSession);

      if (isAdminRoute && !isAdminRequest) {
        return res.status(403).json({ error: "Forbidden: Administrator session required" });
      }

      let query;
      if (isAdminRequest) {
        query = sql`
          SELECT 
            so.order_id as orderId,
            so.user_id as userId,
            COALESCE(so.user_email, u.email) as userEmail,
            COALESCE(so.user_name, u.name) as userName,
            so.sol_amount as solAmount,
            so.usd_amount as usdAmount,
            so.credits_nanos as creditsNanos,
            so.signature,
            so.created_at as createdAt,
            so.completed_at as completedAt,
            so.status
          FROM solana_orders so
          LEFT JOIN users u ON so.user_id = u.id
          WHERE so.status IN ("PAID", "COMPLETED")
          ORDER BY so.completed_at DESC, so.created_at DESC
        `;
      } else {
        query = sql`
          SELECT 
            so.order_id as orderId,
            so.user_id as userId,
            COALESCE(so.user_email, u.email) as userEmail,
            COALESCE(so.user_name, u.name) as userName,
            so.sol_amount as solAmount,
            so.usd_amount as usdAmount,
            so.credits_nanos as creditsNanos,
            so.signature,
            so.created_at as createdAt,
            so.completed_at as completedAt,
            so.status
          FROM solana_orders so
          LEFT JOIN users u ON so.user_id = u.id
          WHERE so.status IN ("PAID", "COMPLETED") AND so.user_id = ${authUser.id}
          ORDER BY so.completed_at DESC, so.created_at DESC
        `;
      }

      const rows: any = await db.execute(query);
      const list = (rows?.[0] || []).map((row: any) => ({
        orderId: row.orderId,
        userId: row.userId,
        userEmail: row.userEmail,
        userName: row.userName,
        solAmount: Number(row.solAmount || 0),
        solFormatted: `${Number(row.solAmount || 0).toFixed(4)} SOL`,
        usdAmount: Number(row.usdAmount || 0),
        usdFormatted: `$${Number(row.usdAmount || 0).toFixed(2)}`,
        credits: Math.round(Number(row.creditsNanos || 0) / 1_000_000),
        creditsFormatted: `${Math.round(Number(row.creditsNanos || 0) / 1_000_000).toLocaleString()}`,
        signature: row.signature,
        explorerUrl: row.signature ? `https://explorer.solana.com/tx/${row.signature}` : null,
        timestamp: row.completedAt || row.createdAt,
        status: row.status,
      }));

      const totalVolumeSol = list.reduce((acc: number, p: any) => acc + p.solAmount, 0);
      const totalVolumeUsd = list.reduce((acc: number, p: any) => acc + p.usdAmount, 0);
      const totalCredits = list.reduce((acc: number, p: any) => acc + p.credits, 0);

      return res.json({
        success: true,
        total_paid_users: new Set(list.map((p: any) => p.userId).filter(Boolean)).size,
        total_transactions: list.length,
        total_volume_sol: Number(totalVolumeSol.toFixed(4)),
        total_volume_usd: Number(totalVolumeUsd.toFixed(2)),
        total_credits: totalCredits,
        payments: list,
      });
    } catch (err: any) {
      console.error("[Solana Pay] handleGetPaidUsers error:", err);
      return res.status(500).json({ error: "Failed to fetch paid users" });
    }
  };

  app.get("/api/solana-pay/paid-users", handleGetPaidUsers);
  app.get("/api/admin/solana-pay/paid-users", handleGetPaidUsers);
}
