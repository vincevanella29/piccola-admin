"""
apis/mailing/templates.py
=========================
CRUD for email templates. Supports Mustache-style variables {{var_name}}.
"""

import logging
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from typing import Optional, List
from bson import ObjectId

from utils.web3mongo import db
from utils.auth.session import verify_session
from config.roles.access import require_admin_level
from utils.mail_sender import render_template

router = APIRouter()
logger = logging.getLogger(__name__)

TEMPLATES_COLL = db.mail_templates


# ── Models ──────────────────────────────────────────────────
class TemplateCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    subject: str = Field(..., min_length=1, max_length=200)
    html: str = Field(..., min_length=10)
    type: str = Field("campaign", description="transactional | automation | campaign")
    description: str = Field("", max_length=300)
    blocks: Optional[List[dict]] = Field(None, description="Visual builder blocks (JSON)")


class TemplateUpdate(BaseModel):
    name: Optional[str] = None
    subject: Optional[str] = None
    html: Optional[str] = None
    type: Optional[str] = None
    description: Optional[str] = None
    active: Optional[bool] = None
    blocks: Optional[List[dict]] = None


class TemplatePreview(BaseModel):
    html: str = Field("", description="HTML to preview (or uses template's HTML)")
    subject: str = Field("", description="Subject to preview")
    vars: dict = Field(default_factory=dict, description="Variables to render")


# ── Endpoints ───────────────────────────────────────────────

@router.get("/mailing/templates", summary="List email templates")
async def list_templates(
    type: Optional[str] = None,
    user: dict = Depends(verify_session),
):
    require_admin_level(user, "marketing")

    query = {}
    if type:
        query["type"] = type

    templates = list(TEMPLATES_COLL.find(query).sort("created_at", -1))
    for t in templates:
        t["_id"] = str(t["_id"])

    return {"success": True, "templates": templates, "total": len(templates)}


@router.post("/mailing/templates", summary="Create email template")
async def create_template(
    payload: TemplateCreate,
    user: dict = Depends(verify_session),
):
    require_admin_level(user, "marketing")

    now = datetime.now()
    doc = {
        **payload.dict(),
        "active": True,
        "created_at": now,
        "updated_at": now,
        "created_by": user.get("wallet") or user.get("id"),
    }

    result = TEMPLATES_COLL.insert_one(doc)
    logger.info(f"[mailing] Template created: {payload.name} ({payload.type})")

    return {"success": True, "template_id": str(result.inserted_id)}


@router.put("/mailing/templates/{template_id}", summary="Update email template")
async def update_template(
    template_id: str,
    payload: TemplateUpdate,
    user: dict = Depends(verify_session),
):
    require_admin_level(user, "marketing")

    if not ObjectId.is_valid(template_id):
        raise HTTPException(status_code=400, detail="ID de template inválido")

    updates = {k: v for k, v in payload.dict().items() if v is not None}
    if not updates:
        raise HTTPException(status_code=400, detail="No hay cambios")

    updates["updated_at"] = datetime.now()

    result = TEMPLATES_COLL.update_one(
        {"_id": ObjectId(template_id)},
        {"$set": updates}
    )

    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Template no encontrado")

    return {"success": True}


@router.delete("/mailing/templates/{template_id}", summary="Delete email template")
async def delete_template(
    template_id: str,
    user: dict = Depends(verify_session),
):
    require_admin_level(user, "marketing")

    if not ObjectId.is_valid(template_id):
        raise HTTPException(status_code=400, detail="ID de template inválido")

    result = TEMPLATES_COLL.delete_one({"_id": ObjectId(template_id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Template no encontrado")

    return {"success": True}


@router.post("/mailing/templates/{template_id}/preview", summary="Preview rendered template")
async def preview_template(
    template_id: str,
    payload: TemplatePreview,
    user: dict = Depends(verify_session),
):
    require_admin_level(user, "marketing")

    html = payload.html
    subject = payload.subject

    if not html:
        if not ObjectId.is_valid(template_id):
            raise HTTPException(status_code=400, detail="ID inválido")
        template = TEMPLATES_COLL.find_one({"_id": ObjectId(template_id)})
        if not template:
            raise HTTPException(status_code=404, detail="Template no encontrado")
        html = template.get("html", "")
        subject = subject or template.get("subject", "")

    # Default preview vars
    default_vars = {
        "customer_name": "Cliente de Prueba",
        "order_number": "PI-TEST1234",
        "order_total": "$15.990",
        "status": "Confirmado",
        "restaurant_name": "La Piccola Italia",
    }
    merged_vars = {**default_vars, **payload.vars}

    rendered_html = render_template(html, merged_vars)
    rendered_subject = render_template(subject, merged_vars)

    return {
        "success": True,
        "subject": rendered_subject,
        "html": rendered_html,
    }


@router.post("/mailing/templates/{template_id}/send-test", summary="Send test email")
async def send_test_email(
    template_id: str,
    user: dict = Depends(verify_session),
):
    """Send a test email to the admin's email."""
    require_admin_level(user, "marketing")

    if not ObjectId.is_valid(template_id):
        raise HTTPException(status_code=400, detail="ID inválido")

    template = TEMPLATES_COLL.find_one({"_id": ObjectId(template_id)})
    if not template:
        raise HTTPException(status_code=404, detail="Template no encontrado")

    test_vars = {
        "customer_name": "Admin Test",
        "order_number": "PI-TEST0000",
        "order_total": "$9.990",
        "status": "Confirmado",
        "restaurant_name": "La Piccola Italia",
    }

    html = render_template(template.get("html", ""), test_vars)
    subject = render_template(template.get("subject", ""), test_vars)

    from utils.mail_sender import send_email as _send
    # Send to the admin user's email or a configured test address
    test_to = user.get("email") or "admin@lapiccolaitalia.cl"
    result = await _send(to=test_to, subject=f"[TEST] {subject}", html=html)

    return {"success": result["success"], "sent_to": test_to, "error": result.get("error")}
