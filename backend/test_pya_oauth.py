import json
import urllib.request
import urllib.error
import time

# CREDENCIALES DE PEDIDOSYA
CLIENT_ID = "courier_404741_cl"
CLIENT_SECRET = "1778893833"
USERNAME = "404741-yfusy@courierapi.com"
PASSWORD = "0dwko2s2026"

def get_oauth_token():
    print("==================================================")
    print("🔑 PASO 0: OBTENER TOKEN OAUTH DINÁMICO")
    print("==================================================")
    
    url = "https://auth-api.pedidosya.com/v1/token"
    payload = {
        "grant_type": "password",
        "client_id": CLIENT_ID,
        "client_secret": CLIENT_SECRET,
        "username": USERNAME,
        "password": PASSWORD
    }
    
    # IMPORTANTE: El token request en v2 de PedidosYa requiere JSON
    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/120.0.0.0 Safari/537.36"
        },
        method="POST"
    )
    
    try:
        with urllib.request.urlopen(req) as response:
            data = json.loads(response.read().decode("utf-8"))
            token = data.get("access_token")
            print(f"✅ ÉXITO! Token obtenido: {token[:15]}... (oculto por seguridad)")
            return token
    except urllib.error.HTTPError as e:
        print(f"❌ ERROR OBTENIENDO TOKEN: {e.code}")
        print(e.read().decode("utf-8"))
        return None

def create_shipping(token):
    print("\n==================================================")
    print("🚀 PASO 1: CREAR ORDEN (PREORDER) CON OAUTH TOKEN")
    print("==================================================")
    
    url = "https://courier-api.pedidosya.com/v2/shippings"
    headers = {
        "Authorization": token,
        "Content-Type": "application/json",
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/120.0.0.0 Safari/537.36"
    }
    
    payload = {
        "referenceId": "test_oauth_123",
        "isTest": False,
        "items": [{"description": "Fontana Di Pasta", "quantity": 1, "value": 13990}],
        "waypoints": [
            {
                "type": "PICK_UP",
                "addressStreet": "Av. Ricardo Lyon 227",
                "city": "Providencia",
                "latitude": -33.424013990422,
                "longitude": -70.60953004198,
                "name": "Piccola Providencia",
                "phone": "+56900000000"
            },
            {
                "type": "DROP_OFF",
                "addressStreet": "Avenida Ricardo Lyon 230",
                "city": "Providencia",
                "latitude": -33.425,
                "longitude": -70.608,
                "name": "Cliente Test",
                "phone": "+56911111111"
            }
        ]
    }
    
    req = urllib.request.Request(
        url, 
        data=json.dumps(payload).encode("utf-8"), 
        headers=headers,
        method="POST"
    )
    try:
        with urllib.request.urlopen(req) as response:
            body = json.loads(response.read().decode("utf-8"))
            print(f"✅ ÉXITO! La orden se creó en estado: {body.get('status')}")
            print(f"ID de PedidosYa: {body.get('id')}")
            return body.get('id')
    except urllib.error.HTTPError as e:
        print(f"❌ ERROR: {e.code}")
        print(e.read().decode("utf-8"))
        return None

def confirm_shipping(token, shipping_id):
    print("\n==================================================")
    print(f"🚀 PASO 2: CONFIRMAR LA ORDEN {shipping_id}")
    print("==================================================")
    
    url = f"https://courier-api.pedidosya.com/v2/shippings/{shipping_id}/confirm"
    headers = {
        "Authorization": token,
        "Content-Type": "application/json",
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/120.0.0.0 Safari/537.36"
    }
    
    confirm_payload = {"type": "ON_DEMAND"}
    req = urllib.request.Request(
        url, 
        data=json.dumps(confirm_payload).encode("utf-8"), 
        headers=headers,
        method="POST"
    )
    
    try:
        with urllib.request.urlopen(req) as response:
            status = response.status
            body = json.loads(response.read().decode("utf-8"))
            print(f"✅ CONFIRMADA! Status: {status}")
            print(f"Estado de la orden ahora: {body.get('status')}")
            print("¡¡FUNCIONA!!")
            return True
    except urllib.error.HTTPError as e:
        print(f"❌ FALLÓ LA CONFIRMACIÓN! Status: {e.code}")
        print(f"Respuesta de PedidosYa: {e.read().decode('utf-8')}")
        return False

def cancel_shipping(token, shipping_id):
    print("\n==================================================")
    print(f"🗑️ PASO 3: CANCELAR LA ORDEN {shipping_id}")
    print("==================================================")
    
    # Nota: PedidosYa usa POST o DELETE para cancelar dependiendo de la API.
    # En V2 generalmente es POST /shippings/{id}/cancel
    url = f"https://courier-api.pedidosya.com/v2/shippings/{shipping_id}/cancel"
    headers = {
        "Authorization": token,
        "Content-Type": "application/json",
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/120.0.0.0 Safari/537.36"
    }
    
    cancel_payload = {"reasonText": "test order cancellation"}
    req = urllib.request.Request(
        url, 
        data=json.dumps(cancel_payload).encode("utf-8"), 
        headers=headers,
        method="POST"
    )
    
    try:
        with urllib.request.urlopen(req) as response:
            status = response.status
            print(f"✅ ORDEN CANCELADA EXITOSAMENTE! Status: {status}")
    except urllib.error.HTTPError as e:
        print(f"❌ FALLÓ LA CANCELACIÓN! Status: {e.code}")
        print(f"Respuesta: {e.read().decode('utf-8')}")

if __name__ == "__main__":
    # Flujo Completo
    token = get_oauth_token()
    if token:
        time.sleep(1)
        shipping_id = create_shipping(token)
        
        if shipping_id:
            time.sleep(1)
            confirmed = confirm_shipping(token, shipping_id)
            
            if confirmed:
                time.sleep(2)
                cancel_shipping(token, shipping_id)
