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
    VPN_USER = os.environ.get("VPN_USER") or "lucciano"
    VPN_PASS = os.environ.get("VPN_PASS") or "Vanellix24"
    mesano = input("MesAño (YYYYMM): ").strip()
    if not mesano:
        now = datetime.now()
        mesano = now.strftime("%Y%m")

    auth_path = create_auth_file(VPN_USER, VPN_PASS)
    proc = None
    try:
        proc = connect_vpn(OVPN_PATH, auth_path)
        print("Esperando que la VPN levante...")
        if not wait_for_vpn(proc):
            print("No se pudo levantar la VPN.")
            return

        API_URL = f"http://192.168.4.117:8000/api/ventas-locales?mesano={mesano}"
        print(f"Consultando API de ventas locales para {mesano}...")

        resp = requests.get(API_URL, timeout=60)
        print("Status:", resp.status_code)
        if resp.status_code == 200:
            data = resp.json().get("data", [])
            print(f"Recibidos {len(data)} registros. Borrando e insertando en MongoDB...")
            import sys
            sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..')))
            from utils.web3mongo import db
            ventas_col = db['ventas_locales']
            # Filtrar duplicados: solo un registro por local y fecha
            unique = {}
            for d in data:
                key = (d.get("local"), d.get("fecha"))
                if key not in unique:
                    unique[key] = d
            filtered_data = list(unique.values())
            ventas_col.delete_many({"mesano": int(mesano)})
            if filtered_data:
                ventas_col.insert_many(filtered_data)
            print(f"Insertados {len(filtered_data)} registros únicos (por local y fecha) en MongoDB.")
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