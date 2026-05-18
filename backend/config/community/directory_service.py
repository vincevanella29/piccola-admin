import logging
from typing import Optional
from utils.web3mongo import db

logger = logging.getLogger(__name__)

def get_community_catalogs():
    cursor = db.cargos_intranet.find({}, {"_id": 0, "cargo": 1, "seccion": 1})
    cargos_set = set()
    secciones_set = set()
    for doc in cursor:
        c = (doc.get("cargo") or "").strip()
        s = (doc.get("seccion") or "").strip()
        if c:
            cargos_set.add(c)
        if s:
            secciones_set.add(s)
    return {
        "ok": True,
        "cargos": sorted(list(cargos_set)),
        "secciones": sorted(list(secciones_set)),
    }


def get_community_members(seccion: Optional[str] = None, cargo: Optional[str] = None, q: Optional[str] = None):
    pipeline = [
        {"$match": {"activo": 1}},
        {
            "$lookup": {
                "from": "cargos_intranet",
                "localField": "cargo",
                "foreignField": "cargo",
                "as": "_ci",
            }
        },
        {"$addFields": {"seccion": {"$ifNull": [{"$arrayElemAt": ["$_ci.seccion", 0]}, ""]}}},
        {
            "$lookup": {
                "from": "empleados_usuarios",
                "localField": "rut",
                "foreignField": "rut",
                "as": "_eu",
            }
        },
        {
            "$addFields": {
                "wallet": {"$ifNull": [{"$arrayElemAt": ["$_eu.wallet", 0]}, None]},
            }
        },
        {
            "$project": {
                "_id": 0,
                "rut": 1,
                "nombres": 1,
                "apellidopaterno": 1,
                "cargo": 1,
                "seccion": 1,
                "wallet": 1,
                "profile_image_url": 1,
            }
        },
    ]

    if seccion:
        pipeline.append({"$match": {"seccion": {"$regex": f"^{seccion}$", "$options": "i"}}})
    if cargo:
        pipeline.append({"$match": {"cargo": {"$regex": f"^{cargo}$", "$options": "i"}}})
    if q:
        pipeline.append({"$match": {
            "$or": [
                {"nombres": {"$regex": q, "$options": "i"}},
                {"apellidopaterno": {"$regex": q, "$options": "i"}},
                {"cargo": {"$regex": q, "$options": "i"}},
            ]
        }})

    pipeline.append({"$sort": {"nombres": 1}})
    pipeline.append({"$limit": 200})

    workers = list(db.trabajadores_vpn.aggregate(pipeline))

    ruts = [w.get("rut") for w in workers if w.get("rut")]
    str_ruts = [str(r) for r in ruts]
    int_ruts = [int(r) for r in ruts if str(r).isdigit()]
    eu_docs = list(db.empleados_usuarios.find(
        {"rut": {"$in": str_ruts + int_ruts}},
        {"rut": 1, "wallet": 1, "email": 1, "sub": 1}
    ))
    rut_to_eu = {}
    for eu in eu_docs:
        if eu.get("rut"):
            rut_to_eu[str(eu["rut"])] = {
                "wallet": (eu.get("wallet") or "").lower() or None,
                "email": eu.get("email"),
                "has_user": bool(eu.get("sub") or eu.get("email")),
            }

    members = []
    for w in workers:
        name_parts = [w.get("nombres", ""), w.get("apellidopaterno", "")]
        name = " ".join(p.strip() for p in name_parts if p.strip()) or "Worker"
        eu_data = rut_to_eu.get(str(w.get("rut")), {})
        members.append({
            "name": name,
            "wallet": eu_data.get("wallet"),
            "cargo": w.get("cargo", ""),
            "seccion": w.get("seccion", ""),
            "sucursal": w.get("sucursal", ""),
            "profile_image_url": w.get("profile_image_url"),
            "rut": w.get("rut"),
            "email": eu_data.get("email"),
            "has_user": eu_data.get("has_user", False),
        })

    return members


def get_community_presence(presence_map: dict):
    pipeline = [
        {"$match": {"activo": 1}},
        {
            "$lookup": {
                "from": "cargos_intranet",
                "localField": "cargo",
                "foreignField": "cargo",
                "as": "_ci",
            }
        },
        {"$addFields": {"seccion": {"$ifNull": [{"$arrayElemAt": ["$_ci.seccion", 0]}, ""]}}},
        {
            "$lookup": {
                "from": "empleados_usuarios",
                "localField": "rut",
                "foreignField": "rut",
                "as": "_eu",
            }
        },
        {
            "$addFields": {
                "wallet": {"$ifNull": [{"$arrayElemAt": ["$_eu.wallet", 0]}, None]},
            }
        },
        {
            "$project": {
                "_id": 0,
                "rut": 1,
                "nombres": 1,
                "apellidopaterno": 1,
                "cargo": 1,
                "seccion": 1,
                "wallet": 1,
                "profile_image_url": 1,
            }
        },
    ]

    workers = list(db.trabajadores_vpn.aggregate(pipeline))

    # Fix RUT type mismatch: $lookup fails if rut types differ (int vs string).
    # Manual fallback for workers where wallet is still None.
    for w in workers:
        if w.get("wallet"):
            continue
        rut = w.get("rut")
        if rut is None:
            continue
        # Try alternate type (int ↔ string)
        try:
            alt_rut = int(rut) if isinstance(rut, str) else str(rut)
        except (ValueError, TypeError):
            continue
        eu = db.empleados_usuarios.find_one({"rut": alt_rut}, {"wallet": 1})
        if eu and eu.get("wallet"):
            w["wallet"] = eu["wallet"]

    online = []
    idle = []
    offline = []

    for w in workers:
        name_parts = [w.get("nombres", ""), w.get("apellidopaterno", "")]
        name = " ".join(p.strip() for p in name_parts if p.strip()) or "Trabajador"
        wallet = (w.get("wallet") or f"rut_{w.get('rut')}").lower()

        p_data = presence_map.get(wallet)
        status = p_data.get("status") if p_data else "offline"

        entry = {
            "wallet": wallet,
            "name": name,
            "status": status,
            "cargo": w.get("cargo", ""),
            "seccion": w.get("seccion", ""),
            "profile_image_url": w.get("profile_image_url"),
            "rut": w.get("rut")
        }

        if status == "online":
            online.append(entry)
        elif status == "idle":
            idle.append(entry)
        else:
            offline.append(entry)

    import os
    COMPANY_ID = int(os.getenv("COMPANY_ID", "1"))
    com_users = list(db.community_users.find())
    reg_users = list(db.users.find({"company_id": COMPANY_ID}))
    
    seen_wallets = {e["wallet"] for e in online + idle + offline}
    
    for cu in com_users + reg_users:
        c_wallet = (cu.get("wallet") or cu.get("address") or "").lower()
        if not c_wallet or c_wallet in seen_wallets:
            continue
            
        profile = cu.get("profile") or {}
        c_name = profile.get("name") or cu.get("name") or cu.get("display_name") or "Usuario Registrado"
        
        p_data = presence_map.get(c_wallet)
        status = p_data.get("status") if p_data else "offline"
        
        entry = {
            "wallet": c_wallet,
            "name": c_name,
            "status": status,
            "cargo": "Comunidad",
            "seccion": "Comunidad",
            "profile_image_url": profile.get("profile_image_url") or cu.get("profile_image_url"),
            "rut": None
        }
        
        seen_wallets.add(c_wallet)
        
        if status == "online":
            online.append(entry)
        elif status == "idle":
            idle.append(entry)
        else:
            offline.append(entry)

    def group_by_section(members):
        sections = {}
        for m in members:
            sec = (m.get("seccion") or "General").strip()
            if sec not in sections:
                sections[sec] = []
            sections[sec].append(m)
        return sections

    return {
        "ok": True,
        "online_count": len(online),
        "idle_count": len(idle),
        "online": group_by_section(online),
        "idle": group_by_section(idle),
        "offline": group_by_section(offline),
    }
