from fastapi import APIRouter, HTTPException, Request, Query
from typing import Optional, Any, Dict
from utils.web3mongo import db
from datetime import datetime
from bson import ObjectId
from apis.apikeys import validate_api_key

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
    return { 'items': out, 'count': len(out) }
