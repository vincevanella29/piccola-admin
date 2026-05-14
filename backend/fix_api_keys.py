from utils.web3mongo import db

for key in db.api_keys.find({"owner": {"$exists": False}}):
    created_by = key.get("created_by", "")
    db.api_keys.update_one(
        {"_id": key["_id"]},
        {"$set": {"owner": created_by, "company_id": 1}}
    )
    print(f"Fixed key {key['_id']}")
