import requests
import subprocess
import tempfile
import os
import shutil
import time
from dotenv import load_dotenv
from datetime import datetime
import logging

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


def get_periodos_from_input():
    now = datetime.now()
    default = now.strftime("%Y%m")
    raw = input(f"Año (YYYY) o periodo (YYYYMM) [default: {default}]: ").strip()
    if not raw:
        return [default]
    if len(raw) == 4 and raw.isdigit():
        return [f"{raw}{str(m).zfill(2)}" for m in range(1, 13)]
    if len(raw) == 6 and raw.isdigit():
        return [raw]
    print("Input inválido. Usa YYYY o YYYYMM.")
    exit(1)


def main():
    OVPN_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), "mtz.ovpn"))
    VPN_USER = os.environ.get("VPN_USER")
    VPN_PASS = os.environ.get("VPN_PASS")
    periodos = get_periodos_from_input()
    auth_path = create_auth_file(VPN_USER, VPN_PASS)
    proc = None
    try:
        proc = connect_vpn(OVPN_PATH, auth_path)
        print("Esperando que la VPN levante...")
        if not wait_for_vpn(proc):
            print("No se pudo levantar la VPN.")
            return
        import sys
        sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..')))
        from utils.web3mongo import db
        col = db['recetas_productos']
        logging.basicConfig(level=logging.INFO, format='%(asctime)s %(levelname)s: %(message)s')
        for mesano in periodos:
            API_URL = f"http://192.168.4.117:8000/api/recetas-productos?mesano={mesano}"
            logging.info(f"Consultando API recetas-productos para mes/año {mesano}...")
            try:
                resp = requests.get(API_URL, timeout=30)
                logging.info(f"Status: {resp.status_code}")
                if resp.status_code == 200:
                    data = resp.json()
                    if isinstance(data, dict) and "data" in data:
                        data = data["data"]
                    logging.info(f"Recibidos {len(data)} registros. Borrando datos previos y actualizando en MongoDB...")
                    delete_result = col.delete_many({"mesano": mesano})
                    logging.info(f"Eliminados {delete_result.deleted_count} documentos del mesano {mesano}")
                    if data:
                        count = 0
                        for item in data:
                            if not isinstance(item, dict):
                                continue
                            prod = item.get("producto_codigo") or item.get("producto_cod") or ""
                            ing = item.get("ingrediente_codigo") or item.get("ingrediente_cod") or ""
                            linea = item.get("linea")
                            if not prod or not ing or linea is None:
                                # clave insuficiente, lo saltamos
                                continue
                            # clave única por producto-ingrediente-linea y mesano
                            item["_id"] = f"{prod}_{ing}_{linea}_{mesano}"
                            item["mesano"] = mesano
                            col.update_one({"_id": item["_id"]}, {"$set": item}, upsert=True)
                            count += 1
                        logging.info(f"Actualizados/insertados {count} registros en MongoDB para mesano {mesano}.")
                    else:
                        logging.warning(f"No hay registros para guardar en mesano {mesano}.")
                else:
                    logging.error(f"Error en request: {resp.status_code}")
            except Exception as e:
                logging.error(f"Error en request para mesano {mesano}: {e}")
    finally:
        if proc:
            proc.terminate()
        if os.path.exists(auth_path):
            os.unlink(auth_path)


if __name__ == "__main__":
    try:
        main()
    finally:
        # Cleanup handled in main
        pass
