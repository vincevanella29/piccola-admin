import logging
from typing import Optional
from bson import ObjectId
from datetime import datetime
from utils.web3mongo import db
from config.community.identity_manager import _enrich_sender

logger = logging.getLogger(__name__)

def _dm_conv_key(w1: str, w2: str) -> str:
    """Symmetric conversation key for two wallets."""
    pair = sorted([w1.lower(), w2.lower()])
    return f"dm:{pair[0]}:{pair[1]}"


def get_dm_conversations(wallet: str):
    pipeline = [
        {"$match": {"$or": [
            {"sender_wallet": wallet},
            {"peer_wallet": wallet},
        ]}},
        {"$sort": {"created_at": -1}},
        {"$group": {
            "_id": "$conv_key",
            "last_text": {"$first": "$text"},
            "last_at": {"$first": "$created_at"},
            "peer_wallet": {"$first": {
                "$cond": [{"$eq": ["$sender_wallet", wallet]}, "$peer_wallet", "$sender_wallet"]
            }},
            "peer_name": {"$first": {
                "$cond": [{"$eq": ["$sender_wallet", wallet]}, "$peer_name", "$sender_name"]
            }},
        }},
        {"$sort": {"last_at": -1}},
        {"$limit": 50},
    ]
    convos = list(db.chat_dm_messages.aggregate(pipeline))
    return [
        {
            "conv_key": c["_id"],
            "peer_wallet": c.get("peer_wallet"),
            "peer_name": c.get("peer_name"),
            "last_text": c.get("last_text"),
            "last_at": c.get("last_at"),
        }
        for c in convos
    ]


def get_dm_messages(wallet: str, peer: str, limit: int = 50, before: Optional[str] = None):
    conv_key = _dm_conv_key(wallet, peer)
    q = {"conv_key": conv_key}
    if before:
        try:
            q["_id"] = {"$lt": ObjectId(before)}
        except Exception:
            pass

    limit = min(max(1, limit), 100)
    msgs = list(
        db.chat_dm_messages.find(q)
        .sort("_id", -1)
        .limit(limit)
    )
    msgs.reverse()

    return [
        {
            "id": str(m["_id"]),
            "conv_key": m.get("conv_key"),
            "sender_wallet": m.get("sender_wallet"),
            "sender_name": m.get("sender_name"),
            "peer_wallet": m.get("peer_wallet"),
            "peer_name": m.get("peer_name"),
            "text": m.get("text", ""),
            "created_at": m.get("created_at").isoformat() if isinstance(m.get("created_at"), datetime) else m.get("created_at"),
        }
        for m in msgs
    ]


def resolve_peer_name(peer_wallet: str) -> str:
    peer_name = peer_wallet
    try:
        eu = db.empleados_usuarios.find_one({"wallet": peer_wallet})
        if eu and eu.get("rut"):
            trab = db.trabajadores_vpn.find_one({"rut": eu["rut"]})
            if trab:
                peer_name = f"{trab.get('nombres', '')} {trab.get('apellidopaterno', '')}".strip() or peer_wallet
    except Exception:
        pass
    return peer_name
