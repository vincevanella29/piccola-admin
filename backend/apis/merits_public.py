# routers/public_merit_rankings.py
import logging
import os
from typing import Optional, List, Dict, Any
from datetime import datetime
from dateutil.relativedelta import relativedelta
from collections import defaultdict

from fastapi import APIRouter, Depends, Query
from utils.web3mongo import db
from utils.auth.session import verify_session
from config.roles.access_locals import normalize_sucursal_to_sigla
from config.gamification.helpers import list_permitted_segments_for_company

router = APIRouter()
logger = logging.getLogger(__name__)

RESULTS = db.meritocracy_kpi_results
WORKERS = db.trabajadores_vpn
LINKS = db.empleados_usuarios

# ==================== Segmentos permitidos (cache) ====================
_SEGMENTS_CACHE: Dict[str, Any] = {}

def _get_allowed_segments_cached() -> Dict[int, Dict[str, Any]]:
    """
    { token_id: {name, symbol} } de segmentos permitidos para la compañía.
    """
    global _SEGMENTS_CACHE
    if "allowed_segments" in _SEGMENTS_CACHE:
        return _SEGMENTS_CACHE["allowed_segments"]

    data = list_permitted_segments_for_company()  # {'daoAddress':..., 'segments': [...]}
    allowed = {
        seg["token_id"]: {"name": seg.get("name"), "symbol": seg.get("symbol")}
        for seg in (data.get("segments") or [])
        if seg.get("allowed")
    }
    _SEGMENTS_CACHE["allowed_segments"] = allowed
    _SEGMENTS_CACHE["daoAddress"] = data.get("daoAddress")
    return allowed

def _zero_merit_profile(wallet: Optional[str]) -> Dict[str, Any]:
    allowed = _get_allowed_segments_cached()
    dao_address = _SEGMENTS_CACHE.get("daoAddress")
    company_id_env = int(os.getenv('COMPANY_ID', '1'))
    segments = [
        {"token_id": tid, "name": meta["name"], "symbol": meta["symbol"], "balance": 0}
        for tid, meta in sorted(allowed.items(), key=lambda x: x[0])
    ]
    return {
        "ok": True,
        "wallet": wallet,
        "company_id": company_id_env,
        "daoAddress": dao_address,
        "segments": segments,
        "total_balance": 0,
    }
# ======================================================================

def _last_n_months(n: int) -> List[str]:
    now = datetime.now()
    start = datetime(now.year, now.month, 1)
    months = []
    for i in range(n):
        dt = start - relativedelta(months=i)
        months.append(dt.strftime("%Y-%m"))
    return list(reversed(months))  # asc

def _get_workers_filtered(sucursal: Optional[str], cargo: Optional[str]) -> List[Dict[str, Any]]:
    normalized = normalize_sucursal_to_sigla(sucursal) if sucursal else None
    match_q: Dict[str, Any] = {"activo": 1}
    if normalized:
        match_q["sucursal"] = normalized
    if cargo:
        match_q["cargo"] = cargo
    return list(WORKERS.find(match_q, {
        "rut":1,"nombres":1,"apellidopaterno":1,"cargo":1,"sucursal":1,
        "profile_image_url":1,"profile_image_hash":1,"activo":1
    }))

def _monthly_points(periods: List[str]) -> List[Dict[str, Any]]:
    pipe = [
        {"$match": {"periodo": {"$in": periods}}},
        {"$group": {
            "_id": {"rut": "$rut", "periodo": "$periodo"},
            "puntos": {"$sum": {"$ifNull": ["$merit_points", 0]}}
        }},
        {"$project": {
            "_id": 0,
            "rut": {"$toString": "$_id.rut"},
            "periodo": "$_id.periodo",
            "puntos": 1
        }}
    ]
    return list(RESULTS.aggregate(pipe))

def _segment_totals_all_time() -> List[Dict[str, Any]]:
    """
    Totales por RUT y segmento para toda la historia (sin filtro de periodo), separando minted vs pending.
    """
    pipe = [
        {"$group": {
            "_id": {"rut": "$rut", "seg": "$segment_token_id"},
            "wallet_pts": {"$sum": {
                "$cond": [{"$eq": ["$mint_status", "minted"]}, {"$ifNull": ["$merit_points", 0]}, 0]
            }},
            "pending_pts": {"$sum": {
                "$cond": [{"$ne": ["$mint_status", "minted"]}, {"$ifNull": ["$merit_points", 0]}, 0]
            }},
        }},
        {"$project": {
            "_id": 0,
            "rut": {"$toString": "$_id.rut"},
            "segment_token_id": "$_id.seg",
            "wallet_pts": 1,
            "pending_pts": 1
        }}
    ]
    return list(RESULTS.aggregate(pipe))

def _segment_totals(periods: List[str]) -> List[Dict[str, Any]]:
    """
    Totales por RUT y segmento en N meses, separando minted (wallet) vs pending.
    """
    pipe = [
        {"$match": {"periodo": {"$in": periods}}},
        {"$group": {
            "_id": {"rut": "$rut", "seg": "$segment_token_id"},
            "wallet_pts": {"$sum": {
                "$cond": [{"$eq": ["$mint_status", "minted"]}, {"$ifNull": ["$merit_points", 0]}, 0]
            }},
            "pending_pts": {"$sum": {
                "$cond": [{"$ne": ["$mint_status", "minted"]}, {"$ifNull": ["$merit_points", 0]}, 0]
            }},
        }},
        {"$project": {
            "_id": 0,
            "rut": {"$toString": "$_id.rut"},
            "segment_token_id": "$_id.seg",
            "wallet_pts": 1,
            "pending_pts": 1
        }}
    ]
    return list(RESULTS.aggregate(pipe))

def _rank_with_ties(items: List[Dict[str, Any]], key: str) -> Dict[str, int]:
    """
    items ya ordenados desc por 'key'. Retorna { rut: rank } con empates.
    """
    ranks: Dict[str, int] = {}
    last_val = None
    rank = 0
    for i, item in enumerate(items, start=1):
        v = float(item.get(key, 0) or 0)
        if last_val is None or v < last_val:
            rank = i
            last_val = v
        ranks[str(item["rut"])] = rank
    return ranks

@router.get("/public/merits/rankings", summary="Ranking público por méritos (wallet vs simulado) con segmentos")
async def public_merit_rankings(
    months: int = Query(3, ge=1, le=12),
    sucursal: Optional[str] = None,
    cargo: Optional[str] = None,
    rank_mode: str = Query("simulated", regex="^(wallet|simulated)$"),
    limit: int = Query(200000, ge=1, le=200000),
    skip: int = 0,
    user: dict = Depends(verify_session),
):
    periods = _last_n_months(months)
    seg_catalog = _get_allowed_segments_cached()  # ← usa list_permitted_segments_for_company()

    # base empleados
    workers = _get_workers_filtered(sucursal, cargo)
    emp_map: Dict[str, Dict[str, Any]] = {}
    for w in workers:
        rut = str(w.get("rut")) if w.get("rut") else None
        if not rut:
            continue
        emp_map[rut] = {
            "rut": rut,
            "nombre": w.get("nombres"),
            "apellido": w.get("apellidopaterno"),
            "local": w.get("sucursal"),
            "cargo": w.get("cargo"),
            "profile_image_url": w.get("profile_image_url"),
            "profile_image_hash": w.get("profile_image_hash"),
            "activo": w.get("activo"),
            "months": {p: {"puntos": 0} for p in periods},
            "__merit": {
                "walletBySegment": {},   # {symbol: puntos}
                "pendingBySegment": {},  # {symbol: puntos}
                "total_wallet": 0.0,
                "total_pending": 0.0,
                "total_simulated": 0.0,
            },
        }

    if not emp_map:
        return {
            "count": 0,
            "total_count": 0,
            "filters": {"months": months, "sucursal": sucursal, "cargo": cargo, "periodos": periods, "rank_mode": rank_mode},
            "segments_catalog": [],
            "ranking": [],
        }

    # cargar puntos por mes
    for d in _monthly_points(periods):
        rut = d.get("rut"); per = d.get("periodo"); pts = float(d.get("puntos") or 0)
        if rut in emp_map and per in emp_map[rut]["months"]:
            emp_map[rut]["months"][per]["puntos"] = pts

    # cargar totales por segmento wallet/pending (ventana de meses) para ranking
    for d in _segment_totals(periods):
        rut = d.get("rut")
        if rut not in emp_map:
            continue
        seg_id = d.get("segment_token_id")
        meta = seg_catalog.get(seg_id) if isinstance(seg_id, int) else None
        symbol = (meta or {}).get("symbol") or (f"SEG_{seg_id}" if seg_id is not None else "UNK")

        wpts = float(d.get("wallet_pts") or 0)
        ppts = float(d.get("pending_pts") or 0)

        emp = emp_map[rut]
        emp["__merit"]["walletBySegment"][symbol] = emp["__merit"]["walletBySegment"].get(symbol, 0) + wpts
        emp["__merit"]["pendingBySegment"][symbol] = emp["__merit"]["pendingBySegment"].get(symbol, 0) + ppts

    # cargar totales por segmento ALL-TIME para presentación en tabla
    __all_map: Dict[str, Dict[str, Dict[str, float]]] = {}
    for d in _segment_totals_all_time():
        rut = d.get("rut")
        if rut not in emp_map:
            continue
        seg_id = d.get("segment_token_id")
        meta = seg_catalog.get(seg_id) if isinstance(seg_id, int) else None
        symbol = (meta or {}).get("symbol") or (f"SEG_{seg_id}" if seg_id is not None else "UNK")
        wpts = float(d.get("wallet_pts") or 0)
        ppts = float(d.get("pending_pts") or 0)
        if rut not in __all_map:
            __all_map[rut] = {"walletBy": {}, "pendingBy": {}}
        __all_map[rut]["walletBy"][symbol] = __all_map[rut]["walletBy"].get(symbol, 0.0) + wpts
        __all_map[rut]["pendingBy"][symbol] = __all_map[rut]["pendingBy"].get(symbol, 0.0) + ppts

    # totales y wallet
    links = list(LINKS.find({"rut": {"$in": list(emp_map.keys())}}, {"rut": 1, "wallet": 1}))
    link_map = {str(x.get("rut")): (x.get("wallet") or None) for x in links}

    for rut, emp in emp_map.items():
        # Para ranking seguimos usando la ventana de meses (emp["__merit"]).
        # Para mostrar en tabla usamos los totales ALL-TIME si existen.
        wm_months = emp["__merit"]["walletBySegment"]; pm_months = emp["__merit"]["pendingBySegment"]
        total_wallet_months = sum(float(v or 0) for v in wm_months.values())
        total_pending_months = sum(float(v or 0) for v in pm_months.values())
        emp["__merit"]["total_wallet"] = total_wallet_months
        emp["__merit"]["total_pending"] = total_pending_months
        emp["__merit"]["total_simulated"] = total_wallet_months + total_pending_months

        # All-time totals for presentation
        wm_all = (__all_map.get(rut, {}) or {}).get("walletBy", {})
        pm_all = (__all_map.get(rut, {}) or {}).get("pendingBy", {})
        total_wallet_all = sum(float(v or 0) for v in wm_all.values())
        total_pending_all = sum(float(v or 0) for v in pm_all.values())
        # NOTE: Do not overwrite monthly totals stored in emp['__merit'].
        # Monthly totals are used for ranking; all-time totals are used for presentation below.
        emp["wallet"] = link_map.get(rut)
        emp["merit_profile"] = _zero_merit_profile(emp["wallet"])  # estructura completa de segmentos

        # Build consolidated merits list by segment with token_id, name, symbol, and wallet/pending/simulated
        merits_list = []
        for tid, meta in sorted(seg_catalog.items(), key=lambda x: x[0]):
            symbol = meta.get("symbol")
            wallet_pts = float(wm_all.get(symbol, 0) or 0)
            pending_pts = float(pm_all.get(symbol, 0) or 0)
            simulated_pts = wallet_pts + pending_pts
            total_pts = wallet_pts if rank_mode == "wallet" else simulated_pts
            merits_list.append({
                "token_id": tid,
                "name": meta.get("name"),
                "symbol": symbol,
                "wallet": round(wallet_pts, 2),
                "pending": round(pending_pts, 2),
                "simulated": round(simulated_pts, 2),
                # total keeps backward-compat with current rank_mode
                "total": round(total_pts, 2),
            })
        emp["merits_by_segment"] = merits_list
        emp["merits_summary"] = {
            "total_wallet": round(total_wallet_all, 2),
            "total_pending": round(total_pending_all, 2),
            "total_simulated": round(total_wallet_all + total_pending_all, 2),
        }

    # ranking por méritos (wallet o simulado)
    metric_key = "__merit.total_wallet" if rank_mode == "wallet" else "__merit.total_simulated"
    rows = list(emp_map.values())
    rows.sort(key=lambda e: float(e["__merit"]["total_wallet"] if rank_mode == "wallet" else e["__merit"]["total_simulated"]), reverse=True)

    # puesto empresa
    company_ranks = _rank_with_ties(
        [{"rut": r["rut"], "val": r["__merit"]["total_wallet"] if rank_mode == "wallet" else r["__merit"]["total_simulated"]} for r in rows],
        key="val"
    )
    # puesto local
    by_local: Dict[str, List[Dict[str, Any]]] = defaultdict(list)
    for r in rows:
        by_local[str(r.get("local") or "—")].append(r)
    local_ranks: Dict[str, Dict[str, int]] = {}
    for loc, arr in by_local.items():
        arr_sorted = sorted(arr, key=lambda e: float(e["__merit"]["total_wallet"] if rank_mode == "wallet" else e["__merit"]["total_simulated"]), reverse=True)
        local_ranks[loc] = _rank_with_ties(
            [{"rut": e["rut"], "val": e["__merit"]["total_wallet"] if rank_mode == "wallet" else e["__merit"]["total_simulated"]} for e in arr_sorted],
            key="val"
        )
    for r in rows:
        r["puesto_empresa"] = company_ranks.get(r["rut"])
        r["puesto_local"] = local_ranks.get(str(r.get("local") or "—"), {}).get(r["rut"])

    total = len(rows)
    paginated = rows[skip: skip + limit]

    return {
        "count": len(paginated),
        "total_count": total,
        "filters": {"months": months, "sucursal": sucursal, "cargo": cargo, "periodos": periods, "rank_mode": rank_mode},
        "segments_catalog": [
            {"token_id": tid, "name": meta["name"], "symbol": meta["symbol"]}
            for tid, meta in sorted(seg_catalog.items(), key=lambda x: x[0])
        ],
        "ranking": paginated,
    }

@router.get("/public/merits/history", summary="Historial de méritos por empleado (con segmento y agregados)")
async def public_merit_history(
    rut: Optional[str] = Query(None),
    wallet: Optional[str] = Query(None),
    include_profile: bool = Query(True),
    user: dict = Depends(verify_session),
):
    if not rut and not wallet:
        return {"ok": False, "error": "Debe especificar rut o wallet"}

    target_rut = None
    if rut:
        target_rut = str(rut)
    elif wallet:
        link = LINKS.find_one({"wallet": wallet.lower()}, {"rut": 1})
        if link and link.get("rut"):
            target_rut = str(link.get("rut"))
    if not target_rut:
        return {"ok": False, "error": "Empleado no encontrado"}

    seg_catalog = _get_allowed_segments_cached()  # ← usa list_permitted_segments_for_company()

    results = list(RESULTS.find({"rut": target_rut}).sort([("periodo", -1)]))
    by_period: Dict[str, List[Dict[str, Any]]] = defaultdict(list)
    totals = {"total_points": 0, "fulfilled_count": 0, "not_fulfilled_count": 0, "minted_count": 0}

    by_segment_acc = defaultdict(lambda: {"wallet": 0.0, "pending": 0.0})

    for d in results:
        pts = float(d.get("merit_points") or 0)
        seg_id = d.get("segment_token_id")
        meta = seg_catalog.get(seg_id) if isinstance(seg_id, int) else None
        seg_obj = {"token_id": seg_id, "name": (meta or {}).get("name"), "symbol": (meta or {}).get("symbol")}
        is_minted = (d.get("mint_status") == "minted")

        item = {
            "result_id": str(d.get("_id")) if d.get("_id") else None,
            "periodo": d.get("periodo"),
            "rule_id": str(d.get("rule_id")) if d.get("rule_id") is not None else None,
            "template_key": d.get("template_key"),
            "name": d.get("rule_name") or None,
            "params": d.get("params"),
            "merit_points": pts,
            "status": d.get("status"),
            "mint_status": d.get("mint_status"),
            "segment_token_id": seg_id,
            "segment": seg_obj,
        }
        by_period[d.get("periodo")].append(item)

        totals["total_points"] += pts
        if d.get("status") == "fulfilled":
            totals["fulfilled_count"] += 1
            if is_minted:
                totals["minted_count"] += 1
        else:
            totals["not_fulfilled_count"] += 1

        sym = seg_obj.get("symbol") or (f"SEG_{seg_id}" if seg_id is not None else "UNK")
        if is_minted:
            by_segment_acc[sym]["wallet"] += pts
        else:
            by_segment_acc[sym]["pending"] += pts

    periods_sorted = sorted(by_period.keys(), reverse=True)
    history = [{"periodo": p, "items": by_period[p]} for p in periods_sorted]

    by_segment = {
        sym: {
            "wallet": round(v["wallet"], 2),
            "pending": round(v["pending"], 2),
            "total": round(v["wallet"] + v["pending"], 2),
        }
        for sym, v in by_segment_acc.items()
    }

    payload: Dict[str, Any] = {"rut": target_rut, "history": history, "totals": totals, "by_segment": by_segment}

    if include_profile:
        emp = WORKERS.find_one(
            {"$or": [{"rut": target_rut}, {"rut": int(target_rut) if target_rut.isdigit() else None}]},
            {"rut":1,"nombres":1,"apellidopaterno":1,"cargo":1,"sucursal":1,"profile_image_url":1,"profile_image_hash":1,"activo":1}
        )
        if emp:
            payload["employee"] = {
                "rut": str(emp.get("rut")) if emp.get("rut") else target_rut,
                "nombre": emp.get("nombres"),
                "apellido": emp.get("apellidopaterno"),
                "cargo": emp.get("cargo"),
                "local": emp.get("sucursal"),
                "profile_image_url": emp.get("profile_image_url"),
                "profile_image_hash": emp.get("profile_image_hash"),
                "activo": emp.get("activo"),
            }
        link = LINKS.find_one({"$or": [{"rut": target_rut}, {"rut": int(target_rut) if target_rut.isdigit() else None}]}, {"wallet": 1})
        wallet_addr = (link or {}).get("wallet")
        payload["wallet"] = wallet_addr
        payload["merit_profile"] = _zero_merit_profile(wallet_addr)

    return payload
