# /utils/contracts/loader.py
import json
import logging
import os
import glob
from web3 import Web3

# Importamos las variables de conexión y mapas desde el web3mongo "padre"
from ..web3mongo import w3, _address_to_contract, _topic0_to_eventname
# Importamos las direcciones
from .addresses import CONTRACT_ADDRESSES

logger = logging.getLogger(__name__)

CONTRACTS_DIR = "contracts/"

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
            # Asumimos que el JSON tiene una llave "abi"
            return json.load(f)["abi"]
    except Exception as e:
        logger.error(f"Error loading ABI for {contract_name} from {abi_path}: {str(e)}")
        # Intentamos cargar como si fuera solo la lista (fallback por si acaso)
        try:
            with open(abi_path, "r") as f:
                return json.load(f)
        except Exception:
            raise ValueError(f"Failed to load ABI for {contract_name} from {abi_path}, wn: {str(e)}")


# --- Inicialización de Contratos ---
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
        if contract_name not in CONTRACT_ADDRESSES:
            logger.warning(f"No address found for {contract_name} in CONTRACT_ADDRESSES. Skipping.")
            continue
        
        address = CONTRACT_ADDRESSES[contract_name]
        abi = load_contract_abi(contract_name)
        contracts[contract_name] = w3.eth.contract(address=w3.to_checksum_address(address), abi=abi)
        
        # Log "piola" (nivel DEBUG)
        logger.debug(f"{contract_name} contract loaded: {address}") 
        
    except Exception as e:
        logger.error(f"Failed to initialize {contract_name} contract: {str(e)}")
        # No hacemos raise, para que la app pueda partir igual

# --- Exportación de instancias individuales (para compatibilidad) ---
launchpad_contract = contracts.get("VanellixLaunchpad")
company_contract = contracts.get("VanellixCompanyMultiToken")
staking_contract = contracts.get("VanellixStakingMultiToken")
tokensale_contract = contracts.get("VanellixTokenSale")
dao_contract = contracts.get("VanellixDAOController")
token_factory_contract = contracts.get("VanellixTokenFactory")
token_sale_contract = contracts.get("VanellixTokenSale")
uniswap_factory_contract = contracts.get("UniswapV2Factory")
uniswap_router_contract = contracts.get("UniswapV2Router02")
redemption_contract = contracts.get("VanellixRedemption")
global_meritocracy_contract = contracts.get("GlobalMeritocracy")

# --- Construir Mapeos para Logging ---
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
                    # Usamos la firma canónica para el topic
                    def get_canonical_type(inp):
                        if inp['type'].startswith('tuple'):
                            return f"({','.join(get_canonical_type(c) for c in inp['components'])})"
                        return inp['type']
                    types = [get_canonical_type(inp) for inp in item.get('inputs', [])]
                    sig = f"{ename}({','.join(types)})"
                    topic0 = Web3.keccak(text=sig).hex()
                    _topic0_to_eventname[topic0] = (cname, ename)
        except Exception:
            pass
    # Log "piola"
    logger.debug("Web3 attribution mappings ready: %d addresses, %d events", len(_address_to_contract), len(_topic0_to_eventname))
except Exception as _e:
    logger.warning(f"Failed to build attribution mappings: {_e}")