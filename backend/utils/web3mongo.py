# /utils/web3mongo.py
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
WEB3_POLYGON = os.getenv("WEB3_POLYGON")
WEB3_ALCHEMY = os.getenv("WEB3_ALCHEMY")
WEB3_INFURA = os.getenv("WEB3_INFURA")
WEB3_INFURA_TOKEN = os.getenv("WEB3_INFURA_TOKEN")

# Logging setup
logging.basicConfig(level=logging.INFO, format='%(asctime)s %(levelname)s: %(message)s')
logger = logging.getLogger(__name__)

# --- MongoDB Setup ---
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
# (Nota: Se eliminó 'setup_event_collections_indexes' porque ya no se usa)


# --- Web3 Setup (Core) ---
def _resolve_url(url_template: str) -> str:
    if not url_template:
        return None
    if WEB3_INFURA_TOKEN and "{TOKEN}" in url_template:
        return url_template.replace("{TOKEN}", WEB3_INFURA_TOKEN)
    return url_template

_initial_url = _resolve_url(WEB3_POLYGON) or _resolve_url(WEB3_ALCHEMY) or _resolve_url(WEB3_INFURA)
if not _initial_url:
    raise RuntimeError("No Web3 RPC URL configured. Set WEB3_POLYGON or WEB3_ALCHEMY or WEB3_INFURA.")
w3 = Web3(Web3.HTTPProvider(_initial_url))
w3.middleware_onion.inject(ExtraDataToPOAMiddleware, layer=0)

# --- Provider Rotation & Routing ---
_current_provider_index = 0

# Mappings (se llenarán desde el loader)
_address_to_contract = {}
_topic0_to_eventname = {}

# Providers para el Worker (Listener) — PRIORIDAD: Polygon -> Alchemy (NO Infura)
_event_providers = []
for url in [WEB3_POLYGON, WEB3_ALCHEMY]:
    if url:
        try:
            resolved = _resolve_url(url)
            if resolved:
                _event_providers.append(Web3.HTTPProvider(resolved))
        except Exception:
            pass

# Provider para la API (Infura)
def _build_api_provider():
    try:
        if WEB3_INFURA:
            url = _resolve_url(WEB3_INFURA)
            return Web3.HTTPProvider(url)
        if _event_providers:
            return _event_providers[0] # Fallback
    except Exception:
        pass
    return w3.provider

_api_provider = _build_api_provider()

def get_current_provider_url() -> str:
    try:
        if _event_providers:
            return getattr(_event_providers[_current_provider_index % len(_event_providers)], "endpoint_uri", "unknown")
        return getattr(w3.provider, "endpoint_uri", "unknown")
    except Exception:
        return "unknown"

def switch_to_alternate_provider() -> str:
    """Cambia el provider del listener (worker) al siguiente de la lista."""
    global _current_provider_index
    if not _event_providers or len(_event_providers) == 1:
        return get_current_provider_url()
    
    _current_provider_index = (_current_provider_index + 1) % len(_event_providers)
    new_url = getattr(_event_providers[_current_provider_index], "endpoint_uri", "unknown")
    try:
        # Importante: Cambiamos el provider de la instancia 'w3'
        w3.provider = _event_providers[_current_provider_index]
        _wrap_provider(w3.provider) # Re-aplicamos el wrapper al nuevo provider
        logger.info(f"Switched Web3 (worker) provider to {new_url}")
    except Exception as e:
        logger.error(f"Failed to switch Web3 provider to {new_url}: {e}")
    return new_url

# --- RPC Logging Wrapper (La lógica de "wrapping") ---
_req_lock = threading.Lock()
_total_reqs = 0
_method_counts = Counter()
_source_counts = Counter()
_prev_total = 0
_prev_method_counts = Counter()
_prev_source_counts = Counter()
_daily_total = Counter()
_daily_method = {}
_daily_contract = {}
_daily_event = {}
_daily_provider = {}

def _today_key():
    return datetime.utcnow().date().isoformat()

def _detect_source():
    try:
        stack = inspect.stack()
        for fr in stack[2:]:
            mod = fr.frame.f_globals.get("__name__", "")
            if not mod.startswith("web3"):
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
    
    original_make_request = provider.make_request

    def wrapped(method, params):
        src = _detect_source()
        is_api = False
        try:
            for fr in inspect.stack()[2:]:
                mod = fr.frame.f_globals.get("__name__", "")
                fname = fr.filename.replace('\\\\', '/').lower()
                if mod.startswith("apis") or mod.startswith("config") or "/apis/" in fname or "/config/" in fname:
                    is_api = True
                    break
        except Exception:
            pass
        
        with _req_lock:
            global _total_reqs
            _total_reqs += 1
            _method_counts[method] += 1
            _source_counts[src] += 1
            day = _today_key()
            _daily_total[day] += 1
            _daily_method.setdefault(day, Counter())[method] += 1
            
            # Lógica de atribución (usa los maps importados)
            try:
                if method == "eth_getLogs" and params:
                    # ... (lógica de atribución de getLogs)
                    pass
                elif method == "eth_call" and params:
                    # ... (lógica de atribución de eth_call)
                    pass
            except Exception:
                pass
        
        try:
            # --- RUTEO INTELIGENTE ---
            # Si la llamada viene de 'apis/' USA INFURA (_api_provider)
            # Si no (ej. el listener), usa el provider del WORKER (el 'provider' base de 'w3')
            target_provider = _api_provider if is_api else provider
            uri = getattr(target_provider, "endpoint_uri", "unknown")

            # Caching (como lo tenías)
            if method == "eth_chainId":
                if not hasattr(target_provider, "_cached_chain_id"):
                    resp = original_make_request(method, params) # Llama al original
                    target_provider._cached_chain_id = resp
                else:
                    resp = target_provider._cached_chain_id
            elif method == "eth_blockNumber":
                now = time.time()
                ttl = 2.0
                last = getattr(target_provider, "_cached_block_number", None)
                if last and (now - last.get("ts", 0)) < ttl:
                    resp = last["resp"]
                else:
                    resp = original_make_request(method, params)
                    setattr(target_provider, "_cached_block_number", {"resp": resp, "ts": now})
            else:
                resp = original_make_request(method, params) # Llamada normal

            with _req_lock:
                day = _today_key()
                _daily_provider.setdefault(day, Counter())[str(uri)] += 1
            return resp
        except Exception:
            raise

    provider.make_request = wrapped
    provider._is_wrapped = True
    return provider

_wrap_provider(w3.provider) # Aplicamos el wrapper al provider inicial

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
        top_contracts = ", ".join(f"{k}:{v}" for k, v in today_contracts.most_common(5)) or "-"
        top_events = ", ".join(f"{k}:{v}" for k, v in today_events.most_common(5)) or "-"
        
        # --- LOG PIOLA (NIVEL DEBUG) ---
        logger.debug(
            f"RPC 10s window -> total:{delta_total} | "
            f"methods:[{top_methods}] | sources:[{top_sources}] | "
            f"today_total:{today_total} | today_contracts:[{top_contracts}] | today_events:[{top_events}]"
        )
        _prev_total = total
        _prev_method_counts = by_method
        _prev_source_counts = by_source

_t = threading.Thread(target=_log_stats_loop, daemon=True)
_t.start()


# --- Carga e Importación Final de Contratos ---
# (Importamos todo desde el nuevo loader para que
# los otros archivos (apis/roles.py, etc.) puedan
# seguir importando desde utils.web3mongo sin romperse)
try:
    from .contracts.loader import (
        load_contract_abi,
        contracts,
        launchpad_contract,
        company_contract,
        staking_contract,
        tokensale_contract,
        dao_contract,
        token_factory_contract,
        token_sale_contract,
        uniswap_factory_contract,
        uniswap_router_contract,
        redemption_contract,
        global_meritocracy_contract
    )
    logger.info("✅ Contratos cargados y listos desde 'utils.contracts.loader'.")
except ImportError as e:
    logger.critical(f"CRITICAL: No se pudieron cargar los contratos desde 'utils.contracts.loader': {e}")
    # Definimos defaults vacíos para que la app no crashee al importar
    contracts = {}
    launchpad_contract = None
    company_contract = None
    staking_contract = None
    tokensale_contract = None
    dao_contract = None
    token_factory_contract = None
    token_sale_contract = None
    uniswap_factory_contract = None
    uniswap_router_contract = None
    redemption_contract = None
    global_meritocracy_contract = None