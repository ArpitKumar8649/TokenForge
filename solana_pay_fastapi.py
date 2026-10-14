"""
TokenForge Solana Pay Integration - Production FastAPI Backend
--------------------------------------------------------------
Production-ready backend for accepting Solana Pay payments on Solana Mainnet-Beta
with dynamic pricing from Binance and 5-minute order expiration, powered by Helius Mainnet RPC.

Specifications:
- Network: mainnet-beta
- Merchant Solana Public Key: CUiXiA54MjUCxF1acboThD8R2CwLsqfDidiT7RWJsD7w
- RPC Endpoint: Helius Mainnet (https://mainnet.helius-rpc.com/?api-key=YOUR_API_KEY)
- Live Price Fetching: Binance public ticker via httpx (https://api.binance.com/api/v3/ticker/price?symbol=SOLUSDT)
- Dynamic pricing: amount_sol = round(package_usd / sol_usd_price, 5)
- Expiration: expires_at = datetime.now(timezone.utc) + timedelta(minutes=5)
- Standard Solana Pay URL:
  solana:CUiXiA54MjUCxF1acboThD8R2CwLsqfDidiT7RWJsD7w?amount=<AMOUNT_SOL>&reference=<REFERENCE_PUBKEY>&label=TokenForge&message=API+Credits

Run with:
    uvicorn solana_pay_fastapi:app --reload --port 8000
"""

import os
import time
import json
import sqlite3
import secrets
import asyncio
import urllib.request
import urllib.error
from datetime import datetime, timezone, timedelta
from typing import Optional, List
from urllib.parse import urlencode, quote

try:
    import httpx
except ImportError:
    httpx = None

from fastapi import FastAPI, HTTPException, status, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

# ==============================================================================
# Configuration & Constants (Production Mainnet-Beta)
# ==============================================================================

MERCHANT_PUBLIC_KEY = os.getenv(
    "SOLANA_MERCHANT_WALLET",
    "CUiXiA54MjUCxF1acboThD8R2CwLsqfDidiT7RWJsD7w"
)
HELIUS_API_KEY = os.getenv("HELIUS_API_KEY", "")
HELIUS_MAINNET_RPC_URL = os.getenv(
    "SOLANA_RPC_URL",
    f"https://mainnet.helius-rpc.com/?api-key={HELIUS_API_KEY}" if HELIUS_API_KEY else "https://api.mainnet-beta.solana.com"
)
SOLANA_NETWORK = "mainnet-beta"
ORDER_EXPIRY_MINUTES = 5
ORDER_EXPIRY_SECONDS = ORDER_EXPIRY_MINUTES * 60  # 300 seconds
LAMPORTS_PER_SOL = 1_000_000_000
DATABASE_PATH = os.getenv("SQLITE_DB_PATH", "solana_pay_orders.db")

# Cache for Binance price to avoid aggressive rate-limits
_cached_sol_price = {"price": 105.0, "updated_at": 0.0}

# ==============================================================================
# Live Price Fetching (Binance Public Ticker)
# ==============================================================================

async def get_sol_price_usd() -> float:
    """
    Queries Binance's public ticker (https://api.binance.com/api/v3/ticker/price?symbol=SOLUSDT)
    using httpx. Caches result for 5 seconds to provide ultra-fast responses and prevent rate limits.
    """
    now = time.time()
    if now - _cached_sol_price["updated_at"] < 5.0 and _cached_sol_price["price"] > 0:
        return _cached_sol_price["price"]

    url = "https://api.binance.com/api/v3/ticker/price?symbol=SOLUSDT"

    if httpx is not None:
        try:
            async with httpx.AsyncClient(timeout=8.0) as client:
                resp = await client.get(url)
                resp.raise_for_status()
                data = resp.json()
                price = float(data["price"])
                _cached_sol_price["price"] = price
                _cached_sol_price["updated_at"] = now
                return price
        except Exception as err:
            print(f"[Solana Pay] Binance httpx price fetch warning: {err}")
    
    # Fallback to urllib asynchronously in thread executor
    loop = asyncio.get_event_loop()
    def _fetch_urllib():
        req = urllib.request.Request(
            url,
            headers={"User-Agent": "TokenForge-SolanaPay/1.0", "Accept": "application/json"}
        )
        with urllib.request.urlopen(req, timeout=8) as response:
            res_body = response.read().decode("utf-8")
            return json.loads(res_body)

    try:
        data = await loop.run_in_executor(None, _fetch_urllib)
        price = float(data["price"])
        _cached_sol_price["price"] = price
        _cached_sol_price["updated_at"] = now
        return price
    except Exception as e:
        print(f"[Solana Pay] Fallback price fetch failed: {e}")
        # Return last known cached price or default
        return _cached_sol_price["price"] if _cached_sol_price["price"] > 0 else 105.0

# ==============================================================================
# Base58 Encoding Helper (zero-dependency fallback for ed25519 pubkey encoding)
# ==============================================================================

ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz"

def b58encode(b: bytes) -> str:
    """Encodes bytes into standard Solana Base58 string representation."""
    n = int.from_bytes(b, "big")
    chars = []
    while n > 0:
        n, r = divmod(n, 58)
        chars.append(ALPHABET[r])
    res = "".join(reversed(chars))
    pad = 0
    for byte in b:
        if byte == 0:
            pad += 1
        else:
            break
    return (ALPHABET[0] * pad) + (res or (ALPHABET[0] if not b else ""))

def generate_single_use_reference_pubkey() -> str:
    """
    Generates a unique, single-use ed25519 Keypair to act as the payment 'reference' public key.
    Uses solders if installed, or cryptographically secure random 32-byte seed encoded in Base58.
    """
    try:
        from solders.keypair import Keypair
        kp = Keypair()
        return str(kp.pubkey())
    except ImportError:
        random_bytes = secrets.token_bytes(32)
        return b58encode(random_bytes)

# ==============================================================================
# Database Persistence (SQLite)
# ==============================================================================

def get_db_connection():
    conn = sqlite3.connect(DATABASE_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    with get_db_connection() as conn:
        cursor = conn.cursor()
        # Orders table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS orders (
                order_id TEXT PRIMARY KEY,
                user_id INTEGER,
                usd_amount REAL NOT NULL,
                sol_amount REAL NOT NULL,
                reference_pubkey TEXT UNIQUE NOT NULL,
                merchant_pubkey TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'PENDING',
                solana_pay_url TEXT NOT NULL,
                signature TEXT UNIQUE,
                created_at INTEGER NOT NULL,
                expires_at INTEGER NOT NULL,
                completed_at INTEGER,
                error_message TEXT
            )
        """)
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_orders_ref ON orders (reference_pubkey)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_orders_user ON orders (user_id)")

        # Users table (credit balances in nanos: 1 USD = 1_000_000_000 nanos)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS users (
                user_id INTEGER PRIMARY KEY,
                balance_nanos INTEGER NOT NULL DEFAULT 0,
                updated_at INTEGER NOT NULL
            )
        """)
        conn.commit()

init_db()

# ==============================================================================
# Helius Mainnet RPC Client
# ==============================================================================

def call_helius_rpc(method: str, params: list) -> dict:
    """Makes a JSON-RPC call to Helius Mainnet RPC."""
    payload = {
        "jsonrpc": "2.0",
        "id": "tokenforge-solana-pay-mainnet",
        "method": method,
        "params": params
    }
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        HELIUS_MAINNET_RPC_URL,
        data=data,
        headers={"Content-Type": "application/json", "User-Agent": "TokenForge-SolanaPay/1.0"}
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as response:
            res_body = response.read().decode("utf-8")
            res_json = json.loads(res_body)
            if "error" in res_json:
                raise HTTPException(
                    status_code=status.HTTP_502_BAD_GATEWAY,
                    detail=f"Helius RPC Error: {res_json['error']}"
                )
            return res_json.get("result")
    except urllib.error.URLError as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Failed to communicate with Helius Mainnet RPC: {str(e)}"
        )

# ==============================================================================
# FastAPI Application & Schemas
# ==============================================================================

app = FastAPI(
    title="TokenForge Solana Pay Service",
    description="Production Solana Pay backend on Solana Mainnet-Beta with dynamic pricing and Helius RPC",
    version="2.0.0"
)

# CORS Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class CreateOrderRequest(BaseModel):
    user_id: Optional[int] = Field(None, description="Internal TokenForge user ID")
    usd_amount: Optional[float] = Field(None, gt=0, description="Package amount in USD (e.g. 5, 10, 25)")
    package_usd: Optional[float] = Field(None, gt=0, description="Alias for usd_amount")
    amount_sol: Optional[float] = Field(None, gt=0, description="Optional explicit SOL amount")
    label: Optional[str] = Field("TokenForge", description="Payment label displayed in wallet")
    message: Optional[str] = Field("API Credits", description="Custom message attached to the order")

class CreateOrderResponse(BaseModel):
    order_id: str
    user_id: Optional[int]
    usd_amount: float
    sol_amount: float
    sol_usd_price: float
    reference_pubkey: str
    merchant_pubkey: str
    solana_pay_url: str
    status: str
    created_at: str
    expires_at: str
    expires_in_seconds: int

class VerifyOrderRequest(BaseModel):
    order_id: Optional[str] = Field(None, description="Unique TokenForge order identifier")
    reference_pubkey: Optional[str] = Field(None, description="Single-use payment reference pubkey")

class VerifyOrderResponse(BaseModel):
    success: bool
    status: str
    order_id: str
    user_id: Optional[int]
    usd_amount: float
    sol_amount: float
    reference_pubkey: str
    signature: Optional[str] = None
    explorer_url: Optional[str] = None
    already_verified: Optional[bool] = False
    new_balance_nanos: Optional[int] = None
    message: Optional[str] = None

# ==============================================================================
# Endpoints
# ==============================================================================

@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "service": "TokenForge Solana Pay Gateway (Production)",
        "network": SOLANA_NETWORK,
        "merchant_pubkey": MERCHANT_PUBLIC_KEY
    }

@app.get("/api/solana-pay/config")
def get_config():
    """Returns production payment configuration for client wallet adapters."""
    return {
        "merchant_pubkey": MERCHANT_PUBLIC_KEY,
        "solana_rpc_url": HELIUS_MAINNET_RPC_URL,
        "network": SOLANA_NETWORK,
        "accepted_asset": "SOL",
        "expiry_minutes": ORDER_EXPIRY_MINUTES,
        "expiry_seconds": ORDER_EXPIRY_SECONDS
    }

@app.get("/api/solana-pay/price")
async def get_price():
    """Returns live SOL/USD price from Binance and precomputed package amounts."""
    price = await get_sol_price_usd()
    packages = [
        {"usd": 5, "sol": round(5 / price, 5), "label": "Starter"},
        {"usd": 10, "sol": round(10 / price, 5), "label": "Basic"},
        {"usd": 25, "sol": round(25 / price, 5), "label": "Developer", "popular": True},
        {"usd": 50, "sol": round(50 / price, 5), "label": "Scale"},
        {"usd": 100, "sol": round(100 / price, 5), "label": "Pro"}
    ]
    return {
        "symbol": "SOLUSDT",
        "sol_usd_price": price,
        "source": "Binance Public Ticker",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "packages": packages
    }

@app.post("/api/solana-pay/create-order", response_model=CreateOrderResponse, status_code=status.HTTP_201_CREATED)
async def create_order(req: CreateOrderRequest):
    """
    1. Fetches live SOL price from Binance via get_sol_price_usd().
    2. Converts USD packages (e.g., $5, $10, $25) to SOL dynamically:
       amount_sol = round(package_usd / sol_usd_price, 5)
    3. Generates a unique, single-use Solana Keypair to act as the reference key.
    4. Sets expires_at = datetime.now(timezone.utc) + timedelta(minutes=5).
    5. Stores the order in the database with status PENDING, storing:
       order_id, user_id, usd_amount, sol_amount, reference_pubkey, and expires_at.
    6. Constructs and returns the standard Solana Pay URL:
       solana:CUiXiA54MjUCxF1acboThD8R2CwLsqfDidiT7RWJsD7w?amount=<AMOUNT_SOL>&reference=<REFERENCE_PUBKEY>&label=TokenForge&message=API+Credits
    """
    sol_usd_price = await get_sol_price_usd()

    # Determine USD amount (default to $25 if not provided)
    usd_val = req.usd_amount or req.package_usd or 25.0

    # Calculate amount_sol dynamically: amount_sol = round(package_usd / sol_usd_price, 5)
    if req.amount_sol is not None and req.amount_sol > 0:
        amount_sol = round(req.amount_sol, 5)
        usd_val = round(amount_sol * sol_usd_price, 2)
    else:
        amount_sol = round(usd_val / sol_usd_price, 5)

    # 1. Generate unique single-use reference public key
    reference_pubkey = generate_single_use_reference_pubkey()

    # 2. Timing: 5-minute expiration
    now_dt = datetime.now(timezone.utc)
    expires_dt = now_dt + timedelta(minutes=ORDER_EXPIRY_MINUTES)
    now_ts = int(now_dt.timestamp())
    expires_ts = int(expires_dt.timestamp())

    order_id = f"tf_ord_{int(time.time() * 1000)}_{secrets.token_hex(4)}"

    # 3. Construct standard Solana Pay URL
    label = req.label or "TokenForge"
    message = req.message or "API Credits"
    
    # Amount formatted with up to 5 decimals without trailing zeros
    amount_str = f"{amount_sol:.5f}".rstrip("0").rstrip(".")
    query_params = {
        "amount": amount_str,
        "reference": reference_pubkey,
        "label": label,
        "message": message
    }
    solana_pay_url = f"solana:{MERCHANT_PUBLIC_KEY}?{urlencode(query_params, quote_via=quote)}"

    # 4. Store order in database with status PENDING
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO orders (
                order_id, user_id, usd_amount, sol_amount, reference_pubkey,
                merchant_pubkey, status, solana_pay_url, created_at, expires_at
            ) VALUES (?, ?, ?, ?, ?, ?, 'PENDING', ?, ?, ?)
        """, (
            order_id, req.user_id, usd_val, amount_sol, reference_pubkey,
            MERCHANT_PUBLIC_KEY, solana_pay_url, now_ts, expires_ts
        ))
        conn.commit()

    return CreateOrderResponse(
        order_id=order_id,
        user_id=req.user_id,
        usd_amount=usd_val,
        sol_amount=amount_sol,
        sol_usd_price=sol_usd_price,
        reference_pubkey=reference_pubkey,
        merchant_pubkey=MERCHANT_PUBLIC_KEY,
        solana_pay_url=solana_pay_url,
        status="PENDING",
        created_at=now_dt.isoformat(),
        expires_at=expires_dt.isoformat(),
        expires_in_seconds=ORDER_EXPIRY_SECONDS
    )

@app.post("/api/solana-pay/verify-order", response_model=VerifyOrderResponse)
def verify_order(req: VerifyOrderRequest):
    """
    1. Check if the order has expired (current_time > expires_at). If expired,
       return an EXPIRED status so the frontend can prompt the user to refresh the quote.
    2. Query Helius Mainnet RPC using getSignaturesForAddress on the reference key.
    3. If a confirmed or finalized transaction signature is found:
       - Verify the recipient is CUiXiA54MjUCxF1acboThD8R2CwLsqfDidiT7RWJsD7w.
       - Verify the transferred SOL matches sol_amount.
       - Mark the order as PAID in a database transaction and immediately increment
         the user's API credit balance.
    """
    if not req.order_id and not req.reference_pubkey:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Must provide either order_id or reference_pubkey"
        )

    with get_db_connection() as conn:
        cursor = conn.cursor()
        if req.order_id:
            cursor.execute("SELECT * FROM orders WHERE order_id = ?", (req.order_id,))
        else:
            cursor.execute("SELECT * FROM orders WHERE reference_pubkey = ?", (req.reference_pubkey,))
        order = cursor.fetchone()

        if not order:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Order not found"
            )

        order_id = order["order_id"]
        reference_pubkey = order["reference_pubkey"]
        expected_sol = float(order["sol_amount"])
        usd_amount = float(order["usd_amount"])
        user_id = order["user_id"]
        status_current = order["status"]
        expires_at_ts = order["expires_at"]

        # If already verified/paid, return success immediately
        if status_current in ("PAID", "COMPLETED"):
            return VerifyOrderResponse(
                success=True,
                status="PAID",
                order_id=order_id,
                user_id=user_id,
                usd_amount=usd_amount,
                amount_sol=expected_sol,
                reference_pubkey=reference_pubkey,
                signature=order["signature"],
                explorer_url=f"https://explorer.solana.com/tx/{order['signature']}",
                already_verified=True,
                message="Order was previously verified and paid."
            )

        # 1. Expiration check: current_time > expires_at
        now_ts = int(time.time())
        if now_ts > expires_at_ts:
            cursor.execute("UPDATE orders SET status = 'EXPIRED' WHERE order_id = ?", (order_id,))
            conn.commit()
            return VerifyOrderResponse(
                success=False,
                status="EXPIRED",
                order_id=order_id,
                user_id=user_id,
                usd_amount=usd_amount,
                amount_sol=expected_sol,
                reference_pubkey=reference_pubkey,
                message="Price quote expired. Please refresh the quote to regenerate an active payment reference."
            )

        # 2. Query Helius Mainnet RPC for signatures on reference key
        signatures_res = call_helius_rpc(
            "getSignaturesForAddress",
            [reference_pubkey, {"limit": 5, "commitment": "confirmed"}]
        )

        if not signatures_res:
            return VerifyOrderResponse(
                success=False,
                status="PENDING",
                order_id=order_id,
                user_id=user_id,
                usd_amount=usd_amount,
                amount_sol=expected_sol,
                reference_pubkey=reference_pubkey,
                message="Transaction not yet detected on-chain. Listening on Helius RPC..."
            )

        # Grab latest transaction signature referencing this payment
        target_sig_info = signatures_res[0]
        tx_signature = target_sig_info["signature"]

        # Check for transaction execution error
        if target_sig_info.get("err") is not None:
            cursor.execute("""
                UPDATE orders SET status = 'FAILED', signature = ?, error_message = ? WHERE order_id = ?
            """, (tx_signature, json.dumps(target_sig_info.get("err")), order_id))
            conn.commit()
            return VerifyOrderResponse(
                success=False,
                status="FAILED",
                order_id=order_id,
                user_id=user_id,
                usd_amount=usd_amount,
                amount_sol=expected_sol,
                reference_pubkey=reference_pubkey,
                signature=tx_signature,
                message="Transaction failed execution on Solana."
            )

        # Idempotency / Double-spending check across all orders
        cursor.execute(
            "SELECT order_id FROM orders WHERE signature = ? AND order_id != ? AND status IN ('PAID', 'COMPLETED')",
            (tx_signature, order_id)
        )
        duplicate = cursor.fetchone()
        if duplicate:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Double-spending detected: Transaction {tx_signature} was already claimed by order {duplicate['order_id']}."
            )

        # 3. Query full transaction details from Helius to verify recipient and amount
        tx_details = call_helius_rpc(
            "getTransaction",
            [tx_signature, {"encoding": "jsonParsed", "maxSupportedTransactionVersion": 0, "commitment": "confirmed"}]
        )

        if not tx_details or not tx_details.get("meta"):
            return VerifyOrderResponse(
                success=False,
                status="PENDING",
                order_id=order_id,
                user_id=user_id,
                usd_amount=usd_amount,
                amount_sol=expected_sol,
                reference_pubkey=reference_pubkey,
                signature=tx_signature,
                message="Transaction detected, awaiting indexing."
            )

        meta = tx_details["meta"]
        if meta.get("err") is not None:
            cursor.execute("UPDATE orders SET status = 'FAILED', signature = ? WHERE order_id = ?", (tx_signature, order_id))
            conn.commit()
            return VerifyOrderResponse(
                success=False,
                status="FAILED",
                order_id=order_id,
                user_id=user_id,
                usd_amount=usd_amount,
                amount_sol=expected_sol,
                reference_pubkey=reference_pubkey,
                signature=tx_signature,
                message="Transaction finalized with error."
            )

        # Verify recipient is CUiXiA54MjUCxF1acboThD8R2CwLsqfDidiT7RWJsD7w
        account_keys = [
            acc if isinstance(acc, str) else acc.get("pubkey")
            for acc in tx_details["transaction"]["message"]["accountKeys"]
        ]

        amount_verified = False
        expected_lamports = int(expected_sol * LAMPORTS_PER_SOL)

        if MERCHANT_PUBLIC_KEY in account_keys:
            m_idx = account_keys.index(MERCHANT_PUBLIC_KEY)
            pre_bal = meta["preBalances"][m_idx]
            post_bal = meta["postBalances"][m_idx]
            lamports_diff = post_bal - pre_bal
            # Allow 0.5% tolerance margin for any tiny network fee variance
            if lamports_diff >= expected_lamports * 0.995:
                amount_verified = True

        # Check parsed instructions as secondary verification
        if not amount_verified:
            instructions = tx_details["transaction"]["message"].get("instructions", [])
            for ix in instructions:
                if ix.get("program") == "system" and ix.get("parsed", {}).get("type") == "transfer":
                    info = ix["parsed"]["info"]
                    if (info.get("destination") == MERCHANT_PUBLIC_KEY and
                        int(info.get("lamports", 0)) >= expected_lamports * 0.995):
                        amount_verified = True
                        break

        if not amount_verified:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Verification failed: Merchant address {MERCHANT_PUBLIC_KEY} did not receive expected {expected_sol} SOL."
            )

        # 4. Mark order as PAID in a database transaction and immediately increment user's API credit balance
        completed_ts = int(time.time())
        cursor.execute("""
            UPDATE orders
            SET status = 'PAID', signature = ?, completed_at = ?
            WHERE order_id = ?
        """, (tx_signature, completed_ts, order_id))

        new_balance = None
        if user_id:
            # 1 USD = 1_000_000_000 nanos
            credit_nanos_to_add = int(usd_amount * 1_000_000_000)
            cursor.execute("""
                INSERT INTO users (user_id, balance_nanos, updated_at)
                VALUES (?, ?, ?)
                ON CONFLICT(user_id) DO UPDATE SET
                    balance_nanos = balance_nanos + excluded.balance_nanos,
                    updated_at = excluded.updated_at
            """, (user_id, credit_nanos_to_add, completed_ts))

            cursor.execute("SELECT balance_nanos FROM users WHERE user_id = ?", (user_id,))
            user_row = cursor.fetchone()
            if user_row:
                new_balance = user_row["balance_nanos"]

        conn.commit()

        return VerifyOrderResponse(
            success=True,
            status="PAID",
            order_id=order_id,
            user_id=user_id,
            usd_amount=usd_amount,
            amount_sol=expected_sol,
            reference_pubkey=reference_pubkey,
            signature=tx_signature,
            explorer_url=f"https://explorer.solana.com/tx/{tx_signature}",
            new_balance_nanos=new_balance,
            message="Payment successfully verified on Solana Mainnet-Beta. Account credited."
        )

@app.get("/api/solana-pay/order-status/{order_id}")
def get_order_status(order_id: str):
    """Returns current status and countdown for a pending or completed order."""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM orders WHERE order_id = ?", (order_id,))
        order = cursor.fetchone()
        if not order:
            raise HTTPException(status_code=404, detail="Order not found")

        now_ts = int(time.time())
        expires_at = order["expires_at"]
        status_val = order["status"]
        if status_val == "PENDING" and now_ts > expires_at:
            status_val = "EXPIRED"

        return {
            "order_id": order["order_id"],
            "user_id": order["user_id"],
            "usd_amount": order["usd_amount"],
            "sol_amount": order["sol_amount"],
            "reference_pubkey": order["reference_pubkey"],
            "merchant_pubkey": order["merchant_pubkey"],
            "solana_pay_url": order["solana_pay_url"],
            "status": status_val,
            "signature": order["signature"],
            "created_at": datetime.fromtimestamp(order["created_at"], tz=timezone.utc).isoformat(),
            "expires_at": datetime.fromtimestamp(expires_at, tz=timezone.utc).isoformat(),
            "seconds_remaining": max(0, expires_at - now_ts)
        }

if __name__ == "__main__":
    import uvicorn
    print(f"Starting TokenForge Solana Pay Production Backend on port 8000...")
    print(f"Network: {SOLANA_NETWORK}")
    print(f"Merchant Wallet: {MERCHANT_PUBLIC_KEY}")
    print(f"Helius RPC: {HELIUS_MAINNET_RPC_URL}")
    uvicorn.run(app, host="0.0.0.0", port=8000)
