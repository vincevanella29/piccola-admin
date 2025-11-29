import os
import logging
import json
import asyncio
from types import SimpleNamespace
from pathlib import Path
import importlib
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
from config.roles.access import compute_permissions_for_identity
from utils.bot.common.filters import grok_filters

# Dynamic registration of FilterSpecs and engine routes from all *_spec.py modules
ENGINE_ROUTES: dict[str, dict] = {}


def _load_bot_specs_and_routes():
    """Import all *_spec.py modules under utils.bot to register FilterSpecs
    and optional ENGINE_ROUTES exposed by each spec.
    """
    base_pkg = "utils.bot"
    base_path = Path(__file__).resolve().parent

    for path in base_path.rglob("*spec.py"):
        # Build module path relative to utils.bot
        rel = path.relative_to(base_path)
        mod_name = f"{base_pkg}." + rel.with_suffix("").as_posix().replace("/", ".")
        try:
            mod = importlib.import_module(mod_name)
        except Exception:
            logger.exception(f"Error importing spec module {mod_name}")
            continue

        # Collect optional ENGINE_ROUTES defined in spec modules
        routes = getattr(mod, "ENGINE_ROUTES", None)
        if not routes:
            continue
        if isinstance(routes, dict):
            routes = list(routes.values())
        for r in routes or []:
            intent_key = (r or {}).get("intent")
            if not intent_key:
                continue
            ENGINE_ROUTES[intent_key] = r


_load_bot_specs_and_routes()

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


async def _attach_summary(intent: str, payload, text: str, context) -> dict:
    if not isinstance(payload, dict):
        return payload
    # Construir un resumen MUY compacto del payload para no saturar a Grok
    summary_dict = {}
    try:
        # 1) Resumen específico por intent/tipo de payload según config declarativa en ENGINE_ROUTES
        route = ENGINE_ROUTES.get(intent) or {}
        summary_cfg = route.get("summary") or {}
        ptype = payload.get("type")
        if isinstance(summary_cfg, dict) and ptype and ptype in summary_cfg:
            cfg = summary_cfg.get(ptype) or {}
            sections = cfg.get("sections") or {}
            type_summary = {}
            if isinstance(sections, dict):
                for sec_name, sec_cfg in sections.items():
                    if not isinstance(sec_cfg, dict):
                        continue
                    root_key = sec_cfg.get("root_key")
                    if not root_key:
                        continue
                    src = payload.get(root_key) or {}
                    sec_out = {}
                    # Campos simples
                    fields = sec_cfg.get("fields") or []
                    if fields:
                        sec_out.update({k: src.get(k) for k in fields})
                    # Config de filas (rows) opcional
                    rows_cfg = sec_cfg.get("rows") or {}
                    rows_key = rows_cfg.get("key")
                    if rows_key:
                        row_fields = rows_cfg.get("fields") or []
                        max_rows = int(rows_cfg.get("max", 10))
                        rows_val = src.get(rows_key) or {}
                        if isinstance(rows_val, list):
                            sec_out[rows_key] = [
                                {f: (row or {}).get(f) for f in row_fields}
                                for row in rows_val[:max_rows]
                            ]
                    type_summary[sec_name] = sec_out
            if type_summary:
                summary_dict[ptype] = type_summary

            # 2) Claves genéricas opcionales, controladas también por el spec (include_generic)
            if cfg.get("include_generic", True):
                if "title" in payload:
                    summary_dict["title"] = payload.get("title")
                if "subtitle" in payload:
                    summary_dict["subtitle"] = payload.get("subtitle")
                if "kpis" in payload:
                    summary_dict["kpis"] = payload.get("kpis")
                if "totals" in payload:
                    summary_dict["totals"] = payload.get("totals")

                # Para tablas/listas grandes, solo enviamos contadores y algunos nombres
                rows = payload.get("rows")
                if isinstance(rows, list):
                    summary_dict["rows_info"] = {"count": len(rows)}
                    sample = []
                    for r in rows[:3]:
                        if isinstance(r, dict):
                            name = r.get("name") or r.get("label") or r.get("titulo")
                            if name:
                                sample.append(str(name))
                    if sample:
                        summary_dict["rows_info"]["sample_names"] = sample

                items = payload.get("items")
                if isinstance(items, list):
                    summary_dict["items_info"] = {"count": len(items)}

                groups = payload.get("groups")
                if isinstance(groups, list):
                    summary_dict["groups_info"] = {"count": len(groups)}
                    sample_g = []
                    for g in groups[:3]:
                        if isinstance(g, dict):
                            name = g.get("name") or g.get("label") or g.get("grupo")
                            if name:
                                sample_g.append(str(name))
                    if sample_g:
                        summary_dict["groups_info"]["sample_names"] = sample_g

        compact = json.dumps(summary_dict, ensure_ascii=False)
    except Exception:
        compact = ""
    prompt = (
        "El usuario preguntó lo siguiente (texto libre): "
        f"{text}\n\n"
        "Esta es la respuesta de datos que le vamos a mostrar (JSON resumido del payload): "
        f"{compact}\n\n"
        "En base a eso, resume en 2-3 líneas"
    )

    perms = getattr(context, "user_data", {}).get("permissions") or {}
    rut = perms.get("rut") or None
    wallet = getattr(context, "user_data", {}).get("wallet") or None

    summary = await _with_timeout(
        ask_grok(
            prompt,
            rut=str(rut) if rut else None,
            wallet=wallet,
        ),
        timeout=8.0,
        default=None,
    )
    if isinstance(summary, str):
        s = summary.strip()
        if s:
            payload.setdefault("assistant_text", s)
            if "text" not in payload:
                payload["text"] = s
    return payload

async def chat_complete(messages: list[dict]) -> str:
    """Web chat router using utils.bot handlers with UI-friendly payloads.
    Supports intents declarados dinámicamente (ENGINE_ROUTES) más algunos legacy.
    Fallback a Grok para chat general.
    """
    # Extract last user message text
    last_user_text = ""
    for m in reversed(messages or []):
        if (m or {}).get("role") == "user":
            last_user_text = ((m or {}).get("content") or "")
            break
    text = last_user_text or ((messages or [{}])[-1].get("content") if messages else "") or ""

    # Route intent
    intent = await _with_timeout(grok_route_intent(text), timeout=1.5, default={"intent": "chat"})
    logger.info(f"Intent detected: {intent}")
    itype = (intent or {}).get("intent") if isinstance(intent, dict) else None
    if itype not in ACCEPTED_INTENTS:
        itype = "chat"

    # Minimal shim to reuse utils handlers and pass identity/role
    update = SimpleNamespace(message=SimpleNamespace(text=text))
    context = SimpleNamespace(user_data={})
    # Try to parse identity from the first system message (User context JSON)
    try:
        sys0 = (messages or [{}])[0]
        if (sys0 or {}).get("role") == "system":
            content = (sys0 or {}).get("content") or ""
            if "User context (JSON):" in content:
                jtxt = content.split("User context (JSON):", 1)[-1].strip()
                conv_ctx = json.loads(jtxt) or {}

                wallet = conv_ctx.get("wallet")
                privy_id = conv_ctx.get("privy_id")
                if isinstance(wallet, str) and wallet:
                    context.user_data["wallet"] = wallet
                if isinstance(privy_id, str) and privy_id:
                    context.user_data["privy_id"] = privy_id

                # Identidad genérica para permisos: primero wallet, si no hay usar privy_id
                identity = wallet or privy_id
                if isinstance(identity, str) and identity:
                    context.user_data["identity"] = identity
                    try:
                        # Calcular permisos efectivos usando access.compute_permissions_for_identity
                        perms = await _with_timeout(
                            asyncio.to_thread(compute_permissions_for_identity, identity),
                            timeout=3.0,
                            default=None,
                        ) or {}
                        context.user_data["permissions"] = perms

                        # Derivar role_level SOLO desde access.compute_permissions_for_identity.
                        # El source of truth es perms["role_level"].
                        raw_level = perms.get("role_level", -1)
                        try:
                            raw_level_int = int(raw_level) if raw_level is not None else -1
                        except Exception:
                            raw_level_int = -1

                        eff_level = raw_level_int if 1 <= raw_level_int <= 7 else None
                        context.user_data["role_level"] = eff_level

                        logger.info(
                            "[engine.chat_complete] identity=%s perms_role_level=%s eff_level=%s perms=%s",
                            identity,
                            raw_level,
                            eff_level,
                            perms,
                        )
                    except Exception:
                        context.user_data["permissions"] = None
                        context.user_data["role_level"] = None
    except Exception:
        pass

    # Guard global: esta API sólo acepta niveles 1-7. Si no hay nivel o está fuera de rango,
    # cortamos antes de rutear intents o llamar a Grok.
    perms = context.user_data.get("permissions") or {}
    # role_level ya viene resuelto en el contexto según access.compute_permissions_for_identity
    role_level = context.user_data.get("role_level", perms.get("role_level"))
    try:
        role_level_int = int(role_level) if role_level is not None else None
    except Exception:
        role_level_int = None

    if role_level_int is None or not (1 <= role_level_int <= 7):
        logger.info(
            "[engine.chat_complete] access_denied_invalid_role role_level=%s role_level_int=%s perms=%s",
            role_level,
            role_level_int,
            perms,
        )
        return {
            "type": "text_block_list",
            "intent": "chat",
            "lines": [
                "No tienes un nivel de acceso válido para usar esta API (se requiere nivel 1 a 7).",
            ],
        }

    # Generic routing via ENGINE_ROUTES declared in *_spec.py modules
    route = ENGINE_ROUTES.get(itype)
    if route:
        kind = route.get("kind") or "filter_handler"
        try:
            # 1) Verificar acceso opcional declarado en el spec
            access_cfg = route.get("access") or {}
            if access_cfg:
                perms = context.user_data.get("permissions") or {}
                # Preferir siempre el nivel efectivo ya resuelto en el contexto (1..7)
                role_level = context.user_data.get("role_level")
                if role_level is None:
                    role_level = perms.get("role_level")

                min_rl = access_cfg.get("min_role_level")
                max_rl = access_cfg.get("max_role_level")

                denied = False
                if min_rl is not None and (role_level is None or int(role_level) < int(min_rl)):
                    denied = True
                if not denied and max_rl is not None and role_level is not None and int(role_level) > int(max_rl):
                    denied = True

                if denied:
                    # Antes de devolver un denied_payload genérico, intentar rutear a intents relacionados
                    # declarados en el spec (p. ej. ventas -> ventas_hora) que sí acepten el nivel actual.
                    related = route.get("related_intents") or []
                    # Normalizar role_level a int una sola vez
                    try:
                        rl_int = int(role_level) if role_level is not None else None
                    except Exception:
                        rl_int = None

                    redirected = False
                    if related and rl_int is not None:
                        for rel_key in related:
                            rel_route = ENGINE_ROUTES.get(rel_key)
                            if not isinstance(rel_route, dict):
                                continue
                            rel_access = rel_route.get("access") or {}
                            rel_min = rel_access.get("min_role_level")
                            rel_max = rel_access.get("max_role_level")

                            rel_denied = False
                            if rel_min is not None and rl_int < int(rel_min):
                                rel_denied = True
                            if not rel_denied and rel_max is not None and rl_int > int(rel_max):
                                rel_denied = True

                            if rel_denied:
                                continue

                            # Este intent relacionado acepta el nivel actual: redirigir.
                            itype = rel_route.get("intent") or rel_key
                            route = rel_route
                            access_cfg = rel_access
                            redirected = True
                            denied = False
                            logger.info(
                                "[engine.chat_complete] redirected_intent from=%s to=%s role_level=%s",
                                intent,
                                itype,
                                rl_int,
                            )
                            break

                    if denied and not redirected:
                        denied_payload = access_cfg.get("denied_payload") or {
                            "type": "text_block_list",
                            "intent": itype,
                            "lines": [
                                "No tienes acceso para ver esta información.",
                            ],
                        }
                        return denied_payload

            # 2) Flujo estándar filter -> handler
            if kind == "filter_handler":
                filter_key = route.get("filter_key") or itype
                filter_timeout = float(route.get("filter_timeout", 2.0))
                handler_timeout = float(route.get("handler_timeout", 4.0))
                default_payload = route.get("default_payload")

                lf = await _with_timeout(grok_filters(filter_key, text), timeout=filter_timeout, default={}) or {}
                # Map selected filter fields into context.user_data
                for f_key, ctx_key in (route.get("filter_to_context") or {}).items():
                    if f_key == "__full__":
                        context.user_data[ctx_key] = lf
                    elif f_key in lf:
                        context.user_data[ctx_key] = lf.get(f_key)

                handler_ref = route.get("handler")
                handler_fn = None
                if callable(handler_ref):
                    handler_fn = handler_ref
                elif isinstance(handler_ref, str) and ":" in handler_ref:
                    mod_name, fn_name = handler_ref.split(":", 1)
                    try:
                        mod = importlib.import_module(mod_name)
                        handler_fn = getattr(mod, fn_name, None)
                    except Exception:
                        logger.exception(f"Error importing handler {handler_ref} for intent {itype}")

                if handler_fn is None:
                    logger.warning(f"No handler resolved for intent {itype} in ENGINE_ROUTES")
                else:
                    _, payload = await _with_timeout(
                        handler_fn(update, context),
                        timeout=handler_timeout,
                        default=(None, default_payload),
                    )
                    if payload is not None:
                        payload = await _attach_summary(itype, payload, text, context)
                        return payload
        except Exception:
            logger.exception(f"Error processing intent {itype} via ENGINE_ROUTES")

    # Fallback/general chat
    perms = context.user_data.get("permissions") or {}
    rut = perms.get("rut") or None
    wallet = context.user_data.get("wallet") or None
    reply = await _with_timeout(
        ask_grok(
            text,
            rut=str(rut) if rut else None,
            wallet=wallet,
        ),
        timeout=45.0,
        default=None,
    )
    if reply is None:
        return {
            "type": "text_block_list",
            "intent": "chat",
            "lines": [
                "Estoy un poco ocupado ahora mismo. Intenta de nuevo en unos segundos.",
            ],
        }
    return reply