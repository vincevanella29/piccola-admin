import re
import logging
from datetime import datetime
from typing import List, Dict, Tuple, Any
from collections import defaultdict

from utils.web3mongo import db
from .common import get_link_info, grok_parse_dates
from .filters import grok_filters

logger = logging.getLogger(__name__)


def _yyyymm_now() -> str:
    now = datetime.now()
    return now.strftime("%Y%m")


def _prev_yyyymm(yyyymm: str) -> str:
    y, m = int(yyyymm[:4]), int(yyyymm[4:])
    if m == 1:
        return f"{y-1}12"
    return f"{y}{m-1:02d}"


async def _reply_text_chunked(update, full_text: str, chunk_size: int = 3800):
    """Envía texto largo dividido en chunks seguros para Telegram."""
    if not full_text:
        return
    text = str(full_text)
    lines = text.split("\n")
    buf, curr = [], 0
    for line in lines:
        ln = len(line) + 1
        if curr + ln > chunk_size and buf:
            await update.message.reply_text("\n".join(buf))
            buf, curr = [line], ln
        else:
            buf.append(line)
            curr += ln
    if buf:
        await update.message.reply_text("\n".join(buf))


def _menus_by_code_name_category() -> Tuple[Dict[str, dict], Dict[str, List[str]], Dict[str, str]]:
    menus = list(db.menus.find({}, {}))
    cats = list(db.categories.find({}, {}))

    # name(lower) -> [category_ids]
    cat_ids_by_name: Dict[str, List[str]] = {}
    for c in cats:
        name = str(c.get("nombre") or c.get("name") or "").strip().lower()
        cid = str(c.get("id") or c.get("_id") or "").strip()
        if not name or not cid:
            continue
        cat_ids_by_name.setdefault(name, []).append(cid)

    menus_by_code: Dict[str, dict] = {}
    code_by_name_fragment: Dict[str, str] = {}
    for m in menus:
        code = str(m.get("codigo") or "").strip()
        if not code:
            continue
        menus_by_code[code] = m
        nombre = str(m.get("nombre") or m.get("name") or "").strip().lower()
        if nombre:
            code_by_name_fragment.setdefault(nombre, code)

    # category_name(lower) -> [codes]
    codes_by_category_name: Dict[str, List[str]] = {}
    for m in menus:
        code = str(m.get("codigo") or "").strip()
        if not code:
            continue
        cat_ids = m.get("category_ids") or m.get("categories") or []
        if not isinstance(cat_ids, list):
            cat_ids = []
        for name, ids in cat_ids_by_name.items():
            if any(cid in cat_ids for cid in ids):
                codes_by_category_name.setdefault(name, []).append(code)

    return menus_by_code, codes_by_category_name, code_by_name_fragment


def _aggregate_rentabilidad_by_codes(period: str, codes: List[str], sort_by: str = "total_venta", limit: int = 20):
    match: Dict[str, Any] = {"mesano": str(period)}
    if codes:
        match["codig"] = {"$in": [str(c) for c in codes]}
    pipeline = [
        {"$match": match},
        {
            "$group": {
                "_id": "$codig",
                "total_venta": {"$sum": "$total_venta"},
                "cantidad": {"$sum": "$cantidad"},
                "total_margen": {"$sum": "$total_margen"},
                "total_costo": {"$sum": "$total_costo"},
            }
        },
        {"$sort": {("cantidad" if sort_by == "cantidad" else "total_venta"): -1}},
        {"$limit": limit},
    ]
    return list(db.rentabilidad_producto_locales.aggregate(pipeline))


def _aggregate_rentabilidad_by_codes_multi(periods: List[str], codes: List[str], limit: int = 999999):
    match: Dict[str, Any] = {"mesano": {"$in": [str(p) for p in periods]}}
    if codes:
        match["codig"] = {"$in": [str(c) for c in codes]}
    pipeline = [
        {"$match": match},
        {"$group": {
            "_id": {"codig": "$codig", "mesano": "$mesano"},
            "total_venta": {"$sum": "$total_venta"},
            "cantidad": {"$sum": "$cantidad"},
            "total_margen": {"$sum": "$total_margen"},
            "total_costo": {"$sum": "$total_costo"},
        }},
        {"$sort": {"_id.mesano": 1, "total_venta": -1}},
        {"$limit": limit},
    ]
    return list(db.rentabilidad_producto_locales.aggregate(pipeline))


def _pct_delta(new: float, old: float) -> str:
    try:
        if old == 0:
            return "∞"
        return f"{(new/old - 1)*100:.1f}%"
    except Exception:
        return "—"


def _months_between(start, end_excl) -> List[str]:
    """Devuelve ['YYYYMM', ...] desde el 1er día del mes de start hasta end_excl (exclusivo)."""
    months: List[str] = []
    y, m = start.year, start.month
    d = datetime(y, m, 1)
    while d < end_excl:
        months.append(f"{d.year}{d.month:02d}")
        if d.month == 12:
            d = datetime(d.year + 1, 1, 1)
        else:
            d = datetime(d.year, d.month + 1, 1)
    return months


def _shift_months_one_year(months: List[str]) -> List[str]:
    return [f"{int(mm[:4]) - 1}{mm[4:]}" for mm in months]


def _sum_rows_by_code(rows: List[dict]) -> Dict[str, dict]:
    acc: Dict[str, dict] = defaultdict(lambda: {"total_venta": 0, "cantidad": 0, "total_margen": 0, "total_costo": 0})
    for r in rows:
        key = str((r.get("_id") or {}).get("codig") or "")
        if not key:
            continue
        acc[key]["total_venta"]  += r.get("total_venta", 0) or 0
        acc[key]["cantidad"]     += r.get("cantidad", 0) or 0
        acc[key]["total_margen"] += r.get("total_margen", 0) or 0
        acc[key]["total_costo"]  += r.get("total_costo", 0) or 0
    return acc


def _sum_rows_by_month(rows: List[dict]) -> Dict[str, dict]:
    acc: Dict[str, dict] = defaultdict(lambda: {"total_venta": 0, "cantidad": 0, "total_margen": 0, "total_costo": 0})
    for r in rows:
        mm = str((r.get("_id") or {}).get("mesano") or "")
        if not mm:
            continue
        acc[mm]["total_venta"]  += r.get("total_venta", 0) or 0
        acc[mm]["cantidad"]     += r.get("cantidad", 0) or 0
        acc[mm]["total_margen"] += r.get("total_margen", 0) or 0
        acc[mm]["total_costo"]  += r.get("total_costo", 0) or 0
    return acc


def _role_level_from_link(link: dict) -> int:
    """Intenta obtener el nivel de rol a partir del wallet del link."""
    try:
        wallet = (link or {}).get("wallet")
        if not wallet:
            return 0
        try:
            from apis.roles import get_company_role_level as _get
            return int(_get(wallet) or 0)
        except Exception:
            pass
        doc = db.company_roles.find_one({"wallet": wallet}) or db.roles.find_one({"wallet": wallet})
        if not doc:
            return 0
        return int(doc.get("level") or doc.get("role_level") or 0)
    except Exception:
        return 0


def _wants_top(text: str) -> bool:
    t = (text or "").lower()
    return bool(re.search(r"\b(m[aá]s\s+vendid[oa]s?|top|mejores)\b", t))


def _wants_hide_values(text: str) -> bool:
    t = (text or "").lower()
    return any(k in t for k in ["sin valores", "sin montos", "sin plata", "solo ranking", "solo nombres"])


def _extract_top_n(text: str, default: int = 10, max_n: int = 100) -> int:
    """Si el usuario pide top/mas vendidos, devuelve N (default si no especifica). Si no pidió top, retorna 0."""
    t = (text or "").lower()
    if any(k in t for k in ["top", "más vendidos", "mas vendidos", "mejores"]):
        m = re.search(r"\btop\s*(\d{1,3})\b", t)
        n = None
        if m:
            n = int(m.group(1))
        else:
            m2 = re.search(r"\b(m[aá]s\s+vendid[oa]s?)\s*(\d{1,3})\b", t)
            if m2:
                n = int(m2.group(2))
        if n is None:
            n = default
        return max(1, min(max_n, n))
    return 0


async def handle_productos(update, context):
    """
    Responde ventas de productos por mes (YYYYMM).
    - Filtros: by = codigo|nombre|categoria y q = texto.
    - Si NO hay mes explícito ni rango, usa MES PASADO (mes completo) para comparar vs el anterior.
    - 'más vendidos' => TOP N (por $ total_venta), N por defecto=10 (tope=100).
    - **Nivel 3 ahora ve montos** (se ocultan solo si piden 'sin valores').
    - Soporta YTD/rangos: 'este año', 'últimos 3 meses', 'por mes', etc.
    """
    text = update.message.text or ""

    tg_user = update.effective_user
    tg_id = tg_user.id if tg_user else None
    logger.info(f"[productos_handler] Incoming productos intent from tg_id={tg_id}, text='{text}'")
    link = get_link_info(tg_id) if tg_id else None

    # Resolver filtros (dinámico desde BD)
    f = await grok_filters("productos", text) or {}
    wants_top = bool(f.get("top")) if f.get("top") is not None else _wants_top(text)
    hide_values_flag = bool(f.get("hide_values")) if f.get("hide_values") is not None else _wants_hide_values(text)

    by = (f.get("by") or (context.user_data.get("productos_by") or "")).lower()
    q = (f.get("q") or (context.user_data.get("productos_q") or "")).strip()
    period = (f.get("period") or (context.user_data.get("productos_period") or "")).strip()

    # Fechas naturales (p.ej. 'este año', 'últimos 3 meses', etc.)
    now = datetime.now()
    parsed = await grok_parse_dates(text, now)
    months: List[str] = []
    preset = ""
    if parsed:
        start, end_excl, preset = parsed
        months = _months_between(start, end_excl)

    # Si no hay rango/múltiples meses: por defecto usar MES PASADO (mes completo)
    if not months:
        if not period or not (len(period) == 6 and period.isdigit()):
            period = _prev_yyyymm(_yyyymm_now())

    menus_by_code, codes_by_cat, code_by_name = _menus_by_code_name_category()

    # Resolver códigos según filtro
    codes: List[str] = []
    if by == "codigo" and q:
        codes = [q.strip().upper()]
    elif by == "nombre" and q:
        ql = q.lower()
        if ql in code_by_name:
            codes = [code_by_name[ql]]
        else:
            for name, code in code_by_name.items():
                if ql in name:
                    codes.append(code)
    elif by == "categoria" and q:
        ql = q.lower()
        GENERIC = {"producto", "productos", "menú", "menu", "categoría", "categoria"}
        if ql not in GENERIC and ql in codes_by_cat:
            codes = codes_by_cat.get(ql, [])
    else:
        ql = q.lower()
        for code, m in menus_by_code.items():
            nombre = str(m.get("nombre") or "").lower()
            if q and (ql in code.lower() or ql in nombre):
                codes.append(code)

    # Sin sesión: si quieren TOP, mostramos menús; si no, pedimos /link
    if not link or link.get("expired"):
        if wants_top:
            from .menus import handle_menus as _menus  # no ventas, sólo catálogo
            await _menus(update, context)
            return
        await _reply_text_chunked(update, "Primero conecta tu cuenta con Privy para ver ventas de productos. Usa /link.")
        return

    # ======================
    # Visibilidad (FORZAR LVL 3 CON MONTOS)
    # ======================
    role_level = 3  # fijo por ahora
    hide_values_flag = bool(context.user_data.get("productos_hide_values", hide_values_flag))
    # 👉 cambio clave: ahora nivel 3 también ve montos
    show_values = (role_level >= 3) and (not hide_values_flag)

    # --- MODO RANGO / YTD ---
    if months and len(months) == 1 and preset in {"este_mes", "mes_pasado"} and "por mes" not in (text or "").lower():
        period = months[0]
        months = []

    if months:
        rows_ytd = _aggregate_rentabilidad_by_codes_multi(months, codes, limit=999999)
        rows_ly  = _aggregate_rentabilidad_by_codes_multi(_shift_months_one_year(months), codes, limit=999999)

        tlow = (text or "").lower()
        if "por mes" in tlow:
            ytd_by_month = _sum_rows_by_month(rows_ytd)
            ly_by_month  = _sum_rows_by_month(rows_ly)
            mm_sorted = sorted(ytd_by_month.keys())
            if not mm_sorted:
                await _reply_text_chunked(update, "No encontré ventas para ese rango/consulta.")
                return
            title_q = (q or "").strip()
            lines: List[str] = [f"Ventas por mes {'— ' + title_q if title_q else ''} {mm_sorted[0][:4]}-{mm_sorted[0][4:]} a {mm_sorted[-1][:4]}-{mm_sorted[-1][4:]} vs LY"]
            for mm in mm_sorted:
                y = ytd_by_month.get(mm, {"total_venta":0,"cantidad":0,"total_margen":0})
                ly_mm = f"{int(mm[:4]) - 1}{mm[4:]}"
                p = ly_by_month.get(ly_mm, {"total_venta":0,"cantidad":0,"total_margen":0})
                dv = _pct_delta(y["total_venta"], p["total_venta"])
                du = _pct_delta(y["cantidad"],    p["cantidad"])
                dm = _pct_delta(y["total_margen"],p["total_margen"])
                lines.append(
                    f"- {mm[:4]}-{mm[4:]}: $ {y['total_venta']:,.0f} vs $ {p['total_venta']:,.0f} (Δ {dv}) | "
                    f"{y['cantidad']:,.0f} uds vs {p['cantidad']:,.0f} (Δ {du}) | "
                    f"margen $ {y['total_margen']:,.0f} vs $ {p['total_margen']:,.0f} (Δ {dm})"
                )
            await _reply_text_chunked(update, "\n".join(lines))
            return

        # YTD por código vs LY
        ytd_by_code = _sum_rows_by_code(rows_ytd)
        ly_by_code  = _sum_rows_by_code(rows_ly)
        codes_all = sorted(ytd_by_code.keys(), key=lambda c: ytd_by_code[c]["total_venta"], reverse=True)

        start_s = months[0][:4] + "-" + months[0][4:]
        end_s   = months[-1][:4] + "-" + months[-1][4:]
        title_q = (q or "").strip()
        hdr_base = f"Ventas YTD {'— ' + title_q if title_q else ''} {start_s} a {end_s} vs LY"

        top_n = _extract_top_n(text, default=10, max_n=100) if wants_top else 0
        if top_n:
            codes_all = codes_all[:top_n]
            hdr = f"TOP {top_n} — {hdr_base}"
        else:
            hdr = hdr_base

        # Mapeo de categorías
        cat_name_by_id: Dict[str, str] = {}
        for c in db.categories.find({}, {}):
            cid = str(c.get("id") or c.get("_id") or "")
            name = str(c.get("nombre") or c.get("name") or "").strip()
            if cid and name:
                cat_name_by_id[cid] = name

        lines: List[str] = [hdr]
        tot_ytd = {"total_venta":0, "cantidad":0, "total_margen":0}
        tot_ly  = {"total_venta":0, "cantidad":0, "total_margen":0}
        menus_by_code, _, _ = _menus_by_code_name_category()

        for i, code in enumerate(codes_all, start=1):
            mdoc = menus_by_code.get(code, {})
            name = (mdoc.get("nombre") or code)
            cat_ids = mdoc.get("category_ids") or []
            cats = ", ".join([cat_name_by_id.get(cid, "") for cid in cat_ids if cat_name_by_id.get(cid)])

            y = ytd_by_code.get(code, {"total_venta":0, "cantidad":0, "total_margen":0})
            p = ly_by_code.get(code,  {"total_venta":0, "cantidad":0, "total_margen":0})

            if show_values:
                dv = _pct_delta(y["total_venta"], p["total_venta"])
                du = _pct_delta(y["cantidad"],    p["cantidad"])
                dm = _pct_delta(y["total_margen"],p["total_margen"])
                lines.append(
                    f"{i}. {name} ({code}){f' [{cats}]' if cats else ''}\n"
                    f"   $ {y['total_venta']:,.0f} vs $ {p['total_venta']:,.0f}  (Δ {dv})\n"
                    f"   {y['cantidad']:,.0f} uds vs {p['cantidad']:,.0f} uds  (Δ {du})\n"
                    f"   margen $ {y['total_margen']:,.0f} vs $ {p['total_margen']:,.0f}  (Δ {dm})"
                )
            else:
                lines.append(f"{i}. {name} ({code}){f' [{cats}]' if cats else ''}")

            for k in tot_ytd: tot_ytd[k] += y.get(k, 0) or 0
            for k in tot_ly:  tot_ly[k]  += p.get(k, 0) or 0

        if show_values:
            dvT = _pct_delta(tot_ytd["total_venta"], tot_ly["total_venta"])
            duT = _pct_delta(tot_ytd["cantidad"],    tot_ly["cantidad"])
            dmT = _pct_delta(tot_ytd["total_margen"],tot_ly["total_margen"])
            lines += [
                "",
                "TOTAL YTD:",
                f"   $ {tot_ytd['total_venta']:,.0f} vs $ {tot_ly['total_venta']:,.0f}  (Δ {dvT})",
                f"   {tot_ytd['cantidad']:,.0f} uds vs {tot_ly['cantidad']:,.0f} uds  (Δ {duT})",
                f"   margen $ {tot_ytd['total_margen']:,.0f} vs $ {tot_ly['total_margen']:,.0f}  (Δ {dmT})"
            ]

        await _reply_text_chunked(update, "\n".join(lines))
        return

    # --- MODO 1 MES: curr vs prev ---
    curr = period if (period and len(period) == 6) else _yyyymm_now()
    prev = _prev_yyyymm(curr)

    rows = _aggregate_rentabilidad_by_codes_multi([prev, curr], codes, limit=999999)
    if not rows:
        await _reply_text_chunked(update, "No encontré ventas de productos para ese filtro o periodos.")
        return

    per_map: Dict[str, Dict[str, dict]] = {prev: {}, curr: {}}
    for r in rows:
        code = str((r.get("_id") or {}).get("codig"))
        mes = str((r.get("_id") or {}).get("mesano"))
        if code and mes in per_map:
            per_map[mes][code] = {
                "total_venta": r.get("total_venta", 0) or 0,
                "cantidad": r.get("cantidad", 0) or 0,
                "total_margen": r.get("total_margen", 0) or 0,
                "total_costo": r.get("total_costo", 0) or 0,
            }

    cat_name_by_id: Dict[str, str] = {}
    for c in db.categories.find({}, {}):
        cid = str(c.get("id") or c.get("_id") or "")
        name = str(c.get("nombre") or c.get("name") or "").strip()
        if cid and name:
            cat_name_by_id[cid] = name

    if wants_top:
        top_n = _extract_top_n(text, default=10, max_n=100)
        codes_all = sorted(
            per_map[curr].keys(),
            key=lambda c: (per_map[curr].get(c, {}).get("total_venta") or 0),
            reverse=True,
        )[:top_n]
    else:
        codes_all = sorted(set(list(per_map[curr].keys()) + list(per_map[prev].keys())))

    tot_prev = {"total_venta": 0, "cantidad": 0, "total_margen": 0}
    tot_curr = {"total_venta": 0, "cantidad": 0, "total_margen": 0}

    title_cat = q if by == "categoria" and q else ""
    base_hdr = f"{curr[:4]}-{curr[4:]} vs {prev[:4]}-{prev[4:]}"
    if wants_top:
        hdr = f"TOP {top_n} — {'Productos — ' if not title_cat else ''}{title_cat + ' — ' if title_cat else ''}{base_hdr}"
    else:
        hdr = f"Ventas de productos — {title_cat + ' — ' if title_cat else ''}{base_hdr}"
    lines: List[str] = [hdr]

    menus_by_code, _, _ = _menus_by_code_name_category()

    for i, code in enumerate(codes_all, start=1):
        mdoc = menus_by_code.get(code, {})
        name = (mdoc.get("nombre") or code)
        cat_ids = mdoc.get("category_ids") or []
        cats = ", ".join([cat_name_by_id.get(cid, "") for cid in cat_ids if cat_name_by_id.get(cid)])

        p0 = per_map[prev].get(code, {"total_venta": 0, "cantidad": 0, "total_margen": 0})
        p1 = per_map[curr].get(code, {"total_venta": 0, "cantidad": 0, "total_margen": 0})

        if show_values:
            dv = _pct_delta(p1["total_venta"], p0["total_venta"])
            du = _pct_delta(p1["cantidad"], p0["cantidad"])
            dm = _pct_delta(p1["total_margen"], p0["total_margen"])

            lines.append(
                f"{i}. {name} ({code}){f' [{cats}]' if cats else ''}\n"
                f"   $ {p1['total_venta']:,.0f} vs $ {p0['total_venta']:,.0f}  (Δ {dv})\n"
                f"   {p1['cantidad']:,.0f} uds vs {p0['cantidad']:,.0f} uds  (Δ {du})\n"
                f"   margen $ {p1['total_margen']:,.0f} vs $ {p0['total_margen']:,.0f}  (Δ {dm})"
            )
        else:
            lines.append(f"{i}. {name} ({code}){f' [{cats}]' if cats else ''}")

        for k in tot_prev:
            tot_prev[k] += p0.get(k, 0) or 0
        for k in tot_curr:
            tot_curr[k] += p1.get(k, 0) or 0

    if show_values:
        dv = _pct_delta(tot_curr["total_venta"], tot_prev["total_venta"])
        du = _pct_delta(tot_curr["cantidad"], tot_prev["cantidad"])
        dm = _pct_delta(tot_curr["total_margen"], tot_prev["total_margen"])
        lines.append("")
        lines.append("TOTAL CATEGORÍA:")
        lines.append(
            f"   $ {tot_curr['total_venta']:,.0f} vs $ {tot_prev['total_venta']:,.0f}  (Δ {dv})\n"
            f"   {tot_curr['cantidad']:,.0f} uds vs {tot_prev['cantidad']:,.0f} uds  (Δ {du})\n"
            f"   margen $ {tot_curr['total_margen']:,.0f} vs $ {tot_prev['total_margen']:,.0f}  (Δ {dm})"
        )

    await _reply_text_chunked(update, "\n".join(lines))
