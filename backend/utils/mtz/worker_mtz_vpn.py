import subprocess
import tempfile
import os
import requests
import time

def create_auth_file(username, password):
    tf = tempfile.NamedTemporaryFile(mode="w", delete=False)
    tf.write(f"{username}\n{password}\n")
    tf.close()
    return tf.name

def connect_vpn(ovpn_path, auth_path):
    cmd = [
        "sudo", "openvpn", "--config", ovpn_path, "--auth-user-pass", auth_path
    ]
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

    auth_path = create_auth_file(VPN_USER, VPN_PASS)
    proc = None
    try:
        proc = connect_vpn(OVPN_PATH, auth_path)
        print("Esperando que la VPN levante...")
        if not wait_for_vpn(proc):
            print("No se pudo levantar la VPN.")
            return

        print("¡VPN arriba! Consultando locations y descargando data...")
        import sys
        sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..')))
        from utils.web3mongo import db

        # 1. Obtener todas las locations
        locations = list(db['locations'].find({"status": True}))
        print(f"Encontradas {len(locations)} locations activas.")

        for loc in locations:
            local_code = (loc.get("permalink_slug") or "")[:3].upper()
            if not local_code:
                continue
            print(f"\nDescargando data para local: {local_code} ({loc.get('nombre')})")
            target_url = f"http://192.168.4.117:8000/api/restaurant-data-grouped?mesano={mesano}&local={local_code}"
            try:
                resp = requests.get(target_url, timeout=20)
                print("Status:", resp.status_code)
                if resp.status_code == 200:
                    data = resp.json().get("data", [])
                    if data:
                        # Elimina datos viejos de ese mes/local antes de insertar
                        restaurant_collection = db['restaurant_data']
                        delete_result = restaurant_collection.delete_many({"mesano": mesano, "local": local_code})
                        print(f"Eliminados {delete_result.deleted_count} docs antiguos.")
                        # Inserta los nuevos
                        # Prepara resumen de trabajadores ULTRA RÁPIDO
                        # 1. Carga todos los trabajadores en memoria
                        trabajadores = list(db['trabajadores_vpn'].find({}, {"rut": 1, "nombres": 1, "apellidopaterno": 1, "apellidomaterno": 1, "cargo": 1, "profile_image_url": 1}))
                        trabajadores_dict = {}
                        for t in trabajadores:
                            rut = t.get("rut")
                            if rut is not None:
                                trabajadores_dict[str(rut)] = t
                                trabajadores_dict[int(rut)] = t if isinstance(rut, int) else None
                        for d in data:
                            d["mesano"] = mesano
                            d["local"] = local_code
                            rut_vendedor = d.get("Rut_Vendedor")
                            trabajador = None
                            if rut_vendedor is not None:
                                trabajador = trabajadores_dict.get(rut_vendedor) or trabajadores_dict.get(str(rut_vendedor))
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
                        restaurant_collection.insert_many(data)
                        print(f"Guardados {len(data)} documentos nuevos en MongoDB")
                    else:
                        print("No hay datos para guardar")
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
