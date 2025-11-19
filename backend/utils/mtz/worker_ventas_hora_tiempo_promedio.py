import subprocess
import tempfile
import os
import shutil
import requests
import time
import sys
from dotenv import load_dotenv
from datetime import datetime
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry
from typing import List, Dict, Any, Optional, Union
import unicodedata
from pymongo import UpdateOne


# --- VPN helpers ---
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
    start_time = time.time()
    for line in proc.stdout:
        print(line, end="")
        if "Initialization Sequence Completed" in line:
            return True
        if time.time() - start_time > timeout:
            print("Timeout esperando la conexión VPN.")
            return False
    return False


# --- HTTP session with retries ---
def build_session() -> requests.Session:
    s = requests.Session()
    retries = Retry(
        total=5,
        connect=5,
        read=5,
        backoff_factor=0.5,
        status_forcelist=[429, 500, 502, 503, 504],
        allowed_methods=["GET"],
        raise_on_status=False,
    )
    adapter = HTTPAdapter(max_retries=retries, pool_connections=50, pool_maxsize=50)
    s.mount("http://", adapter)
    s.mount("https://", adapter)
    s.headers.update({
        "User-Agent": "mtz-vpn-worker/1.0",
        "Accept": "application/json",
        "Connection": "keep-alive",
    })
    return s


def fetch_json_with_retries(
    url: str,
    *,
    session: requests.Session,
    retries: int = 3,
    timeout: tuple[int, int] = (5, 45),
    backoff: float = 2.0
):
    attempt = 0
    last_err = None
    while attempt < retries:
        attempt += 1
        try:
            start = time.time()
            resp = session.get(url, timeout=timeout)
            elapsed = time.time() - start
            if resp.status_code == 200:
                print(f"     OK HTTP 200 en {elapsed:.2f}s")
                return resp.json()
            else:
                last_err = RuntimeError(f"Status {resp.status_code}")
                print(f"     ERROR HTTP intento {attempt}/{retries}: {last_err} (t={elapsed:.2f}s)")
        except requests.exceptions.RequestException as e:
            last_err = e
            print(f"     ERROR de conexión intento {attempt}/{retries}: {e}")
        if attempt < retries:
            sleep_s = backoff ** (attempt - 1)
            print(f"     Reintentando en {sleep_s:.1f}s...")
            time.sleep(sleep_s)
    raise last_err if last_err else RuntimeError("Fallo desconocido en fetch_json_with_retries")


# --- Helpers catálogo Centros de Producción ---
def slugify(text: str) -> str:
    """
    Slug determinístico (minúsculas, sin tildes), apto para claves.
    """
    text = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode("ascii")
    out = []
    prev_dash = False
    for ch in text.lower():
        if ch.isalnum():
            out.append(ch)
            prev_dash = False
        else:
            if not prev_dash:
                out.append("-")
                prev_dash = True
    slug = "".join(out).strip("-")
    return slug


def normalize_nombre(text: str) -> str:
    """
    Normalización para índice único: TRIM + COLLAPSE spaces + UPPER.
    """
    text = " ".join((text or "").strip().split())
    return text.upper()


def ensure_centros_indexes(cp_coll):
    # índice único por nombre normalizado para evitar duplicados por espacios/casos
    cp_coll.create_index([("nombre_norm", 1)], unique=True)
    # índice útil para búsquedas por slug
    cp_coll.create_index([("slug", 1)], unique=True)


def upsert_centros_produccion(
    cp_coll,
    rows: List[Dict[str, Any]],
    mesano: Union[int, str]
) -> None:
    """
    Extrae todos los CENTROPRODUCCION del payload y hace upsert en la colección
    'centros_produccion'. Mantiene campos: nombre (original), nombre_norm, slug,
    activo, created_at, updated_at, last_seen_mesano.
    """
    now = datetime.utcnow()
    centros: set[str] = set()

    for d in rows:
        c = d.get("CENTROPRODUCCION")
        if not c:
            continue
        c = " ".join(str(c).strip().split())
        if c:
            centros.add(c)

    if not centros:
        print("     [centros_produccion] No hay CENTROPRODUCCION nuevos en este payload.")
        return

    ops: List[UpdateOne] = []
    for nombre in sorted(centros):
        nombre_norm = normalize_nombre(nombre)
        slug = slugify(nombre_norm)
        ops.append(
            UpdateOne(
                {"nombre_norm": nombre_norm},
                {
                    "$setOnInsert": {
                        "nombre": nombre,
                        "nombre_norm": nombre_norm,
                        "slug": slug,
                        "activo": True,
                        "created_at": now,
                    },
                    "$set": {
                        "updated_at": now,
                        "last_seen_mesano": int(mesano) if str(mesano).isdigit() else mesano,
                    },
                },
                upsert=True,
            )
        )

    if not ops:
        return

    try:
        res = cp_coll.bulk_write(ops, ordered=False)
        upserts = getattr(res, "upserted_count", 0) or 0
        print(f"     [centros_produccion] upserts nuevos: {upserts} (total procesados: {len(ops)})")
    except Exception as e:
        # Si se produjeron colisiones por índices en concurrencia, simplemente informar
        print(f"     [centros_produccion] ERROR bulk_write: {e}")


# --- Main worker ---
def main():
    load_dotenv()
    OVPN_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), "mtz.ovpn"))
    VPN_USER = os.environ.get("VPN_USER")
    VPN_PASS = os.environ.get("VPN_PASS")

    if not VPN_USER or not VPN_PASS:
        print("Error: Las variables de entorno VPN_USER y VPN_PASS no están configuradas.")
        return

    mesano_in = input("Introduce el Período (YYYYMM) o Año (YYYY) [default: mes actual]: ").strip()
    if not mesano_in:
        mesano_in = datetime.now().strftime("%Y%m")

    # Construir lista de periodos a procesar
    mesanos: list[str] = []
    if mesano_in.isdigit() and len(mesano_in) == 4:
        y = mesano_in
        mesanos = [f"{y}{m:02d}" for m in range(1, 13)]
        print(f"Se procesará el año completo {y}: {', '.join(mesanos)}")
    elif mesano_in.isdigit() and len(mesano_in) == 6:
        mesanos = [mesano_in]
    else:
        print("Entrada inválida. El formato debe ser YYYYMM o YYYY.")
        return

    auth_path = create_auth_file(VPN_USER, VPN_PASS)
    proc = None
    try:
        proc = connect_vpn(OVPN_PATH, auth_path)
        print("Estableciendo conexión VPN...")
        if not wait_for_vpn(proc):
            print("No se pudo establecer la conexión VPN. Abortando.")
            return

        print("\n¡Conexión VPN establecida con éxito!")

        # Añadimos la ruta al proyecto para importar web3mongo
        sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..')))
        from utils.web3mongo import db

        col = db['ventas_hora_tiempo_promedio']
        cp_coll = db['centros_produccion']  # <-- catálogo de centros
        ensure_centros_indexes(cp_coll)

        session = build_session()

        for mesano in mesanos:
            print(f"\n--- Procesando mesano {mesano} ---")
            url = f"http://192.168.4.117:8000/api/ventas-hora-tiempo-promedio-all?mesano={mesano}"
            try:
                payload = fetch_json_with_retries(url, session=session, retries=4, timeout=(5, 60), backoff=2.0)
                data = (payload or {}).get("data", [])
                if not data:
                    print("     INFO: Sin datos recibidos para este período.")
                    # Aun así limpiamos colección para ese período
                    try:
                        del_res = col.delete_many({"MESANO": int(mesano)})
                    except Exception:
                        del_res = col.delete_many({"MESANO": mesano})
                    print(f"     Eliminados previos: {del_res.deleted_count}")
                    continue

                # Normalización: agregar MESANO y asegurar tipos básicos
                for d in data:
                    try:
                        d["MESANO"] = int(mesano)
                    except Exception:
                        d["MESANO"] = mesano

                # === NUEVO: Upsert del catálogo de Centros de Producción ===
                upsert_centros_produccion(cp_coll, data, mesano)

                # Eliminar datos previos del período y reinsertar en bloque
                try:
                    del_res = col.delete_many({"MESANO": int(mesano)})
                except Exception:
                    del_res = col.delete_many({"MESANO": mesano})
                print(f"     Eliminados previos: {del_res.deleted_count}")

                inserted = 0
                try:
                    col.insert_many(data, ordered=False)
                    inserted = len(data)
                except Exception as e:
                    print(f"     ERROR insert_many: {e}")
                print(f"     Insertados: {inserted}")
            except Exception as e:
                print(f"     ERROR al procesar {mesano}: {e}")

    except Exception as e:
        print(f"\nOcurrió un error inesperado: {e}")
    finally:
        print("\nCerrando conexión VPN y limpiando archivos...")
        if proc:
            proc.terminate()
            try:
                proc.wait(timeout=5)
            except Exception:
                pass
        if os.path.exists(auth_path):
            os.unlink(auth_path)
        print("Proceso finalizado.")


if __name__ == "__main__":
    main()
