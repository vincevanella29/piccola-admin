"""
companies_tokens.py
Module to store and manage governance and utility tokens for all companies.
Optimized: caches token metadata (symbol, name, decimals) in MongoDB to
avoid redundant Web3 RPC calls on every sync cycle.
"""
from utils.web3mongo import load_contract_abi, db, w3, launchpad_contract
import logging
logger = logging.getLogger(__name__)
logger.warning("HTTP-based update_pair_reserves is deprecated - use WebSocket version from ws_reserve_updater")

companies_tokens_collection = db['companies_tokens']

# In-memory metadata cache to avoid even MongoDB lookups within same process
_token_metadata_cache = {}


def _get_token_metadata(address: str) -> dict:
    """Get token metadata (symbol, name, decimals) with MongoDB + in-memory cache.
    Only calls Web3 if metadata is not already known."""
    addr_lower = address.lower()
    
    # 1) In-memory cache
    if addr_lower in _token_metadata_cache:
        return _token_metadata_cache[addr_lower]
    
    # 2) MongoDB cache
    cached = db['token_metadata_cache'].find_one({"address": addr_lower})
    if cached and cached.get("symbol") and cached.get("symbol") != "UNKNOWN":
        meta = {"symbol": cached["symbol"], "name": cached["name"], "decimals": cached.get("decimals", 18)}
        _token_metadata_cache[addr_lower] = meta
        return meta
    
    # 3) Web3 call (expensive — only happens once per token ever)
    try:
        erc20_contract = w3.eth.contract(
            address=w3.to_checksum_address(address),
            abi=[
                {"constant":True,"inputs":[],"name":"decimals","outputs":[{"name":"","type":"uint8"}],"payable":False,"stateMutability":"view","type":"function"},
                {"constant":True,"inputs":[],"name":"symbol","outputs":[{"name":"","type":"string"}],"payable":False,"stateMutability":"view","type":"function"},
                {"constant":True,"inputs":[],"name":"name","outputs":[{"name":"","type":"string"}],"payable":False,"stateMutability":"view","type":"function"}
            ]
        )
        decimals = erc20_contract.functions.decimals().call()
        symbol = erc20_contract.functions.symbol().call()
        name = erc20_contract.functions.name().call()
    except Exception as e:
        logger.warning(f"[_get_token_metadata] Web3 call failed for {address}: {e}")
        decimals = 18
        symbol = "UNKNOWN"
        name = "UNKNOWN"
    
    if decimals is None:
        decimals = 18
    
    meta = {"symbol": symbol, "name": name, "decimals": decimals}
    
    # Save to MongoDB cache
    try:
        db['token_metadata_cache'].update_one(
            {"address": addr_lower},
            {"$set": {"address": addr_lower, **meta}},
            upsert=True
        )
    except Exception as e:
        logger.warning(f"[_get_token_metadata] Cache write error: {e}")
    
    # Save to in-memory cache
    _token_metadata_cache[addr_lower] = meta
    return meta


def upsert_company_tokens(company_id: int, governance_token: dict, utility_token: dict):
    """
    Upsert governance and utility token info for a company.
    """
    doc = {
        "companyId": company_id,
        "governance_token": governance_token,
        "utility_token": utility_token
    }
    companies_tokens_collection.update_one(
        {"companyId": company_id},
        {"$set": doc},
        upsert=True
    )

def get_company_tokens(company_id: int):
    """
    Retrieve token info for a company.
    """
    return companies_tokens_collection.find_one({"companyId": company_id})

def get_all_companies_tokens():
    """
    Retrieve all companies' token info.
    """
    return list(companies_tokens_collection.find({}))

# Address del token nativo (MATIC/ETH segun red)
NATIVE_TOKEN_ADDRESS = "0x0000000000000000000000000000000000001010"
# Address de WMATIC (o WETH en mainnet). Cambia SOLO aquí para mainnet/testnet
WMATIC_ADDRESS = "0x4bcd5FB3F9b6F73084C9B7A19Acbf0C1D2631fF8"

# Image paths for known symbols
_IMAGE_PATHS = {
    "USDC": "/token-logos/usdc.png",
    "WETH": "/token-logos/weth.png",
    "WMATIC": "/token-logos/wmatic.png",
    "MATIC": "/token-logos/matic.png",
}


def update_pair_reserves(logger=None):
    """
    Actualiza solo el campo 'reserves' de todos los pares existentes en la colección 'token_pairs'.
    """
    token_pairs = list(db['token_pairs'].find({"exists": True}))
    updated = 0
    for pair in token_pairs:
        pair_addr = pair.get('pairAddress')
        if not pair_addr or pair_addr == "0x0000000000000000000000000000000000000000":
            continue
        try:
            uniswap_pair_abi = [
                {"constant": True, "inputs": [], "name": "getReserves", "outputs": [
                    {"name": "_reserve0", "type": "uint112"},
                    {"name": "_reserve1", "type": "uint112"},
                    {"name": "_blockTimestampLast", "type": "uint32"}
                ], "payable": False, "stateMutability": "view", "type": "function"},
            ]
            pair_contract = w3.eth.contract(address=w3.to_checksum_address(pair_addr), abi=uniswap_pair_abi)
            reserves = pair_contract.functions.getReserves().call()
            def safe_mongo_int(val):
                if abs(val) > 2**63 - 1:
                    return str(val)
                return int(val)
            reserves_data = {
                "reserve0": safe_mongo_int(reserves[0]),
                "reserve1": safe_mongo_int(reserves[1]),
                "timestamp": int(reserves[2])
            }
            db['token_pairs'].update_one(
                {"_id": pair["_id"]},
                {"$set": {"reserves": reserves_data}}
            )
            updated += 1
        except Exception as e:
            if logger:
                logger.warning(f"[update_pair_reserves] No se pudo actualizar reserves de {pair_addr}: {e}")
    if logger:
        logger.info(f"[update_pair_reserves] Actualizadas reserves en {updated} pares.")
    return updated


# Cache for factory contract instance (created once, reused)
_factory_contract_cache = {"instance": None}


def _get_factory_contract():
    """Get (or create & cache) the Uniswap factory contract instance."""
    if _factory_contract_cache["instance"] is not None:
        return _factory_contract_cache["instance"]
    
    swap_router = launchpad_contract.functions.getSwapRouter().call()
    router_abi = load_contract_abi("IUniswapV2Router02")
    router_contract = w3.eth.contract(address=swap_router, abi=router_abi)
    factory_addr = router_contract.functions.factory().call()
    factory_abi = load_contract_abi("UniswapV2Factory")
    factory_contract = w3.eth.contract(address=factory_addr, abi=factory_abi)
    _factory_contract_cache["instance"] = factory_contract
    return factory_contract


def sync_token_pairs(logger=None):
    """
    Sincroniza todos los pares posibles entre company tokens (governance y utility) y payment tokens activos.
    Chequea si el par existe en el factory del swap y guarda el resultado en la colección 'token_pairs'.
    
    OPTIMIZED: Uses cached metadata for tokens instead of calling Web3 for every sync cycle.
    Factory contract is also cached.
    """
    # 1. Obtener payment tokens activos (igual que en /platform_tokens)
    token_sale_events = db['token_sale_events']
    events = list(token_sale_events.find(
        {"event": {"$in": ["PaymentTokenAdded", "PaymentTokenRemoved"]}}
    ).sort([("blockNumber", 1), ("logIndex", 1)]))
    last_event_by_token = {}
    for event in events:
        token = event.get("args", {}).get("token", "").lower()
        if not token:
            continue
        last_event_by_token[token] = event.get("event")
    payment_tokens_activos = set()
    for token, last_event in last_event_by_token.items():
        if last_event == "PaymentTokenAdded":
            try:
                from eth_utils import to_checksum_address
                payment_tokens_activos.add(to_checksum_address(token))
            except Exception:
                payment_tokens_activos.add(token)

    # 2. Obtener company tokens (governance y utility) — use cached metadata
    companies_tokens = list(companies_tokens_collection.find({}))
    company_tokens = []
    for c in companies_tokens:
        company_id = c.get("companyId")
        for token_type in ("governance_token", "utility_token"):
            tok = c.get(token_type)
            if tok and tok.get("address"):
                # Use cached metadata instead of Web3 call
                if not tok.get("symbol") or not tok.get("decimals"):
                    meta = _get_token_metadata(tok["address"])
                    tok["decimals"] = meta["decimals"]
                    tok["symbol"] = meta["symbol"]
                    tok["name"] = meta["name"]
                    # Save updated metadata back to DB
                    companies_tokens_collection.update_one(
                        {"companyId": company_id},
                        {"$set": {f"{token_type}": tok}},
                        upsert=True
                    )
                    
                company_tokens.append({
                    "address": tok["address"],
                    "symbol": tok.get("symbol"),
                    "name": tok.get("name"),
                    "type": token_type,
                    "companyId": company_id,
                    "imagePath": tok.get("imagePath"),
                    "decimals": tok.get("decimals")
                })

    # 3. Instanciar factory del swap — CACHED
    try:
        factory_contract = _get_factory_contract()
    except Exception as e:
        if logger:
            logger.error(f"[sync_token_pairs] Error instanciando factory: {str(e)}")
        return False

    # 4. Generar todos los pares posibles y chequear existencia
    pairs_collection = db['token_pairs']
    results = []
    for ctoken in company_tokens:
        for ptoken in payment_tokens_activos:
            # Si el payment token es el nativo, busca el par real usando WMATIC
            token_b_for_pair = ptoken
            if ptoken.lower() == NATIVE_TOKEN_ADDRESS.lower():
                token_b_for_pair = WMATIC_ADDRESS

            # Check if we already know this pair exists in DB
            existing_pair = pairs_collection.find_one({
                "companyId": ctoken["companyId"],
                "companyToken.address": ctoken["address"],
                "paymentToken.address": ptoken
            })
            
            # Only call getPair if we don't have it cached OR it was previously non-existent
            if existing_pair and existing_pair.get("exists") and existing_pair.get("pairAddress"):
                pair_addr = existing_pair["pairAddress"]
                exists = True
            else:
                # Buscar el par en el factory (Web3 call — only for unknown pairs)
                try:
                    pair_addr = factory_contract.functions.getPair(ctoken["address"], token_b_for_pair).call()
                    exists = pair_addr and pair_addr != "0x0000000000000000000000000000000000000000"
                except Exception:
                    pair_addr = None
                    exists = False

            # Get payment token metadata from cache (NO Web3 call)
            ptoken_meta = _get_token_metadata(ptoken)
            symbol = ptoken_meta["symbol"]
            name = ptoken_meta["name"]
            decimals = ptoken_meta["decimals"]
            imagePath = _IMAGE_PATHS.get(symbol)

            # Obtener decimales del LP token (par) — use cached if available
            pair_decimals = None
            if existing_pair and existing_pair.get("pairDecimals"):
                pair_decimals = existing_pair["pairDecimals"]
            elif pair_addr and pair_addr != "0x0000000000000000000000000000000000000000":
                try:
                    erc20_lp = w3.eth.contract(address=w3.to_checksum_address(pair_addr), abi=[{"constant":True,"inputs":[],"name":"decimals","outputs":[{"name":"","type":"uint8"}],"payable":False,"stateMutability":"view","type":"function"}])
                    pair_decimals = erc20_lp.functions.decimals().call()
                except Exception:
                    pair_decimals = 18    
            
            pair_doc = {
                "companyId": ctoken["companyId"],
                "companyToken": {
                    "address": ctoken["address"],
                    "symbol": ctoken["symbol"],
                    "name": ctoken["name"],
                    "type": ctoken["type"],
                    "imagePath": ctoken["imagePath"],
                    "decimals": ctoken["decimals"]
                },
                "paymentToken": {
                    "address": ptoken,
                    "symbol": symbol,
                    "name": name,
                    "decimals": decimals,
                    "imagePath": imagePath
                },
                "pairAddress": pair_addr if exists else "0x0000000000000000000000000000000000000000",
                "exists": bool(exists),
                "pairDecimals": pair_decimals
            }
            results.append(pair_doc)
            # Upsert en Mongo por companyId+companyToken+paymentToken
            pairs_collection.update_one(
                {
                    "companyId": ctoken["companyId"],
                    "companyToken.address": ctoken["address"],
                    "paymentToken.address": ptoken
                },
                {"$set": pair_doc},
                upsert=True
            )
    if logger:
        logger.info(f"[sync_token_pairs] Synced {len(results)} pairs.")
    return results
