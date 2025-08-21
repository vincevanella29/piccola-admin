import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query

from main import verify_session
from utils.web3mongo import db
from apis.roles import get_company_role_level

router = APIRouter()
logger = logging.getLogger(__name__)


def serialize_doc(doc: dict) -> dict:
    if not doc:
        return doc
    out = dict(doc)
    if "_id" in out:
        out["_id"] = str(out["_id"])
    return out


@router.get(
    "/sueldos",
    summary="Listado de sueldos con filtros (nivel 3 o 4)",
)
async def get_sueldos(
    rut: Optional[str] = Query(None, description="RUT numérico o string"),
    periodo: Optional[str] = Query(
        None,
        description="Periodo exacto en formato YYYYMM. Alternativamente use periodo_start/periodo_end para rango.",
        regex=r"^\d{6}$",
    ),
    periodo_start: Optional[str] = Query(
        None, description="Inicio de rango de periodo (YYYYMM)", regex=r"^\d{6}$"
    ),
    periodo_end: Optional[str] = Query(
        None, description="Fin de rango de periodo (YYYYMM)", regex=r"^\d{6}$"
    ),
    centro_costo: Optional[str] = Query(
        None, description="Centro de costo (id o nombre, según datos)"
    ),
    skip: int = Query(0, ge=0),
    limit: Optional[int] = Query(100, ge=1, le=1000),
    user: dict = Depends(verify_session),
):
    """
    Devuelve registros desde `pago_sueldos_intranet` con filtros opcionales:
    - rut: acepta string o numérico (se intenta ambos)
    - periodo: exacto YYYYMM, o rango con periodo_start/periodo_end (lexicográfico sobre YYYYMM)
    - centro_costo: intenta coincidir con posibles campos 'centro_costo' o 'id_centro_costo'

    Paginación con skip/limit. Requiere nivel de rol 3 o 4.
    """
    role_level = get_company_role_level(user.get("wallet"))
    if role_level not in [3, 4]:
        raise HTTPException(
            status_code=403, detail="Solo usuarios nivel 3 o 4 pueden ver sueldos"
        )

    match: dict = {}

    # Filtro por rut
    if rut:
        # Intentar con campos posibles y tipos string/int
        or_terms = [{"rut": rut}, {"rut_del_trabajador": rut}]
        try:
            rut_int = int(str(rut))
            or_terms += [{"rut": rut_int}, {"rut_del_trabajador": rut_int}]
        except ValueError:
            pass
        match["$or"] = or_terms if or_terms else [{"rut": rut}]

    # Filtro por periodo
    periodo_fields = ["periodo", "mesano", "mes_ano", "periodo_str"]  # campos posibles en documentos
    if periodo:
        # Coincidencia exacta en cualquiera de los campos conocidos
        p_or = [{f: periodo} for f in periodo_fields]
        # Formato alternativo con guión: YYYY-MM
        try:
            yy = str(periodo)[0:4]
            mm = str(periodo)[4:6]
            periodo_dash = f"{yy}-{mm}"
            p_or += [{f: periodo_dash} for f in periodo_fields]
        except Exception:
            pass
        try:
            periodo_int = int(periodo)
            p_or += [{f: periodo_int} for f in periodo_fields]
        except ValueError:
            pass
        if p_or:
            match.setdefault("$and", []).append({"$or": p_or})
    else:
        # Rango
        if periodo_start or periodo_end:
            # Comparación como string YYYYMM
            range_cond_str = {}
            if periodo_start:
                range_cond_str["$gte"] = periodo_start
            if periodo_end:
                range_cond_str["$lte"] = periodo_end
            range_ors = [{f: dict(range_cond_str)} for f in periodo_fields]

            # Comparación como int (para colecciones que guardan periodo/mesano como número)
            try:
                range_cond_int = {}
                if periodo_start:
                    range_cond_int["$gte"] = int(periodo_start)
                if periodo_end:
                    range_cond_int["$lte"] = int(periodo_end)
                if range_cond_int:
                    range_ors += [{f: dict(range_cond_int)} for f in periodo_fields]
            except ValueError:
                pass

            # Si es un único mes (start == end), intentar igualdad con formato YYYY-MM
            if periodo_start and periodo_end and periodo_start == periodo_end:
                try:
                    yy = str(periodo_start)[0:4]
                    mm = str(periodo_start)[4:6]
                    dash = f"{yy}-{mm}"
                    range_ors += [{f: dash} for f in periodo_fields]
                except Exception:
                    pass

            if range_ors:
                match.setdefault("$and", []).append({"$or": range_ors})

    # Filtro por centro de costo (intenta varios nombres de campo comunes)
    if centro_costo is not None:
        cc_or = [
            {"centro_costo": centro_costo},
            {"id_centro_costo": centro_costo},
            {"centro_costo_id": centro_costo},
        ]
        # Si parece número, intenta también como int
        try:
            cc_num = int(str(centro_costo))
            cc_or += [
                {"centro_costo": cc_num},
                {"id_centro_costo": cc_num},
                {"centro_costo_id": cc_num},
            ]
        except ValueError:
            pass
        match.setdefault("$and", []).append({"$or": cc_or})

    # Consulta
    cur = (
        db.pago_sueldos_intranet.find(match)
        .sort([("periodo", -1), ("rut", 1)])
        .skip(skip)
        .limit(limit if limit is not None else 100)
    )
    logger.info(f"Query: {match}")

    items = [serialize_doc(d) for d in cur]
    logger.info(f"Items: {items}")
    return {"count": len(items), "sueldos": items, "filters": match}
