import os
import logging
import json
import asyncio
from types import SimpleNamespace
from dotenv import load_dotenv

logger = logging.getLogger(__name__)

try:
    load_dotenv()
except Exception:
    pass

XAI_API_URL = os.getenv("XAI_API_URL", "https://api.x.ai/v1/chat/completions")
XAI_MODEL = os.getenv("XAI_MODEL", "grok-2-latest")
XAI_API_KEY = os.getenv("XAI_API_KEY")

# Use the site utils (NOT Telegram bot) so responses match the web UI formatting
from utils.bot.common.common import ask_grok, grok_route_intent, INTENTS
from apis.roles import get_company_role_level
from utils.bot.common.filters import grok_filters
from utils.bot.productos.menus import handle_menus, handle_productos_hora
from utils.bot.productos.productos import handle_productos
from utils.bot.consumos.consumos import handle_consumos
from utils.bot.movimientos.ventas import handle_ventas
from utils.bot.movimientos.ventas_hora import handle_ventas_hora
from utils.bot.movimientos.gastos import handle_gastos
from utils.bot.movimientos.sueldos import handle_sueldos
from utils.bot.sucursales.locations import handle_locations, find_location_by_query
from utils.bot.clubnonna.club import handle_club
from utils.bot.historynonna.history import handle_history

# Register FilterSpecs used by utils (side-effect imports)
import utils.bot.productos.menus_spec  # noqa: F401
import utils.bot.sucursales.locations_spec  # noqa: F401
import utils.bot.clubnonna.spec  # noqa: F401
import utils.bot.historynonna.spec  # noqa: F401
# Movimientos specs (copiados desde bots/utils a utils/bot/movimientos)
import utils.bot.movimientos.gastos_spec  # noqa: F401
import utils.bot.movimientos.ventas_spec  # noqa: F401
import utils.bot.movimientos.ventas_hora_spec  # noqa: F401
import utils.bot.movimientos.sueldos_spec  # noqa: F401
import utils.bot.consumos.consumos_spec  # noqa: F401
import utils.bot.productos.productos_spec  # noqa: F401

# Centralized accepted intents from common
ACCEPTED_INTENTS = {i.get("key") for i in INTENTS}

# -------- Performance helpers: never block the event loop -------- #
async def _with_timeout(coro, timeout: float, default):
    """Await a coroutine with a timeout, returning default on timeout/error."""
    try:
        return await asyncio.wait_for(coro, timeout=timeout)
    except asyncio.TimeoutError:
        logger.warning(f"Timeout after {timeout}s awaiting {getattr(coro, '__name__', str(coro))}")
        return default
    except Exception as e:
        logger.exception(f"Error awaiting {getattr(coro, '__name__', str(coro))}: {e}")
        return default

def _normalize_text_list_result(intent: str, result):
    """Normalize handler result to payload format expected by web UI."""
    if isinstance(result, (dict, list)):
        return result
    return {"type": "text_block_list", "intent": intent, "lines": result}

async def chat_complete(messages: list[dict]) -> str:
    """Web chat router using utils.bot handlers with UI-friendly payloads.
    Supports: menus, locations, club, history. Fallback to Grok for general chat.
    """
    # Extract last user message text
    last_user_text = ""
    for m in reversed(messages or []):
        if (m or {}).get("role") == "user":
            last_user_text = ((m or {}).get("content") or "")
            break
    text = last_user_text or ((messages or [{}])[-1].get("content") if messages else "") or ""

    # Route intent
    intent = await _with_timeout(grok_route_intent(text), timeout=1.0, default={"intent": "chat"})
    logger.info(f"Intent detected: {intent}")
    itype = (intent or {}).get("intent") if isinstance(intent, dict) else None
    if itype not in ACCEPTED_INTENTS:
        itype = "chat"

    # Minimal shim to reuse utils handlers and pass identity/role
    update = SimpleNamespace(message=SimpleNamespace(text=text))
    context = SimpleNamespace(user_data={})
    # Try to parse wallet from the first system message (User context JSON)
    try:
        sys0 = (messages or [{}])[0]
        if (sys0 or {}).get("role") == "system":
            content = (sys0 or {}).get("content") or ""
            if "User context (JSON):" in content:
                jtxt = content.split("User context (JSON):", 1)[-1].strip()
                conv_ctx = json.loads(jtxt)
                wallet = (conv_ctx or {}).get("wallet")
                if isinstance(wallet, str) and wallet:
                    context.user_data["wallet"] = wallet
                    try:
                        # Offload potential blocking call to a thread with tight timeout
                        context.user_data["role_level"] = await _with_timeout(
                            asyncio.to_thread(get_company_role_level, wallet),
                            timeout=1.0,
                            default=None,
                        )
                    except Exception:
                        context.user_data["role_level"] = None
    except Exception:
        pass

    if itype == "menus":
        # 1) Parsear con el SPEC de 'menus' para periodo, filtros, etc.
        mf = await _with_timeout(grok_filters("menus", text), timeout=1.5, default={}) or {}
        logger.info(f"Parsed filters: {mf}")

        # 2) Si piden 'detalle' o 'receta', usamos el flujo legacy de menús descriptivos (foto/opciones/recetas)
        #    Además, detectamos 'receta' en lenguaje natural
        _tlow = (text or "").lower()
        nl_wants_recipe = ("receta" in _tlow)
        wants_detail_or_recipe = bool(mf.get("detail")) or bool(mf.get("recipe")) or nl_wants_recipe
        if wants_detail_or_recipe:
            context.user_data["menus_by"] = (mf.get("by") or "").lower()
            context.user_data["menus_q"] = (mf.get("q") or "")
            context.user_data["menus_detail"] = bool(mf.get("detail", False))
            context.user_data["menus_mesanos"] = mf.get("mesanos") or []
            # Muy importante: pasar filtros completos para que handle_menus pueda usar include_codigos
            context.user_data["menus_filters"] = mf
            if nl_wants_recipe:
                context.user_data["menus_recipe"] = True
            _, payload = await _with_timeout(handle_menus(update, context), timeout=4.0, default=(None, []))
            return payload if isinstance(payload, (dict, list)) else {
                "type": "text_block_list",
                "intent": "menus",
                "lines": payload
            }

        # 3) Si NO piden detalle/receta -> redirigimos a ventas por hora de productos,
        #    mapeando TODO lo filtrado por 'menus' a 'ventas_hora_filters'
        vhf = {
            "period":  mf.get("period") or {},            # {preset|start|end|tz}
            "group_by": mf.get("group_by") or "producto",
            "measure":  mf.get("measure") or "total",   # total|cantidad|avg_precio
            "order_by": mf.get("order_by") or "value_desc",
            "filters":  (mf.get("filters") or {}),        # include_codigos/include_locals/include_siglas/hour_in/dow_in
            "view":     mf.get("view") or {},             # {limit_groups, detail}
        }
        # Heurística: si preguntan "¿cuántas ...?" y sigue en 'total', forzar 'cantidad'
        _t = (text or "").lower()
        if ("cuanta" in _t or "cuánt" in _t) and (vhf.get("measure") == "total"):
            vhf["measure"] = "cantidad"

        # Pasar filtros al contexto (consistencia con otros handlers horarios)
        context.user_data["ventas_hora_filters"] = vhf

        # 4) Disparar el handler horario de productos (emite data_table con code+name)
        _, payload = await _with_timeout(handle_productos_hora(update, context), timeout=4.0, default=(None, []))
        return payload if isinstance(payload, (dict, list)) else {
            "type": "text_block_list",
            "intent": "ventas_hora",
            "lines": payload
        }

    if itype == "locations":
        lf = await _with_timeout(grok_filters("locations", text), timeout=1.5, default={}) or {}
        q = (lf.get("q") or "").strip()
        if q:
            context.user_data["locations_q"] = q
        _, payload = await _with_timeout(handle_locations(update, context), timeout=3.0, default=(None, {"type": "text", "text": "No hay datos de sucursales ahora."}))
        return payload

    if itype == "club":
        section = "help"
        spec = await _with_timeout(grok_filters("club", text), timeout=1.5, default={})
        if isinstance(spec, dict) and spec.get("section"):
            section = spec.get("section")
            logger.info(f"Club section: {section}")
        _, payload = await _with_timeout(handle_club(update, section), timeout=3.0, default=(None, {"type": "text", "text": "No disponible por ahora."}))
        # If complaints funnel, enrich with location quick action
        if section == "polls":
            try:
                lf = await _with_timeout(grok_filters("locations", text), timeout=1.0, default={}) or {}
                q = (lf.get("q") or "").strip()
                loc = find_location_by_query(q) if q else None
                if loc:
                    payload["related_location"] = loc
                    phone = (loc.get("phone") or "").strip()
                    if phone:
                        actions = payload.get("actions") or []
                        actions.append({"label": "Llamar sucursal", "url": f"tel:{phone}", "variant": "secondary"})
                        payload["actions"] = actions
            except Exception:
                pass
        return payload

    # === Movimientos/empresa intents: misma orquestación que el bot de Telegram ===
    if itype == "ventas_hora":
        vhf = await _with_timeout(grok_filters("ventas_hora", text), timeout=1.5, default={}) or {}
        context.user_data["ventas_hora_filters"] = vhf
        _, result = await _with_timeout(handle_ventas_hora(update, context), timeout=4.0, default=(None, ["Sin datos por ahora"]))
        # If the handler returns a structured payload (dict or list), forward it as-is.
        # Otherwise, assume it's a list of strings and wrap in a text_block_list.
        if isinstance(result, (dict, list)):
            return result
        return {"type": "text_block_list", "intent": itype, "lines": result}

    if itype == "sueldos":
        sf = await _with_timeout(grok_filters("sueldos", text), timeout=2.0, default={}) or {}
        # Pass the entire spec so the handler can use all filters/grouping without re-parsing
        context.user_data["sueldos_spec"] = sf
        if sf.get("period"): context.user_data["sueldos_period"] = sf["period"]
        if sf.get("mode"):   context.user_data["sueldos_mode"] = sf["mode"]
        if sf.get("rut") is not None: context.user_data["sueldos_rut"] = sf["rut"]
        _, result = await _with_timeout(handle_sueldos(update, context), timeout=5.0, default=(None, ["Cálculo de sueldos no disponible en este momento"]))
        # If the handler returns a structured payload (dict or list), forward it as-is.
        # Otherwise, assume it's a list of strings and wrap in a text_block_list.
        if isinstance(result, (dict, list)):
            return result
        return {"type": "text_block_list", "intent": itype, "lines": result}

    if itype == "ventas":
        vf = await _with_timeout(grok_filters("ventas", text), timeout=1.5, default={}) or {}
        _vp = vf.get("period")
        context.user_data["ventas_period"] = (_vp.lower() if isinstance(_vp, str) else _vp) or ""
        _, lines = await _with_timeout(handle_ventas(update, context), timeout=4.0, default=(None, ["Ventas no disponibles ahora"]))
        return {"type": "text_block_list", "intent": itype, "lines": lines}

    if itype == "productos":
        f = await _with_timeout(grok_filters("productos", text), timeout=1.5, default={}) or {}
        context.user_data["productos_by"] = (f.get("by") or "").lower()
        context.user_data["productos_q"] = (f.get("q") or "").strip()
        if f.get("period"): context.user_data["productos_period"] = f["period"]
        context.user_data["productos_top"] = bool(f.get("top", False))
        context.user_data["productos_hide_values"] = bool(f.get("hide_values", False))
        _, result = await _with_timeout(handle_productos(update, context), timeout=4.0, default=(None, ["No hay datos de productos ahora"]))
        # If structured payload (dict, list), forward it; else wrap as text list
        if isinstance(result, (dict, list)):
            return result
        return {"type": "text_block_list", "intent": itype, "lines": result}

    if itype == "consumos":
        f = await _with_timeout(grok_filters("consumos", text), timeout=1.5, default={}) or {}
        context.user_data["consumos_by"] = (f.get("by") or "").lower()
        context.user_data["consumos_q"] = (f.get("q") or "").strip()
        if f.get("period"): context.user_data["consumos_period"] = f["period"]
        context.user_data["consumos_top"] = bool(f.get("top", False))
        context.user_data["consumos_hide_values"] = bool(f.get("hide_values", False))
        _, result = await _with_timeout(handle_consumos(update, context), timeout=4.0, default=(None, ["Consumos no disponibles ahora"]))
        if isinstance(result, (dict, list)):
            return result
        return {"type": "text_block_list", "intent": itype, "lines": result}

    if itype == "gastos":
        gf = await _with_timeout(grok_filters("gastos", text), timeout=1.5, default={}) or {}
        context.user_data["gastos_by"] = gf.get("by") or ""
        context.user_data["gastos_q"] = gf.get("q") or ""
        context.user_data["gastos_siglas"] = gf.get("include_siglas") or []
        context.user_data["gastos_siglas_excl"] = gf.get("exclude_siglas") or []
        context.user_data["gastos_cuentas"] = gf.get("include_cuentas") or []
        context.user_data["gastos_rut"] = gf.get("rut")
        _, lines = await _with_timeout(handle_gastos(update, context), timeout=4.0, default=(None, ["Gastos no disponibles ahora"]))
        return {"type": "text_block_list", "intent": itype, "lines": lines}

    if itype == "history":
        _ = await _with_timeout(grok_filters("history", text), timeout=1.0, default={})
        _, payload = await _with_timeout(handle_history(update, section="timeline"), timeout=3.0, default=(None, {"type": "timeline", "items": []}))
        # Build a short summary prompt for the new ask_grok signature
        try:
            compact = json.dumps({k: payload.get(k) for k in ("title","subtitle","kpis","totals") if k in payload}, ensure_ascii=False)
        except Exception:
            compact = ""
        prompt = (
            "Resume en 2-3 líneas, en español chileno, este contexto para mostrarlo encima del timeline: "
            f"{compact}"
        )
        payload["text"] = await _with_timeout(ask_grok(prompt), timeout=2.0, default="")
        return payload

    # Fallback/general chat
    reply = await _with_timeout(ask_grok(text), timeout=5.0, default=None)
    if reply is None:
        return {
            "type": "text_block_list",
            "intent": "chat",
            "lines": [
                "Estoy un poco ocupado ahora mismo. Intenta de nuevo en unos segundos.",
            ],
        }
    return reply