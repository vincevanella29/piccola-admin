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


essentials = [
    "id",
    "cargo",
    "seccion",
]


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

        API_URL = "http://192.168.4.117:8000/api/cargosficha"
        print("Consultando API de cargos...")

        resp = requests.get(API_URL, timeout=60)
        print("Status:", resp.status_code)
        if resp.status_code == 200:
            raw = resp.json()
            # La API puede devolver una lista directa o un objeto con 'data'
            if isinstance(raw, dict) and "data" in raw:
                data = raw.get("data", [])
            else:
                data = raw if isinstance(raw, list) else []

            print(f"Recibidos {len(data)} cargos. Actualizando en MongoDB...")
            import sys
            sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..')))
            from utils.web3mongo import db

            col = db['cargos_mtz']
            # Crear índice por id si no existe
            try:
                col.create_index("id", unique=True)
            except Exception:
                pass

            now_iso = datetime.utcnow().isoformat()
            upserts = 0
            for item in data:
                if not isinstance(item, dict):
                    continue
                rec = {}
                # Conservar sólo campos esenciales conocidos para evitar basura
                for k in essentials:
                    if k in item:
                        rec[k] = item[k]
                # Seguridad: si falta id, saltar
                if rec.get("id") is None:
                    continue
                rec["last_sync_at"] = now_iso
                # Normalizar tipos simples
                try:
                    rec["id"] = int(rec["id"])
                except Exception:
                    pass
                if "cargo" in rec and isinstance(rec["cargo"], str):
                    rec["cargo"] = rec["cargo"].strip()
                if "seccion" in rec and isinstance(rec["seccion"], str):
                    rec["seccion"] = rec["seccion"].strip().lower()

                col.update_one({"id": rec["id"]}, {"$set": rec}, upsert=True)
                upserts += 1
            print(f"Upserts realizados: {upserts}")
        else:
            print("Error en request:", resp.status_code)
    except Exception as e:
        print("Error en worker cargos:", e)
    finally:
        if proc:
            proc.terminate()
        try:
            os.unlink(auth_path)
        except Exception:
            pass


if __name__ == "__main__":
    main()
