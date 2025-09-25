import subprocess
import tempfile
import os
import shutil
import requests
from requests.adapters import HTTPAdapter, Retry
import time
import sys
from dotenv import load_dotenv
from datetime import datetime

# --- Funciones de VPN (sin cambios) ---
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

# --- Helper de red con reintentos ---
def build_session() -> requests.Session:
    """Crea un Session con reintentos a nivel de transporte para errores transitorios."""
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
    adapter = HTTPAdapter(max_retries=retries, pool_connections=10, pool_maxsize=10)
    s.mount("http://", adapter)
    s.mount("https://", adapter)
    s.headers.update({
        "User-Agent": "mtz-vpn-worker/1.0",
        "Accept": "application/json",
        "Connection": "keep-alive",
    })
    return s


def fetch_json_with_retries(url: str, *, session: requests.Session, retries: int = 3, timeout: tuple[int, int] = (5, 45), backoff: float = 2.0):
    """Intenta hacer GET a url y retorna resp.json() en status 200. Reintenta en errores/transitorios.
    timeout: (connect_timeout, read_timeout)
    """
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
        # backoff si habrá otro intento
        if attempt < retries:
            sleep_s = backoff ** (attempt - 1)
            print(f"     Reintentando en {sleep_s:.1f}s...")
            time.sleep(sleep_s)
    # agotados intentos
    raise last_err if last_err else RuntimeError("Fallo desconocido en fetch_json_with_retries")

# --- Lógica Principal Mejorada ---
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

        # --- FASE 1: DESCARGAR Y ACUMULAR TODA LA DATA ---
        print("\n--- FASE 1: Descargando toda la data ---")
        all_data_to_insert = []
        processed_periods_locations = set()

        locations = list(db['locations'].find({"status": True}))
        # Normalizamos a un set de códigos únicos para evitar duplicados
        unique_local_codes = []
        seen_codes = set()
        for loc in locations:
            code = (loc.get("permalink_slug") or "")[:3].upper()
            if code and code not in seen_codes:
                seen_codes.add(code)
                unique_local_codes.append(code)
        print(f"Se encontraron {len(unique_local_codes)} locales activos para procesar.")

        session = build_session()

        for mesano in mesanos:
            total_codes = len(unique_local_codes)
            for idx, local_code in enumerate(unique_local_codes, start=1):
                
                print(f"  [{idx}/{total_codes}] -> Obteniendo datos de {local_code} para el período {mesano}...")
                target_url = f"http://192.168.4.117:8000/api/restaurant-data-grouped?mesano={mesano}&local={local_code}"
                
                try:
                    # POE puede tardar más: damos más tiempo de lectura
                    read_timeout = 90 if local_code.upper() == "POE" else 45
                    payload = fetch_json_with_retries(
                        target_url,
                        session=session,
                        retries=4,
                        timeout=(5, read_timeout),
                        backoff=2.0,
                    )
                    data = payload.get("data", [])
                    if data:
                        # Añadimos metadatos y acumulamos
                        for d in data:
                            d["mesano"] = mesano
                            d["local"] = local_code
                        all_data_to_insert.extend(data)
                        processed_periods_locations.add((mesano, local_code))
                        print(f"     OK: {len(data)} registros descargados.")
                    else:
                        print("     INFO: No se encontraron datos para esta combinación.")
                except requests.exceptions.RequestException as e:
                    print(f"     ERROR de conexión: {e}")
                except Exception as e:
                    print(f"     ERROR permanente al descargar {local_code} {mesano}: {e}")

        # --- FASE 2: ACTUALIZAR LA BASE DE DATOS EN BATCH ---
        print("\n--- FASE 2: Actualizando la base de datos ---")
        if not all_data_to_insert:
            print("No se descargó nueva data. La base de datos no será modificada.")
            return
        
        print(f"Total de registros a procesar: {len(all_data_to_insert)}")

        # 1. Enriquecer los datos con la información de los trabajadores (ultra rápido)
        print("Enriqueciendo datos con información de trabajadores...")
        trabajadores_list = list(db['trabajadores_vpn'].find({}, {"_id": 0, "rut": 1, "nombres": 1, "apellidopaterno": 1, "apellidomaterno": 1, "cargo": 1, "profile_image_url": 1}))
        trabajadores_dict = {str(t["rut"]): t for t in trabajadores_list if "rut" in t}

        for d in all_data_to_insert:
            rut_vendedor = d.get("Rut_Vendedor")
            if rut_vendedor:
                trabajador = trabajadores_dict.get(str(rut_vendedor))
                if trabajador:
                    d["trabajador_resumen"] = trabajador
        
        # 2. Eliminar todos los datos antiguos de los periodos y locales procesados en una sola operación
        print("Eliminando registros antiguos de la base de datos...")
        restaurant_collection = db['restaurant_data']
        delete_filters = [{"mesano": p[0], "local": p[1]} for p in processed_periods_locations]
        
        if delete_filters:
            delete_result = restaurant_collection.delete_many({"$or": delete_filters})
            print(f"Se eliminaron {delete_result.deleted_count} documentos antiguos.")

        # 3. Insertar toda la nueva data en una sola operación
        print("Insertando nuevos registros en la base de datos...")
        restaurant_collection.insert_many(all_data_to_insert)
        print(f"¡Éxito! Se guardaron {len(all_data_to_insert)} nuevos documentos en MongoDB.")

    except Exception as e:
        print(f"\nOcurrió un error inesperado: {e}")
    finally:
        print("\nCerrando conexión VPN y limpiando archivos...")
        if proc:
            proc.terminate()
            proc.wait() # Espera a que el proceso realmente termine
        if os.path.exists(auth_path):
            os.unlink(auth_path)
        print("Proceso finalizado.")

if __name__ == "__main__":
    main()