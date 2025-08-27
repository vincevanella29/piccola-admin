import subprocess
import tempfile
import os
import shutil
import requests
import time
from dotenv import load_dotenv
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
    mesano = input("MesAño (YYYYMM): ").strip()

    auth_path = create_auth_file(VPN_USER, VPN_PASS)
    proc = None
    try:
        proc = connect_vpn(OVPN_PATH, auth_path)
        print("Esperando que la VPN levante...")
        if not wait_for_vpn(proc):
            print("No se pudo levantar la VPN.")
            return

        print(f"¡VPN arriba! Descargando sales-by-waiter-hour para todas las sucursales activas...")
        import sys
        sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..')))
        from utils.web3mongo import db
        # Carga todos los trabajadores en memoria para merge ultra rápido
        trabajadores = list(db['trabajadores_vpn'].find({}, {"rut": 1, "nombres": 1, "apellidopaterno": 1, "apellidomaterno": 1, "cargo": 1, "profile_image_url": 1}))
        trabajadores_dict = {}
        for t in trabajadores:
            rut = t.get("rut")
            if rut is not None:
                trabajadores_dict[str(rut)] = t
                trabajadores_dict[int(rut)] = t if isinstance(rut, int) else None
        locations = list(db['locations'].find({"status": True}))
        print(f"Encontradas {len(locations)} sucursales activas.")
        for loc in locations:
            local_code = (loc.get("permalink_slug") or "")[:3].upper()
            if not local_code:
                continue
            print(f"\nDescargando data para local: {local_code} ({loc.get('nombre')})")
            target_url = f"http://192.168.4.117:8000/api/sales-by-waiter-hour?mesano={mesano}&local={local_code}"
            try:
                resp = requests.get(target_url, timeout=30)
                print("Status:", resp.status_code)
                if resp.status_code == 200:
                    data = resp.json().get("data", [])
                    print(f"Recibidos {len(data)} registros. Actualizando en MongoDB...")
                    # Enriquecer cada registro con trabajador_resumen usando el dict en memoria
                    for d in data:
                        rut = d.get("RUT")
                        trabajador = None
                        if rut is not None:
                            trabajador = trabajadores_dict.get(rut) or trabajadores_dict.get(str(rut))
                        if trabajador:
                            resumen = {
                                "rut": trabajador.get("rut"),
                                "nombres": trabajador.get("nombres"),
                                "apellidopaterno": trabajador.get("apellidopaterno"),
                                "apellidomaterno": trabajador.get("apellidomaterno"),
                                "cargo": trabajador.get("cargo"),
                                "profile_image_url": trabajador.get("profile_image_url")
                            }
                            d["trabajador_resumen"] = resumen
                    # Guardar en MongoDB
                    sales_col = db['sales_by_waiter_hour']
                    delete_result = sales_col.delete_many({"MESANO": int(mesano), "LOCAL": local_code+"LOC"})
                    print(f"Eliminados {delete_result.deleted_count} docs antiguos para {local_code+ 'LOC'}.")
                    for d in data:
                        d["MESANO"] = int(mesano)
                        d["LOCAL"] = local_code+"LOC"
                    if data:
                        sales_col.insert_many(data)
                        print(f"Guardados {len(data)} registros nuevos en MongoDB para {local_code+ 'LOC'}.")
                    else:
                        print("No hay datos para guardar para este local.")
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
