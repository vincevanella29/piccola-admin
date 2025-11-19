import os
import json
import logging
import re
from datetime import datetime, timedelta, date
from typing import Optional, Tuple
from pathlib import Path
import importlib


import httpx
from dotenv import load_dotenv
from utils.web3mongo import db
from config.gamification.service import user_profile_summary


logger = logging.getLogger(__name__)


try:
    load_dotenv()
except Exception:
    pass


XAI_API_URL = os.getenv("XAI_API_URL", "https://api.x.ai/v1/chat/completions")
XAI_MODEL = os.getenv("XAI_MODEL", "grok-2-latest")
XAI_API_KEY = os.getenv("XAI_API_KEY")


def get_env_xai():
    return XAI_API_URL, XAI_MODEL, XAI_API_KEY


# Centralized intent spec for the chatbot
_INTENT_PRIORITY_BASE = [
    "gastos", "ventas_hora", "menus", "productos", "consumos", "ventas", "sueldos", "locations", "chat", "history"
]

# Descripciones base (fallback si un spec no define INTENT_META)
_INTENT_BASE_DESCS = {
    "consumos": "Consultas de consumo de artículos de productos, por producto/familia/subfamilia (top/más consumidos, cantidades, por período), consumo segun venta.",
    "chat": "Cualquier otra conversación general.",
    "history": "Historia/valores de la marca, institucional.",
}


INTENT_META_REGISTRY: dict[str, dict] = {}


def _load_intent_meta_from_specs() -> None:
    """Carga INTENT_META desde todos los módulos *_spec.py bajo utils.bot.

    Esto sigue el mismo patrón que engine._load_bot_specs_and_routes, pero sólo
    se fija en INTENT_META declarados por cada spec.
    """
    base_pkg = "utils.bot"
    # common.py vive en utils/bot/common, así que el root de bots es su padre.
    bot_root = Path(__file__).resolve().parent.parent

    for path in bot_root.rglob("*spec.py"):
        rel = path.relative_to(bot_root)
        mod_name = f"{base_pkg}." + rel.with_suffix("").as_posix().replace("/", ".")
        try:
            mod = importlib.import_module(mod_name)
        except Exception:
            # No rompemos la carga global si un spec falla; sólo lo saltamos.
            continue

        meta = getattr(mod, "INTENT_META", None)
        if not isinstance(meta, dict):
            continue
        key = (meta or {}).get("key")
        if not key:
            continue
        # Último que se registre para una key gana (no debería haber duplicados).
        INTENT_META_REGISTRY[str(key)] = meta


_load_intent_meta_from_specs()


# Construir INTENT_PRIORITY final: base conocida + extras desde specs.
INTENT_PRIORITY: list[str] = []
seen_keys: set[str] = set()
for k in _INTENT_PRIORITY_BASE:
    if k not in seen_keys:
        INTENT_PRIORITY.append(k)
        seen_keys.add(k)

for k in INTENT_META_REGISTRY.keys():
    if k not in seen_keys:
        INTENT_PRIORITY.append(k)
        seen_keys.add(k)


INTENTS = []
for key in INTENT_PRIORITY:
    meta = INTENT_META_REGISTRY.get(key) or {}
    desc = meta.get("desc") or _INTENT_BASE_DESCS.get(key) or ""
    INTENTS.append({"key": key, "desc": desc})

ACCEPTED_INTENT_KEYS = {i["key"] for i in INTENTS}


def _parse_iso_date(value: Optional[str]) -> Optional[date]:
    """Parsea fechas en formato común (YYYY-MM-DD / YYYY/MM/DD) a date segura."""
    if not value:
        return None
    s = str(value).strip().replace("/", "-")[:10]
    try:
        return datetime.fromisoformat(s).date()
    except Exception:
        return None


def _years_between(start: Optional[date], end: Optional[date] = None) -> Optional[int]:
    if not start:
        return None
    end = end or date.today()
    try:
        years = end.year - start.year - ((end.month, end.day) < (start.month, start.day))
        return max(0, years)
    except Exception:
        return None


def _build_persona_from_rut(rut: str, wallet: Optional[str] = None) -> Optional[str]:
    """Construye un texto corto con contexto de la persona (ficha + méritos).

    Se usa para que Grok sepa con quién está hablando: nombre, cargo, antigüedad,
    fecha de cumpleaños y un resumen muy sintético de sus méritos.
    """
    try:
        or_terms = [
            {"rut": rut},
        ]
        try:
            or_terms.append({"rut": int(rut)})
        except Exception:
            pass
        emp = db.trabajadores_vpn.find_one({"$or": or_terms})
        if not emp:
            return None

        nombres = str(emp.get("nombres") or "").strip()
        ap = str(emp.get("apellidopaterno") or "").strip()
        am = str(emp.get("apellidomaterno") or "").strip()
        full_name = " ".join([p for p in [nombres, ap, am] if p]) or f"Trabajador {rut}"

        cargo = (emp.get("cargo") or "").strip()
        seccion = (emp.get("seccion") or "").strip()

        # Fechas clave
        born = _parse_iso_date(emp.get("fechanacimiento") or emp.get("fecha_nacimiento"))
        ingreso = _parse_iso_date(emp.get("fecha_ingreso_empresa") or emp.get("fechaingreso") or emp.get("fecha_ingreso"))
        edad = _years_between(born)
        antig = _years_between(ingreso)

        # Méritos (opcional, si tenemos wallet)
        merit_summary_txt = None
        if wallet:
            try:
                mp = user_profile_summary(wallet)
                # Se asume que el resumen ya viene "bonito"; si es dict, lo comprimimos.
                if isinstance(mp, dict):
                    total = mp.get("total_points") or mp.get("points")
                    badges = mp.get("badges") or mp.get("levels")
                    bits = []
                    if total is not None:
                        bits.append(f"puntos totales de mérito: {int(total)}")
                    if badges:
                        bits.append(f"distinciones: {len(badges)}")
                    if bits:
                        merit_summary_txt = ", ".join(bits)
                elif isinstance(mp, str):
                    merit_summary_txt = mp.strip()
            except Exception:
                merit_summary_txt = None

        # Armar texto final (en español chileno, breve)
        parts = [f"Nombre completo: {full_name} (RUT {rut})."]
        if cargo or seccion:
            rol_bits = []
            if cargo:
                rol_bits.append(f"cargo: {cargo}")
            if seccion:
                rol_bits.append(f"sección: {seccion}")
            parts.append(", ".join(rol_bits) + ".")
        if ingreso or antig is not None:
            if ingreso and antig is not None:
                parts.append(f"Trabaja en la Piccola desde {ingreso.isoformat()} (aprox. {antig} años de antigüedad).")
            elif ingreso:
                parts.append(f"Fecha de inicio: {ingreso.isoformat()}.")
        if born or edad is not None:
            if born and edad is not None:
                parts.append(f"Fecha de cumpleaños: {born.isoformat()} (edad aprox. {edad} años).")
            elif born:
                parts.append(f"Fecha de cumpleaños: {born.isoformat()}.")
        if merit_summary_txt:
            parts.append(f"Resumen de méritos: {merit_summary_txt}.")

        persona = " ".join(parts).strip()
        return persona or None
    except Exception as e:
        logger.warning(f"[_build_persona_from_rut] error construyendo contexto de persona para rut={rut}: {e}")
        return None


async def ask_grok(prompt: str, *, rut: Optional[str] = None, wallet: Optional[str] = None, extra_persona: Optional[str] = None) -> str:
    """Llama a Grok con el prompt dado y, si es posible, contexto de la persona.

    - rut / wallet: si se entregan, se intenta armar un pequeño resumen de ficha y méritos
      para que la Nonna sepa con quién está hablando y pueda personalizar mejor.
    - extra_persona: permite que capas superiores agreguen más contexto si quieren.
    """
    _, model, api_key = get_env_xai()
    api_url = XAI_API_URL
    if not api_key:
        return "No hay clave XAI configurada (XAI_API_KEY)."

    persona_bits = []
    # 1) Ficha básica desde RUT (si viene)
    if rut:
        p_txt = _build_persona_from_rut(str(rut), wallet=wallet)
        if p_txt:
            persona_bits.append(p_txt)
    # 2) Contexto adicional opcional
    if extra_persona:
        persona_bits.append(str(extra_persona).strip())

    persona_block = "\n".join([b for b in persona_bits if b]).strip()

    system_base = (
        "Sos la Nonna Marriana: cálida, directa, con humor. "
        "Siempre responde en español chileno."
    )
    if persona_block:
        system_text = (
            system_base
            + "\n\nContexto del trabajador actual (usa esto para personalizar tu respuesta, pero no revele datos sensibles innecesariamente):\n"
            + persona_block
        )
    else:
        system_text = system_base

    headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}
    body = {
        "model": model,
        "messages": [
            {"role": "system", "content": system_text},
            {"role": "user", "content": prompt},
        ],
        "temperature": 0.3,
    }
    async with httpx.AsyncClient(timeout=30) as client:
        r = await client.post(api_url, headers=headers, json=body)
        r.raise_for_status()
        data = r.json()
        return (data.get("choices", [{}])[0].get("message", {}) or {}).get("content") or "(sin respuesta)"



async def grok_route_intent(user_text: str) -> Optional[dict]:
    api_url, model, api_key = get_env_xai()
    if not api_key:
        return None


    today = datetime.now().strftime('%Y-%m-%d')
    intents_text = "\n".join([f"- {i['key']}: {i['desc']}" for i in INTENTS])
    priority_text = " > ".join(INTENT_PRIORITY)
    allowed_intents_schema = "|".join(sorted(ACCEPTED_INTENT_KEYS))


    # Hints adicionales de intents declaradas en specs (INTENT_META.classification_hints)
    extra_rules = []
    for meta in INTENT_META_REGISTRY.values():
        try:
            for line in meta.get("classification_hints", []) or []:
                extra_rules.append(str(line))
        except Exception:
            continue

    system = (
        "Estás dentro de un chatbot de negocio. Tu tarea es CLASIFICAR la intención del usuario.\n"
        f"Devuelve SOLO JSON exacto con este esquema: {{\"intent\":\"{allowed_intents_schema}\"}}.\n"
        "Ningún otro campo.\n\n"
        "Intenciones disponibles:\n" + intents_text + "\n\n"
        "Reglas:\n"
        f"- Prioridad: {priority_text}.\n"
        "- NO extraigas filtros ni parámetros (fechas, RUT, cuentas, etc.).\n"
        "- Si piden gastos por RUT/cuenta/sucursal/mes => 'gastos'.\n"
        "- Si piden sueldos/remuneraciones por período/RUT => 'sueldos'.\n"
        "- Ventas por producto con énfasis en rentabilidad/margen (por período mensual) (SI INCLUYE RENTA/MARGEN) => 'productos'.\n"
        "- Consultas de menú/productos (ver carta, fotos, detalle, recetas, ventas totales de un producto por fecha/día/mes) SIN hablar de 'por hora' ==> 'menus'.\n"
        "- Si el usuario pregunta 'cuántos [producto/bebida/plato] se vendieron' o 'ventas de [producto]' (p.ej. 'cuántos jugos de frambuesa vendió RAN'), y NO menciona horas/días de semana/semana del mes, NI palabras como 'margen', 'rentabilidad' o 'ticket', CLASIFICA como 'menus', NO como 'ventas'.\n"
        "- Si mencionan frases como 'consumo según venta', 'cuánto se consumió de X según ventas', 'consumo de X según ventas', o similares => 'consumos'.\n"
        "- CUALQUIER pedido que mencione horas específicas (ej. 'a las 4 pm'), 'por hora', día de semana ('lunes','sábado'), 'por garzón/RUT', 'semana del mes' o combinaciones tipo 'ventas por hora de la lasagna' => 'ventas_hora'.\n"
        "- Ventas generales por fecha/rango sin granularidad horaria ('ventas totales de este mes', 'ventas de la semana pasada') => 'ventas'.\n"
        "- 'menus' para detalle/listado de productos y recetas. 'productos' para márgenes/rentabilidad mensual.\n"
        "- Historia/valores de la marca, institucional => 'history'.\n"
        + ("\n" + "\n".join(extra_rules) if extra_rules else "")
        + f"\nHoy es {today}."
    )


    body = {
        "model": model,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": user_text},
        ],
        "temperature": 0.0,
        "response_format": {"type": "json_object"},
    }
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            r = await client.post(api_url, headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            }, json=body)
            r.raise_for_status()
            data = r.json()
            content = (data.get("choices", [{}])[0].get("message", {}) or {}).get("content") or ""
            obj = json.loads(content)
            if not (isinstance(obj, dict) and obj.get("intent") in ACCEPTED_INTENT_KEYS):
                return None
            # Return ONLY the intent field
            return {"intent": obj.get("intent")}
    except Exception:
        return None



def get_link_info(tg_id: int):
    """Fetch Telegram-Privy link info. Returns dict (sin _id). Marca 'expired' si exp ya pasó."""
    doc = db.telegram_links.find_one({"tg_id": str(tg_id)})
    if not doc:
        logger.info(f"[_get_link_info] No link found for tg_id={tg_id}")
        return None
    exp = doc.get("exp")
    if isinstance(exp, int):
        from time import time as _now
        if exp < int(_now()):
            logger.info(f"[_get_link_info] Link expired for tg_id={tg_id}")
            return {"expired": True, **{k: v for k, v in doc.items() if k != "_id"}}
    logger.info(f"[_get_link_info] Link OK for tg_id={tg_id}, wallet={doc.get('wallet')}")
    return {k: v for k, v in doc.items() if k != "_id"}