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
        descr = _norm(r.get("descripcion"))
        if code or name or descr:
            out.append(f"{code}|{name}|{descr[:120]}")
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
    # Derivar códigos desde la consulta de producto/texto para filtrar el dataset horario
    q = obj.get("q") or ""
    if q:
        # si by='producto' y parece código exacto, úsalo directo
        if obj.get("by") == "producto" and len(q) >= 4 and q.isdigit():
            if q.upper() not in f["include_codigos"]:
                f["include_codigos"].append(q.upper())
        else:
            # buscar por nombre/descripcion contiene q
            try:
                # case-insensitive, sin acentos, y con singularización básica; limitar a 200 códigos
                q_norm = _no_accents(q).lower()
                needles = set(_singularize_es(q_norm))
                codes: list[str] = []
                for m in db.menus.find({}, {"codigo":1, "nombre":1, "descripcion":1}).limit(5000):
                    name = _no_accents(_norm(m.get("nombre")) or "").lower()
                    descr = _no_accents(_norm(m.get("descripcion")) or "").lower()
                    if any(n in name or n in descr for n in needles):
                        c = _norm(m.get("codigo"))
                        if c and c.upper() not in codes:
                            codes.append(c.upper())
                    if len(codes) >= 200:
                        break
                # unir con existente
                for c in codes:
                    if c not in f["include_codigos"]:
                        f["include_codigos"].append(c)
                f["include_codigos"] = f["include_codigos"][:200]
            except Exception:
                pass
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
    ),
    catalogs=[
        ("CATEGORIAS(id|nombre)", _catalog_categories),
        ("MENUS(codigo|nombre|descripcion)", _catalog_menus),
    ],
    postprocess=_postprocess_menus,
)
register_filter_spec(SPEC)
