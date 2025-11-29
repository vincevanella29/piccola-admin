# bots/utils/productos/menus_spec.py
from typing import List
import unicodedata
from utils.web3mongo import db
from ..common.filters import FilterSpec, register_filter_spec, _norm
from datetime import datetime


def _catalog_categories(limit=1000) -> List[str]:
    rows = list(db.categories.find({}, {"_id": 0, "id": 1, "nombre": 1, "name": 1}).limit(limit))
    out = []
    for r in rows:
        cid = _norm(r.get("id"))
        n = _norm(r.get("nombre") or r.get("name"))
        if n:
            out.append(f"{cid}|{n}")
    return out


def _catalog_menus(limit=3000) -> List[str]:
    rows = list(db.menus.find({}, {"_id": 0, "codigo": 1, "nombre": 1, "descripcion": 1}).limit(limit))
    out = []
    for r in rows:
        code = _norm(r.get("codigo"))
        name = _norm(r.get("nombre"))
        # No enviamos descripcion a Grok en el catalogo para evitar que se sesgue
        # demasiado a un solo producto por texto largo; solo codigo y nombre.
        if code or name:
            out.append(f"{code}|{name}")
    return out


def _no_accents(txt: str) -> str:
    try:
        return "".join(
            c for c in unicodedata.normalize("NFD", txt or "")
            if unicodedata.category(c) != "Mn"
        )
    except Exception:
        return (txt or "")


def _singularize_es(word: str) -> List[str]:
    w = (word or "").strip().lower()
    cands = {w}
    if w.endswith("es") and len(w) > 4:
        cands.add(w[:-2])
    if w.endswith("s") and len(w) > 3:
        cands.add(w[:-1])
    # casos comunes (lasaña/lasagna)
    cands.add(w.replace("ñ", "n"))
    return list(cands)


def _postprocess_menus(obj: dict) -> dict:
    # Búsqueda libre por catálogo (opcional)
    by = (_norm(obj.get("by")).lower())
    if by not in {"categoria", "producto", "texto"}:
        by = "texto"
    obj["by"] = by
    obj["q"] = _norm(obj.get("q"))

    # Periodo granular (fecha/hora) para ventas por hora de productos: aceptar presets o rango
    period = obj.get("period") or {}
    if not isinstance(period, dict):
        period = {}
    # normalizar campos conocidos: preset|start|end|tz
    period = {
        k: _norm(v) for k, v in {
            "preset": period.get("preset"),
            "start": period.get("start"),
            "end": period.get("end"),
            "tz": period.get("tz") or "America/Santiago",
        }.items() if v is not None
    }
    obj["period"] = period

    # Grouping/measure/ordering para dataset horario
    gb = (_norm(obj.get("group_by")) or "producto").lower()
    if gb not in {"hora","dia","mes","local","local_mes","local_dia","producto"}:
        gb = "producto"
    obj["group_by"] = gb

    meas = (_norm(obj.get("measure")) or "total").lower()  # total|cantidad|avg_precio
    if meas not in {"total","cantidad","avg_precio"}:
        meas = "total"
    obj["measure"] = meas

    ob = (_norm(obj.get("order_by")) or "value_desc").lower()
    if ob not in {"value_desc","value_asc","group_asc"}:
        ob = "value_desc"
    obj["order_by"] = ob

    # Filtros: locales, siglas, codigos, horas, dia de semana
    def _norm_list(xs):
        if not isinstance(xs, list): return []
        out = []
        for x in xs:
            s = _norm(x)
            if s: out.append(s)
        return out
    f = obj.get("filters") or {}
    if not isinstance(f, dict): f = {}
    f["include_locals"] = _norm_list(f.get("include_locals"))[:60]
    f["include_siglas"] = [s.upper() for s in _norm_list(f.get("include_siglas"))][:40]
    f["include_codigos"] = [s.upper() for s in _norm_list(f.get("include_codigos"))][:200]
    # horas y días de semana numéricos (0=domingo..6=sábado) si vienen como texto, se ignoran
    try:
        f["hour_in"] = [int(x) for x in (f.get("hour_in") or []) if isinstance(x, (int, float)) and 0 <= int(x) <= 23][:24]
    except Exception:
        f["hour_in"] = []
    try:
        f["dow_in"] = [int(x) for x in (f.get("dow_in") or []) if isinstance(x, (int, float)) and 0 <= int(x) <= 6][:7]
    except Exception:
        f["dow_in"] = []
    # A partir de aquí, confiamos en que Grok ya decidió exactamente qué filtrar
    # (familias, subfamilias, códigos, locales, etc.) según el schema_text y
    # los catálogos MENUS/CATEGORIAS. Solo normalizamos tipos y mayúsculas.
    obj["filters"] = f

    # Vista
    v = obj.get("view") or {}
    if not isinstance(v, dict): v = {}
    try:
        v_limit = int(v.get("limit_groups", 200))
    except Exception:
        v_limit = 200
    v["limit_groups"] = max(5, min(v_limit, 500))
    v["detail"] = bool(v.get("detail", False))
    obj["view"] = v

    # Señales descriptivas legacy
    obj["detail"] = bool(obj.get("detail", False))
    obj["recipe"] = bool(obj.get("recipe", False))

    return obj


SPEC = FilterSpec(
    key="menus",
    schema_text=(
        '{'
        '  "by":"categoria"|"producto"|"texto", "q":"",\n'
        '  "period":{"preset":"hoy|ayer|este_mes|mes_pasado|este_ano"|"","start":"YYYY-MM-DD|","end":"YYYY-MM-DD|","tz":"America/Santiago"},\n'
        '  "group_by":"producto"|"hora"|"dia"|"mes"|"local"|"local_mes"|"local_dia",\n'
        '  "measure":"total"|"cantidad"|"avg_precio",\n'
        '  "order_by":"value_desc"|"value_asc"|"group_asc",\n'
        '  "filters":{"include_locals":["ALMLOC"],"include_siglas":["ALM"],"include_codigos":["0208002"],"hour_in":[12,13],"dow_in":[5,6]},\n'
        '  "view":{"limit_groups":200,"detail":false},\n'
        '  "detail":false, "recipe":false\n'
        '}'
    ),
    rules_text=(
        "- Búsqueda de productos por nombre/código/categoría para acotar los resultados.\n"
        "- Si piden por fecha/hora/día/mes/local, llenar period/group_by/measure/order_by según corresponda.\n"
        "- 'detail' true: habilitar salida de recetas (para usuarios 3-4) en tabla separada.\n"
        "- 'hour_in' y 'dow_in' cuando mencionan horas/días específicos.\n"
        "- 'include_locals'/'include_siglas' para filtrar sucursales.\n"
        "- Si el usuario pide la RECETA de un producto por nombre (sin código numérico explícito), busca TODOS los productos MENUS(codigo|nombre) cuyo nombre contenga o sea muy parecido al texto, y devuelve TODOS sus códigos en filters.include_codigos (no adivines solo uno).\n"
        "- Solo cuando el usuario entrega un código numérico explícito en el texto, puedes limitar filters.include_codigos a ese único código.\n"
    ),
    catalogs=[
        ("CATEGORIAS(id|nombre)", _catalog_categories),
        ("MENUS(codigo|nombre|descripcion)", _catalog_menus),
    ],
    postprocess=_postprocess_menus,
)
register_filter_spec(SPEC)


# Metadata declarativa de la intent 'menus' para el router de intents (common.grok_route_intent)
INTENT_META = {
    "key": "menus",
    "desc": "Menú y productos: carta, detalle de platos/bebidas, fotos, recetas y ventas totales de un producto específico por fecha.",
    "classification_hints": [
        "- Usa 'menus' cuando el usuario pregunte por productos de la carta (platos, bebidas, menús), quiera ver detalle, fotos, descripción o recetas.",
        "- También usa 'menus' cuando pidan cuántas unidades de un producto específico se vendieron en un periodo/local, SIN hablar de margen/rentabilidad ni de 'por hora'.",
        "- Ejemplos: 'cuántos jugos de frambuesa vendió RAN', 'muéstrame la lasagna boloñesa', 'receta de los aros milan'.",
        "- Si mencionan margen, rentabilidad o margen %, clasifica como 'productos' en vez de 'menus'. Si preguntan ventas por hora/día de semana/garzón, clasifica como 'ventas_hora'.",
    ],
}


ENGINE_ROUTES = {
    "menus": {
        "intent": "menus",
        "kind": "filter_handler",
        # El engine también puede parsear con el SPEC de 'menus'.
        "filter_key": "menus",
        "filter_timeout": 2.5,
        "handler": "utils.bot.productos.menus:handle_menus_intent",
        "handler_timeout": 6.0,
        # Pasamos el spec completo de filtros al contexto como 'menus_filters' para evitar
        # volver a llamar grok_filters("menus", text) dentro del handler.
        "filter_to_context": {"__full__": "menus_filters"},
        "access": {
            "min_role_level": 1,
            "max_role_level": 7,
        },
        # Hint para el engine: qué partes del payload son relevantes para el resumen con Grok.
        # El engine NO conoce nada del dominio (producto/receta); solo recorre estas secciones.
        "summary": {
            "product_card": {
                "include_generic": True,
                "sections": {
                    "product": {
                        "root_key": "product",
                        "fields": ["name", "code", "price", "currency", "categories", "description"],
                    },
                    "recipe": {
                        "root_key": "recipe",
                        "fields": ["mesano"],
                        "rows": {
                            "key": "rows",
                            "fields": ["ingredient", "qty_text", "unit", "pct"],
                            "max": 40,
                        },
                    },
                },
            },
            "data_table": {
                "include_generic": True,
                "sections": {
                    "products": {
                        "root_key": "__payload__",
                        "rows": {
                            "key": "rows",
                            "fields": ["code", "name", "price", "currency", "image_url", "group"],
                            "max": 40,
                        },
                    },
                },
            },
        },
        "default_payload": {
            "type": "text_block_list",
            "intent": "menus",
            "lines": [
                "No hay datos de menús ahora.",
            ],
        },
    },
}
