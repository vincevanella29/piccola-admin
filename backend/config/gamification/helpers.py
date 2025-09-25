from __future__ import annotations
import os
import logging
from typing import List, Dict, Any, Optional, Tuple
from datetime import datetime, timezone, timedelta

from fastapi import HTTPException
from pymongo import UpdateOne, ASCENDING

from utils.web3mongo import db, w3, global_meritocracy_contract
from .dao_services import resolve_company_dao_address

logger = logging.getLogger(__name__)

MERIT_TOKENS_COLL = db.get_collection('merit_company_tokens')
EV_COLL = db.get_collection('global_meritocracy_events')
DAO_COLL = db.get_collection('dao_events')

# ---------- índices recomendados (idempotente) ----------
def _ensure_indexes():
    try:
        MERIT_TOKENS_COLL.create_index(
            [("dao_address", ASCENDING), ("token_id", ASCENDING)],
            unique=True,
            name="uniq_dao_token"
        )
        MERIT_TOKENS_COLL.create_index([("allowed", ASCENDING)], name="idx_allowed")
        MERIT_TOKENS_COLL.create_index([("allowed_last_checked_at", ASCENDING)], name="idx_allowed_checked_at")
    except Exception:
        logger.exception("No se pudo crear índices merit_company_tokens")


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _needs_refresh(doc: Optional[Dict[str, Any]], refresh_delta: timedelta) -> bool:
    if not doc:
        return True
    ts = doc.get("allowed_last_checked_at")
    if not ts:
        return True
    # Acepta tanto naive como aware; normaliza a aware UTC
    if isinstance(ts, datetime) and ts.tzinfo is None:
        ts = ts.replace(tzinfo=timezone.utc)
    return (_utcnow() - ts) >= refresh_delta


def _token_meta_from_events() -> Dict[int, Dict[str, Any]]:
    """
    Lee metadata base desde eventos TokenCreated (token_id, name, symbol, txHash).
    """
    cursor = EV_COLL.find(
        {"event": "TokenCreated"},
        {"_id": 0, "args": 1, "transactionHash": 1}
    ).sort([("args.tokenId", 1)])

    by_id: Dict[int, Dict[str, Any]] = {}
    for doc in cursor:
        args = (doc or {}).get("args", {})
        tid = args.get("tokenId")
        if tid is None:
            continue
        try:
            token_id = int(tid)
        except Exception:
            continue
        if token_id == 0:
            continue
        name = args.get("name") or f"Segment {token_id}"
        symbol = args.get("symbol") or f"SEG{token_id}"
        by_id[token_id] = {
            "token_id": token_id,
            "name": name,
            "symbol": symbol,
            "transactionHash": doc.get("transactionHash"),
            "meta_source": "events",
        }
    return by_id


def _maybe_meta_from_chain(token_id: int) -> Optional[Dict[str, Any]]:
    """
    Intenta leer metadata on-chain si existen funciones. Fallback: None.
    (No sabemos ABI exacta; probamos algunos nombres comunes y fallamos silencioso.)
    """
    try:
        fn = None
        # Ejemplos posibles; adapta si tu contrato tiene otra firma
        if hasattr(global_meritocracy_contract.functions, "getTokenInfo"):
            fn = global_meritocracy_contract.functions.getTokenInfo(token_id)
        elif hasattr(global_meritocracy_contract.functions, "tokenInfo"):
            fn = global_meritocracy_contract.functions.tokenInfo(token_id)
        elif hasattr(global_meritocracy_contract.functions, "segments"):  # mapping(tokenId) -> (name,symbol,…)
            fn = global_meritocracy_contract.functions.segments(token_id)

        if fn is None:
            return None

        info = fn.call()
        # Intenta mapear tuplas comunes (name, symbol, ...). Ajusta si difiere.
        name = None
        symbol = None
        if isinstance(info, (list, tuple)):
            if len(info) >= 1 and isinstance(info[0], str):
                name = info[0]
            if len(info) >= 2 and isinstance(info[1], str):
                symbol = info[1]
        elif isinstance(info, dict):
            name = info.get("name")
            symbol = info.get("symbol")

        out = {
            "token_id": token_id,
            "name": name or f"Segment {token_id}",
            "symbol": symbol or f"SEG{token_id}",
            "meta_source": "chain",
        }
        return out
    except Exception:
        return None


def _check_allowed_onchain(dao_address: str, token_id: int) -> Optional[bool]:
    """
    Devuelve True/False si se pudo consultar on-chain, o None si no existe método/ocurrió error.
    """
    try:
        if hasattr(global_meritocracy_contract.functions, "isDAOAllowed"):
            return bool(global_meritocracy_contract.functions.isDAOAllowed(int(token_id), dao_address).call())
        return None
    except Exception:
        return None


def _infer_allowed_from_events(dao_address: str, token_id: int, created_tx: Optional[str]) -> bool:
    """
    Fallback por eventos:
      1) Último AllowedDAOUpdated para este dao+token.
      2) Si no hay, inferir permitido si el TokenCreated ocurrió en una ProposalExecuted (mismo tx).
    """
    # 1) Último AllowedDAOUpdated
    try:
        allow_doc = EV_COLL.find_one(
            {"event": "AllowedDAOUpdated", "args.daoTarget": dao_address, "args.tokenId": token_id},
            sort=[("_id", -1)],
            projection={"_id": 0, "args": 1},
        )
        if allow_doc:
            allow_args = allow_doc.get("args", {})
            allow = allow_args.get("allow")
            if allow is not None:
                return bool(allow)
    except Exception:
        pass

    # 2) Inferencia por ProposalExecuted
    if created_tx:
        try:
            if DAO_COLL.find_one({"event": "ProposalExecuted", "transactionHash": created_tx}, {"_id": 0}):
                return True
        except Exception:
            pass

    return False


def _upsert_tokens(
    dao_address: str,
    meta_by_id: Dict[int, Dict[str, Any]],
    refresh_delta: timedelta = timedelta(hours=24),
) -> List[Dict[str, Any]]:
    """
    Upsert a merit_company_tokens:
      - Persiste metadata (name, symbol, txHash, meta_source).
      - Chequea allowed sólo si no existe o si pasaron >= 24h.
      - Devuelve lista de segmentos (incluye flag allowed).
    """
    now = _utcnow()
    # Cargamos existentes de una
    existing_docs = {
        d["token_id"]: d
        for d in MERIT_TOKENS_COLL.find(
            {"dao_address": dao_address, "token_id": {"$in": list(meta_by_id.keys())}},
            {"_id": 0}
        )
    }

    ops: List[UpdateOne] = []
    segments: List[Dict[str, Any]] = []

    for token_id, base_meta in meta_by_id.items():
        existing = existing_docs.get(token_id)
        must_refresh = _needs_refresh(existing, refresh_delta)

        # ---- Metadata preferible on-chain; si no, eventos
        onchain_meta = _maybe_meta_from_chain(token_id)
        name = (onchain_meta or {}).get("name") or base_meta.get("name")
        symbol = (onchain_meta or {}).get("symbol") or base_meta.get("symbol")
        meta_source = (onchain_meta or {}).get("meta_source", base_meta.get("meta_source", "events"))
        created_tx = base_meta.get("transactionHash")

        # ---- Allowed (chequeo por día)
        allowed: Optional[bool] = None
        checked_via = None
        if must_refresh:
            allowed = _check_allowed_onchain(dao_address, token_id)
            if allowed is not None:
                checked_via = "chain"
            else:
                allowed = _infer_allowed_from_events(dao_address, token_id, created_tx)
                checked_via = "events_infer"  # AllowedDAOUpdated o ProposalExecuted

        # Si no refrescamos ahora, usamos valor existente
        if allowed is None and existing is not None:
            allowed = bool(existing.get("allowed", False))
            checked_via = existing.get("checked_via", "cache")

        # Default seguro
        if allowed is None:
            allowed = False
            checked_via = "default_false"

        # ---- Upsert (FIX)
        update_fields: Dict[str, Any] = {
            "dao_address": dao_address,
            "token_id": token_id,
            "name": name,
            "symbol": symbol,
            "transaction_hash": created_tx,
            "meta_source": meta_source,
            "allowed": bool(allowed),
            "updated_at": now,
        }

        # Solo si refrescamos ahora, marcamos timestamp
        if must_refresh:
            update_fields["allowed_last_checked_at"] = now
            update_fields["checked_via"] = checked_via

        ops.append(UpdateOne(
            {"dao_address": dao_address, "token_id": token_id},
            {"$set": update_fields, "$setOnInsert": {"created_at": now}},
            upsert=True
        ))


        # Payload para respuesta
        segments.append({
            "token_id": token_id,
            "name": name,
            "symbol": symbol,
            "allowed": bool(allowed),
        })

    if ops:
        try:
            MERIT_TOKENS_COLL.bulk_write(ops, ordered=False)
        except Exception:
            logger.exception("bulk_write merit_company_tokens falló")

    # Ordena por token_id para determinismo
    segments.sort(key=lambda s: s["token_id"])
    return segments


def list_permitted_segments_for_company() -> Dict[str, Any]:
    """
    Sincroniza metadata y estado allowed de tokens a BD (merit_company_tokens),
    respetando el límite de 1 chequeo por día por token.
    Devuelve estructura consumible por el front/service actual.
    """
    _ensure_indexes()

    dao_address = resolve_company_dao_address()

    # 1) Descubrir universe de tokens por metadata (eventos) primero
    meta_by_id = _token_meta_from_events()

    # Si tu contrato expone nextTokenId, agrega ids faltantes (por si algún TokenCreated faltó en logs)
    try:
        if hasattr(global_meritocracy_contract.functions, 'nextTokenId'):
            nxt = int(global_meritocracy_contract.functions.nextTokenId().call())
            for tid in range(1, max(1, nxt)):
                if tid not in meta_by_id:
                    # Crea shell y trata de completar con on-chain metadata
                    onchain = _maybe_meta_from_chain(tid) or {
                        "token_id": tid, "name": f"Segment {tid}", "symbol": f"SEG{tid}", "meta_source": "chain_guess"
                    }
                    onchain["transactionHash"] = None
                    meta_by_id[tid] = onchain
    except Exception:
        # silencioso: seguimos con lo que tengamos
        pass

    # 2) Upsert + allowed refresh (1 vez al día)
    segments = _upsert_tokens(dao_address, meta_by_id, refresh_delta=timedelta(hours=24))

    # 3) Armar respuesta (igual formato que usabas)
    # Calcula “from” preferente: si existió on-chain, marcamos chain; sino events
    has_chain = any(seg.get("allowed") for seg in segments)  # heurística liviana
    source = "chain_or_events"
    try:
        if hasattr(global_meritocracy_contract.functions, "isDAOAllowed"):
            source = "chain"
        else:
            source = "events"
    except Exception:
        source = "events"

    return {"ok": True, "daoAddress": dao_address, "segments": segments, "from": source}
