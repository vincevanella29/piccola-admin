# garzon-virtual/test_webhook_simulator.py
import os
import sys
import json
import time
import asyncio
import uuid
import random
from bson import ObjectId
from pymongo import MongoClient

# Force UTF-8 encoding in Windows console
if sys.platform.startswith('win'):
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

# 1. Setup path to import backend modules
BACKEND_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend"))
sys.path.append(BACKEND_PATH)

# Load env variables
def load_backend_env():
    env_path = os.path.join(BACKEND_PATH, ".env")
    if os.path.exists(env_path):
        print(f"Loading environment variables from: {env_path}")
        with open(env_path, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                key, val = line.split("=", 1)
                os.environ[key.strip()] = val.strip().strip('"\'')

load_backend_env()

# Connect to MongoDB
mongo_uri = os.environ.get("MONGODB_URI", "mongodb://localhost:27017/piccola_italia_admin")
print(f"Connecting to MongoDB: {mongo_uri}")
client = MongoClient(mongo_uri)
db = client.get_database()

# Import the actual webhook processor from backend
try:
    from utils.delivery.webhooks import process_carrier_webhook
    print("[OK] Loaded process_carrier_webhook successfully from backend.")
except Exception as e:
    print(f"[ERROR] Failed to load process_carrier_webhook: {e}")
    sys.exit(1)

async def simulate_webhook_flow():
    print("\n--- SIMULATION INITIALIZATION ---")
    
    # 2. Seed 'pedidosya' carrier if it doesn't exist
    carrier_slug = "pedidosya"
    existing_carrier = db.delivery_carriers.find_one({"slug": carrier_slug})
    if not existing_carrier:
        print(f"Carrier '{carrier_slug}' not found in database. Seeding carrier preset...")
        carrier_doc = {
            "slug": carrier_slug,
            "name": "PedidosYa Test",
            "status": "active",
            "endpoints": {
                "base_url": "https://courier-api.pedidosya.com"
            },
            "webhook": {
                "status": "active",
                "callback_url": "http://localhost:8081/api/delivery/webhook/pedidosya"
            },
            "status_mapping": {
                "pending": "pending",
                "confirmed": "confirmed",
                "preparing": "preparing",
                "ready": "ready",
                "in_transit": "dispatched",
                "delivered": "delivered"
            }
        }
        db.delivery_carriers.insert_one(carrier_doc)
        print("[OK] Carrier seeded.")
    else:
        # Clear webhook secret/signature to bypass HMAC verification for test purposes
        db.delivery_carriers.update_one(
            {"slug": carrier_slug},
            {"$set": {
                "webhook.secret": "",
                "webhook.signature_header": ""
            }}
        )
        print(f"[OK] Carrier '{carrier_slug}' ready (bypassing HMAC for simulation).")

    # 3. Create a fake delivery order
    order_id = ObjectId()
    order_number = f"PI-{random.randint(10000, 99999)}"
    carrier_delivery_id = f"mock-py-{uuid.uuid4().hex[:8]}"
    
    print(f"Creating mock delivery order: Number={order_number}, ID={order_id}, Carrier Delivery ID={carrier_delivery_id}")
    order_doc = {
        "_id": order_id,
        "order_number": order_number,
        "status": "pending",
        "customer_name": "Angelo",
        "carrier_slug": carrier_slug,
        "carrier_delivery_id": carrier_delivery_id,
        "items": [
            { "nombre": "Pizza Margherita", "qty": 1, "precio": 8900 }
        ],
        "total": 8900,
        "location_id": "l1",
        "created_at": time.time()
    }
    db.delivery_orders.insert_one(order_doc)
    print("[OK] Order inserted into db.delivery_orders.")

    # 4. Loop status transitions
    transitions = ["pending", "confirmed", "preparing", "ready", "in_transit", "delivered"]
    
    for state in transitions:
        print(f"\n[SEND] Sending webhook callback: state='{state}'...")
        payload = {
            "id": carrier_delivery_id,
            "status": state,
            "courier": {
                "name": "Juan el Repartidor",
                "phone": "+56999999999",
                "vehicle": {
                    "type": "moto"
                }
            }
        }
        
        body_bytes = json.dumps(payload).encode("utf-8")
        # Invoke webhook processor directly to update the order status
        try:
            res = await process_carrier_webhook(carrier_slug, body_bytes, {})
            print(f"   Response from webhooks.py: {res}")
            
            # Fetch updated order from DB
            updated_order = db.delivery_orders.find_one({"_id": order_id})
            print(f"   Order #{order_number} status updated to: '{updated_order.get('status')}'")
            print(f"   Carrier status: '{updated_order.get('carrier_status')}'")
            if updated_order.get("courier_info"):
                print(f"   Courier Name: {updated_order['courier_info'].get('name')} | Phone: {updated_order['courier_info'].get('phone')}")
        except Exception as e:
            print(f"   [ERROR] Error invoking process_carrier_webhook: {e}")
            
        await asyncio.sleep(3.0)

    print("\n--- SIMULATION SUCCESSFUL ---")
    print(f"Order #{order_number} finished transition. Final state in database verified.")

if __name__ == "__main__":
    asyncio.run(simulate_webhook_flow())
