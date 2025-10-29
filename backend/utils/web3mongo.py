from __future__ import annotations
import json
import logging
import os
from typing import List
from pymongo import MongoClient
from web3 import Web3
from web3.middleware.proof_of_authority import ExtraDataToPOAMiddleware
import glob
import os
from dotenv import load_dotenv
import threading
import time
from collections import Counter
import inspect
from datetime import datetime

# Load .env here as a safeguard in case the app didn't load it yet
load_dotenv()

MONGODB_URI = os.getenv("MONGODB_URI")
WEB3_PROVIDER_URL = os.getenv("WEB3_PROVIDER_URL", "https://rpc-amoy.polygon.technology")
WEB3_PROVIDER_URL2 = os.getenv("WEB3_PROVIDER_URL2")
WEB3_PROVIDER_URL3 = os.getenv("WEB3_PROVIDER_URL3")

# Logging setup
logging.basicConfig(level=logging.INFO, format='%(asctime)s %(levelname)s: %(message)s')
logger = logging.getLogger(__name__)

# MongoDB setup
client = MongoClient(MONGODB_URI, serverSelectionTimeoutMS=5000)
db = client['piccola_italia_admin']
sessions_collection = db['sessions']
analytics_collection = db['analytics']
event_listener_state_collection = db['event_listener_state']
company_events = db['company_events']
token_factory_events = db['token_factory_events']
staking_events = db['staking_events']  
launchpad_events = db['launchpad_events']
token_basic_data_cache = db['token_basic_data_cache']
token_sale_events = db['token_sale_events']
global_meritocracy_events = db['global_meritocracy_events']

def setup_event_collections_indexes(event_listener_configs: List['EventListenerConfig']): 
    
    configured_collection_names = set()

    db.notification_types.create_index([("id", 1)], unique=True)
    db.notification_types.create_index([("event_name", 1)])
    db.notification_api_configs.create_index([("id", 1)], unique=True)
    db.user_notification_tokens.create_index([("wallet", 1), ("token", 1)], unique=True)
    db.notification_schedules.create_index([("notification_type_id", 1), ("schedule_time", 1)])
    # Ensure 'rut' unique index with a stable name to prevent IndexOptionsConflict when it already exists
    db.empleados_usuarios.create_index([("rut", 1)], name="uniq_rut", unique=True, background=True)
    # ------------------------------
    # Application indexes (avoid COLLSCANs)
    # ------------------------------
    try:
        # asistencia_diaria_intranet
        db.asistencia_diaria_intranet.create_index(
            [("periodo", 1), ("rut", 1)], name="idx_periodo_rut", background=True
        )
        db.asistencia_diaria_intranet.create_index(
            [("periodo", 1), ("tipo_movimiento", 1), ("rut", 1)],
            name="idx_periodo_mov_rut",
            background=True,
        )
        db.asistencia_diaria_intranet.create_index(
            [("fecha_trabajada", 1), ("rut", 1)], name="idx_fecha_rut", background=True
        )

        # restaurant_data
        db.restaurant_data.create_index(
            [("mesano", 1), ("Estado", 1), ("Tipo", 1), ("local_norm", 1), ("Fecha", 1)],
            name="idx_mesano_estado_tipo_localnorm_fecha",
            background=True,
        )

        # ventas_producto_dia_hora_cprodu
        db.ventas_producto_dia_hora_cprodu.create_index(
            [("mesano", 1), ("local_norm", 1), ("fecha", 1)],
            name="idx_mesano_localnorm_fecha",
            background=True,
        )

        # sales_by_waiter_hour
        db.sales_by_waiter_hour.create_index(
            [("MESANO", 1), ("LOCAL", 1)], name="idx_mesano_local", background=True
        )
        db.sales_by_waiter_hour.create_index(
            [("MESANO", 1), ("LOCAL", 1), ("HORA", 1)],
            name="idx_mesano_local_hora",
            background=True,
        )
        db.sales_by_waiter_hour.create_index(
            [("RUT", 1), ("MESANO", 1)], name="idx_rut_mesano", background=True
        )
        logger.info("Application indexes ensured (setup_event_collections_indexes).")
    except Exception as e:
        logger.error(f"Error ensuring application indexes: {e}")

    for config in event_listener_configs:
        collection_name = config.collection_name
        configured_collection_names.add(collection_name)
        # Ensure contract instance and ABI are available
        if not hasattr(config, 'contract') or not hasattr(config.contract, 'abi'):
            logger.error(f"Contract or ABI not found for config targeting collection {collection_name}. Skipping.")
            continue
        contract_abi = config.contract.abi
        target_collection = db[collection_name]

        # Standard Indexes (applied to all event collections)
        standard_indexes = {
            "idx_event_block": [('eventName', 1), ('blockNumber', -1)],
            "idx_tx_log_unique": [('transactionHash', 1), ('logIndex', 1)], # Unique to prevent duplicates
            "idx_contract_event_block": [('contractAddress', 1), ('eventName', 1), ('blockNumber', -1)],
            "idx_block_desc": [('blockNumber', -1)]
        }
        for idx_name, idx_spec in standard_indexes.items():
            try:
                is_unique = idx_name == "idx_tx_log_unique"
                target_collection.create_index(idx_spec, background=True, name=idx_name, unique=is_unique)
            except Exception as e:
                logger.error(f"Error creating standard index '{idx_name}' for {collection_name}: {e}")

        # Dynamic Indexes from ABI for 'indexed' event inputs
        if not contract_abi:
            logger.warning(f"ABI not available for contract in config for collection {collection_name}. Skipping dynamic ABI indexing.")
            continue

        events_to_process_for_indexing = []
        # If event_names is empty or contains a wildcard like '*', consider all events from ABI
        if not config.event_names or (len(config.event_names) == 1 and config.event_names[0] == "*"):
            for item in contract_abi:
                if item.get('type') == 'event':
                    event_name = item.get('name')
                    if event_name:
                        events_to_process_for_indexing.append(event_name)
            if not events_to_process_for_indexing:
                logger.warning(f"No events found in ABI for {collection_name} despite requesting all.")
        else: # Process only specified event names
            events_to_process_for_indexing = config.event_names

        for event_name_to_index in events_to_process_for_indexing:
            event_abi_entry = next((item for item in contract_abi if item.get('type') == 'event' and item.get('name') == event_name_to_index), None)
            
            if event_abi_entry:
                for input_param in event_abi_entry.get('inputs', []):
                    param_name = input_param.get('name')
                    is_indexed = input_param.get('indexed', False) 

                    if is_indexed and param_name: 
                        field_name = f"args.{param_name}"
                        index_spec = [(field_name, 1), ('blockNumber', -1)]
                        # Ensure index name is unique and not excessively long
                        index_name_suffix = f"args_{param_name.lower()}_block"
                        # Truncate if necessary, MongoDB index names have length limits (e.g., 127 bytes)
                        max_len_suffix = 60 # Arbitrary reasonable length for suffix part
                        if len(index_name_suffix) > max_len_suffix:
                            index_name_suffix = index_name_suffix[:max_len_suffix]
                        
                        index_name = f"idx_{index_name_suffix}"

                        try:
                            target_collection.create_index(index_spec, background=True, name=index_name)
                        except Exception as e:
                            logger.error(f"Error creating dynamic ABI index '{index_name}' for {collection_name} ({field_name}): {e}")
                    elif is_indexed and not param_name:
                        logger.warning(f"  Event '{event_name_to_index}', Param: '{param_name}' (is indexed but has no name). Skipping index creation for this parameter.")
            else:
                logger.warning(f"Event ABI entry for '{event_name_to_index}' not found in contract for collection {collection_name}.")


 

# Contract ABIs
CONTRACTS_DIR = "contracts/"

# Web3 setup with dual-provider support
w3 = Web3(Web3.HTTPProvider(WEB3_PROVIDER_URL))
w3.middleware_onion.inject(ExtraDataToPOAMiddleware, layer=0)

# Provider rotation state
_provider_urls = [u for u in [WEB3_PROVIDER_URL, WEB3_PROVIDER_URL2, WEB3_PROVIDER_URL3] if u]
_current_provider_index = 0

_req_lock = threading.Lock()
_total_reqs = 0
_method_counts = Counter()
_source_counts = Counter()
_prev_total = 0
_prev_method_counts = Counter()
_prev_source_counts = Counter()

# Daily aggregates (UTC day)
_daily_total = Counter()                   # key: yyyy-mm-dd
_daily_method = {}                         # key: date -> Counter
_daily_contract = {}                       # key: date -> Counter
_daily_event = {}                          # key: date -> Counter ("Contract:Event")

# Mappings to resolve addresses and topic0 -> names
_address_to_contract = {}
_topic0_to_eventname = {}                  # key: topic0 -> (contract_name, event_name)

def _today_key():
    return datetime.utcnow().date().isoformat()

# Build dedicated providers for routing
_event_providers = []  # providers for workers (URLs 1 & 2)
if WEB3_PROVIDER_URL:
    _event_providers.append(Web3.HTTPProvider(WEB3_PROVIDER_URL))
if WEB3_PROVIDER_URL2:
    _event_providers.append(Web3.HTTPProvider(WEB3_PROVIDER_URL2))
_api_provider = Web3.HTTPProvider(WEB3_PROVIDER_URL3) if WEB3_PROVIDER_URL3 else (_event_providers[0] if _event_providers else w3.provider)

def _detect_source():
    try:
        stack = inspect.stack()
        for fr in stack[2:]:
            mod = fr.frame.f_globals.get("__name__", "")
            if not mod.startswith("web3"):  # skip internal web3 frames
                fname = fr.filename.rsplit("/", 2)[-1]
                return f"{fname}:{fr.function}"
        fr = stack[2]
        fname = fr.filename.rsplit("/", 2)[-1]
        return f"{fname}:{fr.function}"
    except Exception:
        return "unknown"

def _wrap_provider(provider):
    if getattr(provider, "_is_wrapped", False):
        return provider
    # original_make_request is not used; we route to the chosen provider per call

    def wrapped(method, params):
        src = _detect_source()
        # detect if call originates from APIs
        is_api = False
        try:
            for fr in inspect.stack()[2:]:
                mod = fr.frame.f_globals.get("__name__", "")
                if mod.startswith("apis"):
                    is_api = True
                    break
        except Exception:
            pass
        with _req_lock:
            global _total_reqs
            _total_reqs += 1
            _method_counts[method] += 1
            _source_counts[src] += 1
            # Daily base
            day = _today_key()
            _daily_total[day] += 1
            _daily_method.setdefault(day, Counter())[method] += 1

            # Contract/Event attribution
            try:
                if method == "eth_getLogs" and params:
                    flt = params[0] or {}
                    addrs = flt.get("address")
                    topics = flt.get("topics") or []
                    topic0s = []
                    if topics and topics[0] is not None:
                        t0 = topics[0]
                        topic0s = t0 if isinstance(t0, list) else [t0]
                    addr_list = []
                    if addrs is not None:
                        addr_list = addrs if isinstance(addrs, list) else [addrs]
                    # Attribute per address if present
                    for a in addr_list:
                        name = _address_to_contract.get(a.lower()) or _address_to_contract.get(a)
                        if name:
                            _daily_contract.setdefault(day, Counter())[name] += 1
                    # Attribute per topic0
                    for t in topic0s:
                        ce = _topic0_to_eventname.get(t)
                        if ce:
                            c, e = ce
                            _daily_event.setdefault(day, Counter())[f"{c}:{e}"] += 1
                elif method == "eth_call" and params:
                    call = params[0] or {}
                    to = call.get("to")
                    if to:
                        name = _address_to_contract.get(to.lower()) or _address_to_contract.get(to)
                        if name:
                            _daily_contract.setdefault(day, Counter())[name] += 1
            except Exception:
                # Never break RPCs due to metrics
                pass
        try:
            # Choose provider based on context
            if is_api and _api_provider is not None:
                return _api_provider.make_request(method, params)
            else:
                # Use current events provider (1 & 2 rotation)
                if _event_providers:
                    return _event_providers[_current_provider_index % len(_event_providers)].make_request(method, params)
                else:
                    return provider.make_request(method, params)
        except Exception:
            raise

    provider.make_request = wrapped
    provider._is_wrapped = True
    return provider

_wrap_provider(w3.provider)

def _log_stats_loop():
    global _prev_total, _prev_method_counts, _prev_source_counts
    while True:
        time.sleep(10)
        with _req_lock:
            total = _total_reqs
            by_method = _method_counts.copy()
            by_source = _source_counts.copy()
            day = _today_key()
            today_total = _daily_total.get(day, 0)
            today_contracts = _daily_contract.get(day, Counter()).copy()
            today_events = _daily_event.get(day, Counter()).copy()
        delta_total = total - _prev_total
        delta_methods = by_method - _prev_method_counts
        delta_sources = by_source - _prev_source_counts
        top_methods = ", ".join(f"{k}:{v}" for k, v in delta_methods.most_common(5)) or "-"
        top_sources = ", ".join(f"{k}:{v}" for k, v in delta_sources.most_common(5)) or "-"
        try:
            provider_uri = getattr(getattr(w3, "provider", None), "endpoint_uri", "unknown")
        except Exception:
            provider_uri = "unknown"
        top_contracts = ", ".join(f"{k}:{v}" for k, v in today_contracts.most_common(5)) or "-"
        top_events = ", ".join(f"{k}:{v}" for k, v in today_events.most_common(5)) or "-"
        logger.info(
            f"RPC 10s window -> total:{delta_total} | provider:{provider_uri} | "
            f"methods:[{top_methods}] | sources:[{top_sources}] | "
            f"today_total:{today_total} | today_contracts:[{top_contracts}] | today_events:[{top_events}]"
        )
        _prev_total = total
        _prev_method_counts = by_method
        _prev_source_counts = by_source

_t = threading.Thread(target=_log_stats_loop, daemon=True)
_t.start()

def get_current_provider_url() -> str:
    try:
        return _provider_urls[_current_provider_index]
    except Exception:
        return WEB3_PROVIDER_URL

def switch_to_alternate_provider() -> str:
    """Switch w3.provider to the next configured provider URL (if available) and return it."""
    global _current_provider_index
    if not _provider_urls or len(_provider_urls) == 1:
        # Nothing to switch to
        return get_current_provider_url()
    _current_provider_index = (_current_provider_index + 1) % len(_provider_urls)
    new_url = _provider_urls[_current_provider_index]
    try:
        w3.provider = Web3.HTTPProvider(new_url)
        _wrap_provider(w3.provider)
        logger.info(f"Switched Web3 provider to {new_url}")
    except Exception as e:
        logger.error(f"Failed to switch Web3 provider to {new_url}: {e}")
    return new_url

def load_contract_abi(contract_name: str) -> dict:
    search_path = CONTRACTS_DIR
    pattern = f"**/{contract_name}.json"
    matches = glob.glob(os.path.join(search_path, pattern), recursive=True)
    if not matches:
        logger.error(f"ABI file for {contract_name} not found in {CONTRACTS_DIR}/")
        raise ValueError(f"ABI for {contract_name} not found in {CONTRACTS_DIR}/")
    abi_path = matches[0]
    try:
        with open(abi_path, "r") as f:
            return json.load(f)["abi"]
    except Exception as e:
        logger.error(f"Error loading ABI for {contract_name} from {abi_path}: {str(e)}")
        raise ValueError(f"Failed to load ABI for {contract_name} from {abi_path}, wn: {str(e)}")


# Direcciones fijas de los contratos desplegados (NUEVAS)
CONTRACT_ADDRESSES = {
    "VanellixLaunchpad": '0xECe6da1C29895BFaC35A97c9f6924d8377703A78',
    "VanellixDAOController": '0x7AbD1477cd77D910df4940410d28e87c55A7581c',
    "WrappedToken": '0xf631e220bb388Da70ED44244Abf2e3d760350C21',
    "WrappedUtilityToken": '0x7ed2aC904e8aBcb216740C225c20c41f9AFAe6C4',
    "VanellixTokenFactory": '0x826a744E592c16D26550b68E75b239A6Fa3F62Bd',
    "VanellixCompanyMultiToken": '0x5A21820cEd7eBD23bac63AD955d4F185bFF77de9',
    "CompanyStaking": '0x138c6CE06c084327390B3354Bf2D2Dc961Cf7c86',
    "SimpleWalletMinting": '0x38fF4995796b99A46A7096Bdfd0522Aa8e74CB5b',
    "VanellixStakingMultiToken": '0x7dBC84ba916A0132EE8C0526cF8F6B73b1FD5C0d',
    "VanellixTokenSale": '0xaaDB2157Eaf18F70fC92d575A681863E3827D9E9',
    "VanellixCompanyMultiTokenV2": '0x2F236bE6Add0dbc54C01F0649eA4FC26864Be1F4',
    "UniswapV2Factory": '0x3E6b9f8C3b06dE9591348017FdF0860ABd49Bc20',
    "UniswapV2Router02": '0x2741F2b3aa5C436b1860Ca71beC9779ac762Fd01',
    "GlobalMeritocracy": '0xe75ec4b2d3Cb5D92a0bb3d4Eab545B5BF4e5AaaC',
    "VanellixLaunchpadV2": '0x2A9ca77a0Ca020979C0513e09F21a471e625d470',
    "WMATICMock": '0x06036E45348bcDe39e42aaf979fd8b10833d3847',
    "USDC": '0x96148b59a75d965acb2e04d8b9C9c81a38Bd4254',
    "VanellixRedemption": '0xFd2Ef2437C434B7Bf94598398B3683A77AA1A6B5',
}

# Inicialización de contratos usando las direcciones fijas
contracts = {}
contract_names = [
    "VanellixLaunchpad",
    "VanellixCompanyMultiToken",
    "VanellixStakingMultiToken",
    "VanellixTokenSale",
    "VanellixDAOController",
    "VanellixTokenFactory",
    "WrappedToken",
    "WrappedUtilityToken",
    "GlobalMeritocracy",
    "CompanyStaking",
    "SimpleWalletMinting",
    "UniswapV2Factory",
    "UniswapV2Router02",
    "VanellixRedemption"
]
for contract_name in contract_names:
    try:
        address = CONTRACT_ADDRESSES[contract_name]
        abi = load_contract_abi(contract_name)
        contracts[contract_name] = w3.eth.contract(address=w3.to_checksum_address(address), abi=abi)
        logger.info(f"{contract_name} contract loaded: {address}")
    except Exception as e:
        logger.error(f"Failed to initialize {contract_name} contract: {str(e)}")
        raise ValueError(f"Failed to initialize {contract_name} contract, wn: {str(e)}")

launchpad_contract = contracts["VanellixLaunchpad"]
company_contract = contracts["VanellixCompanyMultiToken"]
staking_contract = contracts["VanellixStakingMultiToken"]
tokensale_contract = contracts["VanellixTokenSale"]
dao_contract = contracts["VanellixDAOController"]
token_factory_contract = contracts["VanellixTokenFactory"]
token_sale_contract = contracts["VanellixTokenSale"]
uniswap_factory_contract = contracts["UniswapV2Factory"]
uniswap_router_contract = contracts["UniswapV2Router02"]
redemption_contract = contracts["VanellixRedemption"]
global_meritocracy_contract = contracts["GlobalMeritocracy"]

# Build mappings for attribution
try:
    for cname, c in contracts.items():
        try:
            addr = c.address
            if addr:
                _address_to_contract[addr.lower()] = cname
        except Exception:
            pass
        try:
            for item in c.abi:
                if item.get('type') == 'event':
                    ename = item.get('name')
                    types = [inp.get('type') for inp in item.get('inputs', [])]
                    sig = f"{ename}({','.join(types)})"
                    topic0 = Web3.keccak(text=sig).hex()
                    _topic0_to_eventname[topic0] = (cname, ename)
        except Exception:
            pass
    logger.info("Web3 attribution mappings ready: %d addresses, %d events", len(_address_to_contract), len(_topic0_to_eventname))
except Exception as _e:
    logger.warning(f"Failed to build attribution mappings: {_e}")