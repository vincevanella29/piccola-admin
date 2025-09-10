# bots/utils/productos/productos_spec.py
from typing import List
from utils.web3mongo import db
from ..common.filters import FilterSpec, register_filter_spec, _norm, _coerce_period_to_yyyymm
import re


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

def _catalog_weather_tags() -> List[str]:
    return ["lluvia","soleado","nieve","otro","sin_dato"]

def _postprocess_productos(obj: dict) -> dict:
    # --- búsqueda ---
    by = (_norm(obj.get("by"))).lower()
    if by not in {"codigo", "nombre", "categoria", ""}: by = ""
    obj["by"] = by
    obj["q"] = _norm(obj.get("q"))
    obj["top"] = bool(obj.get("top", False))
    obj["hide_values"] = bool(obj.get("hide_values", False))

    # --- periodo (YYYYMM o rango por ventas/fechas naturales que terminamos coercionando a últimos meses) ---
    per = _norm(obj.get("period") or "")
    obj["period"] = _coerce_period_to_yyyymm(per)

    # --- grouping / measures / ordering ---
    gb = (_norm(obj.get("group_by")) or "producto").lower()
    allowed_groups = {
        "producto","categoria","familia","subfamilia","centroproduccion",
        "mes","local","weather","mes_weather","local_weather"
    }
    if gb not in allowed_groups: gb = "producto"
    obj["group_by"] = gb

    meas = (_norm(obj.get("measure")) or "venta").lower()
    allowed_measures = {"venta","cantidad","margen","costo","margen_pct"}
    if meas not in allowed_measures: meas = "venta"
    obj["measure"] = meas

    ob = (_norm(obj.get("order_by")) or "value_desc").lower()
    if ob not in {"value_desc","value_asc","group_asc"}: ob = "value_desc"
    obj["order_by"] = ob

    # --- filtros complementarios ---
    def _norm_list(xs):
        if not isinstance(xs, list): return []
        out = []
        for x in xs:
            s = _norm(x)
            if s: out.append(s)
        return out
    f = obj.get("filters") or {}
    if not isinstance(f, dict): f = {}
    f["include_categories"] = _norm_list(f.get("include_categories"))[:60]  # IDs o nombres
    f["include_locals"] = _norm_list(f.get("include_locals"))[:60]          # ALMLOC…
    f["include_siglas"] = [s.upper() for s in _norm_list(f.get("include_siglas"))][:40]  # ALM…
    f["weather_in"] = [s.lower() for s in _norm_list(f.get("weather_in")) if s.lower() in {"lluvia","soleado","nieve","otro","sin_dato"}][:5]
    try:
        f["min_uds"] = int(f.get("min_uds", 0))
    except Exception:
        f["min_uds"] = 0
    obj["filters"] = f

    # --- vista / comparativo ---
    v = obj.get("view") or {}
    if not isinstance(v, dict): v = {}
    try:
        v_limit = int(v.get("limit", 20))
    except Exception:
        v_limit = 20
    v["limit"] = max(1, min(v_limit, 200))
    cmpv = (_norm(v.get("compare")) or "mom").lower()  # 'yoy'|'mom'|'none'
    if cmpv not in {"yoy","mom","none"}: cmpv = "mom"
    v["compare"] = cmpv
    v["detail"] = bool(v.get("detail", False))  # solo afecta modo 'diario' si dataset existe
    # incluir métricas adicionales a imprimir junto a 'measure'
    inc = v.get("include_measures") or []
    if not isinstance(inc, list): inc = []
    allowed_extra = {"venta","cantidad","margen","costo","margen_pct"}
    v["include_measures"] = [str(x).lower() for x in inc if str(x).lower() in allowed_extra][:4]
    obj["view"] = v

    obj["reason"] = _norm(obj.get("reason"))
    return obj


SPEC = FilterSpec(
    key="productos",
    schema_text=(
        '{'
          '"by":"codigo"|"nombre"|"categoria"|"", "q":"", '
          '"period":"YYYYMM|", '
          '"group_by":"producto"|"categoria"|"familia"|"subfamilia"|"centroproduccion"|"mes"|"local"|"weather"|"mes_weather"|"local_weather",'
          '"measure":"venta"|"cantidad"|"margen"|"costo"|"margen_pct",'
          '"order_by":"value_desc"|"value_asc"|"group_asc",'
          '"filters":{"include_categories":["Pastas"],"include_locals":["ALMLOC"],"include_siglas":["ALM"],"weather_in":["lluvia"],"min_uds":0},'
          '"view":{"limit":20,"compare":"mom","detail":false,"include_measures":["margen","margen_pct"]},'
          '"top":false,"hide_values":false,'
          '"reason":""'
        '}'
    ),
    rules_text=(
        "- 'más vendidos/top' => order_by='value_desc', measure='venta', top=true.\n"
        "- 'más rentables' => measure='margen'; 'menos rentables' => measure='margen' + order_by='value_asc'.\n"
        "- 'peor margen %' => measure='margen_pct', order_by='value_asc' (usar filters.min_uds para evitar outliers).\n"
        "- 'por familia/subfamilia/centro de costo/local' => group_by acorde.\n"
        "- 'con lluvia/soleado/nieve' => weather_in=[...]; si piden comparar climas => group_by='weather' o 'local_weather'/'mes_weather'.\n"
        "- 'ticket' se calcula fuera (no es measure aquí). Para comparativos: 'vs mes pasado' => view.compare='mom'; 'vs año pasado' => 'yoy'.\n"
        "- Categorías: mapear nombres/IDs de db.categories a include_categories.\n"
        "- Periodo: natural → YYYYMM (si hay rango multi-mes, se arma vía handler multi-periodos).\n"
        "- 'con la renta' o 'con rentabilidad' + top/mas vendidos => measure='venta' y view.include_measures=['margen','margen_pct'].\n"
        "- 'rentabilidad' a secas => si no especifican measure, usar measure='margen'.\n"
        "- 'centro de costo'|'centro de producción'|'cocina fría'|'cocina caliente' => group_by='centroproduccion'."
    ),
    catalogs=[
        ("CATEGORIAS(id|nombre)", _catalog_categories),
        ("MENUS(codigo|nombre|descripcion)", _catalog_menus),
        ("WEATHER_TAGS", _catalog_weather_tags),
    ],
    postprocess=_postprocess_productos,
)
register_filter_spec(SPEC)
