import asyncio
import os
from utils.web3mongo import db
from utils.vanellix_crypto import encrypt_b2b_mnemonic

def migrate():
    count_carta = 0
    count_delivery = 0
    
    # Carta Providers
    for prov in db.carta_providers.find({"dilithium_mnemonic": {"$exists": True, "$ne": ""}}):
        if not prov.get("dilithium_mnemonic_enc"):
            enc = encrypt_b2b_mnemonic(prov["dilithium_mnemonic"])
            db.carta_providers.update_one(
                {"_id": prov["_id"]},
                {"$set": {"dilithium_mnemonic_enc": enc}, "$unset": {"dilithium_mnemonic": ""}}
            )
        else:
            db.carta_providers.update_one(
                {"_id": prov["_id"]},
                {"$unset": {"dilithium_mnemonic": ""}}
            )
        count_carta += 1

    # Delivery Providers
    for prov in db.delivery_providers.find({"dilithium_mnemonic": {"$exists": True, "$ne": ""}}):
        if not prov.get("dilithium_mnemonic_enc"):
            enc = encrypt_b2b_mnemonic(prov["dilithium_mnemonic"])
            db.delivery_providers.update_one(
                {"_id": prov["_id"]},
                {"$set": {"dilithium_mnemonic_enc": enc}, "$unset": {"dilithium_mnemonic": ""}}
            )
        else:
            db.delivery_providers.update_one(
                {"_id": prov["_id"]},
                {"$unset": {"dilithium_mnemonic": ""}}
            )
        count_delivery += 1
        
    print(f"Migrated {count_carta} carta providers and {count_delivery} delivery providers.")

if __name__ == "__main__":
    migrate()
