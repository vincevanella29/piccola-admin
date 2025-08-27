import requests
import subprocess
import tempfile
import os
import shutil
import time
from dotenv import load_dotenv
from datetime import datetime

load_dotenv()


def create_auth_file(username, password):
    tf = tempfile.NamedTemporaryFile(mode="w", delete=False)
    tf.write(f"{username}\n{password}\n")
    tf.close()
    return tf.name


def connect_vpn(ovpn_path, auth_path):
    base_cmd = ["openvpn", "--config", ovpn_path, "--auth-user-pass", auth_path]
    cmd = (["sudo"] + base_cmd) if shutil.which("sudo") else base_cmd
    proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
    return proc


def wait_for_vpn(proc, timeout=30):
    start = time.time()
    for line in proc.stdout:
        print(line, end="")
        if "Initialization Sequence Completed" in line:
            return True
        if time.time() - start > timeout:
            print("Timeout esperando VPN.")
            return False
    return False


def main():
    OVPN_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), "mtz.ovpn"))
    VPN_USER = os.environ.get("VPN_USER")
    VPN_PASS = os.environ.get("VPN_PASS")

    auth_path = create_auth_file(VPN_USER, VPN_PASS)
    proc = None
    try:
        proc = connect_vpn(OVPN_PATH, auth_path)
        print("Esperando que la VPN levante...")
        if not wait_for_vpn(proc):
            print("No se pudo levantar la VPN.")
            return

        API_URL = "http://192.168.4.117:8000/api/sucursales"
        print("Consultando API de sucursales...")

        resp = requests.get(API_URL, timeout=60)
        print("Status:", resp.status_code)
        if resp.status_code == 200:
            raw = resp.json()
            # La API puede devolver una lista directa o un objeto con 'data'
            if isinstance(raw, dict) and "data" in raw:
                data = raw.get("data", [])
            else:
                data = raw if isinstance(raw, list) else []

            print(f"Recibidas {len(data)} sucursales. Actualizando en MongoDB...")
            import sys
            sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..')))
            from utils.web3mongo import db

            col = db['sucursales_mtz']
            # Crear índice por id si no existe
            try:
                col.create_index("id", unique=True)
            except Exception:
                pass

            # Cargar locations para merge por permalink_slug
            locations = list(db['locations'].find({}, {
                "_id": 1,
                "nombre": 1,
                "direccion": 1,
                "email": 1,
                "city": 1,
                "state": 1,
                "postcode": 1,
                "telephone": 1,
                "lat": 1,
                "lng": 1,
                "status": 1,
                "permalink_slug": 1,
                "media_ids": 1,
                "menu_ids": 1,
                "created_at": 1,
                "updated_at": 1,
            }))
            loc_by_slug = {}
            for loc in locations:
                slug = loc.get("permalink_slug")
                if not slug:
                    continue
                # Normalizar _id a string para evitar problemas de serialización
                loc_norm = dict(loc)
                if "_id" in loc_norm:
                    try:
                        loc_norm["_id"] = str(loc_norm["_id"])
                    except Exception:
                        pass
                loc_by_slug[slug] = loc_norm

            now_iso = datetime.utcnow().isoformat()
            upserts = 0
            for item in data:
                # Asegurar estructura mínima y normalizaciones simples
                if not isinstance(item, dict):
                    continue
                rec = dict(item)
                rec["last_sync_at"] = now_iso
                # Propagar permalink_slug desde sigla_local (si existe)
                if rec.get("sigla_local") and not rec.get("permalink_slug"):
                    rec["permalink_slug"] = rec.get("sigla_local")
                # Merge con location
                slug = rec.get("permalink_slug") or rec.get("sigla_local")
                if slug:
                    loc = loc_by_slug.get(slug)
                    if loc:
                        # Guardar subdocumento 'location' con campos relevantes
                        rec["location"] = {
                            k: loc.get(k)
                            for k in [
                                "_id",
                                "nombre",
                                "direccion",
                                "email",
                                "city",
                                "state",
                                "postcode",
                                "telephone",
                                "lat",
                                "lng",
                                "status",
                                "permalink_slug",
                                "media_ids",
                                "menu_ids",
                                "created_at",
                                "updated_at",
                            ]
                        }
                suc_id = rec.get("id")
                if suc_id is None:
                    continue
                col.update_one({"id": suc_id}, {"$set": rec}, upsert=True)
                upserts += 1
            print(f"Upserts realizados: {upserts}")
        else:
            print("Error en request:", resp.status_code)
    except Exception as e:
        print("Error en request:", e)
    finally:
        if proc:
            proc.terminate()
        os.unlink(auth_path)


if __name__ == "__main__":
    main()
