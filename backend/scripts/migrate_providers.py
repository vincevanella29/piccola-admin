import logging
from utils.web3mongo import db

logger = logging.getLogger(__name__)

async def migrate_ecosystem_providers():
    """
    Automated startup migration:
    Moves legacy delivery and carta providers into the unified db.ecosystem_providers collection.
    """
    try:
        logger.info("[migration] Checking Ecosystem Providers migration...")
        
        delivery_coll = db.delivery_providers
        carta_coll = db.carta_providers
        ecosystem_coll = db.ecosystem_providers
        
        migrated_count = 0
        
        # Migrate Delivery Providers
        delivery_docs = list(delivery_coll.find({}))
        for doc in delivery_docs:
            if ecosystem_coll.find_one({"_id": doc["_id"]}):
                continue
                
            doc["ecosystem_type"] = "delivery"
            ecosystem_coll.insert_one(doc)
            migrated_count += 1
            logger.info(f"[migration] Migrated delivery provider: {doc.get('slug')}")
            
        # Migrate Carta Providers
        carta_docs = list(carta_coll.find({}))
        for doc in carta_docs:
            if ecosystem_coll.find_one({"_id": doc["_id"]}):
                continue
                
            doc["ecosystem_type"] = "carta"
            ecosystem_coll.insert_one(doc)
            migrated_count += 1
            logger.info(f"[migration] Migrated carta provider: {doc.get('slug')}")
            
        if migrated_count > 0:
            logger.info(f"[migration] Completed successfully. {migrated_count} providers migrated to ecosystem_providers.")
            
    except Exception as e:
        logger.error(f"[migration] ❌ Failed to migrate ecosystem providers: {e}")
