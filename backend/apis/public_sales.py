from fastapi import APIRouter, HTTPException, Request, Query
from fastapi.responses import StreamingResponse
from typing import Optional, Any, Dict, List
from utils.web3mongo import db
from datetime import datetime
from bson import ObjectId
from apis.apikeys import validate_api_key
import io
import zipfile
import json

router = APIRouter()

COLL_NAME = 'sales_by_waiter_hour'
COLL = db[COLL_NAME]


def _to_jsonable(obj: Any) -> Any:
    if isinstance(obj, ObjectId):
        return str(obj)
    if isinstance(obj, datetime):
        return obj.isoformat()
    if isinstance(obj, dict):
        return {k: _to_jsonable(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_to_jsonable(v) for v in obj]
    return obj


async def verify_api_key(request: Request) -> Dict:
    raw = request.headers.get('X-API-Key') or ''
    if not raw:
        raise HTTPException(status_code=401, detail='Missing X-API-Key header')
    info = validate_api_key(raw)
    if not info:
        raise HTTPException(status_code=401, detail='Invalid API key')
    return info


@router.get('/public/sales_by_waiter_hour')
async def get_sales_by_waiter_hour(
    request: Request,
    mesano: int = Query(..., description='Periodo en formato yyyymm, ej 202508'),
    rut: Optional[int] = Query(None, description='RUT del trabajador (opcional)'),
    local: Optional[str] = Query(None, description='Código del local, ej PRVLOC (opcional)'),
    as_zip: bool = Query(False, description='Si True, devuelve un ZIP descargable con los datos en JSON'),
):
    # Auth by API key
    _ = await verify_api_key(request)

    # Build query
    q: Dict[str, Any] = { 'MESANO': mesano }
    if rut is not None:
        q['RUT'] = rut
    if local:
        q['LOCAL'] = local

    try:
        docs = list(COLL.find(q))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f'Database error: {str(e)}')

    # Sanitize docs
    out = []
    for d in docs:
        d2 = dict(d)
        if '_id' in d2:
            d2['_id'] = _to_jsonable(d2['_id'])
        out.append(_to_jsonable(d2))

    if as_zip:
        # Build in-memory ZIP with a JSON file
        buf = io.BytesIO()
        filename_json = f"sales_by_waiter_hour_{mesano}.json"
        with zipfile.ZipFile(buf, mode='w', compression=zipfile.ZIP_DEFLATED) as zf:
            payload = json.dumps({ 'items': out, 'count': len(out) }, ensure_ascii=False).encode('utf-8')
            zf.writestr(filename_json, payload)
        buf.seek(0)
        zip_name = f"sales_by_waiter_hour_{mesano}.zip"
        headers = {
            'Content-Disposition': f'attachment; filename="{zip_name}"'
        }
        return StreamingResponse(buf, media_type='application/zip', headers=headers)

    return { 'items': out, 'count': len(out) }


# -----------------------------
# Menus with profitability data
# -----------------------------
def _compute_periods_from_mesano(mesano: int) -> Dict[str, int]:
    """Given an anchor yyyymm (e.g., 202508), compute surrounding periods
    similar to restaurant_data.get_menus: actual, anterior, antepasado,
    anio_anterior, anterior_anio_anterior.
    """
    s = str(mesano)
    if len(s) != 6 or not s.isdigit():
        # fallback to current date
        now = datetime.now()
        y = now.year
        m = now.month
    else:
        y = int(s[:4])
        m = int(s[4:])

    # actual
    periodo_actual = y * 100 + m

    # anterior and antepasado
    if m == 1:
        periodo_anterior = (y - 1) * 100 + 12
        periodo_antepasado = (y - 1) * 100 + 11
    elif m == 2:
        periodo_anterior = y * 100 + 1
        periodo_antepasado = (y - 1) * 100 + 12
    else:
        periodo_anterior = y * 100 + (m - 1)
        periodo_antepasado = y * 100 + (m - 2)

    # same month previous year
    periodo_anio_anterior = (y - 1) * 100 + m

    # previous month previous year
    if m == 1:
        periodo_anterior_anio_anterior = (y - 2) * 100 + 12
    else:
        periodo_anterior_anio_anterior = (y - 1) * 100 + (m - 1)

    return {
        'actual': periodo_actual,
        'anterior': periodo_anterior,
        'antepasado': periodo_antepasado,
        'anio_anterior': periodo_anio_anterior,
        'anterior_anio_anterior': periodo_anterior_anio_anterior,
    }


@router.get('/public/menus_profitability')
async def get_menus_profitability(
    request: Request,
    mesano: Optional[int] = Query(None, description='Periodo base yyyymm; si no se envía, usa el mes actual'),
    as_zip: bool = Query(False, description='Si True, devuelve un ZIP con un JSON adentro'),
):
    """Devuelve solo los menús con su rentabilidad por producto para 5 periodos:
    actual, anterior, antepasado, anio_anterior, anterior_anio_anterior.
    Protegido por API Key (header X-API-Key).
    """
    # Auth by API key
    _ = await verify_api_key(request)

    # Periodos en base a mesano o fecha actual
    if mesano is None:
        now = datetime.now()
        mesano_anchor = now.year * 100 + now.month
    else:
        mesano_anchor = mesano

    periods = _compute_periods_from_mesano(mesano_anchor)
    period_values: List[int] = [
        periods['actual'],
        periods['anterior'],
        periods['antepasado'],
        periods['anio_anio_anterior'] if 'anio_anio_anterior' in periods else periods['anio_anterior'],
        periods['anterior_anio_anterior'],
    ]

    try:
        # Obtener todos los menús
        menus = list(db.menus.find({}))

        # Codigos de menú a consultar en rentabilidad
        codigos_menu = set()
        for menu in menus:
            cod = menu.get('codigo')
            if cod:
                codigos_menu.add(str(cod).strip())

        renta_idx: Dict[str, Dict[str, Any]] = {}
        if codigos_menu:
            filtro = {
                'codig': { '$in': [str(c) for c in codigos_menu] },
                'mesano': { '$in': [int(p) for p in period_values] },
            }
            rentabilidad_docs = list(db.rentabilidad_producto_locales.find(filtro))
            for doc in rentabilidad_docs:
                cod = str(doc.get('codig')).strip()
                mesano_val = str(doc.get('mesano'))
                if cod not in renta_idx:
                    renta_idx[cod] = {}
                renta_idx[cod][mesano_val] = doc
        else:
            rentabilidad_docs = []  # noqa: F841 (kept for parity)

        # Construir salida de menús + rentabilidad
        out_menus: List[Dict[str, Any]] = []
        for menu in menus:
            m = dict(menu)
            # Normaliza id y fechas
            if not m.get('id') and m.get('_id'):
                m['id'] = str(m['_id'])
            elif not m.get('id'):
                m['id'] = ''
            if '_id' in m:
                m['_id'] = _to_jsonable(m['_id'])
            if m.get('created_at') and isinstance(m['created_at'], datetime):
                m['created_at'] = m['created_at'].isoformat()
            if m.get('updated_at') and isinstance(m['updated_at'], datetime):
                m['updated_at'] = m['updated_at'].isoformat()

            cod = str(m.get('codigo') or '').strip()
            m['rentabilidad'] = {}
            label_to_period = [
                ('actual', periods['actual']),
                ('anterior', periods['anterior']),
                ('antepasado', periods['antepasado']),
                ('anio_anterior', periods['anio_anterior']),
                ('anterior_anio_anterior', periods['anterior_anio_anterior']),
            ]
            for label, per in label_to_period:
                rdoc = renta_idx.get(cod, {}).get(str(per))
                if rdoc:
                    m['rentabilidad'][label] = {
                        'cupro': rdoc.get('cupro'),
                        'total_costo': rdoc.get('total_costo'),
                        'total_margen': rdoc.get('total_margen'),
                        'total_venta': rdoc.get('total_venta'),
                        'margen': rdoc.get('margen'),
                        'cantidad': rdoc.get('cantidad'),
                    }
                else:
                    m['rentabilidad'][label] = None

            out_menus.append(_to_jsonable(m))

        if as_zip:
            buf = io.BytesIO()
            filename_json = f"menus_profitability_{mesano_anchor}.json"
            with zipfile.ZipFile(buf, mode='w', compression=zipfile.ZIP_DEFLATED) as zf:
                payload = json.dumps({ 'items': out_menus, 'count': len(out_menus) }, ensure_ascii=False).encode('utf-8')
                zf.writestr(filename_json, payload)
            buf.seek(0)
            zip_name = f"menus_profitability_{mesano_anchor}.zip"
            headers = { 'Content-Disposition': f'attachment; filename="{zip_name}"' }
            return StreamingResponse(buf, media_type='application/zip', headers=headers)

        return { 'items': out_menus, 'count': len(out_menus), 'periods': periods }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f'Error building menus profitability: {str(e)}')
