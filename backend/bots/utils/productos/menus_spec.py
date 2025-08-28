# bots/utils/productos/menus_spec.py
from typing import List
from utils.web3mongo import db
from ..common.filters import FilterSpec, register_filter_spec, _norm


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
    return obj


SPEC = FilterSpec(
    key="menus",
    schema_text='{"by":"categoria"|"producto"|"texto","q":"","detail":false}',
    rules_text=(
        "- Si coincide con NOMBRE de categoría => by='categoria', q=ese nombre.\n"
        "- Si aparece un CÓDIGO exacto => by='producto', q=código.\n"
        "- Si coincide claramente con NOMBRE de menú => by='producto'; en duda => by='texto'.\n"
        "- 'detail' true si piden detalles/foto."
    ),
    catalogs=[
        ("CATEGORIAS(id|nombre)", _catalog_categories),
        ("MENUS(codigo|nombre|descripcion)", _catalog_menus),
    ],
    postprocess=_postprocess_menus,
)
register_filter_spec(SPEC)
