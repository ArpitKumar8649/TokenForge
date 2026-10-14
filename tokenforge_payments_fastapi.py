"""
TokenForge Dual-Rail Payment Subsystem - Unified FastAPI Master Service
------------------------------------------------------------------------
Cleanly separating:
1. Global / International: Solana Pay (native SOL on Solana Mainnet-Beta via Helius)
2. Domestic India: Direct UPI QR + UTR Verification (zero-fee via NPCI standard intent links)

Run with:
    uvicorn tokenforge_payments_fastapi:app --reload --port 8000
"""

import os
from fastapi import FastAPI, APIRouter
from fastapi.middleware.cors import CORSMiddleware

# Import individual rails
from solana_pay_fastapi import app as solana_app
from upi_pay_fastapi import router as upi_router, admin_router as upi_admin_router, UPI_ID
from dodo_pay_fastapi import router as dodo_router

app = FastAPI(
    title="TokenForge Unified Multi-Rail Payment Subsystem",
    description="Multi-rail payment processing: Dodo Payments (Global Cards/Apple Pay), Solana Pay (Crypto), & Direct UPI (India Domestic)",
    version="2.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount Solana Pay router & routes from solana_pay_fastapi
for route in solana_app.routes:
    # Avoid duplicating root docs or health if already present
    if getattr(route, "path", "") not in ["/", "/docs", "/openapi.json"]:
        app.routes.append(route)

# Mount UPI routes
app.include_router(upi_router)
app.include_router(upi_admin_router)

# Mount Dodo Payments routes (/api/payments/create-checkout-session, /api/payments/dodo/webhook)
app.include_router(dodo_router)

@app.get("/")
async def payment_subsystem_info():
    return {
        "service": "TokenForge Dual-Rail Payment Subsystem",
        "status": "operational",
        "rails": {
            "global_crypto": {
                "name": "Solana Pay",
                "network": "mainnet-beta",
                "pricing": "Live Binance SOL/USDT spot quote (10m lock)",
                "endpoints": [
                    "POST /api/solana-pay/create-order",
                    "POST /api/solana-pay/verify-order",
                    "GET  /api/solana-pay/order-status/{order_id}",
                    "GET  /api/solana-pay/transactions"
                ]
            },
            "domestic_india": {
                "name": "Direct UPI QR + UTR",
                "fee": "0%",
                "upi_id": UPI_ID,
                "endpoints": [
                    "POST /api/upi/create-order",
                    "POST /api/upi/submit-utr",
                    "GET  /api/upi/order-status/{order_id}",
                    "POST /api/admin/upi/approve-order/{order_id}",
                    "GET  /api/admin/upi/orders"
                ]
            }
        }
    }
