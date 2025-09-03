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
                # Upsert en batch usando bulk_write (mucho más rápido)
                from pymongo import UpdateOne
                ops = []
                for trabajador in data:
                    rut = trabajador.get("rut")
                    if not rut:
                        continue
                    ops.append(UpdateOne({"rut": rut}, {"$set": trabajador}, upsert=True))
                total = len(ops)
                if total:
                    BATCH = 1000
                    upserts = 0
                    modified = 0
                    for i in range(0, total, BATCH):
                        chunk = ops[i:i+BATCH]
                        res = trabajadores_col.bulk_write(chunk, ordered=False)
                        upserts += getattr(res, 'upserted_count', 0)
                        modified += getattr(res, 'modified_count', 0)
                    print(f"Bulk upserts: {upserts}, modified: {modified}, total ops: {total}")
                else:
                    print("No hay trabajadores con rut válido para upsert.")

                # Subir imágenes de perfil a R2 y actualizar URL en MongoDB
                from utils.r2_upload import upload_profile_image_to_r2
                import hashlib
                from concurrent.futures import ThreadPoolExecutor, as_completed
                from requests.adapters import HTTPAdapter
                from urllib3.util.retry import Retry

                # Pre-cargar hashes/URLs existentes para evitar find_one por cada trabajador
                ruts = [t.get("rut") for t in data if t.get("rut")]
                existing = {}
                if ruts:
                    for doc in trabajadores_col.find({"rut": {"$in": ruts}}, {"rut": 1, "profile_image_hash": 1, "profile_image_url": 1}):
                        existing[doc.get("rut")] = {
                            "hash": doc.get("profile_image_hash"),
                            "url": doc.get("profile_image_url"),
                        }

                # Sesión compartida con retries para acelerar y ser robustos
                session = requests.Session()
                retries = Retry(total=3, backoff_factor=0.3, status_forcelist=[429, 500, 502, 503, 504])
                adapter = HTTPAdapter(max_retries=retries, pool_connections=100, pool_maxsize=100)
                session.mount('http://', adapter)
                session.mount('https://', adapter)
                session.headers.update({"User-Agent": "PiccolaWorker/1.0"})

                def process_trabajador(trabajador):
                    rut = trabajador.get("rut")
                    if not rut:
                        return "[SKIP] Trabajador sin rut"
                    img_url = f"https://intranet.piccolaitalia.cl/images/uploaded/{rut}.jpg"
                    try:
                        img_resp = session.get(img_url, timeout=10)
                        if img_resp.status_code == 200:
                            img_bytes = img_resp.content
                            img_hash = hashlib.sha256(img_bytes).hexdigest()
                            prev = existing.get(rut) or {}
                            prev_hash = prev.get("hash")
                            prev_url = prev.get("url")
                            if prev_hash == img_hash and prev_url:
                                return f"Imagen de rut {rut} sin cambios. No se sube."
                            file_obj = io.BytesIO(img_bytes)
                            filename = f"trabajadores/{rut}.jpg"
                            r2_url = upload_profile_image_to_r2(file_obj, filename)
                            trabajadores_col.update_one(
                                {"rut": rut},
                                {"$set": {"profile_image_url": r2_url, "profile_image_hash": img_hash}}
                            )
                            existing[rut] = {"hash": img_hash, "url": r2_url}
                            return f"Imagen subida y URL guardada para rut {rut}"
                        else:
                            return f"[SKIP] Sin imagen para rut {rut} (status {img_resp.status_code})"
                    except requests.RequestException:
                        return f"[SKIP] Error de conexión para rut {rut}"
                    except Exception:
                        return f"[SKIP] Error inesperado para rut {rut}"

                max_workers = 32  # Mayor concurrencia para acelerar descargas/subidas
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
 