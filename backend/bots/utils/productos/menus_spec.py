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


def _postprocess_menus(obj: dict) -> dict:
    by = (_norm(obj.get("by"))).lower()
    if by not in {"categoria", "producto", "texto"}:
        by = "texto"
    obj["by"] = by
    obj["q"] = _norm(obj.get("q"))
    obj["detail"] = bool(obj.get("detail", False))

    # Recipe intent
    obj["recipe"] = bool(obj.get("recipe", False))

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
    return obj


SPEC = FilterSpec(
    key="menus",
    schema_text='{"by":"categoria"|"producto"|"texto","q":"","detail":false,"recipe":false,"mesanos":["YYYYMM"]}',
    rules_text=(
        "- Si coincide con NOMBRE de categoría => by='categoria', q=ese nombre.\n"
        "- Si aparece un CÓDIGO exacto => by='producto', q=código.\n"
        "- Si coincide claramente con NOMBRE de menú => by='producto'; en duda => by='texto'.\n"
        "- 'detail' true si piden detalles/foto.\n"
        "- 'recipe' true si piden receta/ingredientes (palabras: 'receta', 'qué lleva', 'ingredientes', 'lleva').\n"
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
    ],
    postprocess=_postprocess_menus,
)
register_filter_spec(SPEC)
