import logging
import re
from datetime import datetime, date
from typing import List, Dict, Optional, Tuple, Any

from utils.web3mongo import db
from ..common.filters import grok_filters, _apply_sucursal_scope

logger = logging.getLogger(__name__)

# ---------------------------
# Constantes y Configuraciones
# ---------------------------

PAYROLL_FIELDS = [
    "remuneracion_imponible", "remuneracion_no_imponible", "remuneracion_total",
    "sueldo_liquido_a_pago", "sueldo_liquido_mas_anticipo", "monto_total", "monto_neto"
]

# Campos que, si se agrupan por ellos o se filtran, requieren hacer lookup a trabajadores_vpn
ENRICH_FIELDS_TRIGGER = [
    "seccion", "cargo", "sexo", "afp", "isapre", "rut", "rut_sigla",
    "sigla_seccion", "sigla_afp", "sigla_cargo", "nombre_completo", "nombre"
]

WORKER_DB_FIELDS = [
    "nombres", "apellidopaterno", "apellidomaterno", "sexo", "afp",
    "isapre", "cargo", "direccion", "comuna", "ciudad", "fechanacimiento",
    "profile_image_url"
]

# ---------------------------
# Helpers de Fechas y Texto
# ---------------------------

def _get_pretty_period(months: List[str]) -> str:
    if not months: return "Periodo Indefinido"
    if len(months) == 1:
        return f"{months[0][:4]}-{months[0][4:]}"
    
    # Ordenar para asegurar min/max correcto
    sorted_m = sorted(months)
    y1, y2 = sorted_m[0][:4], sorted_m[-1][:4]
    m1, m2 = sorted_m[0][4:], sorted_m[-1][4:]
    return f"{y1} ( {m1}–{m2} )" if y1 == y2 else f"{y1}-{m1}..{y2}-{m2}"

def _yyyymm_prev_year(s: str) -> str:
    try:
        y = int(s[:4])
        m = int(s[4:6])
        return f"{y-1:04d}{m:02d}"
    except:
        return s

# ---------------------------
# Helpers de Aggregation (Expresiones)
# ---------------------------

def _amount_expr():
    """Calcula el monto priorizando líquido a pago > total > neto."""
    return {
        "$ifNull": ["$sueldo_liquido_a_pago",
        {"$ifNull": ["$sueldo_liquido_mas_anticipo",
        {"$ifNull": ["$remuneracion_total",
        {"$ifNull": ["$monto_total",
        {"$ifNull": ["$monto_neto", 0]}]}]}]}]
    }

def _derive_sigla_expr():
    """Normaliza la sigla a 3 caracteres mayúsculas."""
    return {
        "$toUpper": {
            "$cond": [
                {"$gt": [{"$strLenCP": {"$toString": {"$ifNull": ["$centro_costo", ""]}}}, 2]},
                {"$substrCP": [{"$toString": {"$ifNull": ["$centro_costo", ""]}}, 0, 3]},
                {"$ifNull": ["$sigla","-"]}
            ]
        }
    }

def _name_concat_expr():
    """Concatena nombres para búsqueda o visualización."""
    return {
        "$trim": {
            "input": {
                "$concat": [
                    {"$ifNull": ["$wv.nombres", ""]}, " ",
                    {"$ifNull": ["$wv.apellidopaterno", ""]}, " ",
                    {"$ifNull": ["$wv.apellidomaterno", ""]}
                ]
            }
        }
    }

def _rut_norm_expr():
    """Normaliza el RUT a entero para cruces."""
    return {"$toInt": {"$ifNull": ["$rut_del_trabajador", {"$ifNull": ["$rut", "$rut_trabajador"]}]}}

# ---------------------------
# Builders de Pipeline (Modularizados)
# ---------------------------

def _match_period_yyyymm(yyyymm: str) -> Dict:
    """Genera match robusto para un mes específico en varios formatos de campo."""
    s = str(yyyymm or "").replace("-", "")[:6]
    if not s.isdigit() or len(s) != 6: return {"$or": []}
    s_dash = f"{s[:4]}-{s[4:6]}"
    return {"$or": [
        {"periodo": int(s)}, {"periodo": s},
        {"mesano": s}, {"mes_ano": s},
        {"periodo_str": s}, {"periodo_str": s_dash}
    ]}

def _match_periods(months: List[str]) -> Dict:
    """Genera match para una lista de meses."""
    if not months: return {"$match": {"periodo": -1}} # Fallback que no retorna nada
    return {"$or": [_match_period_yyyymm(m) for m in months]}

def _text_match_name(name_text: str, fields: List[str]) -> Optional[Dict]:
    """Match por regex insensible a mayúsculas en campos del trabajador."""
    if not name_text: return None
    rx = re.escape(name_text)
    return {"$or": [{f"$expr": {"$regexMatch": {"input": {"$toString": {"$ifNull": [f"$wv.{f}", ""]}}, "regex": rx, "options": "i"}}} for f in fields]}

def _maybe_enrich_stages(need_fields: List[str], force: bool = False) -> List[Dict]:
    """Agrega $lookup a trabajadores_vpn y cargos_intranet solo si es necesario."""
    # force=True se usa en vistas de detalle para asegurar que siempre tengamos la foto y datos
    want_wv = force or any(k in need_fields for k in WORKER_DB_FIELDS + ["nombre", "name", "name_text", "rut", "rut_sigla", "nombre_completo"])
    want_ci = force or any(k in need_fields for k in ["seccion", "sigla_seccion"])
    
    stages = []
    
    if want_wv:
        stages.extend([
            {"$addFields": {"rut_norm": _rut_norm_expr()}},
            {"$lookup": {"from": "trabajadores_vpn", "localField": "rut_norm", "foreignField": "rut", "as": "wv"}},
            {"$unwind": {"path": "$wv", "preserveNullAndEmptyArrays": True}},
            {"$addFields": {
                "sexo": {"$ifNull": ["$wv.sexo", None]},
                "afp": {"$ifNull": ["$wv.afp", None]},
                "isapre": {"$ifNull": ["$wv.isapre", None]},
                "cargo": {"$ifNull": ["$wv.cargo", None]},
                "nombre_completo": _name_concat_expr(),
                "profile_image_url": {"$ifNull": ["$wv.profile_image_url", None]},
                "worker": {
                    "rut": {"$ifNull": ["$rut_norm", None]},
                    **{k: {"$ifNull": [f"$wv.{k}", None]} for k in WORKER_DB_FIELDS}
                }
            }}
        ])
    
    if want_ci:
        stages.extend([
            {"$lookup": {
                "from": "cargos_intranet",
                "let": {"carg": {"$ifNull": ["$cargo", None]}},
                "pipeline": [{"$match": {"$expr": {"$eq": ["$cargo", "$$carg"]}}}, {"$project": {"_id":0, "seccion":1}}],
                "as": "ci"
            }},
            {"$addFields": {"seccion": {"$ifNull": [{"$arrayElemAt": ["$ci.seccion", 0]}, None]}}},
            {"$project": {"ci": 0}}
        ])
    return stages

def _build_group_expr(group_by: str) -> Dict:
    """Construye la expresión para el _id del $group."""
    exprs = {
        "none": {"$literal": "-"},
        "mes": {"$toString": {"$ifNull": ["$periodo", ""]}},
        "ano": {"$toString": {"$ifNull": [{"$toInt": {"$substrCP": [{"$toString": {"$ifNull": ["$periodo", "0"]}}, 0, 4]}}, ""]}},
        "sigla": _derive_sigla_expr(),
        "seccion": {"$ifNull": ["$seccion", "-"]},
        "cargo": {"$ifNull": ["$cargo", "-"]},
        "sexo": {"$toUpper": {"$ifNull": ["$sexo", "-"]}},
        "afp": {"$ifNull": ["$afp", "-"]},
        "isapre": {"$ifNull": ["$isapre", "-"]},
        "rut": {"$toString": {"$ifNull": ["$rut_norm", "-"]}}
    }
    
    if group_by in exprs: return exprs[group_by]
    
    # Combinaciones compuestas
    if "_" in group_by:
        parts = group_by.split("_")
        if len(parts) == 2:
            k1, k2 = parts
            e1 = exprs.get(k1, {"$literal": "-"})
            e2 = exprs.get(k2, {"$literal": "-"})
            if k1 == "rut": 
                # Formato legacy rut | sigla
                return {"$concat": [e1, " | ", _derive_sigla_expr()]}
            return {"$concat": [e1, " | ", e2]}

    return {"$literal": "-"}

def _build_filter_stages(f: Dict, name_text: str, name_fields: List[str], group_by: str = "auto") -> List[Dict]:
    """Construye las etapas de enriquecimiento y filtrado."""
    stages = []
    
    # 1. Determinar necesidad de enriquecimiento (Joins)
    need_enrich = (
        any(x in group_by for x in ENRICH_FIELDS_TRIGGER) or
        any([f.get("include_secciones"), f.get("include_cargos"), f.get("sexo_in"), 
             f.get("afp_in"), f.get("isapre_in"), f.get("include_ruts"), name_text])
    )
    
    if need_enrich:
        stages += _maybe_enrich_stages(ENRICH_FIELDS_TRIGGER)

    # 2. Aplicar Filtros
    if f.get("include_siglas"):
        stages += [{"$addFields": {"_sigla": _derive_sigla_expr()}},
                   {"$match": {"_sigla": {"$in": [s.upper() for s in f["include_siglas"]]}}}]
    
    if f.get("include_secciones"): stages += [{"$match": {"seccion": {"$in": f["include_secciones"]}}}]
    if f.get("include_cargos"): stages += [{"$match": {"cargo": {"$in": f["include_cargos"]}}}]
    
    if f.get("include_ruts"):
        # Asegurar rut_norm si no se enriqueció antes
        if not need_enrich: stages += [{"$addFields": {"rut_norm": _rut_norm_expr()}}]
        stages += [{"$match": {"rut_norm": {"$in": f["include_ruts"]}}}]
        
    if f.get("sexo_in"): stages += [{"$match": {"sexo": {"$in": f["sexo_in"]}}}]
    if f.get("afp_in"): stages += [{"$match": {"afp": {"$in": f["afp_in"]}}}]
    if f.get("isapre_in"): stages += [{"$match": {"isapre": {"$in": f["isapre_in"]}}}]
    
    if name_text:
        nm = _text_match_name(name_text, name_fields)
        if nm: stages += [{"$match": nm}]
        
    return stages

# ---------------------------
# Helpers de Perfil / Seguridad
# ---------------------------

def _calc_age(born_str: Optional[str]) -> Optional[int]:
    try:
        s = (born_str or "").strip().replace("/", "-")
        y, m, d = map(int, s.split("-"))
        born = date(y, m, d)
        today = date.today()
        return today.year - born.year - ((today.month, today.day) < (born.month, born.day))
    except:
        return None

def _fetch_worker_profile(rut_int: int) -> Optional[dict]:
    """Recupera perfil básico para mostrar en cabecera."""
    doc = db.trabajadores_vpn.find_one({"rut": rut_int}, {"_id": 0})
    if not doc: return None
    
    cargo = (doc.get("cargo") or "").strip()
    seccion = None
    if cargo:
        cr = db.cargos_intranet.find_one({"cargo": cargo}, {"_id": 0, "seccion": 1})
        seccion = (cr or {}).get("seccion")
        
    nombres_bits = [str(doc.get(k) or "").strip() for k in ["nombres", "apellidopaterno", "apellidomaterno"]]
    nombre = " ".join(filter(None, nombres_bits))
    sexo = (doc.get("sexo") or "").strip().upper()
    
    # Dirección
    dir_bits = [str(doc.get(k) or "").strip() for k in ["direccion", "comuna", "ciudad"]]
    
    return {
        "nombre": nombre or None, "sexo": sexo if len(sexo)==1 else None, 
        "edad": _calc_age(doc.get("fechanacimiento")),
        "afp": doc.get("afp"), "isapre": doc.get("isapre"),
        "cargo": cargo, "seccion": seccion,
        "direccion": ", ".join(filter(None, dir_bits)),
        "profile_image_url": doc.get("profile_image_url")
    }

def _profile_photo_item(worker_profile: Optional[dict], single_rut: int) -> Optional[dict]:
    if not worker_profile or not worker_profile.get("profile_image_url"): return None
    p = worker_profile
    header = f"{p.get('nombre') or 'Sin nombre'} (RUT {single_rut})"
    meta1 = " | ".join(filter(None, [p.get("cargo"), p.get("seccion")]))
    meta2 = " | ".join(filter(None, [
        f"Sexo {p['sexo']}" if p.get("sexo") else None,
        f"Edad {p['edad']}" if p.get("edad") else None,
        f"AFP {p['afp']}" if p.get("afp") else None,
        f"Isapre {p['isapre']}" if p.get("isapre") else None
    ]))
    caption = "\n".join(filter(None, [header, meta1, meta2]))
    if len(caption) > 1024: caption = caption[:1023] + "…"
    return {"type": "photo", "url": p["profile_image_url"], "caption": caption}

def _apply_security_filter_to_rows(rows: List[Dict], role_level: int, perms: Dict) -> List[Dict]:
    """
    Filtra filas en memoria para nivel 7.
    El nivel 7 solo puede ver filas donde el RUT coincida con su identidad.
    """
    if role_level != 7: return rows
    
    try:
        my_rut = int(perms.get("rut"))
    except:
        return [] # Si es nivel 7 y no tiene RUT en permisos, no ve nada

    def is_mine(r):
        # Verifica campo rut directo o dentro del objeto worker
        try:
            if r.get("rut") and int(str(r["rut"])) == my_rut: return True
            if r.get("worker") and r["worker"].get("rut") and int(str(r["worker"]["rut"])) == my_rut: return True
        except: pass
        return False
        
    return [r for r in rows if is_mine(r)]

# ---------------------------
# Sub-Handlers de Vistas
# ---------------------------

async def _handle_duplicates(update, months: List[str], f: Dict):
    """Detecta duplicados (mismo rut, mismo periodo) en la nómina."""
    # Pipeline específico para duplicados
    pipeline = [
        {"$match": _match_periods(months)},
        {"$addFields": {"amount": _amount_expr(), "_sigla": _derive_sigla_expr(), "rut_norm": _rut_norm_expr()}}
    ]
    
    if f.get("include_siglas"):
        pipeline.append({"$match": {"_sigla": {"$in": f["include_siglas"]}}})
        
    pipeline.extend([
        {"$group": {
            "_id": {"periodo": "$periodo", "rut": "$rut_norm"},
            "siglas": {"$addToSet": "$_sigla"},
            "count": {"$sum": 1},
            "total": {"$sum": "$amount"}
        }},
        {"$match": {"count": {"$gt": 1}}},
        {"$sort": {"_id.periodo": 1, "count": -1}},
        {"$limit": 200}
    ])
    
    dups = list(db.pago_sueldos_intranet.aggregate(pipeline))
    
    rows_out = []
    total_val, total_items = 0, 0
    for d in dups:
        cnt, tot = int(d.get("count", 0)), int(d.get("total", 0))
        rows_out.append({
            "periodo": d["_id"].get("periodo"),
            "rut": d["_id"].get("rut"),
            "siglas": ", ".join(sorted(filter(None, d.get("siglas", [])))) or "-",
            "count": cnt, "total": tot
        })
        total_val += tot; total_items += cnt
        
    payload = {
        "type": "data_table", "intent": "sueldos",
        "title": f"Sueldos {_get_pretty_period(months)}",
        "subtitle": "Duplicados por RUT en el mismo período",
        "kpis": [
            {"label": "Casos", "value": len(rows_out)},
            {"label": "Ítems", "value": total_items},
            {"label": "Total", "value": total_val, "isMoney": True},
        ],
        "columns": [
            {"key": "periodo", "label": "Periodo", "align": "left"},
            {"key": "rut", "label": "RUT", "align": "left"},
            {"key": "siglas", "label": "Siglas", "align": "left"},
            {"key": "count", "label": "Ítems", "align": "right", "format": "number"},
            {"key": "total", "label": "Total", "align": "right", "format": "money"},
        ],
        "rows": rows_out,
        "totals": {"count": total_items, "total": total_val}
    }
    return update, payload

async def _handle_detail_view(update, months: List[str], base_stages: List[Dict], limit_rows: int, role_level: int, perms: Dict, single_rut: Optional[int], include_ruts: List[int]):
    """Vista detalle fila a fila."""
    
    # 1. Asegurar enriquecimiento completo para detalle
    enrich_stages = _maybe_enrich_stages([], force=True)
    
    # 2. Proyección final
    project_stage = {
        "$project": {
            "_id": {"$toString":"$_id"},
            "periodo": 1, "sigla": 1, "centro_costo": 1,
            "rut": {"$ifNull": ["$rut_del_trabajador", {"$ifNull": ["$rut", "$rut_trabajador"]}]},
            "cargo": 1, "seccion": 1, "sexo": 1, "afp": 1, "isapre": 1, "amount": 1,
            "profile_image_url": 1, "worker": 1,
            **{k: {"$ifNull": [f"${k}", None]} for k in PAYROLL_FIELDS}
        }
    }
    
    pipeline = base_stages + enrich_stages + [{"$addFields": {"sigla": _derive_sigla_expr()}}] + [project_stage] + [{"$limit": int(max(10, limit_rows))}]
    
    rows = list(db.pago_sueldos_intranet.aggregate(pipeline))
    rows = _apply_security_filter_to_rows(rows, role_level, perms)
    
    pretty_period = _get_pretty_period(months)
    
    # Fallback: Si filtramos por RUT y no hay datos en el periodo, buscar histórico del RUT
    if not rows and single_rut:
        fallback_pipeline = [
            # Sin filtro de periodo
            {"$addFields": {"rut_norm": _rut_norm_expr(), "amount": _amount_expr()}},
            {"$match": {"rut_norm": single_rut}}
        ] + enrich_stages + [{"$addFields": {"sigla": _derive_sigla_expr()}}] + [project_stage] + [{"$sort": {"periodo": -1}}, {"$limit": limit_rows}]
        
        rows = list(db.pago_sueldos_intranet.aggregate(fallback_pipeline))
        rows = _apply_security_filter_to_rows(rows, role_level, perms) # Re-aplicar seguridad
        if rows:
            pretty_period = "Histórico (Todos los periodos)"

    # Cálculos finales
    total = sum((r.get("amount") or 0) for r in rows)
    count = len(rows)
    avg = (total / count) if count > 0 else 0
    
    kpis = [
        {"label": "Total", "value": int(total), "isMoney": True},
        {"label": "Ítems", "value": int(count)},
        {"label": "Promedio", "value": int(avg), "isMoney": True},
    ]
    
    columns = [
        {"key": "profile_image_url", "label": "Foto", "align": "center", "format": "image", "round": True},
        {"key": "periodo", "label": "Periodo", "align": "left"},
        {"key": "sigla", "label": "Sigla", "align": "left"},
        {"key": "rut", "label": "RUT", "align": "left"},
        {"key": "cargo", "label": "Cargo", "align": "left"},
        {"key": "seccion", "label": "Sección", "align": "left"},
        {"key": "sueldo_liquido_a_pago", "label": "Líquido", "align": "right", "format": "money"},
        {"key": "amount", "label": "Monto Calc.", "align": "right", "format": "money"},
    ]
    
    # Limpieza final de rows para la tabla
    rows_out = []
    for r in rows:
        r_out = r.copy()
        r_out["sexo"] = (str(r.get("sexo") or "").upper())
        if not r_out.get("profile_image_url") and r.get("worker"):
            r_out["profile_image_url"] = r["worker"].get("profile_image_url")
        rows_out.append(r_out)

    payload = {
        "type": "data_table", "intent": "sueldos",
        "title": f"Sueldos {pretty_period}",
        "subtitle": f"Detalle (máx {limit_rows})",
        "kpis": kpis, "columns": columns, "rows": rows_out,
        "totals": {"amount": int(total)},
    }
    return update, payload

async def _handle_grouped_view(update, months: List[str], base_stages: List[Dict], group_by: str, metric: str, order_by: str, yoy: bool, limit_groups: int, limit_rows: int, role_level: int, perms: Dict):
    """Vista agrupada (Pivot)."""
    
    group_expr = _build_group_expr(group_by)
    acc = {"$sum": 1} if metric == "count" else ({"$avg": "$amount"} if metric == "avg" else {"$sum": "$amount"})
    
    # Pipeline de agrupación
    pipeline = base_stages + [
        {"$addFields": {"group": group_expr, "_sigla": _derive_sigla_expr()}},
        {"$group": {
            "_id": "$group",
            "value": acc,
            "count": {"$sum": 1},
            # Muestras para drilldown
            "sample_rut": {"$first": {"$ifNull": ["$rut_norm", None]}},
            "sample_sigla": {"$first": "$_sigla"},
            "sample_name": {"$first": {"$ifNull": ["$nombre_completo", None]}},
            "sample_photo": {"$first": {"$ifNull": ["$profile_image_url", None]}},
            "sample_cargo": {"$first": {"$ifNull": ["$cargo", None]}},
            "sample_seccion": {"$first": {"$ifNull": ["$seccion", None]}},
        }}
    ]
    
    sort_k = "_id" if order_by == "group_asc" else "value"
    sort_d = 1 if order_by in ["group_asc", "value_asc"] else -1
    pipeline += [{"$sort": {sort_k: sort_d}}, {"$limit": limit_groups}]
    
    grouped = list(db.pago_sueldos_intranet.aggregate(pipeline))
    
    # Lógica YoY (Año contra Año)
    yoy_label = ""
    if yoy and months:
        prev_months = [_yyyymm_prev_year(m) for m in months]
        # Reconstruir pipeline base para el año anterior (con mismos filtros)
        # Nota: base_stages[0] es el match de periodo actual, lo reemplazamos
        prev_filters = base_stages[1:] # Filtros y adds sin el match de fecha
        prev_pipeline = [{"$match": _match_periods(prev_months)}] + prev_filters + [
            {"$addFields": {"group": group_expr}},
            {"$group": {"_id": "$group", "value": acc}}
        ]
        prev_data = {g["_id"]: g.get("value", 0) for g in db.pago_sueldos_intranet.aggregate(prev_pipeline)}
        
        curr_total = sum(g.get("value", 0) for g in grouped)
        prev_total = sum(prev_data.values())
        delta = curr_total - prev_total
        yoy_label = f"YoY Δ {delta:,.0f}"

    # Construcción de tabla
    label = {"sum":"Suma", "avg":"Promedio", "count":"Cant."}[metric]
    label_by = group_by.replace("_", " y ").title()
    
    columns = [
        {"key": "group", "label": label_by, "align": "left"},
        {"key": "value", "label": label, "align": "right", "format": "money" if metric != "count" else "number"},
        {"key": "count", "label": "Ítems", "align": "right", "format": "number"},
    ]
    
    # Si agrupa por RUT, agregamos columnas de trabajador
    if "rut" in group_by:
        columns = [{"key": "profile_image_url", "label": "Foto", "format": "image", "round": True}] + columns
    
    rows_out = []
    total_val, total_cnt = 0, 0
    
    for g in grouped:
        val = g.get("value", 0)
        cnt = g.get("count", 0)
        row = {"group": g.get("_id") or "-", "value": val, "count": cnt}
        
        # Enriquecer fila para UI
        if "rut" in group_by:
            row["profile_image_url"] = g.get("sample_photo")
            row["worker_obj"] = {
                "rut": g.get("sample_rut"),
                "name": g.get("sample_name"),
                "cargo": g.get("sample_cargo"),
                "seccion": g.get("sample_seccion")
            }
        
        # Drilldown modal si agrupa por Sigla
        if group_by == "sigla" and row["group"] != "-":
            # Reutilizar pipeline base para detalle de esta sigla
            # Se clona base_stages y se añade match sigla
            det_pipeline = base_stages + _maybe_enrich_stages([], force=True) + [
                {"$addFields": {"sigla": _derive_sigla_expr()}},
                {"$match": {"sigla": row["group"]}},
                {"$project": {
                    "_id": 0, "periodo": 1, "rut": {"$ifNull": ["$rut_norm", "$rut"]}, 
                    "worker": 1, "amount": 1, "cargo": 1, "seccion": 1
                }},
                {"$sort": {"amount": -1}},
                {"$limit": 20}
            ]
            det_rows = list(db.pago_sueldos_intranet.aggregate(det_pipeline))
            det_rows = _apply_security_filter_to_rows(det_rows, role_level, perms)
            
            if det_rows:
                row["detail_rows"] = det_rows
                row["detail_title"] = f"Detalle {row['group']}"
                row["detail_columns"] = [
                    {"key": "rut", "label": "RUT"},
                    {"key": "worker.nombres", "label": "Nombre"},
                    {"key": "amount", "label": "Monto", "format": "money"}
                ]

        rows_out.append(row)
        total_val += val
        total_cnt += cnt

    kpis = [
        {"label": "Total Global", "value": int(total_val), "isMoney": metric!="count"},
        {"label": "Registros", "value": int(total_cnt)},
        {"label": "Grupos", "value": len(rows_out)}
    ]
    if yoy_label:
        kpis.append({"label": "YoY Diff", "value": yoy_label})

    payload = {
        "type": "data_table", "intent": "sueldos",
        "title": f"Sueldos {_get_pretty_period(months)}",
        "subtitle": f"Agrupado por {label_by}",
        "kpis": kpis, "columns": columns, "rows": rows_out,
        "totals": {"value": int(total_val), "count": int(total_cnt)},
        "meta": {"group_by": group_by, "metric": metric}
    }
    return update, payload

# ---------------------------
# Handler Principal
# ---------------------------

async def handle_sueldos(update, context):
    """
    Handler principal de sueldos.
    Recibe el spec ya procesado en context.user_data['sueldos_spec'] gracias al engine.
    """
    text = (update.message.text or "").lower()
    
    # 1. Recuperar Spec (Engine ya lo inyectó, pero tenemos fallback)
    spec = context.user_data.get("sueldos_spec")
    if not spec:
        logger.warning("[handle_sueldos] Spec not in context, calling filter manually")
        spec = await grok_filters("sueldos", text) or {}

    logger.info(f"[sueldos] spec: {spec}")

    # 2. Extraer parámetros normalizados por el Spec
    period = spec.get("period") or {}
    months = period.get("months") or []
    
    # Asegurar que tenemos meses. Si no, usar mes pasado.
    if not months:
        # El postprocess del spec debería haberlo hecho, pero por seguridad:
        from utils.bot.common.filters import _norm # Importación lazy si necesaria
        # Recalcular meses si faltan (lógica simple fallback)
        if period.get("yyyymm"): months = [period["yyyymm"]]
        else: 
            now = datetime.now()
            lm = now.month - 1 or 12
            ly = now.year if now.month > 1 else now.year - 1
            months = [f"{ly:04d}{lm:02d}"]

    filters = spec.get("filters") or {}
    view = spec.get("view") or {}
    
    group_by = spec.get("group_by", "auto")
    metric = spec.get("metric", "sum")
    order_by = spec.get("order_by", "value_desc")

    # 3. Permisos y Scope (Sucursales y Nivel 7)
    perms = context.user_data.get("permissions") or {}
    role_level = context.user_data.get("role_level")
    try:
        role_level = int(role_level) if role_level is not None else 0
    except: role_level = 0

    # Aplicar scope de sucursal (inyecta 'include_siglas' si corresponde)
    filters = _apply_sucursal_scope(filters, perms, role_level)

    # Scope Nivel 7 (RUT): El engine ya valida acceso 1-7, pero aquí forzamos el filtro de datos
    if role_level == 7 and perms.get("rut"):
        try:
            my_rut = int(perms["rut"])
            # Forzamos el filtro include_ruts para que MongoDB traiga solo lo necesario
            filters["include_ruts"] = [my_rut]
        except: pass

    # 4. Detectar modo de operación
    
    # A. Duplicados
    if "duplicad" in text:
        return await _handle_duplicates(update, months, filters)

    # B. Construcción Pipeline Base
    match_period = {"$match": _match_periods(months)}
    add_amount = {"$addFields": {"amount": _amount_expr()}}
    
    # Construir etapas de filtro y enriquecimiento centralizadas
    filter_stages = _build_filter_stages(
        filters, 
        name_text=filters.get("name_text"), 
        name_fields=filters.get("name_fields"),
        group_by=group_by
    )
    
    base_pipeline = [match_period, add_amount] + filter_stages

    # C. Determinar Vista (Detalle vs Agrupada)
    is_detail = group_by == "none" or view.get("detail")
    
    # Si es "auto" y hay filtro de RUT único, mostrar detalle
    single_rut = filters.get("include_ruts")[0] if len(filters.get("include_ruts") or []) == 1 else None
    if group_by == "auto":
        is_detail = True if (is_detail or single_rut) else False
        if not is_detail: group_by = "sigla" # Default group

    limit_rows = int(view.get("limit_rows", 200))
    limit_groups = int(view.get("limit_groups", 80))

    if is_detail:
        return await _handle_detail_view(
            update, months, base_pipeline, limit_rows, 
            role_level, perms, single_rut, filters.get("include_ruts")
        )
    else:
        return await _handle_grouped_view(
            update, months, base_pipeline, group_by, metric, order_by, 
            view.get("yoy"), limit_groups, limit_rows, role_level, perms
        )