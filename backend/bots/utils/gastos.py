import logging
import re
from datetime import datetime, timedelta
from typing import List, Dict, Tuple, Optional
from utils.web3mongo import db
from .constants import EXCLUDED_CUENTAS
from .common import get_link_info, grok_parse_dates
from .filters import grok_filters

logger = logging.getLogger(__name__)

# ---------------------------
# Helpers
# ---------------------------

def _is_yearish(start: datetime, end: datetime) -> bool:
    """Rango que luce anual: parte en 1-ene y abarca ~>300 días (este año o año completo)."""
    try:
        days = (end - start).days
        return (start.month == 1 and start.day == 1 and days >= 300)
    except Exception:
        return False

def _wants_detail(text: str) -> Tuple[bool, int]:
    """
    Detecta si el usuario pide detalle y, si corresponde, el límite (p.ej. 'primeros 10').
    Retorna (is_detail, limit). El limit solo aplica cuando is_detail=True.
    """
    t = (text or "").lower()
    detail_words = ["detalle", "detall", "lista", "listado", "muestra", "mostrar", "primeros", "últimos", "ultimos", "top"]
    is_detail = any(w in t for w in detail_words)

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

# Mapea una keyword libre a posibles números de cuenta usando el catálogo de referencias
def _cuentas_from_keyword(keyword: str, limit: int = 8) -> List[int]:
    if not keyword:
        return []
    rx = {"$regex": keyword, "$options": "i"}
    rows = list(db.gastos_refs_cuentas.find(
        {"$or": [
            {"resumen2": rx},
            {"resumen":  rx},
            {"nombre_cuenta": rx}
        ]},
        {"_id": 0, "cuenta": 1}
    ).sort("count_docs", -1).limit(limit))
    out = []
    for r in rows:
        try:
            out.append(int(str(r.get("cuenta")).strip()))
        except Exception:
            pass
    # dedupe preservando orden
    return list(dict.fromkeys(out))

# ---------------------------
# Mongo helpers
# ---------------------------

def _query_gastos_raw(
    start: datetime,
    end: datetime,
    siglas: List[str],
    cuentas: List[str],
    keyword: str = "",
    limit: int = 200,
    exclude_siglas: List[str] = None,
    rut: Optional[int] = None
) -> List[dict]:
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
        # Excluir cuentas globales no deseadas
        {"$addFields": {"cuenta_str": {"$toString": "$cuenta"}}},
        {"$match": {"cuenta_str": {"$nin": EXCLUDED_CUENTAS}}},
    ]

    # RUT solo válido (>0)
    if isinstance(rut, int) and rut > 0:
        pipeline += [{"$match": {"rut": rut}}]

    # Normalizar sigla y aplicar include/exclude
    if siglas or (exclude_siglas or []):
        pipeline += [{"$addFields": {"_sigla_up": {"$toUpper": {"$ifNull": ["$sigla", ""]}}}}]
    if siglas:
        pipeline += [{"$match": {"_sigla_up": {"$in": siglas}}}]
    if exclude_siglas:
        pipeline += [{"$match": {"_sigla_up": {"$nin": exclude_siglas}}}]

    if cuentas:
        pipeline += [
            {"$addFields": {"cuenta_str": {"$toString": "$cuenta"}, "cuenta_int": {"$toInt": "$cuenta"}}},
            {"$match": {"$or": [
                {"cuenta_str": {"$in": [str(c) for c in cuentas]}},
                {"cuenta_int": {"$in": [int(c) for c in cuentas]}},
            ]}},
        ]

    if keyword:
        pipeline += [{"$match": {"$or": [
            {"resumen2": {"$regex": keyword, "$options": "i"}},
            {"resumen":  {"$regex": keyword, "$options": "i"}},
            {"tipo_gasto":{"$regex": keyword, "$options": "i"}},
        ]}}]

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
            "cargo": {"$ifNull": ["$cargo", 0]},
            "abono": {"$ifNull": ["$abono", 0]},
        }},
        {"$sort": {"fecha_pago": 1, "_id": 1}},
        {"$limit": limit},
    ]
    return list(db.gastos_intranet.aggregate(pipeline))

def _query_gastos_grouped(
    start: datetime,
    end: datetime,
    siglas: List[str],
    cuentas: List[str],
    keyword: str,
    group_by: str,
    exclude_siglas: List[str] = None,
    rut: Optional[int] = None
) -> List[dict]:
    if group_by == "mes":
        group_expr = {"$dateToString": {"format": "%Y-%m", "date": "$fecha_norm"}}
    elif group_by == "sigla":
        group_expr = {"$toUpper": {"$ifNull": ["$sigla", "-"]}}
    elif group_by == "cuenta":
        group_expr = {
            "$concat": [
                {"$toString": {"$ifNull": ["$cuenta", "-"]}},
                ": ",
                {"$ifNull": ["$nombre_cuenta", ""]},
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
        # Excluir cuentas globales no deseadas
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
            {"$addFields": {"cuenta_str": {"$toString": "$cuenta"}, "cuenta_int": {"$toInt": "$cuenta"}}},
            {"$match": {"$or": [
                {"cuenta_str": {"$in": [str(c) for c in cuentas]}},
                {"cuenta_int": {"$in": [int(c) for c in cuentas]}},
            ]}},
        ]

    if keyword:
        pipeline += [{"$match": {"$or": [
            {"resumen2": {"$regex": keyword, "$options": "i"}},
            {"resumen":  {"$regex": keyword, "$options": "i"}},
            {"tipo_gasto":{"$regex": keyword, "$options": "i"}},
        ]}}]

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
# Handler principal
# ---------------------------

async def handle_gastos(update, context):
    text = update.message.text or ""

    # Enforce Telegram-Privy link
    tg_user = update.effective_user
    tg_id = tg_user.id if tg_user else None
    logger.info(f"[gastos_handler] incoming tg_id={tg_id}, text='{text}'")
    link = get_link_info(tg_id) if tg_id else None
    if not link:
        await update.message.reply_text("Primero conecta tu cuenta con Privy para ver gastos. Usa /link.")
        return
    if link.get("expired"):
        await update.message.reply_text("Tu sesión de Privy expiró. Usa /link para volver a conectar y después pide 'gastos'.")
        return

    # Fechas
    now = datetime.now()
    parsed = await grok_parse_dates(text, now)
    if not parsed:
        await update.message.reply_text("Nonna no entendió las fechas. Decime por ejemplo: 'ayer', 'este mes' o '2025-08-01 a 2025-08-15'.")
        return
    start, end, preset = parsed
    logger.info("[gastos] parsed dates -> start=%s end_excl=%s preset=%s", start, end, preset)
    if start.tzinfo: start = start.replace(tzinfo=None)
    if end.tzinfo:   end = end.replace(tzinfo=None)

    # Rango equivalente año anterior
    try:
        start_prev = start.replace(year=start.year - 1)
        end_prev   = end.replace(year=end.year - 1)
    except ValueError:
        start_prev = start - timedelta(days=365)
        end_prev   = end - timedelta(days=365)

    # Filtros genéricos (Grok)
    resolved = await grok_filters("gastos", text) or {}
    by = (resolved.get("by") or "").lower().strip()
    keyword = (resolved.get("q") or "").strip()
    siglas = [s.upper() for s in (resolved.get("include_siglas") or []) if s]
    exclude_siglas = [s.upper() for s in (resolved.get("exclude_siglas") or []) if s]
    cuentas = resolved.get("include_cuentas") or []
    rut_val = resolved.get("rut")
    rut = rut_val if isinstance(rut_val, int) and rut_val > 0 else None

    # Reusar filtros del turno anterior si ahora no vinieron
    if not cuentas and context.user_data.get("gastos_cuentas"):
        cuentas = context.user_data["gastos_cuentas"]
    if not siglas and context.user_data.get("gastos_siglas"):
        siglas = [s.upper() for s in context.user_data["gastos_siglas"]]
    if not exclude_siglas and context.user_data.get("gastos_siglas_excl"):
        exclude_siglas = [s.upper() for s in context.user_data["gastos_siglas_excl"]]
    if rut is None and context.user_data.get("gastos_rut"):
        rut = context.user_data["gastos_rut"]

    # Si vienen cuentas mapeadas desde categoría (p. ej. 'familia'), NO apliques keyword (evita intersección vacía)
    if cuentas:
        keyword = ""

    # PRIORIDAD: si hay cuentas, NO uses keyword; si no hay, intenta mapear q->cuentas
    if not cuentas and keyword:
        mapped = _cuentas_from_keyword(keyword)
        if mapped:
            cuentas = mapped
            keyword = ""  # importante para no intersectar y vaciar el set

    # ¿El usuario quiere DETALLE?
    is_detail, detail_limit = _wants_detail(text)

    # Política de agrupación por defecto:
    # - Si NO pide detalle y el rango es ANUAL (este año/año pasado) o hay RUT => agrupar por CUENTA.
    # - Si el usuario pidió explícitamente 'por mes'/'por sigla'/'por cuenta', se respeta.
    # Respetar "por mes" aunque el modelo no lo marque
    tlow = (text or "").lower()
    if "por mes" in tlow:
        by = "mes"

    if by in {"mes", "sigla", "cuenta"}:
        default_by = by
    else:
        if not is_detail and (_is_yearish(start, end) or rut is not None):
            default_by = "cuenta"
        else:
            default_by = ""  # sin agrupar (p. ej., rangos cortos si no pidió detalle ni RUT ni año)
    by = default_by

    logger.info("[gastos] filtros => by=%s q=%s siglas=%s exclude_siglas=%s cuentas=%s rut=%s", by, keyword, siglas, exclude_siglas, cuentas, rut)

    # Persistir filtros para próximos turnos
    context.user_data["gastos_cuentas"] = cuentas
    context.user_data["gastos_siglas"] = siglas
    context.user_data["gastos_siglas_excl"] = exclude_siglas
    context.user_data["gastos_rut"] = rut

    # --- Salidas ---

    # 1) Agrupado (totales por grupo)
    if by in {"mes", "sigla", "cuenta"} and not is_detail:
        grouped = _query_gastos_grouped(start, end, siglas, cuentas, keyword, by, exclude_siglas=exclude_siglas, rut=rut)
        start_s = start.strftime("%Y-%m-%d")
        end_s = (end - timedelta(days=1)).strftime("%Y-%m-%d")
        filt = []
        if siglas:        filt.append(f"siglas: {', '.join(siglas)}")
        if exclude_siglas: filt.append(f"sin: {', '.join(exclude_siglas)}")
        if cuentas:       filt.append(f"cuentas: {', '.join([str(c) for c in cuentas])}")
        if rut:           filt.append(f"rut: {rut}")
        if keyword:       filt.append(f"q: {keyword}")
        filters_str = " | ".join(filt) if filt else "(sin filtros)"

        if not grouped:
            await update.message.reply_text(
                f"Nonna Marriana dice: Sin movimientos en {start_s} a {end_s} agrupado por {by} {filters_str}."
            )
            return

        lines = [f"Nonna Marriana dice: Gastos {start_s} a {end_s} agrupado por {by} {filters_str}."]
        for g in grouped[:72]:
            lines.append(f"- {g.get('group')}: cargo ${g.get('total_cargo', 0):,.0f}, abono ${g.get('total_abono', 0):,.0f}, items {g.get('count', 0)}")
        total = sum((g.get("total_cargo") or 0) for g in grouped)
        lines.append(f"= Total periodo: ${total:,.0f}")
        await update.message.reply_text("\n".join(lines))
        return

    # 2) Detalle (o sin by por decisión del usuario)
    cur_rows  = _query_gastos_raw(start, end, siglas, cuentas, keyword=keyword, limit=max(20, detail_limit) if is_detail else 200, exclude_siglas=exclude_siglas, rut=rut)
    prev_rows = _query_gastos_raw(start_prev, end_prev, siglas, cuentas, keyword=keyword, limit=200, exclude_siglas=exclude_siglas, rut=rut)

    cur_cargo, cur_abono, cur_count = _totals(cur_rows)
    prev_cargo, prev_abono, prev_count = _totals(prev_rows)

    start_s, end_s = start.strftime("%Y-%m-%d"), (end - timedelta(days=1)).strftime("%Y-%m-%d")
    start_prev_s, end_prev_s = start_prev.strftime("%Y-%m-%d"), (end_prev - timedelta(days=1)).strftime("%Y-%m-%d")

    filt = []
    if siglas:  filt.append(f"siglas: {', '.join(siglas)}")
    if exclude_siglas: filt.append(f"sin: {', '.join(exclude_siglas)}")
    if cuentas: filt.append(f"cuentas: {', '.join([str(c) for c in cuentas])}")
    if rut: filt.append(f"rut: {rut}")
    if keyword: filt.append(f"q: {keyword}")
    filters_str = " | ".join(filt) if filt else "(sin filtros)"

    header = [
        f"Nonna Marriana dice: Gastos {start_s} a {end_s} vs {start_prev_s} a {end_prev_s} {filters_str}.",
        f"Actual: cargo ${cur_cargo:,.0f}, abono ${cur_abono:,.0f}, items {cur_count}.",
        f"Año pasado: cargo ${prev_cargo:,.0f}, abono ${prev_abono:,.0f}, items {prev_count}.",
    ]

    sample = []
    # Si pidió detalle, respeta el límite solicitado; si no, muestra un muestreo breve (máx 20)
    show_n = detail_limit if is_detail else min(20, len(cur_rows))
    for r in cur_rows[:show_n]:
        sample.append(
            f"- {r.get('fecha_pago','')} [{r.get('sigla') or '-'}] cuenta {r.get('cuenta')} "
            f"{r.get('resumen2') or ''}/{r.get('resumen') or ''}/{r.get('tipo_gasto') or ''}: "
            f"cargo ${ (r.get('cargo') or 0):,.0f}, abono ${ (r.get('abono') or 0):,.0f}"
        )

    msg = "\n".join(header + (["", "Detalle:"] if is_detail else ["", "Muestreo de data cruda (actual):"]) + sample)
    await update.message.reply_text(msg)
