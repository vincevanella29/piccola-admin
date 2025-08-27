import os
import re
import sys
import json
import time
import math
import tempfile
import logging
import requests
import subprocess
import shutil
from datetime import datetime, timedelta, timezone
from collections import defaultdict
from dotenv import load_dotenv
from email.utils import parsedate_to_datetime, format_datetime
from pymongo import MongoClient, UpdateOne

load_dotenv()

# ---------------- VPN helpers (reuse pattern) ----------------

def create_auth_file(username: str, password: str) -> str:
    tf = tempfile.NamedTemporaryFile(mode="w", delete=False)
    tf.write(f"{username}\n{password}\n")
    tf.close()
    return tf.name


def connect_vpn(ovpn_path: str, auth_path: str):
    base_cmd = ["openvpn", "--config", ovpn_path, "--auth-user-pass", auth_path]
    cmd = (["sudo"] + base_cmd) if shutil.which("sudo") else base_cmd
    proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
    return proc


def wait_for_vpn(proc, timeout: int = 30) -> bool:
    start = time.time()
    for line in proc.stdout:
        print(line, end="")
        if "Initialization Sequence Completed" in line:
            return True
        if time.time() - start > timeout:
            print("Timeout esperando VPN.")
            return False
    return False

# ---------------- Periodos ----------------

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
    sys.exit(1)

# ---------------- Date helpers ----------------

def last_day_of_month(periodo_yyyymm: str) -> datetime:
    year = int(periodo_yyyymm[:4])
    month = int(periodo_yyyymm[4:6])
    # first day next month - 1 day
    if month == 12:
        first_next = datetime(year + 1, 1, 1)
    else:
        first_next = datetime(year, month + 1, 1)
    return first_next - timedelta(days=1)

# Robust date parsing for items: supports YYYY-MM-DD and RFC1123 like
# "Tue, 01 Jul 2025 00:00:00 GMT". Falls back to default_fecha.
def parse_item_date(raw_fecha, default_fecha: datetime) -> datetime:
    try:
        if isinstance(raw_fecha, str):
            s = raw_fecha.strip()
            # ISO date
            if re.match(r"^\d{4}-\d{2}-\d{2}$", s):
                return datetime.strptime(s, "%Y-%m-%d")
            # RFC1123 / email date
            try:
                dt = parsedate_to_datetime(s)
                if dt is not None:
                    # Normalize to naive local date (only date is used later)
                    if getattr(dt, 'tzinfo', None) is not None:
                        dt = dt.astimezone(tz=None).replace(tzinfo=None)
                    return dt.replace(hour=0, minute=0, second=0, microsecond=0)
            except Exception:
                pass
            # Common alternatives
            for fmt in ("%d-%m-%Y", "%d/%m/%Y", "%Y/%m/%d"):
                try:
                    return datetime.strptime(s, fmt)
                except Exception:
                    continue
    except Exception:
        pass
    return default_fecha

# ---------------- Mapping sucursales ----------------

def build_sucursal_maps(db):
    col = db['sucursales_mtz']
    maps = {
        'by_sigla_bod': {},
        'by_sigla': {},
        'by_local_slug': {},
        'by_id': {},
    }
    for s in col.find({}, {
        'id': 1, 'sigla': 1, 'sigla_bodega': 1, 'sigla_local': 1, 'location.permalink_slug': 1
    }):
        sid = s.get('id')
        sigla = (s.get('sigla') or '').upper() if s.get('sigla') else None
        sigla_bod = (s.get('sigla_bodega') or '').upper() if s.get('sigla_bodega') else None
        sigla_loc = (s.get('sigla_local') or '').upper() if s.get('sigla_local') else None
        loc_slug = (s.get('location', {}).get('permalink_slug') or '').upper()
        if sid is not None:
            maps['by_id'][sid] = s
        if sigla_bod:
            maps['by_sigla_bod'][sigla_bod] = s
        if sigla:
            maps['by_sigla'][sigla] = s
        if sigla_loc:
            maps['by_local_slug'][sigla_loc] = s
        if loc_slug:
            maps['by_local_slug'][loc_slug] = s
    return maps

def build_gastos_refs_map(db):
    col = db['gastos_refs_sucursales']
    refs = {
        'by_sigla': {},   # e.g., AHM -> { id_sucursal, sigla, debug.loc_slug }
        'by_loc_slug': {},
    }
    for s in col.find({}, { 'id_sucursal': 1, 'sigla': 1, 'debug.loc_slug': 1, 'location.permalink_slug': 1 }):
        sigla = (s.get('sigla') or '').upper() if s.get('sigla') else None
        loc_slug = (s.get('debug', {}).get('loc_slug') or s.get('location', {}).get('permalink_slug') or '')
        loc_slug = loc_slug.upper() if isinstance(loc_slug, str) else None
        if sigla:
            refs['by_sigla'][sigla] = s
        if loc_slug:
            refs['by_loc_slug'][loc_slug] = s
    return refs


def find_sucursal_for_local(local_code: str, maps, refs):
    """Resolve local (e.g., ALMBOD) to a sucursal; prefer gastos_refs_sucursales to get base sigla/id_sucursal.
    Returns a dict-like with keys: id (id_sucursal), sigla (base), and passthrough others.
    """
    if not local_code:
        return None
    code = str(local_code).upper().strip()
    base = code[:-3] if code.endswith('BOD') else code
    # Prefer gastos_refs by sigla base
    r = refs['by_sigla'].get(base)
    if not r:
        # Try by local slug (e.g., AHMLOC)
        r = refs['by_loc_slug'].get(base)
    if r:
        # Normalize to suc-like shape
        return { 'id': r.get('id_sucursal'), 'sigla': (r.get('sigla') or base) }
    # fallback to sucursales_mtz maps
    s = maps['by_sigla_bod'].get(code)
    if s:
        return s
    s = maps['by_sigla'].get(base)
    if s:
        return s
    s = maps['by_local_slug'].get(code)
    if s:
        return s
    return { 'id': None, 'sigla': base }

# ---------------- Transform compras -> gastos ----------------

def to_gasto_doc(periodo: str, fecha: datetime, suc: dict, local_code: str, monto_total_venta: float, proveedor: str, seq: int) -> dict:
    sigla = (suc.get('sigla') or '').upper() if suc else (str(local_code).upper())
    id_sucursal = suc.get('id') if suc else None
    rut = None
    if isinstance(proveedor, str):
        m = re.match(r"([0-9Kk\-.]+)", proveedor.strip())
        if m:
            rut = m.group(1).replace('.', '').upper()
    fecha_str = fecha.strftime('%Y-%m-%d')
    folio = f"{periodo}-{sigla}-{seq:04d}"
    # Construcción del documento
    doc = {
        'id_cheque': int(f"{periodo}{seq:04d}"),
        'id_banco': 1,
        'id_usuario': 231,
        'id_sucursal': id_sucursal,
        'es_cuenta': 1,
        'es_operacional': 1,
        'sigla': sigla,
        'ingresado_por': 'Compras Fábrica',
        'id_cuenta_resultado': 99,
        'cat_categoria_resultado': 1,
        'cuenta': 599999,
        'nombre_cuenta': 'Compra Fabrica',
        'resumen': 'compra fabrica',
        'resumen2': 'compra fabrica',
        'nombre_cuenta_resultado': 'Compras Fábrica',
        'fecha_edicion': f"{fecha_str} 00:00:00",
        'pagado': 1,
        'periodo_emision': int(periodo),
        'periodo_pago': int(periodo),
        'fecha_emision': fecha_str,
        'fecha_acordada_de_cobro': fecha_str,
        'fecha_pago': fecha_str,
        'nombre_cuenta_bancaria': 'Negocios Gastronomicos',
        'rut': rut,
        'folio': folio,
        'num_cheque': int(f"{periodo}{seq:04d}"),
        'glosa': 'Compra Fábrica',
        'detalle': f"( {rut or ''} ) fol/{folio} loc/{sigla} Compra Fábrica [AUTO]",
        'abono': 0,
        'cargo': float(monto_total_venta or 0.0),
        'resultado_menos_un_mes': 0,
    }
    return doc

# ---------------- Main ----------------

def main():
    OVPN_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), "mtz.ovpn"))
    VPN_USER = os.environ.get("VPN_USER")
    VPN_PASS = os.environ.get("VPN_PASS")

    periodos = get_periodos_from_input()

    auth_path = create_auth_file(VPN_USER, VPN_PASS)
    proc = None
    session = requests.Session()
    try:
        # Mongo (lightweight: avoid importing web3/contracts)
        mongo_uri = os.environ.get("MONGODB_URI", "mongodb://localhost:27017")
        client = MongoClient(mongo_uri, serverSelectionTimeoutMS=3000)
        db = client['piccola_italia_admin']

        logging.basicConfig(level=logging.INFO, format='%(asctime)s %(levelname)s: %(message)s')
        gastos_col = db['gastos_intranet']
        # Ensure index to speed up upsert match
        try:
            gastos_col.create_index([
                ('periodo_pago', 1), ('cuenta', 1), ('sigla', 1), ('fecha_emision', 1)
            ], name='idx_gastos_upsert_key', background=True)
        except Exception:
            pass

        # Mapas de sucursales
        suc_maps = build_sucursal_maps(db)
        refs_map = build_gastos_refs_map(db)

        # Check API reachability without VPN using first periodo
        test_periodo = periodos[0]
        test_url = f"http://192.168.4.117:8000/api/compras-bodega-por-mes?mesano={test_periodo}&proveedor_rut=77119501"
        need_vpn = False
        try:
            rtest = session.get(test_url, timeout=6)
            if rtest.status_code != 200:
                need_vpn = True
        except Exception:
            need_vpn = True

        if need_vpn:
            proc = connect_vpn(OVPN_PATH, auth_path)
            print("Esperando que la VPN levante...")
            if not wait_for_vpn(proc):
                print("No se pudo levantar la VPN.")
                return

        for termino in periodos:
            api_url = f"http://192.168.4.117:8000/api/compras-bodega-por-mes?mesano={termino}&proveedor_rut=77119501"
            logging.info(f"Consultando compras-bodega por mes para {termino}...")
            try:
                resp = session.get(api_url, timeout=40)
                logging.info(f"Status: {resp.status_code}")
                if resp.status_code != 200:
                    logging.error(f"Error en request: {resp.status_code}")
                    continue
                data = resp.json()
                if isinstance(data, dict) and 'data' in data:
                    data = data['data']
                if not isinstance(data, list):
                    logging.warning("Respuesta inesperada; no es lista")
                    continue

                # Agregación por local y día. Si item trae fecha, úsala; si no, usa último día del mes.
                default_fecha = last_day_of_month(termino)
                by_local_day = defaultdict(float)  # key: (local, fecha_str)
                proveedor_val = None
                for item in data:
                    if not isinstance(item, dict):
                        continue
                    local = str(item.get('local') or '').upper().strip()
                    total_venta = float(item.get('total_venta') or 0.0)
                    # Try detect date
                    raw_fecha = item.get('fecha') or item.get('dia') or item.get('date')
                    fecha_obj = parse_item_date(raw_fecha, default_fecha)
                    fecha_str = fecha_obj.strftime('%Y-%m-%d')
                    by_local_day[(local, fecha_str)] += total_venta
                    if proveedor_val is None:
                        proveedor_val = item.get('proveedor')

                # Borra SOLO cuenta 599999 del periodo antes de insertar
                logging.info(f"Borrando documentos cuenta=599999 periodo_pago={termino}...")
                del_res = gastos_col.delete_many({ 'periodo_pago': int(termino), 'cuenta': 599999 })
                logging.info(f"Eliminados {del_res.deleted_count} docs 599999 periodo {termino}")

                ops = []
                seq = 1
                for (local_code, fecha_str), monto in by_local_day.items():
                    suc = find_sucursal_for_local(local_code, suc_maps, refs_map)
                    fecha_obj = datetime.strptime(fecha_str, '%Y-%m-%d')
                    doc = to_gasto_doc(termino, fecha_obj, suc, local_code, monto, proveedor_val, seq)
                    # Upsert por periodo+cuenta+sigla+fecha para evitar duplicados si se re-ejecuta
                    ops.append(UpdateOne(
                        { 'periodo_pago': int(termino), 'cuenta': 599999, 'sigla': doc['sigla'], 'fecha_emision': fecha_str },
                        { '$set': doc },
                        upsert=True
                    ))
                    seq += 1

                if ops:
                    res = gastos_col.bulk_write(ops, ordered=False)
                    logging.info(f"Upserts: m={res.matched_count}, u={getattr(res, 'upserted_count', 0)}, n={res.modified_count}")
                else:
                    logging.warning("No hay datos agregados para insertar.")

                # --- Ventas MTZLOC/MTZPRO por día (derivadas de compras): sumar por día y grabar en ventas_locales ---
                # Sumar por día (acumulado de todos los locales) y contar locales con compra (> 0)
                by_day_total = defaultdict(float)
                by_day_local_set = defaultdict(set)
                for (local_code, fecha_str), monto in by_local_day.items():
                    by_day_total[fecha_str] += monto
                    try:
                        if float(monto) > 0:
                            by_day_local_set[fecha_str].add(local_code)
                    except Exception:
                        pass

                ventas_col = db['ventas_locales']
                logging.info(f"Borrando ventas_locales MTZLOC/MTZPRO para periodo {termino}...")
                del_v = ventas_col.delete_many({ 'mesano': int(termino), 'local': { '$in': ['MTZLOC', 'MTZPRO'] } })
                logging.info(f"Eliminadas {del_v.deleted_count} ventas MTZLOC/MTZPRO previas del periodo {termino}")

                ventas_docs = []
                for fecha_str, monto in by_day_total.items():
                    # convertir YYYY-MM-DD -> RFC1123 en GMT
                    try:
                        fdt = datetime.strptime(fecha_str, '%Y-%m-%d').replace(tzinfo=timezone.utc)
                        fecha_rfc = format_datetime(fdt, usegmt=True)
                    except Exception:
                        fecha_rfc = fecha_str
                    ventas_docs.append({
                        'local': 'MTZPRO',
                        'fecha': fecha_rfc,
                        'mesano': int(termino),
                        'desctos': 0,
                        'subtotal': float(monto),
                        'total': float(monto),
                        'mesas': 0,
                        'personas': int(len(by_day_local_set.get(fecha_str, set()))),
                    })

                if ventas_docs:
                    ventas_col.insert_many(ventas_docs)
                    logging.info(f"Insertadas {len(ventas_docs)} ventas MTZLOC por día en ventas_locales para {termino}")
                else:
                    logging.info("Sin ventas MTZLOC por día para insertar.")

            except Exception as e:
                logging.error(f"Error procesando periodo {termino}: {e}")

    finally:
        if proc:
            try:
                proc.terminate()
            except Exception:
                pass
        if os.path.exists(auth_path):
            try:
                os.unlink(auth_path)
            except Exception:
                pass


if __name__ == "__main__":
    try:
        main()
    finally:
        pass
