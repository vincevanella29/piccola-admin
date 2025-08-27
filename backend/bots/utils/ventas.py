import json
import logging
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo
from typing import Dict, List, Tuple

from utils.web3mongo import db
from .common import ask_grok, grok_parse_dates, get_link_info

logger = logging.getLogger(__name__)


def _ventas_summary(start: datetime, end: datetime):
    """Returns a simple summary per local between [start, end)."""
    pipeline = [
        {"$addFields": {
            "fecha_norm": {
                "$cond": [
                    {"$eq": [{"$type": "$fecha"}, "date"]},
                    "$fecha",
                    {"$toDate": "$fecha"}
                ]
            }
        }},
        {"$match": {"fecha_norm": {"$gte": start, "$lt": end}}},
        {
            "$group": {
                "_id": "$local",
                "total": {"$sum": "$total"},
                "subtotal": {"$sum": "$subtotal"},
                "mesas": {"$sum": "$mesas"},
                "personas": {"$sum": "$personas"},
                "count": {"$sum": 1},
            }
        },
        {
            "$project": {
                "_id": 0,
                "local": "$_id",
                "total": 1,
                "subtotal": 1,
                "mesas": 1,
                "personas": 1,
                "count": 1,
            }
        },
        {"$sort": {"local": 1}}
    ]
    rows = list(db.ventas_locales.aggregate(pipeline))
    total_general = sum(r.get("total", 0) for r in rows)
    return total_general, rows


def _ventas_daily_by_local(start: datetime, end: datetime):
    pipeline = [
        {"$addFields": {
            "fecha_norm": {
                "$cond": [
                    {"$eq": [{"$type": "$fecha"}, "date"]},
                    "$fecha",
                    {"$toDate": "$fecha"}
                ]
            }
        }},
        {"$match": {"fecha_norm": {"$gte": start, "$lt": end}}},
        {"$project": {
            "_id": 0,
            "local": 1,
            "total": 1,
            "subtotal": 1,
            "mesas": 1,
            "personas": 1,
            "fecha": {"$dateToString": {"format": "%Y-%m-%d", "date": "$fecha_norm"}},
        }},
        {"$sort": {"local": 1, "fecha": 1}},
    ]
    return list(db.ventas_locales.aggregate(pipeline))


async def handle_ventas(update, context):
    text = update.message.text or ""

    # Enforce Telegram-Privy link before proceeding
    tg_user = update.effective_user
    tg_id = tg_user.id if tg_user else None
    logger.info(f"[sales_handler] Incoming sales intent from tg_id={tg_id}, text='{text}'")
    link = get_link_info(tg_id) if tg_id else None
    if not link:
        logger.info(f"[sales_handler] No link found; asking user to /link (tg_id={tg_id})")
        await update.message.reply_text(
            "Primero conecta tu cuenta con Privy para ver ventas. Usa /link para obtener el enlace."
        )
        return
    if link.get("expired"):
        logger.info(f"[sales_handler] Link expired; asking user to relink (tg_id={tg_id})")
        await update.message.reply_text(
            "Tu sesión de Privy expiró. Usa /link para volver a conectar y después pide 'ventas'."
        )
        return

    # Parse fechas con Grok directo desde el prompt (sin flujo de repregunta)
    now = datetime.now()
    parsed = await grok_parse_dates(text, now)
    if not parsed:
        logger.info(f"[sales_handler] Could not parse dates from text (tg_id={tg_id})")
        await update.message.reply_text(
            "Nonna no entendió las fechas, tesoro. Decime por ejemplo: 'ayer', 'este mes' o '2025-08-01 a 2025-08-15'."
        )
        return

    # Got dates
    start, end, preset = parsed

    # Apply Chile loading cutoff: sales load ~04:00 America/Santiago.
    tz_cl = ZoneInfo("America/Santiago")
    now_cl = datetime.now(tz_cl)
    # last fully loaded date in CL
    if now_cl.hour >= 4:
        loaded_until = now_cl.date() - timedelta(days=1)
    else:
        loaded_until = now_cl.date() - timedelta(days=2)
    # End exclusive cap is loaded_until + 1 day
    cap_end = datetime.combine(loaded_until, datetime.min.time()).replace(tzinfo=tz_cl) + timedelta(days=1)

    # Localize start/end if naive to compare properly
    if start.tzinfo is None:
        start = start.replace(tzinfo=tz_cl)
    if end.tzinfo is None:
        end = end.replace(tzinfo=tz_cl)

    # Cap logic for current month or if range includes future/unloaded days
    if preset in ("este_mes", "hoy") or end > cap_end:
        if end > cap_end:
            end = cap_end
        # Ensure non-empty range
        if end <= start:
            start = end - timedelta(days=1)

    # Drop tz to keep Mongo queries consistent with previous naive datetimes
    start = start.replace(tzinfo=None)
    end = end.replace(tzinfo=None)

    total_cur, rows_cur = _ventas_summary(start, end)
    logger.info(f"[sales_handler] Query ventas summary (tg_id={tg_id}) total={total_cur:,.0f} rows={len(rows_cur)} range={start}..{end}")

    # Same period last year (handle 29-Feb gracefully)
    try:
        start_prev = start.replace(year=start.year - 1)
        end_prev = end.replace(year=end.year - 1)
    except ValueError:
        # Fallback for leap-year issues
        start_prev = start - timedelta(days=365)
        end_prev = end - timedelta(days=365)

    total_prev, rows_prev = _ventas_summary(start_prev, end_prev)

    # Build per-local lookup for prev totals
    prev_by_local: Dict[str, float] = {r.get("local"): r.get("total", 0) for r in rows_prev}

    # Compose response in Nonna style with YoY
    start_s = start.strftime("%Y-%m-%d")
    end_s = (end - timedelta(days=1)).strftime("%Y-%m-%d")
    start_prev_s = start_prev.strftime("%Y-%m-%d")
    end_prev_s = (end_prev - timedelta(days=1)).strftime("%Y-%m-%d")

    delta = total_cur - total_prev
    pct = (delta / total_prev * 100.0) if total_prev else None

    header = [
        f"Nonna Marriana dice: Vendimos ${total_cur:,.0f} entre {start_s} y {end_s}.",
        (
            f"Contra {start_prev_s} a {end_prev_s}: ${total_prev:,.0f}. "
            + (f"(Δ ${delta:,.0f}, {pct:+.1f}% YoY)" if pct is not None else "")
        ).strip()
    ]

    lines: List[str] = header

    # Show ALL locales with YoY and weather snippet if available
    locales_enriched: List[dict] = []
    for r in rows_cur:
        local = r.get('local')
        cur = r.get('total', 0)
        prev = prev_by_local.get(local, 0)
        d = cur - prev
        p = (d / prev * 100.0) if prev else None

        # Try attach a short weather note (take any day within range)
        clima_doc = db.weather_daily.find_one(
            { 'permalink_slug': local, 'date': { '$gte': start, '$lt': end } },
            { '_id': 0 }
        )
        clima_note = ""
        if clima_doc:
            desc = clima_doc.get('summary') or clima_doc.get('conditions') or "clima"
            tmax = clima_doc.get('temp_max') or clima_doc.get('tmax')
            tmin = clima_doc.get('temp_min') or clima_doc.get('tmin')
            if tmax is not None and tmin is not None:
                clima_note = f" | {desc}: {tmin}–{tmax}°C"
            elif desc:
                clima_note = f" | {desc}"

        line = f"- {local}: ${cur:,.0f} (YoY: ${prev:,.0f}" + (f", {p:+.1f}%" if p is not None else "") + ")" + clima_note
        lines.append(line)

        locales_enriched.append({
            "local": local,
            "total_current": float(cur),
            "total_prev": float(prev),
            "delta": float(d),
            "pct": (float(p) if p is not None else None),
            "has_prev": bool(prev and prev != 0),
        })

    # Prepare structured data for Grok analysis (daily and by local)
    daily_cur = _ventas_daily_by_local(start, end)
    daily_prev = _ventas_daily_by_local(start_prev, end_prev)
    payload = {
        "meta": {
            "period_current": {"start": start_s, "end": end_s},
            "period_prev": {"start": start_prev_s, "end": end_prev_s},
        },
        "totals": {
            "current": float(total_cur),
            "prev": float(total_prev),
            "delta": float(delta),
            "pct": (float(pct) if pct is not None else None)
        },
        "locales": locales_enriched,
        "daily_by_local_current": daily_cur,
        "daily_by_local_prev": daily_prev
    }

    # Send summary first
    await update.message.reply_text("\n".join(lines))
