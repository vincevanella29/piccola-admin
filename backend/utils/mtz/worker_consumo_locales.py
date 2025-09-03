import requests
import subprocess
import tempfile
import os
import shutil
import time
from dotenv import load_dotenv
from datetime import datetime

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

def parse_fecha(fecha_str):
    # Convierte cualquier string de fecha a datetime.date (sin hora), o None si no puede
    if not fecha_str or not isinstance(fecha_str, str):
        return None
    from datetime import datetime
    for fmt in [
        "%a, %d %b %Y %H:%M:%S GMT",
        "%Y-%m-%dT%H:%M:%S",
        "%Y-%m-%dT%H:%M:%S.%fZ",
        "%Y-%m-%d %H:%M:%S",
        "%Y-%m-%d",
    ]:
        try:
            dt = datetime.strptime(fecha_str, fmt)
            return dt.replace(hour=0, minute=0, second=0, microsecond=0)
        except Exception:
            continue
    try:
        from dateutil.parser import parse
        dt = parse(fecha_str)
        return dt.replace(hour=0, minute=0, second=0, microsecond=0)
    except Exception:
        return None


def main():
    load_dotenv()
    OVPN_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), "mtz.ovpn"))
    VPN_USER = os.environ.get("VPN_USER")
    VPN_PASS = os.environ.get("VPN_PASS")
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
        API_URL = f"http://192.168.4.117:8000/api/consumo-segun-venta-todos-local?mesano={mesano}"
        print(f"Consultando API de consumo locales para {mesano}...")
        resp = requests.get(API_URL, timeout=60)
        print("Status:", resp.status_code)
        if resp.status_code == 200:
            data = resp.json().get("data", [])
            print(f"Recibidos {len(data)} registros. Procesando e insertando en MongoDB...")
            import sys
            sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..')))
            from utils.web3mongo import db
            # Artículos: upsert familia y subfamilia
            articulos_col = db['articulos_consumo']
            for d in data:
                articulo = d.get("articulo")
                familia = d.get("familia")
                subfamilia = d.get("subfamilia")
                if articulo:
                    articulos_col.update_one(
                        {"articulo": articulo},
                        {"$set": {"familia": familia, "subfamilia": subfamilia}},
                        upsert=True
                    )
            # Data cruda consumo
            consumo_col = db['consumo_locales']
            consumo_col.delete_many({"mesano": int(mesano)})
            from datetime import datetime
            for d in data:
                fecha = parse_fecha(d.get("fecha"))
                if fecha:
                    # Guarda solo como string YYYY-MM-DD
                    d["fecha"] = fecha.strftime("%Y-%m-%d")
                else:
                    d["fecha"] = None
                d["mesano"] = int(mesano)
            if data:
                consumo_col.insert_many(data)
                print(f"Insertados {len(data)} registros de consumo crudo y artículos actualizados.")
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
