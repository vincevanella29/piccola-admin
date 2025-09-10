# bots/utils/sucursales/locations_spec.py
from typing import List
from utils.web3mongo import db
from ..common.filters import FilterSpec, register_filter_spec, _norm


def _catalog_locations(limit=800) -> List[str]:
    rows = list(db.locations.find({}, {"_id": 0, "nombre": 1, "permalink_slug": 1}).limit(limit))
    out = []
    for r in rows:
        out.append(f"{_norm(r.get('permalink_slug'))}|{_norm(r.get('nombre'))}")
    return out


def _postprocess_locations(obj: dict) -> dict:
    obj["q"] = _norm(obj.get("q"))
    return obj


SPEC = FilterSpec(
    key="locations",
    schema_text='{"q":""}',
    rules_text="- Devuelve 'q' con texto para filtrar por nombre/ciudad/barrio.",
    catalogs=[("LOCALES(slug|nombre)", _catalog_locations)],
    postprocess=_postprocess_locations,
)
register_filter_spec(SPEC)
