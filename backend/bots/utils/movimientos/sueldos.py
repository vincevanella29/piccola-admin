import logging, re
from datetime import datetime, date
from typing import List, Dict, Optional, Tuple

from utils.web3mongo import db
from ..common.common import get_link_info
from ..common.filters import grok_filters

logger = logging.getLogger(__name__)

# ---------------------------
# Helpers de fechas
# ---------------------------

def _yyyymm_last_month(now: Optional[datetime] = None) -> str:
    now = now or datetime.now()
    year = now.year
    month = now.month - 1
    if month == 0:
        year -= 1
        month = 12
    return f"{year:04d}{month:02d}"

def _parse_yyyymm(s: str) -> Tuple[int,int]:
    s = s.replace("-", "")
    return int(s[:4]), int(s[4:6])

def _yyyymm_prev_year(s: str) -> str:
    y,m = _parse_yyyymm(s)
    return f"{y-1:04d}{m:02d}"

def _iter_months(start_yyyymm: str, end_yyyymm: str) -> List[str]:
    y1,m1 = _parse_yyyymm(start_yyyymm)
    y2,m2 = _parse_yyyymm(end_yyyymm)
    out = []
    y,m = y1, m1
    while (y < y2) or (y == y2 and m <= m2):
        out.append(f"{y:04d}{m:02d}")
        m += 1
        if m == 13:
            m = 1
            y += 1
    return out

def _months_for_year(year: int, up_to_current: bool = False) -> List[str]:
    now = datetime.now()
    last_m = now.month if (up_to_current and year == now.year) else 12
    return [f"{year:04d}{m:02d}" for m in range(1, last_m + 1)]

def _expand_period_to_months(period: Dict) -> List[str]:
    # Prioridad: months[] > start/end > yyyymm > year(+preset) > fallback mes pasado
    months = [str(x).replace("-", "") for x in (period.get("months") or []) if re.fullmatch(r"\d{6}", str(x).replace("-", ""))]
    if months:
        return sorted(set(months))
    start = str(period.get("start") or "")
    end   = str(period.get("end") or "")
    if re.fullmatch(r"\d{6}", start.replace("-", "")) and re.fullmatch(r"\d{6}", end.replace("-", "")):
        return _iter_months(start.replace("-", ""), end.replace("-", ""))
    yyyymm = str(period.get("yyyymm") or "")
    if re.fullmatch(r"\d{6}", yyyymm.replace("-", "")):
        return [yyyymm.replace("-", "")]
    year = period.get("year")
    preset = (period.get("preset") or "").lower()
    if isinstance(year, int) and year > 0:
        if preset == "este_ano":
            return _months_for_year(year, up_to_current=True)
        elif preset == "ano_pasado":
            return _months_for_year(year, up_to_current=False)
        else:
            # año completo por defecto
            return _months_for_year(year, up_to_current=False)
    # fallback
    return [_yyyymm_last_month()]

# ---------------------------
# Otros helpers
# ---------------------------

def _amount_expr():
    return {
        "$ifNull": ["$sueldo_liquido_a_pago",
        {"$ifNull": ["$sueldo_liquido_mas_anticipo",
        {"$ifNull": ["$remuneracion_total",
        {"$ifNull": ["$monto_total",
        {"$ifNull": ["$monto_neto", 0]}]}]}]}]
    }

def _derive_sigla_expr():
    return {
        "$toUpper": {
            "$cond": [
                {"$gt": [{"$strLenCP": {"$ifNull": ["$centro_costo",""]}}, 2]},
                {"$substrCP": ["$centro_costo", 0, 3]},
                {"$ifNull": ["$sigla","-"]}
            ]
        }
    }

def _name_concat_expr():
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

# ---------------------------
# Perfil trabajador (helpers)
# ---------------------------

def _parse_date_ymd(s: str) -> Optional[date]:
    try:
        # acepta "YYYY-MM-DD" o "YYYY/MM/DD"
        s = (s or "").strip().replace("/", "-")
        y, m, d = [int(x) for x in s.split("-")]
        return date(y, m, d)
    except Exception:
        return None

def _calc_age(born_str: Optional[str]) -> Optional[int]:
    born = _parse_date_ymd(born_str) if isinstance(born_str, str) else None
    if not born:
        return None
    today = date.today()
    age = today.year - born.year - ((today.month, today.day) < (born.month, born.day))
    return age if 0 < age < 120 else None

def _fetch_worker_profile(rut_int: int) -> Optional[dict]:
    """
    Trae ficha básica de trabajadores_vpn y mapea sección desde cargos_intranet.
    Campos: nombres, apellidopaterno, apellidomaterno, sexo, afp, isapre,
    cargo, direccion, comuna, ciudad, fechanacimiento.
    """
    doc = db.trabajadores_vpn.find_one(
        {"rut": rut_int},
        {
            "_id": 0,
            "nombres": 1, "apellidopaterno": 1, "apellidomaterno": 1,
            "sexo": 1, "afp": 1, "isapre": 1,
            "cargo": 1, "direccion": 1, "comuna": 1, "ciudad": 1,
            "fechanacimiento": 1,
            "profile_image_url": 1,
        },
    )
    if not doc:
        return None

    nombre = " ".join([
        str(doc.get("nombres") or "").strip(),
        str(doc.get("apellidopaterno") or "").strip(),
        str(doc.get("apellidomaterno") or "").strip(),
    ]).strip()
    sexo = (doc.get("sexo") or "").strip().lower()
    if sexo in {"m", "f"}:
        sexo = sexo.upper()

    seccion = None
    cargo = (doc.get("cargo") or "").strip()
    if cargo:
        cr = db.cargos_intranet.find_one({"cargo": cargo}, {"_id": 0, "seccion": 1})
        seccion = (cr or {}).get("seccion")

    edad = _calc_age(doc.get("fechanacimiento"))

    direccion_bits = [
        str(doc.get("direccion") or "").strip(),
        str(doc.get("comuna") or "").strip(),
        str(doc.get("ciudad") or "").strip(),
    ]
    direccion = ", ".join([x for x in direccion_bits if x])

    return {
        "nombre": nombre or None,
        "sexo": sexo or None,
        "edad": edad,
        "afp": (doc.get("afp") or None),
        "isapre": (doc.get("isapre") or None),
        "cargo": cargo or None,
        "seccion": seccion or None,
        "direccion": direccion or None,
        "profile_image_url": (doc.get("profile_image_url") or None),
    }

def _match_period_yyyymm(yyyymm: str) -> Dict:
    return {"$or": [
        {"periodo": int(yyyymm)},
        {"mesano": yyyymm},
        {"mes_ano": yyyymm},
        {"periodo_str": yyyymm},
        {"periodo_str": f"{yyyymm[:4]}-{yyyymm[4:6]}"},
    ]}

def _match_periods(months: List[str]) -> Dict:
    return {"$or": [_match_period_yyyymm(m) for m in months]}

def _maybe_enrich_stages(need_fields: List[str]) -> List[Dict]:
    want_wv = any(k in need_fields for k in ["sexo","afp","isapre","cargo","nombre","name","name_text","nombres","apellidopaterno","apellidomaterno"])
    want_ci = any(k in need_fields for k in ["seccion"])
    stages: List[Dict] = []
    if want_wv:
        stages += [
            {"$addFields": {
                "rut_norm": {
                    "$toInt": {
                        "$ifNull": ["$rut_del_trabajador", {"$ifNull": ["$rut", "$rut_trabajador"]}]
                    }
                }
            }},
            {"$lookup": {
                "from": "trabajadores_vpn",
                "localField": "rut_norm",
                "foreignField": "rut",
                "as": "wv",
            }},
            {"$unwind": {"path": "$wv", "preserveNullAndEmptyArrays": True}},
            {"$addFields": {
                "sexo": {"$ifNull": ["$wv.sexo", None]},
                "afp": {"$ifNull": ["$wv.afp", None]},
                "isapre": {"$ifNull": ["$wv.isapre", None]},
                "cargo": {"$ifNull": ["$wv.cargo", None]},
                "nombre_completo": _name_concat_expr(),
            }},
        ]
    if want_ci:
        stages += [
            {"$lookup": {
                "from": "cargos_intranet",
                "let": {"carg": {"$ifNull": ["$cargo", None]}},
                "pipeline": [
                    {"$match": {"$expr": {"$eq": ["$cargo", "$$carg"]}}},
                    {"$project": {"_id":0, "seccion":1}}
                ],
                "as": "ci"
            }},
            {"$addFields": {"seccion": {"$ifNull": [{"$arrayElemAt": ["$ci.seccion", 0]}, None]}}},
            {"$project": {"ci":0}}
        ]
    return stages

def _text_match_name(name_text: str, fields: List[str]) -> Optional[Dict]:
    if not name_text: return None
    rx = re.escape(name_text)
    ors = []
    for f in fields:
        ors.append({f"$expr": {"$regexMatch": {
            "input": {"$toString": {"$ifNull": [f"$wv.{f}", ""]}},
            "regex": rx,
            "options": "i"
        }}})
    return {"$or": ors} if ors else None

def _build_group_expr(group_by: str) -> Dict:
    if group_by == "none": return {"$literal": "-"}
    if group_by == "mes": return {"$toString": {"$ifNull": ["$periodo", ""]}}
    if group_by == "sigla": return _derive_sigla_expr()
    if group_by == "seccion": return {"$ifNull": ["$seccion","-"]}
    if group_by == "cargo": return {"$ifNull": ["$cargo","-"]}
    if group_by == "sexo": return {"$toUpper": {"$ifNull": ["$sexo","-"]}}
    if group_by == "afp": return {"$ifNull": ["$afp","-"]}
    if group_by == "isapre": return {"$ifNull": ["$isapre","-"]}
    if group_by == "rut": return {"$toString": {"$ifNull": ["$rut_norm","-"]}}
    if group_by == "mes_sigla":
        return {"$concat": [{"$toString": {"$ifNull": ["$periodo",""]}}, " | ", _derive_sigla_expr()]}
    if group_by == "sigla_seccion":
        return {"$concat": [ _derive_sigla_expr(), " | ", {"$ifNull": ["$seccion","-"]}]}
    if group_by == "sigla_afp":
        return {"$concat": [ _derive_sigla_expr(), " | ", {"$ifNull": ["$afp","-"]}]}
    if group_by == "sigla_cargo":
        return {"$concat": [ _derive_sigla_expr(), " | ", {"$ifNull": ["$cargo","-"]}]}
    return {"$literal": "-"}

async def _send_chunks(update, lines: List[str], max_len: int = 3500):
    chunk, acc = [], 0
    for ln in lines:
        add = len(ln) + 1
        if acc + add > max_len and chunk:
            await update.message.reply_text("\n".join(chunk))
            chunk, acc = [], 0
        chunk.append(ln); acc += add
    if chunk:
        await update.message.reply_text("\n".join(chunk))

# ---------------------------
# Handler principal (SPEC-driven)
# ---------------------------

async def handle_sueldos(update, context):
    text = (update.message.text or "").lower()

    # Enforce link
    tg_user = update.effective_user
    tg_id = tg_user.id if tg_user else None
    logger.info(f"[sueldos_handler] incoming tg_id={tg_id}, text='{text}'")
    link = get_link_info(tg_id) if tg_id else None
    if not link:
        return update, ["Primero conecta tu cuenta con Privy para ver sueldos. Usa /link."]
    if link.get("expired"):
        return update, ["Tu sesión de Privy expiró. Usa /link para volver a conectar y después pide 'sueldos'."]

    # 1) SPEC (todo dinámico)
    spec = await grok_filters("sueldos", text) or {}
    logger.info(f"[sueldos] spec_raw => {spec}")

    period  = spec.get("period") or {}
    months  = _expand_period_to_months(period)
    group_by  = (spec.get("group_by") or "auto").lower()
    metric    = (spec.get("metric") or "sum").lower()
    order_by  = (spec.get("order_by") or "value_desc").lower()
    view      = spec.get("view") or {}
    detail    = bool(view.get("detail", False))
    limit_groups = int(view.get("limit_groups", 80))
    limit_rows   = int(view.get("limit_rows", 200))
    include_fields = view.get("include_fields") or []
    yoy       = bool(view.get("yoy", False))

    f = spec.get("filters") or {}
    include_siglas    = [s.upper() for s in (f.get("include_siglas") or [])]
    include_secciones = f.get("include_secciones") or []
    include_cargos    = f.get("include_cargos") or []
    include_ruts      = [int(x) for x in (f.get("include_ruts") or []) if isinstance(x, int)]
    sexo_in           = [s.lower() for s in (f.get("sexo_in") or []) if s.lower() in {"m","f"}]
    afp_in            = f.get("afp_in") or []
    isapre_in         = f.get("isapre_in") or []
    name_text         = f.get("name_text") or ""
    name_fields       = f.get("name_fields") or ["nombres","apellidopaterno","apellidomaterno"]

    # Fallback: si el texto trae "rut 12345678" y no vino include_ruts, lo agregamos
    if not include_ruts:
        m = re.search(r"\brut\s*([0-9\.\-kK]+)\b", text, flags=re.I)
        if m:
            rs = re.sub(r"[\.\-kK]", "", m.group(1))
            if len(rs) > 8: rs = rs[:-1]
            try:
                v = int(rs)
                if v > 0:
                    include_ruts = [v]
            except Exception:
                pass
        else:
            # si solo hay un número de 7-8 dígitos en la frase, úsalo como RUT
            m2 = re.search(r"\b(\d{7,8})\b", text)
            if m2:
                include_ruts = [int(m2.group(1))]

    # Si hay un solo RUT, prepara bloque de perfil
    single_rut = include_ruts[0] if len(include_ruts) == 1 else None
    worker_profile = _fetch_worker_profile(single_rut) if single_rut else None

    def _profile_lines() -> List[str]:
        if not worker_profile:
            return []
        p = worker_profile
        l1 = f"Trabajador: {p.get('nombre') or '(sin nombre)'} (RUT {single_rut})"
        bits2 = []
        if p.get("sexo"):   bits2.append(f"Sexo: {p['sexo']}")
        if p.get("edad") is not None: bits2.append(f"Edad: {p['edad']}")
        if p.get("afp"):    bits2.append(f"AFP: {p['afp']}")
        if p.get("isapre"): bits2.append(f"Isapre: {p['isapre']}")
        l2 = " | ".join(bits2) if bits2 else ""
        bits3 = []
        if p.get("cargo"):   bits3.append(f"Cargo: {p['cargo']}")
        if p.get("seccion"): bits3.append(f"Sección: {p['seccion']}")
        l3 = " | ".join(bits3) if bits3 else ""
        l4 = f"Dirección: {p['direccion']}" if p.get("direccion") else ""
        out = [l for l in [l1, l2, l3, l4] if l]
        return out + [""] if out else []

    def _profile_photo_item() -> Optional[dict]:
        if not worker_profile:
            return None
        url = worker_profile.get("profile_image_url")
        if not url:
            return None
        # Build a concise caption (keep under Telegram 1024 chars)
        p = worker_profile
        header = f"{p.get('nombre') or '(sin nombre)'} (RUT {single_rut})"
        bits = []
        if p.get("cargo"):   bits.append(p["cargo"])
        if p.get("seccion"): bits.append(p["seccion"])
        meta1 = " | ".join(bits)
        bits2 = []
        if p.get("sexo"):   bits2.append(f"Sexo {p['sexo']}")
        if p.get("edad") is not None: bits2.append(f"Edad {p['edad']}")
        if p.get("afp"):    bits2.append(f"AFP {p['afp']}")
        if p.get("isapre"): bits2.append(f"Isapre {p['isapre']}")
        meta2 = " | ".join(bits2)
        parts = [header]
        if meta1: parts.append(meta1)
        if meta2: parts.append(meta2)
        caption = "\n".join(parts)
        if len(caption) > 1024:
            caption = caption[:1023] + "…"
        return {"type": "photo", "url": url, "caption": caption}

    # Resolver 'auto'
    if group_by == "auto":
        group_by = "sigla" if not detail else "none"

    # 2) Pipeline base (multi-mes)
    stages: List[Dict] = [
        {"$match": _match_periods(months)},
        {"$addFields": {"amount": _amount_expr()}}
    ]

    # Enriquecimiento si se requieren campos derivados
    need_enrich = (
        group_by in {"seccion","cargo","sexo","afp","isapre","rut","sigla_seccion","sigla_afp","sigla_cargo"}
        or any([include_secciones, include_cargos, sexo_in, afp_in, isapre_in, include_ruts, name_text])
    )
    if need_enrich:
        stages += _maybe_enrich_stages(["sexo","afp","isapre","cargo","seccion","nombre","name_text"])

    # Filtros
    if include_siglas:
        stages += [{"$addFields": {"_sigla": _derive_sigla_expr()}},
                   {"$match": {"_sigla": {"$in": include_siglas}}}]
    if include_secciones:
        stages += [{"$match": {"seccion": {"$in": include_secciones}}}]
    if include_cargos:
        stages += [{"$match": {"cargo": {"$in": include_cargos}}}]
    if include_ruts:
        stages += [{"$addFields": {"rut_norm": {"$toInt": {"$ifNull": ["$rut_del_trabajador", {"$ifNull": ["$rut", "$rut_trabajador"]}]}}}},
                   {"$match": {"rut_norm": {"$in": include_ruts}}}]
    if sexo_in:
        stages += [{"$match": {"sexo": {"$in": sexo_in}}}]
    if afp_in:
        stages += [{"$match": {"afp": {"$in": afp_in}}}]
    if isapre_in:
        stages += [{"$match": {"isapre": {"$in": isapre_in}}}]
    nm = _text_match_name(name_text, name_fields)
    if nm:
        stages += [{"$match": nm}]

    # Etiqueta de periodo
    if len(months) == 1:
        pretty_period = f"{months[0][:4]}-{months[0][4:]}"
    else:
        y1, y2 = months[0][:4], months[-1][:4]
        m1, m2 = months[0][4:], months[-1][4:]
        pretty_period = f"{y1} ( {m1}–{m2} )" if y1 == y2 else f"{y1}-{m1}..{y2}-{m2}"

    # 3) Detalle o agrupado
    if group_by in {"none"} or detail:
        stages_detail = stages + [
            {"$addFields": {"sigla": _derive_sigla_expr()}},
            {"$project": {
                "_id": {"$toString":"$_id"},
                "periodo": 1, "sigla": 1, "centro_costo": 1,
                "rut": {"$ifNull": ["$rut_del_trabajador", {"$ifNull": ["$rut", "$rut_trabajador"]}]},
                "cargo": 1, "seccion": 1, "sexo": 1, "afp": 1, "isapre": 1,
                "amount": 1,
            }},
            {"$limit": int(max(10, limit_rows))}
        ]
        rows = list(db.pago_sueldos_intranet.aggregate(stages_detail))
        total = sum((r.get("amount") or 0) for r in rows)
        photo_item = _profile_photo_item()
        lines = _profile_lines() + [
                 f"Nonna Marriana dice: Sueldos {pretty_period} (detalle, máx {limit_rows}).",
                 f"Total ${total:,.0f}, ítems {len(rows)}.",
                 "", "Detalle:"]
        for r in rows:
            lines.append(
                f"- {r.get('periodo')} [{r.get('sigla')}] rut {r.get('rut')} "
                f"{r.get('seccion') or ''}/{r.get('cargo') or ''}/{(r.get('sexo') or '').upper() or ''} "
                f"afp {r.get('afp') or ''} isapre {r.get('isapre') or ''}: ${ (r.get('amount') or 0):,.0f}"
            )
        return update, ([photo_item] if photo_item else []) + lines

    # Agrupado
    group_expr = _build_group_expr(group_by)
    acc = {"$sum": 1} if metric == "count" else ({"$avg": "$amount"} if metric == "avg" else {"$sum": "$amount"})
    stages_group = stages + [
        {"$addFields": {"group": group_expr}},
        {"$group": {"_id": "$group", "value": acc, "count": {"$sum": 1}}},
    ]
    if (order_by or "").lower() == "group_asc":
        stages_group += [{"$sort": {"_id": 1}}]
    elif (order_by or "").lower() == "value_asc":
        stages_group += [{"$sort": {"value": 1}}]
    else:
        stages_group += [{"$sort": {"value": -1}}]
    stages_group += [{"$limit": int(max(5, limit_groups))}]
    grouped = list(db.pago_sueldos_intranet.aggregate(stages_group))

    yoy_line = ""
    if yoy:
        prev_months = [ _yyyymm_prev_year(m) for m in months ]
        stages_prev = [{"$match": _match_periods(prev_months)}, {"$addFields": {"amount": _amount_expr()}}]
        if need_enrich:
            stages_prev += _maybe_enrich_stages(["sexo","afp","isapre","cargo","seccion"])
        if include_siglas:    stages_prev += [{"$addFields": {"_sigla": _derive_sigla_expr()}},{"$match": {"_sigla": {"$in": include_siglas}}}]
        if include_secciones: stages_prev += [{"$match": {"seccion": {"$in": include_secciones}}}]
        if include_cargos:    stages_prev += [{"$match": {"cargo": {"$in": include_cargos}}}]
        if include_ruts:      stages_prev += [{"$addFields": {"rut_norm": {"$toInt": {"$ifNull": ["$rut_del_trabajador", {"$ifNull": ["$rut", "$rut_trabajador"]}]}}}}, {"$match": {"rut_norm": {"$in": include_ruts}}}]
        if sexo_in:           stages_prev += [{"$match": {"sexo": {"$in": sexo_in}}}]
        if afp_in:            stages_prev += [{"$match": {"afp": {"$in": afp_in}}}]
        if isapre_in:         stages_prev += [{"$match": {"isapre": {"$in": isapre_in}}}]
        if nm:                stages_prev += [{"$match": nm}]
        stages_prev += [{"$addFields": {"group": group_expr}}, {"$group": {"_id": "$group", "value": acc, "count": {"$sum": 1}}}]
        prev = {g["_id"]: g for g in db.pago_sueldos_intranet.aggregate(stages_prev)}
        cur_total = sum((g.get("value") or 0) for g in grouped)
        prev_total = sum((v.get("value") or 0) for v in prev.values())
        delta = cur_total - prev_total
        # toma año de la primera month
        y0 = months[0][:4]; ypy = f"{int(y0)-1}"
        m1, m2 = months[0][4:], months[-1][4:]
        yoy_line = f" | YoY {ypy}({m1}–{m2}): {prev_total:,.0f} → {cur_total:,.0f} (Δ {delta:,.0f})"

    label = {"sum":"suma", "avg":"promedio", "count":"cantidad"}[metric]
    label_by = group_by.replace("_"," y ")
    photo_item = _profile_photo_item()
    lines = _profile_lines() + [f"Nonna Marriana dice: Sueldos {pretty_period} agrupado por {label_by} ({label}){yoy_line}."]
    for g in grouped:
        v = g.get("value",0)
        if metric == "count":
            lines.append(f"- {g['_id']}: {int(v)} ítems")
        elif metric == "avg":
            lines.append(f"- {g['_id']}: ${v:,.0f} promedio ({g.get('count',0)} ítems)")
        else:
            lines.append(f"- {g['_id']}: ${v:,.0f} ({g.get('count',0)} ítems)")
    return update, ([photo_item] if photo_item else []) + lines
