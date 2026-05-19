import json
import urllib.request
import urllib.error
import time
from datetime import datetime

# ==============================================================================
# CONFIGURACIÓN DEL POS PICCOLA
# ==============================================================================
WEBHOOK_URL = "https://shopify.piccolaitalia.cl/api/ordenti_v2"
API_TOKEN = "Bearer "
HEADER_NAME = "Authorization"

timestamp = datetime.now().isoformat()
fixed_order_id = 1779167782

def create_payload():
    return {
        "order": {
            "order_id": fixed_order_id,
            "hash": "test_hash",
            "first_name": "Test",
            "last_name": "Alusa",
            "email": "test@piccolaitalia.cl",
            "status": {
                "color": "#32CD32",
                "status_id": 2,
                "created_at": timestamp,
                "status_for": "order",
                "updated_at": timestamp,
                "status_name": "Aceptada",
                "status_comment": "Lifecycle test",
                "notify_customer": False
            },
            "telephone": "+56900000000",
            "order_date_time": timestamp,
            "order_date": timestamp,
            "order_time": "12:00:00",
            "created_at": timestamp,
            "updated_at": timestamp,
            "order_type": "delivery",
            "payment": "webpayrest",
            "user_agent": "Vanellix",
            "ip_address": "127.0.0.1",
            "comment": "TEST WEBHOOK ALUSA LIFECYCLE",
            "location_id": 3,
            "location": {
                "location_id": 3,
                "location_city": "Santiago",
                "location_name": "PANLOC",
                "location_state": "Región Metropolitana",
                "permalink_slug": "PANLOC",
                "location_address": "Panamericana",
                "location_telephone": "+56229942084",
                "location_country_id": 43
            },
            "address_id": 26179,
            "address": {
                "latitude": "-33.45694000",
                "longitude": "-70.64827000",
                "address_id": 26179,
                "address_city": "Santiago",
                "address_alias": "Mi Casa",
                "address_state": "Metropolitana",
                "address_address": "Direccion Test",
                "address_postcode": "",
                "address_country_id": 43
            },
            "customer_id": 111728,
            "customer": {
                "email": "test@piccolaitalia.cl",
                "last_name": "Alusa",
                "telephone": "+56900000000",
                "first_name": "Test",
                "customer_id": 111728
            },
            "order_totals": [
                {"code": "subtotal", "title": "Sub Total", "value": 750, "priority": 1},
                {"code": "coupon", "title": "Descuento 100%", "value": -750, "priority": 2},
                {"code": "total", "title": "Total", "value": 0, "priority": 99}
            ]
        },
        "order_menus": [
            {
                "codigo": "9901900",
                "name": "9901900 ALUSA CHICA UN",
                "quantity": 1,
                "price": 750,
                "subtotal": 750,
                "comment": "SIN SAL!!! 000!!",
                "menu_options": []
            }
        ],
        "order_totals": [
            {"code": "subtotal", "title": "Sub Total", "value": 750, "priority": 1},
            {"code": "coupon", "title": "Descuento 100%", "value": -750, "priority": 2},
            {"code": "total", "title": "Total", "value": 0, "priority": 99}
        ]
    }

def send_request(payload, label):
    print(f"==================================================")
    print(f"🚀 ENVIANDO: {label}")
    print(f"==================================================")
    print(f"📦 Payload preparado:\n{json.dumps(payload, indent=2)}\n")
    
    headers = {
        "Content-Type": "application/json",
        "User-Agent": "Vanellix-Test/1.0"
    }
    
    if API_TOKEN and "PON_TU_TOKEN_AQUI" not in API_TOKEN:
        headers[HEADER_NAME] = API_TOKEN
        
    req = urllib.request.Request(
        WEBHOOK_URL,
        data=json.dumps(payload).encode("utf-8"),
        headers=headers,
        method="POST"
    )
    
    try:
        with urllib.request.urlopen(req) as response:
            status = response.status
            body = response.read().decode("utf-8")
            print(f"✅ ÉXITO! Status Node API: {status}")
            print(f"📝 Respuesta Node API:\n{body}\n")
    except urllib.error.HTTPError as e:
        print(f"❌ ERROR: Status {e.code}")
        print(f"Respuesta:\n{e.read().decode('utf-8')}\n")
    except urllib.error.URLError as e:
        print(f"❌ ERROR DE CONEXIÓN: No se pudo llegar a la URL. {e.reason}\n")

if __name__ == "__main__":
    if "tu-pos.piccolaitalia.cl" in WEBHOOK_URL:
        print("⚠️  ATENCIÓN: Debes modificar el archivo test_pos_webhook.py para poner la URL real.")
    else:
        # PASO ÚNICO: Mandamos la orden en status 2 / updated como genera Vanellix
        payload = create_payload()
        send_request(payload, f"ORDEN TEST ALUSA $0 (order_id: {fixed_order_id})")
