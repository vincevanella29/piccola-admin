"""
Sync logic for Carta.

clean_database_duplicates():
    Removes duplicate CODIGO entries from menu_options values ONLY.
    Rule: a product codigo can live in at MOST ONE option group (product group).
    Modifier groups (menu_id != "") are exempt — their values are modifier options,
    not product references, so they can share codigos freely.

trigger_public_sync():
    Calls the carta digital frontend worker at:
        POST https://frontcarta.lapiccolaitalia.cl/api/catalog/sync
    Authenticated with EXTERNAL_API_KEY.
    Both apps share the same MongoDB — this just tells the carta to refresh its cache.
"""

import logging
import os
import requests

from .helpers import get_ts  # noqa: F401 (imported for caller compat)

logger = logging.getLogger(__name__)

_CATALOG_SYNC_URL = os.getenv(
    "CARTA_CATALOG_SYNC_URL",
    "https://frontcarta.lapiccolaitalia.cl/api/catalog/sync",
)
# Default apunta al mismo catalog/sync que ya funciona en producción
# (también sincroniza banners). Sobrescribir con CARTA_BANNERS_SYNC_URL
# cuando la carta tenga desplegado el endpoint /api/banners/sync.
_BANNERS_SYNC_URL = os.getenv(
    "CARTA_BANNERS_SYNC_URL",
    "https://frontcarta.lapiccolaitalia.cl/api/catalog/sync",
)
_EXTERNAL_API_KEY = os.getenv(
    "CARTA_SYNC_API_KEY",
    "1fSypihaCuh9g.ql4Ly8qqw7Usa3OMWRUVlM3YvO9eo1EDAVB_vkN3A0A",
)

logger.info(
    f"[sync] URLs cargadas:"
    f"\n  CATALOG → {_CATALOG_SYNC_URL}"
    f"\n  BANNERS → {_BANNERS_SYNC_URL}"
    f"\n  KEY_TAIL → ...{_EXTERNAL_API_KEY[-8:]}"
)



async def trigger_public_sync() -> dict:
    """
    Tell the carta digital worker to re-read MongoDB and refresh its catalog.
    Returns { ok, status, detail }.
    """
    logger.info(f"[sync] Triggering carta digital worker → {_CATALOG_SYNC_URL}")
    try:
        resp = requests.post(
            _CATALOG_SYNC_URL,
            headers={"X-API-Key": _EXTERNAL_API_KEY},
            timeout=30,
        )
        logger.info(f"[sync] Worker response: {resp.status_code}")
        try:
            body = resp.json()
        except Exception:
            body = {"raw": resp.text[:300]}

        ok = resp.ok
        if not ok:
            logger.warning(f"[sync] Worker returned {resp.status_code}: {body}")
        return {"ok": ok, "status": resp.status_code, "detail": body}

    except requests.exceptions.ConnectTimeout:
        msg = f"Timeout conectando a {_CATALOG_SYNC_URL}"
        logger.error(f"[sync] {msg}")
        return {"ok": False, "status": 0, "detail": msg}
    except Exception as e:
        logger.error(f"[sync] Error triggering carta worker: {e}")
        return {"ok": False, "status": 0, "detail": str(e)}


async def trigger_banners_sync() -> dict:
    """
    Notifica a la carta digital para que re-sincronice SOLO los banners
    desde el admin (GET /api/public/banners).
    Retorna { ok, status, detail }.
    """
    logger.info(f"[sync] Triggering banner sync → {_BANNERS_SYNC_URL}")
    try:
        resp = requests.post(
            _BANNERS_SYNC_URL,
            headers={"X-API-Key": _EXTERNAL_API_KEY},
            timeout=45,
        )
        logger.info(f"[sync] Banner worker response: {resp.status_code}")
        try:
            body = resp.json()
        except Exception:
            body = {"raw": resp.text[:300]}

        ok = resp.ok
        if not ok:
            logger.warning(f"[sync] Banner worker returned {resp.status_code}: {body}")
        return {"ok": ok, "status": resp.status_code, "detail": body}

    except requests.exceptions.ConnectTimeout:
        msg = f"Timeout conectando a {_BANNERS_SYNC_URL}"
        logger.error(f"[sync] {msg}")
        return {"ok": False, "status": 0, "detail": msg}
    except Exception as e:
        logger.error(f"[sync] Error triggering banner sync: {e}")
        return {"ok": False, "status": 0, "detail": str(e)}


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
