"""
Sync logic for Carta.

clean_database_duplicates():
    Removes duplicate CODIGO entries from menu_options values ONLY.
    Rule: a product codigo can live in at MOST ONE option group (product group).
    Modifier groups (menu_id != "") are exempt — their values are modifier options,
    not product references, so they can share codigos freely.

trigger_public_sync() / trigger_banners_sync() / trigger_nav_links_sync():
    Read the active carta provider from MongoDB (carta_providers collection)
    and POST to the appropriate route on the carta domain.
    Authenticated with the auto-generated API key stored during claim.
    No env vars — everything from the database.
"""

import logging
import time
import asyncio
import requests

from .helpers import get_ts  # noqa: F401 (imported for caller compat)
from utils.vanellix_crypto import sign_with_mnemonic

logger = logging.getLogger(__name__)


# ─── Carta Routes (must match carta_providers.py) ─────────────────────────────

CARTA_ROUTES = {
    "catalog_sync":   "/api/catalog/sync",
    "banners_sync":   "/api/banners/sync",
    "nav_links_sync": "/api/nav-links/sync",
}


# ─── Provider resolution from MongoDB ─────────────────────────────────────────

def _get_carta_provider() -> dict:
    """
    Read the active carta provider from MongoDB.
    Returns the provider doc or raises RuntimeError.
    """
    from utils.web3mongo import db as _db
    prov = _db.ecosystem_providers.find_one({"ecosystem_type": "carta", "status": "active"})
    if not prov:
        raise RuntimeError(
            "No hay carta provider configurado. "
            "Ve a CartaConfig → Conexión → Auto-Link para vincular la carta."
        )
    return prov


def _build_sync_url(route_key: str) -> tuple:
    """
    Build (url, api_key) from the active carta provider in DB.
    Raises RuntimeError if no provider is configured.
    """
    prov = _get_carta_provider()
    domain = prov.get("domain", "").rstrip("/")
    if not domain:
        raise RuntimeError(f"Carta provider '{prov.get('slug')}' no tiene dominio configurado")
    path = CARTA_ROUTES.get(route_key, "")
    url = f"{domain}{path}"
    api_key = prov.get("api_key_value", "")
    return url, api_key


def _build_signed_headers(api_key: str, mnemonic: str, body: bytes = b"") -> dict:
    """
    Build request headers with Dilithium signature.
    """
    headers = {}
    if mnemonic:
        try:
            sig_hex, pk_hex = sign_with_mnemonic(mnemonic, body)
            headers["X-Dilithium-Signature"] = sig_hex
            headers["X-Dilithium-PK"] = pk_hex
            headers["X-Dilithium-Algorithm"] = "dilithium2"
            headers["X-Dilithium-Timestamp"] = str(time.time())
        except Exception as e:
            logger.warning(f"[sync] Dilithium signing failed: {e}")
    return headers


# ─── Generic sync helper ──────────────────────────────────────────────────────

async def _trigger_sync(route_key: str, label: str) -> dict:
    """
    Generic sync trigger. Reads URL + API key + mnemonic from the carta
    provider in DB, signs the request with Dilithium, and POSTs.
    """
    try:
        prov = _get_carta_provider()
        domain = prov.get("domain", "").rstrip("/")
        path = CARTA_ROUTES.get(route_key, "")
        url = f"{domain}{path}"
        api_key = prov.get("api_key_value", "")
        mnemonic_enc = prov.get("dilithium_mnemonic_enc", "")
        if mnemonic_enc:
            from utils.vanellix_crypto import decrypt_b2b_mnemonic
            mnemonic = decrypt_b2b_mnemonic(mnemonic_enc)
        else:
            mnemonic = ""
    except RuntimeError as e:
        msg = str(e)
        logger.warning(f"[sync] {label}: {msg}")
        return {"ok": False, "status": 0, "detail": msg}

    logger.info(f"[sync] Triggering {label} → {url}")
    try:
        headers = _build_signed_headers(api_key, mnemonic, body=b"")

        def _do_post():
            return requests.post(url, headers=headers, timeout=5)

        resp = await asyncio.to_thread(_do_post)
        logger.info(f"[sync] {label} response: {resp.status_code}")
        try:
            body = resp.json()
        except Exception:
            body = {"raw": resp.text[:300]}

        ok = resp.status_code in (200, 202)
        if not ok:
            logger.warning(f"[sync] {label} returned {resp.status_code}: {body}")
        return {"ok": ok, "status": resp.status_code, "detail": body}

    except requests.exceptions.Timeout:
        msg = f"Timeout (5s) conectando a {url}"
        logger.error(f"[sync] {msg}")
        return {"ok": False, "status": 0, "detail": msg}
    except Exception as e:
        logger.error(f"[sync] Error {label}: {e}")
        return {"ok": False, "status": 0, "detail": str(e)}


# ─── Public API ───────────────────────────────────────────────────────────────

async def trigger_public_sync() -> dict:
    """
    Tell the carta digital worker to re-read MongoDB and refresh its catalog.
    Also triggers delivery provider syncs in the background.
    """
    # Also notify delivery providers in the background (fire-and-forget)
    asyncio.create_task(_sync_delivery_providers())
    return await _trigger_sync("catalog_sync", "catalog sync")


async def trigger_banners_sync() -> dict:
    """Notifica a la carta digital para que re-sincronice SOLO los banners."""
    return await _trigger_sync("banners_sync", "banner sync")


async def trigger_nav_links_sync() -> dict:
    """Notifica a la carta digital para que re-sincronice navigation links."""
    return await _trigger_sync("nav_links_sync", "nav-links sync")


# ─── Delivery providers (unchanged) ──────────────────────────────────────────

async def _sync_delivery_providers():
    """
    Notify all active delivery providers that have a sync_url.
    Each provider's sync_url gets a POST to tell it to refresh its catalog.
    Fire-and-forget — errors are logged but never block the admin.
    """
    from utils.web3mongo import db as _db

    try:
        providers = list(_db.ecosystem_providers.find(
            {"ecosystem_type": "delivery", "status": "active", "sync_url": {"$exists": True, "$ne": ""}},
            {"slug": 1, "sync_url": 1, "api_key_value": 1, "dilithium_mnemonic": 1, "dilithium_mnemonic_enc": 1},
        ))
    except Exception as e:
        logger.error(f"[sync] Error reading delivery providers: {e}")
        return

    if not providers:
        return

    logger.info(f"[sync] Notifying {len(providers)} delivery provider(s)")

    for prov in providers:
        slug = prov.get("slug", "?")
        url = prov.get("sync_url", "")
        if not url:
            continue
            
        api_key = prov.get("api_key_value", "")
        mnemonic_enc = prov.get("dilithium_mnemonic_enc", "")
        if mnemonic_enc:
            from utils.vanellix_crypto import decrypt_b2b_mnemonic
            mnemonic = decrypt_b2b_mnemonic(mnemonic_enc)
        else:
            mnemonic = ""
        
        try:
            headers = _build_signed_headers(api_key, mnemonic, body=b"")
            
            def _post(u=url, h=headers):
                return requests.post(u, headers=h, timeout=5)
                
            resp = await asyncio.to_thread(_post)
            logger.info(f"[sync] Provider '{slug}' sync → {resp.status_code}")
        except Exception as e:
            logger.warning(f"[sync] Provider '{slug}' sync failed: {e}")


# ─── Database cleanup ─────────────────────────────────────────────────────────

def clean_database_duplicates() -> str:
    """
    Remove duplicate codigo values from product-group type menu_options.

    Rule:
      - A codigo can appear in AT MOST ONE product-group (option without menu_id).
      - Modifier groups (menu_id set) are EXCLUDED — their values are modifier
        options (e.g. 'poco queso', 'extra queso'), not product references.
      - Keeps the FIRST occurrence (lowest numeric option _id), removes the rest.

    Returns a human-readable summary string.
    """
    from .menu_options import bulk_remove_duplicate_values_in_product_groups
    report = bulk_remove_duplicate_values_in_product_groups(dry_run=False)
    deleted = report.get("deleted_count", 0)
    if deleted == 0:
        return "✅ Sin duplicados — todos los códigos son únicos en los grupos de productos."
    return (
        f"Limpieza completada: {deleted} valor(es) duplicado(s) eliminado(s) "
        f"de grupos de productos."
    )
