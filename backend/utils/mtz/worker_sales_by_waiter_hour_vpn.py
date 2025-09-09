import subprocess
import tempfile
import os
import shutil
import requests
import time
from datetime import datetime
from dotenv import load_dotenv
from concurrent.futures import ThreadPoolExecutor, as_completed
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry
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
    mesano_input = input("Mes/Año (YYYYMM o YYYY, vacío = mes actual): ").strip()
    if not mesano_input:
        mesano_input = datetime.now().strftime("%Y%m")

    # Construir lista de mesanos a procesar
    mesanos = []
    if len(mesano_input) == 6 and mesano_input.isdigit():
        mesanos = [mesano_input]
    elif len(mesano_input) == 4 and mesano_input.isdigit():
        year = int(mesano_input)
        mesanos = [f"{year}{m:02d}" for m in range(1, 13)]
    else:
        print("Formato inválido. Usa YYYYMM o YYYY.")
        return

    auth_path = create_auth_file(VPN_USER, VPN_PASS)
    proc = None
    try:
        proc = connect_vpn(OVPN_PATH, auth_path)
        print("Esperando que la VPN levante...")
        if not wait_for_vpn(proc):
            print("No se pudo levantar la VPN.")
            return

        print("¡VPN arriba! Descargando sales-by-waiter-hour para todas las sucursales activas...")
        import sys
        sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..')))
        from utils.web3mongo import db
        # Carga todos los trabajadores en memoria para merge ultra rápido
        trabajadores = list(db['trabajadores_vpn'].find({}, {"rut": 1, "nombres": 1, "apellidopaterno": 1, "apellidomaterno": 1, "cargo": 1, "profile_image_url": 1}))
        trabajadores_dict = {}
        for t in trabajadores:
            rut = t.get("rut")
            if rut is None:
                continue
            # Guardar como string siempre
            try:
                trabajadores_dict[str(rut)] = t
            except Exception:
                pass
            # Guardar como int si aplica
            try:
                trabajadores_dict[int(rut)] = t
            except Exception:
                pass
        locations = list(db['locations'].find({"status": True}))
        print(f"Encontradas {len(locations)} sucursales activas.")
        sales_col = db['sales_by_waiter_hour']

        # Sesión compartida con pool grande y retries para acelerar y ser robustos
        session = requests.Session()
        retries = Retry(total=3, backoff_factor=0.3, status_forcelist=[429, 500, 502, 503, 504])
        adapter = HTTPAdapter(max_retries=retries, pool_connections=100, pool_maxsize=100)
        session.mount('http://', adapter)
        session.mount('https://', adapter)

        def process_local(loc, mesano):
            local_code = (loc.get("permalink_slug") or "")[:3].upper()
            if not local_code:
                return (local_code, 0, 0, "skip")
            target_url = f"http://192.168.4.117:8000/api/sales-by-waiter-hour?mesano={mesano}&local={local_code}"
            try:
                resp = session.get(target_url, timeout=30)
                if resp.status_code != 200:
                    return (local_code, 0, 0, f"status {resp.status_code}")
                payload = resp.json() or {}
                data = payload.get("data", []) or []
                # Enriquecer con trabajador_resumen
                for d in data:
                    rut = d.get("RUT")
                    trabajador = None
                    if rut is not None:
                        trabajador = trabajadores_dict.get(rut) or trabajadores_dict.get(str(rut))
                    if trabajador:
                        d["trabajador_resumen"] = {
                            "rut": trabajador.get("rut"),
                            "nombres": trabajador.get("nombres"),
                            "apellidopaterno": trabajador.get("apellidopaterno"),
                            "apellidomaterno": trabajador.get("apellidomaterno"),
                            "cargo": trabajador.get("cargo"),
                            "profile_image_url": trabajador.get("profile_image_url"),
                        }
                    d["MESANO"] = int(mesano)
                    d["LOCAL"] = local_code + "LOC"
                # Borrar e insertar en bloque
                del_res = sales_col.delete_many({"MESANO": int(mesano), "LOCAL": local_code+"LOC"})
                ins_count = 0
                if data:
                    try:
                        sales_col.insert_many(data, ordered=False)
                        ins_count = len(data)
                    except Exception as e:
                        return (local_code, del_res.deleted_count, ins_count, f"insert_many error: {e}")
                return (local_code, del_res.deleted_count, ins_count, "ok")
            except Exception as e:
                return (local_code, 0, 0, f"error: {e}")

        for mesano in mesanos:
            print(f"\n==== Procesando MESANO {mesano} ====")
            max_workers = max(4, min(16, len(locations)))
            with ThreadPoolExecutor(max_workers=max_workers) as executor:
                futures = {executor.submit(process_local, loc, mesano): loc for loc in locations}
                for fut in as_completed(futures):
                    loc = futures[fut]
                    local_code = (loc.get("permalink_slug") or "")[:3].upper()
                    try:
                        code, deleted, inserted, status = fut.result()
                        name = loc.get('nombre')
                        if status == "ok":
                            print(f"{local_code} ({name}) | Eliminados: {deleted} | Insertados: {inserted}")
                        elif status == "skip":
                            print(f"{local_code} ({name}) | Saltado (código local vacío)")
                        else:
                            print(f"{local_code} ({name}) | Aviso: {status}")
                    except Exception as e:
                        print(f"{local_code} | Error procesando: {e}")
    finally:
        if proc:
            proc.terminate()
        os.unlink(auth_path)

if __name__ == "__main__":
    main()
