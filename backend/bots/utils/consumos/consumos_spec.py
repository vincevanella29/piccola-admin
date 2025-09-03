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
    '  "group_by": "local|articulo|familia|subfamilia|mes",'
    '  "measure": "cantidad|total_consumo|auto",'
    '  "unit": "kg|unidad|auto",'
    '  "order": "desc|asc",'
    '  "limit": 50,'
    '  "output": {"mode": "table|single"}'
    '}'
)

RULES = (
    "- Traduce el pedido a un **plan ejecutable** con el SCHEMA.\n"
    "- **Resuelve todas las fechas** (p.ej. 'viernes pasado', 'semana pasada') a lista explícita YYYY-MM-DD en zona America/Santiago.\n"
    "- Usa catálogos (ARTICULOS, FAMILIAS, SUBFAMILIAS, LOCALES) para devolver **valores exactos**; si no hay match exacto, usa `article_regex`.\n"
    "- `group_by` según lo que pidan (p.ej. 'por local').\n"
    "- `measure`:\n"
    "  * `total_consumo` si piden consumo en kg explícito.\n"
    "  * `cantidad` si piden 'según venta'/unidades.\n"
    "  * `auto` si no es claro.\n"
    "- **`unit`**: decide la **unidad de salida** (`kg` o `unidad`) usando las pistas del artículo (p.ej. termina en 'kg' o 'X UN'), o `auto` si no hay claridad.\n"
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
    gb = _norm(plan.get("group_by") or "")
    if gb not in {"local","articulo","familia","subfamilia","mes"}: gb = "local"
    plan["group_by"] = gb
    ms = _norm(plan.get("measure") or "")
    if ms not in {"cantidad","total_consumo","auto"}: ms = "auto"
    plan["measure"] = ms
    ut = _norm(plan.get("unit") or "")
    if ut not in {"kg","unidad","auto"}: ut = "auto"
    plan["unit"] = ut
    od = _norm(plan.get("order") or "")
    if od not in {"asc","desc"}: od = "desc"
    plan["order"] = od
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
