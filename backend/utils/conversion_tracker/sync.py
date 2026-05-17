import os
from typing import List, Dict, Any
from utils.web3mongo import db
from apis.conversion_tracker.trackers import public_provider

COMPANY_ID = int(os.getenv("COMPANY_ID", "1"))

def get_conversion_trackers_for_provider(provider_slug: str) -> List[Dict[str, Any]]:
    """
    Fetch public configuration for active conversion trackers that are
    assigned to the given provider_slug.
    If assigned_providers is empty, it means it's available to everyone by default.
    """
    providers = list(db.conversion_tracker_providers.find({
        "company_id": COMPANY_ID,
        "$or": [{"is_active": True}, {"is_active": {"$exists": False}}]
    }))

    public_providers = []
    for p in providers:
        assigned = p.get("assigned_providers", [])
        # If assigned_providers is empty, it's global.
        # Otherwise, check if the given provider_slug is in the list.
        if not assigned or provider_slug in assigned:
            public_providers.append(public_provider(p).dict())

    return public_providers
