import requests
import os
from dotenv import load_dotenv
from datetime import datetime
from typing import List, Dict, Any

load_dotenv()


def main():
    now = datetime.now()
    periodo_default = now.strftime("%Y%m")
    periodo = input(f"Periodo a consultar (YYYYMM) [default: {periodo_default}]: ").strip() or periodo_default

    # -----------------------
    # Helpers de parseo
    # -----------------------
    def parse_php_array(text: str) -> List[Dict[str, Any]]:
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
                    if v.isdigit():
                        v = int(v)
                    else:
                        try:
                            v = float(v)
                        except Exception:
                            pass
                    d[k] = v
            if d:
                sueldos.append(d)
        return sueldos

    def fetch_period(periodo_str: str) -> List[Dict[str, Any]]:
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
            # Asegurar encoding correcto (algunos endpoints envían ISO-8859-1)
            try:
                if not resp.encoding:
                    resp.encoding = resp.apparent_encoding or 'utf-8'
            except Exception:
                resp.encoding = 'utf-8'
            text = resp.text or ""
            data = None
            try:
                if text.strip() == "":
                    data = []
                else:
                    data = resp.json()
            except Exception as je:
                # No hacer ruido si luego podemos parsear como PHP Array
                debug = os.getenv('DEBUG_INTRANET_PARSER') == '1'
                if debug:
                    print("Aviso: respuesta no JSON, intentando parseo PHP. Detalle:", je)
                    snippet = text[:500].replace("\n", " ")
                    print("Respuesta (primeros 500 chars):", snippet)
                data = None

            if data is None:
                # Intento parseo de array PHP plano
                import re
                def _php_array_to_list(text):
                    s = " ".join(line.strip() for line in text.strip().splitlines())
                    s = re.sub(r"\s+", " ", s)
                    entries = re.findall(r"\[(\d+)\]\s*=>\s*Array\s*\((.*?)\)\s*(?=\[\d+\]|\)\s*$)", s)
                    result = []
                    for idx, body in entries:
                        item = {}
                        for k, v in re.findall(r"\[(.*?)\]\s*=>\s*(.*?)(?=\s*\[.*?\]\s*=>|\)\s*$)", body):
                            k = str(k).strip()
                            v = v.strip()
                            if (len(v) >= 2 and ((v[0] == '"' and v[-1] == '"') or (v[0] == "'" and v[-1] == "'"))):
                                v = v[1:-1]
                            if re.fullmatch(r"-?\d+", v):
                                try:
                                    v = int(v)
                                except Exception:
                                    pass
                            item[k] = v
                        if item:
                            result.append(item)
                    # Si es "Array ( )" vacío, regresar lista vacía
                    if not result and 'Array ( )' in s:
                        return []
                    return result if result else []
                parsed = _php_array_to_list(text)
                if parsed:
                    data = parsed
                else:
                    # Sólo mostrar fragmento en modo DEBUG para evitar ruido en logs
                    if os.getenv('DEBUG_INTRANET_PARSER') == '1':
                        print("La respuesta no es JSON ni array PHP. Mostrando fragmento:")
                        snippet = text[:500].replace("\n", " ")
                        print(snippet)
                    data = []

            # Estandariza a lista
            if isinstance(data, dict):
                data = [data]
            if not isinstance(data, list):
                data = []

            # Asegura que cada item sea dict
            data = [d for d in data if isinstance(d, dict)]
            return data
        except Exception as e:
            print("Error en request:", e)
            return []

    # -----------------------
    # Periodos a procesar
    # -----------------------
    periods: List[str] = []
    if len(periodo) == 4 and periodo.isdigit():
        # Año completo YYYY -> YYYY01..YYYY12
        periods = [f"{periodo}{m:02d}" for m in range(1, 13)]
    else:
        # Período simple YYYYMM
        periods = [periodo]

    # -----------------------
    # Carga desde API
    # -----------------------
    all_items: List[Dict[str, Any]] = []
    for p in periods:
        data = fetch_period(p) or []
        print(f"Recibidos {len(data)} sueldos Talana para {p}.")
        # Garantiza 'periodo' = str YYYYMM en cada item
        for d in data:
            if "periodo" not in d or not d.get("periodo"):
                d["periodo"] = p
            else:
                d["periodo"] = str(d["periodo"])
        all_items.extend(data)

    print(f"Total sueldos a cargar en MongoDB: {len(all_items)}")

    # -----------------------
    # Persistencia en Mongo: BORRAR 100% y RECARGAR
    # -----------------------
    try:
        import sys
        sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..')))
        from utils.web3mongo import db

        col = db['pago_sueldos_intranet']

        # Índices "de una"
        # 1) índice simple por periodo
        try:
            col.create_index([("periodo", 1)])
            print("Índice creado/ok: periodo")
        except Exception as e_idx1:
            print("Aviso índice periodo:", e_idx1)

        # 2) índice único compuesto (periodo, id_talana_sueldo) recomendado
        try:
            col.create_index([("periodo", 1), ("id_talana_sueldo", 1)],
                             name="uniq_periodo_id_talana",
                             unique=True)
            print("Índice creado/ok: uniq_periodo_id_talana (único)")
        except Exception as e_idx2:
            print("Aviso índice único compuesto:", e_idx2)

        # Normaliza a str/int para borrar todo lo que exista del período
        periods_str = [str(p) for p in periods]
        periods_int = []
        for p in periods_str:
            try:
                periods_int.append(int(p))
            except Exception:
                pass

        delete_query = {
            "$or": [
                {"periodo": {"$in": periods_str}},   # documentos guardados como string
                {"periodo": {"$in": periods_int}},   # documentos guardados como int
            ]
        }

        print(f"Borrando documentos previos de períodos: {', '.join(periods_str)} ...")
        del_res = col.delete_many(delete_query)
        print(f"Eliminados {del_res.deleted_count} documentos antiguos.")

        # Inserción limpia (sin upsert) para no arrastrar residuos de campos viejos
        if all_items:
            # Opcional: validaciones mínimas
            # p.ej. asegurar que centro_costo_cod sea int si viene numérico en texto
            # (descomenta si lo necesitas)
            # for it in all_items:
            #     for key in ("centro_costo_cod", "dias_trabajados", "hhs_extra_50", "hhs_extra_100"):
            #         try:
            #             if key in it:
            #                 it[key] = int(it[key])
            #         except Exception:
            #             pass

            col.insert_many(all_items, ordered=False)
            print(f"Insertados {len(all_items)} sueldos Talana nuevos.")
        else:
            print("No hay sueldos para guardar después del borrado.")

        print(f"Carga completada para períodos: {', '.join(periods_str)}")

    except Exception as e:
        print("Error actualizando MongoDB:", e)


if __name__ == "__main__":
    main()
