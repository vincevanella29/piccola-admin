import requests
import os
from dotenv import load_dotenv
from datetime import datetime
load_dotenv()


def main():
    now = datetime.now()
    periodo_default = now.strftime("%Y%m")
    periodo = input(f"Periodo a consultar (YYYYMM) [default: {periodo_default}]: ").strip() or periodo_default
    
    def parse_php_array(text: str):
        import re
        bloques = re.findall(r'\[\d+\] => Array\s*\((.*?)\)', text, re.DOTALL)
        sueldos = []
        for bloque in bloques:
            d = {}
            lines = bloque.strip().split('\n')
            for line in lines:
                match = re.match(r'\s*\[(.*?)\] => (.*)', line.strip())
                if match:
                    k = match.group(1).strip()
                    v = match.group(2).strip()
                    # Intenta convertir a número si aplica
                    if v.isdigit():
                        v = int(v)
                    else:
                        try:
                            v = float(v)
                        except:
                            pass
                    d[k] = v
            sueldos.append(d)
        return sueldos

    def fetch_period(periodo_str: str):
        url = (
            "https://intranet.piccolaitalia.cl/appfaster.php?"
            "key=fd488926917eccac63b5026e8187ab27&cls=externalLucc&cmd=json_data_intranet"
            f"&periodo={periodo_str}&data=talana_sueldos"
        )
        print(f"Consultando API de Talana sueldos para periodo {periodo_str}...")
        try:
            resp = requests.get(url, timeout=20)
            print("Status:", resp.status_code)
            if resp.status_code != 200:
                print("Error en request:", resp.status_code)
                return []
            return parse_php_array(resp.text)
        except Exception as e:
            print("Error en request:", e)
            return []

    # Determina si es año (YYYY) o período (YYYYMM)
    periods = []
    if len(periodo) == 4 and periodo.isdigit():
        # Cargar todos los meses del año
        periods = [f"{periodo}{m:02d}" for m in range(1, 13)]
    else:
        # Período simple
        periods = [periodo]

    # Agregar todos los resultados
    aggregated = []
    total_count = 0
    for p in periods:
        data = fetch_period(p) or []
        print(f"Recibidos {len(data)} sueldos Talana para {p}.")
        aggregated.extend(data)
        total_count += len(data)

    print(f"Total sueldos a actualizar en MongoDB: {total_count}")

    # Actualiza en Mongo una sola vez
    try:
        import sys
        sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..')))
        from utils.web3mongo import db
        col = db['pago_sueldos_intranet']
        if aggregated:
            for item in aggregated:
                id_talana = item.get("id_talana_sueldo")
                if not id_talana:
                    continue
                col.update_one({"id_talana_sueldo": id_talana}, {"$set": item}, upsert=True)
            print(f"Actualizados/insertados {len(aggregated)} sueldos Talana en MongoDB.")
        else:
            print("No hay sueldos para guardar.")
    except Exception as e:
        print("Error actualizando MongoDB:", e)


if __name__ == "__main__":
    main()
