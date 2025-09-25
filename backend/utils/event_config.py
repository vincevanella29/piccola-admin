from utils.web3mongo import launchpad_contract, company_contract, staking_contract, token_factory_contract, dao_contract, global_meritocracy_contract
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
    EventListenerConfig(staking_contract, ["UtilityTokenFinalized", "AnnualRewardFixed", "StakingConfigFinalized", "TotalRewardPercentageUpdated"], "staking_events", "VanellixStakingMultiToken"),
    # GlobalMeritocracy event stream
    EventListenerConfig(global_meritocracy_contract, [
        "TokensMinted", "HolderAdded", "MintBatchProcessed", "FastBannerSet",
        "TokenCreated", "AllowedDAOUpdated"
    ], "global_meritocracy_events", "GlobalMeritocracy"),
    # DAO Controller event stream (store in its own collection)
    EventListenerConfig(dao_contract, [
        "ProposalCreated", "ProposalExecuted", "VoteCast",
        "UserBanStatusChanged", "QuorumPercentageUpdated", "FastMinterSet", "FastBannerUpdated"
    ], "dao_events", "VanellixDAOController")
]
