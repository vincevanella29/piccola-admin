# backend/utils/auth/access_control.py
import logging
from typing import Optional, Dict, Any, List
from bson import ObjectId
import unicodedata
from fastapi import HTTPException, Request
from starlette.websockets import WebSocket

from utils.web3mongo import db

logger = logging.getLogger(__name__)

COL_RULES = db.api_access_rules
"""
This module is intentionally minimal per requirements:
 - Registers/ensures API access rule documents exist for API prefixes.
 - Provides helper to find the most specific rule for a path.
No session, cargo/seccion, or enforcement logic here.
"""

def _norm(s: Optional[str]) -> str:
    if not s:
        return ""
    # Lower, strip, remove accents
    s2 = unicodedata.normalize('NFKD', str(s)).encode('ascii', 'ignore').decode('ascii')
    return s2.strip().lower()

def _find_rule_for_path(path: str) -> Optional[Dict[str, Any]]:
    """
    Returns the most specific enabled rule whose path_prefix matches the request path.
    If none, returns None.
    """
    try:
        rules: List[Dict[str, Any]] = list(COL_RULES.find({"enabled": {"$ne": False}}))
    except Exception as e:
        logger.error(f"api_access_rules fetch failed: {e}")
        return None

    best = None
    best_len = -1
    for r in rules:
        pfx = (r.get("path_prefix") or "").strip()
        if not pfx:
            continue
        if path.startswith(pfx) and len(pfx) > best_len:
            best = r
            best_len = len(pfx)
    return best


def _top_level_api_prefix(path: str) -> Optional[str]:
    """
    Extracts a stable top-level prefix like '/api/admin' from a route path.
    Examples:
      '/api/admin/gamification/rules/list' -> '/api/admin'
      '/api/user/role' -> '/api/user'
      '/api/login' -> '/api/login'
    Returns None if not an /api path.
    """
    if not path or not path.startswith("/api"):
        return None
    parts = [p for p in path.split('/') if p]
    if len(parts) < 2:  # only 'api'
        return "/api"
    return f"/{parts[0]}/{parts[1]}"


def ensure_api_rules_for_app(app) -> None:
    """
    Scan FastAPI routes and ensure there is a rule doc for EACH concrete /api route path.
    Creates default-allow rules (no include/exclude, enabled=true) if missing. Idempotent.
    """
    try:
        # Ensure index for faster lookups (idempotent)
        try:
            COL_RULES.create_index("path_prefix")
        except Exception:
            pass

        paths: set[str] = set()
        for route in getattr(app, 'routes', []) or []:
            path = getattr(route, 'path', None)
            if not path:
                continue
            if not path.startswith('/api'):
                continue
            # Skip debug/login endpoints
            if path in ("/api/login",):
                continue
            paths.add(path)

        for p in sorted(paths):
            COL_RULES.update_one(
                {"path_prefix": p},
                {"$setOnInsert": {"path_prefix": p, "enabled": True}},
                upsert=True,
            )
    except Exception as e:
        logger.error(f"ensure_api_rules_for_app failed: {e}")


# --- Lightweight check: only enforce if rule has excludes ---
COL_EMP_USR = db.empleados_usuarios
COL_VPN = db.trabajadores_vpn
COL_CARGOS = db.cargos_intranet


def _resolve_cargo_seccion(wallet: Optional[str], sub: Optional[str] = None) -> Dict[str, Optional[str]]:
    if not wallet and not sub:
        return {"cargo": None, "seccion": None}
    try:
        emp = None
        if wallet:
            emp = COL_EMP_USR.find_one({"wallet": wallet.lower(), "status": "active"})
        if not emp and sub:
            emp = COL_EMP_USR.find_one({"sub": sub, "status": "active"})
        rut_value = emp.get("rut") if emp else None
        if rut_value is None:
            return {"cargo": None, "seccion": None}

        candidates = []
        if isinstance(rut_value, int):
            candidates = [{"rut": rut_value}, {"rut": str(rut_value)}]
        elif isinstance(rut_value, str):
            r = rut_value.strip()
            candidates = [{"rut": r}]
            try:
                candidates.append({"rut": int(r)})
            except Exception:
                pass
        else:
            try:
                candidates.append({"rut": int(rut_value)})
            except Exception:
                pass
            candidates.append({"rut": str(rut_value)})

        vpn_doc = None
        for q in candidates:
            found = COL_VPN.find_one(q)
            if found:
                vpn_doc = found
                break
        if not vpn_doc:
            return {"cargo": None, "seccion": None}

        # Prefer authoritative cargo/seccion from cargos_intranet using cargo_id if present
        cargo_id = vpn_doc.get("cargo_id") or vpn_doc.get("cargoId") or vpn_doc.get("id_cargo")
        cargo_name_from_vpn = (vpn_doc.get("cargo") or "").strip() or None
        seccion_from_vpn = (vpn_doc.get("seccion") or "").strip() or None

        cargo_name = None
        seccion = None

        cargo_doc = None
        if cargo_id:
            try:
                # cargo_id may be ObjectId or string
                # Try raw value
                cargo_doc = COL_CARGOS.find_one({"_id": cargo_id}) or COL_CARGOS.find_one({"id": cargo_id})
                # Try ObjectId if possible
                if not cargo_doc and isinstance(cargo_id, str) and len(cargo_id) == 24:
                    try:
                        cargo_doc = COL_CARGOS.find_one({"_id": ObjectId(cargo_id)})
                    except Exception:
                        pass
            except Exception:
                cargo_doc = None

        if not cargo_doc and cargo_name_from_vpn:
            # Try to match by cargo name
            cargo_doc = COL_CARGOS.find_one({"cargo": {"$regex": f"^{cargo_name_from_vpn}$", "$options": "i"}})

        if cargo_doc:
            cargo_name = (cargo_doc.get("cargo") or "").strip() or None
            seccion = (cargo_doc.get("seccion") or "").strip() or None
        else:
            # Fallback to vpn_doc values if no cargo_doc
            cargo_name = cargo_name_from_vpn
            seccion = seccion_from_vpn

        return {"cargo": cargo_name, "seccion": seccion}
    except Exception as e:
        logger.error(f"cargo/seccion resolution failed for {wallet}: {e}")
        return {"cargo": None, "seccion": None}


async def check_api_access(request: Request = None, websocket: WebSocket = None) -> None:
    """
    Global dependency (optional) that only does work if the current path has an
    access rule with excludes. If no excludes configured for the matching rule,
    it returns immediately. If excludes exist, it tries to resolve cargo/seccion
    from the X-Wallet-Address header via empleados_usuarios -> trabajadores_vpn
    and denies if cargo/seccion is in the excludes.
    No JWT verification, no session lookup.
    """
    # Support both HTTP and WebSocket routes
    if request is not None:
        path = request.url.path
        method = request.method.upper()
    elif websocket is not None:
        path = websocket.url.path
        method = "WS"
    else:
        return

    if method == "OPTIONS" or path in ("/api/login", "/debug/cookies", "/debug/routes"):
        return

    rule = _find_rule_for_path(path)
    if not rule:
        return

    # Normalize include/exclude lists
    inc_c = [_norm(i) for i in (rule.get("include_cargos") or []) if str(i).strip()]
    inc_s = [_norm(i) for i in (rule.get("include_secciones") or []) if str(i).strip()]
    exc_c = [_norm(i) for i in (rule.get("exclude_cargos") or []) if str(i).strip()]
    exc_s = [_norm(i) for i in (rule.get("exclude_secciones") or []) if str(i).strip()]

    has_includes = bool(inc_c or inc_s)
    has_excludes = bool(exc_c or exc_s)

    # Nothing configured => allow
    if not has_includes and not has_excludes:
        return

    # Resolve cargo/seccion only if needed
    wallet = None
    sub = None
    if request is not None:
        wallet = request.headers.get("X-Wallet-Address")
        sub = request.headers.get("X-Privy-Sub") or request.headers.get("X-User-Sub")
    elif websocket is not None and hasattr(websocket, "headers"):
        wallet = websocket.headers.get("X-Wallet-Address")
        sub = websocket.headers.get("X-Privy-Sub") if hasattr(websocket, "headers") else None
    meta = _resolve_cargo_seccion(wallet, sub)
    cargo = _norm(meta.get("cargo"))
    seccion = _norm(meta.get("seccion"))

    # If includes exist: ONLY allow listed cargos/secciones
    if has_includes:
        # include_secciones can contain either seccion labels or cargo labels (UX convenience)
        if (cargo and cargo in inc_c) or (seccion and seccion in inc_s) or (cargo and cargo in inc_s):
            return
        # No match to includes (or could not resolve) => deny
        raise HTTPException(status_code=403, detail="Access restricted to specific cargo/seccion")

    # Else, enforce excludes
    if (cargo and cargo in exc_c) or (seccion and seccion in exc_s) or (cargo and cargo in exc_s):
        raise HTTPException(status_code=403, detail="Access denied for your cargo/seccion")
    # Not excluded => allow
    return
