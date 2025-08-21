import requests
import os
from dotenv import load_dotenv
from datetime import datetime
load_dotenv()

def main():
    now = datetime.now()
    periodo_default = now.strftime("%Y%m")
    periodo = input(f"Periodo a consultar (YYYYMM) [default: {periodo_default}]: ").strip() or periodo_default
    API_URL = f"https://intranet.piccolaitalia.cl/appfaster.php?key=fd488926917eccac63b5026e8187ab27&cls=externalLucc&cmd=json_data_intranet&periodo={periodo}&data=ingreso_asistencia_extra"

    print(f"Consultando API de asistencia extra para periodo {periodo}...")
    try:
        resp = requests.get(API_URL, timeout=20)
        print("Status:", resp.status_code)
        if resp.status_code == 200:
            data = resp.json()
            print(f"Recibidos {len(data)} registros de asistencia extra. Actualizando en MongoDB...")
            import sys
            sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..')))
            from utils.web3mongo import db
            col = db['asistencia_extra_intranet']
            if data:
                for item in data:
                    id_asistencia = item.get("id_asistencia") or item.get("id")
                    if not id_asistencia:
                        continue
                    col.update_one({"id_asistencia": id_asistencia}, {"$set": item}, upsert=True)
                print(f"Actualizados/insertados {len(data)} registros en MongoDB.")
            else:
                print("No hay registros para guardar.")
        else:
            print("Error en request:", resp.status_code)
    except Exception as e:
        print("Error en request:", e)

if __name__ == "__main__":
    main()
