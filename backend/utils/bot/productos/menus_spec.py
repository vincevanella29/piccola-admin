# bots/utils/productos/menus_spec.py
from typing import List
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
        descr = _norm(r.get("descripcion"))
        if code or name or descr:
            out.append(f"{code}|{name}|{descr[:120]}")
    return out


def _catalog_options(limit=3000) -> List[str]:
    rows = list(db.menu_options.find({}, {"_id": 0, "nombre": 1, "name": 1, "title": 1}).limit(limit))
    out = []
    for r in rows:
        name = _norm(r.get("nombre") or r.get("name") or r.get("title"))
        if name:
            out.append(name)
    return out


def _postprocess_menus(obj: dict) -> dict:
    by = (_norm(obj.get("by")).lower())
    if by not in {"categoria", "producto", "texto"}:
        by = "texto"
    obj["by"] = by
    obj["q"] = _norm(obj.get("q"))
    obj["detail"] = bool(obj.get("detail", False))

    # Mesanos normalization (expect array of strings like YYYYMM, max 2)
    mesanos = obj.get("mesanos") or []
    out: list[str] = []
    now = datetime.now()
    def yyyymm(dt: datetime) -> str:
        return dt.strftime("%Y%m")
    # ensure list
    if isinstance(mesanos, str):
        mesanos = [mesanos]
    for x in mesanos:
        s = _norm(x)
        if len(s) == 6 and s.isdigit():
            out.append(s)
    if not out:
        out = [yyyymm(now)]
    # cap to 2 for concise responses
    obj["mesanos"] = out[:2]

    # Preferencias (lista de strings normalizados)
    prefs = obj.get("preferencias") or obj.get("prefs") or []
    if isinstance(prefs, str):
        prefs = [prefs]
    obj["preferencias"] = [p for p in map(_norm, prefs) if p]

    # Rango de precios
    def _to_num(v):
        try:
            return float(v)
        except Exception:
            return None
    min_price = _to_num(obj.get("min_price"))
    max_price = _to_num(obj.get("max_price"))
    budget = _to_num(obj.get("budget"))
    obj["min_price"] = min_price
    obj["max_price"] = max_price
    obj["budget"] = budget

    sort = (_norm(obj.get("sort")) or "").lower()
    if sort not in {"best", "cheap", "expensive"}:
        sort = "best"
    obj["sort"] = sort
    return obj


SPEC = FilterSpec(
    key="menus",
    schema_text='{"by":"categoria"|"producto"|"texto","q":"","detail":false,"mesanos":["YYYYMM"],"preferencias":["..."],"min_price":0,"max_price":0,"budget":0,"sort":"best"|"cheap"|"expensive"}',
    rules_text=(
        "- Si coincide con NOMBRE de categoría => by='categoria', q=ese nombre.\n"
        "- Si aparece un CÓDIGO exacto => by='producto', q=código.\n"
        "- Si coincide claramente con NOMBRE de menú => by='producto'; en duda => by='texto'.\n"
        "- 'detail' true si piden detalles/foto.\n"
        "- Extrae 'preferencias' (libre) usando los catálogos de CATEGORIAS, MENUS y OPCIONES: dietas (veg, sin gluten), tipos (pollo, carne, pescado, pasta, pizza, ensalada, sopa, postre), estilos (picante), y señales de precio (barato, premium).\n"
        "- Si mencionan 'barato', 'económico' => sort='cheap'. Si mencionan 'premium', 'gourmet' => sort='expensive'. Por defecto sort='best'.\n"
        "- Si proporcionan precios (ej. '<= 10000', 'máximo 10k', 'presupuesto 12.000') completa min_price/max_price/budget (en número).\n"
        "- 'mesanos' debe contener 1 o 2 periodos YYYYMM. Generar según el texto del usuario:\n"
        "  · vacío => [mes actual].\n"
        "  · 'mes pasado' => [YYYYMM del mes anterior].\n"
        "  · 'año pasado' con nombre de mes => [YYYYMM de ese mes del año anterior].\n"
        "  · 'año pasado' solo => [YYYYMM del mismo mes del año anterior].\n"
        "  · explícito 'YYYYMM' => [ese único].\n"
        "  · si dicen 'vs' o 'compar' y no especifican más => [actual, mes pasado]; si mencionan 'año pasado' => [actual, mismo mes del año pasado]."
    ),
    catalogs=[
        ("CATEGORIAS(id|nombre)", _catalog_categories),
        ("MENUS(codigo|nombre|descripcion)", _catalog_menus),
        ("OPCIONES(nombre)", _catalog_options),
    ],
    postprocess=_postprocess_menus,
)
register_filter_spec(SPEC)
