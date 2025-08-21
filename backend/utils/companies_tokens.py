"""
companies_tokens.py
Module to store and manage governance and utility tokens for all companies.
"""
from utils.web3mongo import load_contract_abi, db, w3, launchpad_contract

companies_tokens_collection = db['companies_tokens']

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

def sync_token_pairs(logger=None):
    """
    Sincroniza todos los pares posibles entre company tokens (governance y utility) y payment tokens activos.
    Chequea si el par existe en el factory del swap y guarda el resultado en la colección 'token_pairs'.
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

    # 2. Obtener company tokens (governance y utility)
    companies_tokens = list(companies_tokens_collection.find({}))
    company_tokens = []
    for c in companies_tokens:
        company_id = c.get("companyId")
        for token_type in ("governance_token", "utility_token"):
            tok = c.get(token_type)
            if tok and tok.get("address"):
                token_doc = companies_tokens_collection.find_one({f"{token_type}.address": tok["address"]})
                if not token_doc:
                    # Token nuevo: obtener metadata y guardar
                    try:
                        erc20_contract = w3.eth.contract(address=w3.to_checksum_address(tok["address"]), abi=[{"constant":True,"inputs":[],"name":"decimals","outputs":[{"name":"","type":"uint8"}],"payable":False,"stateMutability":"view","type":"function"}, {"constant":True,"inputs":[],"name":"symbol","outputs":[{"name":"","type":"string"}],"payable":False,"stateMutability":"view","type":"function"}, {"constant":True,"inputs":[],"name":"name","outputs":[{"name":"","type":"string"}],"payable":False,"stateMutability":"view","type":"function"}])
                        decimals = erc20_contract.functions.decimals().call()
                        symbol = erc20_contract.functions.symbol().call()
                        name = erc20_contract.functions.name().call()
                    except Exception as e:
                        decimals = 18
                        symbol = tok.get("symbol") or "UNKNOWN"
                        name = tok.get("name") or "UNKNOWN"
                    if decimals is None:
                        decimals = 18
                    tok["decimals"] = decimals
                    tok["symbol"] = symbol
                    tok["name"] = name
                    # Guardar en DB
                    companies_tokens_collection.update_one(
                        {"companyId": company_id},
                        {"$set": {f"{token_type}": tok}},
                        upsert=True
                    )
                else:
                    # Token ya existe: usar metadata de la base
                    tok = token_doc.get(token_type, tok)
                company_tokens.append({
                    "address": tok["address"],
                    "symbol": tok.get("symbol"),
                    "name": tok.get("name"),
                    "type": token_type,
                    "companyId": company_id,
                    "imagePath": tok.get("imagePath"),
                    "decimals": tok.get("decimals")
                })

    # 3. Instanciar factory del swap usando loader centralizado de ABI
    try:
        swap_router = launchpad_contract.functions.getSwapRouter().call()
        router_abi = load_contract_abi("IUniswapV2Router02")
        router_contract = w3.eth.contract(address=swap_router, abi=router_abi)
        factory_addr = router_contract.functions.factory().call()
        factory_abi = load_contract_abi("UniswapV2Factory")
        factory_contract = w3.eth.contract(address=factory_addr, abi=factory_abi)
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

            # Buscar el par en el factory SOLO con el address correcto (WMATIC si es nativo)
            try:
                pair_addr = factory_contract.functions.getPair(ctoken["address"], token_b_for_pair).call()
                exists = pair_addr and pair_addr != "0x0000000000000000000000000000000000000000"
            except Exception:
                pair_addr = None
                exists = False

            # Obtener decimales del payment token
            decimals = None
            symbol = None
            name = None
            imagePath = None

            try:
                erc20_contract = w3.eth.contract(address=w3.to_checksum_address(ptoken), abi=[
                    {"constant": True, "inputs": [], "name": "decimals", "outputs": [{"name": "", "type": "uint8"}], "payable": False, "stateMutability": "view", "type": "function"},
                    {"constant": True, "inputs": [], "name": "symbol", "outputs": [{"name": "", "type": "string"}], "payable": False, "stateMutability": "view", "type": "function"},
                    {"constant": True, "inputs": [], "name": "name", "outputs": [{"name": "", "type": "string"}], "payable": False, "stateMutability": "view", "type": "function"},
                ])
                decimals = erc20_contract.functions.decimals().call()
                symbol = erc20_contract.functions.symbol().call()
                name = erc20_contract.functions.name().call()
                if symbol == "USDC":
                    imagePath = "/token-logos/usdc.png"
                if symbol == "WETH":
                    imagePath = "/token-logos/weth.png"
                if symbol == "WMATIC":
                    imagePath = "/token-logos/wmatic.png"
            except Exception:
                decimals = 18 
                symbol = "UNKNOWN"
                name = "UNKNOWN"
                imagePath = None

             # Obtener decimales del LP token (par)
            pair_decimals = None
            if pair_addr and pair_addr != "0x0000000000000000000000000000000000000000":
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
