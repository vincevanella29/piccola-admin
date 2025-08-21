from utils.web3mongo import launchpad_contract, company_contract, staking_contract, token_factory_contract, token_sale_contract, redemption_contract
from typing import List

class EventListenerConfig:
    def __init__(self, contract, event_names: List[str], collection_name: str, contract_name: str):
        self.contract = contract
        self.event_names = event_names
        self.collection_name = collection_name
        self.contract_name = contract_name

CONFIGS = [
    EventListenerConfig(launchpad_contract, ["RoleCreated", "ContractSet", "RoleAssignedHierarchical", "RoleRevoked"], "launchpad_events", "VanellixLaunchpad"),
    EventListenerConfig(company_contract, ["CompanyRegistered", "CompanyActivated", "UserRegistered", "UserRemoved"], "company_events", "VanellixCompanyMultiToken"),
    EventListenerConfig(token_factory_contract, ["PlatformTokenConfigured", "CompanyTokenCreated", "FundUsageConfigured", "DocumentConfigured"], "token_factory_events", "VanellixTokenFactory"),
    EventListenerConfig(staking_contract, ["UtilityTokenFinalized", "AnnualRewardFixed", "StakingConfigFinalized", "TotalRewardPercentageUpdated", "Staked", "Unstaked", "RewardsClaimedPool"], "staking_events", "VanellixStakingMultiToken"),
    EventListenerConfig(token_sale_contract, ["PreSaleCreated", "PreSaleDeleted", "PreSaleActivated", "PreSalePaused", "PaymentTokenAdded", "PaymentTokenRemoved", "TokensBurned", "LiquiditySent", "PreSaleTokensPurchased"], "token_sale_events", "VanellixTokenSale"),
    EventListenerConfig(redemption_contract, ["TokensBurned"], "redemption_events", "VanellixRedemption"),
]
