"""
TokenForge UPI Payment Rail - Production FastAPI Router & Application
----------------------------------------------------------------------
Zero-fee Indian domestic UPI payments using dynamic NPCI URIs and 12-digit UTR verification.
Works directly with Google Pay, PhonePe, Paytm, and BHIM without intermediate gateway costs.

Endpoints:
- POST /api/upi/create-order
- POST /api/upi/submit-utr
- GET  /api/upi/order-status/{order_id}
- POST /api/admin/upi/approve-order/{order_id} (and POST /api/admin/upi/approve)
- POST /api/admin/upi/reject-order/{order_id}
- GET  /api/admin/upi/orders

Run standalone with:
    uvicorn upi_pay_fastapi:app --reload --port 8001
"""

import os
import re
import secrets
from datetime import datetime, timezone
from typing import Optional, Dict, Any, List
from fastapi import FastAPI, APIRouter, HTTPException, status, Header, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

# ==============================================================================
# Configuration & Constants
# ==============================================================================

UPI_ID = os.getenv("UPI_ID", os.getenv("UPI_VPA", "tokenforge@upi"))
MERCHANT_NAME = os.getenv("UPI_MERCHANT_NAME", "TokenForge")
ADMIN_SECRET_KEY = os.getenv("ADMIN_SECRET_KEY", os.getenv("TOKENFORGE_ADMIN_PASSCODE", "")).strip()

# Preset domestic INR tiers
UPI_PRESET_TIERS = {
    "inr_starter": {"name": "Starter", "amount_inr": 99.0, "credits": 500},
    "inr_developer": {"name": "Developer", "amount_inr": 499.0, "credits": 3000},
    "inr_power": {"name": "Power User", "amount_inr": 999.0, "credits": 7500},
    "inr_scale": {"name": "Scale", "amount_inr": 2499.0, "credits": 20000},
}

# In-memory storage (replace or sync with PostgreSQL/TiDB collection in clustered production)
ORDERS_DB: Dict[str, Dict[str, Any]] = {}
UTR_REGISTRY: set[str] = set()

# ==============================================================================
# Pydantic Request & Response Schemas
# ==============================================================================

class CreateUPIOrderRequest(BaseModel):
    user_id: Optional[str] = Field(default="guest", description="TokenForge user ID")
    tier_id: Optional[str] = Field(default="inr_starter", description="Tier identifier")
    amount_inr: float = Field(..., gt=0, description="Amount in INR (must be positive)")
    credits: int = Field(..., gt=0, description="Amount of API credits to award")


class CreateUPIOrderResponse(BaseModel):
    success: bool = True
    order_id: str
    amount_inr: float
    credits: int
    upi_id: str
    upi_uri: str
    status: str
    created_at: str


class SubmitUTRRequest(BaseModel):
    order_id: str = Field(..., description="Order ID returned during checkout creation")
    utr: str = Field(..., description="12-digit numeric UPI reference number")


class SubmitUTRResponse(BaseModel):
    success: bool = True
    status: str = "PENDING_VERIFICATION"
    order_id: str
    utr: str
    message: str


class OrderStatusResponse(BaseModel):
    order_id: str
    status: str
    credits: int
    amount_inr: float
    utr: Optional[str] = None
    created_at: str
    submitted_at: Optional[str] = None
    completed_at: Optional[str] = None


class AdminApproveRequest(BaseModel):
    order_id: str
    admin_key: Optional[str] = None


# ==============================================================================
# FastAPI Router Setup
# ==============================================================================

router = APIRouter(prefix="/api/upi", tags=["Domestic UPI Payments"])
admin_router = APIRouter(prefix="/api/admin/upi", tags=["UPI Admin Management"])

@router.get("/config")
async def get_upi_config():
    """Returns current merchant VPA and preset tiers."""
    return {
        "success": True,
        "upi_id": UPI_ID,
        "merchant_name": MERCHANT_NAME,
        "currency": "INR",
        "tiers": UPI_PRESET_TIERS,
    }


@router.post("/create-order", response_model=CreateUPIOrderResponse)
async def create_upi_order(payload: CreateUPIOrderRequest):
    """
    Creates an order record and constructs the standard NPCI UPI URI:
    upi://pay?pa=<UPI_ID>&pn=TokenForge&am=<AMOUNT>&cu=INR&tn=Order_<ORDER_ID>
    """
    now_utc = datetime.now(timezone.utc)
    ts = int(now_utc.timestamp())
    uid_suffix = str(payload.user_id)[:4] if payload.user_id else "gst"
    order_id = f"TF_{ts}_{uid_suffix}"

    # Standard NPCI UPI URI Specification
    upi_uri = (
        f"upi://pay?pa={UPI_ID}"
        f"&pn={MERCHANT_NAME}"
        f"&am={payload.amount_inr:.2f}"
        f"&cu=INR"
        f"&tn=Order_{order_id}"
    )

    order_record = {
        "order_id": order_id,
        "user_id": payload.user_id,
        "tier_id": payload.tier_id,
        "amount_inr": payload.amount_inr,
        "credits": payload.credits,
        "upi_id": UPI_ID,
        "upi_uri": upi_uri,
        "status": "PENDING_PAYMENT",  # PENDING_PAYMENT -> PENDING_VERIFICATION -> COMPLETED / REJECTED
        "utr": None,
        "created_at": now_utc.isoformat(),
        "submitted_at": None,
        "completed_at": None,
    }

    ORDERS_DB[order_id] = order_record

    return CreateUPIOrderResponse(
        success=True,
        order_id=order_id,
        amount_inr=payload.amount_inr,
        credits=payload.credits,
        upi_id=UPI_ID,
        upi_uri=upi_uri,
        status="PENDING_PAYMENT",
        created_at=order_record["created_at"],
    )


@router.post("/submit-utr", response_model=SubmitUTRResponse)
async def submit_utr(payload: SubmitUTRRequest):
    """
    Validates the 12-digit numeric UTR format, prevents duplicate submissions (anti-replay),
    and transitions the order to PENDING_VERIFICATION.
    """
    clean_utr = payload.utr.strip()

    # 1. Strict 12-digit format validation
    if not re.match(r"^\d{12}$", clean_utr):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid UTR format. UTR must be exactly 12 numeric digits.",
        )

    # 2. Prevent Replay Attacks (duplicate UTR reuse across orders)
    if clean_utr in UTR_REGISTRY:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This UTR has already been submitted for an order.",
        )

    order = ORDERS_DB.get(payload.order_id)
    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Order not found.",
        )

    if order["status"] == "COMPLETED":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Order already credited.",
        )

    # 3. Update order status to PENDING_VERIFICATION
    order["utr"] = clean_utr
    order["status"] = "PENDING_VERIFICATION"
    order["submitted_at"] = datetime.now(timezone.utc).isoformat()
    UTR_REGISTRY.add(clean_utr)

    return SubmitUTRResponse(
        success=True,
        status="PENDING_VERIFICATION",
        order_id=order["order_id"],
        utr=clean_utr,
        message="UTR submitted successfully. Credits will be added upon bank confirmation.",
    )


@router.get("/order-status/{order_id}", response_model=OrderStatusResponse)
async def check_order_status(order_id: str):
    """
    Allows the frontend checkout modal to poll for status changes.
    """
    order = ORDERS_DB.get(order_id)
    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Order not found.",
        )

    return OrderStatusResponse(
        order_id=order["order_id"],
        status=order["status"],
        credits=order["credits"],
        amount_inr=order["amount_inr"],
        utr=order.get("utr"),
        created_at=order["created_at"],
        submitted_at=order.get("submitted_at"),
        completed_at=order.get("completed_at"),
    )


# ==============================================================================
# Admin Verification & Management Endpoints
# ==============================================================================

def verify_admin_key(
    admin_key_header: Optional[str] = Header(None, alias="x-admin-key"),
    admin_key_query: Optional[str] = Query(None, alias="admin_key"),
    admin_key_body: Optional[str] = None,
):
    provided = (admin_key_header or admin_key_query or admin_key_body or "").strip()
    if not ADMIN_SECRET_KEY or not provided or not secrets.compare_digest(provided, ADMIN_SECRET_KEY):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Unauthorized: Valid administrator secret key required.",
        )


@admin_router.get("/orders")
async def list_admin_orders(
    status_filter: Optional[str] = Query("ALL", alias="status"),
    x_admin_key: Optional[str] = Header(None),
    admin_key: Optional[str] = Query(None),
):
    verify_admin_key(x_admin_key, admin_key)
    orders = list(ORDERS_DB.values())
    if status_filter != "ALL":
        orders = [o for o in orders if o.get("status") == status_filter]

    # Prioritize PENDING_VERIFICATION
    orders.sort(
        key=lambda x: (0 if x["status"] == "PENDING_VERIFICATION" else 1, x["created_at"]),
        reverse=False,
    )
    return {
        "success": True,
        "total": len(orders),
        "orders": orders,
    }


@admin_router.post("/approve-order/{order_id}")
@admin_router.post("/approve")
async def admin_approve_order(
    order_id: Optional[str] = None,
    payload: Optional[AdminApproveRequest] = None,
    x_admin_key: Optional[str] = Header(None),
    admin_key: Optional[str] = Query(None),
):
    target_id = order_id or (payload.order_id if payload else None)
    body_key = payload.admin_key if payload else None
    verify_admin_key(x_admin_key, admin_key, body_key)

    if not target_id:
        raise HTTPException(status_code=400, detail="Missing order_id")

    order = ORDERS_DB.get(target_id)
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    if order["status"] == "COMPLETED":
        return {
            "success": True,
            "already_completed": True,
            "order_id": order["order_id"],
            "credited_user": order["user_id"],
            "added_credits": order["credits"],
        }

    # Transition to COMPLETED
    order["status"] = "COMPLETED"
    order["completed_at"] = datetime.now(timezone.utc).isoformat()

    # Note: In production with database, trigger atomic ledger increment here
    return {
        "success": True,
        "status": "COMPLETED",
        "order_id": order["order_id"],
        "credited_user": order["user_id"],
        "added_credits": order["credits"],
        "message": "Order approved and user credited successfully.",
    }


@admin_router.post("/reject-order/{order_id}")
async def admin_reject_order(
    order_id: str,
    reason: str = Query("UTR could not be reconciled with bank statements"),
    x_admin_key: Optional[str] = Header(None),
    admin_key: Optional[str] = Query(None),
):
    verify_admin_key(x_admin_key, admin_key)
    order = ORDERS_DB.get(order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    order["status"] = "REJECTED"
    order["rejection_reason"] = reason
    return {
        "success": True,
        "status": "REJECTED",
        "order_id": order["order_id"],
        "reason": reason,
    }


# ==============================================================================
# Standalone Application Instance
# ==============================================================================

app = FastAPI(
    title="TokenForge Direct UPI Payment Rail",
    description="Frictionless, zero-gateway Indian domestic UPI payment processing with UTR verification",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)
app.include_router(admin_router)

# Also expose under /api/payments/upi aliases
payments_upi_router = APIRouter(prefix="/api/payments/upi", tags=["Domestic UPI Payments (Aliases)"])
payments_upi_router.add_api_route("/create-order", create_upi_order, methods=["POST"])
payments_upi_router.add_api_route("/submit-utr", submit_utr, methods=["POST"])
payments_upi_router.add_api_route("/status/{order_id}", check_order_status, methods=["GET"])
app.include_router(payments_upi_router)

payments_admin_router = APIRouter(prefix="/api/payments/admin/upi", tags=["UPI Admin (Aliases)"])
payments_admin_router.add_api_route("/verify", admin_approve_order, methods=["POST"])
app.include_router(payments_admin_router)

@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "service": "TokenForge UPI Rail",
        "upi_id": UPI_ID,
        "active_orders": len(ORDERS_DB),
    }
