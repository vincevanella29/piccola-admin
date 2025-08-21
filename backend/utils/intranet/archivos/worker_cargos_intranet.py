import requests
import os
from dotenv import load_dotenv
from datetime import datetime
load_dotenv()

def main():
    now = datetime.now()
    periodo_default = now.strftime("%Y%m")
    periodo = input(f"Periodo a consultar (YYYYMM) [default: {periodo_default}]: ").strip() or periodo_default
    API_URL = f"https://intranet.piccolaitalia.cl/appfaster.php?key=fd488926917eccac63b5026e8187ab27&cls=externalLucc&cmd=json_data_intranet&periodo={periodo}&data=cat_cargos"

    print(f"Consultando API de cargos para periodo {periodo}...")
    try:
        resp = requests.get(API_URL, timeout=20)
        print("Status:", resp.status_code)
        if resp.status_code == 200:
            data = resp.json()
            print(f"Recibidos {len(data)} cargos. Actualizando en MongoDB...")
            import sys
            sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..')))
            from utils.web3mongo import db
            cargos_col = db['cargos_intranet']
            if data:
                for cargo in data:
                    # Ajusta el campo clave si es diferente en los datos reales
                    id_cargo = cargo.get("id_cargo") or cargo.get("id")
                    if not id_cargo:
                        continue
                    cargos_col.update_one({"id_cargo": id_cargo}, {"$set": cargo}, upsert=True)
                print(f"Actualizados/insertados {len(data)} cargos en MongoDB.")
            else:
                print("No hay cargos para guardar.")
        else:
            print("Error en request:", resp.status_code)
    except Exception as e:
        print("Error en request:", e)

if __name__ == "__main__":
    main()
