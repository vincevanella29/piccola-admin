from fastapi import APIRouter, HTTPException, Depends, Request
import logging
import time
from utils.web3mongo import db, w3, staking_contract
from main import verify_session
from eth_account.messages import encode_defunct
import os
from bson import ObjectId
from datetime import datetime
from fastapi.responses import JSONResponse

router = APIRouter()
logger = logging.getLogger(__name__)


CHAIN_ID = int(os.getenv('CHAIN_ID'))


def serialize_stake_data(stake):
    if "_id" in stake and isinstance(stake["_id"], ObjectId):
        stake["_id"] = str(stake["_id"])
    if "stake_event_id" in stake and isinstance(stake["stake_event_id"], ObjectId):
        stake["stake_event_id"] = str(stake["stake_event_id"])
    if "unstake_event_id" in stake and isinstance(stake["unstake_event_id"], ObjectId):
        stake["unstake_event_id"] = str(stake["unstake_event_id"])
    return stake


def make_json_serializable(obj):
    if isinstance(obj, dict):
        return {k: make_json_serializable(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [make_json_serializable(i) for i in obj]
    elif isinstance(obj, ObjectId):
        return str(obj)
    elif isinstance(obj, datetime):
        return obj.isoformat()
    else:
        return obj

@router.post("/staking/stake")
async def stake(request: Request, user: dict = Depends(verify_session)):
    """
    Recibe datos firmados del frontend para realizar stake en el contrato.
    Valida la firma y construye la transacción para que el frontend la firme y envíe.
    """
    try:
        data = await request.json()
        encodedData = data.get("encodedData")
        signature = data.get("signature")
        plainData = data.get("plainData")
        wallet = data.get("wallet")
        # Validar que la wallet corresponde al usuario autenticado
        if user["wallet"].lower() != wallet.lower():
            raise HTTPException(status_code=403, detail="La wallet no coincide con la sesión")
        # Verificar que la firma corresponde al wallet
        message = encode_defunct(text=plainData)
        recovered = w3.eth.account.recover_message(message, signature=signature)
        if recovered.lower() != wallet.lower():
            raise HTTPException(status_code=400, detail="La firma no corresponde al wallet")
        # Convertir wallet a checksum address antes de cualquier uso con web3
        wallet = w3.to_checksum_address(wallet)
        # Construir la transacción usando el encodedData que viene del frontend
        nonce = w3.eth.get_transaction_count(wallet)
        tx = {
            "from": wallet,
            "to": staking_contract.address,
            "data": encodedData,
            "nonce": nonce,
            "gas": 500_000,  # O estima si lo prefieres
            "gasPrice": w3.eth.gas_price,
            "chainId": CHAIN_ID
        }
        return {"success": True, "msg": "Transacción construida. Firma y envía desde tu wallet.", "tx": tx}

    except Exception as e:
        logger.error(f"[stake] Error: {e}")
        raise HTTPException(status_code=500, detail=f"Error general al construir stake: {e}")


@router.post("/staking/claim_rewards")
async def claim_rewards(request: Request, user: dict = Depends(verify_session)):
    """
    Recibe datos firmados del frontend para claimRewards en el contrato.
    Valida la firma y construye la transacción para que el frontend la firme y envíe.
    """
    try:
        data = await request.json()
        encodedData = data.get("encodedData")
        signature = data.get("signature")
        plainData = data.get("plainData")
        wallet = data.get("wallet")
        # Validar que la wallet corresponde al usuario autenticado
        if user["wallet"].lower() != wallet.lower():
            raise HTTPException(status_code=403, detail="La wallet no coincide con la sesión")
        # Verificar que la firma corresponde al wallet
        message = encode_defunct(text=plainData)
        recovered = w3.eth.account.recover_message(message, signature=signature)
        if recovered.lower() != wallet.lower():
            raise HTTPException(status_code=400, detail="La firma no corresponde al wallet")
        # Convertir wallet a checksum address antes de cualquier uso con web3
        wallet = w3.to_checksum_address(wallet)
        # Construir la transacción usando el encodedData que viene del frontend
        nonce = w3.eth.get_transaction_count(wallet)
        tx = {
            "from": wallet,
            "to": staking_contract.address,
            "data": encodedData,
            "nonce": nonce,
            "gas": 500_000,  # O estima si lo prefieres
            "gasPrice": w3.eth.gas_price,
            "chainId": CHAIN_ID
        }
        return {"success": True, "msg": "Transacción claimRewards construida. Firma y envía desde tu wallet.", "tx": tx}

    except Exception as e:
        logger.error(f"[claim_rewards] Error: {e}")
        raise HTTPException(status_code=500, detail=f"Error general al construir claimRewards: {e}")

@router.post("/staking/unstake")
async def unstake(request: Request, user: dict = Depends(verify_session)):
    """
    Recibe datos firmados del frontend para realizar unstake en el contrato.
    Valida la firma y construye la transacción para que el frontend la firme y envíe.
    """
    try:
        data = await request.json()
        encodedData = data.get("encodedData")
        signature = data.get("signature")
        plainData = data.get("plainData")
        wallet = data.get("wallet")
        # Validar que la wallet corresponde al usuario autenticado
        if user["wallet"].lower() != wallet.lower():
            raise HTTPException(status_code=403, detail="La wallet no coincide con la sesión")
        # Verificar que la firma corresponde al wallet
        message = encode_defunct(text=plainData)
        recovered = w3.eth.account.recover_message(message, signature=signature)
        if recovered.lower() != wallet.lower():
            raise HTTPException(status_code=400, detail="La firma no corresponde al wallet")
        # Convertir wallet a checksum address
        wallet = w3.to_checksum_address(wallet)
        # Construir la transacción usando el encodedData
        nonce = w3.eth.get_transaction_count(wallet)
        tx = {
            "from": wallet,
            "to": staking_contract.address,
            "data": encodedData,
            "nonce": nonce,
            "gas": 500_000,  # Ajustar si es necesario
            "gasPrice": w3.eth.gas_price,
            "chainId": CHAIN_ID
        }
        return {"success": True, "msg": "Transacción unstake construida. Firma y envía desde tu wallet.", "tx": tx}

    except Exception as e:
        logger.error(f"[unstake] Error: {e}")
        raise HTTPException(status_code=500, detail=f"Error al construir unstake: {e}")

@router.get("/staking/last-updated")
async def get_staking_last_updated():
    """
    Endpoint rápido para obtener el last_updated global de los stakings.
    """
    from utils.web3_utils import db
    import time
    utility_events = db.staking_events.find({"event": "UtilityTokenFinalized"})
    stakings = []
    for event in utility_events:
        args = event.get("args", {})
        company_id = args.get("companyId")
        year = args.get("year")
        if company_id is None or year is None:
            continue
        last_updated = int(event.get("timestamp", time.time()))
        stakings.append({"company_id": company_id, "year": year, "last_updated": last_updated})
    last_updated_global = max([s.get('last_updated', 0) for s in stakings], default=int(time.time()))
    return {"last_updated": last_updated_global}


@router.get("/staking/company-data/{company_id}")
async def get_company_staking_data(company_id: int):
    logger.info(f"[get_company_staking_data] company_id: {company_id}")
    """
    Obtiene TODOS los datos de staking para una sola compañía (todas las seasons/años),
    con pools, datos de la compañía, Governance Token, Utility Token y total de rewards.
    """
    try:
        # Obtener la compañía directamente de la base
        company_data = db.companies.find_one({"companyId": int(company_id)})
        if not company_data:
            logger.warning(f"[get_company_staking_data] No data for company_id {company_id}")
            return {"stakings": [], "user_stakes": {}, "last_updated": int(time.time())}

        stakings = []
        user_stakes = {}
        last_updated_global = int(time.time())
        for year, pools_data in company_data.get("pools", {}).items():
            pools = pools_data.get("pools", [])
            staking_obj = {
                "company_id": int(company_id),
                "year": int(year),
                "company": {
                    "name": company_data.get("name", f"Company {company_id}"),
                    "din": company_data.get("din", ""),
                    "physical_address": company_data.get("companyAddress", ""),
                    "country": company_data.get("country", ""),
                    "is_active": company_data.get("isActive", False),
                    "logo": company_data.get("governance_token", {}).get("imagePath", ""),
                    "description": company_data.get("governance_token", {}).get("description", ""),
                    "documents": company_data.get("governance_token", {}).get("documents", []),
                    "fund_usages": company_data.get("governance_token", {}).get("fund_usages", []),
                    "vesting_config": company_data.get("governance_token", {}).get("vesting_config", [])
                },
                "governance_token": company_data.get("governance_token", {
                    "address": "",
                    "name": "",
                    "symbol": "",
                    "totalSupply": "0",
                    "imagePath": "",
                    "description": "Governance token for company",
                    "documents": [],
                    "fund_usages": [],
                    "vesting_config": []
                }),
                "utility_token": company_data.get("utility_token", {
                    "address": "",
                    "name": "",
                    "symbol": "",
                    "totalSupply": "0",
                    "imagePath": "",
                    "description": "Utility token for loyalty programs"
                }),
                "total_rewards": pools_data.get("total_rewards", "0"),
                "pools": pools,
                "timestamp": pools_data.get("timestamp", 0),
                "token_proxy": company_data.get("utilityTokenProxy", ""),
                "last_updated": int(time.time())
            }
            stakings.append(staking_obj)

        # --- Eventos de usuario solo para esta company (todos los años) ---
        staked_query = {"event": "Staked", "args.companyId": int(company_id)}
        staked_events = list(db.staking_events.find(staked_query))
        unstaked_events = list(db.staking_events.find({"event": "Unstaked", "args.companyId": int(company_id)}))

        unstaked_index = {}
        for ev in unstaked_events:
            args = ev.get("args", {})
            key = (
                str(args.get("companyId")),
                args.get("user", "").lower(),
                str(args.get("poolIndex")) if "poolIndex" in args else str(args.get("durationDays")),
                str(args.get("amount")),
                str(ev.get("transactionHash")),
            )
            unstaked_index[key] = ev

        user_stakes = {}
        for ev in staked_events:
            args = ev.get("args", {})
            ev_company_id = str(args.get("companyId"))
            ev_year = str(args.get("year")) if "year" in args else None
            user = args.get("user", "").lower()
            pool_key = str(args.get("poolIndex")) if "poolIndex" in args else str(args.get("durationDays"))
            amount = str(args.get("amount"))
            tx_hash = str(ev.get("transactionHash"))
            stake_key = (ev_company_id, user, pool_key, amount, tx_hash)
            stake_data = {
                "company_id": ev_company_id,
                "user": user,
                "pool_key": pool_key,
                "amount": amount,
                "duration_days": args.get("durationDays"),
                "pool_index": args.get("poolIndex"),
                "block_number": args.get("blockNumber"),
                "log_index": args.get("logIndex"),
                "transaction_hash": tx_hash,
                "stake_timestamp": ev.get("raw_log", {}).get("timestamp", None),
                "stake_event_id": ev.get("_id"),
            }
            unstake_ev = unstaked_index.get(stake_key)
            if unstake_ev:
                stake_data["unstake_timestamp"] = unstake_ev.get("raw_log", {}).get("timestamp", None)
                stake_data["unstake_event_id"] = unstake_ev.get("_id")
            user_stakes.setdefault(user, []).append(stake_data)

        for user, stakes in user_stakes.items():
            user_stakes[user] = [serialize_stake_data(stake) for stake in stakes]
        if user_stakes is None:
            user_stakes = {}
        if stakings is None:
            stakings = []
        # --- Claims de RewardsClaimedPool para esta company (todos los años) ---
        claims_query = {"event": "RewardsClaimedPool", "args.companyId": int(company_id)}
        claims_events = list(db.staking_events.find(claims_query))

        claims = {}
        for ev in claims_events:
            args = ev.get("args", {})
            user = args.get("user", "").lower()
            pool_key = str(args.get("poolIndex")) if "poolIndex" in args else str(args.get("durationDays"))
            # Usar timestamp principal, o el del raw_log si existe
            claim_timestamp = ev.get("timestamp")
            if not claim_timestamp:
                claim_timestamp = ev.get("raw_log", {}).get("timestamp", None)
            claim_data = {
                "pool_key": pool_key,
                "amount": str(args.get("amount")),
                "timestamp": claim_timestamp,
                "claim_event_id": str(ev.get("_id")),
                "transaction_hash": ev.get("transactionHash"),
            }
            claims.setdefault(user, []).append(claim_data)

        last_updated = max([s.get('last_updated', 0) for s in stakings], default=int(time.time()))
        response = {
            "stakings": stakings,
            "user_stakes": user_stakes,
            "all_staked_events": [serialize_stake_data(ev) for ev in staked_events],
            "all_unstaked_events": [serialize_stake_data(ev) for ev in unstaked_events],
            "claims": claims,
            "last_updated": last_updated
        }
        logger.info(f"[get_company_staking_data] Response: {response}")
        return JSONResponse(content=make_json_serializable(response))

    except Exception as e:
        logger.error(f"[get_company_staking_data] Error fetching staking data: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Error al obtener los datos de staking de la compañía: {str(e)}"
        )


@router.get("/staking/all-data")
async def get_all_staking_data():
    """
    Obtiene todos los stakings disponibles con sus pools, datos de la compañía,
    Governance Token, Utility Token y total de rewards en una sola llamada.
    """
    try:
        # Obtener eventos de UtilityTokenFinalized
        utility_events = db.staking_events.find({"event": "UtilityTokenFinalized"}).sort([("blockNumber", -1)])
        
        stakings = []
        for event in utility_events:
            args = event.get("args", {})
            company_id = args.get("companyId")
            year = args.get("year")

            if company_id is None or year is None:
                logger.warning(f"[get_all_staking_data] Skipping invalid UtilityTokenFinalized event: {event}")
                continue

            # Sincronizar datos de la compañía
            company_data = db.companies.find_one({"companyId": company_id})
            if not company_data:
                logger.warning(f"[get_all_staking_data] No data for company_id {company_id}")
                continue

            # Obtener pools para el año
            pools_data = company_data.get("pools", {}).get(str(year), {})
            pools = pools_data.get("pools", [])

            # Construir objeto de staking
            staking_obj = {
                "company_id": int(company_id),
                "year": int(year),
                "company": {
                    "name": company_data.get("name", f"Company {company_id}"),
                    "din": company_data.get("din", ""),
                    "physical_address": company_data.get("companyAddress", ""),
                    "country": company_data.get("country", ""),
                    "is_active": company_data.get("isActive", False),
                    "logo": company_data.get("governance_token", {}).get("imagePath", ""),
                    "description": company_data.get("governance_token", {}).get("description", ""),
                    "documents": company_data.get("governance_token", {}).get("documents", []),
                    "fund_usages": company_data.get("governance_token", {}).get("fund_usages", []),
                    "vesting_config": company_data.get("governance_token", {}).get("vesting_config", [])
                },
                "governance_token": company_data.get("governance_token", {
                    "address": "",
                    "name": "",
                    "symbol": "",
                    "totalSupply": "0",
                    "imagePath": "",
                    "description": "Governance token for company",
                    "documents": [],
                    "fund_usages": [],
                    "vesting_config": []
                }),
                "utility_token": company_data.get("utility_token", {
                    "address": "",
                    "name": "",
                    "symbol": "",
                    "totalSupply": "0",
                    "imagePath": "",
                    "description": "Utility token for loyalty programs"
                }),
                "timestamp": int(args.get("timestamp", 0)),
                "token_proxy": args.get("proxy", ""),
                "last_updated": int(event.get("timestamp", time.time()))
            }
            stakings.append(staking_obj)
        # Serializa recursivamente todos los ObjectId y datetime
        # Asegura que ambas claves siempre estén presentes
        if stakings is None:
            stakings = []
        # Calcula el last_updated global
        last_updated = max([s.get('last_updated', 0) for s in stakings], default=int(time.time()))
        response = {
            "stakings": stakings,
            "last_updated": last_updated
        }
        return JSONResponse(content=make_json_serializable(response))

    except Exception as e:
        logger.error(f"[get_all_staking_data] Error fetching staking data: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Error al obtener los datos de staking: {str(e)}"
        )