from __future__ import annotations
import os
import logging
from typing import List, Dict, Any, Optional
from fastapi import HTTPException

from utils.web3mongo import db, w3
from .helpers import list_permitted_segments_for_company

logger = logging.getLogger(__name__)


# -----------------------------
# Helpers de ficha de empleados
# -----------------------------
LINKS_EMPLEADOS = db.empleados_usuarios


def get_employee_profile_by_rut(rut: str) -> Optional[dict]:
    """Obtiene la ficha de trabajador desde trabajadores_vpn dado un RUT.

    Esta función replica la lógica usada en los endpoints de Mi Ficha para que
    otros módulos (por ejemplo community_users) puedan reutilizar la misma
    fuente de verdad del sistema de RRHH.
    """
    if not rut:
        return None
    or_terms = [{"rut": rut}]
    try:
        or_terms.append({"rut": int(rut)})
    except Exception:
        pass
    emp = db.trabajadores_vpn.find_one({"$or": or_terms})
    if emp and emp.get("_id"):
        emp["_id"] = str(emp["_id"])
    return emp


def resolve_employee_from_session(user: dict) -> Optional[Dict[str, Any]]:
    """Intenta resolver la ficha de empleado a partir de la sesión (wallet/sub/email).

    Devuelve un dict con claves {"rut", "emp"} o None si no hay vínculo.
    """
    if not user:
        return None
    wallet = user.get("wallet")
    sub = user.get("sub")
    email = user.get("email")
    or_terms = []
    if wallet:
        or_terms.append({"wallet": wallet})
    if sub:
        or_terms.append({"sub": sub})
    if email:
        or_terms.append({"email": email})
    if not or_terms:
        return None
    link = LINKS_EMPLEADOS.find_one({"$or": or_terms})
    if not link:
        return None
    rut = str(link.get("rut") or "").strip()
    if not rut:
        return None
    emp = get_employee_profile_by_rut(rut)
    if not emp:
        return None
    return {"rut": rut, "emp": emp}


def normalize_employee_birthdate(value: Optional[object]) -> Optional[str]:
    """Normaliza fecha de nacimiento a string YYYY-MM-DD/ISO cuando viene desde ficha empleados."""
    if value is None:
        return None
    from datetime import datetime as _dt

    if isinstance(value, _dt):
        return value.date().isoformat()
    try:
        # Truncamos a 10 chars por si viene con hora
        return str(value)[:10]
    except Exception:
        return str(value)

def user_profile_summary(wallet: str) -> Dict[str, Any]:
    try:
        user_wallet = w3.to_checksum_address(wallet)
    except Exception:
        raise HTTPException(status_code=400, detail="Wallet inválida")

    # 1. Get all segments allowed by the company's DAO
    try:
        segments_data = list_permitted_segments_for_company()
        dao_address = segments_data.get("daoAddress")
        company_id_env = int(os.getenv('COMPANY_ID', '1'))
        allowed_segments = {seg['token_id']: seg for seg in segments_data.get("segments", []) if seg.get("allowed")}
    except Exception as e:
        logger.exception("Error fetching permitted segments")
        raise HTTPException(status_code=500, detail=f"Error obteniendo segmentos permitidos: {e}")

    # 2. Calculate balances from event logs using a single aggregation query
    balances_by_token: Dict[int, int] = {}
    try:
        pipeline = [
            {
                "$match": {
                    "event": "TokensMinted",
                    "args.to": {"$regex": f"^{user_wallet}$", "$options": "i"},
                    "args.tokenId": {"$in": list(allowed_segments.keys())}
                }
            },
            {
                "$addFields": {
                    "amount_numeric": {
                        "$convert": {
                            "input": "$args.amount",
                            "to": "decimal",
                            "onError": 0,
                            "onNull": 0
                        }
                    }
                }
            },
            {
                "$group": {
                    "_id": "$args.tokenId",
                    "total_balance": {"$sum": "$amount_numeric"}
                }
            }
        ]
        results = list(db.global_meritocracy_events.aggregate(pipeline))
        for res in results:
            # Convert Decimal128 to float first, then to int
            balances_by_token[res['_id']] = int(float(str(res['total_balance'])))
    except Exception as e:
        logger.exception(f"Error aggregating merit balances for wallet {user_wallet}: {e}")
        # Continue, balances will be 0

    # 3. Build the profile using allowed segments and their calculated balances
    profile: List[Dict[str, Any]] = []
    total_balance = 0
    for token_id, segment_meta in allowed_segments.items():
        balance = balances_by_token.get(token_id, 0)
        profile.append({
            "token_id": token_id,
            "name": segment_meta.get("name"),
            "symbol": segment_meta.get("symbol"),
            "balance": balance,
        })
        total_balance += balance

    # 4. Return the simplified profile
    return {
        "ok": True,
        "wallet": user_wallet,
        "company_id": company_id_env,
        "daoAddress": dao_address,
        "segments": sorted(profile, key=lambda x: x['token_id']),
        "total_balance": total_balance,
    }
