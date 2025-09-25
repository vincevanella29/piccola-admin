# /path/to/your/backend/fiat.py
import os
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from utils.auth.session import verify_session
from utils.companies_tokens import get_all_companies_tokens
from utils.web3mongo import db, load_contract_abi, w3, launchpad_contract, uniswap_factory_contract
import logging
from eth_utils import to_checksum_address
from bson import ObjectId
from eth_account.messages import encode_defunct

router = APIRouter()
logger = logging.getLogger(__name__)

# Modelos para las solicitudes
class LiquidityRequest(BaseModel):
    encodedData: str
    signature: str
    plainData: str
    wallet: str
    token: str
    pairId: str

class LiquidityCreatePoolRequest(BaseModel):
    encodedData: str
    signature: str
    plainData: str
    wallet: str
    pairId: str

CHAIN_ID = os.getenv("CHAIN_ID", 80002)


@router.get("/swap_tokens_routes")
async def get_swap_tokens_routes():
    try:
        platform_tokens_result = await get_platform_tokens()
        tokens = platform_tokens_result.get("all_token_addresses", [])
        pairs = list(db["token_pairs"].find({"exists": True}))
        token_routes = {}
        for pair in pairs:
            company_token = pair.get("companyToken", {})
            payment_token = pair.get("paymentToken", {})
            company_addr = company_token.get("address")
            payment_addr = payment_token.get("address")
            pair_address = pair.get("pairAddress")
            if company_addr and payment_addr:
                # Añadir ruta en ambas direcciones
                token_routes.setdefault(company_addr, []).append({
                    "paymentToken": payment_addr,
                    "pairAddress": pair_address,
                    "exists": True
                })
                token_routes.setdefault(payment_addr, []).append({
                    "paymentToken": company_addr,
                    "pairAddress": pair_address,
                    "exists": True
                })
        return {"tokens": tokens, "routes": token_routes}
    except Exception as e:
        logger.error(f"[get_swap_tokens_routes] Error: {e}")
        raise HTTPException(status_code=500, detail=f"Error al listar rutas de swap: {e}")

@router.get("/token_pairs")
async def get_token_pairs(companyId: int = None, exists: bool = None):
    """
    Devuelve la lista de pares token_pairs generados por sync_token_pairs.
    Permite filtrar por companyId y existencia (exists=true/false).
    """
    query = {}
    if companyId is not None:
        query["companyId"] = companyId
    if exists is not None:
        query["exists"] = exists
    pairs = list(db["token_pairs"].find(query).sort([
        ("companyId", 1),
        ("companyToken.symbol", 1)
    ]))
    # Custom sort: governance_token first, then utility_token, both by symbol
    def sort_key(p):
        company_id = p.get("companyId") or p.get("paymentToken", {}).get("companyId") or 0
        token_type = p.get("companyToken", {}).get("type", "")
        # Governance first, then utility
        type_order = 0 if token_type == "governance_token" else 1
        symbol = p.get("companyToken", {}).get("symbol", "")
        return (company_id, type_order, symbol)
    pairs.sort(key=sort_key)
    for p in pairs:
        p["_id"] = str(p["_id"])
    return {"pairs": pairs}

@router.get("/platform_tokens")
async def get_platform_tokens():
    """
    Devuelve todos los tokens aceptados como payment en la plataforma:
    - Tokens activos/inactivos de payment (eventos PaymentTokenAdded/Removed)
    - Todos los governance y utility tokens de companies_tokens
    """
    try:
        # 1. Tokens de payment (eventos)
        payment_tokens_activos = db['payment_tokens'].find()
        payment_tokens_out = []
        for pt in payment_tokens_activos:
            payment_tokens_out.append({
                "address": pt["address"],
                "symbol": pt.get("symbol"),
                "name": pt.get("name"),
                "imagePath": pt.get("imagePath"),
                "type": pt.get("type")
            })
        # 2. Governance y utility tokens de companies_tokens
        companies_tokens = get_all_companies_tokens()
        company_tokens_out = []
        for c in companies_tokens:
            for token_type in ("governance_token", "utility_token"):
                tok = c.get(token_type)
                if tok and tok.get("address"):
                    company_tokens_out.append({
                        "address": tok["address"],
                        "symbol": tok.get("symbol"),
                        "name": tok.get("name"),
                        "type": token_type,
                        "companyId": c.get("companyId"),
                        "imagePath": tok.get("imagePath")
                    })
        # Unificar addresses de payment tokens y company tokens
        payment_token_addresses = set([t["address"] for t in payment_tokens_out if t.get("address")])
        company_token_addresses = set([t["address"] for t in company_tokens_out if t.get("address")])
        all_token_addresses = list(payment_token_addresses.union(company_token_addresses))
        # Construir un diccionario address -> metadata para mergear info
        token_info_map = {}
        # 1. Company tokens
        for t in company_tokens_out:
            addr = t["address"].lower()
            token_info_map[addr] = {
                "address": t["address"],
                "symbol": t.get("symbol"),
                "name": t.get("name"),
                "imagePath": t.get("imagePath"),
                "type": t.get("type"),
                "companyId": t.get("companyId"),
            }
        # 2. Payment tokens
        for t in payment_tokens_out:
            addr = t["address"].lower()
            token_info_map[addr] = {
                "address": t["address"],
                "symbol": t.get("symbol"),
                "name": t.get("name"),
                "imagePath": t.get("imagePath"),
                "type": t.get("type"),
                "companyId": t.get("companyId"),
            }
        # 4. Solo los activos (all_token_addresses)
        all_tokens_full = [token_info_map[a.lower()] for a in all_token_addresses if a and a.lower() in token_info_map]
        NATIVE_TOKEN_ADDRESS = "0x0000000000000000000000000000000000001010"
        if NATIVE_TOKEN_ADDRESS.lower() not in [t["address"].lower() for t in all_tokens_full]:
            all_tokens_full.append(token_info_map[NATIVE_TOKEN_ADDRESS.lower()])
        # Orden personalizado: payment tokens primero, luego company tokens ordenados
        def token_sort_key(t):
            # Payment tokens (incl. native) primero
            if t["type"] in ("payment_token", "native"):
                return (0, 0, "", "")
            # Company tokens: governance primero, luego utility, ambos por companyId y symbol
            type_order = 0 if t["type"] == "governance_token" else 1
            company_id = t.get("companyId") or 0
            symbol = t.get("symbol") or ""
            return (1, company_id, type_order, symbol)
        all_tokens_full.sort(key=token_sort_key)
        return {
            "all_token_addresses": all_tokens_full
        }
    except Exception as e:
        logging.error(f"[get_platform_tokens] Error: {e}")
        raise HTTPException(status_code=500, detail=f"Error al listar tokens de plataforma: {e}")

@router.post("/add_liquidity")
async def create_pool(request: LiquidityCreatePoolRequest, user: dict = Depends(verify_session)):
    """
    Crea un nuevo pool de liquidez en UniswapV2Factory.
    Requiere verificación de sesión.
    """
    try:
        # Verificar par en la base de datos
        pair = db["token_pairs"].find_one({"_id": ObjectId(request.pairId)})
        if not pair:
            raise HTTPException(status_code=404, detail="Par no encontrado")

        # Verificar que el wallet coincide con la sesión
        if user["wallet"].lower() != request.wallet.lower():
            raise HTTPException(status_code=401, detail="Wallet no autorizado")

        # Verificar la firma (igual que en staking)
        try:
            message = encode_defunct(text=request.plainData)
            recovered = w3.eth.account.recover_message(message, signature=request.signature)
            if recovered.lower() != request.wallet.lower():
                raise HTTPException(status_code=400, detail="La firma no corresponde al wallet")
        except Exception as e:
            logger.error(f"[create_pool] Error verificando firma: {e}")
            raise HTTPException(status_code=400, detail=f"Error verificando firma: {e}")

        # Chequear que encodedData corresponde a la función correcta usando la ABI
        # Usar la ABI del Router para decodificar addLiquidity
        router_abi = load_contract_abi("UniswapV2Router02")
        router_address = launchpad_contract.functions.getSwapRouter().call()
        router_contract = w3.eth.contract(address=to_checksum_address(router_address), abi=router_abi)
        try:
            fn, _ = router_contract.decode_function_input(request.encodedData)
            # Detectar si el par contiene token nativo
            NATIVE_TOKEN_ADDRESS = "0x0000000000000000000000000000000000001010"
            is_native = (
                pair.get("paymentToken", {}).get("address", "").lower() == NATIVE_TOKEN_ADDRESS.lower()
                or pair.get("companyToken", {}).get("address", "").lower() == NATIVE_TOKEN_ADDRESS.lower()
            )
            if is_native:
                if fn.fn_name != "addLiquidityETH":
                    raise HTTPException(status_code=400, detail="encodedData debe corresponder a addLiquidityETH para pares con token nativo")
            else:
                if fn.fn_name != "addLiquidity":
                    raise HTTPException(status_code=400, detail="encodedData no corresponde a addLiquidity de UniswapV2Router02")
        except Exception as e:
            logger.error(f"[create_pool] Error decodificando encodedData: {e}")
            raise HTTPException(status_code=400, detail=f"Error decodificando encodedData: {e}")
        # Estimar gas y construir transacción
        try:
            # Estimar gas usando la transacción 'raw' que el usuario va a firmar (usando encodedData)
            router_address = to_checksum_address(router_address)
            from_addr = to_checksum_address(request.wallet)
            estimate_tx = {
                'from': from_addr,
                'to': router_address,
                'data': request.encodedData
            }
            estimated_gas = w3.eth.estimate_gas(estimate_tx)
            gas_with_margin = int(estimated_gas * 1.5)
        except Exception as e:
            logger.warning(f"[create_pool] Gas estimation failed, using 600000. Error: {e}. Params: companyToken={pair['companyToken']['address']}, paymentToken={pair['paymentToken']['address']}")
            if pair["exists"]:
                gas_with_margin = 500000
            else:
                gas_with_margin = 2500000

        wallet = to_checksum_address(request.wallet)
        nonce = w3.eth.get_transaction_count(wallet)
        # Si es nativo, incluir el campo 'value' en la transacción para enviar MATIC
        tx = {
            "from": wallet,
        }
        if is_native and hasattr(request, 'value') and request.value is not None:
            # Aceptar tanto str como int
            try:
                tx["value"] = int(request.value)
            except Exception:
                tx["value"] = request.value
        tx.update({
            "to": router_address,
            "data": request.encodedData,
            "nonce": nonce,
            "gas": gas_with_margin,
            "gasPrice": w3.eth.gas_price,
            "chainId": 80002  # Polygon Amoy
        })
        return {"success": True, "msg": "Transacción construida. Firma y envía desde tu wallet.", "tx": tx}
    except Exception as e:
        logger.error(f"[create_pool] Error: {e}")
        raise HTTPException(status_code=500, detail=f"Error al crear pool: {e}")

class RemoveLiquidityRequest(BaseModel):
    encodedData: str
    signature: str
    plainData: str
    wallet: str
    pairId: str

@router.post("/remove_liquidity")
async def remove_liquidity(request: RemoveLiquidityRequest, user: dict = Depends(verify_session)):
    """
    Remueve liquidez de un pool existente en UniswapV2Router02.
    Requiere verificación de sesión.
    """
    try:
        # Verificar par en la base de datos
        pair = db["token_pairs"].find_one({"_id": ObjectId(request.pairId)})
        if not pair or not pair.get("exists"):
            raise HTTPException(status_code=404, detail="Par no encontrado o no existe")

        # Verificar que el wallet coincide con la sesión
        if user["wallet"].lower() != request.wallet.lower():
            raise HTTPException(status_code=401, detail="Wallet no autorizado")

        router_address = launchpad_contract.functions.getSwapRouter().call()
        
         # Verificar la firma (igual que en staking)
        try:
            message = encode_defunct(text=request.plainData)
            recovered = w3.eth.account.recover_message(message, signature=request.signature)
            if recovered.lower() != request.wallet.lower():
                raise HTTPException(status_code=400, detail="La firma no corresponde al wallet")
        except Exception as e:
            logger.error(f"[remove_liquidity] Error verificando firma: {e}")
            raise HTTPException(status_code=400, detail=f"Error verificando firma: {e}")

        # Construir transacción
        tx = {
            "to": to_checksum_address(router_address),
            "data": request.encodedData,
            "from": to_checksum_address(request.wallet),
            "chainId": 80002,  # Polygon Amoy Testnet
        }

        return {"tx": tx}
    except Exception as e:
        logger.error(f"[remove_liquidity] Error: {e}")
        raise HTTPException(status_code=500, detail=f"Error al remover liquidez: {e}")

class SwapRequest(BaseModel):
    encodedData: str
    signature: str
    plainData: str
    wallet: str
    token: str
    inputToken: str
    outputToken: str

@router.post("/swap")
async def swap(request: SwapRequest, user: dict = Depends(verify_session)):
    """
    Procesa un swap de tokens usando UniswapV2Router02.
    Requiere verificación de sesión.
    """
    try:
        # Verificar que el wallet coincide con la sesión
        if user["wallet"].lower() != request.wallet.lower():
            raise HTTPException(status_code=401, detail="Wallet no autorizado")

        # Verificar firma
        message = encode_defunct(text=request.plainData)    
        recovered = w3.eth.account.recover_message(message, signature=request.signature)
        if recovered.lower() != request.wallet.lower():
            raise HTTPException(status_code=400, detail="La firma no corresponde al wallet")

        # Verificar encodedData
        router_abi = load_contract_abi("UniswapV2Router02")
        router_address = launchpad_contract.functions.getSwapRouter().call()
        router_contract = w3.eth.contract(address=to_checksum_address(router_address), abi=router_abi)
        try:
            fn, _ = router_contract.decode_function_input(request.encodedData)
            if fn.fn_name != "swapExactTokensForTokens":
                raise HTTPException(status_code=400, detail="encodedData no corresponde a swapExactTokensForTokens")
        except Exception as e:
            logger.error(f"[swap] Error decodificando encodedData: {e}")
            raise HTTPException(status_code=400, detail=f"Error decodificando encodedData: {e}")

        # Estimar gas
        try:
            estimate_tx = {
                'from': to_checksum_address(request.wallet),
                'to': to_checksum_address(router_address),
                'data': request.encodedData,
            }
            estimated_gas = w3.eth.estimate_gas(estimate_tx)
            gas_with_margin = int(estimated_gas * 1.5)
        except Exception as e:
            logger.warning(f"[swap] Gas estimation failed, using 300000. Error: {e}")
            gas_with_margin = 300000

        # Construir transacción
        tx = {
            "to": to_checksum_address(router_address),
            "data": request.encodedData,
            "from": to_checksum_address(request.wallet),
            "nonce": w3.eth.get_transaction_count(to_checksum_address(request.wallet)),
            "gas": gas_with_margin,
            "gasPrice": w3.eth.gas_price,
            "chainId": 80002,  # Polygon Amoy Testnet
        }

        return {"tx": tx}
    except Exception as e:
        logger.error(f"[swap] Error: {e}")
        raise HTTPException(status_code=500, detail=f"Error al procesar swap: {e}")

@router.get("/pair_reserves")
async def get_pair_reserves(pairAddress: str):
    """
    Devuelve solo los reserves (liquidez) de un par UniswapV2 guardados en la base de datos, dado su pairAddress.
    """
    if not pairAddress:
        raise HTTPException(status_code=400, detail="Debe proveer pairAddress")
    pair = db['token_pairs'].find_one({"pairAddress": pairAddress})
    if not pair or "reserves" not in pair or not pair["reserves"]:
        raise HTTPException(status_code=404, detail="No se encontró reserves para este par")
    return pair["reserves"]

