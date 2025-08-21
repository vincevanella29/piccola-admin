import requests
import os
import json
import re
from dotenv import load_dotenv
from datetime import datetime
load_dotenv()

def _php_array_to_list(text: str):
    """
    Parse a limited PHP print_r-style array string like:
    Array ( [0] => Array ( [id] => 1 [name] => John ) [1] => Array ( ...) )
    into a Python list[dict]. This is a best-effort lightweight parser tailored
    to the API output observed (single-line key=>value pairs, nested Array blocks).
    """
    s = " ".join(line.strip() for line in text.strip().splitlines())
    # Normalize multiple spaces
    s = re.sub(r"\s+", " ", s)

    # Extract each top-level entry: [n] => Array ( ... )
    entries = re.findall(r"\[(\d+)\]\s*=>\s*Array\s*\((.*?)\)\s*(?=\[\d+\]|\)\s*$)", s)
    result = []
    for idx, body in entries:
        item = {}
        # Extract key=>value pairs inside the body; value stops before next [key] or end )
        for k, v in re.findall(r"\[(.*?)\]\s*=>\s*(.*?)(?=\s*\[.*?\]\s*=>|\)\s*$)", body):
            k = str(k).strip()
            v = v.strip()
            # Clean wrapping quotes if any (rare in this output)
            if (len(v) >= 2 and ((v[0] == '"' and v[-1] == '"') or (v[0] == "'" and v[-1] == "'"))):
                v = v[1:-1]
            # Coerce numbers where safe
            if re.fullmatch(r"-?\d+", v):
                try:
                    v = int(v)
                except Exception:
                    pass
            item[k] = v
        if item:
            result.append(item)
    return result if result else None

def process_period(periodo: str):
    API_URL = f"https://intranet.piccolaitalia.cl/appfaster.php?key=fd488926917eccac63b5026e8187ab27&cls=externalLucc&cmd=json_data_intranet&periodo={periodo}&data=ingreso_asistencia_diaria"

    print(f"Consultando API de asistencia diaria para periodo {periodo}...")
    try:
        headers = {
            "User-Agent": "PiccolaItaliaAdmin/1.0 (+https://piccolaitalia.cl)",
            "Accept": "application/json, */*;q=0.8",
        }
        resp = requests.get(API_URL, timeout=20, headers=headers)
        print("Status:", resp.status_code)
        if resp.status_code == 200:
            text = resp.text or ""
            # Intentar detectar JSON; algunos endpoints retornan texto plano aun con 200
            data = None
            try:
                # Preferir JSON si el content-type lo indica o si el cuerpo aparenta ser JSON
                if "application/json" in (resp.headers.get("Content-Type", "").lower()):
                    data = resp.json()
                else:
                    # Heurística simple
                    s = text.lstrip()
                    if s.startswith("[") or s.startswith("{"):
                        data = json.loads(s)
            except Exception as je:
                print("Error parseando JSON:", je)
                snippet = text[:500].replace("\n", " ")
                print("Respuesta (primeros 500 chars):", snippet)
                # No retornar aquí; intentaremos el parser de formato PHP Array más abajo
                data = None

            if data is None:
                # Intentar parsear formato PHP print_r Array(...)
                parsed = _php_array_to_list(text)
                if parsed is not None:
                    data = parsed
                else:
                    print("La respuesta no es JSON. Mostrando fragmento:")
                    snippet = text[:500].replace("\n", " ")
                    print(snippet)
                    return

            print(f"Recibidos {len(data)} registros de asistencia diaria. Actualizando en MongoDB...")
            import sys
            sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..')))
            from utils.web3mongo import db
            col = db['asistencia_diaria_intranet']
            if data:
                # Normalizar el campo periodo de todos los items para asegurar borrado/inserción correctos
                try:
                    periodo_int = int(str(periodo))
                except Exception:
                    periodo_int = str(periodo)
                for item in data:
                    item['periodo'] = periodo_int
                # Eliminar datos existentes del periodo antes de insertar
                try:
                    periodo_str = str(periodo)
                    delete_filter = {"periodo": {"$in": [periodo_str]}}
                    # También intentar como entero si aplica
                    if periodo_str.isdigit():
                        delete_filter["periodo"]["$in"].append(int(periodo_str))
                    del_res = col.delete_many(delete_filter)
                    print(f"Eliminados documentos previos del periodo {periodo}: {del_res.deleted_count}")
                except Exception as de:
                    print(f"Aviso: no se pudieron eliminar previos del periodo {periodo}: {de}")

                # Inserción masiva sin validaciones
                try:
                    ins_res = col.insert_many(data, ordered=False)
                    print(f"Insertados {len(ins_res.inserted_ids)} registros para el periodo {periodo}.")
                except Exception as ie:
                    print(f"Error insertando registros: {ie}")
            else:
                print("No hay registros para guardar.")
        else:
            print("Error en request:", resp.status_code)
    except Exception as e:
        print("Error en request:", e)

def main():
    now = datetime.now()
    periodo_default = now.strftime("%Y%m")
    periodo = input(f"Periodo a consultar (YYYYMM) [default: {periodo_default}]: ").strip() or periodo_default
    # Permitir ingresar YYYYMM (mes) o YYYY (año completo)
    p = str(periodo).strip()
    if re.fullmatch(r"\d{4}$", p):
        year = p
        for m in range(1, 13):
            per = f"{year}{m:02d}"
            process_period(per)
    elif re.fullmatch(r"\d{6}$", p):
        process_period(p)
    else:
        # Fallback: intentar con el valor calculado
        process_period(periodo_default)

if __name__ == "__main__":
    main()
