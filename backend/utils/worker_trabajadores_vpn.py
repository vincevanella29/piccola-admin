import subprocess
import tempfile
import os
import requests
import io
import time
from dotenv import load_dotenv
load_dotenv()

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
    API_URL = "http://192.168.4.117:8000/api/trabajadores"

    auth_path = create_auth_file(VPN_USER, VPN_PASS)
    proc = None
    try:
        proc = connect_vpn(OVPN_PATH, auth_path)
        print("Esperando que la VPN levante...")
        if not wait_for_vpn(proc):
            print("No se pudo levantar la VPN.")
            return

        print("¡VPN arriba! Consultando API de trabajadores...")
        try:
            resp = requests.get(
                API_URL,
                timeout=20,
                headers={
                    "Accept": "application/json, text/plain;q=0.9, */*;q=0.8",
                    "User-Agent": "PiccolaWorker/1.0",
                },
            )
            print("Status:", resp.status_code)
            if resp.status_code == 200:
                text = resp.text or ""
                data = None
                try:
                    if text.strip() == "":
                        data = []
                    else:
                        data = resp.json()
                except Exception as je:
                    print("Error parseando JSON:", je)
                    snippet = text[:500].replace("\n", " ")
                    print("Respuesta (primeros 500 chars):", snippet)
                    data = None
                if data is None:
                    try:
                        from utils.intranet.php_array_parser import php_array_to_list
                    except Exception:
                        import sys
                        sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
                        from utils.intranet.php_array_parser import php_array_to_list
                    parsed = php_array_to_list(text)
                    if parsed:
                        data = parsed
                    else:
                        print("La respuesta no es JSON ni array PHP. Mostrando fragmento:")
                        snippet = text[:500].replace("\n", " ")
                        print(snippet)
                        data = []
                print(f"Recibidos {len(data)} trabajadores. Actualizando en MongoDB...")
                import sys
                sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
                from utils.web3mongo import db
                trabajadores_col = db['trabajadores_vpn']
                if data:
                    # Upsert uno a uno
                    for trabajador in data:
                        rut = trabajador.get("rut")
                        if not rut:
                            continue
                        trabajadores_col.update_one({"rut": rut}, {"$set": trabajador}, upsert=True)
                    print(f"Actualizados/insertados {len(data)} trabajadores en MongoDB.")

                    # Subir imágenes de perfil a R2 y actualizar URL en MongoDB
                    from utils.r2_upload import upload_profile_image_to_r2
                    import hashlib
                    from concurrent.futures import ThreadPoolExecutor, as_completed

                    def process_trabajador(trabajador):
                        rut = trabajador.get("rut")
                        if not rut:
                            return "[SKIP] Trabajador sin rut"
                        img_url = f"https://intranet.piccolaitalia.cl/images/uploaded/{rut}.jpg"
                        try:
                            img_resp = requests.get(img_url, timeout=10)
                            if img_resp.status_code == 200:
                                img_bytes = img_resp.content
                                img_hash = hashlib.sha256(img_bytes).hexdigest()
                                doc = trabajadores_col.find_one({"rut": rut})
                                prev_hash = doc.get("profile_image_hash") if doc else None
                                if prev_hash == img_hash and doc.get("profile_image_url"):
                                    return f"Imagen de rut {rut} sin cambios. No se sube."
                                file_obj = io.BytesIO(img_bytes)
                                filename = f"trabajadores/{rut}.jpg"
                                r2_url = upload_profile_image_to_r2(file_obj, filename)
                                trabajadores_col.update_one(
                                    {"rut": rut},
                                    {"$set": {"profile_image_url": r2_url, "profile_image_hash": img_hash}}
                                )
                                return f"Imagen subida y URL guardada para rut {rut}"
                            else:
                                return f"No se encontró imagen para rut {rut}"
                        except Exception as e:
                            return f"Error subiendo imagen para rut {rut}: {e}"

                    max_workers = 16  # Puedes ajustar este número según tu red/CPU
                    with ThreadPoolExecutor(max_workers=max_workers) as executor:
                        futures = [executor.submit(process_trabajador, t) for t in data]
                        for future in as_completed(futures):
                            print(future.result())
                else:
                    print("No hay trabajadores para guardar.")
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
