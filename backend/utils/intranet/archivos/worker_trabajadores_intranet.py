import requests
import io
import os
from dotenv import load_dotenv
from datetime import datetime
load_dotenv()

def main():
    now = datetime.now()
    periodo = now.strftime("%Y%m")
    API_URL = f"https://intranet.piccolaitalia.cl/appfaster.php?key=fd488926917eccac63b5026e8187ab27&cls=externalLucc&cmd=json_data_intranet&periodo={periodo}&data=cat_trabajadores"

    print("Consultando API de trabajadores...")
    try:
        resp = requests.get(API_URL, timeout=20)
        print("Status:", resp.status_code)
        if resp.status_code == 200:
            data = resp.json()
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
                            return f"[SKIP] Sin imagen para rut {rut} (status {img_resp.status_code})"
                    except requests.RequestException:
                        return f"[SKIP] Error de conexión para rut {rut}"
                    except Exception:
                        return f"[SKIP] Error inesperado para rut {rut}"

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

if __name__ == "__main__":
    main()
 