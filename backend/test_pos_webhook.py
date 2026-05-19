import json
import urllib.request
import urllib.error
import time
from datetime import datetime

# ==============================================================================
# CONFIGURACIÓN DEL POS PICCOLA
# ==============================================================================
# Cambia esta URL por el endpoint real de tu POS
WEBHOOK_URL = "https://shopify.piccolaitalia.cl/api/ordenti"

# Si tu POS usa un token de autorización, ponlo aquí
# Formato típico: "Bearer xyz123" o simplemente el token si va en un "x-api-key"
API_TOKEN = "Bearer PON_TU_TOKEN_AQUI"
HEADER_NAME = "Authorization" # Puede ser "x-api-key" u otro

# ==============================================================================
# PAYLOAD BASADO EN EL PRESET (PICCOLA_POS_TEMPLATE)
# ==============================================================================
# Usamos el item que enviaste: ALUSA CHICA UN (código 9901900)
# para que no tenga valor real y no afecte contabilidad.

timestamp = datetime.now().isoformat()

payload = {
    "action": "placed",
    "order": {
        "order_id": f"TEST-PI-{int(time.time())}",
        "customer_id": "TEST-CUST-001",
        "first_name": "Test Cliente",
        "last_name": "Prueba",
        "email": "test@piccolaitalia.cl",
        "telephone": "+56900000000",
        "location_id": "16", # Piccola Alameda (ajusta según local de prueba)
        "address_id": "",
        "total_items": 1,
        "comment": "ESTO ES UNA PRUEBA DE INTEGRACION WEBHOOK. FAVOR IGNORAR.",
        "payment": "card",
        "order_type": "delivery",
        "created_at": timestamp,
        "updated_at": timestamp,
        "order_time": "",
        "order_date": "",
        "order_total": 100, # Valor ficticio mínimo
        "status_id": 1,
        "ip_address": "127.0.0.1",
        "user_agent": "Vanellix Webhooks Test",
        "hash": "",
        "processed": True,
        "order_time_is_asap": True,
        "pedidosya_id": "",
        "customer_name": "Test Cliente Prueba",
        "order_type_name": "delivery",
        "formatted_address": "Avenida Alameda 123",
        "status": "pending",
        "status_name": "pending"
    },
    "order_menus": [
        {
            # Estos son los campos estándar que manda Vanellix por defecto.
            # Si el POS los requiere distinto (ej: "id", "producto", "precio"), 
            # modificamos el preset en WebhooksTab.jsx después.
            "codigo": "9901900",
            "nombre": "ALUSA CHICA UN", 
            "familia": "99 ADMINISTRACION     .",
            "subfamilia": "9901 VARIOS",
            "quantity": 1,
            "unit_price": 0,
            "modifiers": []
        }
    ],
    "order_totals": [
        {
            "code": "subtotal",
            "title": "Sub-total",
            "value": 100
        },
        {
            "code": "delivery",
            "title": "Entrega a Domicilio",
            "value": 0
        },
        {
            "code": "total",
            "title": "Total del Pedido",
            "value": 100
        }
    ]
}

def test_webhook():
    print("==================================================")
    print("🚀 PROBANDO WEBHOOK POS PICCOLA")
    print(f"📡 URL: {WEBHOOK_URL}")
    print("==================================================")
    
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
            print(f"✅ ÉXITO! El POS respondió con status: {status}")
            print(f"📝 Respuesta del POS:\n{body}")
    except urllib.error.HTTPError as e:
        print(f"❌ ERROR DEL POS: Status {e.code}")
        print(f"Respuesta del POS:\n{e.read().decode('utf-8')}")
    except urllib.error.URLError as e:
        print(f"❌ ERROR DE CONEXIÓN: No se pudo llegar a la URL. {e.reason}")

if __name__ == "__main__":
    if "tu-pos.piccolaitalia.cl" in WEBHOOK_URL:
        print("⚠️  ATENCIÓN: Debes modificar el archivo test_pos_webhook.py para poner la URL y API KEY reales de tu POS.")
    else:
        test_webhook()
