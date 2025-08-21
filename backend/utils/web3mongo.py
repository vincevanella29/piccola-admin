from __future__ import annotations
import json
import logging
import os
from typing import List
from pymongo import MongoClient
from web3 import Web3
from web3.middleware.proof_of_authority import ExtraDataToPOAMiddleware
import glob

MONGODB_URI = os.getenv("MONGODB_URI", "mongodb://localhost:27017")
WEB3_PROVIDER_URL = os.getenv("WEB3_PROVIDER_URL", "https://rpc-amoy.polygon.technology")

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

def setup_event_collections_indexes(event_listener_configs: List['EventListenerConfig']): 
    
    configured_collection_names = set()

    db.notification_types.create_index([("id", 1)], unique=True)
    db.notification_types.create_index([("event_name", 1)])
    db.notification_api_configs.create_index([("id", 1)], unique=True)
    db.user_notification_tokens.create_index([("wallet", 1), ("token", 1)], unique=True)
    db.notification_schedules.create_index([("notification_type_id", 1), ("schedule_time", 1)])

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

# Web3 setup
w3 = Web3(Web3.HTTPProvider(WEB3_PROVIDER_URL))
w3.middleware_onion.inject(ExtraDataToPOAMiddleware, layer=0)

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
    "VanellixLaunchpad": '0x8e27e95De4C2e7893B54C23DCe7D60983bE8896c',
    "VanellixDAOController": '0x74C81546b7d355097be5a2A2ea44AAd0b5774bAF',
    "WrappedToken": '0xc1b29e467a4FC7B328EC075B2eFC21Dcc56d5662',
    "WrappedUtilityToken": '0x39b2829EaE4FaE3a66EB74506f9613441e89a30C',
    "VanellixTokenFactory": '0xD46b1D42F1717aECF2Db16942e5f3f01743cDF4A',
    "VanellixCompanyMultiToken": '0x67Fa14D2e04404E1f26837a31b15203db1D65ACf',
    "CompanyStaking": '0xe37f33956f53922A22432A98501923C8E3425257',
    "SimpleWalletMinting": '0x691ec7251177a0aE1E5012BAEB6070288c426F43',
    "VanellixStakingMultiToken": '0xfcDA3d8e8F61Fc9b580452b52a4c4713472F514f',
    "VanellixTokenSale": '0x118dD9b5eAEa261CC46238E089a139e869009ECD',
    "VanellixCompanyMultiTokenV2": '0xc121D875AC6D9bcff3C9dC605aDed7735b3b1dCe',
    "UniswapV2Factory": '0x131e7D9718A25BffC357d533298f96e8F22a0828',
    "UniswapV2Router02": '0xf2D38F3d43B5BEa24a4137010D076010D8925007',
    "GlobalMeritocracy": '0x9e01B392d7E5EEa64b704Eda0C4549543B77Bd54',
    "VanellixLaunchpadV2": '0x822865B92C79456Ac09271158Ce7Ef55D346c5B7',
    "VanellixCompanyMultiTokenV2": '0xabA4288d2056fE1D505f1785875E0691e6828429',
    "WMATICMock": '0xb3973eff4c781777e6799A6b8Dc81c016d54AA8F',
    "USDC": '0x655D966EbC02FF37Bf19c8C0A15F30E108C87960',
    "VanellixRedemption": '0xCD9f5cF1Dc080E009684E0783a52aD7C053aD60b',
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

