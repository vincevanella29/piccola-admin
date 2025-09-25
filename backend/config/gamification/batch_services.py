from __future__ import annotations
import os
import logging
from typing import List, Dict, Any, Optional, Iterable, Set
from fastapi import HTTPException
from bson import ObjectId
from datetime import datetime

from utils.web3mongo import db, w3, load_contract_abi # Añadido load_contract_abi
from config.gamification.rules import pack_batch_entries
from config.gamification.models import RuleAward
# Importamos la función para resolver la dirección de la DAO
from config.gamification.dao_services import resolve_company_dao_address
from utils.time_utils import get_chile_time

logger = logging.getLogger(__name__)

def _get_banned_wallets() -> Set[str]:
    """
    Consulta los eventos de la DAO para obtener una lista de wallets actualmente baneadas.
    """
    pipeline = [
        {"$match": {"event": "UserBanStatusChanged", "args.isGeneral": True}},
        {"$sort": {"blockNumber": -1, "transactionIndex": -1}},
        {"$group": {
            "_id": "$args.target",
            "lastStatus": {"$first": "$args.banStatus"},
        }},
        {"$match": {"lastStatus": True}}
    ]
    banned_events = list(db.dao_events.aggregate(pipeline))
    return {w3.to_checksum_address(b["_id"]) for b in banned_events}


def plan_batch_merit(employees: List[Dict[str, str]], ym: Optional[str]) -> Dict[str, Any]:
    """
    Planifica un batch de méritos leyendo desde la colección de resultados pre-calculados.
    Filtra méritos ya pagados y usuarios baneados.
    """
    ym_final = ym or get_chile_time().strftime('%Y-%m')
    
    employee_wallets = {w3.to_checksum_address(e["wallet"]) for e in employees}
    banned_wallets = _get_banned_wallets()
    logger.info(f"Wallets baneadas encontradas: {len(banned_wallets)}")

    query = {
        "periodo": ym_final,
        "status": "fulfilled",
        "mint_status": {"$in": [None, "pending"]}
    }
    
    results_cursor = db.meritocracy_kpi_results.find(query)
    
    awards_all: List[Dict[str, Any]] = []
    ruts_in_batch = set()

    for res in results_cursor:
        rut = res.get("rut")
        employee_info = next((e for e in employees if e["rut"] == rut), None)
        if not employee_info:
            continue
            
        wallet = w3.to_checksum_address(employee_info.get("wallet"))
        
        if wallet in banned_wallets:
            logger.warning(f"RUT {rut} (wallet {wallet}) omitido por estar baneado.")
            continue
        
        if wallet not in employee_wallets or rut in ruts_in_batch:
            continue
            
        ruts_in_batch.add(rut)
        
        amount_wei = int(float(res.get("merit_points", 0)) * (10**18))
        if amount_wei > 0:
            awards_all.append({
                "result_id": str(res["_id"]),
                "wallet": wallet,
                "rut": rut,
                "token_id": res.get("segment_token_id"),
                "amount_wei": amount_wei,
                "reason": f"Rule: {res.get('rule_name')} for {res.get('periodo')}"
            })

    packed_hex_chunks: List[str] = []
    if awards_all:
        awards_for_packing = [RuleAward(**a) for a in awards_all]
        packed_hex_chunks.append(pack_batch_entries(awards_for_packing))

    totals: Dict[int, int] = {}
    for a in awards_all:
        tid = int(a["token_id"]); amt = int(a["amount_wei"])
        totals[tid] = totals.get(tid, 0) + amt

    return {
        "ok": True, 
        "ym": ym_final, 
        "awards": awards_all,
        "packed": packed_hex_chunks, 
        "totals_by_token": totals
    }


def mark_merits_as_minted(award_ids: List[str], tx_hash: str):
    """
    Actualiza los documentos en meritocracy_kpi_results para marcarlos como pagados.
    """
    if not award_ids:
        return
    
    logger.info(f"Marcando {len(award_ids)} méritos como 'minted' con tx_hash: {tx_hash}")
    
    object_ids = [ObjectId(id_str) for id_str in award_ids]
    
    db.meritocracy_kpi_results.update_many(
        {"_id": {"$in": object_ids}},
        {
            "$set": {
                "mint_status": "minted",
                "mint_tx_hash": tx_hash,
                "minted_at": datetime.utcnow()
            }
        }
    )

### FUNCIÓN FALTANTE AÑADIDA ###
def build_batch_txs_via_dao(packed_hex_chunks: Iterable[str], admin_wallet: str) -> Dict[str, Any]:
    """
    Construye UNA SOLA transacción para llamar a 'daoProcessMintBatch' en el contrato de la DAO,
    concatenando todos los "chunks" en un solo buffer de calldata. Esto permite mintear a todos
    los usuarios en una única transferencia, siempre que el contrato lo permita.
    """
    dao_addr = resolve_company_dao_address()
    dao_abi = load_contract_abi("VanellixDAOController")
    dao = w3.eth.contract(address=dao_addr, abi=dao_abi)

    # Concatenar todos los chunks en un único payload hex
    chunks = list(packed_hex_chunks or [])
    if not chunks:
        raise HTTPException(status_code=400, detail="No hay datos para construir el batch (packed_hex_chunks vacío).")
    try:
        concatenated_bytes = b"".join(bytes.fromhex(ch[2:] if ch.startswith("0x") else ch) for ch in chunks)
    except Exception as e:
        logger.error(f"Error al concatenar packed_hex_chunks: {e}")
        raise HTTPException(status_code=400, detail="Chunks inválidos para construir el batch.")
    data_hex = "0x" + concatenated_bytes.hex()

    try:
        nonce = w3.eth.get_transaction_count(admin_wallet)
    except Exception as e:
        logger.error(f"No se pudo obtener el nonce para la wallet {admin_wallet}: {e}")
        raise HTTPException(status_code=400, detail=f"Wallet del firmante inválida o inaccesible: {admin_wallet}")

    # --- Gas alto para batches grandes; el contrato hará revert si no permite tamaños grandes ---
    tx = dao.functions.daoProcessMintBatch(data_hex).build_transaction({
        "from": admin_wallet,
        "nonce": nonce,
        "gas": 5_000_000
    })
    if 'data' in tx and hasattr(tx['data'], 'hex'):
        tx['data'] = tx['data'].hex()

    # Mantener compatibilidad: devolvemos una lista, pero con UNA sola tx
    return {"ok": True, "daoAddress": dao_addr, "transactions": [tx]}