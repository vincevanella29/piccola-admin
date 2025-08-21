import requests
import os
import re
from dotenv import load_dotenv
from datetime import datetime
load_dotenv()

def get_periodos_from_input():
    now = datetime.now()
    default = now.strftime("%Y%m")
    raw = input(f"Año (YYYY) o periodo (YYYYMM) [default: {default}]: ").strip()
    if not raw:
        return [default]
    if len(raw) == 4 and raw.isdigit():
        return [f"{raw}{str(m).zfill(2)}" for m in range(1, 13)]
    if len(raw) == 6 and raw.isdigit():
        return [raw]
    print("Input inválido. Usa YYYY o YYYYMM.")
    exit(1)

def main():
    periodos = get_periodos_from_input()
    for periodo in periodos:
        API_URL = f"https://intranet.piccolaitalia.cl/appfaster.php?key=fd488926917eccac63b5026e8187ab27&cls=externalLucc&cmd=json_data_intranet&periodo={periodo}&data=ingreso_gastos"
        print(f"Consultando API de gastos para periodo {periodo}...")
        try:
            resp = requests.get(API_URL, timeout=20)
            print("Status:", resp.status_code)
            if resp.status_code == 200:
                text = resp.text
                def parse_php_array(text):
                    # Parser robusto para print_r array PHP, NO CORTA valores con paréntesis
                    lines = text.splitlines()
                    items = []
                    in_block = False
                    block_lines = []
                    paren_count = 0
                    for line in lines:
                        if re.match(r"\s*\[\d+\] => Array", line):
                            in_block = True
                            paren_count = 0
                            block_lines = []
                            continue
                        if in_block:
                            if '(' in line:
                                paren_count += line.count('(')
                            if ')' in line:
                                paren_count -= line.count(')')
                            block_lines.append(line)
                            if paren_count == 0:
                                # Fin del bloque
                                d = {}
                                for l in block_lines:
                                    m = re.match(r'\s*\[(.*?)\] => (.*)', l.strip())
                                    if m:
                                        k = m.group(1).strip()
                                        v = m.group(2)
                                        if isinstance(v, str):
                                            v = v.strip()
                                        if v.isdigit():
                                            v = int(v)
                                        else:
                                            try:
                                                v = float(v)
                                            except:
                                                pass
                                        d[k] = v
                                items.append(d)
                                in_block = False
                    return items
                data = parse_php_array(text)
                print(f"Recibidos {len(data)} gastos. Actualizando en MongoDB...")
                import sys
                sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
                import logging
                import time
                from utils.web3mongo import db
                from pymongo import UpdateOne

                # Configuración de logging profesional
                logging.basicConfig(level=logging.INFO, format='%(asctime)s %(levelname)s: %(message)s')
                gastos_col = db['gastos_intranet']

                # Borra SIEMPRE todos los gastos del periodo_pago ANTES de insertar
                logging.info(f"Borrando todos los gastos con periodo_pago={periodo} antes de insertar...")
                delete_result = gastos_col.delete_many({"periodo_pago": int(periodo)})
                logging.info(f"Eliminados {delete_result.deleted_count} documentos del periodo_pago {periodo}")
                if data:
                    # Elimina el índice único si existe para que no falle el insert_many
                    try:
                        gastos_col.drop_index("id_cheque_1")
                    except Exception:
                        pass
                    gastos_col.insert_many(data)
                    logging.info(f"Insertados {len(data)} gastos nuevos para periodo {periodo} en MongoDB.")
                else:
                    logging.warning("No hay gastos para guardar.")
            else:
                print("Error en request:", resp.status_code)
        except Exception as e:
            print("Error en request:", e)

if __name__ == "__main__":
    main()
