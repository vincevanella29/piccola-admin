"""
delivery/transbank.py
=====================
Transbank OneClick Mall — inscription + authorization + test flow.
Provides endpoints for the admin panel to test the full payment flow.
"""

from utils.time_utils import get_chile_time
import logging


from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from typing import Optional

from utils.web3mongo import db
from utils.auth.session import verify_session
from config.roles.access import require_admin_level

router = APIRouter()
logger = logging.getLogger("transbank")

CONFIG_COLL = db["delivery_config"]
CUSTOMERS_COLL = db["delivery_customers"]


def _get_tb_config():
    """Load Transbank config from delivery_config doc."""
    doc = CONFIG_COLL.find_one({"_id": "delivery_config"})
    if not doc:
        return None
    return doc.get("transbank", {})


def _get_oneclick(env: str = None):
    """
    Build OneClick Mall objects for the active environment.
    Returns (inscription, transaction, env_name)
    """
    from transbank.webpay.oneclick.mall_inscription import MallInscription
    from transbank.webpay.oneclick.mall_transaction import MallTransaction
    from transbank.common.integration_commerce_codes import IntegrationCommerceCodes
    from transbank.common.integration_api_keys import IntegrationApiKeys
    from transbank.common.options import WebpayOptions
    from transbank.common.integration_type import IntegrationType

    tb = _get_tb_config()
    if not tb:
        raise HTTPException(status_code=400, detail="Transbank no configurado")

    active_env = env or tb.get("environment", "test")

    if active_env == "test":
        opts = WebpayOptions(
            IntegrationCommerceCodes.ONECLICK_MALL,
            IntegrationApiKeys.WEBPAY,
            IntegrationType.TEST,
        )
        inscription = MallInscription(opts)
        transaction = MallTransaction(opts)
    else:
        creds = tb.get("production", {})
        cc = creds.get("commerce_code")
        ak = creds.get("api_key")
        if not cc or not ak:
            raise HTTPException(status_code=400, detail="Credenciales de producción no configuradas")
        opts = WebpayOptions(cc, ak, IntegrationType.LIVE)
        inscription = MallInscription(opts)
        transaction = MallTransaction(opts)

    return inscription, transaction, active_env


# =====================================================================
# Start inscription — returns URL to redirect user to Transbank
# =====================================================================

class StartInscriptionRequest(BaseModel):
    username: str
    email: str
    return_url: str


@router.post("/delivery/transbank/inscription/start")
async def start_inscription(
    req: StartInscriptionRequest,
    user: dict = Depends(verify_session),
):
    """Start OneClick inscription — returns Transbank URL + token."""
    require_admin_level(user, "admin")
    inscription, _, env = _get_oneclick()

    try:
        resp = inscription.start(req.username, req.email, req.return_url)
        token = resp["token"]
        url_webpay = resp["url_webpay"]
        logger.info(f"[transbank] Inscription started: env={env}, token={token[:20]}...")

        # Save pending inscription
        CONFIG_COLL.update_one(
            {"_id": "delivery_config"},
            {"$set": {
                f"transbank.pending_inscription": {
                    "token": token,
                    "username": req.username,
                    "email": req.email,
                    "env": env,
                    "started_at": get_chile_time().isoformat(),
                },
            }},
        )

        return {
            "success": True,
            "url": url_webpay,
            "token": token,
            "full_url": f"{url_webpay}?TBK_TOKEN={token}",
        }
    except Exception as e:
        logger.error(f"[transbank] Inscription start error: {e}")
        raise HTTPException(status_code=502, detail=str(e))


# =====================================================================
# Finish inscription — called after Transbank redirects back
# =====================================================================

@router.get("/delivery/transbank/inscription/finish")
async def finish_inscription(
    TBK_TOKEN: str = Query(...),
):
    """
    Finish OneClick inscription — Transbank redirects here.
    Public endpoint (no auth) since it's a redirect from Transbank.
    """
    inscription, _, env = _get_oneclick()

    try:
        resp = inscription.finish(TBK_TOKEN)
        rc = resp.get("response_code", -1)
        tbk_user = resp.get("tbk_user", "")
        card_type = resp.get("card_type", "")
        card_number = str(resp.get("card_number", ""))

        # Get the username from pending_inscription (saved during start)
        doc = CONFIG_COLL.find_one({"_id": "delivery_config"})
        pending = (doc or {}).get("transbank", {}).get("pending_inscription", {}) or {}
        username = pending.get("username", "")

        logger.info(f"[transbank] Inscription finished: response_code={rc}, "
                     f"tbk_user={tbk_user}, card={card_type} ****{card_number[-4:]}, username={username}")

        result = {
            "success": rc == 0,
            "response_code": rc,
            "tbk_user": tbk_user,
            "username": username,
            "authorization_code": resp.get("authorization_code"),
            "card_type": card_type,
            "card_number": card_number,
        }

        # Save result
        CONFIG_COLL.update_one(
            {"_id": "delivery_config"},
            {"$set": {
                "transbank.last_inscription": {
                    **result,
                    "env": env,
                    "finished_at": get_chile_time().isoformat(),
                },
                "transbank.pending_inscription": None,
            }},
        )

        # Return HTML that auto-closes or redirects back to admin
        html = f"""
        <!DOCTYPE html>
        <html>
        <head><title>Transbank — Inscripción</title>
        <style>
            body {{ font-family: -apple-system, system-ui, sans-serif; background: #0a0a0a; color: #e5e5e5;
                   display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }}
            .card {{ background: #1a1a1a; border: 1px solid #333; border-radius: 16px; padding: 32px;
                     max-width: 400px; text-align: center; }}
            .icon {{ font-size: 48px; margin-bottom: 16px; }}
            h2 {{ margin: 0 0 8px; font-size: 18px; }}
            p {{ margin: 0 0 4px; font-size: 13px; color: #999; }}
            .code {{ font-family: monospace; background: #222; padding: 4px 8px; border-radius: 6px;
                     font-size: 12px; color: #4ade80; display: inline-block; margin-top: 8px; }}
            .btn {{ display: inline-block; margin-top: 16px; padding: 10px 24px; background: #4ade80;
                    color: #000; border-radius: 10px; text-decoration: none; font-weight: bold; font-size: 13px; }}
        </style>
        </head>
        <body>
        <div class="card">
            <div class="icon">{"✅" if result["success"] else "❌"}</div>
            <h2>{"Tarjeta inscrita" if result["success"] else "Error en inscripción"}</h2>
            <p>Código: {result["response_code"]}</p>
            {"<p>Tarjeta: " + result["card_type"] + " ****" + str(result["card_number"])[-4:] + "</p>" if result["success"] else ""}
            {"<div class='code'>tbk_user: " + str(result["tbk_user"])[:20] + "...</div>" if result["success"] else ""}
            <br>
            <a class="btn" href="javascript:window.close()">Cerrar ventana</a>
        </div>
        </body></html>
        """
        from fastapi.responses import HTMLResponse
        return HTMLResponse(content=html)

    except Exception as e:
        logger.error(f"[transbank] Inscription finish error: {e}")
        from fastapi.responses import HTMLResponse
        html = f"""
        <!DOCTYPE html><html><head><title>Error</title>
        <style>body{{font-family:sans-serif;background:#0a0a0a;color:#e5e5e5;display:flex;align-items:center;
        justify-content:center;height:100vh;margin:0}}.card{{background:#1a1a1a;border:1px solid #333;
        border-radius:16px;padding:32px;max-width:400px;text-align:center}}
        .btn{{display:inline-block;margin-top:16px;padding:10px 24px;background:#ef4444;color:#fff;
        border-radius:10px;text-decoration:none;font-weight:bold;font-size:13px}}</style></head>
        <body><div class="card"><div style="font-size:48px;margin-bottom:16px">❌</div>
        <h2>Error</h2><p style="color:#999;font-size:13px">{str(e)}</p>
        <a class="btn" href="javascript:window.close()">Cerrar</a></div></body></html>
        """
        return HTMLResponse(content=html, status_code=500)


# =====================================================================
# Get inscription status — for the admin UI to poll
# =====================================================================

@router.get("/delivery/transbank/inscription/status")
async def get_inscription_status(user: dict = Depends(verify_session)):
    """Get the last inscription result."""
    require_admin_level(user, "admin")
    tb = _get_tb_config() or {}
    return {
        "success": True,
        "pending": tb.get("pending_inscription"),
        "last_inscription": tb.get("last_inscription"),
    }


# =====================================================================
# Test authorize — charge the inscribed test card
# =====================================================================

class TestAuthorizeRequest(BaseModel):
    amount: int = 1000
    buy_order: Optional[str] = None


@router.post("/delivery/transbank/test-authorize")
async def test_authorize(
    req: TestAuthorizeRequest,
    user: dict = Depends(verify_session),
):
    """Authorize a test payment using the last inscribed card."""
    require_admin_level(user, "admin")

    tb = _get_tb_config() or {}
    last = tb.get("last_inscription")
    if not last or not last.get("tbk_user"):
        raise HTTPException(status_code=400, detail="No hay tarjeta inscrita. Inscribe una primero.")

    _, transaction, env = _get_oneclick()

    import uuid
    buy_order = req.buy_order or f"TEST-{uuid.uuid4().hex[:8].upper()}"
    username = last.get("username", "test_user")
    tbk_user = last["tbk_user"]

    # For Mall, we need a child commerce code
    child_cc = "597055555543" if env == "test" else tb.get("production", {}).get("child_commerce_code", "")

    try:
        from transbank.webpay.oneclick.mall_transaction import MallTransactionAuthorizeDetails

        tx_details = MallTransactionAuthorizeDetails(
            commerce_code=child_cc,
            buy_order=f"SUB-{buy_order}",
            installments_number=1,
            amount=req.amount,
        )

        resp = transaction.authorize(username, tbk_user, buy_order, tx_details)
        logger.info(f"[transbank] Authorize raw response type={type(resp).__name__}: {resp}")

        # SDK may return a dict (with "details" key) or a dict that IS the top-level response
        if isinstance(resp, list):
            # resp is the details list itself
            resp_details = resp
            resp_top = {}
        elif isinstance(resp, dict):
            resp_details = resp.get("details", [])
            resp_top = resp
        else:
            resp_details = []
            resp_top = {}

        detail = resp_details[0] if resp_details else None
        if isinstance(detail, dict):
            pass  # good
        else:
            detail = None

        result = {
            "buy_order": resp_top.get("buy_order", buy_order),
            "session_id": resp_top.get("session_id"),
            "card_number": (resp_top.get("card_detail") or {}).get("card_number") if isinstance(resp_top, dict) else None,
            "accounting_date": resp_top.get("accounting_date"),
            "transaction_date": resp_top.get("transaction_date"),
            "detail": {
                "amount": detail.get("amount", req.amount),
                "status": detail.get("status", "UNKNOWN"),
                "authorization_code": detail.get("authorization_code"),
                "payment_type_code": detail.get("payment_type_code"),
                "response_code": detail.get("response_code", -1),
                "installments_number": detail.get("installments_number", 0),
                "buy_order": detail.get("buy_order"),
                "commerce_code": detail.get("commerce_code"),
            } if detail else None,
        }

        success = detail and detail.get("response_code") == 0

        # Save test result
        CONFIG_COLL.update_one(
            {"_id": "delivery_config"},
            {"$push": {
                "transbank.test_transactions": {
                    **result,
                    "success": success,
                    "env": env,
                    "created_at": get_chile_time().isoformat(),
                },
            }},
        )

        logger.info(f"[transbank] Test authorize: success={success}, amount={req.amount}, order={buy_order}")
        return {"success": success, "transaction": result}

    except Exception as e:
        logger.error(f"[transbank] Test authorize error: {e}")
        raise HTTPException(status_code=502, detail=str(e))


# =====================================================================
# Get test transactions history
# =====================================================================

@router.get("/delivery/transbank/test-transactions")
async def get_test_transactions(user: dict = Depends(verify_session)):
    """Get test transaction history."""
    require_admin_level(user, "admin")
    tb = _get_tb_config() or {}
    txns = tb.get("test_transactions", [])
    return {"success": True, "transactions": txns[-10:]}  # last 10


# =====================================================================
# Charge on Behalf (A2) — Admin charges user card for satellite apps
# =====================================================================

class ChargeOnBehalfRequest(BaseModel):
    privy_id: str
    amount: int
    buy_order: Optional[str] = None
    source_app: str = "admin"  # Which satellite requested this


@router.post("/delivery/transbank/charge-on-behalf", summary="Charge user card on behalf of satellite")
async def charge_on_behalf(
    req: ChargeOnBehalfRequest,
    user: dict = Depends(verify_session),
):
    """
    Admin charges a user's inscribed card. Security layers:
    1. Admin session auth (lvl 3-5)
    2. Bound sig v2 awareness (token must match privy_id)
    3. Audit logging
    """
    require_admin_level(user, "admin")

    customer = CUSTOMERS_COLL.find_one({"privy_id": req.privy_id})
    if not customer or not customer.get("transbank", {}).get("tbk_user"):
        raise HTTPException(status_code=404, detail="No inscribed card for this user")

    tb = customer["transbank"]
    tbk_user = tb["tbk_user"]

    # Verify Dilithium signature of the card token if present
    tbk_sig = tb.get("tbk_user_sig")
    sig_version = tb.get("sig_version", 1)
    if tbk_sig:
        prov_slug = customer.get("provider_slug", "vanellix")
        prov = db.ecosystem_providers.find_one({"slug": prov_slug})
        dilithium_pk = prov.get("dilithium_pk") if prov else None
        if dilithium_pk:
            from utils.vanellix_crypto import verify_dilithium
            if sig_version == 2:
                bound_payload = f"{req.privy_id}:{tbk_user}".encode("utf-8")
                if not verify_dilithium(dilithium_pk, bound_payload, tbk_sig):
                    logger.error(f"[transbank] charge-on-behalf: ❌ Dilithium signature v2 MISMATCH for {req.privy_id}")
                    raise HTTPException(status_code=403, detail="Payment token integrity check failed (signature mismatch)")
            else:
                # sig_version == 1
                legacy_payload = tbk_user.encode("utf-8")
                if not verify_dilithium(dilithium_pk, legacy_payload, tbk_sig):
                    logger.error(f"[transbank] charge-on-behalf: ❌ Dilithium signature v1 MISMATCH for {req.privy_id}")
                    raise HTTPException(status_code=403, detail="Payment token integrity check failed (signature mismatch)")
            logger.info(f"[transbank] charge-on-behalf: ✅ Dilithium sig v{sig_version} verified for {req.privy_id}")
        else:
            logger.warning(f"[transbank] charge-on-behalf: No Dilithium PK registered for provider '{prov_slug}' — skipping signature verification")
    else:
        logger.warning(f"[transbank] charge-on-behalf: no signature found for {req.privy_id} (pre-signing card)")

    _, transaction, env = _get_oneclick()

    import uuid
    buy_order = req.buy_order or f"COB-{uuid.uuid4().hex[:8].upper()}"
    child_cc = "597055555543" if env == "test" else _get_tb_config().get("production", {}).get("child_commerce_code", "")

    try:
        from transbank.webpay.oneclick.mall_transaction import MallTransactionAuthorizeDetails

        tx_details = MallTransactionAuthorizeDetails(
            commerce_code=child_cc,
            buy_order=f"SUB-{buy_order}",
            installments_number=1,
            amount=req.amount,
        )

        resp = transaction.authorize(req.privy_id, tbk_user, buy_order, tx_details)
        logger.info(f"[transbank] charge-on-behalf raw response type={type(resp).__name__}: {resp}")

        # SDK response parsing (same pattern as test_authorize)
        if isinstance(resp, list):
            resp_details = resp
            resp_top = {}
        elif isinstance(resp, dict):
            resp_details = resp.get("details", [])
            resp_top = resp
        else:
            resp_details = []
            resp_top = {}

        detail = resp_details[0] if resp_details else None
        if not isinstance(detail, dict):
            detail = None

        result = {
            "buy_order": resp_top.get("buy_order", buy_order),
            "session_id": resp_top.get("session_id"),
            "card_number": (resp_top.get("card_detail") or {}).get("card_number") if isinstance(resp_top, dict) else None,
            "accounting_date": resp_top.get("accounting_date"),
            "transaction_date": resp_top.get("transaction_date"),
            "detail": {
                "amount": detail.get("amount", req.amount),
                "status": detail.get("status", "UNKNOWN"),
                "authorization_code": detail.get("authorization_code"),
                "payment_type_code": detail.get("payment_type_code"),
                "response_code": detail.get("response_code", -1),
                "installments_number": detail.get("installments_number", 0),
                "buy_order": detail.get("buy_order"),
                "commerce_code": detail.get("commerce_code"),
            } if detail else None,
        }

        success = detail and detail.get("response_code") == 0

        # Audit log
        CONFIG_COLL.update_one(
            {"_id": "delivery_config"},
            {"$push": {
                "transbank.charge_on_behalf_log": {
                    **result,
                    "success": success,
                    "privy_id": req.privy_id,
                    "source_app": req.source_app,
                    "charged_by": user.get("wallet") or user.get("id"),
                    "env": env,
                    "created_at": get_chile_time().isoformat(),
                },
            }},
        )

        logger.info(f"[transbank] charge-on-behalf: {req.source_app} charged {req.privy_id} "
                     f"${req.amount} CLP — success={success}")
        return {"success": success, "transaction": result}

    except Exception as e:
        logger.error(f"[transbank] charge-on-behalf error: {e}")
        raise HTTPException(status_code=502, detail=str(e))

