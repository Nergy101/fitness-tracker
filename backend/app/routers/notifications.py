"""Push notification router — VAPID-based Web Push via pywebpush."""

import json
import logging
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.models import PushSubscription
from app.settings import get_or_create_vapid

logger = logging.getLogger("notifications")
router = APIRouter(prefix="/api/v1/notifications", tags=["notifications"])


# ── Schemas ──────────────────────────────────────────────────

class SubscriptionKeys(BaseModel):
    p256dh: str
    auth: str


class SubscribeRequest(BaseModel):
    endpoint: str
    keys: SubscriptionKeys


class UnsubscribeRequest(BaseModel):
    endpoint: str


class SendRequest(BaseModel):
    title: str = "FitnessTracker"
    body: str = "Test notification"
    icon: str = "/icon-192.png"
    badge: str = "/badge-72.png"


# ── VAPID helper ─────────────────────────────────────────────

_vapid_claims = None  # cached


def _vapid_headers() -> dict:
    global _vapid_claims
    if _vapid_claims is not None:
        return _vapid_claims
    vapid = get_or_create_vapid()
    _vapid_claims = {
        "sub": vapid["subject"],
    }
    return _vapid_claims


def _send_push(subscription: PushSubscription, payload: dict) -> bool:
    """Send a push notification to one subscription. Returns True on success."""
    try:
        from pywebpush import webpush, WebPushException
        vapid_info = get_or_create_vapid()
        claims = _vapid_headers()

        webpush(
            subscription_info={
                "endpoint": subscription.endpoint,
                "keys": {
                    "p256dh": subscription.p256dh,
                    "auth": subscription.auth,
                },
            },
            data=json.dumps(payload),
            vapid_private_key=vapid_info["private_key"],
            vapid_claims=claims,
        )
        return True
    except WebPushException as exc:
        logger.warning(f"WebPush error for {subscription.endpoint}: {exc}")
        if hasattr(exc, "response") and exc.response is not None:
            logger.warning(f"  Response: {exc.response.status_code} {exc.response.text}")
        return False
    except Exception as exc:
        logger.warning(f"Push send failed for {subscription.endpoint}: {exc}")
        return False


# ── Routes ───────────────────────────────────────────────────

@router.post("/subscribe", response_model=dict)
def subscribe(req: SubscribeRequest, request: Request, db: Session = Depends(get_db)):
    """Save or update a push subscription."""
    user_agent = request.headers.get("user-agent", "")
    existing = db.query(PushSubscription).filter_by(endpoint=req.endpoint).first()
    if existing:
        existing.p256dh = req.keys.p256dh
        existing.auth = req.keys.auth
        existing.user_agent = user_agent
    else:
        sub = PushSubscription(
            endpoint=req.endpoint,
            p256dh=req.keys.p256dh,
            auth=req.keys.auth,
            user_agent=user_agent,
        )
        db.add(sub)
    db.commit()
    return {"status": "ok", "subscribed": True}


@router.delete("/subscribe", response_model=dict)
def unsubscribe(req: UnsubscribeRequest, db: Session = Depends(get_db)):
    """Remove a push subscription by endpoint."""
    sub = db.query(PushSubscription).filter_by(endpoint=req.endpoint).first()
    if sub:
        db.delete(sub)
        db.commit()
    return {"status": "ok", "subscribed": False}


@router.post("/send", response_model=dict)
def send_notification(req: SendRequest, db: Session = Depends(get_db)):
    """Send a test notification to all stored subscriptions."""
    subs = db.query(PushSubscription).all()
    sent = 0
    failed = 0
    payload = {
        "title": req.title,
        "body": req.body,
        "icon": req.icon,
        "badge": req.badge,
    }
    for sub in subs:
        if _send_push(sub, payload):
            sent += 1
        else:
            failed += 1
    return {"status": "ok", "sent": sent, "failed": failed, "total": len(subs)}


@router.post("/send-workout-complete", response_model=dict)
def send_workout_complete(db: Session = Depends(get_db)):
    """Fire-and-forget: send 'workout complete' notification to all subscriptions."""
    subs = db.query(PushSubscription).all()
    payload = {
        "title": "Workout Complete! 💪",
        "body": "Great job! Your workout session has been recorded.",
        "icon": "/icon-192.png",
        "badge": "/badge-72.png",
        "data": {"url": "/"},
    }
    sent = 0
    failed = 0
    for sub in subs:
        if _send_push(sub, payload):
            sent += 1
        else:
            failed += 1
    return {"status": "ok", "sent": sent, "failed": failed, "total": len(subs)}
