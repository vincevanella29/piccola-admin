import os
import json
import logging
import re
from datetime import datetime, timedelta, date
from typing import Optional, Tuple


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
INTENT_PRIORITY = [
    "gastos", "ventas_hora", "menus", "productos", "consumos", "ventas", "sueldos", "locations", "chat", "history"
]
INTENTS = [
    {"key": "gastos", "desc": "Consultas de egresos/costos/boletas/facturas, por cuenta/sucursal/mes/RUT."},
    {"key": "menus", "desc": "Menú y productos: detalle, fotos, recetas y (opcionalmente) ventas totales por fecha de un producto específico."},
    {"key": "productos", "desc": "Rentabilidad/márgenes por producto (por período mensual), top más vendidos/rentables, comparativos."},
    {"key": "consumos", "desc": "Consultas de consumo de artículos de productos, por producto/familia/subfamilia (top/más consumidos, cantidades, por período), consumo segun venta."},
    {"key": "ventas_hora", "desc": "Ventas por hora: por producto, local, garzón/RUT, día de semana/semana del mes, con clima o anulaciones."},
    {"key": "ventas", "desc": "Ventas generales por fecha/rango (totales, tendencias, sin granularidad horaria por defecto)."},
    {"key": "sueldos", "desc": "Remuneraciones/pagos de sueldos por período y opcionalmente por RUT."},
    {"key": "locations", "desc": "Ubicación/tiendas/sucursales (búsqueda por nombre/ciudad/barrio)."},
    {"key": "chat", "desc": "Cualquier otra conversación general."},
    {"key": "history", "desc": "Historia/valores de la marca, institucional."},
]

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


    system = (
        "Estás dentro de un chatbot de negocio. Tu tarea es CLASIFICAR la intención del usuario.\n"
        "Devuelve SOLO JSON exacto con este esquema: {\"intent\":\"sueldos|ventas_hora|ventas|menus|locations|productos|consumos|gastos|chat\"}.\n"
        "Ningún otro campo.\n\n"
        "Intenciones disponibles:\n" + intents_text + "\n\n"
        "Reglas:\n"
        f"- Prioridad: {priority_text}.\n"
        "- NO extraigas filtros ni parámetros (fechas, RUT, cuentas, etc.).\n"
        "- Si piden gastos por RUT/cuenta/sucursal/mes => 'gastos'.\n"
        "- Si piden sueldos/remuneraciones por período/RUT => 'sueldos'.\n"
        "- Ventas por producto con énfasis en rentabilidad/margen (por período mensual) (SI INCLUYE RENTA/MARGEN) => 'productos'.\n"
        "- Consultas de menú/productos (ver carta, fotos, detalle, recetas, ventas totales de un producto por fecha/día/mes) SIN hablar de 'por hora' ==> 'menus'.\n"
        "- Si mencionan frases como 'consumo según venta', 'cuánto se consumió de X según ventas', 'consumo de X según ventas', o similares => 'consumos'.\n"
        "- CUALQUIER pedido que mencione horas específicas (ej. 'a las 4 pm'), 'por hora', día de semana ('lunes','sábado'), 'por garzón/RUT', 'semana del mes' o combinaciones tipo 'ventas por hora de la lasagna' => 'ventas_hora'.\n"
        "- Ventas generales por fecha/rango sin granularidad horaria ('ventas totales de este mes', 'ventas de la semana pasada') => 'ventas'.\n"
        "- 'menus' para detalle/listado de productos y recetas. 'productos' para márgenes/rentabilidad mensual.\n"
        "- Historia/valores de la marca, institucional => 'history'.\n"
        f"Hoy es {today}."
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
            if not (isinstance(obj, dict) and obj.get("intent") in {"sueldos","ventas_hora","ventas","menus","locations","productos","consumos","gastos","chat","history"}):
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