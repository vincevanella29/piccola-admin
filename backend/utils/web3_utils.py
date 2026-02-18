try:
    from datetime import datetime, timezone
except ImportError:
    from datetime import datetime
    import pytz
    timezone = pytz.UTC  # Fallback for old Python

from utils.web3mongo import w3, db, company_contract, launchpad_contract, staking_contract, token_factory_contract, token_sale_contract
from utils.companies_tokens import upsert_company_tokens
import logging

# Logging setup
logging.basicConfig(level=logging.INFO, format='%(asctime)s %(levelname)s: %(message)s')
logger = logging.getLogger(__name__)

# Minimal ERC20 ABI for name, symbol, and totalSupply
ERC20_ABI = [
    {"constant": True, "inputs": [], "name": "name", "outputs": [{"name": "", "type": "string"}], "type": "function"},
    {"constant": True, "inputs": [], "name": "symbol", "outputs": [{"name": "", "type": "string"}], "type": "function"},
    {"constant": True, "inputs": [], "name": "totalSupply", "outputs": [{"name": "", "type": "uint256"}], "type": "function"}
]

async def sync_company_data(company_id: int, force: bool = False):
    """
    Synchronizes all data for a company into db.companies, fetching from contracts if necessary.
    Includes presale data from token_sale_events and VanellixTokenSale contract.
    Returns the enriched company data.
    
    Optimization: If data already exists and is complete, skips Web3 calls entirely.
    Pass force=True to bypass this cache.
    """
    try:
        # Check if the company has a governance token (CompanyTokenCreated)
        company_token_event = db.token_factory_events.find_one({
            "event": "CompanyTokenCreated",
            "args.companyId": company_id
        })

        # If no governance token, skip the company
        if not company_token_event:
            logger.info(f"[sync_company_data] No CompanyTokenCreated event for company_id {company_id}. Skipping.")
            return None

        # Get existing company data from db
        company_data = db.companies.find_one({"companyId": company_id}) or {
            "companyId": company_id,
            "updated_at": datetime.now(timezone.utc)
        }

        # OPTIMIZATION: If data is already populated, skip all Web3 calls
        if not force and company_data.get("name") and company_data.get("governance_token"):
            logger.debug(f"[sync_company_data] Company {company_id} already synced, skipping Web3 calls.")
            return company_data

        # Fetch company info from contract if missing or incomplete
        if not company_data.get("raw_tuple") or not company_data.get("name"):
            try:
                company_info = company_contract.functions.getCompanyData(company_id).call()
                company_data.update({
                    "raw_tuple": company_info,
                    "owner": company_info[1] if len(company_info) > 1 else None,
                    "name": company_info[2] if len(company_info) > 2 else f"Company {company_id}",
                    "din": company_info[3] if len(company_info) > 3 else None,
                    "companyAddress": company_info[4] if len(company_info) > 4 else None,
                    "country": company_info[5] if len(company_info) > 5 else None,
                    "isActive": company_info[6] if len(company_info) > 6 else False,
                    "daoAddress": company_info[7] if len(company_info) > 7 else None,
                    "companyDaoTransitionTimestamp": company_info[8] if len(company_info) > 8 else None,
                    "governanceTokenProxy": company_info[9] if len(company_info) > 9 else None,
                    "utilityTokenProxy": company_info[10] if len(company_info) > 10 else None,
                    "updated_at": datetime.now(timezone.utc)
                })
            except Exception as e:
                logger.error(f"[sync_company_data] Error fetching getCompanyData for company_id {company_id}: {str(e)}")
                company_data["name"] = f"Company {company_id}"

        # Fetch governance token data if missing or incomplete
        if not company_data.get("governance_token"):
            try:
                token_factory_addr = launchpad_contract.functions.validateContract("TokenFactory").call()
                token_factory = w3.eth.contract(address=token_factory_addr, abi=token_factory_contract.abi)
                token_id = company_token_event["args"]["tokenId"]
                platform_data, vesting_config, fund_usages, documents = token_factory.functions.getTokenBasicData(token_id).call()
                company_data["governance_token"] = {
                    "address": platform_data[7],  # proxy
                    "name": platform_data[2],
                    "symbol": platform_data[3],
                    "totalSupply": str(platform_data[4]),
                    "imagePath": platform_data[6],
                    "description": platform_data[5],
                    "documents": documents,
                    "fund_usages": fund_usages,
                    "vesting_config": vesting_config
                }
            except Exception as e:
                logger.error(f"[sync_company_data] Error fetching getTokenBasicData for company_id {company_id}: {str(e)}")
                company_data["governance_token"] = {
                    "address": company_token_event["args"]["proxy"],
                    "name": company_token_event["args"]["name"],
                    "symbol": company_token_event["args"]["symbol"],
                    "totalSupply": str(company_token_event["args"]["totalSupply"]),
                    "imagePath": "",
                    "description": "Governance token for company",
                    "documents": [],
                    "fund_usages": [],
                    "vesting_config": []
                }

        # Check for UtilityTokenFinalized events to confirm full configuration
        utility_events = db.staking_events.find({
            "event": "UtilityTokenFinalized",
            "args.companyId": company_id
        }).sort([("args.year", -1)])

        # Initialize pools and utility token
        company_data["pools"] = company_data.get("pools", {})

        # Process utility token from the most recent UtilityTokenFinalized event
        utility_event = next(iter(utility_events), None)
        if utility_event and not company_data.get("utility_token"):
            args = utility_event.get("args", {})
            utility_token_address = args.get("proxy", company_data.get("utilityTokenProxy", ""))
            utility_token_name = args.get("name", "")
            utility_token_symbol = args.get("symbol", "")

            total_supply = "0"
            if not utility_token_name or not utility_token_symbol:
                try:
                    utility_token_contract = w3.eth.contract(address=utility_token_address, abi=ERC20_ABI)
                    utility_token_name = utility_token_contract.functions.name().call() if not utility_token_name else utility_token_name
                    utility_token_symbol = utility_token_contract.functions.symbol().call() if not utility_token_symbol else utility_token_symbol
                    total_supply = str(utility_token_contract.functions.totalSupply().call())
                except Exception as e:
                    logger.error(f"[sync_company_data] Error fetching utility token name/symbol for company_id {company_id}: {str(e)}")
                    utility_token_name = f"{company_data['name']} Utility" if not utility_token_name else utility_token_name
                    utility_token_symbol = "UTL" if not utility_token_symbol else utility_token_symbol
                    total_supply = "0"

            company_data["utility_token"] = {
                "address": utility_token_address,
                "name": utility_token_name,
                "symbol": utility_token_symbol,
                "totalSupply": total_supply,
                "imagePath": args.get("imagePath", ""),
                "description": "Utility token for loyalty programs",
                "timestamp": args.get("timestamp", 0)
            }

        # Process pools for each year with UtilityTokenFinalized events
        utility_events.rewind()
        for event in utility_events:
            args = event.get("args", {})
            year = args.get("year")
            if not year:
                continue

            if str(year) not in company_data["pools"]:
                try:
                    pools = staking_contract.functions.getStakingPools(company_id, year).call()
                    formatted_pools = []
                    for index, pool in enumerate(pools):
                        formatted_pools.append({
                            "company_id": pool[0],
                            "pool_index": index,
                            "pool_type": pool[2],
                            "duration_days": pool[3],
                            "reward_percentage": str(pool[4] / 10**18),
                            "authorized_wallet": pool[5] if pool[2] == 1 else "",
                            "is_active": pool[6],
                            "created_at": pool[7],
                            "total_rewards": "0"
                        })
                    company_data["pools"][str(year)] = {
                        "pools": formatted_pools,
                    }
                except Exception as e:
                    logger.error(f"[sync_company_data] Error fetching getStakingPools for company_id {company_id}, year {year}: {str(e)}")
                    company_data["pools"][str(year)] = {
                        "pools": [],
                    }

        # Update total rewards from AnnualRewardFixed events
        reward_events = db.staking_events.find({
            "event": "AnnualRewardFixed",
            "args.companyId": company_id
        })
        for event in reward_events:
            args = event.get("args", {})
            year = args.get("year")
            if year and str(year) in company_data["pools"]:
                company_data["pools"][str(year)]["total_rewards"] = str(args.get("annualRewardMint", "0"))

        for year, pools_data in company_data["pools"].items():
            total_rewards = pools_data.get("total_rewards", "0")
            try:
                total_rewards_int = int(total_rewards)
            except Exception:
                total_rewards_int = 0
            for pool in pools_data.get("pools", []):
                try:
                    reward_percentage = float(pool.get("reward_percentage", "0"))
                except Exception:
                    reward_percentage = 0.0
                pool_total_rewards = int((reward_percentage / 100) * total_rewards_int)
                pool["total_rewards"] = str(pool_total_rewards)

        # Fetch presale data from token_sale_events and VanellixTokenSale contract
        company_data["presales"] = company_data.get("presales", {})
        presale_events = db.token_sale_events.find({
            "event": "PreSaleCreated",
            "args.companyId": company_id
        }).sort([("args.preSaleId", 1)])

        for event in presale_events:
            args = event.get("args", {})
            pre_sale_id = args.get("preSaleId")
            if not pre_sale_id:
                continue

            try:
                # Fetch presale details from contract
                presale_details = token_sale_contract.functions.getPreSaleDetails(pre_sale_id).call()
                # Solidity struct PreSale:
                # [0]: preSaleId
                # [1]: companyId
                # [2]: token (governance token)
                # [3]: name
                # [4]: startTimes
                # [5]: endTimes
                # [6]: pricesPerToken
                # [7]: availableTokens
                # [8]: tokensSold
                # [9]: paymentToken
                # [10]: seller
                # [11]: liquidityPool
                # [12]: active
                # [13]: paused
                # [14]: liquidityLockDuration
                # [15]: isImmutable
                # [16]: beneficiaryWallet
                # [17]: liquidityPercent
                # [18]: paymentTokenDecimals
                # [19]: saleTokenDecimals

                payment_token_address = presale_details[9]
                payment_token_contract = w3.eth.contract(address=payment_token_address, abi=ERC20_ABI)
                payment_token_name = payment_token_contract.functions.name().call()
                payment_token_symbol = payment_token_contract.functions.symbol().call()

                formatted_presale = {
                    "preSaleId": presale_details[0],
                    "companyId": presale_details[1],
                    "token": presale_details[2],  # governance token address
                    "name": presale_details[3],
                    "startTimes": [int(t) for t in presale_details[4]],
                    "endTimes": [int(t) for t in presale_details[5]],
                    "pricesPerToken": [str(p) for p in presale_details[6]],
                    "availableTokens": str(presale_details[7]),
                    "tokensSold": str(presale_details[8]),
                    "paymentToken": {
                        "address": payment_token_address,
                        "name": payment_token_name,
                        "symbol": payment_token_symbol
                    },
                    "seller": presale_details[10],
                    "liquidityPool": presale_details[11],
                    "active": presale_details[12],
                    "paused": presale_details[13],
                    "liquidityLockDuration": int(presale_details[14]),
                    "isImmutable": presale_details[15],
                    "beneficiaryWallet": presale_details[16],
                    "liquidityPercent": int(presale_details[17]),
                    "paymentTokenDecimals": int(presale_details[18]),
                    "saleTokenDecimals": int(presale_details[19]),
                    "transactionHash": event.get("transactionHash"),
                    "blockNumber": event.get("blockNumber"),
                    "timestamp": datetime.fromtimestamp(event.get("args", {}).get("startTime", 0), timezone.utc),
                }

                company_data["presales"][str(pre_sale_id)] = formatted_presale
            except Exception as e:
                logger.error(f"[sync_company_data] Error fetching getPreSaleDetails for preSaleId {pre_sale_id}: {str(e)}")
                # Store minimal data from event if contract call fails
                company_data["presales"][str(pre_sale_id)] = {
                    "preSaleId": pre_sale_id,
                    "companyId": args.get("companyId"),
                    "name": args.get("name", f"Presale {pre_sale_id}"),
                    "paymentToken": {
                        "address": args.get("token"),
                        "name": "Unknown",
                        "symbol": "Unknown"
                    },
                    "startTimes": [args.get("startTime", 0)],
                    "endTimes": [args.get("endTime", 0)],
                    "pricesPerToken": [str(args.get("pricePerToken", 0))],
                    "availableTokens": str(args.get("availableTokens", 0)),
                    "tokensSold": "0",
                    "transactionHash": event.get("transactionHash"),
                    "blockNumber": event.get("blockNumber"),
                    "timestamp": datetime.fromtimestamp(args.get("startTime", 0), timezone.utc),
                    "error": f"Failed to fetch details: {str(e)}"
                }

        # Save the enriched company data to db
        db.companies.update_one(
            {"companyId": company_id},
            {"$set": company_data},
            upsert=True
        )

        # Store governance and utility tokens in companies_tokens collection
        governance_token = company_data.get("governance_token")
        utility_token = company_data.get("utility_token")
        if governance_token or utility_token:
            upsert_company_tokens(company_id, governance_token, utility_token)

        return company_data

    except Exception as e:
        logger.error(f"[sync_company_data] Error syncing company_id {company_id}: {str(e)}")
        return None