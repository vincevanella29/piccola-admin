from __future__ import annotations
from typing import Dict, Any, List, Optional
from utils.web3mongo import db

def _get_segment_metadata() -> Dict[int, Dict]:
    """
    Obtiene los nombres y símbolos de todos los segmentos desde los eventos
    y los devuelve en un diccionario para un mapeo rápido.
    """
    pipeline = [
        {"$match": {"event": "TokenCreated"}},
        {"$sort": {"blockNumber": 1}},
        {"$group": {
            "_id": "$args.tokenId",
            "name": {"$last": "$args.name"},
            "symbol": {"$last": "$args.symbol"},
        }}
    ]
    segments = list(db.global_meritocracy_events.aggregate(pipeline))
    return {
        seg['_id']: {"name": seg.get("name"), "symbol": seg.get("symbol")}
        for seg in segments
    }

def list_merit_results(
    periodo_start: Optional[str] = None,
    periodo_end: Optional[str] = None,
    mint_status: Optional[str] = None,
    status: Optional[str] = None
) -> List[Dict]:
    """
    Lista los resultados de méritos, enriquecidos con datos del empleado y del segmento.
    """
    segment_metadata = _get_segment_metadata()
    
    pipeline = []
    
    # Etapa 1: Filtrado inicial
    match_filter = {}
    if periodo_start and periodo_end:
        match_filter["periodo"] = {"$gte": periodo_start, "$lte": periodo_end}
    elif periodo_start:
        match_filter["periodo"] = {"$gte": periodo_start}
    elif periodo_end:
        match_filter["periodo"] = {"$lte": periodo_end}
        
    if status: match_filter["status"] = status
    if mint_status:
        match_filter["mint_status"] = {"$in": [None, "pending"]} if mint_status == "pending" else mint_status
            
    if match_filter:
        pipeline.append({"$match": match_filter})

    # Etapa 2: Unir con empleados_usuarios (para filtrar por wallet)
    pipeline.append({
        "$lookup": {
            "from": "empleados_usuarios", "localField": "rut", "foreignField": "rut", "as": "usuario_info"
        }
    })
    pipeline.extend([
        {"$unwind": "$usuario_info"},
        {"$match": {"usuario_info.status": "active", "usuario_info.wallet": {"$exists": True, "$ne": ""}}}
    ])

    # Etapa 3: Unir con trabajadores_vpn (para nombre, foto, cargo)
    pipeline.append({
        "$lookup": {
            "from": "trabajadores_vpn",
            "let": {"rut_local": "$rut"},
            "pipeline": [
                {
                    "$match": {
                        "$expr": {
                            "$or": [
                                {"$eq": ["$rut", "$$rut_local"]},
                                {"$eq": [{"$toString": "$rut"}, {"$toString": "$$rut_local"}]}
                            ]
                        }
                    }
                }
            ],
            "as": "trabajador_info"
        }
    })
    pipeline.append({"$unwind": {"path": "$trabajador_info", "preserveNullAndEmptyArrays": True}})

    # Etapa 4: Proyectar un resultado limpio
    pipeline.append({
        "$project": {
            "_id": 0, "result_id": {"$toString": "$_id"}, "periodo": 1, "rut": 1,
            "employee_name": {
                "$let": {
                    "vars": {
                        "nombres": {"$ifNull": ["$trabajador_info.nombres", ""]},
                        "ap": {"$ifNull": ["$trabajador_info.apellidopaterno", ""]}
                    },
                    "in": {
                        "$trim": {"input": {"$concat": [
                            "$$nombres",
                            {"$cond": [{"$and": [{"$ne": ["$$nombres", ""]}, {"$ne": ["$$ap", ""]}]}, " ", ""]},
                            "$$ap"
                        ]}}
                    }
                }
            },
            "employee_photo": "$trabajador_info.profile_image_url",
            "employee_cargo": "$trabajador_info.cargo",
            "wallet": "$usuario_info.wallet", "rule_name": 1, "merit_points": 1,
            "segment_token_id": 1, "status": 1, "mint_status": {"$ifNull": ["$mint_status", "pending"]},
            "mint_tx_hash": "$mint_tx_hash", "minted_at": "$minted_at"
        }
    })
    
    pipeline.append({"$sort": {"periodo": -1, "rut": 1}})
    
    # Enriquecimiento final en Python con metadata de segmentos
    results = list(db.meritocracy_kpi_results.aggregate(pipeline))
    for res in results:
        token_id = res.get("segment_token_id")
        if token_id in segment_metadata:
            res["segment_info"] = segment_metadata[token_id]

    return results