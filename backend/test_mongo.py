import asyncio
from utils.web3mongo import db
print("Active providers:")
for p in db.delivery_providers.find({"status": "active"}):
    print("- Slug:", p.get("slug"), "| Domain:", p.get("domain"))
