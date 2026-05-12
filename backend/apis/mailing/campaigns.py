"""
apis/mailing/campaigns.py
=========================
Bulk email campaign management.
Campaigns enqueue emails to mail_queue with priority=3 (bulk).
"""

import logging
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from typing import Optional
from bson import ObjectId

from utils.web3mongo import db
from utils.auth.session import verify_session
from config.roles.access import require_admin_level
from workers.mail_worker import enqueue_email

router = APIRouter()
logger = logging.getLogger(__name__)

CAMPAIGNS_COLL = db.mail_campaigns
TEMPLATES_COLL = db.mail_templates
CUSTOMERS_COLL = db.delivery_customers
QUEUE_COLL = db.mail_queue


# ── Models ──────────────────────────────────────────────────

class CampaignCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    template_id: str = Field(..., description="ID del template a usar")
    audience: dict = Field(
        default_factory=lambda: {"type": "all"},
        description="Filtro de audiencia: {type: 'all'} | {type: 'segment', filter: {...}}"
    )
    vars: dict = Field(default_factory=dict, description="Variables globales para el template")


class CampaignUpdate(BaseModel):
    name: Optional[str] = None
    template_id: Optional[str] = None
    audience: Optional[dict] = None
    vars: Optional[dict] = None


# ── Endpoints ───────────────────────────────────────────────

@router.get("/mailing/campaigns", summary="List campaigns")
async def list_campaigns(
    status: Optional[str] = None,
    user: dict = Depends(verify_session),
):
    require_admin_level(user, "marketing")

    query = {}
    if status:
        query["status"] = status

    campaigns = list(CAMPAIGNS_COLL.find(query).sort("created_at", -1).limit(50))
    for c in campaigns:
        c["_id"] = str(c["_id"])

    return {"success": True, "campaigns": campaigns, "total": len(campaigns)}


@router.post("/mailing/campaigns", summary="Create campaign draft")
async def create_campaign(
    payload: CampaignCreate,
    user: dict = Depends(verify_session),
):
    require_admin_level(user, "marketing")

    # Verify template exists
    if not ObjectId.is_valid(payload.template_id):
        raise HTTPException(status_code=400, detail="Template ID inválido")
    template = TEMPLATES_COLL.find_one({"_id": ObjectId(payload.template_id)})
    if not template:
        raise HTTPException(status_code=404, detail="Template no encontrado")

    now = datetime.now()
    doc = {
        "name": payload.name,
        "template_id": payload.template_id,
        "audience": payload.audience,
        "vars": payload.vars,
        "status": "draft",
        "total": 0,
        "sent": 0,
        "failed": 0,
        "created_at": now,
        "updated_at": now,
        "created_by": user.get("wallet") or user.get("id"),
        "sent_at": None,
    }

    result = CAMPAIGNS_COLL.insert_one(doc)
    logger.info(f"[mailing] Campaign created: {payload.name}")

    return {"success": True, "campaign_id": str(result.inserted_id)}


@router.put("/mailing/campaigns/{campaign_id}", summary="Update campaign draft")
async def update_campaign(
    campaign_id: str,
    payload: CampaignUpdate,
    user: dict = Depends(verify_session),
):
    require_admin_level(user, "marketing")

    if not ObjectId.is_valid(campaign_id):
        raise HTTPException(status_code=400, detail="ID inválido")

    campaign = CAMPAIGNS_COLL.find_one({"_id": ObjectId(campaign_id)})
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaña no encontrada")
    if campaign["status"] != "draft":
        raise HTTPException(status_code=409, detail="Solo se pueden editar campañas en draft")

    updates = {k: v for k, v in payload.dict().items() if v is not None}
    updates["updated_at"] = datetime.now()

    CAMPAIGNS_COLL.update_one({"_id": ObjectId(campaign_id)}, {"$set": updates})
    return {"success": True}


@router.post("/mailing/campaigns/{campaign_id}/send", summary="Send campaign — enqueue all recipients")
async def send_campaign(
    campaign_id: str,
    user: dict = Depends(verify_session),
):
    require_admin_level(user, "marketing")

    if not ObjectId.is_valid(campaign_id):
        raise HTTPException(status_code=400, detail="ID inválido")

    campaign = CAMPAIGNS_COLL.find_one({"_id": ObjectId(campaign_id)})
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaña no encontrada")
    if campaign["status"] not in ("draft", "scheduled"):
        raise HTTPException(status_code=409, detail=f"Campaña está en estado '{campaign['status']}', no se puede enviar")

    # Resolve audience
    audience = campaign.get("audience", {"type": "all"})
    customer_filter = {"email": {"$exists": True, "$ne": ""}}

    if audience.get("type") == "segment" and audience.get("filter"):
        customer_filter.update(audience["filter"])

    customers = list(CUSTOMERS_COLL.find(customer_filter, {"email": 1, "name": 1}))

    if not customers:
        raise HTTPException(status_code=400, detail="No hay destinatarios con email")

    # Enqueue all
    template_id = campaign.get("template_id")
    campaign_vars = campaign.get("vars", {})
    enqueued = 0

    for customer in customers:
        email = customer.get("email", "").strip()
        if not email or "@" not in email:
            continue

        per_customer_vars = {
            **campaign_vars,
            "customer_name": customer.get("name", "Cliente"),
            "customer_email": email,
        }

        enqueue_email(
            to=email,
            subject="",  # From template
            template_id=template_id,
            variables=per_customer_vars,
            priority=3,  # Bulk
            campaign_id=campaign_id,
        )
        enqueued += 1

    # Update campaign
    CAMPAIGNS_COLL.update_one(
        {"_id": ObjectId(campaign_id)},
        {"$set": {
            "status": "sending",
            "total": enqueued,
            "sent_at": datetime.now(),
            "updated_at": datetime.now(),
        }}
    )

    logger.info(f"[mailing] Campaign '{campaign['name']}' enqueued {enqueued} emails")

    return {"success": True, "enqueued": enqueued, "total_recipients": len(customers)}


@router.get("/mailing/campaigns/{campaign_id}/stats", summary="Campaign stats")
async def campaign_stats(
    campaign_id: str,
    user: dict = Depends(verify_session),
):
    require_admin_level(user, "marketing")

    if not ObjectId.is_valid(campaign_id):
        raise HTTPException(status_code=400, detail="ID inválido")

    campaign = CAMPAIGNS_COLL.find_one({"_id": ObjectId(campaign_id)})
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaña no encontrada")

    # Live stats from queue
    cid = campaign_id
    queued = QUEUE_COLL.count_documents({"campaign_id": cid, "status": "queued"})
    sending = QUEUE_COLL.count_documents({"campaign_id": cid, "status": "sending"})
    sent = QUEUE_COLL.count_documents({"campaign_id": cid, "status": "sent"})
    failed = QUEUE_COLL.count_documents({"campaign_id": cid, "status": "failed"})

    # Auto-complete campaign if all done
    if queued == 0 and sending == 0 and campaign["status"] == "sending":
        CAMPAIGNS_COLL.update_one(
            {"_id": ObjectId(campaign_id)},
            {"$set": {"status": "sent", "sent": sent, "failed": failed}}
        )

    campaign["_id"] = str(campaign["_id"])

    return {
        "success": True,
        "campaign": campaign,
        "live_stats": {
            "queued": queued,
            "sending": sending,
            "sent": sent,
            "failed": failed,
            "total": queued + sending + sent + failed,
        },
    }


@router.post("/mailing/campaigns/{campaign_id}/cancel", summary="Cancel campaign")
async def cancel_campaign(
    campaign_id: str,
    user: dict = Depends(verify_session),
):
    require_admin_level(user, "marketing")

    if not ObjectId.is_valid(campaign_id):
        raise HTTPException(status_code=400, detail="ID inválido")

    # Remove unsent queue items
    deleted = QUEUE_COLL.delete_many({"campaign_id": campaign_id, "status": "queued"})

    CAMPAIGNS_COLL.update_one(
        {"_id": ObjectId(campaign_id)},
        {"$set": {"status": "cancelled", "updated_at": datetime.now()}}
    )

    logger.info(f"[mailing] Campaign {campaign_id} cancelled — {deleted.deleted_count} emails removed from queue")

    return {"success": True, "removed_from_queue": deleted.deleted_count}


@router.delete("/mailing/campaigns/{campaign_id}", summary="Delete campaign")
async def delete_campaign(
    campaign_id: str,
    user: dict = Depends(verify_session),
):
    require_admin_level(user, "marketing")

    if not ObjectId.is_valid(campaign_id):
        raise HTTPException(status_code=400, detail="ID inválido")

    # Clean queue
    QUEUE_COLL.delete_many({"campaign_id": campaign_id})
    CAMPAIGNS_COLL.delete_one({"_id": ObjectId(campaign_id)})

    return {"success": True}
