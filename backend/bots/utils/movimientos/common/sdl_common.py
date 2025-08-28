import io
import logging
from typing import Dict, Optional, Tuple

from utils.web3mongo import db

try:
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
except Exception:  # pragma: no cover
    plt = None

log = logging.getLogger(__name__)

# --- Helpers ---------------------------------------------------------------

PER_FIELDS = ["periodo", "mesano", "mes_ano", "periodo_str"]
AMOUNT_FIELDS = [
    # preferidos en prod
    "sueldo_liquido_a_pago",
    "sueldo_liquido_mas_anticipo",
    # comunes
    "liquido", "monto_liquido", "monto_neto",
    "total", "monto_total", "remuneracion_total",
]
RUT_FIELDS_PAY = ["rut", "rut_del_trabajador", "rut_trabajador"]


def match_period_any(periodo: str) -> Dict:
    """Match periodo across multiple possible fields and formats (YYYYMM, int, YYYY-MM)."""
    ors = []
    # raw string YYYYMM
    ors += [{f: periodo} for f in PER_FIELDS]
    # dashed YYYY-MM
    yy, mm = periodo[:4], periodo[4:6]
    dash = f"{yy}-{mm}"
    ors += [{f: dash} for f in PER_FIELDS]
    # dashed short YYYY-M (no leading zero)
    try:
        mm_i = int(mm)
        dash_short = f"{yy}-{mm_i}"
        ors += [{f: dash_short} for f in PER_FIELDS]
    except Exception:
        pass
    # slashed YYYY/MM and YYYY/M
    slash = f"{yy}/{mm}"
    ors += [{f: slash} for f in PER_FIELDS]
    try:
        mm_i = int(mm)
        slash_short = f"{yy}/{mm_i}"
        ors += [{f: slash_short} for f in PER_FIELDS]
    except Exception:
        pass
    # as int
    try:
        p_int = int(periodo)
        ors += [{f: p_int} for f in PER_FIELDS]
    except Exception:
        pass
    return {"$or": ors}


def amount_expr() -> Dict:
    """Return a simple $ifNull cascade that coerces strings like '1.234.567' or '1.234,56'."""
    def clean_num(var_name: str) -> Dict:
        # toString -> remove thousand dots -> swap comma to dot -> toDouble
        return {
            "$toDouble": {
                "$replaceAll": {
                    "input": {
                        "$replaceAll": {
                            "input": {"$replaceAll": {"input": {"$toString": f"${var_name}"}, "find": ".", "replacement": ""}},
                            "find": ",",
                            "replacement": ".",
                        }
                    },
                    "find": " ",
                    "replacement": "",
                }
            }
        }

    expr = None
    for fld in AMOUNT_FIELDS:
        piece = {
            "$let": {
                "vars": {"v": {"$ifNull": [f"${fld}", None]}},
                "in": {
                    "$cond": [
                        {"$and": [{"$ne": ["$$v", None]}, {"$ne": ["$$v", ""]}]},
                        clean_num(fld),
                        None,
                    ]
                },
            }
        }
        expr = piece if expr is None else {"$ifNull": [expr, piece]}

    return {"$ifNull": [expr, 0]}


# --- Core queries ----------------------------------------------------------

def fetch_sueldos_period(periodo: str) -> Tuple[int, float]:
    """Count and total for one periodo. Fast and simple."""
    pipeline = [
        {"$match": match_period_any(periodo)},
        {"$project": {"amount": amount_expr()}},
        {"$group": {"_id": None, "total": {"$sum": "$amount"}, "count": {"$sum": 1}}},
    ]
    try:
        agg = list(db.pago_sueldos_intranet.aggregate(pipeline))
        log.info(f"agg: {agg}")
        if agg:
            return int(agg[0].get("count", 0)), float(agg[0].get("total", 0.0))
    except Exception as e:
        log.warning(f"agg failed: {e}")

    # fallback to count only
    cnt = db.pago_sueldos_intranet.count_documents(match_period_any(periodo))
    return int(cnt), 0.0


def fetch_gender_counts(periodo: str) -> Dict[str, int]:
    """Super simple gender join. If join fails, return {'u': count} so the donut still shows.
    Looks for sexo/genero in payroll first, else joins trabajadores by exact rut fields.
    """
    match = match_period_any(periodo)

    pipeline = [
        {"$match": match},
        # Normaliza RUT de planilla a dígitos solamente
        {"$addFields": {
            "rut_pay_raw": {"$ifNull": ["$rut_del_trabajador", {"$ifNull": ["$rut", "$rut_trabajador"]}]},
        }},
        {"$addFields": {
            "rut_pay_str": {"$toString": "$rut_pay_raw"}
        }},
        {"$addFields": {
            "rut_pay": {"$replaceAll": {"input": {"$replaceAll": {"input": {"$replaceAll": {"input": "$rut_pay_str", "find": ".", "replacement": ""}}, "find": "-", "replacement": ""}}, "find": " ", "replacement": ""}}
        }},
        {"$lookup": {
            "from": "trabajadores_vpn",
            "let": {"rut_pay": "$rut_pay"},
            "pipeline": [
                {"$addFields": {"rut_str": {"$toString": {"$ifNull": ["$rut", ""]}}}},
                {"$addFields": {"rut_norm": {"$replaceAll": {"input": {"$replaceAll": {"input": {"$replaceAll": {"input": "$rut_str", "find": ".", "replacement": ""}}, "find": "-", "replacement": ""}}, "find": " ", "replacement": ""}}}},
                {"$match": {"$expr": {"$eq": ["$rut_norm", "$$rut_pay"]}}},
                {"$project": {"sexo": 1, "genero": 1}},
            ],
            "as": "emp"
        }},
        {"$addFields": {
            "sexo_src": {"$ifNull": [
                {"$ifNull": ["$sexo", "$genero"]},
                {"$ifNull": [{"$arrayElemAt": ["$emp.sexo", 0]}, {"$arrayElemAt": ["$emp.genero", 0]}]},
            ]}
        }},
        {"$addFields": {
            "sx": {"$substrCP": [{"$toLower": {"$toString": {"$ifNull": ["$sexo_src", "u"]}}}, 0, 1]}
        }},
        {"$group": {
            "_id": None,
            "f": {"$sum": {"$cond": [{"$eq": ["$sx", "f"]}, 1, 0]}},
            "m": {"$sum": {"$cond": [{"$eq": ["$sx", "m"]}, 1, 0]}},
            "u": {"$sum": {"$cond": [{"$in": ["$sx", ["f", "m"]]}, 0, 1]}},
        }},
    ]

    try:
        g = list(db.pago_sueldos_intranet.aggregate(pipeline))
        if g:
            g0 = g[0]
            return {"f": int(g0.get("f", 0)), "m": int(g0.get("m", 0)), "u": int(g0.get("u", 0))}
    except Exception as e:
        log.warning(f"gender agg failed: {e}")

    # fallback: unknown = total docs
    total = db.pago_sueldos_intranet.count_documents(match)
    return {"f": 0, "m": 0, "u": int(total)}


# --- Plotting --------------------------------------------------------------

def render_summary_chart(periodo: str, count: int, total: float, gender: Dict[str, int]) -> Optional[io.BytesIO]:
    if plt is None:
        return None

    # Donut: ensure something is shown even if all unknown
    f = int(gender.get("f", 0)); m = int(gender.get("m", 0)); u = int(gender.get("u", 0))
    if f + m + u == 0:
        u = count  # show a single "Sin dato" slice

    labels = ["Mujeres", "Hombres", "Sin dato"]
    values = [f, m, u]

    fig, ax = plt.subplots(figsize=(5, 5), dpi=140)
    wedges, _ = ax.pie(values, labels=labels, autopct=lambda p: f"{p:.0f}%" if p >= 4 else "", startangle=90)
    ax.add_artist(plt.Circle((0, 0), 0.55, fc="white"))
    ax.set_title(f"Género · {periodo[:4]}-{periodo[4:6]}")
    ax.axis('equal')

    # Tiny footer text with totals
    text = f"Registros: {count}\nTotal: ${total:,.0f}"
    fig.text(0.5, 0.02, text, ha='center', va='bottom', fontsize=9)

    buf = io.BytesIO()
    fig.savefig(buf, format="png", bbox_inches="tight")
    plt.close(fig)
    buf.seek(0)
    return buf


# --- Public API ------------------------------------------------------------

def resumen_sueldos_mes_pasado() -> Dict:
    p = yyyymm_last_month()
    count, total = fetch_sueldos_period(p)
    gender = fetch_gender_counts(p)
    return {"periodo": p, "count": count, "total": total, "gender": gender}


def make_reply_text(periodo: str, count: int, total: float, gender: Dict[str, int]) -> str:
    yy, mm = periodo[:4], periodo[4:6]
    lines = [
        "Resumen de sueldos:",
        f"- {yy}-{mm}: {count} registros, total ${total:,.0f}",
        f"Género • Mujeres: {gender.get('f',0)}, Hombres: {gender.get('m',0)}, Sin dato: {gender.get('u',0)}",
    ]
    return "\n".join(lines)


# --- Detailed breakdown ---------------------------------------------------

def fetch_sueldos_detail(periodo: str) -> Dict:
    """Return a rich breakdown for a periodo.
    Includes:
    - Totales: monto, AFP, Salud, Descuentos legales, count
    - Por centro de costo (top 15): total, count, AFP
    - Género: conteo por 'f','m','u' y totales por monto
    - Top empleados por monto (top 10)
    Also logs debug counts to help validate aggregation.
    """
    match = match_period_any(periodo)

    # Global totals
    pipeline_totals = [
        {"$match": match},
        {"$project": {
            "amount": amount_expr(),
            "afp": {"$toDouble": {"$ifNull": ["$afp", 0]}},
            "salud": {"$add": [
                {"$toDouble": {"$ifNull": ["$salud_7_fonasa", 0]}},
                {"$toDouble": {"$ifNull": ["$isapre", 0]}},
                {"$toDouble": {"$ifNull": ["$isapre_sobre_7", 0]}},
            ]},
            "descuentos_legales": {"$toDouble": {"$ifNull": ["$descuentos_legales", 0]}},
        }},
        {"$group": {
            "_id": None,
            "count": {"$sum": 1},
            "total_amount": {"$sum": "$amount"},
            "total_afp": {"$sum": "$afp"},
            "total_salud": {"$sum": "$salud"},
            "total_desc_leg": {"$sum": "$descuentos_legales"},
        }},
    ]

    # By centro_costo
    pipeline_cc = [
        {"$match": match},
        {"$project": {
            "centro_costo": {"$ifNull": ["$centro_costo", "(sin centro)"]},
            "amount": amount_expr(),
            "afp": {"$toDouble": {"$ifNull": ["$afp", 0]}},
        }},
        {"$group": {
            "_id": "$centro_costo",
            "count": {"$sum": 1},
            "total": {"$sum": "$amount"},
            "afp": {"$sum": "$afp"},
        }},
        {"$sort": {"total": -1}},
        {"$limit": 15},
    ]

    # Gender breakdown with totals by amount
    pipeline_gender = [
        {"$match": match},
        {"$addFields": {
            "rut_pay_raw": {"$ifNull": ["$rut_del_trabajador", {"$ifNull": ["$rut", "$rut_trabajador"]}]},
        }},
        {"$addFields": {"rut_pay_str": {"$toString": "$rut_pay_raw"}}},
        {"$addFields": {"rut_pay": {"$replaceAll": {"input": {"$replaceAll": {"input": {"$replaceAll": {"input": "$rut_pay_str", "find": ".", "replacement": ""}}, "find": "-", "replacement": ""}}, "find": " ", "replacement": ""}}}},
        {"$lookup": {
            "from": "trabajadores_vpn",
            "let": {"rut_pay": "$rut_pay"},
            "pipeline": [
                {"$addFields": {"rut_str": {"$toString": {"$ifNull": ["$rut", ""]}}}},
                {"$addFields": {"rut_norm": {"$replaceAll": {"input": {"$replaceAll": {"input": {"$replaceAll": {"input": "$rut_str", "find": ".", "replacement": ""}}, "find": "-", "replacement": ""}}, "find": " ", "replacement": ""}}}},
                {"$match": {"$expr": {"$eq": ["$rut_norm", "$$rut_pay"]}}},
                {"$project": {"sexo": 1, "genero": 1, "fechanacimiento": 1}},
            ],
            "as": "emp"
        }},
        {"$addFields": {
            "sexo_src": {"$ifNull": [
                {"$ifNull": ["$sexo", "$genero"]},
                {"$ifNull": [{"$arrayElemAt": ["$emp.sexo", 0]}, {"$arrayElemAt": ["$emp.genero", 0]}]},
            ]},
            "amount": amount_expr(),
        }},
        {"$addFields": {"sx": {"$substrCP": [{"$toLower": {"$toString": {"$ifNull": ["$sexo_src", "u"]}}}, 0, 1]}}},
        {"$group": {
            "_id": "$sx",
            "count": {"$sum": 1},
            "total": {"$sum": "$amount"},
        }},
    ]

    # Age distribution (optional, best-effort)
    pipeline_age = [
        {"$match": match},
        {"$addFields": {
            "rut_pay_raw": {"$ifNull": ["$rut_del_trabajador", {"$ifNull": ["$rut", "$rut_trabajador"]}]},
        }},
        {"$addFields": {"rut_pay_str": {"$toString": "$rut_pay_raw"}}},
        {"$addFields": {"rut_pay": {"$replaceAll": {"input": {"$replaceAll": {"input": {"$replaceAll": {"input": "$rut_pay_str", "find": ".", "replacement": ""}}, "find": "-", "replacement": ""}}, "find": " ", "replacement": ""}}}},
        {"$lookup": {
            "from": "trabajadores_vpn",
            "let": {"rut_pay": "$rut_pay"},
            "pipeline": [
                {"$addFields": {"rut_str": {"$toString": {"$ifNull": ["$rut", ""]}}}},
                {"$addFields": {"rut_norm": {"$replaceAll": {"input": {"$replaceAll": {"input": {"$replaceAll": {"input": "$rut_str", "find": ".", "replacement": ""}}, "find": "-", "replacement": ""}}, "find": " ", "replacement": ""}}}},
                {"$match": {"$expr": {"$eq": ["$rut_norm", "$$rut_pay"]}}},
                {"$project": {"fechanacimiento": 1}},
            ],
            "as": "emp"
        }},
        {"$addFields": {
            "amount": amount_expr(),
            "birth": {"$arrayElemAt": ["$emp.fechanacimiento", 0]},
        }},
        {"$addFields": {
            "dob": {"$cond": [
                {"$gt": [{"$strLenCP": {"$toString": {"$ifNull": ["$birth", ""]}}}, 0]},
                {"$dateFromString": {"dateString": "$birth", "format": "%Y-%m-%d"}},
                None
            ]}
        }},
        {"$addFields": {
            "age": {"$cond": [
                {"$ne": ["$dob", None]},
                {"$dateDiff": {"startDate": "$dob", "endDate": "$$NOW", "unit": "year"}},
                None
            ]}
        }},
        {"$addFields": {
            "age_bucket": {
                "$switch": {
                    "branches": [
                        {"case": {"$and": [{"$ne": ["$age", None]}, {"$lt": ["$age", 25]}]}, "then": "<25"},
                        {"case": {"$and": [{"$ne": ["$age", None]}, {"$and": [{"$gte": ["$age", 25]}, {"$lt": ["$age", 35]}]}]}, "then": "25-34"},
                        {"case": {"$and": [{"$ne": ["$age", None]}, {"$and": [{"$gte": ["$age", 35]}, {"$lt": ["$age", 45]}]}]}, "then": "35-44"},
                        {"case": {"$and": [{"$ne": ["$age", None]}, {"$and": [{"$gte": ["$age", 45]}, {"$lt": ["$age", 55]}]}]}, "then": "45-54"},
                    ],
                    "default": "55+"
                }
            }
        }},
        {"$group": {
            "_id": "$age_bucket",
            "count": {"$sum": 1},
            "total": {"$sum": "$amount"},
        }},
    ]

    # Top employees by amount
    pipeline_top = [
        {"$match": match},
        {"$project": {
            "amount": amount_expr(),
            "centro_costo": {"$ifNull": ["$centro_costo", "(sin centro)"]},
            "rut": {"$ifNull": ["$rut_del_trabajador", {"$ifNull": ["$rut", "$rut_trabajador"]}]},
            "nombre": {"$ifNull": ["$nombre", ""]},
            "apellido_paterno": {"$ifNull": ["$apellido_paterno", ""]},
            "apellido_materno": {"$ifNull": ["$apellido_materno", ""]},
        }},
        {"$sort": {"amount": -1}},
        {"$limit": 10},
    ]

    try:
        tot = list(db.pago_sueldos_intranet.aggregate(pipeline_totals))
        cc = list(db.pago_sueldos_intranet.aggregate(pipeline_cc))
        gen = list(db.pago_sueldos_intranet.aggregate(pipeline_gender))
        # Age is best-effort; if it fails we proceed without it
        try:
            age = list(db.pago_sueldos_intranet.aggregate(pipeline_age))
        except Exception as _:
            age = []
        top = list(db.pago_sueldos_intranet.aggregate(pipeline_top))
        # Debug counts
        cnt_docs = db.pago_sueldos_intranet.count_documents(match)
        agg_cnt = int(tot[0]["count"]) if tot else 0
        log.info(f"[sueldos.detail] periodo={periodo} count_docs={cnt_docs} agg_count={agg_cnt}")
        return {
            "periodo": periodo,
            "totals": tot[0] if tot else {"count": 0, "total_amount": 0, "total_afp": 0, "total_salud": 0, "total_desc_leg": 0},
            "by_cc": cc,
            "by_gender": gen,
            "by_age": age,
            "top_employees": top,
        }
    except Exception as e:
        log.warning(f"[sueldos.detail] aggregation failed: {e}")
        return {"periodo": periodo, "totals": {"count": 0, "total_amount": 0, "total_afp": 0, "total_salud": 0, "total_desc_leg": 0}, "by_cc": [], "by_gender": [], "by_age": [], "top_employees": []}


def make_detail_text(detail: Dict) -> str:
    t = detail.get("totals", {})
    p = detail.get("periodo", "")
    yy, mm = p[:4], p[4:6]
    lines = [
        f"Detalle sueldos {yy}-{mm}",
        f"- Registros: {int(t.get('count', 0))}",
        f"- Total pagado: ${float(t.get('total_amount', 0)):,.0f}",
        f"- AFP: ${float(t.get('total_afp', 0)):,.0f}",
        f"- Salud: ${float(t.get('total_salud', 0)):,.0f}",
        f"- Descuentos legales: ${float(t.get('total_desc_leg', 0)):,.0f}",
    ]
    # Gender block
    gen = {d.get('_id','u'): d for d in (detail.get('by_gender') or [])}
    if gen:
        f = gen.get('f', {})
        m = gen.get('m', {})
        u = gen.get('u', {})
        lines.append("- Género:")
        lines.append(f"  • Mujeres: {int(f.get('count',0))} (${float(f.get('total',0)):,.0f})")
        lines.append(f"  • Hombres: {int(m.get('count',0))} (${float(m.get('total',0)):,.0f})")
        lines.append(f"  • Sin dato: {int(u.get('count',0))} (${float(u.get('total',0)):,.0f})")
    # Age block (optional)
    by_age = detail.get("by_age") or []
    if by_age:
        # order buckets
        order = {"<25": 0, "25-34": 1, "35-44": 2, "45-54": 3, "55+": 4}
        lines.append("- Edades:")
        for it in sorted(by_age, key=lambda x: order.get(x.get('_id'), 99)):
            bucket = it.get('_id') or 'N/D'
            lines.append(f"  • {bucket}: {int(it.get('count',0))} (${float(it.get('total',0)):,.0f})")
    by_cc = detail.get("by_cc", [])
    if by_cc:
        lines.append("- Top centros de costo (por total pagado):")
        for it in by_cc[:10]:
            cc = it.get("_id") or "(sin centro)"
            lines.append(f"  • {cc}: ${float(it.get('total', 0)):,.0f} ({int(it.get('count', 0))})")
    top = detail.get("top_employees", [])
    if top:
        lines.append("- Top sueldos:")
        for it in top:
            full = (f"{it.get('nombre','').strip()} {it.get('apellido_paterno','').strip()} {it.get('apellido_materno','').strip()}").strip()
            cc = it.get("centro_costo") or "(sin centro)"
            lines.append(f"  • {full or '(sin nombre)'} — {cc}: ${float(it.get('amount',0)):,.0f}")
    return "\n".join(lines)