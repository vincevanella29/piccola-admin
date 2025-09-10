import os
import json
import logging
from datetime import datetime, timezone
from typing import Optional, List, Dict

import httpx
from dotenv import load_dotenv
from utils.web3mongo import db

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

# Centralized intent spec (empresa): prioriza analítica para dueños/gerentes/DAO
INTENT_PRIORITY = [
    "ventas", "ventas_hora", "gastos", "sueldos", "productos", "consumos",
    "menus", "locations", "history", "chat"
]
INTENTS = [
    {"key": "ventas", "desc": "Ventas por período, agrupaciones por día/mes/local/clima, comparativos YoY/MoM, tickets promedio."},
    {"key": "ventas_hora", "desc": "Ventas por hora/garzón/local/producto, con filtros por clima/semana/horas."},
    {"key": "gastos", "desc": "Gastos por período con filtros (siglas, cuentas, texto) y agrupaciones (mes, sigla, cuenta)."},
    {"key": "sueldos", "desc": "Nómina/RRHH por meses (sum/promedio/cantidad), agrupado por sigla, sección, cargo, sexo, AFP, RUT."},
    {"key": "productos", "desc": "Top/bottom productos, búsquedas por nombre/categoría y métricas de desempeño."},
    {"key": "consumos", "desc": "Consumos/insumos por período, filtros y agrupaciones operacionales."},
    {"key": "menus", "desc": "Ficha descriptiva de platos (ingredientes, foto, categorías)."},
    {"key": "locations", "desc": "Sucursales/tiendas por nombre/ciudad/barrio/permalink."},
    {"key": "history", "desc": "Historia/valores de la marca, institucional."},
    {"key": "chat", "desc": "Cualquier otra conversación general no cubierta."},
]


async def ask_grok(prompt: str, messages: Optional[List[Dict]] = None) -> str:
    _, model, api_key = get_env_xai()
    api_url = XAI_API_URL
    if not api_key:
        return "No hay clave XAI configurada (XAI_API_KEY)."
    headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}
    # Always prepend persona system message; if messages are provided, forward them as-is after persona.
    persona_msg = {"role": "system", "content": (
        "Eres la Nonna Mariana, asistente ejecutiva de la empresa. "
        "Tu foco es ayudar a dueños/gerentes con información clara y accionable de finanzas, RRHH y operaciones. "
        "Responde SIEMPRE en español chileno, en primera persona y con tono cercano pero profesional. "
        "Sé breve y concreta: destaca KPIs y hallazgos, ofrece comparativos cuando aporten contexto. "
        "Si piden datos operacionales (ventas, gastos, sueldos, consumos, productos), responde con cifras y resúmenes. "
        "Si piden fichas o contexto institucional, entrega descripciones breves. "
    )}
    body_messages: List[Dict]
    if messages and isinstance(messages, list):
        body_messages = [persona_msg] + messages
    else:
        body_messages = [
            persona_msg,
            {"role": "user", "content": prompt},
        ]
    body = {
        "model": model,
        "messages": body_messages,
        "temperature": 0.3,
    }
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            r = await client.post(api_url, headers=headers, json=body)
            r.raise_for_status()
            data = r.json()
            return (data.get("choices", [{}])[0].get("message", {}) or {}).get("content") or "(sin respuesta)"
    except httpx.HTTPError as e:
        # Minimal one-shot retry for transient 5xx
        try:
            if isinstance(e, httpx.HTTPStatusError) and 500 <= e.response.status_code < 600:
                async with httpx.AsyncClient(timeout=30) as client:
                    r2 = await client.post(api_url, headers=headers, json=body)
                    r2.raise_for_status()
                    data2 = r2.json()
                    return (data2.get("choices", [{}])[0].get("message", {}) or {}).get("content") or "(sin respuesta)"
        except Exception:
            pass
        logger.error(f"ask_grok error: {e}")
        # Graceful fallback so chat pipeline does not crash
        return "Estoy con alta carga en el servicio de IA. Intentemos de nuevo en unos segundos, o pide un resumen más corto."
    except Exception as e:
        logger.error(f"ask_grok unexpected error: {e}")
        return "No pude generar la respuesta en este momento. Intentemos nuevamente en unos segundos."


# ===== User context helpers (centralized) =====

def fetch_enriched_profile(wallet: Optional[str], privy_id: Optional[str]) -> Optional[dict]:
    """Return CommunityRankingResponse-like object for chat UIs.
    {
      wallet, profile: {..UserProfileResponse..}, completion_percentage, balances, burns, updated_at
    }
    """
    try:
        if not wallet and not privy_id:
            return None
        prof = None
        if wallet:
            prof = db.user_profiles.find_one({"wallet": wallet})
        elif privy_id:
            prof = db.user_profiles.find_one({"privy_id": privy_id})
        profile_out = None
        if prof:
            profile_out = {
                "wallet": prof.get("wallet", wallet or ""),
                "name": prof.get("name"),
                "email": prof.get("email"),
                "twitter": prof.get("twitter"),
                "discord": prof.get("discord"),
                "instagram": prof.get("instagram"),
                "bio": prof.get("bio"),
                "profile_image_url": prof.get("profile_image_url") if "profile_image_url" in prof else None,
                "additional_socials": prof.get("additional_socials"),
                "favorite_location": prof.get("favorite_location"),
                "liked_products": prof.get("liked_products"),
                "birthdate": prof.get("birthdate"),
                "subscribe_news": prof.get("subscribe_news"),
                "public_profile": prof.get("public_profile", False),
                "public_name": prof.get("public_name", False),
                "public_birthdate": prof.get("public_birthdate", False),
                "created_at": (prof.get("created_at") or datetime.now(timezone.utc)).isoformat(),
                "updated_at": (prof.get("updated_at") or datetime.now(timezone.utc)).isoformat(),
            }
        ranking = None
        if wallet:
            ranking = db.community_rankings.find_one({"wallet": wallet})
        enriched = {
            "wallet": wallet,
            "profile": profile_out,
            "completion_percentage": float((ranking or {}).get("completion_percentage") or 0.0),
            "balances": (ranking or {}).get("balances", {}) or {},
            "burns": (ranking or {}).get("burns", {}) or {},
            "updated_at": ((ranking or {}).get("updated_at") or (prof and prof.get("updated_at")) or datetime.now(timezone.utc)).isoformat(),
        }
        return enriched
    except Exception:
        return None


def build_user_context(conv: dict) -> dict:
    wallet = conv.get("wallet")
    privy_id = conv.get("privy_id")
    profile = fetch_enriched_profile(wallet, privy_id)
    return {
        "wallet": wallet,
        "privy_id": privy_id,
        "profile": profile or {},
    }


def build_grok_user_context(user_ctx: dict) -> dict:
    """Produce a compact, well-structured context for Grok.
    - Joins liked_products codes with menus to expose favorite dishes by name/code/cats/price.
    - Adds promotions summary and guidance when there are no promotions.
    - Annotates Company 1 tokens (PAZ governance, PARE utility) with balances.
    """
    try:
        wallet = user_ctx.get("wallet")
        profile = user_ctx.get("profile") or {}
        prof_node = profile.get("profile") if isinstance(profile, dict) else {}
        liked = (prof_node or {}).get("liked_products") or {}
        liked_codes = [str(k) for k, v in liked.items() if v]

        favorites = []
        if liked_codes:
            menu_docs = list(db.menus.find({"codigo": {"$in": liked_codes}}))
            cat_map: Dict[str, str] = {}
            try:
                categories = list(db.categories.find({}))
                for c in categories:
                    cid = str(c.get("id") or c.get("_id"))
                    name = c.get("nombre") or c.get("name")
                    if cid and name:
                        cat_map[cid] = name
            except Exception:
                pass
            for m in menu_docs:
                code = str(m.get("codigo") or "")
                name = m.get("nombre")
                price = m.get("precio")
                currency = (m.get("currency") or "$")
                cat_ids = [str(x) for x in (m.get("category_ids") or [])]
                cat_names = [cat_map.get(cid) for cid in cat_ids if cat_map.get(cid)]
                favorites.append({
                    "code": code,
                    "name": name,
                    "price": price,
                    "currency": currency,
                    "categories": cat_names,
                })

        promos = user_ctx.get("promotions") or {}
        claims = int(promos.get("claims_count") or 0)
        consumptions = int(promos.get("consumptions_count") or 0)
        has_promos = (claims + consumptions) > 0
        guidance = None
        if not has_promos:
            guidance = (
                "Este usuario no tiene promociones todavía. Sugiere participar en misiones en app/club/missions "
                "para obtener y canjear beneficios."
            )

        balances = (profile or {}).get("balances") or {}
        bal_lower = {str(k).lower(): v for k, v in balances.items()}
        paz_addr = "0xed3fe847c761a6c4bb9d7f7504a260199fcff2b3"  # governance
        pare_addr = "0xa4b62c626c16f393a1dec759e063d9004590efc9"  # utility
        tokens = {
            "company_id": 1,
            "governance": {
                "address": paz_addr,
                "symbol": "PAZ",
                "amount": (bal_lower.get(paz_addr) or {}).get("amount", 0),
            },
            "utility": {
                "address": pare_addr,
                "symbol": "PARE",
                "amount": (bal_lower.get(pare_addr) or {}).get("amount", 0),
            },
        }

        # Birthday details and CTA for promotions
        birthdate_raw = (prof_node or {}).get("birthdate")  # expected YYYY-MM-DD
        is_birthday_today = False
        days_to_birthday = None
        birthday_note = None
        try:
            if birthdate_raw:
                # Accept YYYY-MM-DD; ignore time if present
                bstr = str(birthdate_raw).split("T")[0].strip()
                year, month, day = [int(x) for x in bstr.split("-")[:3]]
                today = datetime.now().date()
                this_year_bday = today.replace(year=today.year, month=month, day=day)
                if this_year_bday < today:
                    next_bday_year = today.year + 1
                    this_year_bday = today.replace(year=next_bday_year, month=month, day=day)
                delta = (this_year_bday - today).days
                days_to_birthday = int(delta)
                is_birthday_today = (days_to_birthday == 0)
                if is_birthday_today:
                    birthday_note = "Hoy es su cumpleaños."
                elif 0 < days_to_birthday <= 7:
                    birthday_note = f"Faltan {days_to_birthday} días para su cumpleaños."
        except Exception:
            pass

        out = {
            "identity": {
                "wallet": wallet,
            },
            "profile": {
                "name": (prof_node or {}).get("name"),
                "favorite_location": (prof_node or {}).get("favorite_location"),
                "profile_image_url": (prof_node or {}).get("profile_image_url"),
                "birthdate": (prof_node or {}).get("birthdate"),
                "completion_percentage": (profile or {}).get("completion_percentage"),
                "public_profile": (prof_node or {}).get("public_profile", False),
            },
            "favorites": favorites,
            "promotions": {
                "has_promotions": has_promos,
                "claims_count": claims,
                "consumptions_count": consumptions,
                "guidance_if_none": guidance,
            },
            "tokens_company_1": tokens,
            "birthday": {
                "is_today": bool(is_birthday_today),
                "days_to_birthday": days_to_birthday,
                "note": birthday_note,
                "promotions_cta": "app/club/promotions",
            },
        }
        return out
    except Exception:
        return {}

async def grok_route_intent(user_text: str) -> Optional[dict]:
    api_url, model, api_key = get_env_xai()
    if not api_key:
        return None
    today = datetime.now().strftime('%Y-%m-%d')
    intents_text = "\n".join([f"- {i['key']}: {i['desc']}" for i in INTENTS])
    priority_text = " > ".join(INTENT_PRIORITY)

    allowed_keys = "|".join([i["key"] for i in INTENTS])
    system = (
        "Estás dentro de un chatbot empresarial. Tu tarea es CLASIFICAR la intención del usuario.\n"
        f"Devuelve SOLO JSON exacto con este esquema: {{\"intent\":\"{allowed_keys}\"}}.\n"
        "Ningún otro campo.\n\n"
        "Intenciones disponibles:\n" + intents_text + "\n\n"
        "Reglas:\n"
        f"- Prioridad: {priority_text}.\n"
        "- Análisis de negocio y operaciones => (ventas, ventas_hora, gastos, sueldos, productos, consumos).\n"
        "- Fichas y contexto institucional => menus, locations, history.\n"
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
            allowed = {i["key"] for i in INTENTS}
            if not (isinstance(obj, dict) and obj.get("intent") in allowed):
                return None
            # Return ONLY the intent field
            return {"intent": obj.get("intent")}
    except Exception:
        return None