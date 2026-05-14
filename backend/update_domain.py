import asyncio
from utils.web3mongo import db

res = db.delivery_providers.update_one(
    {"slug": "vanellix"},
    {"$set": {"domain": "http://127.0.0.1:8082"}}
)
print("Matched:", res.matched_count, "Modified:", res.modified_count)

