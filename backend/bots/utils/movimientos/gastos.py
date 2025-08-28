import logging
import re
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo
from typing import List, Dict, Tuple, Optional

from utils.web3mongo import db
from ..common.constants import EXCLUDED_CUENTAS
from ..common.common import get_link_info
from ..common.filters import grok_filters

logger = logging.getLogger(__name__)

# ---------------------------
# Helpers
# ---------------------------

def _wants_detail(text: str) -> Tuple[bool, int]:
    t = (text or "").lower()
    is_detail = any(w in t for w in ["detalle", "detall", "lista", "listado", "muestra", "mostrar", "primeros", "últimos", "ultimos", "top"])
    limit = 20
    if is_detail:
        m = re.search(r"\b(\d{1,3})\b", t)
        if m:
            try:
                n = int(m.group(1))
                if 1 <= n <= 200:
                    limit = n
            except Exception:
                pass
    return is_detail, limit

def _label_group(group_by: str) -> str:
    return "mes y sigla" if group_by == "mes_sigla" else ("sin agrupación" if group_by == "none" else group_by)

# ---------------------------
# Mongo helpers
# ---------------------------

def _regex_for_text(text: str, mode: str, is_regex: bool) -> str:
    if is_regex:
        return text
    esc = re.escape(text)
    if mode == "word":
        return rf"\b{esc}\b"
    if mode == "prefix":
        return rf"^{esc}"
    if mode == "suffix":
        return rf"{esc}$"
    # contains
    return esc

def _build_text_match(keyword: str, search_in: List[str], *, mode: str = "contains", logic: str = "any",
                      case_insensitive: bool = True, is_regex: bool = False) -> Optional[Dict]:
    if not keyword or not search_in:
        return None
    pattern = _regex_for_text(keyword, mode, is_regex)
    opt = "i" if case_insensitive else ""
    conds = []
    for fld in search_in:
        conds.append({
            "$expr": {
                "$regexMatch": {
                    "input": {"$toString": {"$ifNull": [f"${fld}", ""]}},
                    "regex": pattern,
                    "options": opt
                }
            }
        })
    if not conds:
        return None
    return ({"$or": conds} if logic == "any" else {"$and": conds})

def _query_gastos_raw(
    start: datetime,
    end: datetime,
    siglas: List[str],
    cuentas: List[int],
    *,
    keyword: str = "",
    search_in: Optional[List[str]] = None,
    text_mode: str = "contains",
    search_logic: str = "any",
    case_insensitive: bool = True,
    is_regex: bool = False,
    limit: int = 200,
    exclude_siglas: Optional[List[str]] = None,
    rut: Optional[int] = None
) -> List[dict]:
    search_in = search_in or ["resumen2", "resumen", "tipo_gasto", "glosa", "detalle"]

    pipeline: List[Dict] = [
        {"$addFields": {
            "fecha_norm": {
                "$cond": [
                    {"$eq": [{"$type": "$fecha_pago"}, "date"]},
                    "$fecha_pago",
                    {"$toDate": "$fecha_pago"}
                ]
            }
        }},
        {"$match": {"fecha_norm": {"$gte": start, "$lt": end}}},
        {"$addFields": {"cuenta_str": {"$toString": "$cuenta"}}},
        {"$match": {"cuenta_str": {"$nin": EXCLUDED_CUENTAS}}},
    ]

    if isinstance(rut, int) and rut > 0:
        pipeline += [{"$match": {"rut": rut}}]

    if siglas or (exclude_siglas or []):
        pipeline += [{"$addFields": {"_sigla_up": {"$toUpper": {"$ifNull": ["$sigla", ""]}}}}]
    if siglas:
        pipeline += [{"$match": {"_sigla_up": {"$in": siglas}}}]
    if exclude_siglas:
        pipeline += [{"$match": {"_sigla_up": {"$nin": exclude_siglas}}}]

    if cuentas:
        pipeline += [
            {"$addFields": {"cuenta_int": {"$toInt": "$cuenta"}}},
            {"$match": {"$or": [
                {"cuenta_str": {"$in": [str(c) for c in cuentas]}},
                {"cuenta_int": {"$in": cuentas}},
            ]}},
        ]

    text_match = _build_text_match(keyword, search_in, mode=text_mode, logic=search_logic,
                                   case_insensitive=case_insensitive, is_regex=is_regex)
    if text_match:
        pipeline += [{"$match": text_match}]

    pipeline += [
        {"$project": {
            "_id": {"$toString": "$_id"},
            "fecha_pago": {"$dateToString": {"format": "%Y-%m-%d", "date": "$fecha_norm"}},
            "sigla": 1,
            "id_sucursal": 1,
            "cuenta": 1,
            "nombre_cuenta": 1,
            "resumen2": 1,
            "resumen": 1,
            "tipo_gasto": 1,
            "glosa": 1,
            "detalle": 1,
            "cargo": {"$ifNull": ["$cargo", 0]},
            "abono": {"$ifNull": ["$abono", 0]},
        }},
        {"$sort": {"fecha_pago": 1, "_id": 1}},
        {"$limit": int(limit)},
    ]
    return list(db.gastos_intranet.aggregate(pipeline))

def _query_gastos_grouped(
    start: datetime,
    end: datetime,
    siglas: List[str],
    cuentas: List[int],
    *,
    keyword: str,
    search_in: Optional[List[str]],
    text_mode: str = "contains",
    search_logic: str = "any",
    case_insensitive: bool = True,
    is_regex: bool = False,
    group_by: str,
    exclude_siglas: Optional[List[str]] = None,
    rut: Optional[int] = None
) -> List[dict]:
    search_in = search_in or ["resumen2", "resumen", "tipo_gasto", "glosa", "detalle"]

    if group_by == "mes":
        group_expr = {"$dateToString": {"format": "%Y-%m", "date": "$fecha_norm"}}
    elif group_by == "sigla":
        group_expr = {"$toUpper": {"$ifNull": ["$sigla", "-"]}}
    elif group_by == "cuenta":
        group_expr = {"$concat": [{"$toString": {"$ifNull": ["$cuenta", "-"]}}, ": ", {"$ifNull": ["$nombre_cuenta", ""]}]}
    elif group_by == "mes_sigla":
        group_expr = {
            "$concat": [
                {"$dateToString": {"format": "%Y-%m", "date": "$fecha_norm"}},
                " | ",
                {"$toUpper": {"$ifNull": ["$sigla", "-"]}},
            ]
        }
    else:
        return []

    pipeline: List[Dict] = [
        {"$addFields": {
            "fecha_norm": {
                "$cond": [
                    {"$eq": [{"$type": "$fecha_pago"}, "date"]},
                    "$fecha_pago",
                    {"$toDate": "$fecha_pago"}
                ]
            }
        }},
        {"$match": {"fecha_norm": {"$gte": start, "$lt": end}}},
        {"$addFields": {"cuenta_str": {"$toString": "$cuenta"}}},
        {"$match": {"cuenta_str": {"$nin": EXCLUDED_CUENTAS}}},
    ]

    if isinstance(rut, int) and rut > 0:
        pipeline += [{"$match": {"rut": rut}}]

    if siglas or (exclude_siglas or []):
        pipeline += [{"$addFields": {"_sigla_up": {"$toUpper": {"$ifNull": ["$sigla", ""]}}}}]
    if siglas:
        pipeline += [{"$match": {"_sigla_up": {"$in": siglas}}}]
    if exclude_siglas:
        pipeline += [{"$match": {"_sigla_up": {"$nin": exclude_siglas}}}]

    if cuentas:
        pipeline += [
            {"$addFields": {"cuenta_int": {"$toInt": "$cuenta"}}},
            {"$match": {"$or": [
                {"cuenta_str": {"$in": [str(c) for c in cuentas]}},
                {"cuenta_int": {"$in": cuentas}},
            ]}},
        ]

    text_match = _build_text_match(keyword, search_in, mode=text_mode, logic=search_logic,
                                   case_insensitive=case_insensitive, is_regex=is_regex)
    if text_match:
        pipeline += [{"$match": text_match}]

    pipeline += [
        {"$project": {"cargo": {"$ifNull": ["$cargo", 0]}, "abono": {"$ifNull": ["$abono", 0]}, "group": group_expr}},
        {"$group": {"_id": "$group", "total_cargo": {"$sum": "$cargo"}, "total_abono": {"$sum": "$abono"}, "count": {"$sum": 1}}},
        {"$project": {"_id": 0, "group": "$_id", "total_cargo": 1, "total_abono": 1, "count": 1}},
        {"$sort": {"group": 1}},
    ]
    return list(db.gastos_intranet.aggregate(pipeline))

def _totals(rows: List[dict]) -> Tuple[float, float, int]:
    cargo = sum((r.get("cargo") or 0) for r in rows)
    abono = sum((r.get("abono") or 0) for r in rows)
    return float(cargo), float(abono), len(rows)

# ---------------------------
# Handler principal (obedece al SPEC)
# ---------------------------

async def handle_gastos(update, context):
    text = update.message.text or ""

    # Enforce Telegram-Privy link
    tg_user = update.effective_user
    tg_id = tg_user.id if tg_user else None
    logger.info(f"[gastos_handler] incoming tg_id={tg_id}, text='{text}'")
    link = get_link_info(tg_id) if tg_id else None
    if not link:
        return (update, ["Primero conecta tu cuenta con Privy para ver gastos. Usa /link."])
    if link.get("expired"):
        return (update, ["Tu sesión de Privy expiró. Usa /link para volver a conectar y después pide 'gastos'."])

    # === 1) Pedir TODO a Grok (incluye periodo) ===
    gf = await grok_filters("gastos", text) or {}
    logger.info(f"[gastos] spec_raw => {gf}")

    period = gf.get("period") or {}
    start_iso = (period.get("start") or "").strip()
    end_iso   = (period.get("end") or "").strip()
    tz_name   = (period.get("tz") or "America/Santiago").strip() or "America/Santiago"

    if not (start_iso and end_iso):
        return (update, ["Nonna no entendió el periodo. Ej: 'este año', 'este mes' o '2025-08-01 a 2025-08-15'."]) 

    try:
        tz = ZoneInfo(tz_name)
    except Exception:
        tz = ZoneInfo("America/Santiago")

    try:
        s = datetime.fromisoformat(start_iso).date()
        e = datetime.fromisoformat(end_iso).date()
    except Exception:
        return (update, ["El periodo tiene formato inválido. Usa YYYY-MM-DD."])

    # Inclusivo [start, end] => end_excl = end + 1 día
    start = datetime.combine(s, datetime.min.time()).replace(tzinfo=tz).replace(tzinfo=None)
    end   = (datetime.combine(e, datetime.min.time()).replace(tzinfo=tz) + timedelta(days=1)).replace(tzinfo=None)

    # (YoY opcional)
    v = gf.get("view") or {}
    do_yoy = bool(v.get("yoy", True))
    try:
        start_prev = start.replace(year=start.year - 1)
        end_prev   = end.replace(year=end.year - 1)
    except ValueError:
        start_prev = start - timedelta(days=365)
        end_prev   = end - timedelta(days=365)

    # === 2) Filtros & vista ===
    group_by = (gf.get("group_by") or "auto").lower().strip()

    f = gf.get("filters") or {}
    keyword = (f.get("text") or "").strip()
    search_in = f.get("search_in") or ["resumen2", "resumen", "tipo_gasto", "glosa", "detalle"]
    text_mode = (f.get("text_mode") or "contains").lower()
    search_logic = (f.get("search_logic") or "any").lower()
    case_insensitive = bool(f.get("case_insensitive", True))
    is_regex = bool(f.get("is_regex", False))
    siglas = [str(s).upper() for s in (f.get("include_siglas") or []) if s]
    exclude_siglas = [str(s).upper() for s in (f.get("exclude_siglas") or []) if s]
    cuentas = [int(c) for c in (f.get("include_cuentas") or []) if str(c).strip().isdigit()]
    rut_val = f.get("rut")
    rut = int(rut_val) if isinstance(rut_val, int) and rut_val > 0 else None

    want_detail = bool(v.get("detail", False))
    limit_groups = int(v.get("limit_groups", 60))
    limit_rows = int(v.get("limit_rows", 120))
    include_fields = v.get("include_fields") or []

    # Respetar "detalle 50" del texto libre
    is_detail_text, detail_cap = _wants_detail(text)
    if is_detail_text:
        want_detail = True
        limit_rows = max(limit_rows, detail_cap)

    # Si vienen cuentas, evita intersección vacía con texto
    if cuentas and keyword:
        # preferimos las cuentas explícitas; si quieres intersectar, puedes quitar esta rama
        keyword = ""

    # Resolver 'auto'
    if group_by == "auto":
        group_by = "mes" if not want_detail else "none"

    logger.info("[gastos] spec => %s..%s tz=%s | group_by=%s | text='%s' in=%s mode=%s logic=%s ci=%s regex=%s | siglas=%s excl=%s cuentas=%s rut=%s | view(detail=%s,yoy=%s,groups=%s,rows=%s,cols=%s)",
                start_iso, end_iso, tz_name, group_by, keyword, search_in, text_mode, search_logic, case_insensitive, is_regex,
                siglas, exclude_siglas, cuentas, rut, want_detail, do_yoy, limit_groups, limit_rows, include_fields)

    # Persistir para siguientes turnos
    context.user_data["gastos_siglas"] = siglas
    context.user_data["gastos_siglas_excl"] = exclude_siglas
    context.user_data["gastos_cuentas"] = cuentas
    context.user_data["gastos_rut"] = rut

    # === 3) Respuesta ===
    start_s, end_s = start_iso, end_iso

    # (A) Agrupado
    if group_by in {"mes", "sigla", "cuenta", "mes_sigla"} and not want_detail:
        grouped = _query_gastos_grouped(
            start, end, siglas, cuentas,
            keyword=keyword, search_in=search_in,
            text_mode=text_mode, search_logic=search_logic,
            case_insensitive=case_insensitive, is_regex=is_regex,
            group_by=group_by, exclude_siglas=exclude_siglas, rut=rut
        )

        # ⚠️ SIN fail-open: si no hay matches con texto, no devolvemos todo el mundo.
        label_by = _label_group(group_by)
        filt_bits = []
        if siglas:         filt_bits.append(f"siglas: {', '.join(siglas)}")
        if exclude_siglas: filt_bits.append(f"sin: {', '.join(exclude_siglas)}")
        if not rut and cuentas:  filt_bits.append(f"cuentas: {', '.join([str(c) for c in cuentas])}")
        if rut:            filt_bits.append(f"rut: {rut}")
        if keyword:        filt_bits.append(f"q: {keyword} (in {', '.join(search_in)}; mode={text_mode})")
        filters_str = " | ".join(filt_bits) if filt_bits else "(sin filtros)"

        if not grouped:
            return (update, [f"Nonna Marriana dice: Sin movimientos en {start_s} a {end_s} agrupado por {label_by} {filters_str}."])

        grouped = grouped[:limit_groups]

        def _fmt_delta(cur: float, prev: float) -> str:
            if prev == 0 and cur == 0:
                return "Δ 0.0%"
            if prev == 0:
                return "Δ ∞"
            d = (cur - prev) / prev * 100.0
            arrow = "↑" if d > 0 else ("↓" if d < 0 else "→")
            return f"Δ {d:+.1f}% {arrow}"

        if do_yoy:
            prev_grouped = _query_gastos_grouped(
                start_prev, end_prev, siglas, cuentas,
                keyword=keyword, search_in=search_in,
                text_mode=text_mode, search_logic=search_logic,
                case_insensitive=case_insensitive, is_regex=is_regex,
                group_by=group_by, exclude_siglas=exclude_siglas, rut=rut
            )
            # Normalizar claves para alinear YoY (mes y mes_sigla deben ignorar el año)
            def _yoy_key(gkey: str) -> str:
                if group_by == "mes":
                    # 'YYYY-MM' -> 'MM'
                    parts = (gkey or "").split("-")
                    return parts[1] if len(parts) >= 2 else gkey
                if group_by == "mes_sigla":
                    # 'YYYY-MM | SIGLA' -> 'MM|SIGLA'
                    try:
                        month_part, sigla_part = (gkey or "").split(" | ", 1)
                        mm = month_part.split("-")[1]
                        return f"{mm}|{sigla_part}"
                    except Exception:
                        return gkey
                # sigla / cuenta: comparar tal cual
                return gkey

            prev_map = { _yoy_key(g.get("group")): g for g in prev_grouped }
            total_cur = sum((g.get("total_cargo") or 0) for g in grouped)
            total_prev = sum((prev_map.get(_yoy_key(g.get("group")), {}).get("total_cargo") or 0) for g in grouped)
            header = f"Nonna Marriana dice: Gastos {start_s} a {end_s} vs {start_prev.strftime('%Y-%m-%d')} a {end_prev.strftime('%Y-%m-%d')} agrupado por {label_by} {filters_str}."
            lines = [header]
            for g in grouped:
                grp = g.get('group')
                cur_c = float(g.get('total_cargo', 0) or 0)
                cur_a = float(g.get('total_abono', 0) or 0)
                cur_n = int(g.get('count', 0) or 0)
                pg = prev_map.get(_yoy_key(grp)) or {}
                prev_c = float(pg.get('total_cargo', 0) or 0)
                prev_a = float(pg.get('total_abono', 0) or 0)
                prev_n = int(pg.get('count', 0) or 0)
                lines.append(
                    f"- {grp}: cargo ${cur_c:,.0f} vs ${prev_c:,.0f} ({_fmt_delta(cur_c, prev_c)}), "
                    f"abono ${cur_a:,.0f} vs ${prev_a:,.0f}, items {cur_n} vs {prev_n}"
                )
            lines.append(f"= Total periodo: ${total_cur:,.0f} vs ${total_prev:,.0f} ({_fmt_delta(total_cur, total_prev)})")
            return (update, lines)
        else:
            total = sum((g.get("total_cargo") or 0) for g in grouped)
            lines = [f"Nonna Marriana dice: Gastos {start_s} a {end_s} agrupado por {label_by} {filters_str}."]
            for g in grouped:
                lines.append(f"- {g.get('group')}: cargo ${g.get('total_cargo', 0):,.0f}, abono ${g.get('total_abono', 0):,.0f}, items {g.get('count', 0)}")
            lines.append(f"= Total periodo: ${total:,.0f}")
            return (update, lines)

    # (B) Detalle
    cur_rows = _query_gastos_raw(
        start, end, siglas, cuentas,
        keyword=keyword, search_in=search_in,
        text_mode=text_mode, search_logic=search_logic,
        case_insensitive=case_insensitive, is_regex=is_regex,
        limit=max(20, limit_rows), exclude_siglas=exclude_siglas, rut=rut
    )
    # SIN reintento sin keyword: si pediste texto, respetamos el filtro.

    if do_yoy:
        prev_rows = _query_gastos_raw(
            start_prev, end_prev, siglas, cuentas,
            keyword=keyword, search_in=search_in,
            text_mode=text_mode, search_logic=search_logic,
            case_insensitive=case_insensitive, is_regex=is_regex,
            limit=200, exclude_siglas=exclude_siglas, rut=rut
        )
        cur_cargo, cur_abono, cur_count = _totals(cur_rows)
        prev_cargo, prev_abono, prev_count = _totals(prev_rows)
        start_prev_s = (datetime.fromisoformat(start_s).replace(year=datetime.fromisoformat(start_s).year - 1)).strftime("%Y-%m-%d")
        end_prev_s   = (datetime.fromisoformat(end_s  ).replace(year=datetime.fromisoformat(end_s  ).year - 1)).strftime("%Y-%m-%d")
    else:
        cur_cargo, cur_abono, cur_count = _totals(cur_rows)
        prev_cargo = prev_abono = prev_count = 0
        start_prev_s = end_prev_s = ""

    filt_bits = []
    if siglas:         filt_bits.append(f"siglas: {', '.join(siglas)}")
    if exclude_siglas: filt_bits.append(f"sin: {', '.join(exclude_siglas)}")
    if rut:
        cuentas_usadas = sorted({str(r.get('cuenta')) for r in cur_rows if r.get('cuenta')})
        if cuentas_usadas:
            filt_bits.append(f"cuentas: {', '.join(cuentas_usadas)}")
        filt_bits.append(f"rut: {rut}")
    else:
        if cuentas:    filt_bits.append(f"cuentas: {', '.join([str(c) for c in cuentas])}")
    if keyword:        filt_bits.append(f"q: {keyword} (in {', '.join(search_in)}; mode={text_mode})")
    filters_str = " | ".join(filt_bits) if filt_bits else "(sin filtros)"

    header = [f"Nonna Marriana dice: Gastos {start_s} a {end_s} {filters_str}."]
    if do_yoy:
        header[0] = f"Nonna Marriana dice: Gastos {start_s} a {end_s} vs {start_prev_s} a {end_prev_s} {filters_str}."
        header += [
            f"Actual: cargo ${cur_cargo:,.0f}, abono ${cur_abono:,.0f}, items {cur_count}.",
            f"Año pasado: cargo ${prev_cargo:,.0f}, abono ${prev_abono:,.0f}, items {prev_count}.",
        ]
    else:
        header += [f"Total: cargo ${cur_cargo:,.0f}, abono ${cur_abono:,.0f}, items {cur_count}."]

    lines = list(header)

    if cur_rows:
        lines += ["", "Detalle:"]
        show_n = limit_rows
        for r in cur_rows[:show_n]:
            extra_cols = []
            for col in include_fields:
                val = r.get(col)
                if val:
                    extra_cols.append(f"{col}: {val}")
            extra = (" | " + " · ".join(extra_cols)) if extra_cols else ""
            lines.append(
                f"- {r.get('fecha_pago','')} [{r.get('sigla') or '-'}] cta {r.get('cuenta')} "
                f"{r.get('resumen2') or ''}/{r.get('resumen') or ''}/{r.get('tipo_gasto') or ''}: "
                f"cargo ${ (r.get('cargo') or 0):,.0f}, abono ${ (r.get('abono') or 0):,.0f}{extra}"
            )
    else:
        lines += ["", "No hay ítems para mostrar con los filtros actuales."]

    return (update, lines)
