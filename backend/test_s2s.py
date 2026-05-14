import asyncio
import websockets
import json
import time, uuid
from utils.vanellix_crypto import generate_dilithium_keypair, sign_dilithium

async def main():
    uri = "ws://127.0.0.1:8082/api/delivery-chat/s2s-tunnel"
    try:
        async with websockets.connect(uri) as ws:
            payload = {"timestamp": time.time(), "nonce": uuid.uuid4().hex}
            body_bytes = json.dumps(payload, separators=(",", ":"), sort_keys=True).encode()
            kp = generate_dilithium_keypair()
            sig_hex = sign_dilithium(bytes.fromhex(kp["sk_hex"]), body_bytes)
            
            auth_msg = {
                "type": "s2s_auth",
                "payload": payload,
                "signature": sig_hex,
                "public_key": kp["pk_hex"]
            }
            await ws.send(json.dumps(auth_msg))
            resp = await ws.recv()
            print("Response:", resp)
            
            await ws.send(json.dumps({
                "type": "admin_reply",
                "order_number": "PI-335B6A8A",
                "role": "admin",
                "content": "hola from test",
                "sender_name": "Test"
            }))
            print("Message sent")
            await asyncio.sleep(1)
    except Exception as e:
        print("Error:", e)

asyncio.run(main())
