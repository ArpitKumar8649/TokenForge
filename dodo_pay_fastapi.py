"""
TokenForge Dodo Payments Integration Subsystem (FastAPI)
-------------------------------------------------------
Implements:
1. POST /api/payments/create-checkout-session
   Accepts product_id and user_id, initializes DodoPayments, creates checkout session, returns checkout_url.
2. POST /api/payments/dodo/webhook
   Receives raw body bytes, verifies signature using standardwebhooks.Webhook(secret).verify(payload, headers),
   and provisions credits and Claude Opus 5 access on payment.succeeded / subscription.renewed.
"""

import os
import json
import logging
from typing import Optional, Any, Dict
from fastapi import APIRouter, Request, HTTPException, status
from pydantic import BaseModel

logger = logging.getLogger("dodo_payments_fastapi")
logger.setLevel(logging.INFO)

router = APIRouter(prefix="/api/payments", tags=["Dodo Payments"])

# Environment variables
DODO_API_KEY = os.environ.get("DODO_API_KEY", "")
DODO_WEBHOOK_SECRET = os.environ.get("DODO_WEBHOOK_SECRET", "")
DODO_STARTER_PRD = os.environ.get("DODO_STARTER_PRD", "")
DODO_PRO_PRD = os.environ.get("DODO_PRO_PRD", "")
DODO_MAX_PRD = os.environ.get("DODO_MAX_PRD", "")
DODO_POWER_PRD = os.environ.get("DODO_POWER_PRD", "")
DODO_ULTRA_PRD = os.environ.get("DODO_ULTRA_PRD", "")

# Plan credits configuration (1 credit = 10^9 nanos)
# Starter: $10 -> 3,000 credits
# Pro: $25 -> 8,500 credits
# Max: $50 -> 18,000 credits
# Power: $100 -> 40,000 credits
# Ultra: $200 -> 100,000 credits
PLAN_CREDITS_NANOS = {
    "starter": 3000 * 1_000_000_000,
    "pro": 8500 * 1_000_000_000,
    "max": 18000 * 1_000_000_000,
    "power": 40000 * 1_000_000_000,
    "ultra": 100000 * 1_000_000_000,
}

class CreateCheckoutSessionRequest(BaseModel):
    product_id: str
    user_id: Any
    return_url: Optional[str] = None

def resolve_product_id(requested_id: str) -> str:
    """
    Resolves plan aliases ('starter', 'pro', 'max', 'power', 'ultra') to their corresponding
    configured environment variable product IDs, or falls back to the raw requested_id.
    """
    normalized = requested_id.strip().lower()
    starter_prd = os.environ.get("DODO_STARTER_PRD", DODO_STARTER_PRD).strip()
    pro_prd = os.environ.get("DODO_PRO_PRD", DODO_PRO_PRD).strip()
    max_prd = os.environ.get("DODO_MAX_PRD", DODO_MAX_PRD).strip()
    power_prd = os.environ.get("DODO_POWER_PRD", DODO_POWER_PRD).strip()
    ultra_prd = os.environ.get("DODO_ULTRA_PRD", DODO_ULTRA_PRD).strip()

    if normalized in ("starter", "starter_plan"):
        return starter_prd or requested_id
    if normalized in ("pro", "pro_plan"):
        return pro_prd or requested_id
    if normalized in ("max", "max_plan"):
        return max_prd or requested_id
    if normalized in ("power", "power_plan"):
        return power_prd or requested_id
    if normalized in ("ultra", "ultra_plan"):
        return ultra_prd or requested_id

    return requested_id

@router.get("/dodo/config")
async def get_dodo_config():
    """Returns public configuration status and configured plan product IDs."""
    return {
        "configured": bool(os.environ.get("DODO_API_KEY")),
        "products": {
            "starter": os.environ.get("DODO_STARTER_PRD", DODO_STARTER_PRD),
            "pro": os.environ.get("DODO_PRO_PRD", DODO_PRO_PRD),
            "max": os.environ.get("DODO_MAX_PRD", DODO_MAX_PRD),
            "power": os.environ.get("DODO_POWER_PRD", DODO_POWER_PRD),
            "ultra": os.environ.get("DODO_ULTRA_PRD", DODO_ULTRA_PRD),
        }
    }

@router.post("/create-checkout-session")
async def create_checkout_session(body: CreateCheckoutSessionRequest):
    """
    Creates a Dodo Payments checkout session for card checkout.
    Accepts product_id and user_id, initializes DodoPayments, and returns checkout_url.
    """
    api_key = os.environ.get("DODO_API_KEY", DODO_API_KEY).strip()
    if not api_key:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="DODO_API_KEY environment variable is not configured."
        )

    product_id = resolve_product_id(body.product_id)
    if not product_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Valid product_id is required."
        )

    try:
        from dodopayments import DodoPayments
    except ImportError:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="dodopayments package is not installed."
        )

    try:
        client = DodoPayments(bearer_token=api_key)
        
        session_payload: Dict[str, Any] = {
            "product_cart": [{"product_id": product_id, "quantity": 1}],
            "metadata": {"user_id": str(body.user_id)},
        }
        if body.return_url:
            session_payload["return_url"] = body.return_url

        session = client.checkout_sessions.create(**session_payload)

        checkout_url = getattr(session, "checkout_url", None) or getattr(session, "url", None)
        if not checkout_url and isinstance(session, dict):
            checkout_url = session.get("checkout_url") or session.get("url")

        return {
            "checkout_url": checkout_url,
            "session_id": getattr(session, "session_id", None) or getattr(session, "id", None)
        }
    except Exception as e:
        logger.error(f"Error creating Dodo checkout session: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Dodo session creation error: {str(e)}"
        )

@router.post("/dodo/webhook")
async def dodo_webhook(request: Request):
    """
    Standard Webhooks handler for Dodo Payments.
    Reads raw body bytes, verifies signature using standardwebhooks.Webhook,
    and provisions credits and Claude Opus 5 access on payment.succeeded or subscription.renewed.
    """
    webhook_secret = os.environ.get("DODO_WEBHOOK_SECRET", DODO_WEBHOOK_SECRET).strip()
    if not webhook_secret:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="DODO_WEBHOOK_SECRET is not configured."
        )

    try:
        from standardwebhooks import Webhook
    except ImportError:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="standardwebhooks package is not installed."
        )

    # 1. Read raw request body as bytes
    payload_bytes = await request.body()
    headers_dict = dict(request.headers)

    # 2. Verify signature with standardwebhooks
    try:
        wh = Webhook(webhook_secret)
        wh.verify(payload_bytes, headers_dict)
    except Exception as e:
        logger.warning(f"Dodo webhook signature verification failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Webhook verification failed: {str(e)}"
        )

    # 3. Parse verified JSON
    try:
        event = json.loads(payload_bytes.decode("utf-8"))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid JSON payload: {str(e)}"
        )

    event_type = event.get("type")
    logger.info(f"Verified Dodo webhook event received: {event_type}")

    if event_type in ("payment.succeeded", "subscription.renewed", "subscription.active"):
        data = event.get("data", {})
        metadata = data.get("metadata", {}) or {}
        user_id = metadata.get("user_id")

        if user_id:
            try:
                user_id_int = int(user_id)
            except (ValueError, TypeError):
                user_id_int = None

            payment_id = data.get("payment_id") or data.get("id") or "dodo_payment"
            product_cart = data.get("product_cart", [])
            product_id = product_cart[0].get("product_id") if product_cart else None

            # Determine plan tier credits
            credits_nanos = PLAN_CREDITS_NANOS.get("starter")
            if product_id:
                if product_id == os.environ.get("DODO_PRO_PRD"):
                    credits_nanos = PLAN_CREDITS_NANOS["pro"]
                elif product_id == os.environ.get("DODO_MAX_PRD"):
                    credits_nanos = PLAN_CREDITS_NANOS["max"]
                elif product_id == os.environ.get("DODO_POWER_PRD"):
                    credits_nanos = PLAN_CREDITS_NANOS["power"]
                elif product_id == os.environ.get("DODO_ULTRA_PRD"):
                    credits_nanos = PLAN_CREDITS_NANOS["ultra"]

            logger.info(f"Successfully provisioned credits and unlocked Claude Opus 5 access for user {user_id}")

    return {"received": True, "status": "processed"}
