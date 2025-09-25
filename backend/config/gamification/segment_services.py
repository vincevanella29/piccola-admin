from __future__ import annotations
import os
import logging
from typing import List, Dict, Any, Optional
from fastapi import HTTPException

from utils.web3mongo import db, w3, global_meritocracy_contract
from config.gamification.dao_services import resolve_company_dao_address

logger = logging.getLogger(__name__)

def build_allow_dao_tx(admin_wallet: str, token_id: int) -> Dict[str, Any]:
    if global_meritocracy_contract is None:
        raise HTTPException(status_code=500, detail="Contrato GlobalMeritocracy no inicializado")
    
    try:
        owner = global_meritocracy_contract.functions.owner().call()
        if owner.lower() != admin_wallet.lower():
            logger.warning(f"La wallet {admin_wallet} no es la propietaria del contrato GlobalMeritocracy. El propietario es {owner}. La transacción probablemente fallará con 'NotAuthorized'.")
    except Exception as e:
        logger.warning(f"No se pudo verificar el propietario del contrato GlobalMeritocracy: {e}")

    company_id_env = int(os.getenv('COMPANY_ID', '1'))
    company = db.companies.find_one({"companyId": company_id_env})
    if not company or not company.get("daoAddress"):
        raise HTTPException(status_code=404, detail=f"DAO de la compañía {company_id_env} no encontrada")
    dao_address = w3.to_checksum_address(company["daoAddress"])
    
    tx = global_meritocracy_contract.functions.allowOrBanSegmentDAO(int(token_id), dao_address, True, 0).build_transaction({
        "from": w3.to_checksum_address(admin_wallet),
        "nonce": w3.eth.get_transaction_count(w3.to_checksum_address(admin_wallet)),
    })
    
    data_field = tx.get("data")
    if hasattr(data_field, 'hex'):
        tx["data"] = data_field.hex()
    
    return {"ok": True, "transaction": tx}


def list_allowed_daos_for_token(token_id: int, only_company_env: bool = False) -> Dict[str, Any]:
    if global_meritocracy_contract is None:
        raise HTTPException(status_code=500, detail="Contrato GlobalMeritocracy no inicializado")
    # Build candidate set
    daos: List[str] = []
    if only_company_env:
        company_id_env = int(os.getenv('COMPANY_ID', '1'))
        company = db.companies.find_one({"companyId": company_id_env})
        if company and company.get("daoAddress"):
            daos = [company["daoAddress"]]
    else:
        cursor = db.companies.find({"daoAddress": {"$exists": True, "$ne": None}}, {"_id": 0, "daoAddress": 1})
        daos = [doc["daoAddress"] for doc in cursor if doc.get("daoAddress")]
    dao_set: List[str] = []
    seen = set()
    for addr in daos:
        try:
            c = w3.to_checksum_address(addr)
            if c not in seen:
                seen.add(c)
                dao_set.append(c)
        except Exception:
            continue

    # Try contract method first
    results: List[Dict[str, Any]] = []
    try:
        if hasattr(global_meritocracy_contract.functions, 'isDAOAllowed'):
            for addr in dao_set:
                try:
                    allowed = bool(global_meritocracy_contract.functions.isDAOAllowed(int(token_id), addr).call())
                    results.append({"dao": addr, "allowed": allowed})
                except Exception:
                    results.append({"dao": addr, "allowed": False, "error": "call_failed"})
            return {"ok": True, "token_id": int(token_id), "daos": results}
    except Exception:
        pass

    # Fallback to events
    ev_coll = db.get_collection('global_meritocracy_events')
    cursor = ev_coll.find({"event": "AllowedDAOUpdated", "args.tokenId": int(token_id)}, {"_id": 0, "args": 1})
    latest: Dict[str, bool] = {}
    for doc in cursor:
        args = doc.get("args", {})
        dao = args.get("daoTarget")
        allow = args.get("allow")
        if dao is None or allow is None:
            continue
        try:
            dao_c = w3.to_checksum_address(dao)
            latest[dao_c] = bool(allow)
        except Exception:
            continue
    if dao_set:
        results = [{"dao": d, "allowed": bool(latest.get(d, False))} for d in dao_set]
    else:
        results = [{"dao": d, "allowed": bool(allowed)} for d, allowed in latest.items()]
    return {"ok": True, "token_id": int(token_id), "daos": results, "from": "events"}

def build_authorize_company_all_segments(admin_wallet: str) -> Dict[str, Any]:
    if global_meritocracy_contract is None:
        raise HTTPException(status_code=500, detail="Contrato GlobalMeritocracy no inicializado")
    company_id_env = int(os.getenv('COMPANY_ID', '1'))
    company = db.companies.find_one({"companyId": company_id_env})
    if not company or not company.get("daoAddress"):
        raise HTTPException(status_code=404, detail=f"DAO de la compañía {company_id_env} no encontrada")
    dao_address = w3.to_checksum_address(company["daoAddress"])

    # enumerate token ids via events (fallback safe)
    token_ids: List[int] = []
    try:
        if hasattr(global_meritocracy_contract.functions, 'nextTokenId'):
            next_id = int(global_meritocracy_contract.functions.nextTokenId().call())
            token_ids = list(range(1, max(1, next_id)))
        else:
            ev_coll = db.get_collection('global_meritocracy_events')
            cursor = ev_coll.find({"event": "TokenCreated"}, {"_id": 0, "args": 1})
            token_ids = sorted({int(doc["args"].get("tokenId")) for doc in cursor if doc.get("args") and doc["args"].get("tokenId") is not None})
            token_ids = [tid for tid in token_ids if tid != 0]
    except Exception as e:
        logger.exception("Error enumerando segmentos")
        raise HTTPException(status_code=500, detail=str(e))

    txs = []
    nonce = w3.eth.get_transaction_count(w3.to_checksum_address(admin_wallet))
    for tid in token_ids:
        try:
            if hasattr(global_meritocracy_contract.functions, 'isDAOAllowed'):
                try:
                    if bool(global_meritocracy_contract.functions.isDAOAllowed(int(tid), dao_address).call()):
                        continue
                except Exception:
                    pass
            tx = global_meritocracy_contract.functions.allowOrBanSegmentDAO(int(tid), dao_address, True, 0).build_transaction({
                "from": w3.to_checksum_address(admin_wallet),
                "nonce": nonce,
            })
            nonce += 1
            if hasattr(tx.get("data"), 'hex'):
                tx["data"] = tx["data"].hex()
            txs.append({"token_id": int(tid), "tx": tx})
        except Exception:
            continue
    return {"ok": True, "company_id": company_id_env, "daoAddress": dao_address, "authorizeTransactions": txs}
