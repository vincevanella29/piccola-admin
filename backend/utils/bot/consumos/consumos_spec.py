from typing import List
from utils.web3mongo import db
from ..common.filters import FilterSpec, register_filter_spec, _norm

def _catalog_articles(limit=4000) -> List[str]:
    rows = list(db.articulos_consumo.find({}, {"_id": 0, "articulo": 1}).limit(limit))
    return [(_norm(r.get("articulo")) or "") for r in rows if _norm(r.get("articulo"))]

def _catalog_families(limit=2000) -> List[str]:
    rows = list(db.articulos_consumo.find({}, {"_id": 0, "familia": 1}).limit(limit))
    out = []
    for r in rows:
        s = _norm(r.get("familia"))
        if s: out.append(s)
    return sorted(set(out))

def _catalog_subfamilies(limit=4000) -> List[str]:
    rows = list(db.articulos_consumo.find({}, {"_id": 0, "subfamilia": 1}).limit(limit))
    out = []
    for r in rows:
        s = _norm(r.get("subfamilia"))
        if s: out.append(s)
    return sorted(set(out))

def _catalog_locals(limit=1000) -> List[str]:
    try:
        return sorted(list({_norm(x) for x in db.consumo_locales.distinct("local") if x}))
    except Exception:
        return []

SCHEMA = (
    '{'
    '  "match": {'
    '    "dates": ["YYYY-MM-DD", "..."],'
    '    "mesanos": ["YYYYMM", "..."],'
    '    "locals": ["ALMLOC","..."],'
    '    "articles": ["1003012 LOMO LISO PROC. kg","..."],'
    '    "families": ["10 PRODUCCION","..."],'
    '    "subfamilies": ["1003 CARNES","..."],'
    '    "article_regex": ["substring opcional si no hay match exacto"]'
    '  },'
    '  "group_by": "local|articulo|familia|subfamilia|mes|dia" | ["local","dia", "..."],'
    '  "measure": "cantidad|total_consumo|auto",'
    '  "unit": "kg|unidad|auto",'
    '  "order": "desc|asc",'
    '  "order_by": "dia|valor",'
    '  "limit": 50,'
    '  "output": {"mode": "table|single"}'
    '}'
)

RULES = (
    "- Traduce el pedido a un **plan ejecutable** con el SCHEMA.\n"
    "- Piensa SIEMPRE en un **data table**: columnas = claves de `group_by`, filas = cada combinación distinta de esas claves (rows).\n"
    "- Si el usuario habla explícitamente de datos 'por local y fecha/día' (o 'agrupado por local y día'), usa `group_by`=['local','dia'] como layout natural de tabla.\n"
    "- Si SOLO menciona una dimensión (p.ej. solo local, o solo fecha, o solo artículo) o frases como 'por local' sin hablar de día/fecha, usa `group_by` como string con ESA única dimensión (filas simples, sin dia adicional).\n"
    "- Para combinaciones más complejas (local + familia, local + artículo, etc.), arma `group_by` como una lista ordenada con esas claves, pensando en que la tabla sea legible (primero local, luego dia/familia/etc.).\n"
    "- **Resuelve todas las fechas** (p.ej. 'viernes pasado', 'semana pasada') a lista explícita YYYY-MM-DD en zona America/Santiago.\n"
    "- Usa catálogos (ARTICULOS, FAMILIAS, SUBFAMILIAS, LOCALES) para devolver **valores exactos**; si no hay match exacto, usa `article_regex`.\n"
    "- `group_by` puede ser un string o una lista de claves; soporta: local, articulo, familia, subfamilia, mes, dia. Ej.: ['local','dia'].\n"
    "- `measure`:\n"
    "  * `total_consumo` si piden consumo en kg explícito.\n"
    "  * `cantidad` si piden 'según venta'/unidades.\n"
    "  * `auto` si no es claro.\n"
    "- **`unit`**: decide la **unidad de salida** (`kg` o `unidad`) usando las pistas del artículo (p.ej. termina en 'kg' o 'X UN'), o `auto` si no hay claridad.\n"
    "- Orden: por defecto, si se agrupa por 'dia', usa `order_by`='dia' (cronológico asc). Si el usuario pide 'ordenado por cantidad/unidad/kg', usa `order_by`='valor' y ajusta `unit` según corresponda (desc por defecto).\n"
    "- No inventes periodos por defecto: si no piden mes completo, usa solo `dates`.\n"
    "- Devuelve **solo JSON** del plan."
)

def _postprocess(plan: dict) -> dict:
    def _lst(xs): return [ _norm(x) for x in (xs or []) if _norm(x) ]
    plan = plan or {}
    m = plan.get("match") or {}
    plan["match"] = {
        "dates": _lst(m.get("dates")),
        "mesanos": _lst(m.get("mesanos")),
        "locals": _lst(m.get("locals")),
        "articles": _lst(m.get("articles")),
        "families": _lst(m.get("families")),
        "subfamilies": _lst(m.get("subfamilies")),
        "article_regex": _lst(m.get("article_regex")),
    }
    # group_by: admitir string o lista; normalizar y validar
    allowed_gb = {"local","articulo","familia","subfamilia","mes","dia"}
    raw_gb = plan.get("group_by")
    gb_list = []
    if isinstance(raw_gb, str):
        # split por comas opcional
        parts = [p.strip() for p in raw_gb.split(",") if p.strip()]
        gb_list = parts or [raw_gb]
    elif isinstance(raw_gb, list):
        gb_list = [str(x) for x in raw_gb]
    gb_list = [_norm(x) for x in gb_list if _norm(x) in allowed_gb]
    # fallback por defecto
    if not gb_list:
        gb_list = ["local"]
    # dedup preservando orden
    seen = set()
    gb_final = []
    for g in gb_list:
        if g not in seen:
            seen.add(g)
            gb_final.append(g)
    plan["group_by"] = gb_final if len(gb_final) > 1 else gb_final[0]
    ms = _norm(plan.get("measure") or "")
    if ms not in {"cantidad","total_consumo","auto"}: ms = "auto"
    plan["measure"] = ms
    ut = _norm(plan.get("unit") or "")
    if ut not in {"kg","unidad","auto"}: ut = "auto"
    plan["unit"] = ut
    od = _norm(plan.get("order") or "")
    if od not in {"asc","desc"}: od = "desc"
    plan["order"] = od
    # order_by opcional: dia|valor
    ob = _norm(plan.get("order_by") or "")
    if ob not in {"dia","valor"}: ob = ""
    # default: si se agrupa por dia y no viene 'valor', usar dia
    gb_for_default = plan.get("group_by")
    gb_list_for_default = gb_for_default if isinstance(gb_for_default, list) else [gb_for_default]
    if (not ob) and any(g == "dia" for g in (gb_list_for_default or [])):
        ob = "dia"
        # y si no viene order, usar asc
        plan["order"] = plan.get("order") or "asc"
    plan["order_by"] = ob
    try:
        lim = int(plan.get("limit") or 50)
    except Exception:
        lim = 50
    plan["limit"] = max(1, min(lim, 200))
    out = plan.get("output") or {}
    mode = _norm(out.get("mode") or "")
    if mode not in {"table","single"}: mode = "table"
    plan["output"] = {"mode": mode}
    return plan

SPEC = FilterSpec(
    key="consumos",
    schema_text=SCHEMA,
    rules_text=RULES,
    catalogs=[
        ("ARTICULOS(articulo)", _catalog_articles),
        ("FAMILIAS", _catalog_families),
        ("SUBFAMILIAS", _catalog_subfamilies),
        ("LOCALES", _catalog_locals),
    ],
    postprocess=_postprocess,
)
register_filter_spec(SPEC)


ENGINE_ROUTES = {
    "consumos": {
        "intent": "consumos",
        "kind": "filter_handler",
        "filter_key": "consumos",
        "filter_timeout": 15.0,
        "handler": "utils.bot.consumos.consumos:handle_consumos",
        "handler_timeout": 30.0,
        # Pasamos el plan completo al contexto para evitar reparsear dentro del handler.
        "filter_to_context": {"__full__": "consumos_spec"},
        # Acceso: niveles 1-7; el handler restringe lvl6 por sucursal y lvl7 por centros de costo/productos.
        "access": {
            "min_role_level": 1,
            "max_role_level": 7,
        },
        # Config declarativa de qué partes del payload son relevantes para el resumen con Grok.
        # El engine sólo sigue estas secciones; no sabe nada de "consumos".
        "summary": {
            "data_table": {
                "include_generic": True,
                "sections": {
                    # Totales globales de consumo (en kg o uds, según value_label)
                    "totals": {
                        "root_key": "totals",
                        "fields": ["value"],
                    },
                },
            },
        },
        "default_payload": {
            "type": "text_block_list",
            "intent": "consumos",
            "lines": [
                "No hay datos de consumos ahora.",
            ],
        },
    },
}
