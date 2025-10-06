import requests
import subprocess
import tempfile
import os
import shutil
import time
from dotenv import load_dotenv
from datetime import datetime
from typing import List, Dict, Any
from pymongo import UpdateOne


def create_auth_file(username: str, password: str) -> str:
    tf = tempfile.NamedTemporaryFile(mode="w", delete=False)
    tf.write(f"{username}\n{password}\n")
    tf.close()
    return tf.name


def connect_vpn(ovpn_path: str, auth_path: str):
    base_cmd = ["openvpn", "--config", ovpn_path, "--auth-user-pass", auth_path]
    cmd = (["sudo"] + base_cmd) if shutil.which("sudo") else base_cmd
    proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
    return proc


def wait_for_vpn(proc, timeout: int = 30) -> bool:
    start = time.time()
    for line in proc.stdout:
        print(line, end="")
        if "Initialization Sequence Completed" in line:
            return True
        if time.time() - start > timeout:
            print("Timeout esperando VPN.")
            return False
    return False


def parse_fecha_to_date(fecha_str: Any):
    if not fecha_str:
        return None
    if isinstance(fecha_str, datetime):
        return fecha_str.replace(hour=0, minute=0, second=0, microsecond=0)
    if not isinstance(fecha_str, str):
        return None
    from datetime import datetime as dt
    for fmt in [
        "%a, %d %b %Y %H:%M:%S GMT",
        "%Y-%m-%dT%H:%M:%S",
        "%Y-%m-%dT%H:%M:%S.%fZ",
        "%Y-%m-%d %H:%M:%S",
        "%Y-%m-%d",
    ]:
        try:
            d = dt.strptime(fecha_str, fmt)
            return d.replace(hour=0, minute=0, second=0, microsecond=0)
        except Exception:
            continue
    try:
        from dateutil.parser import parse
        d = parse(fecha_str)
        return d.replace(hour=0, minute=0, second=0, microsecond=0)
    except Exception:
        return None


def _norm_local_sigla(loc: str) -> str:
    s = (loc or "").strip()
    return s[:-3] if s.endswith("LOC") else s


def main():
    load_dotenv()
    OVPN_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), "mtz.ovpn"))
    VPN_USER = os.environ.get("VPN_USER")
    VPN_PASS = os.environ.get("VPN_PASS")

    mesano_in = input("MesAño (YYYYMM) o Año (YYYY): ").strip()
    if not mesano_in:
        now = datetime.now()
        mesano_in = now.strftime("%Y%m")

    # Construir lista de periodos a procesar
    mesanos: List[str] = []
    if mesano_in.isdigit() and len(mesano_in) == 4:
        y = mesano_in
        mesanos = [f"{y}{m:02d}" for m in range(1, 13)]
        print(f"Procesando año completo {y}: {', '.join(mesanos)}")
    elif mesano_in.isdigit() and len(mesano_in) == 6:
        mesanos = [mesano_in]
    else:
        print("Entrada inválida. Use YYYYMM o YYYY.")
        return

    auth_path = create_auth_file(VPN_USER, VPN_PASS)
    proc = None
    try:
        proc = connect_vpn(OVPN_PATH, auth_path)
        print("Esperando que la VPN levante...")
        if not wait_for_vpn(proc):
            print("No se pudo levantar la VPN.")
            return

        # Preparar acceso a Mongo una sola vez
        import sys
        sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..')))
        from utils.web3mongo import db

        productos_col = db['articulos_restaurant']
        tiempos_col = db['ventas_producto_dia_hora_cprodu']

        for mesano in mesanos:
            API_URL = f"http://192.168.4.117:8000/api/ventas-producto-dia-hora-cprodu?mesano={mesano}"
            print(f"Consultando API de tiempos por producto para {mesano}...")
            try:
                resp = requests.get(API_URL, timeout=60)
            except Exception as e:
                print(f"Error consultando API para {mesano}:", e)
                continue
            print("Status:", resp.status_code)
            if resp.status_code != 200:
                print(f"Saltando {mesano}: HTTP {resp.status_code}")
                continue

            data = resp.json().get("data", [])
            total = len(data)
            print(f"Recibidos {total} registros para {mesano}. Procesando e insertando en MongoDB...")

            # 1) Upsert de catálogo de productos (por CODIGO)
            prod_map: Dict[str, Dict[str, Any]] = {}
            for d in data:
                codigo = str(d.get("CODIGO") or "").strip()
                if not codigo:
                    continue
                prod_map[codigo] = {
                    "producto": d.get("PRODUCTO"),
                    "familia": d.get("FAMILIA"),
                    "subfamilia": d.get("SUBFAMILIA"),
                }
            if prod_map:
                ops = [
                    UpdateOne({"codigo": code}, {"$set": vals}, upsert=True)
                    for code, vals in prod_map.items()
                ]
                try:
                    res_up = productos_col.bulk_write(ops, ordered=False)
                    print(
                        f"Productos upsert {mesano}: matched={res_up.matched_count} upserted={len(res_up.upserted_ids)} modified={res_up.modified_count}"
                    )
                except Exception as e:
                    print(f"bulk_write productos error en {mesano} (continuable):", e)

            # 2) Normalizar fechas y preparar docs
            parse_cache: Dict[str, str] = {}
            mesano_int = int(mesano)
            docs: List[Dict[str, Any]] = []
            for d in data:
                fraw = d.get("FECHA")
                if fraw in parse_cache:
                    f_norm = parse_cache[fraw]
                else:
                    dt = parse_fecha_to_date(fraw)
                    f_norm = dt.strftime("%Y-%m-%d") if dt else None
                    parse_cache[fraw] = f_norm

                local_raw = (d.get("LOCAL") or "").strip()
                loc = _norm_local_sigla(local_raw)

                doc = {
                    "mesano": mesano_int,
                    "fecha": f_norm,
                    "local": local_raw,
                    "local_norm": loc,
                    "hora": int(d.get("HORA") or 0),
                    "codigo": str(d.get("CODIGO") or "").strip(),
                    "producto": d.get("PRODUCTO"),
                    "familia": d.get("FAMILIA"),
                    "subfamilia": d.get("SUBFAMILIA"),
                    "centro_produccion": d.get("CENTROPRODUCCION"),
                    "cantidad": float(d.get("CANTIDAD") or 0),
                    "total": float(d.get("TOTAL") or 0),
                    "tiempo_promedio": float(d.get("TIEMPO_PROMEDIO") or 0),
                    "dia": d.get("DIA"),
                    "semana_mes": d.get("SEMANA-MES"),
                    "created_at": datetime.utcnow(),
                }
                docs.append(doc)

            # 3) Reemplazar data del mes en la colección destino
            if docs:
                try:
                    tiempos_col.delete_many({"mesano": mesano_int})
                except Exception:
                    pass
                try:
                    tiempos_col.insert_many(docs, ordered=False)
                except Exception as e:
                    print(f"insert_many error en {mesano} (continuable):", e)
                print(f"Insertados {len(docs)} registros para {mesano} en ventas_producto_dia_hora_cprodu.")

    except Exception as e:
        print("Error en worker:", e)
    finally:
        if proc:
            proc.terminate()
        os.unlink(auth_path)


if __name__ == "__main__":
    main()
