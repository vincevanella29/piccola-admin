import requests
import subprocess
import tempfile
import os
import shutil
import time
from dotenv import load_dotenv
from datetime import datetime
from pymongo import UpdateOne

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
            total = len(data)
            print(f"Recibidos {total} registros. Procesando e insertando en MongoDB...")
            import sys
            sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..')))
            from utils.web3mongo import db

            # Colecciones
            articulos_col = db['articulos_consumo']
            consumo_col = db['consumo_locales']

            # 1) Upsert masivo de artículos con bulk_write (reduce roundtrips)
            #    Usamos el último valor visto para familia/subfamilia por artículo
            articulos_map = {}
            for d in data:
                art = d.get("articulo")
                if not art:
                    continue
                articulos_map[art] = {
                    "familia": d.get("familia"),
                    "subfamilia": d.get("subfamilia"),
                }
            if articulos_map:
                ops = [
                    UpdateOne({"articulo": art}, {"$set": vals}, upsert=True)
                    for art, vals in articulos_map.items()
                ]
                # ordered=False para paralelizar en el servidor y ser tolerantes a errores puntuales
                res_up = articulos_col.bulk_write(ops, ordered=False)
                print(
                    f"Artículos upsert: matched={res_up.matched_count} upserted={len(res_up.upserted_ids)} modified={res_up.modified_count}"
                )

            # 2) Normalizar fechas con cache y preparar docs para inserción masiva
            parse_cache = {}
            mesano_int = int(mesano)
            docs = []
            for d in data:
                fstr = d.get("fecha")
                if fstr in parse_cache:
                    f_norm = parse_cache[fstr]
                else:
                    dt = parse_fecha(fstr)
                    f_norm = dt.strftime("%Y-%m-%d") if dt else None
                    parse_cache[fstr] = f_norm
                d["fecha"] = f_norm
                d["mesano"] = mesano_int
                docs.append(d)

            # 3) Reemplazar data del mes con insert_many rápido
            if docs:
                consumo_col.delete_many({"mesano": mesano_int})
                try:
                    consumo_col.insert_many(docs, ordered=False)
                except Exception as e:
                    # Si falla por duplicados u otros, loguear y continuar
                    print("insert_many error (continuable):", e)
                print(f"Insertados {len(docs)} registros de consumo crudo y artículos actualizados.")
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
