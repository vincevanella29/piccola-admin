from __future__ import annotations
import os
import logging
from typing import Dict, Any
from web3 import Web3
from fastapi import HTTPException

from utils.web3mongo import db, w3, global_meritocracy_contract, launchpad_contract, load_contract_abi
from config.gamification.models import DEFAULT_SPECIAL_SEGMENTS

logger = logging.getLogger(__name__)


# ---- DAO Helpers ----

def _existing_segments_from_events() -> dict[int, dict]:
    ev_coll = db.get_collection('global_meritocracy_events')
    cursor = ev_coll.find({"event": "TokenCreated"}, {"_id": 0, "args": 1}).sort([("args.tokenId", 1)])
    reverse_by_name: dict[str, int] = {}
    reverse_by_symbol: dict[str, int] = {}
    for doc in cursor:
        args = doc.get("args", {})
        tid = args.get("tokenId")
        try:
            tid_i = int(tid)
        except Exception:
            continue
        if tid_i == 0:
            continue
        name = (args.get("name") or '').strip()
        symbol = (args.get("symbol") or '').strip()
        if name:
            reverse_by_name[name.lower()] = tid_i
        if symbol:
            reverse_by_symbol[symbol.upper()] = tid_i
    return {"by_name": reverse_by_name, "by_symbol": reverse_by_symbol}

def get_company_dao_address_service() -> Dict[str, Any]:
    try:
        company_id_env = int(os.getenv('COMPANY_ID', '1'))
        if company_id_env != 0:
            company = db.companies.find_one({"companyId": company_id_env})
            if not company or not company.get("daoAddress"):
                raise HTTPException(status_code=404, detail=f"DAO de la compañía {company_id_env} no encontrada")
            return {"ok": True, "daoAddress": company["daoAddress"], "company_id": company_id_env}
        
        dao_addr = resolve_company_dao_address()
        return {"ok": True, "daoAddress": dao_addr, "company_id": company_id_env}
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Error obteniendo DAO address")
        raise HTTPException(status_code=500, detail=str(e))

def resolve_company_dao_address() -> str:
    company_id_env = int(os.getenv('COMPANY_ID', '0'))
    if company_id_env == 0:
        try:
            dao_addr = launchpad_contract.functions.validateContract("DAO").call()
            if not dao_addr or int(dao_addr, 16) == 0:
                raise HTTPException(status_code=404, detail="DAO global (Launchpad) no configurado")
            return w3.to_checksum_address(dao_addr)
        except HTTPException:
            raise
        except Exception as e:
            logger.exception("Error resolviendo DAO global desde Launchpad")
            raise HTTPException(status_code=500, detail=str(e))
    else:
        try:
            company = db.companies.find_one({"companyId": company_id_env})
            if not company or not company.get("daoAddress"):
                raise HTTPException(status_code=404, detail=f"DAO de la compañía {company_id_env} no encontrada")
            return w3.to_checksum_address(company["daoAddress"])
        except HTTPException:
            raise
        except Exception as e:
            logger.exception("Error resolviendo DAO de la compañía")
            raise HTTPException(status_code=500, detail=str(e))

# ---- DAO & Proposal Services ----

def bootstrap_special_via_dao_service(admin_wallet: str) -> Dict[str, Any]:
    if global_meritocracy_contract is None:
        raise HTTPException(status_code=500, detail="Contrato GlobalMeritocracy no inicializado")

    dao_addr = resolve_company_dao_address()
    dao_abi = load_contract_abi("VanellixDAOController")
    dao = w3.eth.contract(address=dao_addr, abi=dao_abi)

    gm_abi = load_contract_abi("GlobalMeritocracy")
    gm = w3.eth.contract(address=global_meritocracy_contract.address, abi=gm_abi)

    existing = _existing_segments_from_events()
    by_name = existing.get("by_name", {})
    by_symbol = existing.get("by_symbol", {})

    nonce = w3.eth.get_transaction_count(admin_wallet)
    txs = []
    for seg in DEFAULT_SPECIAL_SEGMENTS:
        name = seg.name.strip()
        symbol = seg.symbol.strip()
        if by_name.get(name.lower()) or by_symbol.get(symbol.upper()):
            logger.info(f"Segment '{name}' already exists, skipping proposal.")
            continue
        
        calldata_hex = gm.functions.createCategoryToken(name, symbol)._encode_transaction_data()
        calldata = Web3.to_bytes(hexstr=calldata_hex)
        
        params = (
            global_meritocracy_contract.address,  # target
            calldata,                             # callData (bytes)
            False,                                # isQuorumChange
            False,                                # isAmendment
            0,                                    # parentId
            0,                                    # category (uint8)
            0,                                    # requiredTokenId
            True,                                 # requiresYesNo
            7,                                    # votingDurationDays
        )
        tx = dao.functions.propose(params).build_transaction({
            "from": admin_wallet,
            "gas": 500000,
            "nonce": nonce,
        })
        nonce += 1
        if hasattr(tx.get("data"), 'hex'):
            tx["data"] = tx["data"].hex()
        txs.append({"name": name, "symbol": symbol, "tx": tx})

    return {"ok": True, "daoAddress": dao_addr, "proposals": txs}

def list_dao_proposals_service(from_block: int | None = None, to_block: int | None = None) -> Dict[str, Any]:
    try:
        dao_addr = resolve_company_dao_address()
        coll = db.get_collection('dao_events')

        q_created: Dict[str, Any] = {"event": "ProposalCreated"}
        q_executed: Dict[str, Any] = {"event": "ProposalExecuted"}
        if from_block is not None:
            q_created["blockNumber"] = {"$gte": int(from_block)}
            q_executed["blockNumber"] = {"$gte": int(from_block)}
        if to_block is not None:
            q_created.setdefault("blockNumber", {})["$lte"] = int(to_block)
            q_executed.setdefault("blockNumber", {})["$lte"] = int(to_block)

        created_docs = list(coll.find(q_created, {"_id": 0}).sort([("blockNumber", -1)]).limit(500))
        executed_docs = list(coll.find(q_executed, {"_id": 0}))

        executed_ids: set[int] = set()
        for d in executed_docs:
            args = d.get("args", {})
            pid = args.get("id") if args else None
            if pid is None and isinstance(args, list) and args:
                pid = args[0]
            try:
                executed_ids.add(int(pid))
            except Exception:
                continue

        items = []
        for d in created_docs:
            args = d.get("args", {})
            pid = args.get("id") if args else None
            if pid is None and isinstance(args, list) and args:
                pid = args[0]
            try:
                proposal_id = int(pid)
            except Exception:
                continue
            target = args.get("target")
            callData = args.get("callData")
            if isinstance(callData, (bytes, bytearray)):
                try:
                    callData = callData.hex()
                except Exception:
                    pass
            if isinstance(callData, str):
                c = callData.lower()
                if c.startswith("0x"):
                    c = c[2:]
                try:
                    int(c or "", 16)
                    callData = "0x" + c
                except Exception:
                    pass
            item = {
                "id": proposal_id,
                "target": target,
                "callData": callData,
                "isQuorumChange": bool(args.get("isQuorumChange", False)),
                "isAmendment": bool(args.get("isAmendment", False)),
                "parentId": int(args.get("parentId", 0) or 0),
                "requiresYesNo": bool(args.get("requiresYesNo", True)),
                "executed": proposal_id in executed_ids,
                "blockNumber": d.get("blockNumber"),
                "transactionHash": d.get("transactionHash"),
            }
            decoded = None
            try:
                if target and isinstance(callData, str) and callData.startswith("0x"):
                    if target.lower() == global_meritocracy_contract.address.lower():
                        fn, fn_args = global_meritocracy_contract.decode_function_input(callData)
                        decoded = {"function": fn.fn_name, "args": fn_args}
                    else:
                        if target.lower() == dao_addr.lower():
                            dao_abi = load_contract_abi("VanellixDAOController")
                            dao_tmp = w3.eth.contract(address=dao_addr, abi=dao_abi)
                            fn, fn_args = dao_tmp.decode_function_input(callData)
                            decoded = {"function": fn.fn_name, "args": fn_args}
            except Exception:
                decoded = None
            if decoded is not None:
                item["decoded"] = decoded
            items.append(item)

        return {"ok": True, "daoAddress": dao_addr, "from_block": from_block, "to_block": to_block, "proposals": items}
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Error listando propuestas DAO desde eventos")
        raise HTTPException(status_code=500, detail=str(e))

def build_vote_tx_service(admin_wallet: str, proposal_id: int, support: bool) -> Dict[str, Any]:
    try:
        dao_addr = resolve_company_dao_address()
        dao_abi = load_contract_abi("VanellixDAOController")
        dao = w3.eth.contract(address=dao_addr, abi=dao_abi)
        tx = dao.functions.vote(int(proposal_id), bool(support)).build_transaction({
            "from": admin_wallet,
            "nonce": w3.eth.get_transaction_count(admin_wallet),
            "gas": 300000,
        })
        if hasattr(tx.get("data"), 'hex'):
            tx["data"] = tx["data"].hex()
        return {"ok": True, "daoAddress": dao_addr, "transaction": tx}
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Error construyendo TX de voto")
        raise HTTPException(status_code=500, detail=str(e))

def build_execute_tx_service(admin_wallet: str, proposal_id: int) -> Dict[str, Any]:
    try:
        dao_addr = resolve_company_dao_address()
        dao_abi = load_contract_abi("VanellixDAOController")
        dao = w3.eth.contract(address=dao_addr, abi=dao_abi)
        tx = dao.functions.execute(int(proposal_id)).build_transaction({
            "from": admin_wallet,
            "nonce": w3.eth.get_transaction_count(admin_wallet),
            "gas": 800000,  # execution may be expensive
        })
        if hasattr(tx.get("data"), 'hex'):
            tx["data"] = tx["data"].hex()
        return {"ok": True, "daoAddress": dao_addr, "transaction": tx}
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Error construyendo TX de ejecución")
        raise HTTPException(status_code=500, detail=str(e))

def build_set_fast_minter_tx(admin_wallet: str, minter_wallet: str, enabled: bool) -> Dict[str, Any]:
    """Builds a transaction to set a fast minter on the DAO contract."""
    try:
        dao_addr = resolve_company_dao_address()
        dao_abi = load_contract_abi("VanellixDAOController")
        dao = w3.eth.contract(address=dao_addr, abi=dao_abi)
        
        # Se añade un límite de gas explícito para evitar problemas de estimación
        tx = dao.functions.setFastMinter(
            w3.to_checksum_address(minter_wallet),
            enabled
        ).build_transaction({
            "from": w3.to_checksum_address(admin_wallet),
            "nonce": w3.eth.get_transaction_count(w3.to_checksum_address(admin_wallet)),
            "gas": 500000 
        })
        
        if hasattr(tx.get("data"), 'hex'):
            tx["data"] = tx["data"].hex()
            
        return {"ok": True, "daoAddress": dao_addr, "transaction": tx}
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Error construyendo TX para setFastMinter")
        raise HTTPException(status_code=500, detail=str(e))


def build_create_segment_tx(admin_wallet: str, name: str, symbol: str) -> Dict[str, Any]:
    """Builds a DAO proposal to create a new meritocracy segment."""
    if global_meritocracy_contract is None:
        raise HTTPException(status_code=500, detail="Contrato GlobalMeritocracy no inicializado")

    dao_addr = resolve_company_dao_address()
    dao_abi = load_contract_abi("VanellixDAOController")
    dao = w3.eth.contract(address=dao_addr, abi=dao_abi)
    gm_abi = load_contract_abi("GlobalMeritocracy")
    gm = w3.eth.contract(address=global_meritocracy_contract.address, abi=gm_abi)

    existing = _existing_segments_from_events()
    by_name = existing.get("by_name", {})
    by_symbol = existing.get("by_symbol", {})
    if by_name.get(name.strip().lower()) or by_symbol.get(symbol.strip().upper()):
        raise HTTPException(status_code=409, detail="Segment with this name or symbol already exists.")

    calldata_hex = gm.functions.createCategoryToken(name.strip(), symbol.strip())._encode_transaction_data()
    calldata = Web3.to_bytes(hexstr=calldata_hex)
    
    params = (
        global_meritocracy_contract.address,  # target
        calldata,                             # callData
        False,                                # isQuorumChange
        False,                                # isAmendment
        0,                                    # parentId
        0,                                    # category (uint8)
        0,                                    # requiredTokenId
        True,                                 # requiresYesNo
        7,                                    # votingDurationDays
    )
    tx = dao.functions.propose(params).build_transaction({
        "from": admin_wallet,
        "gas": 500000,
        "nonce": w3.eth.get_transaction_count(admin_wallet),
    })
    if hasattr(tx.get("data"), 'hex'):
        tx["data"] = tx["data"].hex()
    return {"ok": True, "daoAddress": dao_addr, "transaction": tx}


def list_fast_minters() -> Dict[str, Any]:
    """
    Lista todos los Fast Minters y su estado actual (enabled/disabled)
    consultando los eventos 'FastMinterSet' de la DAO.
    """
    try:
        dao_addr = resolve_company_dao_address()
        
        # Pipeline para obtener el último estado de cada Fast Minter
        pipeline = [
            # 1. Filtrar solo los eventos relevantes de nuestra DAO
            {
                "$match": {
                    "event": "FastMinterSet",
                    "contract": dao_addr  # Importante para no mezclar eventos si hay varias DAOs
                }
            },
            # 2. Ordenar por el más reciente primero
            {
                "$sort": {
                    "blockNumber": -1,
                    "transactionIndex": -1
                }
            },
            # 3. Agrupar por la dirección del minter y quedarse con el primer (más reciente) estado
            {
                "$group": {
                    "_id": "$args.minter",
                    "enabled": {"$first": "$args.enabled"},
                    "last_update_block": {"$first": "$blockNumber"},
                    "last_tx_hash": {"$first": "$transactionHash"}
                }
            },
            # 4. Formatear la salida para que sea más limpia
            {
                "$project": {
                    "_id": 0,
                    "minter": "$_id",
                    "enabled": 1,
                    "last_update_block": 1,
                    "last_tx_hash": 1
                }
            },
            # 5. Ordenar alfabéticamente por la dirección del minter
            {
                "$sort": {
                    "minter": 1
                }
            }
        ]
        
        minters_list = list(db.dao_events.aggregate(pipeline))
        
        return {"ok": True, "daoAddress": dao_addr, "fastMinters": minters_list}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Error listando fast minters")
        raise HTTPException(status_code=500, detail=str(e))